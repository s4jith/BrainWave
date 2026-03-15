"""
User Stats Router - Dashboard data endpoints (progress, streaks, activity)
"""

from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timedelta
from app.db.mongo import mongodb
from app.core.permissions import require_role
from app.models.rbac_models import TokenData, UserRole
import logging

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/user",
    tags=["User Stats"]
)


def _ensure_self_or_admin(student_id: str, current_user: TokenData) -> None:
    if current_user.role != UserRole.ADMIN and current_user.user_id != student_id:
        raise HTTPException(status_code=403, detail="Access denied")

class DailyActivity(BaseModel):
    """Daily activity entry."""
    day: str = Field(..., description="Day name (Mon, Tue, etc.)")
    active: bool = Field(..., description="Whether user was active")
    hours: float = Field(..., description="Hours of activity")
    date: str = Field(..., description="Date string (YYYY-MM-DD)")

class StreakData(BaseModel):
    """User streak information."""
    current_streak: int = Field(..., description="Current consecutive days")
    longest_streak: int = Field(..., description="Longest streak ever")
    weekly_activity: List[DailyActivity] = Field(..., description="Last 7 days activity")
    last_activity_date: Optional[str] = Field(None, description="Last activity date")

class ProgressData(BaseModel):
    """User progress information."""
    overall_progress: int = Field(..., description="Overall progress percentage")
    total_tests: int = Field(..., description="Total tests available")
    completed_tests: int = Field(..., description="Tests completed")
    total_chapters: int = Field(..., description="Total chapters")
    completed_chapters: int = Field(..., description="Chapters completed")
    average_score: float = Field(..., description="Average test score")

class NoteSummary(BaseModel):
    """Note summary for dashboard."""
    id: str
    title: str
    lesson: str
    date: str
    subject: str

class DashboardData(BaseModel):
    """Complete dashboard data."""
    streak: StreakData
    progress: ProgressData
    recent_notes: List[NoteSummary]
    total_notes: int

@router.get("/streak/{student_id}", response_model=StreakData)
async def get_streak_data(
    student_id: str,
    current_user: TokenData = Depends(require_role([UserRole.STUDENT, UserRole.ADMIN]))
):
    """
    Get user's activity streak and weekly activity.
    
    Calculates streak based on daily login/activity records in MongoDB.
    """
    try:
        _ensure_self_or_admin(student_id, current_user)
        logger.info(f"📊 Fetching streak data for student: {student_id}")
        
        activities_col = mongodb.db["user_activities"]
        
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        
        activities = await activities_col.find({
            "student_id": student_id,
            "date": {"$gte": thirty_days_ago.strftime("%Y-%m-%d")}
        }).sort("date", -1).to_list(length=30)
        
        current_streak = 0
        today = datetime.utcnow().date()
        check_date = today
        
        active_dates = {a["date"] for a in activities}
        
        while check_date.strftime("%Y-%m-%d") in active_dates:
            current_streak += 1
            check_date -= timedelta(days=1)
        
        user_col = mongodb.db["users"]
        user = await user_col.find_one({"student_id": student_id})
        longest_streak = user.get("longest_streak", current_streak) if user else current_streak
        
        if current_streak > longest_streak:
            longest_streak = current_streak
            await user_col.update_one(
                {"student_id": student_id},
                {"$set": {"longest_streak": longest_streak}},
                upsert=True
            )
        
        weekly_activity = []
        day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        
        for i in range(6, -1, -1):
            day_date = today - timedelta(days=i)
            day_str = day_date.strftime("%Y-%m-%d")
            day_name = day_names[day_date.weekday()]
            
            day_activity = next((a for a in activities if a["date"] == day_str), None)
            
            weekly_activity.append(DailyActivity(
                day=day_name,
                active=day_activity is not None,
                hours=day_activity.get("hours", 0) if day_activity else 0,
                date=day_str
            ))
        
        last_activity = activities[0]["date"] if activities else None
        
        return StreakData(
            current_streak=current_streak,
            longest_streak=longest_streak,
            weekly_activity=weekly_activity,
            last_activity_date=last_activity
        )
        
    except Exception as e:
        logger.error(f" Get streak error: {e}")
        today = datetime.utcnow().date()
        day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        weekly = []
        for i in range(6, -1, -1):
            day_date = today - timedelta(days=i)
            weekly.append(DailyActivity(
                day=day_names[day_date.weekday()],
                active=False,
                hours=0,
                date=day_date.strftime("%Y-%m-%d")
            ))
        
        return StreakData(
            current_streak=0,
            longest_streak=0,
            weekly_activity=weekly,
            last_activity_date=None
        )

