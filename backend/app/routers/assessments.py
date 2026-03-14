"""
Assessment Router

API endpoints for assessment creation, question management, 
student submissions, and grading.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import Optional, Dict
from datetime import datetime
import logging
import io
import textwrap

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
from app.db.mongo import mongodb
from bson import ObjectId
from fastapi.responses import StreamingResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/assessments", tags=["assessments"])


def _build_assessment_pdf(assessment: dict, mode: str, submission: Optional[dict] = None) -> bytes:
    """Generate organized PDF for questions/answers/both using PyMuPDF.

    If submission is provided, answer sections print student answers.
    """
    import fitz  # PyMuPDF

    doc = fitz.open()
    page = doc.new_page()

    margin_x = 42
    margin_top = 42
    margin_bottom = 42
    line_height = 15
    y = margin_top

    def ensure_space(lines=1):
        nonlocal page, y
        if y + (lines * line_height) > (page.rect.height - margin_bottom):
            page = doc.new_page()
            y = margin_top

    def write_line(text, size=11):
        nonlocal y
        ensure_space(1)
        page.insert_text((margin_x, y), str(text), fontsize=size)
        y += line_height

    def write_wrapped(text, size=11, indent=0, width=92):
        nonlocal y
        wrapped_lines = textwrap.wrap(str(text), width=max(20, width)) or [""]
        for ln in wrapped_lines:
            ensure_space(1)
            page.insert_text((margin_x + indent, y), ln, fontsize=size)
            y += line_height

    questions = assessment.get("questions", []) or []
    answers_map = {}
    if submission:
        for ans in submission.get("answers", []) or []:
            qid = ans.get("question_id")
            if qid:
                answers_map[qid] = ans

    write_line(assessment.get("title", "Assessment"), size=16)
    write_line(f"Class {assessment.get('class_level', '-')} | {assessment.get('subject', '-')}", size=10)
    write_line(f"Total Questions: {len(questions)}", size=10)
    y += 8

    def resolve_answer(q: dict) -> str:
        q_type = (q.get("type") or "").lower()
        if q_type.startswith("mcq"):
            options = q.get("options") or []
            # Option objects with explicit correctness.
            labels = []
            for oi, opt in enumerate(options):
                if isinstance(opt, dict) and opt.get("is_correct"):
                    labels.append(f"{chr(65 + oi)}. {opt.get('text', '')}")
            if labels:
                return " | ".join(labels)
            # Fall back to any stored answer fields.
            return q.get("correct_answer_text") or q.get("correct_answer") or q.get("answer_text") or "N/A"

        if q_type == "true_false":
            tf = q.get("correct_answer_bool")
            if tf is True:
                return "True"
            if tf is False:
                return "False"
            return q.get("correct_answer") or q.get("correct_answer_text") or "N/A"

        return q.get("correct_answer_text") or q.get("answer_text") or q.get("correct_answer") or "N/A"

    def resolve_student_answer(q: dict) -> str:
        qid = q.get("id")
        ans = answers_map.get(qid, {})
        if not ans:
            return "No answer provided"

        q_type = (q.get("type") or "").lower()

        if q_type.startswith("mcq"):
            options = q.get("options") or []
            selected_ids = ans.get("selected_option_ids") or []
            if not selected_ids:
                selected_single = ans.get("selected_option")
                if selected_single is not None:
                    selected_ids = [selected_single]
            selected_texts = []
            for sel in selected_ids:
                for opt in options:
                    if isinstance(opt, dict) and (opt.get("id") == sel or opt.get("text") == sel):
                        selected_texts.append(str(opt.get("text", "")).strip())
                        break
                    if not isinstance(opt, dict) and (opt == sel):
                        selected_texts.append(str(opt).strip())
                        break
            if selected_texts:
                return " | ".join([t for t in selected_texts if t])

        if q_type == "true_false":
            if ans.get("answer_bool") is True:
                return "True"
            if ans.get("answer_bool") is False:
                return "False"

        text_answer = ans.get("answer_text") or ans.get("text_answer")
        if text_answer:
            return str(text_answer)

        return "No answer provided"

    # For submission exports, "both" should directly print Questions + Student Answers
    # in one continuous section instead of separate question-paper + answer-key pages.
    if submission and mode == "both":
        write_line("Questions & Student Answers", size=13)
        y += 4
        for idx, q in enumerate(questions, start=1):
            points = q.get("points", q.get("marks", 1))
            q_text = q.get("question_text") or q.get("text") or ""
            write_wrapped(f"Q{idx}. {q_text} ({points} mark{'s' if points != 1 else ''})", size=11, width=90)

            q_type = (q.get("type") or "").lower()
            options = q.get("options") or []
            if q_type.startswith("mcq") and options:
                for oi, opt in enumerate(options):
                    opt_text = opt.get("text") if isinstance(opt, dict) else str(opt)
                    write_wrapped(f"{chr(65 + oi)}. {opt_text}", size=10, indent=14, width=82)

            student_answer = resolve_student_answer(q)
            write_wrapped(f"Student Answer: {student_answer}", size=11, indent=12, width=84)
            write_line("", size=10)

    elif mode in ("questions", "both"):
        write_line("Question Paper", size=13)
        y += 4
        for idx, q in enumerate(questions, start=1):
            points = q.get("points", q.get("marks", 1))
            q_text = q.get("question_text") or q.get("text") or ""
            write_wrapped(f"Q{idx}. {q_text} ({points} mark{'s' if points != 1 else ''})", size=11, width=90)

            q_type = (q.get("type") or "").lower()
            options = q.get("options") or []
            if q_type.startswith("mcq") and options:
                for oi, opt in enumerate(options):
                    opt_text = opt.get("text") if isinstance(opt, dict) else str(opt)
                    write_wrapped(f"{chr(65 + oi)}. {opt_text}", size=10, indent=14, width=82)
            write_line("", size=10)

    if mode in ("answers", "both") and not (submission and mode == "both"):
        if mode == "both":
            page = doc.new_page()
            y = margin_top
        write_line("Student Answers" if submission else "Answer Key", size=13)
        y += 4
        for idx, q in enumerate(questions, start=1):
            q_text = q.get("question_text") or q.get("text") or ""
            answer = resolve_student_answer(q) if submission else resolve_answer(q)
            write_wrapped(f"Q{idx}. {q_text}", size=10, width=90)
            write_wrapped(f"Answer: {answer}", size=11, indent=12, width=84)
            write_line("", size=10)

    pdf_bytes = doc.write()
    doc.close()
    return pdf_bytes


@router.get("/{assessment_id}/download")
async def download_assessment_pdf(
    assessment_id: str,
    mode: str = Query("questions", pattern="^(questions|answers|both)$"),
    submission_id: Optional[str] = Query(None),
    current_user: TokenData = Depends(get_current_user)
):
    """Download assessment as PDF: questions only, answers only, or both."""
    if not ObjectId.is_valid(assessment_id):
        raise HTTPException(status_code=400, detail="Invalid assessment ID")

    assessment = await mongodb.db.assessments.find_one({"_id": ObjectId(assessment_id)})
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    # Allow staff to download any visible assessment PDF; students are blocked.
    if current_user.role == UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="Students cannot download assessment PDFs")

    submission_doc = None
    if submission_id:
        if not ObjectId.is_valid(submission_id):
            raise HTTPException(status_code=400, detail="Invalid submission ID")
        submission_doc = await mongodb.db.submissions.find_one({"_id": ObjectId(submission_id)})
        if not submission_doc:
            raise HTTPException(status_code=404, detail="Submission not found")
        if submission_doc.get("assessment_id") != assessment_id:
            raise HTTPException(status_code=400, detail="Submission does not belong to this assessment")

    pdf_bytes = _build_assessment_pdf(assessment, mode, submission=submission_doc)
    safe_title = "".join(ch if ch.isalnum() or ch in ("-", "_") else "_" for ch in (assessment.get("title") or "assessment"))
    if submission_doc:
        student_part = "".join(ch if ch.isalnum() or ch in ("-", "_") else "_" for ch in (submission_doc.get("student_name") or submission_doc.get("student_id") or "student"))
        filename = f"{safe_title}_{student_part}_{mode}.pdf"
    else:
        filename = f"{safe_title}_{mode}.pdf"

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

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
    Head sees assessments scoped to their assigned classes/subjects.
    Students see published assessments for enrolled courses.
    """
    try:
        instructor_id = None
        student_id = None
        teacher_id = None
        head_classes = None
        head_subjects = None

        if current_user.role == UserRole.ADMIN:
            pass
        elif current_user.role == UserRole.TEACHER:
            teacher_id = current_user.user_id
        elif current_user.role == UserRole.HEAD:
            # Fetch HEAD's assignment to build scope filter
            from app.db.mongo import db as sync_db
            head_user = sync_db.users.find_one({"user_id": current_user.user_id})
            if head_user:
                assignment_type = head_user.get("assignment_type", "class")
                if assignment_type == "subject":
                    head_subjects = head_user.get("assigned_subjects", [])
                else:
                    head_classes = [int(c) for c in head_user.get("assigned_classes", [])]
        else:
            student_id = current_user.user_id

        return await assessment_service.list_assessments(
            course_id=course_id,
            instructor_id=instructor_id,
            student_id=student_id,
            teacher_id=teacher_id,
            head_classes=head_classes,
            head_subjects=head_subjects
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
        if current_user.role in [UserRole.TEACHER, UserRole.ADMIN]:
            assessment = await assessment_service.get_assessment(assessment_id)
            if not assessment:
                raise HTTPException(status_code=404, detail="Assessment not found")
            return assessment
        
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

@router.delete("/{assessment_id}")
async def delete_assessment(
    assessment_id: str,
    current_user: TokenData = Depends(require_permission(Permission.DELETE_ASSESSMENT))
):
    """Delete an assessment and all related submissions."""
    try:
        success = await assessment_service.delete_assessment(
            assessment_id=assessment_id,
            instructor_id=current_user.user_id
        )
        
        if not success:
            raise HTTPException(status_code=404, detail="Assessment not found or access denied")
        
        return {"success": True, "message": "Assessment deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete assessment error: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete assessment")

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
        view = await assessment_service.get_student_view(
            assessment_id=assessment_id,
            student_id=current_user.user_id
        )
        
        if not view:
            raise HTTPException(
                status_code=403,
                detail="Assessment not available or attempt limit reached"
            )
        
        user = db.users.find_one({"user_id": current_user.user_id})
        student_name = user.get("name", "Student") if user else "Student"
        
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

        # Notify the student that grading has been completed.
        try:
            submission = await mongodb.get_collection("submissions").find_one({"_id": ObjectId(submission_id)})
            assessment = None
            if submission and submission.get("assessment_id"):
                assessment = await mongodb.get_collection("assessments").find_one({"_id": ObjectId(submission.get("assessment_id"))})

            student_id = submission.get("student_id") if submission else None
            if student_id and ObjectId.is_valid(str(student_id)):
                student_doc = db.users.find_one({"_id": ObjectId(str(student_id))}, {"user_id": 1})
                if student_doc and student_doc.get("user_id"):
                    student_id = student_doc.get("user_id")

            if student_id:
                db.notifications.insert_one({
                    "user_id": student_id,
                    "role": "student",
                    "type": "test_graded",
                    "title": "Test Reviewed",
                    "message": f"Your submission for '{assessment.get('title', 'test') if assessment else 'test'}' has been reviewed.",
                    "assessment_id": submission.get("assessment_id") if submission else None,
                    "submission_id": submission_id,
                    "read": False,
                    "is_read": False,
                    "created_at": datetime.utcnow()
                })
        except Exception as ne:
            logger.error(f"Failed to create grading notification for submission {submission_id}: {ne}")
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Grade submission error: {e}")
        raise HTTPException(status_code=500, detail="Failed to grade submission")

class CommentRequest(BaseModel):
    """Request body for adding a comment."""
    comment: str = Field(..., min_length=1)

class TopicAnalyticsRequest(BaseModel):
    """Topic analytics submitted by the evaluator after grading."""
    topic_assessments: Dict[str, str]  # topic_name → "strong" | "moderate" | "weak"
    evaluator_notes: Optional[str] = None

@router.post("/submissions/{submission_id}/topic-analytics")
async def save_topic_analytics(
    submission_id: str,
    request: TopicAnalyticsRequest,
    current_user: TokenData = Depends(require_permission(Permission.GRADE_SUBMISSION))
):
    """Save evaluator-assessed topic analytics for a submission."""
    try:
        submissions_col = mongodb.get_collection("submissions")
        submission = await submissions_col.find_one({"_id": ObjectId(submission_id)})
        if not submission:
            raise HTTPException(status_code=404, detail="Submission not found")

        topic_list = []
        strong_topics = []
        weak_topics = []
        for topic_name, level in request.topic_assessments.items():
            level = level.lower()
            score_pct = 85.0 if level == "strong" else (55.0 if level == "moderate" else 20.0)
            entry = {
                "topic_name": topic_name,
                "score_percentage": score_pct,
                "status": level,
                "correct_answers": 0,
                "total_questions": 0,
                "evaluator_assessed": True,
            }
            topic_list.append(entry)
            if level == "strong":
                strong_topics.append({"name": topic_name, "score": score_pct})
            elif level == "weak":
                weak_topics.append({"name": topic_name, "score": score_pct})

        topic_analytics = {
            "topics": topic_list,
            "strong_topics": strong_topics,
            "weak_topics": weak_topics,
            "total_topics_covered": len(topic_list),
            "evaluator_id": current_user.user_id,
            "evaluator_notes": request.evaluator_notes or "",
        }

        await submissions_col.update_one(
            {"_id": ObjectId(submission_id)},
            {"$set": {"topic_analytics": topic_analytics}}
        )
        return {"success": True, "topic_analytics": topic_analytics}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Save topic analytics error: {e}")
        raise HTTPException(status_code=500, detail="Failed to save topic analytics")

@router.post("/submissions/{submission_id}/comment")
async def add_submission_comment(
    submission_id: str,
    request: CommentRequest,
    current_user: TokenData = Depends(require_permission(Permission.GRADE_SUBMISSION))
):
    """Add admin/teacher feedback comment to a submission. Notifies the student."""
    try:
        submissions_col = mongodb.get_collection("submissions")
        submission = await submissions_col.find_one({"_id": ObjectId(submission_id)})
        
        if not submission:
            raise HTTPException(status_code=404, detail="Submission not found")
        
        await submissions_col.update_one(
            {"_id": ObjectId(submission_id)},
            {"$set": {
                "admin_comment": request.comment,
                "comment_at": datetime.utcnow(),
                "comment_by": current_user.user_id,
                "is_reviewed": True
            }}
        )
        
        assessment = await mongodb.get_collection("assessments").find_one(
            {"_id": ObjectId(submission.get("assessment_id"))}
        )
        test_title = assessment.get("title", "Test") if assessment else "Test"
        
        db.notifications.insert_one({
            "user_id": submission.get("student_id"),
            "type": "test_feedback",
            "title": "Feedback Received",
            "message": f"You received feedback on '{test_title}'",
            "assessment_id": submission.get("assessment_id"),
            "submission_id": submission_id,
            "role": "student",
            "read": False,
            "is_read": False,
            "for_admin": False,
            "created_at": datetime.utcnow()
        })
        
        logger.info(f"Comment added to submission {submission_id} by {current_user.user_id}")
        
        return {"success": True, "message": "Comment saved and student notified"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Add comment error: {e}")
        raise HTTPException(status_code=500, detail="Failed to add comment")

@router.get("/submissions/{submission_id}/detail")
async def get_submission_detail(
    submission_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Get detailed submission with answers and assessment questions for review."""
    try:
        submissions_col = mongodb.get_collection("submissions")
        submission = await submissions_col.find_one({"_id": ObjectId(submission_id)})
        
        if not submission:
            raise HTTPException(status_code=404, detail="Submission not found")
        
        assessment = await mongodb.get_collection("assessments").find_one(
            {"_id": ObjectId(submission.get("assessment_id"))}
        )
        
        questions = []
        if assessment:
            for q in assessment.get("questions", []):
                questions.append({
                    "id": q.get("id"),
                    "text": q.get("text", q.get("question_text", "")),
                    "question_text": q.get("question_text", q.get("text", "")),
                    "type": q.get("type", ""),
                    "points": q.get("points", q.get("marks", 0)),
                    "options": q.get("options", []),
                    "correct_answer_text": q.get("correct_answer_text", q.get("fillup_answers", q.get("answer_text", ""))),
                    "answer_text": q.get("answer_text", ""),
                    "correct_answer_bool": q.get("correct_answer_bool"),
                })
        
        answers_map = {}
        for ans in submission.get("answers", []):
            answers_map[ans.get("question_id")] = ans

        percentage = submission.get("percentage", 0)
        try:
            percentage = float(percentage)
        except Exception:
            percentage = 0.0

        passed = percentage >= 40
        
        return {
            "id": str(submission["_id"]),
            "student_id": submission.get("student_id"),
            "student_name": submission.get("student_name"),
            "assessment_id": submission.get("assessment_id"),
            "assessment_title": assessment.get("title", "Unknown") if assessment else "Unknown",
            "status": submission.get("status"),
            "total_score": submission.get("total_score", 0),
            "auto_score": submission.get("auto_score", 0),
            "manual_score": submission.get("manual_score", 0),
            "max_score": submission.get("max_score", 0),
            "percentage": percentage,
            "passed": passed,
            "submitted_at": submission.get("submitted_at"),
            "time_spent_seconds": submission.get("time_spent_seconds", 0),
            "admin_comment": submission.get("admin_comment", ""),
            "is_reviewed": submission.get("is_reviewed", False),
            "evaluation_type": assessment.get("evaluation_type", "manual") if assessment else "manual",
            "questions": questions,
            "answers": answers_map,
            "evaluation_details": submission.get("evaluation_details", []),
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get submission detail error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get submission")
