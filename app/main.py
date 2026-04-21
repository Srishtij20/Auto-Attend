from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from contextlib import asynccontextmanager
from app.routers import auth, reports
from fastapi.staticfiles import StaticFiles
from app.routers import students, sessions, classes
import logging
import os

from app.config import get_settings
from app.database import connect_to_mongo, close_mongo_connection
from app.routers import employees, attendance

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)
settings = get_settings()

frontend_index = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist", "index.html")

def read_index():
    with open(frontend_index, "r") as f:
        return f.read()

@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_mongo()
    logger.info("Application started")
    yield
    await close_mongo_connection()
    logger.info("Application shutdown")

app = FastAPI(
    title=settings.app_name,
    description="Face Recognition Attendance System API v2",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(employees.router, prefix="/api/v1")
app.include_router(attendance.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")
app.include_router(students.router, prefix="/api/v1")
app.include_router(sessions.router, prefix="/api/v1")
app.include_router(classes.router, prefix="/api/v1")

assets_dir = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist", "assets")
if os.path.isdir(assets_dir):
    app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

@app.get("/api/health")
async def health():
    return {"status": "healthy", "version": "2.0.0"}

@app.get("/",          response_class=HTMLResponse)
async def page_root():       return HTMLResponse(content=read_index())

@app.get("/dashboard", response_class=HTMLResponse)
async def page_dashboard():  return HTMLResponse(content=read_index())

@app.get("/mark",      response_class=HTMLResponse)
async def page_mark():       return HTMLResponse(content=read_index())

@app.get("/employees", response_class=HTMLResponse)
async def page_employees():  return HTMLResponse(content=read_index())

@app.get("/records",   response_class=HTMLResponse)
async def page_records():    return HTMLResponse(content=read_index())

@app.get("/summary",   response_class=HTMLResponse)
async def page_summary():    return HTMLResponse(content=read_index())

@app.get("/enroll",    response_class=HTMLResponse)
async def page_enroll():     return HTMLResponse(content=read_index())

@app.get("/users",     response_class=HTMLResponse)
async def page_users():      return HTMLResponse(content=read_index())

@app.get("/attendance", response_class=HTMLResponse)
async def page_attendance(): return HTMLResponse(content=read_index())

@app.get("/student-portal", response_class=HTMLResponse)
async def page_student_portal(): return HTMLResponse(content=read_index())

@app.get("/classes", response_class=HTMLResponse)
async def page_classes(): return HTMLResponse(content=read_index())

@app.get("/students",       response_class=HTMLResponse)
async def page_students():      return HTMLResponse(content=read_index())

@app.get("/student-portal", response_class=HTMLResponse)
async def page_sp():            return HTMLResponse(content=read_index())