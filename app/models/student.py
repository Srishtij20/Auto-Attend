from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

# Schema for creating a new student record
class StudentCreate(BaseModel):
    student_id: str
    full_name: str
    email: Optional[EmailStr] = None
    parent_email: Optional[EmailStr] = None
    class_name: str
    section: Optional[str] = None
    roll_no: Optional[str] = None
    phone: Optional[str] = None

# Response schema representing student data returned by the system
class StudentOut(BaseModel):
    id: str
    student_id: str
    full_name: str
    email: Optional[str]
    parent_email: Optional[str]
    class_name: str
    section: Optional[str]
    roll_no: Optional[str]
    phone: Optional[str]
    face_registered: bool
    created_at: datetime