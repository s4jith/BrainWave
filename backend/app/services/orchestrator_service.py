"""
Orchestrator Service

Coordinates the full RAG pipeline with performance tracking.
"""

import logging
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass

from app.utils.performance_logger import measure_latency, LatencyContext
from app.services.retrieval_service import retrieval_service, RetrievalService
from app.services.generation_service import generation_service, GenerationService
from app.services.llm_storage_service import llm_storage_service

logger = logging.getLogger(__name__)

@dataclass
class OrchestratorConfig:
    """Configuration for Orchestrator Service."""
    component_name: str = "OrchestratorService"
    
    cache_similarity_threshold: float = 0.95
    store_generated_answers: bool = True

class OrchestratorService:
    """
    Orchestrator Service for RAG pipeline coordination.
    
    Target latency: ≤3-5 seconds for full RAG query.
    
    Pipeline:
        1. Query intake and validation
        2. Retrieval (multi-index search)
        3. Cache check (LLM answers)
        4. Generation (if cache miss)
        5. Answer caching
    """
    
    def __init__(
        self,
        config: Optional[OrchestratorConfig] = None,
        retrieval: Optional[RetrievalService] = None,
        generation: Optional[GenerationService] = None
    ):
        self.config = config or OrchestratorConfig()
        self.retrieval = retrieval or retrieval_service
        self.generation = generation or generation_service
        self.llm_storage = llm_storage_service
        
        logger.info(f"{self.config.component_name} initialized")
    
    @measure_latency("rag_full_pipeline")
    def answer_question(
        self,
        question: str,
        subject: str,
        student_class: int,
        chapter: Optional[int] = None,
        mode: str = "basic"
    ) -> Tuple[str, List[Dict]]:
        """
        Answer a student's question using the full RAG pipeline.
        
        Full pipeline with ≤3-5s target latency.
        
        Args:
            question: Student's question
            subject: Subject name
            student_class: Student's class level
            chapter: Optional chapter filter
            mode: "basic" or "deepdive"
        
        Returns:
            Tuple of (answer, source_chunks)
        """
        logger.info(f" [{self.config.component_name}] Processing query: {question[:50]}...")
        logger.info(f"   Subject: {subject}, Class: {student_class}, Mode: {mode}")
        
        with LatencyContext("orchestrator_retrieval"):
            retrieval_result = self.retrieval.retrieve(
                query_text=question,
                subject=subject,
                student_class=student_class,
                chapter=chapter,
                mode=mode
            )
        
        textbook_chunks = retrieval_result["textbook_chunks"]
        llm_chunks = retrieval_result["llm_chunks"]
        web_chunks = retrieval_result["web_chunks"]
        class_dist = retrieval_result["class_distribution"]
        
        if llm_chunks and llm_chunks[0]['score'] >= self.config.cache_similarity_threshold:
            cached_answer = llm_chunks[0]['text']
            logger.info(f" [{self.config.component_name}] CACHE HIT (score: {llm_chunks[0]['score']:.3f})")
            return cached_answer, textbook_chunks + llm_chunks
        
        with LatencyContext("orchestrator_generation"):
            answer = self.generation.generate_answer(
                question=question,
                textbook_chunks=textbook_chunks,
                llm_chunks=llm_chunks,
                web_chunks=web_chunks,
                class_distribution=class_dist,
                student_class=student_class,
                subject=subject,
                mode=mode
            )
        
        if self.config.store_generated_answers and answer:
            self._store_answer(question, answer, subject, student_class)
        
        source_chunks = textbook_chunks + llm_chunks + web_chunks
        
        logger.info(f"[{self.config.component_name}] Pipeline complete ({len(answer)} chars, {len(source_chunks)} sources)")
        
        return answer, source_chunks
    
    def answer_question_basic(
        self,
        question: str,
        subject: str,
        student_class: int,
        chapter: Optional[int] = None
    ) -> Tuple[str, List[Dict]]:
        """Basic mode wrapper for compatibility with existing endpoints."""
        return self.answer_question(question, subject, student_class, chapter, mode="basic")
    
    def answer_question_deepdive(
        self,
        question: str,
        subject: str,
        student_class: int,
        chapter: Optional[int] = None
    ) -> Tuple[str, List[Dict]]:
        """DeepDive mode wrapper for compatibility with existing endpoints."""
        return self.answer_question(question, subject, student_class, chapter, mode="deepdive")
    
    def answer_question_adaptive(
        self,
        question: str,
        subject: str,
        student_class: int,
        student_id: Optional[str] = None,
        chapter: Optional[int] = None
    ) -> Tuple[str, List[Dict]]:
        """
        Answer question with adaptive explanation based on student level.
        
        Stretch goal: Adaptive explanations based on student profile.
        Maps student level to explanation mode:
        - beginner → simple (step-by-step explanations)
        - intermediate → quick (focused answers)
        - advanced → deepdive (comprehensive from fundamentals)
        
        Args:
            question: Student's question
            subject: Subject name
            student_class: Student's class level
            student_id: Optional student ID to look up level
            chapter: Optional chapter filter
        
        Returns:
            Tuple of (answer, source_chunks)
        """
        level_to_mode = {
            "beginner": "simple",
            "intermediate": "quick",
            "advanced": "deepdive"
        }
        
        mode = "quick"
        
        if student_id:
            try:
                from app.db.mongo import get_database
                db = get_database()
                if db:
                    student = db.students.find_one({"_id": student_id})
                    if student and "level" in student:
                        mode = level_to_mode.get(student["level"], "quick")
                        logger.info(f"🎓 Adaptive mode: student {student_id} level={student['level']} → mode={mode}")
            except Exception as e:
                logger.debug(f"Could not get student level: {e}")
        
        return self.answer_question(question, subject, student_class, chapter, mode=mode)
    
    def _store_answer(self, question: str, answer: str, subject: str, student_class: int):
        """Store generated answer for future cache hits."""
        try:
            self.llm_storage.store_answer(
                question=question,
                answer=answer,
                subject=subject,
                class_level=student_class,
                topic="question"
            )
        except Exception as e:
            logger.warning(f"Failed to store answer: {e}")
    
    def get_status(self) -> Dict:
        """Get service status."""
        return {
            "service": self.config.component_name,
            "pipeline_components": [
                self.retrieval.get_status(),
                self.generation.get_status()
            ],
            "cache_threshold": self.config.cache_similarity_threshold,
            "target_latency_ms": "3000-5000"
        }
    
    def get_all_service_statuses(self) -> Dict:
        """Get status of all services."""
        return {
            "orchestrator": self.get_status(),
            "retrieval": self.retrieval.get_status(),
            "generation": self.generation.get_status()
        }

orchestrator_service = OrchestratorService()
