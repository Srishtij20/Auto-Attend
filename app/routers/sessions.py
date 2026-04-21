from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from typing import Optional, List
from datetime import datetime
import uuid
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.database import get_database
from app.services.auth_service import require_admin_or_teacher, get_current_user, TokenData
from app.services.face_service import get_face_service, FaceService
from app.services.email_service import send_absence_alerts
from pydantic import BaseModel

router = APIRouter(prefix="/sessions", tags=["Sessions"])


# Starts a new attendance session for a class and subject
@router.post("/start")
async def start_session(
    class_name: str = Form(...),
    subject: str = Form(...),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current: TokenData = Depends(require_admin_or_teacher),
):
    teacher = await db.users.find_one({"_id": ObjectId(current.user_id)})
    teacher_name = teacher["full_name"] if teacher else "Unknown"
    total = await db.students.count_documents({"class_name": class_name})
    session_id = str(uuid.uuid4())
    doc = {
        "session_id": session_id,
        "class_name": class_name,
        "subject": subject,
        "date": datetime.utcnow().strftime("%Y-%m-%d"),
        "started_at": datetime.utcnow(),
        "ended_at": None,
        "teacher_id": current.user_id,
        "teacher_name": teacher_name,
        "total_students": total,
        "present_count": 0,
        "status": "active",
    }
    await db.sessions.insert_one(doc)
    return {
        "session_id": session_id,
        "class_name": class_name,
        "subject": subject,
        "total_students": total,
        "teacher_name": teacher_name
    }


# Marks attendance using face recognition for a given session
@router.post("/{session_id}/mark")
async def mark_attendance(
    session_id: str,
    image: UploadFile = File(...),
    db: AsyncIOMotorDatabase = Depends(get_database),
    face_service: FaceService = Depends(get_face_service),
    _: TokenData = Depends(require_admin_or_teacher),
):
    session = await db.sessions.find_one({"session_id": session_id})
    if not session:
        raise HTTPException(404, "Session not found")
    if session.get("status") == "completed":
        raise HTTPException(400, "Session already ended")

    raw = await image.read()
    b64 = base64.b64encode(raw).decode()

    students = await db.students.find(
        {"class_name": session["class_name"],
         "face_encodings": {"$not": {"$size": 0}}}
    ).to_list(1000)

    if not students:
        return {"matched": False, "message": "No students with face data in this class"}

    known_faces = [(s["student_id"], s["full_name"], s["face_encodings"]) for s in students]
    student_id, student_name, confidence, message = face_service.find_matching_face(b64, known_faces)

    if student_id is None:
        return {"matched": False, "message": message, "confidence": confidence}

    existing = await db.session_attendance.find_one(
        {"session_id": session_id, "student_id": student_id}
    )
    if existing:
        return {
            "matched": True,
            "already_marked": True,
            "student_id": student_id,
            "full_name": student_name,
            "message": f"{student_name} already marked present"
        }

    record = {
        "session_id": session_id,
        "student_id": student_id,
        "full_name": student_name,
        "class_name": session["class_name"],
        "subject": session["subject"],
        "date": session["date"],
        "timestamp": datetime.utcnow(),
        "status": "present",
        "confidence": confidence,
    }
    await db.session_attendance.insert_one(record)
    await db.sessions.update_one(
        {"session_id": session_id}, {"$inc": {"present_count": 1}}
    )
    return {
        "matched": True,
        "already_marked": False,
        "student_id": student_id,
        "full_name": student_name,
        "confidence": round(confidence * 100, 1),
        "message": f"✅ {student_name} marked present",
    }