@router.get("/progress/{student_id}", response_model=ProgressData)
async def get_progress_data(
    student_id: str,
    subject: Optional[str] = Query(None, description="Filter by subject"),
    current_user: TokenData = Depends(require_role([UserRole.STUDENT, UserRole.ADMIN]))
):
    """
    Get user's learning progress.
    
    Calculates progress from completed tests and chapters.
    """
    try:
        _ensure_self_or_admin(student_id, current_user)
        logger.info(f"📊 Fetching progress data for student: {student_id}")
        
        eval_col = mongodb.db["evaluations"]
        
        filter_query = {"student_id": student_id}
        if subject:
            filter_query["subject"] = subject
        
        evaluations = await eval_col.find(filter_query).to_list(length=100)
        
        completed_tests = len(evaluations)
        total_tests = 10
        
        if evaluations:
            scores = [e.get("result", {}).get("percentage", 0) for e in evaluations]
            average_score = sum(scores) / len(scores)
        else:
            average_score = 0
        
        notes_col = mongodb.db["notes"]
        notes_filter = {"student_id": student_id}
        if subject:
            notes_filter["subject"] = subject
        
        notes = await notes_col.find(notes_filter).to_list(length=500)
        completed_chapters = len(set(n.get("chapter", 0) for n in notes if n.get("chapter")))
        
        total_chapters = 14
        
        test_progress = (completed_tests / total_tests) * 50 if total_tests > 0 else 0
        chapter_progress = (completed_chapters / total_chapters) * 50 if total_chapters > 0 else 0
        overall_progress = int(test_progress + chapter_progress)
        
        return ProgressData(
            overall_progress=min(overall_progress, 100),
            total_tests=total_tests,
            completed_tests=completed_tests,
            total_chapters=total_chapters,
            completed_chapters=completed_chapters,
            average_score=round(average_score, 1)
        )
        
    except Exception as e:
        logger.error(f" Get progress error: {e}")
        return ProgressData(
            overall_progress=0,
            total_tests=10,
            completed_tests=0,
            total_chapters=14,
            completed_chapters=0,
            average_score=0
        )

@router.get("/dashboard/{student_id}", response_model=DashboardData)
async def get_dashboard_data(
    student_id: str,
    subject: Optional[str] = Query(None, description="Filter by subject"),
    current_user: TokenData = Depends(require_role([UserRole.STUDENT, UserRole.ADMIN]))
):
    """
    Get all dashboard data in one call.
    
    Returns streak, progress, and recent notes for efficiency.
    """
    try:
        _ensure_self_or_admin(student_id, current_user)
        logger.info(f"📊 Fetching dashboard data for student: {student_id}")
        
        streak = await get_streak_data(student_id, current_user)
        progress = await get_progress_data(student_id, subject, current_user)
        
        notes_col = mongodb.db["notes"]
        notes_filter = {"student_id": student_id}
        if subject:
            notes_filter["subject"] = subject
        
        raw_notes = await notes_col.find(notes_filter).sort("created_at", -1).limit(5).to_list(length=5)
        
        recent_notes = []
        for note in raw_notes:
            created_at = note.get("created_at", datetime.utcnow())
            if isinstance(created_at, datetime):
                date_str = created_at.strftime("%b %d")
            else:
                date_str = str(created_at)[:10]
            
            recent_notes.append(NoteSummary(
                id=str(note.get("_id", "")),
                title=note.get("heading", note.get("note_content", "Untitled")[:30]),
                lesson=f"{note.get('subject', 'Unknown')} Ch {note.get('chapter', '?')}",
                date=date_str,
                subject=note.get("subject", "Unknown")
            ))
        
        total_notes = await notes_col.count_documents(notes_filter)
        
        return DashboardData(
            streak=streak,
            progress=progress,
            recent_notes=recent_notes,
            total_notes=total_notes
        )
        
    except Exception as e:
        logger.error(f" Get dashboard error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/activity/log")
