from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.database import get_database
from app.models.student import StudentCreate, StudentOut
from app.services.auth_service import require_admin_or_teacher, get_current_user, TokenData
from app.services.face_service import get_face_service, FaceService
import base64, io

# Router for student management and attendance-related operations
router = APIRouter(prefix="/students", tags=["Students"])


# Converts raw database student document into API response schema
def _out(s: dict) -> StudentOut:
    return StudentOut(
        id=str(s["_id"]),
        student_id=s["student_id"],
        full_name=s["full_name"],
        email=s.get("email"),
        parent_email=s.get("parent_email"),
        class_name=s["class_name"],
        section=s.get("section"),
        roll_no=s.get("roll_no"),
        phone=s.get("phone"),
        face_registered=bool(s.get("face_encodings")),
        created_at=s["created_at"],
    )


# Creates a new student record
@router.post("", response_model=StudentOut, status_code=201)
async def create_student(
    student_id: str = Form(...),
    full_name: str = Form(...),
    class_name: str = Form(...),
    email: Optional[str] = Form(None),
    parent_email: Optional[str] = Form(None),
    section: Optional[str] = Form(None),
    roll_no: Optional[str] = Form(None),
    phone: Optional[str] = Form(None),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current: TokenData = Depends(require_admin_or_teacher),
):
    if await db.students.find_one({"student_id": student_id}):
        raise HTTPException(400, "Student ID already exists")

    doc = {
        "student_id": student_id,
        "full_name": full_name,
        "class_name": class_name,
        "email": email,
        "parent_email": parent_email,
        "section": section,
        "roll_no": roll_no,
        "phone": phone,
        "face_encodings": [],
        "photos": [],
        "created_at": datetime.utcnow(),
        "added_by": current.user_id,
    }
    result = await db.students.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _out(doc)


# Retrieves list of students (optionally filtered by class)
@router.get("", response_model=List[StudentOut])
async def list_students(
    class_name: Optional[str] = None,
    db: AsyncIOMotorDatabase = Depends(get_database),
    _: TokenData = Depends(get_current_user),
):
    query = {}
    if class_name:
        query["class_name"] = class_name
    students = await db.students.find(query).sort("full_name", 1).to_list(1000)
    return [_out(s) for s in students]


# Retrieves details of a single student
@router.get("/{student_id}", response_model=StudentOut)
async def get_student(
    student_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    _: TokenData = Depends(get_current_user),
):
    s = await db.students.find_one({"student_id": student_id})
    if not s:
        raise HTTPException(404, "Student not found")
    return _out(s)


# Adds a face photo and encoding for a student
@router.post("/{student_id}/photos", status_code=201)
async def add_photo(
    student_id: str,
    file: UploadFile = File(...),
    db: AsyncIOMotorDatabase = Depends(get_database),
    face_service: FaceService = Depends(get_face_service),
    _: TokenData = Depends(require_admin_or_teacher),
):
    student = await db.students.find_one({"student_id": student_id})
    if not student:
        raise HTTPException(404, "Student not found")

    raw = await file.read()
    b64 = base64.b64encode(raw).decode()
    encoding, message = face_service.extract_face_encoding(b64)

    if encoding is None:
        raise HTTPException(400, message)

    count = len(student.get("face_encodings", []))
    await db.students.update_one(
        {"student_id": student_id},
        {
            "$push": {"face_encodings": encoding},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )

    return {
        "success": True,
        "message": f"Photo added. Total: {count + 1}",
        "photo_count": count + 1
    }


# Deletes a student record
@router.delete("/{student_id}", status_code=204)
async def delete_student(
    student_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    _: TokenData = Depends(require_admin_or_teacher),
):
    result = await db.students.delete_one({"student_id": student_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Student not found")


# Retrieves attendance history for a specific student
@router.get("/{student_id}/attendance")
async def student_attendance_history(
    student_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    _: TokenData = Depends(get_current_user),
):
    records = await db.session_attendance.find(
        {"student_id": student_id}
    ).sort("timestamp", -1).to_list(500)

    for r in records:
        r["_id"] = str(r["_id"])
        if r.get("timestamp"):
            r["timestamp"] = r["timestamp"].isoformat()

    return records


# Computes subject-wise and overall attendance performance for a student
@router.get("/{student_id}/performance")
async def student_performance(
    student_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    _: TokenData = Depends(get_current_user),
):
    records = await db.session_attendance.find({"student_id": student_id}).to_list(1000)

    by_subject = {}
    for r in records:
        subj = r.get("subject", "Unknown")
        if subj not in by_subject:
            by_subject[subj] = {"present": 0, "total": 0}
        by_subject[subj]["total"] += 1
        if r.get("status") == "present":
            by_subject[subj]["present"] += 1

    student = await db.students.find_one({"student_id": student_id})
    class_name = student["class_name"] if student else ""

    result = []
    for subj, data in by_subject.items():
        pct = round(data["present"] / data["total"] * 100, 1) if data["total"] else 0
        result.append({
            "subject": subj,
            "present": data["present"],
            "total": data["total"],
            "percentage": pct,
            "at_risk": pct < 75,
        })

    return {
        "student_id": student_id,
        "class_name": class_name,
        "subjects": sorted(result, key=lambda x: x["percentage"]),
        "overall": round(
            sum(r["present"] for r in result) / sum(r["total"] for r in result) * 100, 1
        ) if result else 0
    }