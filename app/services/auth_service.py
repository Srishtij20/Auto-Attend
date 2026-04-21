from datetime import datetime, timedelta
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from app.config import get_settings
import bcrypt as _bcrypt

settings = get_settings()

# OAuth2 scheme for extracting JWT token from requests
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

# JWT configuration
SECRET_KEY = getattr(settings, "secret_key", "change-me-in-production")
ALGORITHM = "HS256"
EXPIRE_MINUTES = 480


# Schema representing decoded token data
class TokenData(BaseModel):
    user_id: str
    role: str  # "admin" | "teacher" | "viewer"


# Hashes plain password using bcrypt
def hash_password(password: str) -> str:
    return _bcrypt.hashpw(password.encode(), _bcrypt.gensalt()).decode()


# Verifies plain password against stored hash
def verify_password(plain: str, hashed: str) -> bool:
    return _bcrypt.checkpw(plain.encode(), hashed.encode())


# Generates JWT access token with user identity and role
def create_token(user_id: str, role: str) -> str:
    exp = datetime.utcnow() + timedelta(minutes=EXPIRE_MINUTES)
    return jwt.encode(
        {"sub": user_id, "role": role, "exp": exp},
        SECRET_KEY,
        algorithm=ALGORITHM
    )


# Extracts and validates current user from JWT token
async def get_current_user(token: str = Depends(oauth2_scheme)) -> TokenData:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return TokenData(user_id=payload["sub"], role=payload["role"])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )


# Ensures user has either admin or teacher role
async def require_admin_or_teacher(current: TokenData = Depends(get_current_user)) -> TokenData:
    if current.role not in ("admin", "teacher"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers and admins can perform this action"
        )
    return current


# Ensures user has admin privileges only
async def require_admin(current: TokenData = Depends(get_current_user)) -> TokenData:
    if current.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current