"""
Gradebook Router

API endpoints for viewing grades, analytics, and gradebook export.
"""

from fastapi import APIRouter, HTTPException, Depends, Response
from typing import Dict, Any
import logging

from app.services.analytics_service import analytics_service
from app.core.permissions import (
    get_current_user, require_permission
)
from app.models.rbac_models import Permission, TokenData, UserRole

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/gradebook", tags=["gradebook"])

@router.get("/my-grades")
async def get_my_grades(
    course_id: str = None,
    current_user: TokenData = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get current student's grades."""
    try:
        result = await analytics_service.get_student_grades(
            student_id=current_user.user_id,
            course_id=course_id
        )
        return result
    except Exception as e:
        logger.error(f"Get my grades error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get grades")

@router.get("/student/{student_id}")
async def get_student_grades(
    student_id: str,
    course_id: str = None,
    current_user: TokenData = Depends(require_permission(Permission.VIEW_CLASS_ANALYTICS))
) -> Dict[str, Any]:
    """Get grades for a specific student (teachers/admins)."""
    try:
        return await analytics_service.get_student_grades(
            student_id=student_id,
            course_id=course_id
        )
    except Exception as e:
        logger.error(f"Get student grades error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get grades")

@router.get("/course/{course_id}/analytics")
async def get_course_analytics(
    course_id: str,
    current_user: TokenData = Depends(require_permission(Permission.VIEW_CLASS_ANALYTICS))
) -> Dict[str, Any]:
    """Get analytics for a course."""
    try:
        result = await analytics_service.get_course_analytics(
            course_id=course_id,
            instructor_id=current_user.user_id
        )
        
        if not result:
            raise HTTPException(status_code=404, detail="Course not found or access denied")
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get course analytics error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get analytics")

@router.get("/assessment/{assessment_id}/analytics")
async def get_assessment_analytics(
    assessment_id: str,
    current_user: TokenData = Depends(require_permission(Permission.VIEW_CLASS_ANALYTICS))
) -> Dict[str, Any]:
    """Get detailed analytics for an assessment."""
    try:
        result = await analytics_service.get_assessment_analytics(
            assessment_id=assessment_id,
            instructor_id=current_user.user_id
        )
        
        if not result:
            raise HTTPException(status_code=404, detail="Assessment not found or access denied")
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get assessment analytics error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get analytics")

@router.get("/course/{course_id}")
async def get_class_gradebook(
    course_id: str,
    current_user: TokenData = Depends(require_permission(Permission.VIEW_CLASS_ANALYTICS))
) -> Dict[str, Any]:
    """Get full gradebook for a course."""
    try:
        result = await analytics_service.get_class_gradebook(
            course_id=course_id,
            instructor_id=current_user.user_id
        )
        
        if not result:
            raise HTTPException(status_code=404, detail="Course not found or access denied")
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get class gradebook error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get gradebook")

@router.get("/course/{course_id}/export")
async def export_grades(
    course_id: str,
    current_user: TokenData = Depends(require_permission(Permission.EXPORT_DATA))
):
    """Export course grades as CSV."""
    try:
        csv_content = await analytics_service.export_grades_csv(
            course_id=course_id,
            instructor_id=current_user.user_id
        )
        
        if not csv_content:
            raise HTTPException(status_code=404, detail="Course not found or access denied")
        
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=gradebook_{course_id}.csv"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Export grades error: {e}")
        raise HTTPException(status_code=500, detail="Failed to export grades")

@router.get("/stats/teacher")
async def get_teacher_stats(
    current_user: TokenData = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get dashboard stats for teachers."""
    if current_user.role not in [UserRole.TEACHER, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Teachers only")
    
    try:
        return await analytics_service.get_teacher_dashboard_stats(
            instructor_id=current_user.user_id
        )
    except Exception as e:
        logger.error(f"Get teacher stats error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get stats")

@router.get("/stats/student")
async def get_student_stats(
    current_user: TokenData = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get dashboard stats for students."""
    try:
        return await analytics_service.get_student_dashboard_stats(
            student_id=current_user.user_id
        )
    except Exception as e:
        logger.error(f"Get student stats error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get stats")