async def log_activity(
    student_id: Optional[str] = None,
    hours: float = 0.5,
    current_user: TokenData = Depends(require_role([UserRole.STUDENT, UserRole.ADMIN]))
):
    """
    Log user activity for streak tracking.
    
    Call this when user performs any action (opens PDF, uses chatbot, etc.)
    """
    try:
        effective_student_id = student_id or current_user.user_id
        _ensure_self_or_admin(effective_student_id, current_user)
        today = datetime.utcnow().strftime("%Y-%m-%d")
        
        activities_col = mongodb.db["user_activities"]
        
        result = await activities_col.update_one(
            {"student_id": effective_student_id, "date": today},
            {
                "$inc": {"hours": hours},
                "$set": {"last_updated": datetime.utcnow()}
            },
            upsert=True
        )
        
        logger.info(f"Logged activity for {effective_student_id}: +{hours}h on {today}")
        
        return {"message": "Activity logged", "date": today, "hours_added": hours}
        
    except Exception as e:
        logger.error(f" Log activity error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/analytics/{student_id}")
async def get_student_analytics(
    student_id: str,
    period: str = Query("week", description="Period: week, month, or all"),
    current_user: TokenData = Depends(require_role([UserRole.STUDENT, UserRole.ADMIN]))
):
    """
    Get comprehensive analytics for charts and progress tracking.
    
    Returns:
    - Total study hours
    - Questions asked per subject
    - Tests taken per subject
    - Daily/weekly activity data for charts
    """
    try:
        _ensure_self_or_admin(student_id, current_user)
        logger.info(f"📊 Fetching analytics for student: {student_id}, period: {period}")
        
        db = mongodb.db
        today = datetime.utcnow().date()
        
        if period == "week":
            start_date = today - timedelta(days=7)
        elif period == "month":
            start_date = today - timedelta(days=30)
        else:
            start_date = today - timedelta(days=365)
        
        start_str = start_date.strftime("%Y-%m-%d")
        
        activities_col = db["user_activities"]
        activities = await activities_col.find({
            "student_id": student_id,
            "date": {"$gte": start_str}
        }).sort("date", 1).to_list(length=100)
        
        total_hours = sum(a.get("hours", 0) for a in activities)
        
        daily_data = []
        for a in activities:
            daily_data.append({
                "date": a.get("date"),
                "hours": round(a.get("hours", 0), 1)
            })
        
        questions_col = db["top_questions"]
        questions = await questions_col.find({
            "user_id": student_id
        }).to_list(length=500)
        
        subject_questions = {}
        for q in questions:
            subj = q.get("subject", "Unknown")
            subject_questions[subj] = subject_questions.get(subj, 0) + 1
        
        tests_col = db["test_submissions"]
        tests = await tests_col.find({
            "student_id": student_id
        }).to_list(length=100)
        
        subject_tests = {}
        test_scores = []
        for t in tests:
            subj = t.get("subject", "Unknown")
            subject_tests[subj] = subject_tests.get(subj, 0) + 1
            score = t.get("score", 0)
            if score:
                test_scores.append(score)
        
        avg_test_score = sum(test_scores) / len(test_scores) if test_scores else 0
        
        all_subjects = set(subject_questions.keys()) | set(subject_tests.keys())
        subject_breakdown = []
        for subj in sorted(all_subjects):
            subject_breakdown.append({
                "subject": subj,
                "questions_asked": subject_questions.get(subj, 0),
                "tests_taken": subject_tests.get(subj, 0)
            })
        
        return {
            "period": period,
            "summary": {
                "total_hours": round(total_hours, 1),
                "total_questions": len(questions),
                "total_tests": len(tests),
                "avg_test_score": round(avg_test_score, 1)
            },
            "daily_activity": daily_data,
            "subject_breakdown": subject_breakdown,
            "active_days": len(activities)
        }
        
    except Exception as e:
        logger.error(f" Get analytics error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
