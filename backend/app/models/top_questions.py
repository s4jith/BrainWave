"""
Top Questions and Question-Answer Tracking Models
Supports subject-wise recommendations for both Quick and Deep modes.
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime

class TopQuestion(BaseModel):
    """Model for tracking frequently asked questions."""
    question: str = Field(..., description="The question text")
    subject: str = Field(..., description="Subject (hindi, english, math, science, etc.)")
    class_level: int = Field(..., ge=6, le=12, description="Class level")
    chapter: Optional[int] = Field(None, description="Chapter number if applicable")
    mode: Literal["quick", "deep"] = Field(..., description="Mode in which question was asked")
    category: Literal["concept", "problem", "theory", "application", "numerical", "general"] = Field(
        "concept", 
        description="Question category"
    )
    ask_count: int = Field(default=1, description="Number of times this question was asked")
    last_asked: datetime = Field(default_factory=datetime.utcnow, description="Last time question was asked")
    difficulty: Literal["easy", "medium", "hard"] = Field("medium", description="Question difficulty")
    tags: List[str] = Field(default_factory=list, description="Tags for categorization")
    related_concepts: List[str] = Field(default_factory=list, description="Related concepts")

class TopQuestionResponse(BaseModel):
    """Response for top questions."""
    question: str
    subject: str
    class_level: int
    chapter: Optional[int]
    mode: str
    category: str
    ask_count: int
    difficulty: str

class QuestionAnswerPair(BaseModel):
    """Model for storing question-answer pairs with user context."""
    user_id: str = Field(..., description="User identifier")
    session_id: str = Field(..., description="Session identifier")
    question: str = Field(..., description="Question asked by user")
    answer: str = Field(..., description="Answer provided by system")
    subject: str = Field(..., description="Subject")
    class_level: int = Field(..., ge=6, le=12, description="Class level")
    chapter: Optional[int] = Field(None, description="Chapter number")
    mode: Literal["quick", "deep"] = Field(..., description="Mode used")
    
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="When question was asked")
    difficulty: Optional[str] = Field(None, description="Difficulty level")
    time_spent_seconds: Optional[int] = Field(None, description="Time user spent on answer")
    
    user_rating: Optional[int] = Field(None, ge=1, le=5, description="User rating (1-5)")
    was_helpful: Optional[bool] = Field(None, description="Whether answer was helpful")
    
    follow_up_questions: List[dict] = Field(default_factory=list, description="Follow-up questions")
    
    concepts_covered: List[str] = Field(default_factory=list, description="Concepts covered in answer")
    formulas_used: List[str] = Field(default_factory=list, description="Formulas used")
    examples_provided: bool = Field(False, description="Whether examples were provided")

class GetTopQuestionsRequest(BaseModel):
    """Request to get top questions."""
    subject: str = Field(..., description="Subject name")
    class_level: int = Field(..., ge=6, le=12, description="Class level")
    mode: Literal["quick", "deep"] = Field("quick", description="Mode to filter by")
    limit: int = Field(5, ge=1, le=20, description="Number of questions to return")

class GetTopQuestionsResponse(BaseModel):
    """Response with top questions."""
    success: bool = True
    questions: List[TopQuestionResponse]
    count: int
    subject: str
    class_level: int
    mode: str

class GetRecommendationsRequest(BaseModel):
    """Request for personalized recommendations."""
    user_id: str = Field(..., description="User identifier")
    subject: str = Field(..., description="Subject name")
    class_level: int = Field(..., ge=6, le=12, description="Class level")
    mode: Literal["quick", "deep"] = Field("quick", description="Mode to filter by")
    limit: int = Field(5, ge=1, le=20, description="Number of recommendations")

class GetRecommendationsResponse(BaseModel):
    """Response with personalized recommendations."""
    success: bool = True
    recommendations: List[TopQuestionResponse]
    count: int
    personalized: bool = True

class TrackQuestionRequest(BaseModel):
    """Request to track a question-answer pair."""
    user_id: str = Field(..., description="User identifier")
    session_id: str = Field(..., description="Session identifier")
    question: str = Field(..., description="Question text")
    answer: str = Field(..., description="Answer text")
    subject: str = Field(..., description="Subject")
    class_level: int = Field(..., ge=6, le=12, description="Class level")
    chapter: Optional[int] = Field(None, description="Chapter number")
    mode: Literal["quick", "deep"] = Field(..., description="Mode used")

class TrackQuestionResponse(BaseModel):
    """Response after tracking question."""
    success: bool = True
    message: str = "Question tracked successfully"
    question_id: Optional[str] = None

class UpdateFeedbackRequest(BaseModel):
    """Request to update feedback for a question-answer pair."""
    qa_id: str = Field(..., description="Question-answer pair ID")
    user_rating: Optional[int] = Field(None, ge=1, le=5, description="User rating")
    was_helpful: Optional[bool] = Field(None, description="Was answer helpful")
    time_spent_seconds: Optional[int] = Field(None, description="Time spent reading answer")

class UpdateFeedbackResponse(BaseModel):
    """Response after updating feedback."""
    success: bool = True
    message: str = "Feedback updated successfully"

class TrendingQuestionsRequest(BaseModel):
    """Request for trending questions (last 7 days)."""
    subject: str = Field(..., description="Subject name")
    class_level: int = Field(..., ge=6, le=12, description="Class level")
    mode: Literal["quick", "deep"] = Field("quick", description="Mode to filter by")
    limit: int = Field(5, ge=1, le=20, description="Number of questions")
    days: int = Field(7, ge=1, le=30, description="Number of days to look back")

class TrendingQuestionsResponse(BaseModel):
    """Response with trending questions."""
    success: bool = True
    trending: List[TopQuestionResponse]
    count: int
    days: int
