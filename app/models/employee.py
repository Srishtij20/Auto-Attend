from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import datetime


class EmployeeBase(BaseModel):
    employee_id: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    department: Optional[str] = None
    position: Optional[str] = None


class EmployeeCreate(EmployeeBase):
    pass


class EmployeeUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    department: Optional[str] = None
    position: Optional[str] = None
    is_active: Optional[bool] = None


class PhotoMeta(BaseModel):
    photo_id: str
    uploaded_at: datetime
    encoding_index: int


class EmployeeResponse(EmployeeBase):
    id: str
    photo_count: int = 0
    created_at: datetime
    updated_at: datetime
    is_active: bool

    class Config:
        populate_by_name = True


class EmployeeListResponse(BaseModel):
    items: List[EmployeeResponse]
    total: int
    skip: int
    limit: int