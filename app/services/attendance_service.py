from datetime import datetime, timedelta
from typing import List, Optional, Dict
from motor.motor_asyncio import AsyncIOMotorDatabase
import logging
from app.models.attendance import (
    AttendanceType, AttendanceMarkResponse, AttendanceSummary, DashboardStats
)
from app.config import get_settings
 
logger = logging.getLogger(__name__)
settings = get_settings()
 
 
# Service layer handling attendance logic and analytics
class AttendanceService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.col = db.attendance
        self.emp = db.employees
        self.dup_window = timedelta(minutes=settings.duplicate_attendance_window_minutes)
 
    # Checks if a similar attendance entry exists within a defined time window
    async def check_duplicate(self, employee_id: str, attendance_type: AttendanceType) -> bool:
        cutoff = datetime.utcnow() - self.dup_window
        rec = await self.col.find_one({
            "employee_id": employee_id,
            "attendance_type": attendance_type,
            "timestamp": {"$gte": cutoff},
        })
        return rec is not None
 
    # Determines whether the next attendance should be check-in or check-out
    async def determine_type(self, employee_id: str) -> AttendanceType:
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        last = await self.col.find_one(
            {"employee_id": employee_id, "timestamp": {"$gte": today}},
            sort=[("timestamp", -1)],
        )
        if not last:
            return AttendanceType.CHECK_IN
        return (
            AttendanceType.CHECK_OUT
            if last["attendance_type"] == AttendanceType.CHECK_IN
            else AttendanceType.CHECK_IN
        )
 
    # Records attendance entry with validation and duplicate prevention
    async def mark_attendance(
        self,
        employee_id: str,
        employee_name: str,
        confidence: float,
        attendance_type: Optional[AttendanceType] = None,
        location: Optional[str] = None,
        device_id: Optional[str] = None,
        snapshot_id: Optional[str] = None,
    ) -> AttendanceMarkResponse:
        try:
            if attendance_type is None:
                attendance_type = await self.determine_type(employee_id)
 
            if await self.check_duplicate(employee_id, attendance_type):
                return AttendanceMarkResponse(
                    success=False,
                    message=f"{attendance_type.value} already recorded within "
                            f"the last {settings.duplicate_attendance_window_minutes} minutes",
                    employee_id=employee_id,
                    employee_name=employee_name,
                )
 
            ts = datetime.utcnow()
            await self.col.insert_one({
                "employee_id": employee_id,
                "employee_name": employee_name,
                "attendance_type": attendance_type,
                "confidence": confidence,
                "timestamp": ts,
                "location": location,
                "device_id": device_id,
                "snapshot_id": snapshot_id,
            })
 
            return AttendanceMarkResponse(
                success=True,
                message=f"{attendance_type.value.replace('_', ' ').title()} recorded successfully",
                employee_id=employee_id,
                employee_name=employee_name,
                attendance_type=attendance_type,
                confidence=confidence,
                timestamp=ts,
            )
        except Exception as e:
            logger.error(f"mark_attendance error: {e}")
            return AttendanceMarkResponse(success=False, message=str(e))
 
    # Retrieves filtered and paginated attendance records
    async def get_records(
        self,
        employee_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        attendance_type: Optional[AttendanceType] = None,
        limit: int = 100,
        skip: int = 0,
    ) -> Dict:
        query: Dict = {}
        if employee_id:
            query["employee_id"] = employee_id
        if attendance_type:
            query["attendance_type"] = attendance_type
 
        ts_filter: Dict = {}
        if start_date:
            ts_filter["$gte"] = start_date
        if end_date:
            ts_filter["$lte"] = end_date
        if ts_filter:
            query["timestamp"] = ts_filter
 
        total = await self.col.count_documents(query)
        cursor = self.col.find(query).sort("timestamp", -1).skip(skip).limit(limit)
        records = await cursor.to_list(length=limit)
 
        for r in records:
            r["_id"] = str(r["_id"])
 
        return {"items": records, "total": total, "skip": skip, "limit": limit}
 
    # Generates per-employee and per-student daily attendance summary
    async def get_daily_summary(self, date: Optional[datetime] = None) -> List[AttendanceSummary]:
        if date is None:
            date = datetime.utcnow()
 
        day_start = date.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
 
        # ── Employee attendance ───────────────────────────────
        pipeline = [
            {"$match": {"timestamp": {"$gte": day_start, "$lt": day_end}}},
            {"$sort": {"timestamp": 1}},
            {"$group": {
                "_id": "$employee_id",
                "employee_name": {"$first": "$employee_name"},
                "records": {"$push": {"type": "$attendance_type", "time": "$timestamp"}},
            }},
        ]
        results = await self.col.aggregate(pipeline).to_list(length=None)
 
        emp_ids = [r["_id"] for r in results]
        emp_docs = await self.emp.find(
            {"employee_id": {"$in": emp_ids}}, {"employee_id": 1, "department": 1}
        ).to_list(length=None)
        dept_map = {e["employee_id"]: e.get("department") for e in emp_docs}
 
        summaries = []
        for result in results:
            check_in = check_out = None
            for rec in result["records"]:
                if rec["type"] == AttendanceType.CHECK_IN and check_in is None:
                    check_in = rec["time"]
                elif rec["type"] == AttendanceType.CHECK_OUT:
                    check_out = rec["time"]
 
            total_hours = None
            if check_in and check_out:
                total_hours = round((check_out - check_in).total_seconds() / 3600, 2)
 
            status = "present" if (check_in and check_out) else "half_day" if check_in else "absent"
 
            summaries.append(AttendanceSummary(
                employee_id=result["_id"],
                employee_name=result["employee_name"],
                department=dept_map.get(result["_id"]),
                date=day_start.strftime("%Y-%m-%d"),
                check_in=check_in,
                check_out=check_out,
                total_hours=total_hours,
                status=status,
            ))
 
        # ── Student attendance from session_attendance ────────
        student_pipeline = [
            {"$match": {"date": day_start.strftime("%Y-%m-%d")}},
            {"$group": {
                "_id": "$student_id",
                "full_name": {"$first": "$full_name"},
                "class_name": {"$first": "$class_name"},
                "timestamp": {"$first": "$timestamp"},
                "count": {"$sum": 1},
            }},
        ]
        student_results = await self.db.session_attendance.aggregate(student_pipeline).to_list(length=None)
 
        for r in student_results:
            summaries.append(AttendanceSummary(
                employee_id=r["_id"],
                employee_name=r["full_name"],
                department=r.get("class_name"),
                date=day_start.strftime("%Y-%m-%d"),
                check_in=r.get("timestamp"),
                check_out=None,
                total_hours=None,
                status="present",
            ))
 
        return summaries
 
    # Computes aggregated statistics for dashboard display
    async def get_dashboard_stats(self) -> DashboardStats:
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
 
        total_emp = await self.emp.count_documents({"is_active": True})
 
        active_res = await self.col.aggregate([
            {"$match": {"timestamp": {"$gte": today}}},
            {"$group": {"_id": "$employee_id"}},
            {"$count": "count"},
        ]).to_list(1)
        active_today = active_res[0]["count"] if active_res else 0
 
        cin_res = await self.col.aggregate([
            {"$match": {"timestamp": {"$gte": today}}},
            {"$sort": {"timestamp": 1}},
            {"$group": {"_id": "$employee_id", "last_type": {"$last": "$attendance_type"}}},
            {"$match": {"last_type": AttendanceType.CHECK_IN}},
            {"$count": "count"},
        ]).to_list(1)
        checked_in_now = cin_res[0]["count"] if cin_res else 0
 
        hrs_res = await self.col.aggregate([
            {"$match": {"timestamp": {"$gte": today}}},
            {"$sort": {"timestamp": 1}},
            {"$group": {
                "_id": "$employee_id",
                "first_in": {"$first": {"$cond": [{"$eq": ["$attendance_type", AttendanceType.CHECK_IN]}, "$timestamp", None]}},
                "last_out": {"$last": {"$cond": [{"$eq": ["$attendance_type", AttendanceType.CHECK_OUT]}, "$timestamp", None]}},
            }},
            {"$match": {"first_in": {"$ne": None}, "last_out": {"$ne": None}}},
            {"$project": {"hours": {"$divide": [{"$subtract": ["$last_out", "$first_in"]}, 3600000]}}},
            {"$group": {"_id": None, "avg": {"$avg": "$hours"}}},
        ]).to_list(1)
 
        avg_hours = round(hrs_res[0]["avg"], 2) if hrs_res else 0.0
 
        return DashboardStats(
            total_employees=total_emp,
            active_today=active_today,
            checked_in_now=checked_in_now,
            avg_hours_today=avg_hours,
        )