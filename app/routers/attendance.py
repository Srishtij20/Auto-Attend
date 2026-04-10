from fastapi import APIRouter, HTTPException, Depends, Form, Query, WebSocket, WebSocketDisconnect
from typing import List, Optional
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorDatabase, AsyncIOMotorGridFSBucket
import logging
import asyncio

from app.database import get_database, get_fs
from app.models.attendance import (
    AttendanceType, AttendanceMarkResponse, AttendanceResponse,
    AttendanceSummary, AttendanceListResponse, DashboardStats,
)
from app.services.face_service import get_face_service, FaceService
from app.services.attendance_service import AttendanceService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/attendance", tags=["attendance"])


class ConnectionManager:
    def __init__(self):
        self.active: List[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, data: dict):
        dead = []
        for ws in self.active:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.active.remove(ws)


manager = ConnectionManager()


@router.post("/mark", response_model=AttendanceMarkResponse)
async def mark_attendance(
    image_data: str = Form(...),
    attendance_type: Optional[AttendanceType] = Form(None),
    location: Optional[str] = Form(None),
    device_id: Optional[str] = Form(None),
    db: AsyncIOMotorDatabase = Depends(get_database),
    fs: AsyncIOMotorGridFSBucket = Depends(get_fs),
    face_service: FaceService = Depends(get_face_service),
):
    cursor = db.employees.find(
        {"is_active": True, "face_encodings": {"$not": {"$size": 0}}},
        {"employee_id": 1, "name": 1, "face_encodings": 1},
    )
    employees = await cursor.to_list(length=None)

    if not employees:
        raise HTTPException(400, "No employees with registered faces found")

    known = [(e["employee_id"], e["name"], e["face_encodings"]) for e in employees]
    emp_id, emp_name, confidence, message = face_service.find_matching_face(image_data, known)

    if emp_id is None:
        await manager.broadcast({"event": "failed", "message": message, "confidence": confidence})
        return AttendanceMarkResponse(success=False, message=message, confidence=confidence or None)

    svc = AttendanceService(db)
    result = await svc.mark_attendance(
        employee_id=emp_id, employee_name=emp_name, confidence=confidence,
        attendance_type=attendance_type, location=location, device_id=device_id,
    )

    if result.success:
        await manager.broadcast({
            "event": "attendance",
            "employee_id": emp_id,
            "employee_name": emp_name,
            "attendance_type": result.attendance_type,
            "confidence": confidence,
            "timestamp": result.timestamp.isoformat() if result.timestamp else None,
        })
    return result


@router.get("/records", response_model=AttendanceListResponse)
async def get_records(
    employee_id: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    attendance_type: Optional[AttendanceType] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    svc = AttendanceService(db)
    data = await svc.get_records(
        employee_id=employee_id, start_date=start_date, end_date=end_date,
        attendance_type=attendance_type, limit=limit, skip=skip,
    )
    items = [
        AttendanceResponse(
            id=r["_id"], employee_id=r["employee_id"], employee_name=r["employee_name"],
            attendance_type=r["attendance_type"], confidence=r["confidence"],
            timestamp=r["timestamp"], location=r.get("location"), device_id=r.get("device_id"),
        )
        for r in data["items"]
    ]
    return AttendanceListResponse(items=items, total=data["total"], skip=data["skip"], limit=data["limit"])


@router.get("/summary", response_model=List[AttendanceSummary])
async def get_daily_summary(
    date: Optional[datetime] = None,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    return await AttendanceService(db).get_daily_summary(date)


@router.get("/dashboard", response_model=DashboardStats)
async def dashboard_stats(db: AsyncIOMotorDatabase = Depends(get_database)):
    return await AttendanceService(db).get_dashboard_stats()


@router.get("/employee/{employee_id}/today")
async def employee_today(
    employee_id: str, db: AsyncIOMotorDatabase = Depends(get_database),
):
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    records = await db.attendance.find(
        {"employee_id": employee_id, "timestamp": {"$gte": today}}
    ).sort("timestamp", 1).to_list(length=None)
    return {
        "employee_id": employee_id,
        "date": today.strftime("%Y-%m-%d"),
        "records": [{"type": r["attendance_type"], "time": r["timestamp"], "confidence": r["confidence"]} for r in records],
    }


@router.websocket("/ws/live")
async def ws_live(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await asyncio.sleep(30)
            await websocket.send_json({"event": "ping"})
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)