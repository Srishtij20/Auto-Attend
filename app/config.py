from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    mongodb_url: str = "mongodb://localhost:27017"
    database_name: str = "face_attendance"
    app_name: str = "Face Attendance System"
    debug: bool = False
    secret_key: str = "change-this-in-production"
    face_recognition_tolerance: float = 0.55
    min_face_confidence: float = 0.80
    face_voting_top_n: int = 0
    max_photos_per_employee: int = 120
    duplicate_attendance_window_minutes: int = 480

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()