"""
Course Management Router

API endpoints for course creation, management, enrollment, and content.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, List
import logging

from app.models.course_models import (
    CourseCreateRequest, CourseUpdateRequest, CourseResponse,
    CourseDetailResponse, CourseListResponse, ModuleCreateRequest,
    ContentItemCreateRequest, EnrollmentRequest, RatingRequest,
    Module, ContentItem, EnrollmentResponse
)
from app.services.course_service import course_service
from app.core.permissions import (
    get_current_user, require_permission, require_role,
    ensure_ownership
)
from app.models.rbac_models import Permission, TokenData, UserRole
from app.db.mongo import db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/courses", tags=["courses"])

@router.post("", response_model=CourseResponse)
async def create_course(
    request: CourseCreateRequest,
    current_user: TokenData = Depends(require_permission(Permission.CREATE_COURSE))
):
    """
    Create a new course (Teachers/Admins only).
    Course is created in DRAFT status.
    """
    try:
        from bson import ObjectId
        user = db.users.find_one({"_id": ObjectId(current_user.user_id)})
        instructor_name = user.get("name", "Unknown") if user else "Unknown"
        
        course = await course_service.create_course(
            request=request,
            instructor_id=current_user.user_id,
            instructor_name=instructor_name
        )
        
        return course
        
    except Exception as e:
        logger.error(f"Create course error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create course")

@router.get("", response_model=CourseListResponse)
async def list_courses(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category: Optional[str] = None,
    difficulty: Optional[str] = None,
    class_level: Optional[int] = Query(None, ge=5, le=12),
    instructor_id: Optional[str] = None,
    enrolled_only: bool = False,
    current_user: Optional[TokenData] = Depends(get_current_user)
):
    """
    List courses with filtering.
    Students see only published courses.
    Teachers/Admins can filter by instructor.
    """
    try:
        user_id = current_user.user_id if current_user else None
        
        status = None
        if current_user and current_user.role in [UserRole.TEACHER, UserRole.ADMIN]:
            if instructor_id == current_user.user_id:
                status = None
        
        return await course_service.list_courses(
            page=page,
            page_size=page_size,
            category=category,
            difficulty=difficulty,
            class_level=class_level,
            instructor_id=instructor_id,
            status=status,
            user_id=user_id,
            enrolled_only=enrolled_only
        )
        
    except Exception as e:
        logger.error(f"List courses error: {e}")
        raise HTTPException(status_code=500, detail="Failed to list courses")

@router.get("/my-courses", response_model=CourseListResponse)
async def get_my_courses(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: TokenData = Depends(get_current_user)
):
    """
    Get courses based on user role:
    - Teachers: Courses they created
    - Students: Courses they're enrolled in
    """
    try:
        if current_user.role == UserRole.TEACHER or current_user.role == UserRole.ADMIN:
            return await course_service.list_courses(
                page=page,
                page_size=page_size,
                instructor_id=current_user.user_id,
                status=None
            )
        else:
            return await course_service.list_courses(
                page=page,
                page_size=page_size,
                user_id=current_user.user_id,
                enrolled_only=True
            )
            
    except Exception as e:
        logger.error(f"Get my courses error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get courses")

@router.get("/{course_id}", response_model=CourseDetailResponse)
async def get_course(
    course_id: str,
    current_user: Optional[TokenData] = Depends(get_current_user)
):
    """Get course details including modules and content."""
    try:
        user_id = current_user.user_id if current_user else None
        course = await course_service.get_course(course_id, user_id)
        
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")
        
        return course
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get course error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get course")

@router.put("/{course_id}", response_model=CourseResponse)
async def update_course(
    course_id: str,
    request: CourseUpdateRequest,
    current_user: TokenData = Depends(require_permission(Permission.UPDATE_COURSE))
):
    """Update a course (owner or admin only)."""
    try:
        instructor_id = current_user.user_id
        if current_user.role == UserRole.ADMIN:
            course = await course_service.get_course(course_id)
            if course:
                instructor_id = course.instructor_id
        
        updated = await course_service.update_course(course_id, request, instructor_id)
        
        if not updated:
            raise HTTPException(status_code=404, detail="Course not found or access denied")
        
        return updated
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update course error: {e}")
        raise HTTPException(status_code=500, detail="Failed to update course")

@router.delete("/{course_id}")
async def delete_course(
    course_id: str,
    current_user: TokenData = Depends(require_permission(Permission.DELETE_COURSE))
):
    """Delete (archive) a course."""
    try:
        instructor_id = current_user.user_id
        if current_user.role == UserRole.ADMIN:
            course = await course_service.get_course(course_id)
            if course:
                instructor_id = course.instructor_id
        
        success = await course_service.delete_course(course_id, instructor_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="Course not found or access denied")
        
        return {"success": True, "message": "Course archived"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete course error: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete course")

@router.post("/{course_id}/publish", response_model=CourseResponse)
async def publish_course(
    course_id: str,
    current_user: TokenData = Depends(require_permission(Permission.PUBLISH_COURSE))
):
    """Publish a draft course."""
    try:
        published = await course_service.publish_course(course_id, current_user.user_id)
        
        if not published:
            raise HTTPException(status_code=400, detail="Course not found, not a draft, or access denied")
        
        return published
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Publish course error: {e}")
        raise HTTPException(status_code=500, detail="Failed to publish course")

@router.post("/{course_id}/modules", response_model=Module)
async def add_module(
    course_id: str,
    request: ModuleCreateRequest,
    current_user: TokenData = Depends(require_permission(Permission.CREATE_MODULE))
):
    """Add a module to a course."""
    try:
        module = await course_service.add_module(
            course_id=course_id,
            request=request,
            instructor_id=current_user.user_id
        )
        
        if not module:
            raise HTTPException(status_code=404, detail="Course not found or access denied")
        
        return module
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Add module error: {e}")
        raise HTTPException(status_code=500, detail="Failed to add module")

@router.post("/{course_id}/modules/{module_id}/content", response_model=ContentItem)
async def add_content(
    course_id: str,
    module_id: str,
    request: ContentItemCreateRequest,
    current_user: TokenData = Depends(require_permission(Permission.UPLOAD_CONTENT))
):
    """Add content to a module."""
    try:
        content = await course_service.add_content_to_module(
            course_id=course_id,
            module_id=module_id,
            request=request,
            instructor_id=current_user.user_id
        )
        
        if not content:
            raise HTTPException(status_code=404, detail="Course or module not found, or access denied")
        
        return content
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Add content error: {e}")
        raise HTTPException(status_code=500, detail="Failed to add content")

@router.post("/{course_id}/enroll", response_model=EnrollmentResponse)
async def enroll_in_course(
    course_id: str,
    current_user: TokenData = Depends(require_permission(Permission.ENROLL_COURSE))
):
    """Enroll in a course (students only)."""
    try:
        return await course_service.enroll_student(course_id, current_user.user_id)
        
    except Exception as e:
        logger.error(f"Enrollment error: {e}")
        raise HTTPException(status_code=500, detail="Failed to enroll")

@router.delete("/{course_id}/enroll", response_model=EnrollmentResponse)
async def unenroll_from_course(
    course_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Unenroll from a course."""
    try:
        return await course_service.unenroll_student(course_id, current_user.user_id)
        
    except Exception as e:
        logger.error(f"Unenrollment error: {e}")
        raise HTTPException(status_code=500, detail="Failed to unenroll")

@router.post("/{course_id}/rate")
async def rate_course(
    course_id: str,
    request: RatingRequest,
    current_user: TokenData = Depends(get_current_user)
):
    """Rate a course (enrolled students only)."""
    try:
        success = await course_service.rate_course(
            course_id=course_id,
            student_id=current_user.user_id,
            rating=request.rating,
            review=request.review
        )
        
        if not success:
            raise HTTPException(status_code=400, detail="Not enrolled or course not found")
        
        return {"success": True, "message": "Rating submitted"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Rate course error: {e}")
        raise HTTPException(status_code=500, detail="Failed to rate course")

@router.get("/categories/list")
async def get_categories():
    """Get list of available course categories."""
    categories = [
        "Maths",
        "Physics",
        "Chemistry",
        "Biology",
        "Social Science",
        "English",
        "Hindi",
        "Computer Science",
        "Economics",
        "Accountancy",
        "Business Studies"
    ]
    return {"categories": categories}
