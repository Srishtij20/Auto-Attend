from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import logging
import os

from app.config import get_settings
from app.database import connect_to_mongo, close_mongo_connection
from app.routers import employees, attendance

# 🔹 Logging Setup
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)

settings = get_settings()

# 🔹 Lifespan (Startup + Shutdown)
@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_mongo()
    logger.info("Application started")

    yield

    await close_mongo_connection()
    logger.info("Application shutdown")

# 🔹 FastAPI App
app = FastAPI(
    title=settings.app_name,
    description="Face Recognition Attendance System API v2",
    version="2.0.0",
    lifespan=lifespan,
)

# 🔹 CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # ⚠️ restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 🔹 Routers
app.include_router(employees.router, prefix="/api/v1")
app.include_router(attendance.router, prefix="/api/v1")

# 🔹 Static Frontend (Optional)
static_dir = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")

if os.path.isdir(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

# 🔹 Health Check API
@app.get("/api/health")
async def health():
    return {
        "status": "healthy",
        "version": "2.0.0"
    }