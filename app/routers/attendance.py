from fastapi import APIRouter, HTTPException, Depends, Query, WebSocket, WebSocketDisconnect
from typing import List, Optional
from datetime import datetime
import logging
import asyncio

from motor.motor_asyncio import AsyncIOMotorDatabase

# Database
from app.database import get_database

# Schemas & Models
from app.schemas.attendance import AttendanceMarkRequest
from app.models.attendance import (
    AttendanceType,
    AttendanceMarkResponse,
    AttendanceResponse,
    AttendanceSummary,
    AttendanceListResponse,
    DashboardStats,
)

# Services
from app.services.face_service import get_face_service, FaceService
from app.services.attendance_service import AttendanceService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/attendance", tags=["Attendance"])


# -------------------------------
# 🔹 WebSocket Manager
# -------------------------------
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info("WebSocket connected")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info("WebSocket disconnected")

    async def broadcast(self, data: dict):
        dead_connections = []
        for connection in self.active_connections:
            try:
                await connection.send_json(data)
            except Exception as e:
                logger.warning(f"WebSocket error: {e}")
                dead_connections.append(connection)

        for conn in dead_connections:
            self.active_connections.remove(conn)


manager = ConnectionManager()


# -------------------------------
# 🔹 Mark Attendance API
# -------------------------------
@router.post("/mark", response_model=AttendanceMarkResponse)
async def mark_attendance(
    data: AttendanceMarkRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
    face_service: FaceService = Depends(get_face_service),
):
    try:
        # Step 1: Fetch employees with face data
        cursor = db.employees.find(
            {"is_active": True, "face_encodings": {"$not": {"$size": 0}}},
            {"employee_id": 1, "name": 1, "face_encodings": 1},
        )
        employees = await cursor.to_list(length=None)

        if not employees:
            raise HTTPException(status_code=400, detail="No employees with registered faces")

        # Step 2: Prepare known faces
        known_faces = [
            (emp["employee_id"], emp["name"], emp["face_encodings"])
            for emp in employees
        ]

        # Step 3: Face recognition
        emp_id, emp_name, confidence, message = face_service.find_matching_face(
            data.image_data, known_faces
        )

        # Step 4: If no match found
        if emp_id is None:
            await manager.broadcast({
                "event": "failed",
                "message": message,
                "confidence": confidence
            })

            return AttendanceMarkResponse(
                success=False,
                message=message,
                confidence=confidence
            )

        # Step 5: Call service layer
        service = AttendanceService(db)

        result = await service.mark_attendance(
            employee_id=emp_id,
            employee_name=emp_name,
            confidence=confidence,
            attendance_type=data.attendance_type,
            location=data.location,
            device_id=data.device_id,
        )

        # Step 6: Broadcast success
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

    except Exception as e:
        logger.exception("Error in mark_attendance API")
        raise HTTPException(status_code=500, detail="Internal server error")


# -------------------------------
# 🔹 Get Attendance Records
# -------------------------------
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
    service = AttendanceService(db)

    data = await service.get_records(
        employee_id=employee_id,
        start_date=start_date,
        end_date=end_date,
        attendance_type=attendance_type,
        limit=limit,
        skip=skip,
    )

    items = [
        AttendanceResponse(
            id=r["_id"],
            employee_id=r["employee_id"],
            employee_name=r["employee_name"],
            attendance_type=r["attendance_type"],
            confidence=r["confidence"],
            timestamp=r["timestamp"],
            location=r.get("location"),
            device_id=r.get("device_id"),
        )
        for r in data["items"]
    ]

    return AttendanceListResponse(
        items=items,
        total=data["total"],
        skip=data["skip"],
        limit=data["limit"],
    )


# -------------------------------
# 🔹 Daily Summary
# -------------------------------
@router.get("/summary", response_model=List[AttendanceSummary])
async def get_daily_summary(
    date: Optional[datetime] = None,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    return await AttendanceService(db).get_daily_summary(date)


# -------------------------------
# 🔹 Dashboard Stats
# -------------------------------
@router.get("/dashboard", response_model=DashboardStats)
async def dashboard_stats(
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    return await AttendanceService(db).get_dashboard_stats()


# -------------------------------
# 🔹 Employee Today Records
# -------------------------------
@router.get("/employee/{employee_id}/today")
async def employee_today(
    employee_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    records = await db.attendance.find(
        {"employee_id": employee_id, "timestamp": {"$gte": today}}
    ).sort("timestamp", 1).to_list(length=None)

    return {
        "employee_id": employee_id,
        "date": today.strftime("%Y-%m-%d"),
        "records": [
            {
                "type": r["attendance_type"],
                "time": r["timestamp"],
                "confidence": r["confidence"],
            }
            for r in records
        ],
    }


# -------------------------------
# 🔹 WebSocket Live Updates
# -------------------------------
@router.websocket("/ws/live")
async def websocket_live(websocket: WebSocket):
    await manager.connect(websocket)

    try:
        while True:
            await asyncio.sleep(30)
            await websocket.send_json({"event": "ping"})

    except WebSocketDisconnect:
        manager.disconnect(websocket)

    except Exception as e:
        logger.warning(f"WebSocket error: {e}")
        manager.disconnect(websocket)