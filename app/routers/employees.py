from app.services.auth_service import require_admin_or_teacher, TokenData
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Query
from fastapi.responses import StreamingResponse
from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase, AsyncIOMotorGridFSBucket
from datetime import datetime
from bson import ObjectId
import base64
import io
import logging
from app.utils.image_utils import get_face_encoding

from app.database import get_database, get_fs
from app.models.employee import (
    EmployeeCreate, EmployeeUpdate, EmployeeResponse,
    EmployeeListResponse, PhotoMeta,
)
from app.services.face_service import get_face_service, FaceService
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Router for employee management and face recognition operations
router = APIRouter(prefix="/employees", tags=["employees"])


# Converts raw database document into API response schema
def _build_response(emp: dict) -> EmployeeResponse:
    return EmployeeResponse(
        id=str(emp["_id"]),
        employee_id=emp["employee_id"],
        name=emp["name"],
        email=emp["email"],
        department=emp.get("department"),
        position=emp.get("position"),
        photo_count=len(emp.get("face_encodings", [])),
        created_at=emp["created_at"],
        updated_at=emp["updated_at"],
        is_active=emp["is_active"],
    )


# Creates a new employee record
@router.post("", response_model=EmployeeResponse, status_code=201)
async def create_employee(
    employee: EmployeeCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    _: TokenData = Depends(require_admin_or_teacher),  
):
    existing = await db.employees.find_one({
        "$or": [{"employee_id": employee.employee_id}, {"email": employee.email}]
    })
    if existing:
        raise HTTPException(400, "Employee with this ID or email already exists")

    now = datetime.utcnow()
    doc = {
        **employee.model_dump(),
        "face_encodings": [],
        "photos": [],
        "created_at": now,
        "updated_at": now,
        "is_active": True,
    }
    result = await db.employees.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _build_response(doc)


# Retrieves a paginated and filtered list of employees
@router.get("", response_model=EmployeeListResponse)
async def list_employees(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    active_only: bool = Query(True),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    query: dict = {}
    if active_only:
        query["is_active"] = True
    if department:
        query["department"] = department
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"employee_id": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
        ]

    total = await db.employees.count_documents(query)
    cursor = db.employees.find(query).sort("name", 1).skip(skip).limit(limit)
    employees = await cursor.to_list(length=limit)
    return EmployeeListResponse(
        items=[_build_response(e) for e in employees],
        total=total, skip=skip, limit=limit,
    )


# Returns list of distinct departments for active employees
@router.get("/meta/departments")
async def list_departments(db: AsyncIOMotorDatabase = Depends(get_database)):
    depts = await db.employees.distinct("department", {"is_active": True})
    return {"departments": sorted(d for d in depts if d)}


