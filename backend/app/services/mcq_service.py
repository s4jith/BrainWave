"""
MCQ Service - Handles MCQ generation and management.
"""

from app.services.gemini_service import gemini_service
from app.services.rag_service import rag_service
from app.models.schemas import MCQ
import logging

logger = logging.getLogger(__name__)


class MCQService:
    """Service for generating and managing MCQs."""
    
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
    ) -> list[MCQ]:
        """
        Generate MCQs using RAG context and Gemini AI.
        
        Args:
            class_level: Class (5-10)
            subject: Subject name
            chapter: Chapter number
            num_questions: Number of MCQs to generate
            page_range: Optional (start_page, end_page)
        
        Returns:
            List of MCQ objects
        """
        try:
            # Step 1: Retrieve chapter context from Pinecone
            logger.info(f"Retrieving context for Class {class_level}, {subject}, Chapter {chapter}")
            context = self.rag.retrieve_chapter_context(
                class_level=class_level,
                subject=subject,
                chapter=chapter
            )
            
            # Step 2: Generate MCQs using Gemini
            logger.info(f"Generating {num_questions} MCQs...")
            mcq_dicts = self.gemini.generate_mcqs(
                context=context,
                num_questions=num_questions,
                class_level=class_level,
                subject=subject,
                chapter=chapter
            )
            
            # Step 3: Convert to Pydantic models
            mcqs = [MCQ(**mcq) for mcq in mcq_dicts]
            
            logger.info(f"✅ Generated {len(mcqs)} MCQs successfully")
            return mcqs
        
        except Exception as e:
            logger.error(f"❌ MCQ generation failed: {e}")
            raise


# Global MCQ service instance
mcq_service = MCQService()
