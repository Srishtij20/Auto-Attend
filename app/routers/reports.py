from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import Response
from typing import Optional
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.database import get_database
from app.services.auth_service import get_current_user, TokenData
from app.services.report_service import generate_pdf, generate_excel
from app.services.attendance_service import AttendanceService

# Router for generating attendance reports (PDF and Excel)
router = APIRouter(prefix="/reports", tags=["Reports"])


# Generates and downloads daily attendance report as PDF
@router.get("/daily/pdf")
async def daily_pdf(
    date: Optional[str] = Query(None, description="YYYY-MM-DD, defaults to today"),
    db: AsyncIOMotorDatabase = Depends(get_database),
    _: TokenData = Depends(get_current_user),
):
    date_str = date or datetime.utcnow().strftime("%Y-%m-%d")
    dt = datetime.fromisoformat(date_str + "T00:00:00") if date else None
    summary = await AttendanceService(db).get_daily_summary(dt)
    pdf = generate_pdf(
        [s.model_dump() if hasattr(s, 'model_dump') else dict(s) for s in summary],
        date_str
    )
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="attendance_{date_str}.pdf"'}
    )


# Generates and downloads daily attendance report as Excel file
@router.get("/daily/excel")
async def daily_excel(
    date: Optional[str] = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_database),
    _: TokenData = Depends(get_current_user),
):
    date_str = date or datetime.utcnow().strftime("%Y-%m-%d")
    dt = datetime.fromisoformat(date_str + "T00:00:00") if date else None
    summary = await AttendanceService(db).get_daily_summary(dt)
    xlsx = generate_excel(
        [s.model_dump() if hasattr(s, 'model_dump') else dict(s) for s in summary],
        date_str
    )
    return Response(
        content=xlsx,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="attendance_{date_str}.xlsx"'}
    )