"""
LLM Storage Service
Stores high-quality LLM-generated answers for reuse and knowledge building.
Uses Gemini embedding-001 for consistency with textbook index.
"""

from app.db.mongo import pinecone_llm_db
from app.utils.embedding_helper import generate_embedding as _embed_rest, EMBEDDING_MODEL
import hashlib
import logging
import re

logger = logging.getLogger(__name__)

class LLMStorageService:
    """
    Service for storing and retrieving LLM-generated answers.
    Prevents hallucination by building a knowledge base of validated responses.
    """
    
    def __init__(self):
        """Initialize LLM storage service with Gemini embedding model."""
        logger.info(f"LLM Storage Service initialized with {EMBEDDING_MODEL}")
    
    def _generate_embedding(self, text: str) -> list:
        """Generate embedding using same Gemini model as textbook index."""
        from app.services.gemini_key_manager import gemini_key_manager
        
        last_error = None
        max_attempts = max(1, len(gemini_key_manager.keys))
        
        for attempt in range(max_attempts):
            api_key = gemini_key_manager.get_available_key()
            if not api_key:
                break
            
            key_id = gemini_key_manager.get_current_key_id()
            try:
                return _embed_rest(
                    text=text,
                    api_key=api_key,
                    task_type="RETRIEVAL_DOCUMENT"
                )
            except Exception as e:
                last_error = e
                if key_id:
                    rotated = gemini_key_manager.handle_key_error(key_id, e)
                    if rotated:
                        logger.warning(
                            f"[LLM Storage Embedding Retry] Error on {key_id} -> rotating "
                            f"(attempt {attempt + 1}/{max_attempts}): {e}"
                        )
                        continue
                raise
        
        raise RuntimeError(f"No Gemini API key available for LLM storage embedding: {last_error}")
    
    def store_answer(
        self,
        question: str,
        answer: str,
        subject: str,
        class_level: int,
        topic: str = None,
        quality_score: float = 0.9,
        textbook_chunks: list = None
    ) -> bool:
        """
        Store LLM-generated answer if it meets quality criteria.
        
        Args:
            question: Student's original question
            answer: LLM-generated answer
            subject: Subject name (Mathematics, Physics, etc.)
            class_level: Student's class level
            topic: Specific topic extracted from question (optional)
            quality_score: Answer quality score (0-1)
            textbook_chunks: Source textbook chunks for verification (optional)
        
        Returns:
            True if stored successfully, False otherwise
        """
        try:
            if not self._should_store_answer(answer, textbook_chunks):
                logger.debug(f"Answer not stored - quality check failed")
                return False
            
            if not topic:
                topic = self._extract_topic(question)
            
            question_embedding = self._generate_embedding(question)
            
            question_hash = hashlib.md5(question.lower().strip().encode()).hexdigest()[:16]
            vector_id = f"llm_{subject.lower()}_{class_level}_{topic.lower()}_{question_hash}"
            
            source_fingerprint = self._generate_source_fingerprint(textbook_chunks) if textbook_chunks else None
            
            success = pinecone_llm_db.store_llm_response(
                vector_id=vector_id,
                question=question,
                answer=answer,
                subject=subject,
                topic=topic,
                class_level=class_level,
                embedding=question_embedding,
                quality_score=quality_score
            )
            
            if success:
                grounded_status = "GROUNDED" if textbook_chunks else "UNVERIFIED"
                logger.info(f"Stored LLM answer [{grounded_status}] for: {topic} (Class {class_level}, {subject})")
            
            return success
            
        except Exception as e:
            logger.error(f"Failed to store LLM answer: {e}")
            return False
    
    def _generate_source_fingerprint(self, textbook_chunks: list) -> str:
        """
        Generate a fingerprint from source textbook chunks.
        Used to verify answer grounding.
        
        Args:
            textbook_chunks: List of textbook chunk dictionaries
        
        Returns:
            MD5 hash of combined chunk texts
        """
        if not textbook_chunks:
            return None
        
        combined_text = " ".join([
            c.get('text', '')[:200] for c in textbook_chunks[:5]
        ])
        return hashlib.md5(combined_text.encode()).hexdigest()[:16]
    
    def _should_store_answer(self, answer: str, textbook_chunks: list = None) -> bool:
        """
        Check if answer meets quality criteria for storage.
        
        Simplified criteria for better cache reuse:
        - Sufficient length (>100 characters)
        - Not error messages
        - Not obvious failure responses
        
        Args:
            answer: Generated answer text
            textbook_chunks: Optional textbook chunks (not required for storage)
        
        Returns:
            True if answer should be stored
        """
        if not answer or len(answer) < 100:
            return False
        
        failure_markers = [
            "i cannot",
            "i'm unable to",
            "error occurred",
            "failed to",
            "exception",
            "something went wrong"
        ]
        
        answer_lower = answer.lower()
        for marker in failure_markers:
            if marker in answer_lower:
                return False
        
        return True
    
    def _verify_textbook_grounding(self, answer: str, textbook_chunks: list) -> float:
        """
        Verify that answer content is grounded in textbook chunks.
        
        Args:
            answer: Generated answer text
            textbook_chunks: Source textbook chunks
        
        Returns:
            Grounding score (0-1), higher = more grounded
        """
        if not textbook_chunks:
            return 0.0
        
        textbook_text = " ".join([
            c.get('text', '') for c in textbook_chunks
        ]).lower()
        
        textbook_words = set(re.findall(r'\b\w{4,}\b', textbook_text))
        
        answer_lower = answer.lower()
        answer_words = set(re.findall(r'\b\w{4,}\b', answer_lower))
        
        if not answer_words:
            return 0.0
        
        overlap = answer_words & textbook_words
        grounding_score = len(overlap) / len(answer_words)
        
        key_concepts = [
            'definition', 'formula', 'theorem', 'law', 'principle',
            'equation', 'method', 'process', 'example'
        ]
        
        concept_matches = sum(1 for concept in key_concepts 
                            if concept in textbook_text and concept in answer_lower)
        
        concept_bonus = min(concept_matches * 0.05, 0.2)
        
        return min(grounding_score + concept_bonus, 1.0)
    
    def _extract_topic(self, question: str) -> str:
        """
        Extract topic from question using keyword matching.
        
        Args:
            question: Student's question
        
        Returns:
            Extracted topic or 'general' if not found
        """
        question_lower = question.lower()
        
        math_topics = {
            'algebra': ['algebra', 'equation', 'variable', 'expression'],
            'geometry': ['geometry', 'triangle', 'circle', 'angle', 'area', 'perimeter'],
            'arithmetic': ['arithmetic', 'addition', 'subtraction', 'multiplication', 'division'],
            'trigonometry': ['trigonometry', 'sine', 'cosine', 'tangent', 'trig'],
            'calculus': ['calculus', 'derivative', 'integral', 'limit'],
            'statistics': ['statistics', 'probability', 'mean', 'median', 'mode'],
            'number_theory': ['prime', 'factor', 'divisibility', 'lcm', 'hcf', 'gcd'],
            'fractions': ['fraction', 'decimal', 'rational'],
            'ratio': ['ratio', 'proportion', 'percentage']
        }
        
        for topic, keywords in math_topics.items():
            for keyword in keywords:
                if keyword in question_lower:
                    return topic
        
        words = re.findall(r'\b\w+\b', question_lower)
        significant_words = [w for w in words if len(w) > 4 and w not in ['what', 'where', 'when', 'which', 'explain', 'define', 'calculate']]
        
        if significant_words:
            return significant_words[0]
        
        return 'general'
    
    def query_stored_answers(
        self,
        question: str,
        subject: str,
        top_k: int = 3,
        min_score: float = 0.7
    ) -> list:
        """
        Query stored LLM answers for similar questions.
        
        Args:
            question: Student's question
            subject: Subject to search in
            top_k: Number of results to return
            min_score: Minimum similarity score
        
        Returns:
            List of matching stored answers with scores
        """
        try:
            query_embedding = self._generate_embedding(question)
            
            results = pinecone_llm_db.query(
                vector=query_embedding,
                subject=subject,
                top_k=top_k
            )
            
            matching_answers = []
            for match in results.get('matches', []):
                score = match.get('score', 0)
                if score >= min_score:
                    metadata = match.get('metadata', {})
                    
                    pinecone_llm_db.increment_usage(match['id'], subject)
                    
                    matching_answers.append({
                        'text': metadata.get('answer', ''),
                        'score': score,
                        'source': 'llm_generated',
                        'topic': metadata.get('topic', 'general'),
                        'quality_score': metadata.get('quality_score', 0.9),
                        'usage_count': metadata.get('usage_count', 0) + 1
                    })
            
            if matching_answers:
                scores_list = [f"{a['score']:.2f}" for a in matching_answers]
                logger.info(f" Found {len(matching_answers)} stored LLM answers (scores: {scores_list})")
            
            return matching_answers
            
        except Exception as e:
            logger.error(f"Failed to query stored LLM answers: {e}")
            return []
    
    def get_storage_stats(self, subject: str = None) -> dict:
        """
        Get statistics about stored LLM content.
        
        Args:
            subject: Optional subject filter
        
        Returns:
            Dictionary with storage statistics
        """
        try:
            if not pinecone_llm_db.index:
                return {"error": "LLM DB not connected"}
            
            stats = pinecone_llm_db.index.describe_index_stats()
            
            if subject:
                namespace_stats = stats.get('namespaces', {}).get(subject.lower(), {})
                return {
                    "subject": subject,
                    "total_vectors": namespace_stats.get('vector_count', 0)
                }
            
            return {
                "total_vectors": stats.get('total_vector_count', 0),
                "namespaces": list(stats.get('namespaces', {}).keys())
            }
            
        except Exception as e:
            logger.error(f"Failed to get storage stats: {e}")
            return {"error": str(e)}

llm_storage_service = LLMStorageService()
