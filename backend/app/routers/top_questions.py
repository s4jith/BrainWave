"""
Top Questions Router
API endpoints for managing top questions and recommendations.
Supports subject-wise filtering for Quick and Deep modes.
"""

from fastapi import APIRouter, HTTPException
from typing import Optional
from app.models.top_questions import (
    GetTopQuestionsRequest,
    GetTopQuestionsResponse,
    GetRecommendationsRequest,
    GetRecommendationsResponse,
    TrackQuestionRequest,
    TrackQuestionResponse,
    UpdateFeedbackRequest,
    UpdateFeedbackResponse,
    TrendingQuestionsRequest,
    TrendingQuestionsResponse,
    TopQuestionResponse
)
from app.services.top_question_service import top_question_service
from app.services.subject_service import subject_service
import logging

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/top-questions",
    tags=["Top Questions"]
)

@router.post("/top", response_model=GetTopQuestionsResponse)
async def get_top_questions(request: GetTopQuestionsRequest):
    """
    Get top questions for a subject, class, and mode.
    
    **Subject filtering works correctly:**
    - If student chooses "Hindi" → returns Hindi top questions
    - If student chooses "Math" → returns Math top questions
    - etc.
    
    **Mode support:**
    - `quick`: Fast, concise explanations
    - `deep`: Detailed, comprehensive explanations
    
    **Example Request:**
    ```json
    {
        "subject": "hindi",
        "class_level": 10,
        "mode": "quick",
        "limit": 5
    }
    ```
    """
    try:
        logger.info(f" Getting top questions: {request.subject} class {request.class_level} ({request.mode})")
        
        questions = top_question_service.get_top_questions(
            subject=request.subject,
            class_level=request.class_level,
            mode=request.mode,
            limit=request.limit
        )
        
        return GetTopQuestionsResponse(
            success=True,
            questions=questions,
            count=len(questions),
            subject=request.subject,
            class_level=request.class_level,
            mode=request.mode
        )
        
    except Exception as e:
        logger.error(f" Error getting top questions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/recommendations", response_model=GetRecommendationsResponse)
async def get_recommendations(request: GetRecommendationsRequest):
    """
    Get personalized question recommendations for a user.
    
    Recommendations are based on:
    1. Questions popular with other students in same subject/class
    2. Questions the user hasn't asked yet
    3. Questions related to topics the user has recently studied
    
    **Example Request:**
    ```json
    {
        "user_id": "STU001",
        "subject": "math",
        "class_level": 10,
        "mode": "deep",
        "limit": 5
    }
    ```
    """
    try:
        logger.info(f" Getting recommendations for user {request.user_id}: {request.subject} class {request.class_level}")
        
        recommendations = top_question_service.get_recommendations(
            user_id=request.user_id,
            subject=request.subject,
            class_level=request.class_level,
            mode=request.mode,
            limit=request.limit
        )
        
        return GetRecommendationsResponse(
            success=True,
            recommendations=recommendations,
            count=len(recommendations),
            personalized=True
        )
        
    except Exception as e:
        logger.error(f" Error getting recommendations: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/track", response_model=TrackQuestionResponse)
async def track_question(request: TrackQuestionRequest):
    """
    Track a question-answer pair.
    
    This endpoint should be called whenever a student asks a question
    and receives an answer. It:
    1. Saves the Q&A pair for future reference
    2. Updates the question count for top questions tracking
    3. Enables personalized recommendations
    
    **Example Request:**
    ```json
    {
        "user_id": "STU001",
        "session_id": "abc123",
        "question": "Explain photosynthesis",
        "answer": "Photosynthesis is the process...",
        "subject": "science",
        "class_level": 10,
        "chapter": 6,
        "mode": "quick"
    }
    ```
    """
    try:
        logger.info(f"💾 Tracking question from user {request.user_id}: '{request.question[:50]}...'")
        
        qa_id = top_question_service.save_question_answer(
            user_id=request.user_id,
            session_id=request.session_id,
            question=request.question,
            answer=request.answer,
            subject=request.subject,
            class_level=request.class_level,
            mode=request.mode,
            chapter=request.chapter
        )
        
        if qa_id:
            return TrackQuestionResponse(
                success=True,
                message="Question tracked successfully",
                question_id=qa_id
            )
        else:
            raise HTTPException(status_code=500, detail="Failed to track question")
        
    except Exception as e:
        logger.error(f" Error tracking question: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/feedback", response_model=UpdateFeedbackResponse)
