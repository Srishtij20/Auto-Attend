from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase, AsyncIOMotorGridFSBucket
from app.config import get_settings
import logging

logger = logging.getLogger(__name__)
settings = get_settings()


class Database:
    client: AsyncIOMotorClient = None
    db: AsyncIOMotorDatabase = None
    fs: AsyncIOMotorGridFSBucket = None


db = Database()


async def connect_to_mongo():
    logger.info("Connecting to MongoDB...")
    db.client = AsyncIOMotorClient(settings.mongodb_url)
    db.db = db.client[settings.database_name]
    db.fs = AsyncIOMotorGridFSBucket(db.db, bucket_name="face_photos")

    await db.db.employees.create_index("employee_id", unique=True)
    await db.db.employees.create_index("email", unique=True)
    await db.db.employees.create_index("department")
    await db.db.employees.create_index("is_active")
    await db.db.attendance.create_index([("employee_id", 1), ("timestamp", -1)])
    await db.db.attendance.create_index("timestamp")
    await db.db.attendance.create_index("attendance_type")
    logger.info("Connected to MongoDB successfully")


async def close_mongo_connection():
    if db.client:
        db.client.close()
    logger.info("MongoDB connection closed")


def get_database() -> AsyncIOMotorDatabase:
    return db.db


def get_fs() -> AsyncIOMotorGridFSBucket:
    return db.fs