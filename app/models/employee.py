from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import datetime

# Base schema containing common employee fields
class EmployeeBase(BaseModel):
    employee_id: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    department: Optional[str] = None
    position: Optional[str] = None

# Schema used when creating a new employee (inherits all base fields)
class EmployeeCreate(EmployeeBase):
    pass

# Schema for updating employee details (all fields optional for partial updates)
class EmployeeUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    department: Optional[str] = None
    position: Optional[str] = None
    is_active: Optional[bool] = None

# Stores metadata related to an employee's photo/face encoding
class PhotoMeta(BaseModel):
    photo_id: str
    uploaded_at: datetime
    encoding_index: int

# Response schema representing complete employee data returned by API
class EmployeeResponse(EmployeeBase):
    id: str
    photo_count: int = 0
    created_at: datetime
    updated_at: datetime
    is_active: bool

    class Config:
        populate_by_name = True

# Wrapper for paginated employee list responses
class EmployeeListResponse(BaseModel):
    items: List[EmployeeResponse]
    total: int
    skip: int
    limit: int