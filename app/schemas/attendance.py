from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.models.attendance import AttendanceType


# Request schema for marking attendance via image input
class AttendanceMarkRequest(BaseModel):
    image_data: str
    attendance_type: Optional[AttendanceType] = None
    location: Optional[str] = None
    device_id: Optional[str] = None


# Base schema containing common attendance fields
class AttendanceBase(BaseModel):
    employee_id: str              # employee unique ID
    employee_name: str            # employee name
    confidence: float             # AI confidence (0–1)

    attendance_type: Optional[AttendanceType] = None
    location: Optional[str] = None
    device_id: Optional[str] = None


# Schema used when creating a new attendance record
class AttendanceCreate(AttendanceBase):
    pass


# Response schema returned after processing attendance
class AttendanceResponse(AttendanceBase):
    timestamp: datetime
    success: bool
    message: str

    class Config:
        from_attributes = True