"""
Career Analysis Models

Pydantic schemas for the Career Analysis feature:
- CareerQuestion: MCQ with cognitive-domain weights
- CareerTest / CareerTestAttempt: 30-question test lifecycle
- CareerResult: domain profile + career recommendations
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict
from datetime import datetime
from enum import Enum


# ── Cognitive Domains ──────────────────────────────────────────────────────────

class CognitiveDomain(str, Enum):
    """Eight cognitive axes used for career profiling."""
    QA = "QA"      # Quantitative Aptitude
    SCI = "SCI"    # Scientific Reasoning
    LOG = "LOG"    # Logical Thinking
    COMP = "COMP"  # Computational Thinking
    BIO = "BIO"    # Biological Orientation
    VERB = "VERB"  # Communication / Verbal
    CREA = "CREA"  # Creativity
    SOC = "SOC"    # Social Understanding

DOMAIN_LABELS: Dict[str, str] = {
    "QA": "Quantitative Aptitude",
    "SCI": "Scientific Reasoning",
    "LOG": "Logical Thinking",
    "COMP": "Computational Thinking",
    "BIO": "Biological Orientation",
    "VERB": "Communication",
    "CREA": "Creativity",
    "SOC": "Social Understanding",
}

ALL_DOMAINS = list(DOMAIN_LABELS.keys())


# ── Question CRUD ──────────────────────────────────────────────────────────────

class CareerQuestionCreate(BaseModel):
    """Payload an admin submits to create a career-analysis question."""

    subject: str = Field(
        ..., min_length=1, max_length=100,
        description="Subject area (Math, Physics, Biology, Programming, Logic, etc.)"
    )
    question_text: str = Field(..., min_length=10, max_length=2000)
    options: List[str] = Field(
        ..., min_length=4, max_length=4,
        description="Exactly 4 answer options"
    )
    correct_answer: int = Field(
        ..., ge=0, le=3,
        description="Index of the correct option (0-3)"
    )
    difficulty: int = Field(
        ..., ge=1, le=3,
        description="Difficulty level: 1=Easy, 2=Medium, 3=Hard"
    )
    domain_weights: Dict[str, float] = Field(
        ...,
        description='Cognitive-domain weights, e.g. {"QA": 0.6, "LOG": 0.4}. Values must sum to ~1.0'
    )

    @field_validator("domain_weights")
    @classmethod
    def validate_domain_weights(cls, v):
        if not v:
            raise ValueError("domain_weights must contain at least one domain")
        for key in v:
            if key not in ALL_DOMAINS:
                raise ValueError(
                    f"Invalid domain '{key}'. Must be one of {ALL_DOMAINS}"
                )
        for key, val in v.items():
            if not (0.0 < val <= 1.0):
                raise ValueError(
                    f"Weight for '{key}' must be in (0, 1]. Got {val}"
                )
        total = sum(v.values())
        if not (0.95 <= total <= 1.05):
            raise ValueError(
                f"domain_weights must sum to ~1.0 (got {total:.2f})"
            )
        return v


class CareerQuestionUpdate(BaseModel):
    """Partial update payload for an existing question."""

    subject: Optional[str] = None
    question_text: Optional[str] = None
    options: Optional[List[str]] = None
    correct_answer: Optional[int] = Field(None, ge=0, le=3)
    difficulty: Optional[int] = Field(None, ge=1, le=3)
    domain_weights: Optional[Dict[str, float]] = None
    is_active: Optional[bool] = None

    @field_validator("domain_weights")
    @classmethod
    def validate_domain_weights(cls, v):
        if v is None:
            return v
        for key in v:
            if key not in ALL_DOMAINS:
                raise ValueError(f"Invalid domain '{key}'")
        for key, val in v.items():
            if not (0.0 < val <= 1.0):
                raise ValueError(f"Weight for '{key}' must be in (0, 1]")
        total = sum(v.values())
        if not (0.95 <= total <= 1.05):
            raise ValueError(f"domain_weights must sum to ~1.0 (got {total:.2f})")
        return v


class CareerQuestionResponse(BaseModel):
    """Question as returned to the admin (includes correct answer)."""

    id: str
    subject: str
    question_text: str
    options: List[str]
    correct_answer: int
    difficulty: int
    domain_weights: Dict[str, float]
    is_active: bool = True
    created_at: datetime
    created_by: Optional[str] = None


class CareerQuestionStudent(BaseModel):
    """Question as shown to a student (no correct answer / weights)."""

    id: str
    subject: str
    question_text: str
    options: List[str]
    difficulty: int


# ── Test Attempt ───────────────────────────────────────────────────────────────

class CareerTestStartResponse(BaseModel):
    """Returned when a student starts a career test."""

    test_id: str
    questions: List[CareerQuestionStudent]
    total_questions: int
    time_limit_minutes: int = 45


class AnswerItem(BaseModel):
    """A single answer submitted by the student."""

    question_id: str
    selected_option: int = Field(..., ge=0, le=3)


class CareerTestSubmit(BaseModel):
    """Payload when a student submits their career test."""

    test_id: str
    answers: List[AnswerItem]

    @field_validator("answers")
    @classmethod
    def validate_answer_count(cls, v):
        if len(v) == 0:
            raise ValueError("At least one answer is required")
        if len(v) > 30:
            raise ValueError("Cannot submit more than 30 answers")
        return v


# ── Assignment ─────────────────────────────────────────────────────────────────

class CareerAssignmentCreate(BaseModel):
    """Payload an admin submits to create a career-test assignment."""

    title: str = Field(default="Career Analysis Test", min_length=1, max_length=200)
    description: Optional[str] = Field(default="", max_length=1000)


# ── Result / Career Recommendation ────────────────────────────────────────────

class DomainScore(BaseModel):
    """Score on a single cognitive domain (0-100 scale)."""

    domain: str
    label: str
    raw_score: float
    normalized_score: float = Field(..., ge=0, le=100)


class CareerMatch(BaseModel):
    """A single career recommendation with compatibility %."""

    career: str
    match_percentage: float = Field(..., ge=0, le=100)
    description: str = ""


class ConfidenceMetrics(BaseModel):
    """Measures how reliable the recommendation is."""

    questions_attempted: int
    questions_correct: int
    accuracy_pct: float
    domain_coverage: float = Field(
        ...,
        description="Fraction of domains that received at least one signal (0-1)"
    )
    confidence_score: float = Field(
        ..., ge=0, le=100,
        description="Overall confidence in the recommendation (0-100)"
    )
    confidence_label: str = Field(
        ...,
        description="High / Moderate / Low"
    )


class CareerResultResponse(BaseModel):
    """Full career analysis result for a student."""

    result_id: str
    student_id: str
    test_id: str
    domain_scores: List[DomainScore]
    top_careers: List[CareerMatch]
    confidence: ConfidenceMetrics
    cognitive_profile: Dict[str, float]   # domain→0-100 vector
    completed_at: datetime
