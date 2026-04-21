from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.database import get_database
from app.services.auth_service import (
    hash_password, verify_password, create_token,
    get_current_user, require_admin, TokenData
)

# Router for authentication-related endpoints
router = APIRouter(prefix="/auth", tags=["Auth"])


# Schema for creating a new user
class UserCreate(BaseModel):
    username: str
    full_name: str
    email: EmailStr
    password: str
    role: str = "teacher"  # "admin" | "teacher" | "viewer"


# Response schema for user data
class UserOut(BaseModel):
    id: str
    username: str
    full_name: str
    email: str
    role: str


# Authenticates user credentials and returns an access token
@router.post("/login")
async def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    user = await db.users.find_one({"username": form.username})
    if not user or not verify_password(form.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = create_token(str(user["_id"]), user["role"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": str(user["_id"]),
            "username": user["username"],
            "full_name": user["full_name"],
            "email": user["email"],
            "role": user["role"],
        }
    }


# Registers a new user (restricted to admin users)
@router.post("/register", status_code=201)
async def register(
    data: UserCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    _: TokenData = Depends(require_admin),   # ensures only admins can create users
):
    if await db.users.find_one({"username": data.username}):
        raise HTTPException(400, "Username already taken")
    doc = {
        "username": data.username,
        "full_name": data.full_name,
        "email": data.email,
        "role": data.role,
        "password_hash": hash_password(data.password),
        "created_at": datetime.utcnow(),
    }
    result = await db.users.insert_one(doc)
    return {"id": str(result.inserted_id), "username": data.username, "role": data.role}


# Returns details of the currently authenticated user
@router.get("/me")
async def me(
    current: TokenData = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    from bson import ObjectId
    user = await db.users.find_one({"_id": ObjectId(current.user_id)})
    if not user:
        raise HTTPException(404, "User not found")
    return {
        "id": str(user["_id"]),
        "username": user["username"],
        "full_name": user["full_name"],
        "email": user["email"],
        "role": user["role"]
    }


# Retrieves a list of all users (admin-only access)
@router.get("/users")
async def list_users(
    db: AsyncIOMotorDatabase = Depends(get_database),
    _: TokenData = Depends(require_admin),
):
    users = await db.users.find().to_list(200)
    return [
        {
            "id": str(u["_id"]),
            "username": u["username"],
            "full_name": u["full_name"],
            "email": u["email"],
            "role": u["role"]
        }
        for u in users
    ]