async def update_feedback(request: UpdateFeedbackRequest):
    """
    Update user feedback for a question-answer pair.
    
    Allows students to rate answers and provide feedback,
    which can be used to improve recommendations.
    
    **Example Request:**
    ```json
    {
        "qa_id": "507f1f77bcf86cd799439011",
        "user_rating": 5,
        "was_helpful": true,
        "time_spent_seconds": 120
    }
    ```
    """
    try:
        logger.info(f"⭐ Updating feedback for Q&A {request.qa_id}")
        
        success = top_question_service.update_feedback(
            qa_id=request.qa_id,
            user_rating=request.user_rating,
            was_helpful=request.was_helpful,
            time_spent_seconds=request.time_spent_seconds
        )
        
        if success:
            return UpdateFeedbackResponse(
                success=True,
                message="Feedback updated successfully"
            )
        else:
            raise HTTPException(status_code=404, detail="Q&A pair not found")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f" Error updating feedback: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/trending", response_model=TrendingQuestionsResponse)
async def get_trending_questions(request: TrendingQuestionsRequest):
    """
    Get trending questions from the last N days.
    
    Shows questions that have been asked most frequently recently,
    indicating current topics of interest among students.
    
    **Example Request:**
    ```json
    {
        "subject": "math",
        "class_level": 10,
        "mode": "quick",
        "limit": 5,
        "days": 7
    }
    ```
    """
    try:
        logger.info(f"🔥 Getting trending questions: {request.subject} class {request.class_level} (last {request.days} days)")
        
        trending = top_question_service.get_trending_questions(
            subject=request.subject,
            class_level=request.class_level,
            mode=request.mode,
            days=request.days,
            limit=request.limit
        )
        
        return TrendingQuestionsResponse(
            success=True,
            trending=trending,
            count=len(trending),
            days=request.days
        )
        
    except Exception as e:
        logger.error(f" Error getting trending questions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/top/{subject}/{class_level}")
async def get_top_questions_simple(
    subject: str,
    class_level: int,
    mode: str = "quick",
    limit: int = 5
):
    """
    Simple GET endpoint for top questions (alternative to POST).
    
    **Usage:**
    ```
    GET /api/top-questions/top/hindi/10?mode=quick&limit=5
    ```
    """
    try:
        questions = top_question_service.get_top_questions(
            subject=subject,
            class_level=class_level,
            mode=mode,
            limit=limit
        )
        
        return {
            "success": True,
            "questions": [q.dict() for q in questions],
            "count": len(questions),
            "subject": subject,
            "class_level": class_level,
            "mode": mode
        }
        
    except Exception as e:
        logger.error(f" Error in simple GET endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/recommendations/{user_id}/{subject}/{class_level}")
async def get_recommendations_simple(
    user_id: str,
    subject: str,
    class_level: int,
    mode: str = "quick",
    limit: int = 5
):
    """
    Simple GET endpoint for recommendations (alternative to POST).
    
    **Usage:**
    ```
    GET /api/top-questions/recommendations/STU001/math/10?mode=deep&limit=5
    ```
    """
    try:
        recommendations = top_question_service.get_recommendations(
            user_id=user_id,
            subject=subject,
            class_level=class_level,
            mode=mode,
            limit=limit
        )
        
        return {
            "success": True,
            "recommendations": [r.dict() for r in recommendations],
            "count": len(recommendations),
            "personalized": True
        }
        
    except Exception as e:
        logger.error(f" Error in simple GET endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/subjects/{class_level}")
async def get_available_subjects(class_level: int):
    """
    Get list of available subjects for a class level.
    
    Returns only subjects that have data in the database:
    - Subjects with top questions
    - Subjects with Q&A history
    - Subjects with textbook content in Pinecone
    
    **Usage:**
    ```
    GET /api/top-questions/subjects/10
    ```
    
    **Response:**
    ```json
    {
      "success": true,
      "class_level": 10,
      "subjects": [
        {"name": "Hindi", "value": "hindi"},
        {"name": "Maths", "value": "maths"},
        {"name": "Science", "value": "science"}
      ],
      "count": 3
    }
    ```
    """
    try:
        if class_level < 6 or class_level > 12:
            raise HTTPException(status_code=400, detail="Class level must be between 6 and 12")
        
        logger.info(f"Getting available subjects for class {class_level}")
        
        subjects = subject_service.get_available_subjects_for_class(class_level)
        
        return {
            "success": True,
            "class_level": class_level,
            "subjects": subjects,
            "count": len(subjects)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f" Error getting available subjects: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/subjects/{class_level}/stats")
