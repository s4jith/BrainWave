"""
MCQ Service - Handles MCQ generation and management.

Uses Gemini for high-quality MCQ generation.
"""

from app.services.gemini_service import gemini_service
from app.services.rag_service import rag_service
from app.models.schemas import MCQ
import logging
import time
from typing import List, Tuple, Optional

logger = logging.getLogger(__name__)

class MCQService:
    """
    Service for generating and managing MCQs using Gemini.
    """
    
    def __init__(self):
        self.gemini = gemini_service
        self.rag = rag_service
    
    def generate_mcqs(
        self,
        class_level: int,
        subject: str,
        chapter: int,
        num_questions: int = 5,
        page_range: tuple[int, int] = None
    ) -> Tuple[List[MCQ], str, Optional[float]]:
        """
        Generate MCQs using RAG context and Gemini.
        
        Args:
            class_level: Class (5-12)
            subject: Subject name
            chapter: Chapter number
            num_questions: Number of MCQs to generate
            page_range: Optional (start_page, end_page)
        
        Returns:
            Tuple of (List of MCQ objects, pipeline_used, inference_time_ms)
        """
        try:
            logger.info(f"Retrieving context for Class {class_level}, {subject}, Chapter {chapter}")
            context = self.rag.retrieve_chapter_context(
                class_level=class_level,
                subject=subject,
                chapter=chapter
            )
            
            return self._generate_with_gemini(
                context=context,
                num_questions=num_questions,
                class_level=class_level,
                subject=subject,
                chapter=chapter
            )
        
        except Exception as e:
            logger.error(f" MCQ generation failed: {e}")
            raise
    
    def _generate_with_gemini(
        self,
        context: str,
        num_questions: int,
        class_level: int,
        subject: str,
        chapter: int
    ) -> Tuple[List[MCQ], str, Optional[float]]:
        """Generate MCQs using Gemini (cloud)."""
        logger.info(f"Generating {num_questions} MCQs with Gemini...")
        
        start_time = time.perf_counter()
        
        mcq_dicts = self.gemini.generate_mcqs(
            context=context,
            num_questions=num_questions,
            class_level=class_level,
            subject=subject,
            chapter=chapter
        )
        
        inference_time_ms = (time.perf_counter() - start_time) * 1000
        
        mcqs = [MCQ(**mcq) for mcq in mcq_dicts]
        
        logger.info(f"Generated {len(mcqs)} MCQs with Gemini in {inference_time_ms:.1f}ms")
        return mcqs, "gemini", inference_time_ms

mcq_service = MCQService()
