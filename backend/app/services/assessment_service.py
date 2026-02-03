"""
Assessment Service

Handles assessment CRUD, question management, submissions, and grading.
Includes auto-grading for objective questions.
"""

from typing import List, Optional, Dict
from datetime import datetime
from bson import ObjectId
import logging
import uuid

from app.db.mongo import mongodb
from app.models.assessment_models import (
    AssessmentCreateRequest, AssessmentUpdateRequest, AssessmentInDB,
    AssessmentResponse, AssessmentDetailResponse, AssessmentListResponse,
    Question, QuestionCreateRequest, QuestionType, QuestionOption,
    SubmissionInDB, SubmissionResponse, SubmissionDetailResponse,
    SubmissionListResponse, SubmitAssessmentRequest, AnswerSubmission,
    GradeSubmissionRequest, AssessmentStatus, SubmissionStatus,
    StudentAssessmentView
)

logger = logging.getLogger(__name__)


class AssessmentService:
    """Service for managing assessments and submissions."""
    
    def __init__(self):
        self.assessments_collection = "assessments"
        self.submissions_collection = "submissions"
        self._assessments = None
        self._submissions = None
    
    @property
    def assessments(self):
        if self._assessments is None:
            if mongodb.db is not None:
                self._assessments = mongodb.get_collection(self.assessments_collection)
        return self._assessments
    
    @property
    def submissions(self):
        if self._submissions is None:
            if mongodb.db is not None:
                self._submissions = mongodb.get_collection(self.submissions_collection)
        return self._submissions
    
    # === Assessment CRUD ===
    
    async def create_assessment(
        self,
        request: AssessmentCreateRequest,
        instructor_id: str
    ) -> AssessmentResponse:
        """Create a new assessment."""
        try:
            doc = {
                "course_id": request.course_id,
                "title": request.title,
                "description": request.description,
                "type": request.type.value,
                "instructor_id": instructor_id,
                "status": AssessmentStatus.DRAFT.value,
                "questions": [],
                "settings": request.settings.model_dump(),
                "due_date": request.due_date,
                "available_from": request.available_from,
                "total_points": 0,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            
            result = await self.assessments.insert_one(doc)
            doc["id"] = str(result.inserted_id)
            
            logger.info(f"Assessment created: {doc['title']}")
            return self._to_response(doc)
            
        except Exception as e:
            logger.error(f"Create assessment error: {e}")
            raise
    
    async def get_assessment(
        self,
        assessment_id: str,
        include_questions: bool = True
    ) -> Optional[AssessmentDetailResponse]:
        """Get assessment by ID."""
        try:
            doc = await self.assessments.find_one({"_id": ObjectId(assessment_id)})
            if not doc:
                return None
            return self._to_detail_response(doc) if include_questions else self._to_response(doc)
        except Exception as e:
            logger.error(f"Get assessment error: {e}")
            return None
    
    async def list_assessments(
        self,
        course_id: str = None,
        instructor_id: str = None,
        status: str = None,
        student_id: str = None
    ) -> AssessmentListResponse:
        """List assessments with filters."""
        try:
            query = {}
            if course_id:
                query["course_id"] = course_id
            if instructor_id:
                query["instructor_id"] = instructor_id
            if status:
                query["status"] = status
            else:
                # Default: published only for students
                if student_id and not instructor_id:
                    query["status"] = AssessmentStatus.PUBLISHED.value
            
            total = await self.assessments.count_documents(query)
            cursor = self.assessments.find(query).sort("created_at", -1)
            
            assessments = []
            async for doc in cursor:
                response = self._to_response(doc)
                
                # Add student-specific data
                if student_id:
                    submissions = await self.submissions.find({
                        "assessment_id": str(doc["_id"]),
                        "student_id": student_id
                    }).to_list(length=100)
                    
                    response.has_attempted = len(submissions) > 0
                    if submissions:
                        best = max(s.get("percentage", 0) for s in submissions)
                        response.best_score = best
                    response.attempts_remaining = (
                        doc.get("settings", {}).get("attempt_limit", 1) - len(submissions)
                    )
                
                assessments.append(response)
            
            return AssessmentListResponse(assessments=assessments, total=total)
            
        except Exception as e:
            logger.error(f"List assessments error: {e}")
            return AssessmentListResponse(assessments=[], total=0)
    
    async def update_assessment(
        self,
        assessment_id: str,
        request: AssessmentUpdateRequest,
        instructor_id: str
    ) -> Optional[AssessmentResponse]:
        """Update an assessment."""
        try:
            existing = await self.assessments.find_one({
                "_id": ObjectId(assessment_id),
                "instructor_id": instructor_id
            })
            
            if not existing:
                return None
            
            update_data = {"updated_at": datetime.utcnow()}
            
            if request.title:
                update_data["title"] = request.title
            if request.description is not None:
                update_data["description"] = request.description
            if request.type:
                update_data["type"] = request.type.value
            if request.settings:
                update_data["settings"] = request.settings.model_dump()
            if request.due_date is not None:
                update_data["due_date"] = request.due_date
            if request.available_from is not None:
                update_data["available_from"] = request.available_from
            if request.status:
                update_data["status"] = request.status.value
            
            await self.assessments.update_one(
                {"_id": ObjectId(assessment_id)},
                {"$set": update_data}
            )
            
            updated = await self.assessments.find_one({"_id": ObjectId(assessment_id)})
            return self._to_response(updated)
            
        except Exception as e:
            logger.error(f"Update assessment error: {e}")
            return None
    
    async def publish_assessment(
        self,
        assessment_id: str,
        instructor_id: str
    ) -> Optional[AssessmentResponse]:
        """Publish a draft assessment."""
        try:
            result = await self.assessments.update_one(
                {
                    "_id": ObjectId(assessment_id),
                    "instructor_id": instructor_id,
                    "status": AssessmentStatus.DRAFT.value
                },
                {"$set": {
                    "status": AssessmentStatus.PUBLISHED.value,
                    "updated_at": datetime.utcnow()
                }}
            )
            
            if result.modified_count == 0:
                return None
            
            updated = await self.assessments.find_one({"_id": ObjectId(assessment_id)})
            return self._to_response(updated)
            
        except Exception as e:
            logger.error(f"Publish assessment error: {e}")
            return None
    
    # === Question Management ===
    
    async def add_question(
        self,
        assessment_id: str,
        request: QuestionCreateRequest,
        instructor_id: str
    ) -> Optional[Question]:
        """Add a question to an assessment."""
        try:
            assessment = await self.assessments.find_one({
                "_id": ObjectId(assessment_id),
                "instructor_id": instructor_id
            })
            
            if not assessment:
                return None
            
            question_id = str(uuid.uuid4())
            order = len(assessment.get("questions", []))
            
            question = {
                "id": question_id,
                "type": request.type.value,
                "question_text": request.question_text,
                "explanation": request.explanation,
                "points": request.points,
                "order": order,
                "options": [opt.model_dump() for opt in request.options],
                "correct_answer_bool": request.correct_answer_bool,
                "correct_answer_text": request.correct_answer_text,
                "matching_pairs": request.matching_pairs,
                "tags": request.tags,
                "difficulty": request.difficulty
            }
            
            # Update total points
            current_total = assessment.get("total_points", 0)
            
            await self.assessments.update_one(
                {"_id": ObjectId(assessment_id)},
                {
                    "$push": {"questions": question},
                    "$set": {
                        "total_points": current_total + request.points,
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            
            return Question(**question)
            
        except Exception as e:
            logger.error(f"Add question error: {e}")
            return None
    
    async def update_question(
        self,
        assessment_id: str,
        question_id: str,
        request: QuestionCreateRequest,
        instructor_id: str
    ) -> bool:
        """Update a question in an assessment."""
        try:
            assessment = await self.assessments.find_one({
                "_id": ObjectId(assessment_id),
                "instructor_id": instructor_id
            })
            
            if not assessment:
                return False
            
            questions = assessment.get("questions", [])
            question_idx = None
            old_points = 0
            
            for idx, q in enumerate(questions):
                if q.get("id") == question_id:
                    question_idx = idx
                    old_points = q.get("points", 0)
                    break
            
            if question_idx is None:
                return False
            
            # Update question
            questions[question_idx].update({
                "type": request.type.value,
                "question_text": request.question_text,
                "explanation": request.explanation,
                "points": request.points,
                "options": [opt.model_dump() for opt in request.options],
                "correct_answer_bool": request.correct_answer_bool,
                "correct_answer_text": request.correct_answer_text,
                "matching_pairs": request.matching_pairs,
                "tags": request.tags,
                "difficulty": request.difficulty
            })
            
            # Update total points
            new_total = assessment.get("total_points", 0) - old_points + request.points
            
            await self.assessments.update_one(
                {"_id": ObjectId(assessment_id)},
                {"$set": {
                    "questions": questions,
                    "total_points": new_total,
                    "updated_at": datetime.utcnow()
                }}
            )
            
            return True
            
        except Exception as e:
            logger.error(f"Update question error: {e}")
            return False
    
    async def delete_question(
        self,
        assessment_id: str,
        question_id: str,
        instructor_id: str
    ) -> bool:
        """Delete a question from an assessment."""
        try:
            assessment = await self.assessments.find_one({
                "_id": ObjectId(assessment_id),
                "instructor_id": instructor_id
            })
            
            if not assessment:
                return False
            
            questions = assessment.get("questions", [])
            points_to_remove = 0
            new_questions = []
            
            for q in questions:
                if q.get("id") == question_id:
                    points_to_remove = q.get("points", 0)
                else:
                    new_questions.append(q)
            
            if len(questions) == len(new_questions):
                return False  # Question not found
            
            # Reorder
            for idx, q in enumerate(new_questions):
                q["order"] = idx
            
            new_total = assessment.get("total_points", 0) - points_to_remove
            
            await self.assessments.update_one(
                {"_id": ObjectId(assessment_id)},
                {"$set": {
                    "questions": new_questions,
                    "total_points": max(0, new_total),
                    "updated_at": datetime.utcnow()
                }}
            )
            
            return True
            
        except Exception as e:
            logger.error(f"Delete question error: {e}")
            return False
    
    # === Student Submissions ===
    
    async def get_student_view(
        self,
        assessment_id: str,
        student_id: str
    ) -> Optional[StudentAssessmentView]:
        """Get assessment for student (hides correct answers)."""
        try:
            assessment = await self.assessments.find_one({
                "_id": ObjectId(assessment_id),
                "status": AssessmentStatus.PUBLISHED.value
            })
            
            if not assessment:
                return None
            
            # Check if available
            now = datetime.utcnow()
            if assessment.get("available_from") and now < assessment["available_from"]:
                return None
            
            # Check attempt limit
            submissions = await self.submissions.count_documents({
                "assessment_id": assessment_id,
                "student_id": student_id,
                "status": {"$ne": SubmissionStatus.IN_PROGRESS.value}
            })
            
            settings = assessment.get("settings", {})
            if submissions >= settings.get("attempt_limit", 1):
                return None
            
            # Strip correct answers from questions
            questions = []
            for q in assessment.get("questions", []):
                stripped = {
                    "id": q.get("id"),
                    "type": q.get("type"),
                    "question_text": q.get("question_text"),
                    "points": q.get("points"),
                    "order": q.get("order")
                }
                
                # Include options but not which is correct
                if q.get("options"):
                    stripped["options"] = [
                        {"id": opt["id"], "text": opt["text"]}
                        for opt in q["options"]
                    ]
                
                if q.get("matching_pairs"):
                    # Only include left side
                    stripped["matching_left"] = list(q["matching_pairs"].keys())
                    stripped["matching_right"] = list(q["matching_pairs"].values())
                
                questions.append(stripped)
            
            return StudentAssessmentView(
                id=str(assessment["_id"]),
                title=assessment["title"],
                description=assessment.get("description"),
                type=assessment["type"],
                time_limit_minutes=settings.get("time_limit_minutes"),
                question_count=len(questions),
                total_points=assessment.get("total_points", 0),
                questions=questions
            )
            
        except Exception as e:
            logger.error(f"Get student view error: {e}")
            return None
    
    async def start_attempt(
        self,
        assessment_id: str,
        student_id: str,
        student_name: str
    ) -> Optional[SubmissionResponse]:
        """Start a new assessment attempt."""
        try:
            # Check for existing in-progress attempt
            existing = await self.submissions.find_one({
                "assessment_id": assessment_id,
                "student_id": student_id,
                "status": SubmissionStatus.IN_PROGRESS.value
            })
            
            if existing:
                return self._submission_to_response(existing)
            
            # Get assessment for max score
            assessment = await self.assessments.find_one({"_id": ObjectId(assessment_id)})
            if not assessment:
                return None
            
            # Count previous attempts
            attempt_count = await self.submissions.count_documents({
                "assessment_id": assessment_id,
                "student_id": student_id
            })
            
            submission = {
                "assessment_id": assessment_id,
                "student_id": student_id,
                "student_name": student_name,
                "attempt_number": attempt_count + 1,
                "status": SubmissionStatus.IN_PROGRESS.value,
                "answers": [],
                "auto_score": 0,
                "manual_score": 0,
                "total_score": 0,
                "max_score": assessment.get("total_points", 0),
                "percentage": 0.0,
                "passed": False,
                "feedback": {},
                "overall_feedback": None,
                "started_at": datetime.utcnow(),
                "submitted_at": None,
                "graded_at": None,
                "time_spent_seconds": 0
            }
            
            result = await self.submissions.insert_one(submission)
            submission["id"] = str(result.inserted_id)
            
            return self._submission_to_response(submission)
            
        except Exception as e:
            logger.error(f"Start attempt error: {e}")
            return None
    
    async def submit_answers(
        self,
        submission_id: str,
        request: SubmitAssessmentRequest,
        student_id: str
    ) -> Optional[SubmissionDetailResponse]:
        """Submit answers and calculate auto-grade."""
        try:
            submission = await self.submissions.find_one({
                "_id": ObjectId(submission_id),
                "student_id": student_id,
                "status": SubmissionStatus.IN_PROGRESS.value
            })
            
            if not submission:
                return None
            
            # Get assessment for grading
            assessment = await self.assessments.find_one({
                "_id": ObjectId(submission["assessment_id"])
            })
            
            if not assessment:
                return None
            
            # Auto-grade
            auto_score = 0
            needs_manual = False
            questions_map = {q["id"]: q for q in assessment.get("questions", [])}
            
            for answer in request.answers:
                question = questions_map.get(answer.question_id)
                if not question:
                    continue
                
                q_type = question.get("type")
                points = question.get("points", 0)
                
                if q_type == QuestionType.MCQ.value:
                    # Single correct answer MCQ
                    correct_ids = [
                        opt["id"] for opt in question.get("options", [])
                        if opt.get("is_correct")
                    ]
                    if answer.selected_option_ids == correct_ids:
                        auto_score += points
                
                elif q_type == QuestionType.MCQ_MULTI.value:
                    # Multiple correct answers
                    correct_ids = set(
                        opt["id"] for opt in question.get("options", [])
                        if opt.get("is_correct")
                    )
                    selected_ids = set(answer.selected_option_ids)
                    if correct_ids == selected_ids:
                        auto_score += points
                
                elif q_type == QuestionType.TRUE_FALSE.value:
                    if answer.answer_bool == question.get("correct_answer_bool"):
                        auto_score += points
                
                elif q_type == QuestionType.SHORT_ANSWER.value:
                    correct = question.get("correct_answer_text", "").strip().lower()
                    given = (answer.answer_text or "").strip().lower()
                    if correct and given == correct:
                        auto_score += points
                    elif question.get("accept_partial") and correct in given:
                        auto_score += points // 2
                
                elif q_type in [QuestionType.ESSAY.value, QuestionType.FILE_UPLOAD.value]:
                    needs_manual = True
                
                elif q_type == QuestionType.MATCHING.value:
                    correct_pairs = question.get("matching_pairs", {})
                    given_pairs = answer.matching_answers or {}
                    correct_count = sum(
                        1 for k, v in correct_pairs.items()
                        if given_pairs.get(k) == v
                    )
                    if correct_count == len(correct_pairs):
                        auto_score += points
                    else:
                        # Partial credit
                        auto_score += int(points * correct_count / max(len(correct_pairs), 1))
            
            # Calculate totals
            max_score = assessment.get("total_points", 0)
            total_score = auto_score
            percentage = (total_score / max_score * 100) if max_score > 0 else 0
            passing = assessment.get("settings", {}).get("passing_score_percent", 60)
            passed = percentage >= passing
            
            # Determine status
            status = SubmissionStatus.GRADED.value if not needs_manual else SubmissionStatus.SUBMITTED.value
            
            # Calculate time spent
            started = submission.get("started_at", datetime.utcnow())
            time_spent = int((datetime.utcnow() - started).total_seconds())
            
            # Update submission
            update_data = {
                "answers": [a.model_dump() for a in request.answers],
                "auto_score": auto_score,
                "total_score": total_score,
                "max_score": max_score,
                "percentage": round(percentage, 2),
                "passed": passed,
                "status": status,
                "submitted_at": datetime.utcnow(),
                "time_spent_seconds": time_spent
            }
            
            if not needs_manual:
                update_data["graded_at"] = datetime.utcnow()
            
            await self.submissions.update_one(
                {"_id": ObjectId(submission_id)},
                {"$set": update_data}
            )
            
            updated = await self.submissions.find_one({"_id": ObjectId(submission_id)})
            return self._submission_to_detail_response(updated)
            
        except Exception as e:
            logger.error(f"Submit answers error: {e}")
            return None
    
    async def grade_submission(
        self,
        submission_id: str,
        request: GradeSubmissionRequest,
        instructor_id: str
    ) -> Optional[SubmissionDetailResponse]:
        """Manually grade a submission."""
        try:
            submission = await self.submissions.find_one({"_id": ObjectId(submission_id)})
            if not submission:
                return None
            
            # Verify instructor owns the assessment
            assessment = await self.assessments.find_one({
                "_id": ObjectId(submission["assessment_id"]),
                "instructor_id": instructor_id
            })
            
            if not assessment:
                return None
            
            # Calculate manual score
            manual_score = sum(request.question_grades.values())
            auto_score = submission.get("auto_score", 0)
            total_score = auto_score + manual_score
            max_score = submission.get("max_score", 0)
            percentage = (total_score / max_score * 100) if max_score > 0 else 0
            passing = assessment.get("settings", {}).get("passing_score_percent", 60)
            passed = percentage >= passing
            
            update_data = {
                "manual_score": manual_score,
                "total_score": total_score,
                "percentage": round(percentage, 2),
                "passed": passed,
                "feedback": request.question_grades,
                "overall_feedback": request.overall_feedback,
                "status": SubmissionStatus.GRADED.value,
                "graded_at": datetime.utcnow()
            }
            
            await self.submissions.update_one(
                {"_id": ObjectId(submission_id)},
                {"$set": update_data}
            )
            
            updated = await self.submissions.find_one({"_id": ObjectId(submission_id)})
            return self._submission_to_detail_response(updated)
            
        except Exception as e:
            logger.error(f"Grade submission error: {e}")
            return None
    
    async def get_submissions(
        self,
        assessment_id: str = None,
        student_id: str = None,
        instructor_id: str = None
    ) -> SubmissionListResponse:
        """List submissions with filters."""
        try:
            query = {}
            
            if assessment_id:
                query["assessment_id"] = assessment_id
                
                # Verify instructor access
                if instructor_id:
                    assessment = await self.assessments.find_one({
                        "_id": ObjectId(assessment_id),
                        "instructor_id": instructor_id
                    })
                    if not assessment:
                        return SubmissionListResponse(submissions=[], total=0)
            
            if student_id:
                query["student_id"] = student_id
            
            total = await self.submissions.count_documents(query)
            cursor = self.submissions.find(query).sort("submitted_at", -1)
            
            submissions = []
            async for doc in cursor:
                submissions.append(self._submission_to_response(doc))
            
            return SubmissionListResponse(submissions=submissions, total=total)
            
        except Exception as e:
            logger.error(f"Get submissions error: {e}")
            return SubmissionListResponse(submissions=[], total=0)
    
    # === Helper Methods ===
    
    def _to_response(self, doc: dict) -> AssessmentResponse:
        from app.models.assessment_models import AssessmentSettings
        
        settings_data = doc.get("settings", {})
        settings = AssessmentSettings(**settings_data) if settings_data else AssessmentSettings()
        
        return AssessmentResponse(
            id=str(doc["_id"]),
            course_id=doc["course_id"],
            title=doc["title"],
            description=doc.get("description"),
            type=doc["type"],
            instructor_id=doc["instructor_id"],
            status=doc["status"],
            question_count=len(doc.get("questions", [])),
            total_points=doc.get("total_points", 0),
            settings=settings,
            due_date=doc.get("due_date"),
            available_from=doc.get("available_from"),
            created_at=doc.get("created_at", datetime.utcnow())
        )
    
    def _to_detail_response(self, doc: dict) -> AssessmentDetailResponse:
        base = self._to_response(doc)
        questions = [Question(**q) for q in doc.get("questions", [])]
        return AssessmentDetailResponse(**base.model_dump(), questions=questions)
    
    def _submission_to_response(self, doc: dict) -> SubmissionResponse:
        return SubmissionResponse(
            id=str(doc["_id"]),
            assessment_id=doc["assessment_id"],
            student_id=doc["student_id"],
            student_name=doc["student_name"],
            attempt_number=doc.get("attempt_number", 1),
            status=doc["status"],
            total_score=doc.get("total_score", 0),
            max_score=doc.get("max_score", 0),
            percentage=doc.get("percentage", 0),
            passed=doc.get("passed", False),
            submitted_at=doc.get("submitted_at"),
            graded_at=doc.get("graded_at")
        )
    
    def _submission_to_detail_response(self, doc: dict) -> SubmissionDetailResponse:
        base = self._submission_to_response(doc)
        answers = [AnswerSubmission(**a) for a in doc.get("answers", [])]
        return SubmissionDetailResponse(
            **base.model_dump(),
            answers=answers,
            feedback=doc.get("feedback", {}),
            overall_feedback=doc.get("overall_feedback"),
            time_spent_seconds=doc.get("time_spent_seconds", 0)
        )


# Global instance
assessment_service = AssessmentService()
