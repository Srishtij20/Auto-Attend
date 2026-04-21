from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.database import get_database
from app.services.auth_service import require_admin_or_teacher, get_current_user, TokenData

# Router for class management endpoints
router = APIRouter(prefix="/classes", tags=["Classes"])


# Schema for creating a new class
class ClassCreate(BaseModel):
    name: str
    section: Optional[str] = None
    subjects: List[str] = []
    teacher_id: Optional[str] = None


# Creates a new class (accessible to admin or teacher roles)
@router.post("", status_code=201)
async def create_class(
    data: ClassCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    _: TokenData = Depends(require_admin_or_teacher),
):
    if await db.classes.find_one({"name": data.name}):
        raise HTTPException(400, "Class already exists")
    doc = {**data.model_dump(), "created_at": datetime.utcnow()}
    await db.classes.insert_one(doc)
    doc["_id"] = str(doc["_id"])
    return doc


# Retrieves a list of all classes (accessible to authenticated users)
@router.get("")
async def list_classes(
    db: AsyncIOMotorDatabase = Depends(get_database),
    _: TokenData = Depends(get_current_user),
):
    classes = await db.classes.find().sort("name", 1).to_list(200)
    for c in classes:
        c["_id"] = str(c["_id"])
    return classes


# Updates the subjects assigned to a specific class
@router.patch("/{class_name}/subjects")
async def update_subjects(
    class_name: str,
    subjects: List[str],
    db: AsyncIOMotorDatabase = Depends(get_database),
    _: TokenData = Depends(require_admin_or_teacher),
):
    await db.classes.update_one({"name": class_name}, {"$set": {"subjects": subjects}})
    return {"message": "Subjects updated"}


# Deletes a class by name (accessible to admin or teacher roles)
@router.delete("/{class_name}", status_code=204)
async def delete_class(
    class_name: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    _: TokenData = Depends(require_admin_or_teacher),
):
    await db.classes.delete_one({"name": class_name})