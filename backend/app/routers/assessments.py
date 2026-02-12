"""
Assessment Router

API endpoints for assessment creation, question management, 
student submissions, and grading.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional
import logging

from app.models.assessment_models import (
    AssessmentCreateRequest, AssessmentUpdateRequest,
    AssessmentResponse, AssessmentDetailResponse, AssessmentListResponse,
    QuestionCreateRequest, Question,
    SubmitAssessmentRequest, SubmissionResponse, SubmissionDetailResponse,
    SubmissionListResponse, GradeSubmissionRequest, StudentAssessmentView
)
from app.services.assessment_service import assessment_service
from app.core.permissions import (
    get_current_user, require_permission
)
from app.models.rbac_models import Permission, TokenData, UserRole
from app.db.mongo import db
from bson import ObjectId

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/assessments", tags=["assessments"])


# === Assessment CRUD ===

@router.post("", response_model=AssessmentResponse)
async def create_assessment(
    request: AssessmentCreateRequest,
    current_user: TokenData = Depends(require_permission(Permission.CREATE_ASSESSMENT))
):
    """Create a new assessment (Teachers only)."""
    try:
        return await assessment_service.create_assessment(
            request=request,
            instructor_id=current_user.user_id
        )
    except Exception as e:
        logger.error(f"Create assessment error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create assessment")


@router.get("", response_model=AssessmentListResponse)
async def list_assessments(
    course_id: Optional[str] = None,
    current_user: TokenData = Depends(get_current_user)
):
    """
    List assessments.
    Admins see all assessments.
    Teachers see their own assessments.
    Students see published assessments for enrolled courses.
    """
    try:
        instructor_id = None
        student_id = None
        
        # Determine filters based on role
        teacher_id = None
        
        if current_user.role == UserRole.ADMIN:
            # Admin sees everything - no filter
            pass
        elif current_user.role == UserRole.TEACHER:
            # Pass teacher_id to service to enable visibility of:
            # 1. Own tests
            # 2. Admin tests matching assigned groups
            teacher_id = current_user.user_id
        else:
            student_id = current_user.user_id
        
        return await assessment_service.list_assessments(
            course_id=course_id,
            instructor_id=instructor_id,
            student_id=student_id,
            teacher_id=teacher_id
        )
    except Exception as e:
        logger.error(f"List assessments error: {e}")
        raise HTTPException(status_code=500, detail="Failed to list assessments")


@router.get("/{assessment_id}", response_model=AssessmentDetailResponse)
async def get_assessment(
    assessment_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Get assessment details. Teachers see full details, students see limited view."""
    try:
        # Teachers/Admins get full details
        if current_user.role in [UserRole.TEACHER, UserRole.ADMIN]:
            assessment = await assessment_service.get_assessment(assessment_id)
            if not assessment:
                raise HTTPException(status_code=404, detail="Assessment not found")
            return assessment
        
        # Students should use /start endpoint
        raise HTTPException(
            status_code=403,
            detail="Use /start endpoint to begin assessment"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get assessment error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get assessment")


@router.put("/{assessment_id}", response_model=AssessmentResponse)
async def update_assessment(
    assessment_id: str,
    request: AssessmentUpdateRequest,
    current_user: TokenData = Depends(require_permission(Permission.UPDATE_ASSESSMENT))
):
    """Update an assessment."""
    try:
        updated = await assessment_service.update_assessment(
            assessment_id=assessment_id,
            request=request,
            instructor_id=current_user.user_id
        )
        
        if not updated:
            raise HTTPException(status_code=404, detail="Assessment not found or access denied")
        
        return updated
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update assessment error: {e}")
        raise HTTPException(status_code=500, detail="Failed to update assessment")


@router.post("/{assessment_id}/publish", response_model=AssessmentResponse)
async def publish_assessment(
    assessment_id: str,
    current_user: TokenData = Depends(require_permission(Permission.CREATE_ASSESSMENT))
):
    """Publish a draft assessment."""
    try:
        published = await assessment_service.publish_assessment(
            assessment_id=assessment_id,
            instructor_id=current_user.user_id
        )
        
        if not published:
            raise HTTPException(status_code=400, detail="Cannot publish assessment")
        
        return published
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Publish assessment error: {e}")
        raise HTTPException(status_code=500, detail="Failed to publish")


# === Question Management ===

@router.post("/{assessment_id}/questions", response_model=Question)
async def add_question(
    assessment_id: str,
    request: QuestionCreateRequest,
    current_user: TokenData = Depends(require_permission(Permission.CREATE_ASSESSMENT))
):
    """Add a question to an assessment."""
    try:
        question = await assessment_service.add_question(
            assessment_id=assessment_id,
            request=request,
            instructor_id=current_user.user_id
        )
        
        if not question:
            raise HTTPException(status_code=404, detail="Assessment not found or access denied")
        
        return question
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Add question error: {e}")
        raise HTTPException(status_code=500, detail="Failed to add question")


@router.put("/{assessment_id}/questions/{question_id}")
async def update_question(
    assessment_id: str,
    question_id: str,
    request: QuestionCreateRequest,
    current_user: TokenData = Depends(require_permission(Permission.UPDATE_ASSESSMENT))
):
    """Update a question."""
    try:
        success = await assessment_service.update_question(
            assessment_id=assessment_id,
            question_id=question_id,
            request=request,
            instructor_id=current_user.user_id
        )
        
        if not success:
            raise HTTPException(status_code=404, detail="Question not found")
        
        return {"success": True, "message": "Question updated"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update question error: {e}")
        raise HTTPException(status_code=500, detail="Failed to update question")


@router.delete("/{assessment_id}/questions/{question_id}")
async def delete_question(
    assessment_id: str,
    question_id: str,
    current_user: TokenData = Depends(require_permission(Permission.UPDATE_ASSESSMENT))
):
    """Delete a question from an assessment."""
    try:
        success = await assessment_service.delete_question(
            assessment_id=assessment_id,
            question_id=question_id,
            instructor_id=current_user.user_id
        )
        
        if not success:
            raise HTTPException(status_code=404, detail="Question not found")
        
        return {"success": True, "message": "Question deleted"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete question error: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete question")


# === Student Actions ===

@router.get("/{assessment_id}/start", response_model=StudentAssessmentView)
async def start_assessment(
    assessment_id: str,
    current_user: TokenData = Depends(require_permission(Permission.TAKE_ASSESSMENT))
):
    """
    Get assessment for taking (student view with correct answers hidden).
    This also starts an attempt.
    """
    try:
        # Get student view
        view = await assessment_service.get_student_view(
            assessment_id=assessment_id,
            student_id=current_user.user_id
        )
        
        if not view:
            raise HTTPException(
                status_code=403,
                detail="Assessment not available or attempt limit reached"
            )
        
        # Get student name
        user = db.users.find_one({"_id": ObjectId(current_user.user_id)})
        student_name = user.get("name", "Student") if user else "Student"
        
        # Start attempt
        await assessment_service.start_attempt(
            assessment_id=assessment_id,
            student_id=current_user.user_id,
            student_name=student_name
        )
        
        return view
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Start assessment error: {e}")
        raise HTTPException(status_code=500, detail="Failed to start assessment")


@router.post("/{assessment_id}/submit", response_model=SubmissionDetailResponse)
async def submit_assessment(
    assessment_id: str,
    request: SubmitAssessmentRequest,
    current_user: TokenData = Depends(require_permission(Permission.TAKE_ASSESSMENT))
):
    """Submit answers for an assessment."""
    try:
        # Find in-progress submission
        from app.db.mongo import mongodb
        submissions = mongodb.get_collection("submissions")
        
        submission = await submissions.find_one({
            "assessment_id": assessment_id,
            "student_id": current_user.user_id,
            "status": "in_progress"
        })
        
        if not submission:
            raise HTTPException(status_code=404, detail="No active attempt found")
        
        result = await assessment_service.submit_answers(
            submission_id=str(submission["_id"]),
            request=request,
            student_id=current_user.user_id
        )
        
        if not result:
            raise HTTPException(status_code=400, detail="Failed to submit answers")
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Submit assessment error: {e}")
        raise HTTPException(status_code=500, detail="Failed to submit")


# === Submissions & Grading ===

@router.get("/{assessment_id}/submissions", response_model=SubmissionListResponse)
async def get_submissions(
    assessment_id: str,
    current_user: TokenData = Depends(require_permission(Permission.GRADE_SUBMISSION))
):
    """Get all submissions for an assessment (teachers only)."""
    try:
        return await assessment_service.get_submissions(
            assessment_id=assessment_id,
            instructor_id=current_user.user_id
        )
    except Exception as e:
        logger.error(f"Get submissions error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get submissions")


@router.get("/submissions/my", response_model=SubmissionListResponse)
async def get_my_submissions(
    current_user: TokenData = Depends(get_current_user)
):
    """Get current user's submissions."""
    try:
        return await assessment_service.get_submissions(
            student_id=current_user.user_id
        )
    except Exception as e:
        logger.error(f"Get my submissions error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get submissions")


@router.post("/submissions/{submission_id}/grade", response_model=SubmissionDetailResponse)
async def grade_submission(
    submission_id: str,
    request: GradeSubmissionRequest,
    current_user: TokenData = Depends(require_permission(Permission.GRADE_SUBMISSION))
):
    """Grade a submission (manual grading for essay/file questions)."""
    try:
        result = await assessment_service.grade_submission(
            submission_id=submission_id,
            request=request,
            instructor_id=current_user.user_id
        )
        
        if not result:
            raise HTTPException(status_code=404, detail="Submission not found or access denied")
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Grade submission error: {e}")
        raise HTTPException(status_code=500, detail="Failed to grade submission")
