"""
Optimized Chat Router - 2-Call Maximum for Sustainable Deployment

Uses Gemini embeddings with caching to minimize API calls.

Endpoints:
- POST /api/v1/chat/optimized - Main optimized chat (2 calls max)
- GET /api/v1/admin/api-stats - API usage statistics
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List
from app.services.optimized_rag_service import optimized_rag_service, api_tracker
from app.services.top_question_service import top_question_service
import logging

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/v1",
    tags=["Optimized Chat"]
)

class OptimizedChatRequest(BaseModel):
    """Request schema for optimized chat."""
    question: str = Field(..., description="Student's question (any language)")
    class_level: int = Field(..., ge=1, le=12, description="Class level")
    subject: str = Field(..., description="Subject name")
    mode: str = Field("quick", description="Mode: quick, deepdive, annotation, define")
    chapter: Optional[int] = Field(None, description="Optional chapter number")
    user_id: Optional[str] = Field(None, description="User ID for tracking (optional)")
    session_id: Optional[str] = Field(None, description="Session ID for tracking (optional)")

class OptimizedChatResponse(BaseModel):
    """Response schema for optimized chat."""
    answer: str = Field(..., description="Generated answer")
    lang: str = Field(..., description="Detected language code")
    sources: List[str] = Field(default=[], description="Source text snippets")
    cached: bool = Field(..., description="Whether response was cached")
    gemini_calls: int = Field(..., description="Gemini API calls used (target: ≤2)")
    chunks_used: int = Field(0, description="Number of context chunks used")

class APIStatsResponse(BaseModel):
    """Response schema for API statistics."""
    queries_processed: int
    gemini_calls_saved: int
    embedding_cache_hit_rate: float
    answer_cache_hit_rate: float
    total_api_calls: int
    calls_last_hour: int
    avg_calls_per_query: float
    optimization_savings: str

@router.post("/chat/optimized", response_model=OptimizedChatResponse)
async def optimized_chat(request: OptimizedChatRequest):
    """
    ⚡ Optimized Chat - Maximum 2 Gemini API Calls
    
    **Optimized Flow:**
    1. Language detection → langdetect library (0 Gemini calls)
    2. Query embedding → Gemini with caching
    3. Batch Pinecone retrieval → Multi-namespace search (0 calls)
    4. Answer generation → Single Gemini call
    
    **Supports:** Hindi, Urdu, Tamil, Telugu, Bengali, Marathi, Gujarati,
                  Kannada, Malayalam, Punjabi, English
    
    **Auto-tracking:** Questions and answers are automatically tracked for recommendations
    when user_id and session_id are provided.
    """
    try:
        logger.info(f"⚡ Optimized chat: '{request.question[:50]}...' | Class {request.class_level} {request.subject}")
        
        result = await optimized_rag_service.chat(
            question=request.question,
            class_level=request.class_level,
            subject=request.subject,
            mode=request.mode,
            chapter=request.chapter
        )
        
        if result.get("blocked"):
             raise HTTPException(
                 status_code=400,
                 detail={
                     "error": "subject_mismatch",
                     "message": result["answer"],
                     "detected_subject": result.get("detected_subject", "Unknown")
                 }
             )
        
        if request.user_id and request.session_id:
            try:
                tracking_mode = "deep" if request.mode in ["deepdive", "elaborate"] else "quick"
                
                top_question_service.save_question_answer(
                    user_id=request.user_id,
                    session_id=request.session_id,
                    question=request.question,
                    answer=result["answer"],
                    subject=request.subject,
                    class_level=request.class_level,
                    mode=tracking_mode,
                    chapter=request.chapter
                )
                logger.info(f"Question tracked for user {request.user_id}")
            except Exception as track_error:
                logger.warning(f" Failed to track question: {track_error}")
        
        return OptimizedChatResponse(
            answer=result["answer"],
            lang=result["lang"],
            sources=result.get("sources", []),
            cached=result.get("cached", False),
            gemini_calls=result.get("gemini_calls", 0),
            chunks_used=result.get("chunks_used", 0)
        )
    
    except Exception as e:
        logger.error(f" Optimized chat error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/admin/api-stats", response_model=APIStatsResponse)
async def get_api_stats():
    """
    📊 Get API Usage Statistics
    
    Returns:
    - Total queries processed
    - Gemini calls saved by caching
    - Cache hit rates (embedding + answer)
    - Optimization savings percentage
    """
    try:
        stats = optimized_rag_service.get_stats()
        api_stats = stats.get("api_tracker", {})
        embed_cache = stats.get("embedding_cache", {})
        answer_cache = stats.get("answer_cache", {})
        
        queries = stats.get("queries_processed", 0)
        total_calls = api_stats.get("total_calls", 0)
        
        avg_calls = total_calls / queries if queries > 0 else 0
        
        if queries > 0:
            expected_calls = queries * 5
            actual_calls = total_calls
            savings = ((expected_calls - actual_calls) / expected_calls) * 100 if expected_calls > 0 else 0
            savings_str = f"{savings:.1f}% reduction (5→{avg_calls:.1f} calls/query)"
        else:
            savings_str = "No data yet"
        
        return APIStatsResponse(
            queries_processed=queries,
            gemini_calls_saved=stats.get("gemini_calls_saved", 0),
            embedding_cache_hit_rate=embed_cache.get("hit_rate", 0),
            answer_cache_hit_rate=answer_cache.get("hit_rate", 0),
            total_api_calls=total_calls,
            calls_last_hour=api_stats.get("calls_last_hour", 0),
            avg_calls_per_query=round(avg_calls, 2),
            optimization_savings=savings_str
        )
    
    except Exception as e:
        logger.error(f"API stats error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/admin/reset-api-stats")
async def reset_api_stats():
    """Reset API call tracking statistics."""
    api_tracker.reset()
    return {"message": "API stats reset successfully"}
