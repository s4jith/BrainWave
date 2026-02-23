"""
Test Router - Topic-based AI Tests and Staff Test management endpoints
Production-grade implementation with pre-generated question bank.

Key Features:
1. Topic-based test selection (Subject → Chapter → Topic)
2. Pre-generated questions from question bank (minimizes LLM calls)
3. Recommendations based on student weak areas
4. RAG-based answer evaluation
5. Real-time performance tracking
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime, timedelta
from app.db.mongo import mongodb
from app.services.topic_question_bank_service import topic_question_bank_service
from app.services.rag_evaluation_service import rag_evaluation_service
from bson import ObjectId
import logging
import os
import uuid

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/test",
    tags=["Tests"]
)

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads", "tests")
os.makedirs(UPLOAD_DIR, exist_ok=True)

class SubjectResponse(BaseModel):
    """Subject info for selection."""
    subject: str
    total_chapters: int
    total_questions: int

class ChapterInfo(BaseModel):
    """Chapter info with topics."""
    chapter_number: int
    chapter_name: str
    total_topics: int
    total_questions: int
    average_score: Optional[float] = None

class TopicInfo(BaseModel):
    """Topic info with student performance."""
    topic_id: str
    topic_name: str
    topic_description: Optional[str] = ""
    page_range: str
    total_questions: int
    difficulty_distribution: Dict = {}
    student_score: Optional[float] = None
    tests_taken: int = 0
    trend: str = "stable"
    is_weak: bool = False
    is_recommended: bool = False

class RecommendationItem(BaseModel):
    """Topic recommendation for student."""
    topic_id: str
    topic_name: str
    chapter: int
    chapter_name: Optional[str] = None
    score: Optional[float] = None
    is_new: bool = False
    reason: str = ""

class StartTestRequest(BaseModel):
    """Request to start a topic-based test."""
    student_id: str = Field(..., description="Student ID")
    class_level: int = Field(default=10, description="Class level")
    subject: str = Field(..., description="Subject name")
    chapter_number: int = Field(..., description="Chapter number")
    topic_id: str = Field(..., description="Topic ID")
    num_questions: int = Field(default=5, ge=1, le=15, description="Number of questions")
    difficulty: str = Field(default="mixed", description="easy/medium/hard/mixed")

class TestQuestionItem(BaseModel):
    """Question served in test."""
    question_number: int
    question_id: str
    question_text: str
    difficulty: str
    question_type: str
    marks: int
    time_estimate: int
    options: Optional[Dict[str, str]] = None
    correct_option: Optional[str] = None

class StartTestResponse(BaseModel):
    """Response after starting a test."""
    session_id: str
    topic_id: str
    topic_name: str
    questions: List[TestQuestionItem]
    total_questions: int
    time_limit_minutes: int
    started_at: str

class SubmitAnswerRequest(BaseModel):
    """Submit a single answer."""
    session_id: str
    question_id: str
    question_number: int
    answer: str

class CompleteTestRequest(BaseModel):
    """Complete test and get evaluation."""
    session_id: str
    student_id: str
    answers: List[SubmitAnswerRequest]

class EvaluationItem(BaseModel):
    """Single question evaluation."""
    question_id: str
    question_text: str
    student_answer: str
    is_correct: bool
    score: float
    max_score: float
    feedback: str
    correct_answer: str

class CompleteTestResponse(BaseModel):
    """Test completion response with evaluation."""
    session_id: str
    score: float
    total_questions: int
    correct_answers: int
    evaluations: List[EvaluationItem]
    feedback: str
    strengths: List[str]
    improvements: List[str]
    topics_to_review: List[str]
    topic_analytics: Optional[Dict] = None
    completed_at: str

class StaffTestItem(BaseModel):
    """Staff test response."""
    id: str
    subject: str
    chapter: int
    title: str
    description: Optional[str] = None
    due_date: Optional[str] = None
    max_score: int = 100
    question_paper_url: Optional[str] = None
    created_by: str = "Staff"
    created_at: str
    submission_status: Optional[str] = None
    score: Optional[int] = None

class StudentAnalytics(BaseModel):
    """Student analytics data."""
    total_tests_taken: int
    tests_this_week: int = 0
    overall_average: float
    best_score: float
    topics_strong: int
    topics_moderate: int
    topics_weak: int
    weak_topics: List[Dict]
    performance_history: List[Dict]
    topic_breakdown: List[Dict]
    recommendations: List[Dict]

@router.get("/subjects/{class_level}", response_model=List[SubjectResponse])
async def get_available_subjects(class_level: int):
    """
    Get all subjects available for a class level.
    This reads from the question bank to show only subjects with pre-generated questions.
    """
    try:
        subjects = await topic_question_bank_service.get_available_subjects(class_level)
        return [SubjectResponse(**s) for s in subjects]
    except Exception as e:
        logger.error(f"Error fetching subjects: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/chapters/{class_level}/{subject}", response_model=List[ChapterInfo])
async def get_chapters_for_subject(class_level: int, subject: str, student_id: Optional[str] = None):
    """
    Get all chapters for a subject with topic counts and optional student performance.
    """
    try:
        chapters = await topic_question_bank_service.get_chapters_for_subject(class_level, subject, student_id)
        return [ChapterInfo(
            chapter_number=ch["chapter_number"],
            chapter_name=ch["chapter_name"],
            total_topics=ch.get("total_topics", 0),
            total_questions=ch.get("total_questions", 0),
            average_score=ch.get("average_score")
        ) for ch in chapters]
    except Exception as e:
        logger.error(f"Error fetching chapters: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/topics/{class_level}/{subject}/{chapter}", response_model=List[TopicInfo])
async def get_topics_for_chapter(
    class_level: int,
    subject: str,
    chapter: int,
    student_id: Optional[str] = Query(None, description="Student ID for personalized recommendations")
):
    """
    Get all topics for a chapter with student performance data.
    Returns recommendations based on weak areas.
    """
    try:
        topics = await topic_question_bank_service.get_topics_for_chapter(
            class_level=class_level,
            subject=subject,
            chapter_number=chapter,
            student_id=student_id
        )
        return [TopicInfo(**t) for t in topics]
    except Exception as e:
        logger.error(f"Error fetching topics: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/recommendations/{class_level}/{subject}/{student_id}", response_model=List[RecommendationItem])
async def get_topic_recommendations(
    class_level: int,
    subject: str,
    student_id: str,
    limit: int = Query(default=5, ge=1, le=10)
):
    """
    Get personalized topic recommendations for a student.
    Based on weak areas and untested topics.
    """
    try:
        recommendations = await topic_question_bank_service.get_student_recommendations(
            student_id=student_id,
            class_level=class_level,
            subject=subject,
            limit=limit
        )
        
        result = []
        for rec in recommendations:
            if rec.get("is_new"):
                reason = "New topic - not yet attempted"
            elif rec.get("score", 100) < 40:
                reason = f"Needs urgent attention (Score: {rec.get('score', 0)}%)"
            elif rec.get("score", 100) < 60:
                reason = f"Room for improvement (Score: {rec.get('score', 0)}%)"
            else:
                reason = "Recommended for practice"
            
            result.append(RecommendationItem(
                topic_id=rec.get("topic_id", ""),
                topic_name=rec.get("topic_name", ""),
                chapter=rec.get("chapter", 0),
                chapter_name=rec.get("chapter_name"),
                score=rec.get("score"),
                is_new=rec.get("is_new", False),
                reason=reason
            ))
        
        return result
    except Exception as e:
        logger.error(f"Error fetching recommendations: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class StartChapterTestRequest(BaseModel):
    """Request for fixed-format chapter test (15Q, 20 marks, 40 min)."""
    student_id: str = Field(..., description="Student ID")
    class_level: int = Field(default=11, description="Class level")
    subject: str = Field(..., description="Subject name")
    chapter_number: int = Field(..., description="Chapter number")

class ChapterTestQuestion(BaseModel):
    """Question in chapter test with marks."""
    question_number: int
    question_id: str
    question_text: str
    difficulty: str
    question_type: str
    marks: int
    time_estimate: int
    options: Optional[Dict[str, str]] = None

class ChapterTestResponse(BaseModel):
    """Response for fixed-format chapter test."""
    session_id: str
    chapter_name: str
    questions: List[ChapterTestQuestion]
    total_questions: int
    total_marks: int
    time_limit_minutes: int
    mcq_count: int = 5
    fillup_count: int = 5
    two_mark_count: int = 5
    started_at: str
    is_first_time: bool = False

@router.post("/start-chapter", response_model=ChapterTestResponse)
async def start_chapter_test(request: StartChapterTestRequest):
    """
    Start fixed-format chapter test.
    
    Test Format:
    - 15 questions total (5 MCQ + 5 Fill-up + 5 Two-mark)
    - 20 marks total (5×1 + 5×1 + 5×2)
    - 40 minutes time limit
    - 3 variants stored to avoid repeat questions
    
    Flow:
    1. Check if question pool exists in MongoDB
    2. If not (first student), generate 3 variants of 15 questions each
    3. Select variant based on student's attempt count
    4. Create test session
    """
    try:
        is_first_time = False
        
        pool_status = await topic_question_bank_service.check_chapter_test_pool_exists(
            class_level=request.class_level,
            subject=request.subject,
            chapter_number=request.chapter_number
        )
        
        if not pool_status.get("exists"):
            logger.info(f" First student for {request.subject} Ch.{request.chapter_number} - Generating questions...")
            is_first_time = True
            
            gen_result = await topic_question_bank_service.generate_chapter_test_pool(
                class_level=request.class_level,
                subject=request.subject,
                chapter_number=request.chapter_number
            )
            
            if gen_result.get("status") == "error":
                raise HTTPException(
                    status_code=500, 
                    detail=f"Failed to generate questions: {gen_result.get('error')}"
                )
        
        selection = await topic_question_bank_service.select_chapter_test_questions(
            class_level=request.class_level,
            subject=request.subject,
            chapter_number=request.chapter_number,
            student_id=request.student_id
        )
        
        if selection.get("status") != "success":
            raise HTTPException(
                status_code=500, 
                detail=f"Failed to select questions: {selection.get('error')}"
            )
        
        questions = selection["questions"]
        chapter_name = selection["chapter_name"]
        
        session_id = str(uuid.uuid4())
        
        session_doc = {
            "session_id": session_id,
            "student_id": request.student_id,
            "class_level": request.class_level,
            "subject": request.subject,
            "chapter_number": request.chapter_number,
            "chapter_name": chapter_name,
            "test_type": "chapter_test",
            "num_questions": len(questions),
            "total_marks": 20,
            "mcq_count": selection.get("mcq_count", 5),
            "fillup_count": selection.get("fillup_count", 5),
            "two_mark_count": selection.get("two_mark_count", 5),
            "time_limit_minutes": 40,
            "questions_served": questions,
            "answers": [],
            "status": "started",
            "started_at": datetime.utcnow(),
            "is_first_time": is_first_time
        }
        
        await mongodb.db.test_sessions.insert_one(session_doc)
        
        response_questions = [
            ChapterTestQuestion(
                question_number=q["question_number"],
                question_id=q["question_id"],
                question_text=q["question_text"],
                difficulty=q["difficulty"],
                question_type=q["question_type"],
                marks=q["marks"],
                time_estimate=q["time_estimate"],
                options=q.get("options") if q["question_type"] == "mcq" else None
            )
            for q in questions
        ]
        
        logger.info(f"Started chapter test: {session_id} ({len(questions)} questions)")
        
        return ChapterTestResponse(
            session_id=session_id,
            chapter_name=chapter_name,
            questions=response_questions,
            total_questions=len(questions),
            total_marks=20,
            time_limit_minutes=40,
            mcq_count=selection.get("mcq_count", 5),
            fillup_count=selection.get("fillup_count", 5),
            two_mark_count=selection.get("two_mark_count", 5),
            started_at=session_doc["started_at"].isoformat(),
            is_first_time=is_first_time
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting chapter test: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class GenerateQuestionsRequest(BaseModel):
    """Request to generate questions for a chapter."""
    class_level: int = Field(default=10, description="Class level")
    subject: str = Field(..., description="Subject name")
    chapter_number: int = Field(..., description="Chapter number to generate questions for")
    num_questions: int = Field(default=15, ge=5, le=50, description="Number of questions to generate")
    include_variations: bool = Field(default=True, description="Generate question variations")

class GenerateQuestionsResponse(BaseModel):
    """Response after generating questions."""
    status: str
    chapter_name: str
    total_questions: int
    difficulty_distribution: Dict
    generated_at: Optional[str] = None
    error: Optional[str] = None

@router.post("/generate-questions", response_model=GenerateQuestionsResponse)
async def generate_questions_on_demand(request: GenerateQuestionsRequest):
    """
    Generate questions for a chapter on-demand.
    
    - First checks MongoDB cache for existing questions
    - If not found, retrieves content from Pinecone and generates questions
    - Stores generated questions for future students
    - Generates variations with validated different values for numerical problems
    """
    try:
        result = await topic_question_bank_service.generate_questions_on_demand(
            class_level=request.class_level,
            subject=request.subject,
            chapter_number=request.chapter_number,
            num_questions=request.num_questions,
            include_variations=request.include_variations
        )
        
        return GenerateQuestionsResponse(
            status=result.get("status", "unknown"),
            chapter_name=result.get("chapter_name", f"Chapter {request.chapter_number}"),
            total_questions=result.get("total_questions", 0),
            difficulty_distribution=result.get("difficulty_distribution", {}),
            generated_at=result.get("generated_at"),
            error=result.get("error")
        )
        
    except Exception as e:
        logger.error(f"Error generating questions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/check-questions/{class_level}/{subject}/{chapter_number}")
async def check_questions_available(
    class_level: int,
    subject: str,
    chapter_number: int
):
    """
    Check if questions are already generated and cached for a chapter.
    Use this before starting a test to know if generation is needed.
    """
    try:
        result = await topic_question_bank_service.check_questions_available(
            class_level=class_level,
            subject=subject,
            chapter_number=chapter_number
        )
        return result
    except Exception as e:
        logger.error(f"Error checking questions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class StartTestRequestV2(BaseModel):
    """Request to start a test with optional auto-generation."""
    student_id: str = Field(..., description="Student ID")
    class_level: int = Field(default=10, description="Class level")
    subject: str = Field(..., description="Subject name")
    selection_type: str = Field(default="chapter", description="chapter or topic")
    chapter_number: int = Field(..., description="Chapter number")
    topic_id: Optional[str] = Field(None, description="Topic ID (optional for chapter-level tests)")
    num_questions: int = Field(default=10, ge=1, le=20, description="Number of questions")
    difficulty: str = Field(default="mixed", description="easy/medium/hard/mixed")
    auto_generate: bool = Field(default=True, description="Auto-generate questions if not available")

class StartTestResponseV2(BaseModel):
    """Response after starting a test."""
    session_id: str
    chapter_name: str
    questions: List[TestQuestionItem]
    total_questions: int
    time_limit_minutes: int
    started_at: str
    question_source: str

@router.post("/start-v2", response_model=StartTestResponseV2)
async def start_test_v2(request: StartTestRequestV2):
    """
    Start a test with on-demand question generation.
    
    Flow:
    1. Check if questions exist in cache
    2. If not and auto_generate=True, generate questions first
    3. Select questions based on difficulty and count
    4. Create test session and return questions
    """
    try:
        question_source = "cached"
        
        availability = await topic_question_bank_service.check_questions_available(
            class_level=request.class_level,
            subject=request.subject,
            chapter_number=request.chapter_number
        )
        
        if not availability.get("available") and request.auto_generate:
            logger.info(f"Questions not available, generating for {request.subject} Ch.{request.chapter_number}")
            
            gen_result = await topic_question_bank_service.generate_questions_on_demand(
                class_level=request.class_level,
                subject=request.subject,
                chapter_number=request.chapter_number,
                num_questions=20,
                include_variations=True
            )
            
            if gen_result.get("status") in ["error", "generation_failed", "no_content"]:
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to generate questions: {gen_result.get('error', 'Unknown error')}"
                )
            
            question_source = "generated"
        
        elif not availability.get("available"):
            raise HTTPException(
                status_code=404,
                detail="No questions available for this chapter. Please enable auto_generate."
            )
        
        questions = await topic_question_bank_service.get_cached_questions(
            class_level=request.class_level,
            subject=request.subject,
            chapter_number=request.chapter_number,
            difficulty=request.difficulty,
            num_questions=request.num_questions
        )
        
        if not questions:
            raise HTTPException(
                status_code=404,
                detail="No questions found after generation. Please try again."
            )
        
        session_id = str(uuid.uuid4())
        
        formatted_questions = []
        for i, q in enumerate(questions):
            formatted_questions.append({
                "question_number": i + 1,
                "question_id": q.get("question_id", f"q_{i}"),
                "question_text": q.get("question_text", ""),
                "difficulty": q.get("difficulty", "medium"),
                "question_type": q.get("question_type", "conceptual"),
                "marks": q.get("marks", 5),
                "time_estimate": q.get("time_estimate_seconds", 60),
                "expected_answer": q.get("expected_answer", ""),
                "solution_steps": q.get("solution_steps", ""),
                "is_variation": q.get("is_variation", False)
            })
        
        chapter_name = questions[0].get("chapter_name", f"Chapter {request.chapter_number}") if questions else f"Chapter {request.chapter_number}"
        
        session_doc = {
            "session_id": session_id,
            "student_id": request.student_id,
            "class_level": request.class_level,
            "subject": request.subject,
            "chapter_number": request.chapter_number,
            "chapter_name": chapter_name,
            "selection_type": request.selection_type,
            "topic_id": request.topic_id,
            "num_questions": len(formatted_questions),
            "difficulty": request.difficulty,
            "questions_served": formatted_questions,
            "answers": [],
            "status": "started",
            "started_at": datetime.utcnow(),
            "time_limit_minutes": max(10, len(formatted_questions) * 2),
            "question_source": question_source
        }
        
        await mongodb.db.test_sessions.insert_one(session_doc)
        
        response_questions = [
            TestQuestionItem(
                question_number=q["question_number"],
                question_id=q["question_id"],
                question_text=q["question_text"],
                difficulty=q["difficulty"],
                question_type=q["question_type"],
                marks=q["marks"],
                time_estimate=q["time_estimate"]
            )
            for q in formatted_questions
        ]
        
        logger.info(f"Started test session {session_id} with {len(formatted_questions)} questions ({question_source})")
        
        return StartTestResponseV2(
            session_id=session_id,
            chapter_name=chapter_name,
            questions=response_questions,
            total_questions=len(formatted_questions),
            time_limit_minutes=session_doc["time_limit_minutes"],
            started_at=session_doc["started_at"].isoformat(),
            question_source=question_source
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting test: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/start", response_model=StartTestResponse)
async def start_test(request: StartTestRequest):
    """
    Start a topic-based test.
    Fetches pre-generated questions from the question bank (NO Gemini call).
    """
    try:
        questions, topic_name = await topic_question_bank_service.get_questions_for_test(
            class_level=request.class_level,
            subject=request.subject,
            chapter_number=request.chapter_number,
            topic_id=request.topic_id,
            num_questions=request.num_questions,
            difficulty=request.difficulty
        )
        
        if not questions:
            raise HTTPException(
                status_code=404,
                detail="No questions found for this topic. Please try another topic."
            )
        
        session_id = str(uuid.uuid4())
        session_doc = {
            "session_id": session_id,
            "student_id": request.student_id,
            "class_level": request.class_level,
            "subject": request.subject,
            "chapter_number": request.chapter_number,
            "topic_id": request.topic_id,
            "topic_name": topic_name,
            "num_questions": len(questions),
            "difficulty": request.difficulty,
            "questions_served": questions,
            "answers": [],
            "status": "started",
            "started_at": datetime.utcnow(),
            "time_limit_minutes": max(10, len(questions) * 2)
        }
        
        await mongodb.db.test_sessions.insert_one(session_doc)
        
        formatted_questions = [
            TestQuestionItem(
                question_number=q["question_number"],
                question_id=q["question_id"],
                question_text=q["question_text"],
                difficulty=q["difficulty"],
                question_type=q["question_type"],
                marks=q["marks"],
                time_estimate=q["time_estimate"]
            )
            for q in questions
        ]
        
        logger.info(f"Started test session {session_id} with {len(questions)} questions")
        
        return StartTestResponse(
            session_id=session_id,
            topic_id=request.topic_id,
            topic_name=topic_name,
            questions=formatted_questions,
            total_questions=len(questions),
            time_limit_minutes=session_doc["time_limit_minutes"],
            started_at=session_doc["started_at"].isoformat()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting test: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class StartTestRequestV2(StartTestRequest):
    """Request for V2 test start with on-demand generation."""
    auto_generate: bool = Field(default=True, description="Auto-generate questions if not found")
    total_marks: Optional[int] = Field(default=25, description="Total marks for the test")

class StartTestResponseV2(StartTestResponse):
    """Response for V2 test start."""
    question_source: str = Field(..., description="cached/generated/bank")

@router.post("/start-v3", response_model=Dict)
async def start_test_v2(request: StartTestRequestV2):
    """
    Start a test with on-demand question generation support.
    If questions are not in the bank, it generates them using Gemini.
    """
    logger.info(f"📝 Received start-v2 request: {request.model_dump()}")
    try:
        result = await topic_question_bank_service.generate_questions_on_demand(
            class_level=request.class_level,
            subject=request.subject,
            chapter_number=request.chapter_number,
            num_questions=request.num_questions,
            include_variations=True
        )
        
        if result["status"] == "error":
            raise HTTPException(status_code=500, detail=result["error"])
            
        if result["status"] == "no_content":
             raise HTTPException(status_code=404, detail="No content found for this chapter")
             
        questions = result["questions"]
        question_source = result["status"]
        
        session_id = str(uuid.uuid4())
        time_limit_minutes = 45
        if request.total_marks == 100:
            time_limit_minutes = 180
        elif request.total_marks == 50:
            time_limit_minutes = 90
            
        session_doc = {
            "session_id": session_id,
            "student_id": request.student_id,
            "class_level": request.class_level,
            "subject": request.subject,
            "chapter_number": request.chapter_number,
            "topic_id": request.topic_id,
            "topic_name": result.get("chapter_name", f"Chapter {request.chapter_number}"),
            "num_questions": len(questions),
            "difficulty": request.difficulty,
            "questions_served": questions,
            "answers": [],
            "status": "started",
            "started_at": datetime.utcnow(),
            "time_limit_minutes": time_limit_minutes,
            "total_marks": request.total_marks,
            "question_source": question_source
        }
        
        await mongodb.db.test_sessions.insert_one(session_doc)
        
        formatted_questions = [
            TestQuestionItem(
                question_number=i+1,
                question_id=q.get("question_id", str(uuid.uuid4())),
                question_text=q["question_text"],
                difficulty=q.get("difficulty", "medium"),
                question_type=q.get("question_type", "conceptual"),
                marks=q.get("marks", 5),
                time_estimate=q.get("time_estimate_seconds", 60)
            )
            for i, q in enumerate(questions)
        ]
        
        logger.info(f"Started V2 test session {session_id} with {len(questions)} questions ({question_source})")
        
        response_data = {
            "session_id": session_id,
            "topic_id": request.topic_id,
            "topic_name": session_doc["topic_name"],
            "questions": formatted_questions,
            "total_questions": len(questions),
            "time_limit_minutes": session_doc["time_limit_minutes"],
            "started_at": session_doc["started_at"].isoformat(),
            "question_source": question_source
        }
        logger.info(f"📦 Response Data Keys: {list(response_data.keys())}")
        logger.info(f"📦 Topic ID: {response_data.get('topic_id')}")
        logger.info(f"📦 Topic Name: {response_data.get('topic_name')}")
        
        return response_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting V2 test: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class StartAITestRequest(BaseModel):
    """Request to start an AI test with topic-level analytics."""
    student_id: str = Field(..., description="Student ID")
    class_level: int = Field(default=10, description="Class level")
    subject: str = Field(..., description="Subject name")
    chapter_number: int = Field(..., description="Chapter number")
    difficulty: str = Field(default="medium", description="Difficulty level (easy, medium, hard)")
    num_questions: int = Field(default=15, ge=5, le=20, description="Number of questions")

class StartAITestResponse(BaseModel):
    """Response after starting an AI test."""
    session_id: str
    chapter_name: str
    questions: List[TestQuestionItem]
    total_questions: int
    total_marks: int = 20
    mcq_count: int = 5
    fillup_count: int = 5
    short_answer_count: int = 5
    time_limit_minutes: int
    started_at: str
    topics_covered: List[Dict]

@router.post("/ai-test/start", response_model=StartAITestResponse)
async def start_ai_test_with_topics(request: StartAITestRequest):
    """
    Start an AI test with topic-level analytics support.
    
    Uses pre-generated chapter test pool (10 variants per difficulty) for efficiency:
    1. Check if question pool exists for this chapter
    2. If not, generate 10 variants per difficulty (2 batches of 5 each = 30 variants total)
    3. Select variant based on student's chosen difficulty and attempt count
    4. Add topic tagging for topic-level analytics
    5. After completion, evaluation provides topic-level performance breakdown
    """
    try:
        difficulty = request.difficulty.lower() if request.difficulty else "medium"
        if difficulty not in ["easy", "medium", "hard"]:
            difficulty = "medium"
        
        logger.info(f"📝 Starting AI test for {request.subject} Ch.{request.chapter_number} (Difficulty: {difficulty})")
        
        pool_status = await topic_question_bank_service.check_chapter_test_pool_exists(
            class_level=request.class_level,
            subject=request.subject,
            chapter_number=request.chapter_number
        )
        
        if not pool_status.get("exists"):
            logger.info(f" First test for {request.subject} Ch.{request.chapter_number} - Generating variants for all difficulties...")
            gen_result = await topic_question_bank_service.generate_chapter_test_pool(
                class_level=request.class_level,
                subject=request.subject,
                chapter_number=request.chapter_number
            )
            if gen_result.get("status") == "error":
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to generate questions: {gen_result.get('error')}"
                )
        else:
            logger.info(f"✅ Question pool already exists for {request.subject} Ch.{request.chapter_number} - Using cached questions")
        
        selection = await topic_question_bank_service.select_chapter_test_questions(
            class_level=request.class_level,
            subject=request.subject,
            chapter_number=request.chapter_number,
            student_id=request.student_id,
            difficulty=difficulty
        )
        
        if selection.get("status") != "success":
            raise HTTPException(
                status_code=500,
                detail=f"Failed to select questions: {selection.get('error')}"
            )
        
        questions = selection["questions"]
        chapter_name = selection["chapter_name"]
        
        if not questions:
            raise HTTPException(
                status_code=404,
                detail="No questions available for this chapter"
            )
        
        unique_topics = {}
        for q in questions:
            topic = q.get("topic", chapter_name)
            if topic:
                topic_id = topic.lower().replace(" ", "_").replace(":", "").replace("'", "")[:50]
                q["topic_id"] = topic_id
                q["topic_name"] = topic
                if topic_id not in unique_topics:
                    unique_topics[topic_id] = topic
        
        topics_covered = [{"topic_id": tid, "topic_name": tname} for tid, tname in unique_topics.items()]
        
        session_id = str(uuid.uuid4())
        time_limit_minutes = 40
        
        mcq_count = selection.get("mcq_count", 5)
        fillup_count = selection.get("fillup_count", 5)
        short_count = selection.get("two_mark_count", 5)
        total_marks = selection.get("total_marks", 20)
        
        session_doc = {
            "session_id": session_id,
            "student_id": request.student_id,
            "class_level": request.class_level,
            "subject": request.subject,
            "chapter_number": request.chapter_number,
            "chapter_name": chapter_name,
            "difficulty": difficulty,
            "test_type": "ai_with_topics",
            "num_questions": len(questions),
            "total_marks": total_marks,
            "questions_served": questions,
            "topics_covered": topics_covered,
            "answers": [],
            "status": "started",
            "started_at": datetime.utcnow(),
            "time_limit_minutes": time_limit_minutes
        }
        
        await mongodb.db.test_sessions.insert_one(session_doc)
        
        response_questions = [
            TestQuestionItem(
                question_number=q.get("question_number", i + 1),
                question_id=q.get("question_id", f"q_{i}"),
                question_text=q.get("question_text", ""),
                difficulty=q.get("difficulty", "medium"),
                question_type=q.get("question_type", "short_answer"),
                marks=q.get("marks", 1),
                time_estimate=q.get("time_estimate", 90),
                options=q.get("options") if q.get("question_type") == "mcq" else None,
                correct_option=None
            )
            for i, q in enumerate(questions)
        ]
        
        logger.info(f"Started AI test {session_id} with {len(questions)} questions ({mcq_count} MCQ, {fillup_count} Fill-up, {short_count} Short Answer)")
        
        return StartAITestResponse(
            session_id=session_id,
            chapter_name=chapter_name,
            questions=response_questions,
            total_questions=len(questions),
            total_marks=total_marks,
            mcq_count=mcq_count,
            fillup_count=fillup_count,
            short_answer_count=short_count,
            time_limit_minutes=time_limit_minutes,
            started_at=session_doc["started_at"].isoformat(),
            topics_covered=topics_covered
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting AI test: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class StartQBTestRequest(BaseModel):
    """Request to start a Question Bank test."""
    student_id: str = Field(..., description="Student ID")
    class_level: int = Field(default=10, description="Class level")
    subject: str = Field(..., description="Subject name")
    chapter: int = Field(..., description="Chapter number")
    difficulty: str = Field(default="medium", description="Difficulty level (easy, medium, hard)")
    mcq_count: int = Field(default=0, ge=0, le=50, description="Number of MCQ questions")
    fillup_count: int = Field(default=0, ge=0, le=50, description="Number of fill-up questions")
    true_false_count: int = Field(default=0, ge=0, le=50, description="Number of true/false questions")
    short_answer_count: int = Field(default=0, ge=0, le=50, description="Number of 2-mark questions")
    long_answer_count: int = Field(default=0, ge=0, le=50, description="Number of 5-mark questions")
    time_limit_minutes: Optional[int] = Field(default=None, ge=1, le=300, description="Optional timer in minutes (null = no timer)")

@router.get("/qb-test/subjects/{class_level}")
async def get_qb_subjects(class_level: int):
    """
    Get distinct subjects from the approved question bank for a class level.
    Only returns subjects that have approved questions.
    """
    try:
        pipeline = [
            {"$match": {"class_level": class_level, "status": "approved"}},
            {"$group": {
                "_id": "$subject",
                "total_questions": {"$sum": 1}
            }},
            {"$project": {
                "subject": "$_id",
                "total_questions": 1,
                "_id": 0
            }},
            {"$sort": {"subject": 1}}
        ]
        results = await mongodb.db.questions.aggregate(pipeline).to_list(100)
        return results
    except Exception as e:
        logger.error(f"Error fetching QB subjects: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/qb-test/chapters/{class_level}/{subject}")
async def get_qb_chapters(class_level: int, subject: str):
    """
    Get chapters with per-type approved question counts for a subject.
    Returns chapter number, chapter name, and count of each question type.
    """
    try:
        pipeline = [
            {
                "$match": {
                    "class_level": class_level,
                    "subject": {"$regex": f"^{subject}$", "$options": "i"},
                    "status": "approved"
                }
            },
            {
                "$group": {
                    "_id": {"chapter": "$chapter", "type": "$type", "difficulty": "$difficulty"},
                    "count": {"$sum": 1},
                    "chapter_name": {"$first": "$chapter_name"}
                }
            },
            {
                "$group": {
                    "_id": "$_id.chapter",
                    "chapter_name": {"$first": "$chapter_name"},
                    "type_difficulty_counts": {
                        "$push": {
                            "type": "$_id.type",
                            "difficulty": "$_id.difficulty",
                            "count": "$count"
                        }
                    },
                    "total_questions": {"$sum": "$count"}
                }
            },
            {"$sort": {"_id": 1}}
        ]
        results = await mongodb.db.questions.aggregate(pipeline).to_list(100)

        chapters = []
        for r in results:
            counts = {
                "mcq": 0, "fillup": 0, "true_false": 0, "short_answer": 0, "long_answer": 0,
                "mcq_easy": 0, "mcq_medium": 0, "mcq_hard": 0,
                "fillup_easy": 0, "fillup_medium": 0, "fillup_hard": 0,
                "true_false_easy": 0, "true_false_medium": 0, "true_false_hard": 0,
                "short_answer_easy": 0, "short_answer_medium": 0, "short_answer_hard": 0,
                "long_answer_easy": 0, "long_answer_medium": 0, "long_answer_hard": 0,
            }

            for item in r.get("type_difficulty_counts", []):
                q_type = item.get("type")
                difficulty = item.get("difficulty", "medium").lower()
                count = item.get("count", 0)

                if q_type in ["mcq", "fillup", "true_false", "short_answer", "long_answer"]:
                    counts[q_type] += count
                    key = f"{q_type}_{difficulty}"
                    if key in counts:
                        counts[key] += count

            chapters.append({
                "chapter": r["_id"],
                "chapter_name": r.get("chapter_name") or f"Chapter {r['_id']}",
                "total_questions": r.get("total_questions", 0),
                "mcq_count": counts["mcq"],
                "fillup_count": counts["fillup"],
                "true_false_count": counts["true_false"],
                "short_answer_count": counts["short_answer"],
                "long_answer_count": counts["long_answer"],
                "mcq_easy": counts["mcq_easy"],
                "mcq_medium": counts["mcq_medium"],
                "mcq_hard": counts["mcq_hard"],
                "fillup_easy": counts["fillup_easy"],
                "fillup_medium": counts["fillup_medium"],
                "fillup_hard": counts["fillup_hard"],
                "true_false_easy": counts["true_false_easy"],
                "true_false_medium": counts["true_false_medium"],
                "true_false_hard": counts["true_false_hard"],
                "short_answer_easy": counts["short_answer_easy"],
                "short_answer_medium": counts["short_answer_medium"],
                "short_answer_hard": counts["short_answer_hard"],
                "long_answer_easy": counts["long_answer_easy"],
                "long_answer_medium": counts["long_answer_medium"],
                "long_answer_hard": counts["long_answer_hard"],
            })

        return chapters
    except Exception as e:
        logger.error(f"Error fetching QB chapters: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/qb-test/start")
async def start_qb_test(request: StartQBTestRequest):
    """
    Start a Question Bank test by pulling approved questions from the questions collection.
    
    - Only approved questions are used (pending/rejected are excluded)
    - Students configure how many of each type they want
    - Optional timer support (null = no time limit)
    - If not enough questions, creates a partial test with a note
    """
    import random

    total_requested = request.mcq_count + request.fillup_count + request.true_false_count + request.short_answer_count + request.long_answer_count
    if total_requested == 0:
        raise HTTPException(status_code=400, detail="Please select at least one question")

    try:
        base_query = {
            "class_level": request.class_level,
            "subject": {"$regex": f"^{request.subject}$", "$options": "i"},
            "chapter": {"$in": [request.chapter, str(request.chapter)]},
            "status": "approved"
        }

        if request.difficulty and request.difficulty.lower() not in ("mixed", "all"):
            base_query["difficulty"] = {"$regex": f"^{request.difficulty}$", "$options": "i"}

        all_questions = []
        notes = []

        type_configs = [
            ("mcq", request.mcq_count, 1),
            ("fillup", request.fillup_count, 1),
            ("true_false", request.true_false_count, 1),
            ("short_answer", request.short_answer_count, 2),
            ("long_answer", request.long_answer_count, 5),
        ]

        for q_type, requested_count, marks in type_configs:
            if requested_count <= 0:
                continue

            query = {**base_query, "type": q_type}
            cursor = mongodb.db.questions.find(query)
            available = await cursor.to_list(500)

            if len(available) < requested_count:
                notes.append(f"Requested {requested_count} {q_type} questions but only {len(available)} available")
                selected = available
            else:
                selected = random.sample(available, requested_count)

            for i, q in enumerate(selected):
                question_data = {
                    "question_number": 0,
                    "question_id": str(q["_id"]),
                    "question_text": q.get("text", ""),
                    "difficulty": q.get("difficulty", "medium"),
                    "question_type": q_type,
                    "marks": q.get("marks", marks),
                    "time_estimate": marks * 60,
                    "expected_answer": q.get("correct_answer", ""),
                    "correct_option": q.get("correct_answer", "") if q_type == "mcq" else None,
                    "options": q.get("options", {}),
                    "topic": q.get("topic", ""),
                    "topic_name": q.get("topic", ""),
                    "chapter_name": q.get("chapter_name", f"Chapter {request.chapter}"),
                    "keywords": []
                }
                if q_type == "true_false":
                    question_data["options"] = {"A": "True", "B": "False"}
                    correct = q.get("correct_answer", "").strip().lower()
                    question_data["correct_option"] = "A" if correct in ("true", "a") else "B"
                all_questions.append(question_data)

        if not all_questions:
            raise HTTPException(
                status_code=404,
                detail="No approved questions found for this configuration. The question bank may need more questions for this chapter and difficulty."
            )

        for i, q in enumerate(all_questions):
            q["question_number"] = i + 1

        for q in all_questions:
            if q["question_type"] == "mcq" and isinstance(q.get("options"), list):
                options_list = q["options"]
                q["options"] = {chr(65 + j): opt for j, opt in enumerate(options_list)}

        total_marks = sum(q["marks"] for q in all_questions)
        chapter_name = all_questions[0].get("chapter_name", f"Chapter {request.chapter}")

        session_id = str(uuid.uuid4())
        session_doc = {
            "session_id": session_id,
            "student_id": request.student_id,
            "class_level": request.class_level,
            "subject": request.subject,
            "chapter_number": request.chapter,
            "chapter_name": chapter_name,
            "difficulty": request.difficulty,
            "test_type": "qb_test",
            "num_questions": len(all_questions),
            "total_marks": total_marks,
            "questions_served": all_questions,
            "answers": [],
            "status": "started",
            "started_at": datetime.utcnow(),
            "time_limit_minutes": request.time_limit_minutes,
            "topic_name": chapter_name,
            "topic_id": f"ch_{request.chapter}"
        }

        await mongodb.db.test_sessions.insert_one(session_doc)

        response_questions = [
            {
                "question_number": q["question_number"],
                "question_id": q["question_id"],
                "question_text": q["question_text"],
                "difficulty": q["difficulty"],
                "question_type": q["question_type"],
                "marks": q["marks"],
                "time_estimate": q["time_estimate"],
                "options": q.get("options") if q["question_type"] in ("mcq", "true_false") else None
            }
            for q in all_questions
        ]

        logger.info(f"Started QB test {session_id}: {len(all_questions)} questions, {total_marks} marks, timer={request.time_limit_minutes}")

        response = {
            "session_id": session_id,
            "chapter_name": chapter_name,
            "questions": response_questions,
            "total_questions": len(all_questions),
            "total_marks": total_marks,
            "time_limit": request.time_limit_minutes,
            "time_limit_minutes": request.time_limit_minutes,
            "started_at": session_doc["started_at"].isoformat(),
            "notes": notes
        }

        if notes:
            response["note"] = " | ".join(notes)

        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting QB test: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/answer")
async def submit_answer(request: SubmitAnswerRequest):
    """
    Submit a single answer during test.
    Stores answer for later evaluation.
    """
    try:
        result = await mongodb.db.test_sessions.update_one(
            {"session_id": request.session_id},
            {
                "$push": {
                    "answers": {
                        "question_id": request.question_id,
                        "question_number": request.question_number,
                        "answer": request.answer,
                        "submitted_at": datetime.utcnow().isoformat()
                    }
                },
                "$set": {"status": "in_progress"}
            }
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Session not found")
        
        return {"status": "success", "message": "Answer recorded"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error submitting answer: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/complete")
async def complete_test(request: CompleteTestRequest):
    """
    Submit a completed test for evaluation.
    Handles both legacy "ai_test" and new "qb_test".
    """
    logger.info(f"Completing test session: {request.session_id}")
    try:
        session = await mongodb.db.test_sessions.find_one({"session_id": request.session_id})
        if not session:
            logger.error(f"Session not found: {request.session_id}")
            raise HTTPException(status_code=404, detail="Test session not found")

        await mongodb.db.test_sessions.update_one(
            {"session_id": request.session_id},
            {
                "$set": {
                    "answers": [a.dict() for a in request.answers],
                    "end_time": datetime.utcnow(),
                    "status": "completed"
                }
            }
        )
        
        logger.info(f"Triggering evaluation for session {request.session_id}, type: {session.get('test_type')}")
        updated_session = await mongodb.db.test_sessions.find_one({"session_id": request.session_id})
        
        evaluation_result = await rag_evaluation_service.evaluate_test_session(updated_session)
        logger.info(f"Evaluation completed for {request.session_id}")

        return evaluation_result

    except Exception as e:
        logger.error(f"Error completing test {request.session_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/staff-tests", response_model=List[StaffTestItem])
async def get_staff_tests(
    subject: Optional[str] = Query(None),
    chapter: Optional[int] = Query(None),
    student_id: Optional[str] = Query(None)
):
    """Get available staff tests with optional filtering."""
    try:
        query = {}
        if subject:
            query["subject"] = {"$regex": subject, "$options": "i"}
        if chapter:
            query["chapter"] = chapter
        
        tests = await mongodb.db.staff_tests.find(query).to_list(100)
        
        submissions = {}
        if student_id:
            student_submissions = await mongodb.db.test_submissions.find(
                {"student_id": student_id}
            ).to_list(1000)
            for sub in student_submissions:
                test_id = sub.get("test_id")
                submissions[test_id] = {
                    "status": sub.get("status", "pending"),
                    "score": sub.get("score")
                }
        
        response = []
        for test in tests:
            test_id = str(test["_id"])
            submission = submissions.get(test_id, {})
            response.append(StaffTestItem(
                id=test_id,
                subject=test.get("subject", ""),
                chapter=test.get("chapter", 1),
                title=test.get("title", ""),
                description=test.get("description"),
                due_date=test.get("due_date"),
                max_score=test.get("max_score", 100),
                question_paper_url=f"/api/test/staff-tests/{test_id}/download",
                created_by=test.get("created_by", "Staff"),
                created_at=test.get("created_at", datetime.now().isoformat()),
                submission_status=submission.get("status"),
                score=submission.get("score")
            ))
        
        return response
    except Exception as e:
        logger.error(f"Error fetching staff tests: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/staff-tests")
async def create_staff_test(
    subject: str = Form(...),
    chapter: int = Form(...),
    class_level: int = Form(10),
    title: str = Form(...),
    description: Optional[str] = Form(None),
    due_date: Optional[str] = Form(None),
    max_score: int = Form(100),
    created_by: str = Form("Staff"),
    question_paper: UploadFile = File(...)
):
    """Create a new staff test with question paper upload."""
    try:
        if not question_paper.filename.endswith('.pdf'):
            raise HTTPException(status_code=400, detail="Only PDF files are allowed")
        
        file_id = str(uuid.uuid4())
        filename = f"{file_id}_{question_paper.filename}"
        file_path = os.path.join(UPLOAD_DIR, filename)
        
        content = await question_paper.read()
        with open(file_path, "wb") as f:
            f.write(content)
        
        test_doc = {
            "subject": subject,
            "chapter": chapter,
            "class_level": class_level,
            "title": title,
            "description": description,
            "due_date": due_date,
            "max_score": max_score,
            "created_by": created_by,
            "question_paper_filename": filename,
            "question_paper_path": file_path,
            "created_at": datetime.now().isoformat()
        }
        
        result = await mongodb.db.staff_tests.insert_one(test_doc)
        
        return {
            "id": str(result.inserted_id),
            "title": title,
            "message": "Staff test created successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating staff test: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/staff-tests/{test_id}/download")
async def download_question_paper(test_id: str):
    """Download question paper PDF."""
    try:
        test = await mongodb.db.staff_tests.find_one({"_id": ObjectId(test_id)})
        if not test:
            raise HTTPException(status_code=404, detail="Test not found")
        
        file_path = test.get("question_paper_path")
        if not file_path or not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Question paper not found")
        
        return FileResponse(
            file_path,
            media_type="application/pdf",
            filename=test.get("question_paper_filename", "question_paper.pdf")
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading question paper: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/staff-tests/{test_id}/submit")
async def submit_answer_sheet(
    test_id: str,
    student_id: str = Form(...),
    answer_sheet: UploadFile = File(...)
):
    """Submit answer sheet for a staff test."""
    try:
        test = await mongodb.db.staff_tests.find_one({"_id": ObjectId(test_id)})
        if not test:
            raise HTTPException(status_code=404, detail="Test not found")
        
        if not answer_sheet.filename.endswith('.pdf'):
            raise HTTPException(status_code=400, detail="Only PDF files are allowed")
        
        existing = await mongodb.db.test_submissions.find_one({
            "test_id": test_id,
            "student_id": student_id
        })
        
        file_id = str(uuid.uuid4())
        filename = f"answer_{file_id}_{answer_sheet.filename}"
        file_path = os.path.join(UPLOAD_DIR, filename)
        
        content = await answer_sheet.read()
        with open(file_path, "wb") as f:
            f.write(content)
        
        if existing:
            await mongodb.db.test_submissions.update_one(
                {"_id": existing["_id"]},
                {"$set": {
                    "answer_sheet_filename": filename,
                    "answer_sheet_path": file_path,
                    "status": "submitted",
                    "submitted_at": datetime.now().isoformat()
                }}
            )
            submission_id = str(existing["_id"])
        else:
            submission_doc = {
                "test_id": test_id,
                "student_id": student_id,
                "answer_sheet_filename": filename,
                "answer_sheet_path": file_path,
                "status": "submitted",
                "submitted_at": datetime.now().isoformat()
            }
            result = await mongodb.db.test_submissions.insert_one(submission_doc)
            submission_id = str(result.inserted_id)
        
        return {
            "submission_id": submission_id,
            "status": "submitted",
            "message": "Answer sheet submitted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error submitting answer sheet: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/analytics/{student_id}", response_model=StudentAnalytics)
async def get_student_analytics(
    student_id: str,
    class_level: int = Query(default=10),
    subject: Optional[str] = Query(None)
):
    """Get comprehensive test analytics for a student."""
    try:
        student_login_id = student_id
        try:
            user_doc = await mongodb.db.users.find_one({"_id": ObjectId(student_id)})
            if user_doc:
                student_login_id = user_doc.get("user_id", student_id)
        except Exception:
            user_doc = await mongodb.db.users.find_one({"user_id": student_id})
            if user_doc:
                student_login_id = student_id
                student_id = str(user_doc["_id"])
        
        query = {"student_id": student_id, "class_level": class_level}
        if subject:
            query["subject"] = subject
        
        progress_docs = await mongodb.db.student_subject_progress.find(query).to_list(100)
        
        one_week_ago = datetime.utcnow() - timedelta(days=7)
        staff_submissions = await mongodb.db.submissions.find({
            "student_id": student_login_id,
            "status": {"$in": ["graded", "submitted"]}
        }).to_list(length=1000)
        
        staff_count = len(staff_submissions)
        staff_avg_scores = [s.get("percentage", 0) for s in staff_submissions if s.get("percentage") is not None]
        staff_avg = sum(staff_avg_scores) / len(staff_avg_scores) if staff_avg_scores else 0
        staff_best = max(staff_avg_scores, default=0)
        staff_this_week = sum(
            1 for s in staff_submissions
            if s.get("submitted_at") and s["submitted_at"] >= one_week_ago
        )
        
        if not progress_docs:
            return StudentAnalytics(
                total_tests_taken=staff_count,
                tests_this_week=staff_this_week,
                overall_average=round(staff_avg, 1),
                best_score=staff_best,
                topics_strong=0,
                topics_moderate=0,
                topics_weak=0,
                weak_topics=[],
                performance_history=[],
                topic_breakdown=[],
                recommendations=[]
            )
        
        total_tests = sum(p.get("total_tests_taken", 0) for p in progress_docs)
        all_averages = [p.get("overall_average", 0) for p in progress_docs if p.get("total_tests_taken", 0) > 0]
        overall_avg = sum(all_averages) / len(all_averages) if all_averages else 0
        
        topics_strong = sum(p.get("topics_strong", 0) for p in progress_docs)
        topics_moderate = sum(p.get("topics_moderate", 0) for p in progress_docs)
        topics_weak = sum(p.get("topics_weak", 0) for p in progress_docs)
        
        weak_topics = []
        for p in progress_docs:
            weak_topics.extend(p.get("weak_topics", [])[:5])
        weak_topics.sort(key=lambda x: x.get("score", 0))
        
        perf_docs = await mongodb.db.student_topic_performance.find(
            {"student_id": student_id}
        ).sort("last_attempted", -1).to_list(100)
        
        performance_history = []
        for p in perf_docs[:20]:
            for h in p.get("score_history", [])[-3:]:
                performance_history.append({
                    "topic": p.get("topic_name", ""),
                    "score": h.get("score", 0),
                    "date": h.get("date", "")
                })
        
        performance_history.sort(key=lambda x: x.get("date", ""), reverse=True)
        performance_history = performance_history[:15]
        
        topic_breakdown = [
            {
                "topic": p.get("topic_name", ""),
                "score": p.get("average_score", 0),
                "tests": p.get("tests_taken", 0),
                "trend": p.get("improvement_trend", "stable")
            }
            for p in perf_docs
        ]
        
        best_score = max((p.get("best_score", 0) for p in perf_docs), default=0)
        
        recommendations = []
        if subject:
            recs = await topic_question_bank_service.get_student_recommendations(
                student_id, class_level, subject, 5
            )
            recommendations = recs
            
        ai_tests_this_week = await mongodb.db.test_sessions.count_documents({
            "student_id": student_id,
            "started_at": {"$gte": one_week_ago}
        })
        
        combined_total = total_tests + staff_count
        combined_this_week = ai_tests_this_week + staff_this_week
        
        if all_averages or staff_avg_scores:
            combined_averages = all_averages + staff_avg_scores
            combined_avg = sum(combined_averages) / len(combined_averages)
        else:
            combined_avg = overall_avg
        
        combined_best = max(best_score, staff_best)
        
        return StudentAnalytics(
            total_tests_taken=combined_total,
            tests_this_week=combined_this_week,
            overall_average=round(combined_avg, 1),
            best_score=combined_best,
            topics_strong=topics_strong,
            topics_moderate=topics_moderate,
            topics_weak=topics_weak,
            weak_topics=weak_topics[:10],
            performance_history=performance_history,
            topic_breakdown=topic_breakdown,
            recommendations=recommendations
        )
        
    except Exception as e:
        logger.error(f"Error fetching analytics: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/question-bank/stats")
async def get_question_bank_stats():
    """Get statistics about the question bank."""
    try:
        collection = mongodb.db.topic_question_bank
        
        pipeline = [
            {"$group": {
                "_id": {"class_level": "$class_level", "subject": "$subject"},
                "chapters": {"$sum": 1},
                "total_questions": {"$sum": "$total_questions"},
                "total_topics": {"$sum": "$total_topics"}
            }},
            {"$sort": {"_id.class_level": 1, "_id.subject": 1}}
        ]
        
        results = await collection.aggregate(pipeline).to_list(100)
        
        stats = []
        for r in results:
            stats.append({
                "class_level": r["_id"]["class_level"],
                "subject": r["_id"]["subject"],
                "chapters": r["chapters"],
                "topics": r["total_topics"],
                "questions": r["total_questions"]
            })
        
        return {
            "total_subjects": len(set(s["subject"] for s in stats)),
            "total_chapters": sum(s["chapters"] for s in stats),
            "total_questions": sum(s["questions"] for s in stats),
            "breakdown": stats
        }
        
    except Exception as e:
        logger.error(f"Error fetching question bank stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/debug/pinecone/{namespace}")
async def debug_pinecone_namespace(namespace: str):
    """Debug endpoint to check Pinecone metadata structure."""
    try:
        from app.db.mongo import namespace_db
        from app.services.llm_storage_service import llm_storage_service
        
        if not namespace_db.index:
            return {"error": "Namespace DB not connected"}
        
        stats = namespace_db.index.describe_index_stats()
        ns_stats = stats.get('namespaces', {}).get(namespace, {})
        
        if not ns_stats.get('vector_count', 0):
            return {"error": f"No vectors in namespace '{namespace}'", "available_namespaces": list(stats.get('namespaces', {}).keys())}
        
        sample_embedding = llm_storage_service.embedding_model.encode(f"class 10 chapter").tolist()
        
        results = namespace_db.index.query(
            vector=sample_embedding,
            namespace=namespace,
            top_k=10,
            include_metadata=True
        )
        
        samples = []
        unique_chapters = {}
        for match in results.get('matches', []):
            metadata = match.get('metadata', {})
            samples.append({k: v for k, v in metadata.items() if k != 'text'})
            
            chapter = metadata.get('chapter')
            if chapter:
                unique_chapters[str(chapter)] = metadata.get('chapter_name', f'Chapter {chapter}')
        
        return {
            "namespace": namespace,
            "vector_count": ns_stats.get('vector_count', 0),
            "sample_metadata_keys": list(samples[0].keys()) if samples else [],
            "samples": samples[:3],
            "unique_chapters": unique_chapters
        }
        
    except Exception as e:
        logger.error(f"Debug error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history/{student_id}")
async def get_test_history(
    student_id: str,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0)
):
    """
    Get test history for a student.
    Returns list of completed tests with scores for statistics page.
    """
    try:
        collection = mongodb.db["test_sessions"]
        
        cursor = collection.find(
            {
                "student_id": student_id,
                "status": "completed"
            },
            {
                "session_id": 1,
                "subject": 1,
                "chapter_number": 1,
                "chapter_name": 1,
                "topic_name": 1,
                "score": 1,
                "total_questions": 1,
                "correct_count": 1,
                "completed_at": 1,
                "created_at": 1
            }
        ).sort("completed_at", -1).skip(offset).limit(limit)
        
        history = []
        async for session in cursor:
            history.append({
                "session_id": session.get("session_id"),
                "subject": session.get("subject", "Unknown"),
                "chapter_number": session.get("chapter_number", 0),
                "chapter_name": session.get("chapter_name", ""),
                "topic_name": session.get("topic_name", "Topic Test"),
                "score": session.get("score", 0),
                "total_questions": session.get("total_questions", 0),
                "correct_count": session.get("correct_count", 0),
                "completed_at": session.get("completed_at", session.get("created_at")).isoformat() if session.get("completed_at") or session.get("created_at") else None
            })
        
        total = await collection.count_documents({
            "student_id": student_id,
            "status": "completed"
        })
        
        all_sessions = collection.find(
            {"student_id": student_id, "status": "completed"},
            {"score": 1, "correct_count": 1, "total_questions": 1, "subject": 1}
        )
        
        total_score = 0
        total_tests = 0
        subject_scores = {}
        
        async for s in all_sessions:
            score = s.get("score", 0)
            subject = s.get("subject", "Unknown")
            total_score += score
            total_tests += 1
            
            if subject not in subject_scores:
                subject_scores[subject] = {"total": 0, "count": 0}
            subject_scores[subject]["total"] += score
            subject_scores[subject]["count"] += 1
        
        average_score = round(total_score / total_tests, 1) if total_tests > 0 else 0
        subject_averages = {
            subject: round(data["total"] / data["count"], 1)
            for subject, data in subject_scores.items()
            if data["count"] > 0
        }
        
        return {
            "history": history,
            "total": total,
            "offset": offset,
            "limit": limit,
            "analytics": {
                "total_tests": total_tests,
                "average_score": average_score,
                "subject_performance": subject_averages
            }
        }
        
    except Exception as e:
        logger.error(f"Error fetching test history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/result/{session_id}")
async def get_test_result(session_id: str):
    """
    Get full test result for a session.
    Used to view past test results from history.
    """
    try:
        collection = mongodb.db["test_sessions"]
        
        session = await collection.find_one({"session_id": session_id})
        
        if not session:
            raise HTTPException(status_code=404, detail="Test session not found")
        
        return {
            "session_id": session.get("session_id"),
            "score": session.get("score", 0),
            "total_questions": session.get("total_questions", 0),
            "correct_answers": session.get("correct_count", 0),
            "evaluations": session.get("evaluation_details", []),
            "feedback": session.get("overall_feedback", {}).get("summary", ""),
            "strengths": session.get("overall_feedback", {}).get("strengths", []),
            "improvements": session.get("overall_feedback", {}).get("improvements", []),
            "topics_to_review": session.get("topics_to_review", []),
            "topics_to_study": session.get("overall_feedback", {}).get("topics_to_study", []),
            "subject": session.get("subject", ""),
            "chapter_number": session.get("chapter_number", 0),
            "chapter_name": session.get("chapter_name", ""),
            "topic_name": session.get("topic_name", ""),
            "completed_at": session.get("completed_at").isoformat() if session.get("completed_at") else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching test result: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history/{student_id}")
async def get_test_history(
    student_id: str,
    limit: int = Query(20, description="Number of results to return")
):
    """
    Get test history for a student.
    """
    try:
        collection = mongodb.db["test_sessions"]
        
        cursor = collection.find({
            "student_id": student_id,
            "status": "completed"
        }).sort("completed_at", -1).limit(limit)
        
        tests = await cursor.to_list(length=limit)
        
        history = []
        total_score = 0
        for t in tests:
            score = t.get("score", 0)
            total_score += score
            history.append({
                "session_id": t.get("session_id"),
                "subject": t.get("subject", "Unknown"),
                "chapter_number": t.get("chapter_number", 0),
                "chapter_name": t.get("chapter_name", f"Ch.{t.get('chapter_number', 0)}"),
                "topic_name": t.get("topic_name", "Topic Test"),
                "score": score,
                "total_questions": t.get("total_questions", 0),
                "correct_count": t.get("correct_count", 0),
                "completed_at": t.get("completed_at").isoformat() if t.get("completed_at") else None
            })
        
        avg_score = (total_score / len(tests)) if tests else 0
        
        return {
            "history": history,
            "total": len(tests),
            "analytics": {
                "total_tests": len(tests),
                "average_score": round(avg_score, 1),
                "best_score": max((t.get("score", 0) for t in tests), default=0)
            }
        }
        
    except Exception as e:
        logger.error(f"Error fetching test history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/analytics/{student_id}")
async def get_test_analytics(
    student_id: str,
    class_level: int = Query(10, description="Class level"),
    subject: Optional[str] = Query(None, description="Filter by subject")
):
    """
    Get comprehensive test analytics for a student.
    """
    try:
        collection = mongodb.db["test_sessions"]
        
        filter_query = {
            "student_id": student_id,
            "status": "completed"
        }
        if subject:
            filter_query["subject"] = {"$regex": subject, "$options": "i"}
        
        tests = await collection.find(filter_query).sort("completed_at", -1).to_list(length=500)
        
        if not tests:
            return StudentAnalytics(
                total_tests_taken=0,
                tests_this_week=0,
                overall_average=0,
                best_score=0,
                topics_strong=0,
                topics_moderate=0,
                topics_weak=0,
                weak_topics=[],
                performance_history=[],
                topic_breakdown=[],
                recommendations=[]
            )
        
        from datetime import datetime, timedelta
        one_week_ago = datetime.utcnow() - timedelta(days=7)
        
        scores = [t.get("score", 0) for t in tests]
        tests_this_week = sum(1 for t in tests if t.get("completed_at") and t.get("completed_at") > one_week_ago)
        
        topic_scores = {}
        for t in tests:
            topic = t.get("topic_name", "Unknown")
            if topic not in topic_scores:
                topic_scores[topic] = []
            topic_scores[topic].append(t.get("score", 0))
        
        topics_strong = 0
        topics_moderate = 0
        topics_weak = 0
        weak_topics = []
        topic_breakdown = []
        
        for topic, topic_score_list in topic_scores.items():
            avg = sum(topic_score_list) / len(topic_score_list)
            topic_breakdown.append({
                "topic": topic,
                "average_score": round(avg, 1),
                "tests_count": len(topic_score_list)
            })
            
            if avg >= 80:
                topics_strong += 1
            elif avg >= 60:
                topics_moderate += 1
            else:
                topics_weak += 1
                weak_topics.append({"topic": topic, "score": round(avg, 1)})
        
        performance_history = []
        for t in tests[:10]:
            performance_history.append({
                "date": t.get("completed_at").isoformat() if t.get("completed_at") else None,
                "score": t.get("score", 0),
                "subject": t.get("subject", "Unknown")
            })
        
        return StudentAnalytics(
            total_tests_taken=len(tests),
            tests_this_week=tests_this_week,
            overall_average=round(sum(scores) / len(scores), 1),
            best_score=max(scores),
            topics_strong=topics_strong,
            topics_moderate=topics_moderate,
            topics_weak=topics_weak,
            weak_topics=weak_topics,
            performance_history=performance_history,
            topic_breakdown=topic_breakdown,
            recommendations=weak_topics[:3]
        )
        
    except Exception as e:
        logger.error(f"Error fetching test analytics: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/history/{session_id}")
async def delete_test_history_item(session_id: str):
    """
    Delete a single test history item.
    """
    try:
        collection = mongodb.db["test_sessions"]
        
        result = await collection.delete_one({"session_id": session_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Test session not found")
        
        return {"status": "deleted", "session_id": session_id}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting test history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/history/all/{student_id}")
async def delete_all_test_history(student_id: str):
    """
    Delete all test history for a student.
    """
    try:
        collection = mongodb.db["test_sessions"]
        
        result = await collection.delete_many({
            "student_id": student_id,
            "status": "completed"
        })
        
        return {
            "status": "deleted",
            "student_id": student_id,
            "deleted_count": result.deleted_count
        }
        
    except Exception as e:
        logger.error(f"Error deleting all test history: {e}")
        raise HTTPException(status_code=500, detail=str(e))
