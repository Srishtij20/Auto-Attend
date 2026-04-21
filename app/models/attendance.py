from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum

# Defines possible attendance actions (check-in and check-out)
class AttendanceType(str, Enum):
    CHECK_IN = "check_in"
    CHECK_OUT = "check_out"

# Represents a single attendance record returned by the system
class AttendanceResponse(BaseModel):
    id: str
    employee_id: str
    employee_name: str
    attendance_type: AttendanceType
    confidence: float
    timestamp: datetime
    location: Optional[str] = None
    device_id: Optional[str] = None

    class Config:
        populate_by_name = True

# Represents the response after attempting to mark attendance
class AttendanceMarkResponse(BaseModel):
    success: bool
    message: str
    employee_id: Optional[str] = None
    employee_name: Optional[str] = None
    attendance_type: Optional[AttendanceType] = None
    confidence: Optional[float] = None
    timestamp: Optional[datetime] = None

# Provides a daily summary of attendance for an employee
class AttendanceSummary(BaseModel):
    employee_id: str
    employee_name: str
    department: Optional[str] = None
    date: str
    check_in: Optional[datetime] = None
    check_out: Optional[datetime] = None
    total_hours: Optional[float] = None
    status: str = "absent"

# Wraps a paginated list of attendance records
class AttendanceListResponse(BaseModel):
    items: List[AttendanceResponse]
    total: int
    skip: int
    limit: int

# Represents aggregated statistics for dashboard display
class DashboardStats(BaseModel):
    total_employees: int
    active_today: int
    checked_in_now: int
    avg_hours_today: float