# Retrieves details of a single employee by employee_id
@router.get("/{employee_id}", response_model=EmployeeResponse)
async def get_employee(
    employee_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    emp = await db.employees.find_one({"employee_id": employee_id})
    if not emp:
        raise HTTPException(404, "Employee not found")
    return _build_response(emp)


# Updates employee details (partial update supported)
@router.patch("/{employee_id}", response_model=EmployeeResponse)
async def update_employee(
    employee_id: str,
    updates: EmployeeUpdate,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    emp = await db.employees.find_one({"employee_id": employee_id})
    if not emp:
        raise HTTPException(404, "Employee not found")
    patch = {k: v for k, v in updates.model_dump().items() if v is not None}
    if not patch:
        raise HTTPException(400, "No fields to update")
    patch["updated_at"] = datetime.utcnow()
    await db.employees.update_one({"employee_id": employee_id}, {"$set": patch})
    updated = await db.employees.find_one({"employee_id": employee_id})
    return _build_response(updated)


# Uploads and processes an employee photo via file upload
@router.post("/{employee_id}/photos", status_code=201)
async def add_photo(
    employee_id: str,
    file: UploadFile = File(...),
    db: AsyncIOMotorDatabase = Depends(get_database),
    fs: AsyncIOMotorGridFSBucket = Depends(get_fs),
    face_service: FaceService = Depends(get_face_service),
):
    return await _process_photo_upload(employee_id, await file.read(), db, fs, face_service)


# Uploads and processes an employee photo via base64 input
@router.post("/{employee_id}/photos/base64", status_code=201)
async def add_photo_base64(
    employee_id: str,
    image_data: str = Form(...),
    db: AsyncIOMotorDatabase = Depends(get_database),
    fs: AsyncIOMotorGridFSBucket = Depends(get_fs),
    face_service: FaceService = Depends(get_face_service),
):
    if "," in image_data:
        image_data = image_data.split(",")[1]
    raw = base64.b64decode(image_data)
    return await _process_photo_upload(employee_id, raw, db, fs, face_service)


# Core logic for validating, encoding, and storing employee photos
async def _process_photo_upload(employee_id, raw_bytes, db, fs, face_service):
    emp = await db.employees.find_one({"employee_id": employee_id})
    if not emp:
        raise HTTPException(404, "Employee not found")

    current_count = len(emp.get("face_encodings", []))
    if current_count >= settings.max_photos_per_employee:
        raise HTTPException(400, f"Maximum of {settings.max_photos_per_employee} photos already stored.")

    b64 = base64.b64encode(raw_bytes).decode()
    encoding, message = face_service.extract_face_encoding(b64)
    if encoding is None:
        raise HTTPException(400, message)

    if face_service.is_duplicate_encoding(encoding, emp.get("face_encodings", [])):
        raise HTTPException(409, "Too similar to an existing photo. Use a different angle.")

    photo_id = await fs.upload_from_stream(
        filename=f"{employee_id}_{current_count}.jpg",
        source=io.BytesIO(raw_bytes),
        metadata={"employee_id": employee_id, "uploaded_at": datetime.utcnow()},
    )

    photo_meta = PhotoMeta(
        photo_id=str(photo_id),
        uploaded_at=datetime.utcnow(),
        encoding_index=current_count,
    )

    await db.employees.update_one(
        {"employee_id": employee_id},
        {
            "$push": {"face_encodings": encoding, "photos": photo_meta.model_dump()},
            "$set": {"updated_at": datetime.utcnow()},
        },
    )
    return {
        "success": True,
        "message": f"Photo added. Total: {current_count + 1}/{settings.max_photos_per_employee}",
        "photo_count": current_count + 1,
        "photo_id": str(photo_id),
    }


# Streams a stored employee photo by photo_id
@router.get("/{employee_id}/photos/{photo_id}")
async def get_photo(
    employee_id: str, photo_id: str,
    fs: AsyncIOMotorGridFSBucket = Depends(get_fs),
):
    try:
        grid_out = await fs.open_download_stream(ObjectId(photo_id))
        data = await grid_out.read()
        return StreamingResponse(io.BytesIO(data), media_type="image/jpeg")
    except Exception:
        raise HTTPException(404, "Photo not found")


# Lists all photos and metadata for a given employee
@router.get("/{employee_id}/photos")
async def list_photos(
    employee_id: str, db: AsyncIOMotorDatabase = Depends(get_database),
):
    emp = await db.employees.find_one({"employee_id": employee_id}, {"photos": 1, "face_encodings": 1})
    if not emp:
        raise HTTPException(404, "Employee not found")
    return {
        "employee_id": employee_id,
        "photo_count": len(emp.get("photos", [])),
        "max_photos": settings.max_photos_per_employee,
        "photos": emp.get("photos", []),
    }


# Deletes a specific photo and updates associated encodings
@router.delete("/{employee_id}/photos/{photo_id}")
async def delete_photo(
    employee_id: str, photo_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    fs: AsyncIOMotorGridFSBucket = Depends(get_fs),
):
    emp = await db.employees.find_one({"employee_id": employee_id})
    if not emp:
        raise HTTPException(404, "Employee not found")

    photos = emp.get("photos", [])
    encodings = emp.get("face_encodings", [])
    idx = next((i for i, p in enumerate(photos) if p.get("photo_id") == photo_id), None)
    if idx is None:
        raise HTTPException(404, "Photo not found")

    photos.pop(idx)
    encodings.pop(idx)
    for i, p in enumerate(photos):
        p["encoding_index"] = i

    await db.employees.update_one(
        {"employee_id": employee_id},
        {"$set": {"photos": photos, "face_encodings": encodings, "updated_at": datetime.utcnow()}},
    )
    try:
        await fs.delete(ObjectId(photo_id))
    except Exception:
        pass
    return {"success": True, "message": "Photo deleted", "photo_count": len(photos)}


# Removes all photos and encodings for an employee
@router.delete("/{employee_id}/photos")
async def clear_photos(
    employee_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    fs: AsyncIOMotorGridFSBucket = Depends(get_fs),
):
    emp = await db.employees.find_one({"employee_id": employee_id}, {"photos": 1})
    if not emp:
        raise HTTPException(404, "Employee not found")
    for p in emp.get("photos", []):
        try:
            await fs.delete(ObjectId(p["photo_id"]))
        except Exception:
            pass
    await db.employees.update_one(
        {"employee_id": employee_id},
        {"$set": {"face_encodings": [], "photos": [], "updated_at": datetime.utcnow()}},
    )
    return {"success": True, "message": "All photos cleared"}


# Soft deletes (deactivates) an employee record
@router.delete("/{employee_id}")
async def deactivate_employee(
    employee_id: str, db: AsyncIOMotorDatabase = Depends(get_database),
):
    result = await db.employees.update_one(
        {"employee_id": employee_id},
        {"$set": {"is_active": False, "updated_at": datetime.utcnow()}},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Employee not found")
    return {"success": True, "message": "Employee deactivated"}