# Ends a session, calculates absent students, and triggers absence alerts
@router.post("/{session_id}/end")
async def end_session(
    session_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current: TokenData = Depends(require_admin_or_teacher),
):
    session = await db.sessions.find_one({"session_id": session_id})
    if not session:
        raise HTTPException(404, "Session not found")

    present_ids = set()
    records = await db.session_attendance.find({"session_id": session_id}).to_list(1000)
    for r in records:
        present_ids.add(r["student_id"])

    all_students = await db.students.find({"class_name": session["class_name"]}).to_list(1000)
    absent = [s for s in all_students if s["student_id"] not in present_ids]

    await db.sessions.update_one(
        {"session_id": session_id},
        {"$set": {
            "ended_at": datetime.utcnow(),
            "status": "completed",
            "present_count": len(present_ids)
        }}
    )

    try:
        await send_absence_alerts(absent, session)
    except Exception:
        pass

    return {
        "message": "Session ended",
        "present": len(present_ids),
        "absent": len(absent),
        "total": len(all_students),
    }


# Lists all sessions (optionally filtered by class)
@router.get("")
async def list_sessions(
    class_name: Optional[str] = None,
    db: AsyncIOMotorDatabase = Depends(get_database),
    _: TokenData = Depends(get_current_user),
):
    query = {}
    if class_name:
        query["class_name"] = class_name
    sessions = await db.sessions.find(query).sort("started_at", -1).to_list(100)
    for s in sessions:
        s["_id"] = str(s["_id"])
    return sessions


# Retrieves detailed session data including attendance and absent students
@router.get("/{session_id}")
async def get_session(
    session_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    _: TokenData = Depends(get_current_user),
):
    session = await db.sessions.find_one({"session_id": session_id})
    if not session:
        raise HTTPException(404, "Session not found")

    session["_id"] = str(session["_id"])
    records = await db.session_attendance.find({"session_id": session_id}).to_list(1000)
    all_students = await db.students.find({"class_name": session["class_name"]}).to_list(1000)

    present_ids = {r["student_id"] for r in records}
    for r in records:
        r["_id"] = str(r["_id"])
        r["timestamp"] = r["timestamp"].isoformat()

    absent = [
        {"student_id": s["student_id"], "full_name": s["full_name"]}
        for s in all_students if s["student_id"] not in present_ids
    ]

    session["records"] = records
    session["absent"] = absent
    return session


# Retrieves attendance history for a specific student
@router.get("/student/{student_id}/attendance")
async def student_attendance(
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


# Schema for manual attendance correction requests
class CorrectionRequest(BaseModel):
    student_id: str
    status: str  # "present" | "absent"
    reason: str = ""


# Allows teachers/admins to manually correct attendance records
@router.post("/{session_id}/correct")
async def correct_attendance(
    session_id: str,
    data: CorrectionRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current: TokenData = Depends(require_admin_or_teacher),
):
    teacher = await db.users.find_one({"_id": ObjectId(current.user_id)})
    teacher_name = teacher["full_name"] if teacher else "Unknown"

    if data.status == "present":
        existing = await db.session_attendance.find_one(
            {"session_id": session_id, "student_id": data.student_id}
        )
        if existing:
            await db.session_attendance.update_one(
                {"session_id": session_id, "student_id": data.student_id},
                {"$set": {
                    "status": "present",
                    "corrected": True,
                    "corrected_by": teacher_name,
                    "reason": data.reason
                }}
            )
        else:
            student = await db.students.find_one({"student_id": data.student_id})
            session = await db.sessions.find_one({"session_id": session_id})
            await db.session_attendance.insert_one({
                "session_id": session_id,
                "student_id": data.student_id,
                "full_name": student["full_name"] if student else data.student_id,
                "class_name": session["class_name"] if session else "",
                "subject": session["subject"] if session else "",
                "date": session["date"] if session else "",
                "timestamp": datetime.utcnow(),
                "status": "present",
                "confidence": 1.0,
                "corrected": True,
                "corrected_by": teacher_name,
                "reason": data.reason,
            })
            await db.sessions.update_one(
                {"session_id": session_id}, {"$inc": {"present_count": 1}}
            )
    else:
        await db.session_attendance.delete_one(
            {"session_id": session_id, "student_id": data.student_id}
        )
        await db.sessions.update_one(
            {"session_id": session_id}, {"$inc": {"present_count": -1}}
        )

    return {"message": f"Attendance corrected to {data.status} for {data.student_id}"}


import base64