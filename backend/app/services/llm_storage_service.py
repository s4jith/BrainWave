"""
LLM Storage Service
Stores high-quality LLM-generated answers for reuse and knowledge building.
"""

from sentence_transformers import SentenceTransformer
from app.db.mongo import pinecone_llm_db
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
        """Initialize LLM storage service with embedding model."""
        self.embedding_model = SentenceTransformer('sentence-transformers/all-mpnet-base-v2')
        logger.info("✅ LLM Storage Service initialized with sentence-transformers")
    
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
            # Check if answer should be stored (includes textbook verification)
            if not self._should_store_answer(answer, textbook_chunks):
                logger.debug(f"Answer not stored - quality check failed")
                return False
            
            # Extract topic if not provided
            if not topic:
                topic = self._extract_topic(question)
            
            # Generate embedding from question
            question_embedding = self.embedding_model.encode(question).tolist()
            
            # Create unique ID
            question_hash = hashlib.md5(question.lower().strip().encode()).hexdigest()[:16]
            vector_id = f"llm_{subject.lower()}_{class_level}_{topic.lower()}_{question_hash}"
            
            # Generate source fingerprint for verification
            source_fingerprint = self._generate_source_fingerprint(textbook_chunks) if textbook_chunks else None
            
            # Store in Pinecone LLM DB with enhanced metadata
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
                logger.info(f"✅ Stored LLM answer [{grounded_status}] for: {topic} (Class {class_level}, {subject})")
            
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
        
        # Combine first 5 chunks for fingerprint
        combined_text = " ".join([
            c.get('text', '')[:200] for c in textbook_chunks[:5]
        ])
        return hashlib.md5(combined_text.encode()).hexdigest()[:16]
    
    def _should_store_answer(self, answer: str, textbook_chunks: list = None) -> bool:
        """
        Check if answer meets quality criteria for storage.
        
        Criteria:
        - Sufficient length (>200 characters)
        - No hallucination markers
        - Contains educational content
        - Not error messages
        
        Args:
            answer: Generated answer text
        
        Returns:
            True if answer should be stored
        """
        if not answer or len(answer) < 200:
            return False
        
        # Check for hallucination markers
        hallucination_markers = [
            "i don't have information",
            "i cannot find",
            "no information available",
            "not mentioned in the context",
            "according to my knowledge",
            "as an ai",
            "i apologize",
            "i'm sorry"
        ]
        
        answer_lower = answer.lower()
        for marker in hallucination_markers:
            if marker in answer_lower:
                return False
        
        # Check for error patterns
        error_patterns = [
            "error",
            "failed",
            "exception",
            "not found"
        ]
        
        # Allow if error patterns are in educational context
        has_errors = any(pattern in answer_lower for pattern in error_patterns)
        if has_errors and len(answer) < 500:
            return False
        
        # Check for educational content indicators
        educational_indicators = [
            "formula",
            "theorem",
            "definition",
            "example",
            "step",
            "method",
            "property",
            "rule",
            "concept",
            "understand",
            "calculate",
            "solve",
            "equation"
        ]
        
        has_educational_content = any(indicator in answer_lower for indicator in educational_indicators)
        
        # Must have educational content
        if not has_educational_content:
            logger.debug("Answer lacks educational content indicators")
            return False
        
        # NEW: Textbook grounding verification
        if textbook_chunks:
            grounding_score = self._verify_textbook_grounding(answer, textbook_chunks)
            if grounding_score < 0.3:  # Less than 30% overlap
                logger.warning(f"⚠️ Answer not grounded in textbook (score: {grounding_score:.2f}) - NOT storing")
                return False
            logger.info(f"✅ Answer grounding verified (score: {grounding_score:.2f})")
        
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
        
        # Combine textbook content
        textbook_text = " ".join([
            c.get('text', '') for c in textbook_chunks
        ]).lower()
        
        # Extract key terms from textbook
        textbook_words = set(re.findall(r'\b\w{4,}\b', textbook_text))
        
        # Extract key terms from answer
        answer_lower = answer.lower()
        answer_words = set(re.findall(r'\b\w{4,}\b', answer_lower))
        
        if not answer_words:
            return 0.0
        
        # Calculate word overlap
        overlap = answer_words & textbook_words
        grounding_score = len(overlap) / len(answer_words)
        
        # Bonus: Check for key concept matches
        key_concepts = [
            'definition', 'formula', 'theorem', 'law', 'principle',
            'equation', 'method', 'process', 'example'
        ]
        
        concept_matches = sum(1 for concept in key_concepts 
                            if concept in textbook_text and concept in answer_lower)
        
        # Add concept bonus (up to 0.2)
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
        
        # Common math topics
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
        
        # Check for topic keywords
        for topic, keywords in math_topics.items():
            for keyword in keywords:
                if keyword in question_lower:
                    return topic
        
        # Extract first significant word as topic
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
            # Generate query embedding
            query_embedding = self.embedding_model.encode(question).tolist()
            
            # Query Pinecone LLM DB
            results = pinecone_llm_db.query(
                vector=query_embedding,
                subject=subject,
                top_k=top_k
            )
            
            # Filter by score and format results
            matching_answers = []
            for match in results.get('matches', []):
                score = match.get('score', 0)
                if score >= min_score:
                    metadata = match.get('metadata', {})
                    
                    # Increment usage count
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
                logger.info(f"🔍 Found {len(matching_answers)} stored LLM answers (scores: {scores_list})")
            
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


# Global instance
llm_storage_service = LLMStorageService()
