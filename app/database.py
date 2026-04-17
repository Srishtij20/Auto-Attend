from motor.motor_asyncio import (
    AsyncIOMotorClient,
    AsyncIOMotorDatabase,
    AsyncIOMotorGridFSBucket,
)
from app.config import get_settings
import logging

logger = logging.getLogger(__name__)
settings = get_settings()


class Database:
    def __init__(self):
        self.client: AsyncIOMotorClient = None
        self.db: AsyncIOMotorDatabase = None
        self.fs: AsyncIOMotorGridFSBucket = None


db = Database()


# -------------------------------
# 🔹 Connect to MongoDB
# -------------------------------
async def connect_to_mongo():
    try:
        logger.info("Connecting to MongoDB...")

        # 🔹 Create client with connection pool
        db.client = AsyncIOMotorClient(
            settings.mongodb_url,
            maxPoolSize=50,         # max connections
            minPoolSize=5,          # keep some ready
            serverSelectionTimeoutMS=5000,  # fail fast
        )

        # 🔹 Select database
        db.db = db.client[settings.database_name]

        # 🔹 GridFS for file storage
        db.fs = AsyncIOMotorGridFSBucket(
            db.db,
            bucket_name="face_photos"
        )

        # 🔹 Test connection
        await db.client.admin.command("ping")

        # 🔹 Create indexes (only once needed, Mongo handles duplicates)
        await create_indexes()

        logger.info("MongoDB connected successfully")

    except Exception as e:
        logger.exception("MongoDB connection failed")
        raise e


# -------------------------------
# 🔹 Create Indexes
# -------------------------------
async def create_indexes():
    try:
        # Employee indexes
        await db.db.employees.create_index("employee_id", unique=True)
        await db.db.employees.create_index("email", unique=True)
        await db.db.employees.create_index("department")
        await db.db.employees.create_index("is_active")

        # Attendance indexes
        await db.db.attendance.create_index(
            [("employee_id", 1), ("timestamp", -1)]
        )
        await db.db.attendance.create_index("timestamp")
        await db.db.attendance.create_index("attendance_type")

        logger.info("Indexes created successfully")

    except Exception as e:
        logger.warning(f"Index creation issue: {e}")


# -------------------------------
# 🔹 Close Connection
# -------------------------------
async def close_mongo_connection():
    try:
        if db.client:
            db.client.close()
            logger.info("MongoDB connection closed")
    except Exception as e:
        logger.warning(f"Error closing MongoDB: {e}")


# -------------------------------
# 🔹 Dependency (FastAPI)
# -------------------------------
def get_database() -> AsyncIOMotorDatabase:
    if db.db is None:
        raise Exception("Database not initialized")
    return db.db

def get_fs() -> AsyncIOMotorGridFSBucket:
    if db.fs is None:
        raise Exception("GridFS not initialized")
    return db.fs