async def get_subject_stats(
    class_level: int,
    subject: Optional[str] = None
):
    """
    Get statistics for subjects in a class.
    
    **Usage:**
    ```
    GET /api/top-questions/subjects/10/stats
    GET /api/top-questions/subjects/10/stats?subject=hindi
    ```
    
    **Response:**
    ```json
    {
      "success": true,
      "stats": {
        "subject": "hindi",
        "class_level": 10,
        "question_count": 45,
        "total_asks": 230,
        "unique_students": 15
      }
    }
    ```
    """
    try:
        if class_level < 6 or class_level > 12:
            raise HTTPException(status_code=400, detail="Class level must be between 6 and 12")
        
        if subject:
            stats = subject_service.get_subject_stats(subject, class_level)
            return {
                "success": True,
                "stats": stats
            }
        else:
            subjects = subject_service.get_available_subjects_for_class(class_level)
            all_stats = []
            
            for subj in subjects:
                stats = subject_service.get_subject_stats(subj["value"], class_level)
                all_stats.append(stats)
            
            return {
                "success": True,
                "class_level": class_level,
                "stats": all_stats,
                "count": len(all_stats)
            }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f" Error getting subject stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/doubts/{user_id}")
async def get_doubt_history(
    user_id: str,
    subject: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    search: Optional[str] = None
):
    """
    Get user's doubt/question history.
    
    Browse all past questions and answers with filtering.
    
    **Usage:**
    ```
    GET /api/top-questions/doubts/STU001?subject=math&limit=10
    GET /api/top-questions/doubts/STU001?search=photosynthesis
    ```
    """
    try:
        logger.info(f"📜 Getting doubt history for user {user_id}")
        
        from app.db.mongo import mongodb
        db = mongodb.db
        qa_col = db["top_questions"]
        
        filter_query = {"user_id": user_id}
        if subject:
            filter_query["subject"] = {"$regex": subject, "$options": "i"}
        if search:
            filter_query["question"] = {"$regex": search, "$options": "i"}
        
        total = qa_col.count_documents(filter_query)
        
        doubts = list(
            qa_col.find(filter_query)
            .sort("created_at", -1)
            .skip(offset)
            .limit(limit)
        )
        
        result = []
        for d in doubts:
            result.append({
                "id": str(d["_id"]),
                "question": d.get("question", ""),
                "answer": d.get("answer", "")[:500] + "..." if len(d.get("answer", "")) > 500 else d.get("answer", ""),
                "subject": d.get("subject", "Unknown"),
                "class_level": d.get("class_level", 0),
                "mode": d.get("mode", "quick"),
                "created_at": d.get("created_at", ""),
                "was_helpful": d.get("was_helpful", None)
            })
        
        return {
            "success": True,
            "doubts": result,
            "total": total,
            "limit": limit,
            "offset": offset,
            "has_more": (offset + limit) < total
        }
        
    except Exception as e:
        logger.error(f" Error getting doubt history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/doubts/{user_id}/{qa_id}")
async def get_doubt_detail(user_id: str, qa_id: str):
    """
    Get full detail of a specific doubt/question.
    
    **Usage:**
    ```
    GET /api/top-questions/doubts/STU001/507f1f77bcf86cd799439011
    ```
    """
    try:
        from bson import ObjectId
        from app.db.mongo import mongodb
        
        db = mongodb.db
        qa_col = db["top_questions"]
        
        doubt = qa_col.find_one({
            "_id": ObjectId(qa_id),
            "user_id": user_id
        })
        
        if not doubt:
            raise HTTPException(status_code=404, detail="Doubt not found")
        
        return {
            "success": True,
            "doubt": {
                "id": str(doubt["_id"]),
                "question": doubt.get("question", ""),
                "answer": doubt.get("answer", ""),
                "subject": doubt.get("subject", "Unknown"),
                "class_level": doubt.get("class_level", 0),
                "chapter": doubt.get("chapter"),
                "mode": doubt.get("mode", "quick"),
                "created_at": doubt.get("created_at", ""),
                "was_helpful": doubt.get("was_helpful", None),
                "user_rating": doubt.get("user_rating", None)
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f" Error getting doubt detail: {e}")
        raise HTTPException(status_code=500, detail=str(e))
