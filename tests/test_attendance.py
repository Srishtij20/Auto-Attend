import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock
from app.services.attendance_service import AttendanceService
from app.models.attendance import AttendanceType


@pytest.fixture
def mock_db():
    db = MagicMock()
    db.attendance = MagicMock()
    db.employees = MagicMock()
    return db


@pytest.mark.asyncio
async def test_determine_attendance_type_first_of_day(mock_db):
    mock_db.attendance.find_one = AsyncMock(return_value=None)
    
    service = AttendanceService(mock_db)
    result = await service.determine_attendance_type("EMP001")
    
    assert result == AttendanceType.CHECK_IN


@pytest.mark.asyncio
async def test_determine_attendance_type_after_checkin(mock_db):
    mock_db.attendance.find_one = AsyncMock(return_value={
        "attendance_type": AttendanceType.CHECK_IN,
        "timestamp": datetime.utcnow()
    })
    
    service = AttendanceService(mock_db)
    result = await service.determine_attendance_type("EMP001")
    
    assert result == AttendanceType.CHECK_OUT
