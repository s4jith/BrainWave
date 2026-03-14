"""
Assessment System Models

Pydantic models for quizzes, exams, questions, and student submissions.
Supports multiple question types with auto-grading and manual grading.
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

class AssessmentType(str, Enum):
    """Types of assessments."""
    QUIZ = "quiz"
    EXAM = "exam"
    ASSIGNMENT = "assignment"
    PRACTICE = "practice"

class QuestionType(str, Enum):
    """Types of questions."""
    MCQ = "mcq"
    MCQ_MULTI = "mcq_multi"
    TRUE_FALSE = "true_false"
    SHORT_ANSWER = "short_answer"
    ESSAY = "essay"
    FILL_BLANK = "fill_blank"
    MATCHING = "matching"
    FILE_UPLOAD = "file_upload"

class AssessmentStatus(str, Enum):
    """Assessment publication status."""
    DRAFT = "draft"
    PUBLISHED = "published"
    CLOSED = "closed"

class SubmissionStatus(str, Enum):
    """Submission status."""
    IN_PROGRESS = "in_progress"
    SUBMITTED = "submitted"
    GRADED = "graded"
    RETURNED = "returned"

class QuestionOption(BaseModel):
    """Option for MCQ questions."""
    id: str
    text: str
    is_correct: bool = False

class Question(BaseModel):
    """Individual question in an assessment."""
    id: Optional[str] = None
    type: QuestionType
    question_text: str = Field(..., min_length=1)
    explanation: Optional[str] = None
    points: int = Field(default=1, ge=0)
    order: int = Field(default=0, ge=0)
    
    options: List[QuestionOption] = Field(default_factory=list)
    
    correct_answer_bool: Optional[bool] = None
    
    correct_answer_text: Optional[str] = None
    accept_partial: bool = False
    
    matching_pairs: Optional[Dict[str, str]] = None
    
    allowed_file_types: List[str] = Field(default_factory=lambda: ["pdf", "doc", "docx", "jpg", "png"])
    
    tags: List[str] = Field(default_factory=list)
    difficulty: str = "medium"

class AssessmentSettings(BaseModel):
    """Settings for an assessment."""
    time_limit_minutes: Optional[int] = None
    attempt_limit: int = Field(default=1, ge=1)
    shuffle_questions: bool = False
    shuffle_options: bool = False
    show_correct_answers: bool = True
    show_feedback_immediately: bool = True
    passing_score_percent: int = Field(default=40, ge=0, le=100)
    allow_late_submission: bool = False
    late_penalty_percent: int = Field(default=0, ge=0, le=100)
    require_webcam: bool = False
    prevent_tab_switch: bool = False

class AssessmentCreateRequest(BaseModel):
    """Request to create an assessment."""
    title: str = Field(..., min_length=3)
    description: Optional[str] = None
    subject: Optional[str] = None
    class_level: Optional[int] = None
    type: Optional[AssessmentType] = AssessmentType.QUIZ
    course_id: Optional[str] = None
    settings: AssessmentSettings = Field(default_factory=AssessmentSettings)
    due_date: Optional[datetime] = None
    available_from: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    num_attempts: Optional[int] = 1
    show_results_immediately: Optional[bool] = True
    start_datetime: Optional[str] = None
    end_datetime: Optional[str] = None
    student_ids: Optional[List[str]] = Field(default_factory=list)
    group_ids: Optional[List[str]] = Field(default_factory=list, description="Group IDs assigned to this assessment")
    questions: Optional[List[dict]] = Field(default_factory=list)
    created_by: Optional[str] = None
    evaluation_type: Optional[str] = Field(default="manual", description="'ai' for AI evaluation, 'manual' for teacher grading")
    status: Optional[AssessmentStatus] = None

class AssessmentUpdateRequest(BaseModel):
    """Request to update an assessment."""
    title: Optional[str] = None
    description: Optional[str] = None
    subject: Optional[str] = None
    class_level: Optional[int] = None
    type: Optional[AssessmentType] = None
    settings: Optional[AssessmentSettings] = None
    due_date: Optional[datetime] = None
    available_from: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    num_attempts: Optional[int] = None
    show_results_immediately: Optional[bool] = None
    start_datetime: Optional[str] = None
    end_datetime: Optional[str] = None
    status: Optional[AssessmentStatus] = None
    questions: Optional[List[dict]] = None
    student_ids: Optional[List[str]] = None
    group_ids: Optional[List[str]] = None
    evaluation_type: Optional[str] = None
    created_by: Optional[str] = None

class QuestionCreateRequest(BaseModel):
    """Request to add a question."""
    type: QuestionType
    question_text: str = Field(..., min_length=1)
    explanation: Optional[str] = None
    points: int = Field(default=1, ge=0)
    options: List[QuestionOption] = Field(default_factory=list)
    correct_answer_bool: Optional[bool] = None
    correct_answer_text: Optional[str] = None
    matching_pairs: Optional[Dict[str, str]] = None
    tags: List[str] = Field(default_factory=list)
    difficulty: str = "medium"

class AnswerSubmission(BaseModel):
    """Single answer in a submission."""
    question_id: str
    selected_option_ids: List[str] = Field(default_factory=list)
    answer_bool: Optional[bool] = None
    answer_text: Optional[str] = None
    matching_answers: Optional[Dict[str, str]] = None
    file_url: Optional[str] = None

class SubmitAssessmentRequest(BaseModel):
    """Request to submit assessment answers."""
    answers: List[AnswerSubmission]

class GradeSubmissionRequest(BaseModel):
    """Request to grade a submission (manual grading)."""
    question_grades: Dict[str, int]
    feedback: Optional[str] = None
    overall_feedback: Optional[str] = None

class AssessmentInDB(BaseModel):
    """Assessment as stored in MongoDB."""
    id: Optional[str] = None
    course_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    type: AssessmentType
    instructor_id: str
    status: AssessmentStatus = AssessmentStatus.DRAFT
    questions: List[Question] = Field(default_factory=list)
    settings: AssessmentSettings = Field(default_factory=AssessmentSettings)
    due_date: Optional[datetime] = None
    available_from: Optional[datetime] = None
    total_points: int = 0
    student_ids: List[str] = Field(default_factory=list)
    group_ids: List[str] = Field(default_factory=list, description="Group IDs assigned to this assessment")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True

class SubmissionInDB(BaseModel):
    """Student submission as stored in MongoDB."""
    id: Optional[str] = None
    assessment_id: str
    student_id: str
    student_name: str
    attempt_number: int = 1
    status: SubmissionStatus = SubmissionStatus.IN_PROGRESS
    answers: List[AnswerSubmission] = Field(default_factory=list)
    
    auto_score: int = 0
    manual_score: int = 0
    total_score: int = 0
    max_score: int = 0
    percentage: float = 0.0
    passed: bool = False
    
    feedback: Dict[str, Any] = Field(default_factory=dict)
    overall_feedback: Optional[str] = None
    
    started_at: datetime = Field(default_factory=datetime.utcnow)
    submitted_at: Optional[datetime] = None
    graded_at: Optional[datetime] = None
    time_spent_seconds: int = 0

    class Config:
        from_attributes = True

class AssessmentResponse(BaseModel):
    """Assessment response for API (without questions for list view)."""
    id: str
    course_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    type: str
    instructor_id: str
    subject: Optional[str] = None
    class_level: int = 10
    status: str
    question_count: int = 0
    total_points: int = 0
    settings: AssessmentSettings
    due_date: Optional[datetime] = None
    available_from: Optional[datetime] = None
    start_datetime: Optional[str] = None
    end_datetime: Optional[str] = None
    submission_count: int = 0
    created_at: datetime
    evaluation_type: Optional[str] = "manual"
    
    has_attempted: bool = False
    best_score: Optional[float] = None
    attempts_remaining: Optional[int] = None

class AssessmentDetailResponse(AssessmentResponse):
    """Detailed assessment response including questions."""
    questions: List[Question] = []
    student_ids: List[str] = []
    group_ids: List[str] = Field(default_factory=list, description="Group IDs assigned to this assessment")

class StudentAssessmentView(BaseModel):
    """Assessment view for students (hides correct answers)."""
    id: str
    title: str
    description: Optional[str] = None
    type: str
    time_limit_minutes: Optional[int] = None
    question_count: int
    total_points: int
    questions: List[Dict[str, Any]]

class SubmissionResponse(BaseModel):
    """Submission response for API."""
    id: str
    assessment_id: str
    student_id: str
    student_name: str
    attempt_number: int
    status: str
    total_score: int
    max_score: int
    percentage: float
    passed: bool
    submitted_at: Optional[datetime]
    graded_at: Optional[datetime]
    admin_comment: Optional[str] = None
    is_reviewed: bool = False

class SubmissionDetailResponse(SubmissionResponse):
    """Detailed submission with answers and feedback."""
    answers: List[AnswerSubmission]
    feedback: Dict[str, Any]
    overall_feedback: Optional[str]
    time_spent_seconds: int

class AssessmentListResponse(BaseModel):
    """Response for listing assessments."""
    assessments: List[AssessmentResponse]
    total: int

class SubmissionListResponse(BaseModel):
    """Response for listing submissions."""
    submissions: List[SubmissionResponse]
    total: int
