"""
Optimized RAG Service - 2-Call Maximum for Sustainable Deployment

Intel-optimized: Uses OpenVINO LaBSE for embeddings (eliminates Gemini embedding calls).

CRITICAL OPTIMIZATION:
- Before: 5 Gemini calls per query (quota exhausted in 40 chats/day)
- After: 2 calls max (embedding via OpenVINO + 1 generation)
- Result: 200+ chats/day sustainable

Flow:
1. Language detection → langdetect library (0 Gemini calls)
2. Query embedding → OpenVINO LaBSE (0 Gemini calls)
3. Batch Pinecone retrieval → Multi-namespace search
4. Answer generation → 1 Gemini call with all chunks

Maps to OPEA OrchestratorService with quota optimization.
"""

import logging
import hashlib
import time
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from functools import lru_cache

# Import Subject Classifier
from app.services.subject_classifier import subject_classifier

logger = logging.getLogger(__name__)


# ==================== API CALL TRACKER ====================

class APICallTracker:
    """Track Gemini API calls for monitoring and optimization."""
    
    def __init__(self):
        self.calls = []
        self.start_time = time.time()
    
    def record_call(self, call_type: str, tokens_used: int = 0):
        """Record a Gemini API call."""
        self.calls.append({
            "type": call_type,
            "timestamp": time.time(),
            "tokens": tokens_used
        })
    
    def get_stats(self) -> Dict:
        """Get API usage statistics."""
        now = time.time()
        last_hour = [c for c in self.calls if now - c["timestamp"] < 3600]
        last_day = [c for c in self.calls if now - c["timestamp"] < 86400]
        
        return {
            "total_calls": len(self.calls),
            "calls_last_hour": len(last_hour),
            "calls_last_day": len(last_day),
            "uptime_hours": (now - self.start_time) / 3600,
            "avg_calls_per_hour": len(last_day) / 24 if last_day else 0
        }
    
    def reset(self):
        """Reset call history."""
        self.calls = []


# Global tracker
api_tracker = APICallTracker()


# ==================== CACHING LAYER ====================

class EmbeddingCache:
    """In-memory cache for embeddings (Redis-compatible interface)."""
    
    def __init__(self, max_size: int = 1000):
        self._cache = {}
        self._access_times = {}
        self.max_size = max_size
        self.hits = 0
        self.misses = 0
    
    def _make_key(self, text: str, lang: str) -> str:
        """Create cache key from text and language."""
        text_hash = hashlib.md5(text.encode()).hexdigest()[:16]
        return f"embed:{text_hash}:{lang}"
    
    def get(self, text: str, lang: str) -> Optional[List[float]]:
        """Get cached embedding."""
        key = self._make_key(text, lang)
        if key in self._cache:
            self.hits += 1
            self._access_times[key] = time.time()
            return self._cache[key]
        self.misses += 1
        return None
    
    def set(self, text: str, lang: str, embedding: List[float]):
        """Cache an embedding."""
        # Evict oldest if full
        if len(self._cache) >= self.max_size:
            oldest_key = min(self._access_times, key=self._access_times.get)
            del self._cache[oldest_key]
            del self._access_times[oldest_key]
        
        key = self._make_key(text, lang)
        self._cache[key] = embedding
        self._access_times[key] = time.time()
    
    def get_stats(self) -> Dict:
        """Get cache statistics."""
        total = self.hits + self.misses
        return {
            "size": len(self._cache),
            "max_size": self.max_size,
            "hits": self.hits,
            "misses": self.misses,
            "hit_rate": self.hits / total if total > 0 else 0
        }


class AnswerCache:
    """In-memory cache for full RAG answers."""
    
    def __init__(self, max_size: int = 500, ttl_hours: int = 24):
        self._cache = {}
        self._timestamps = {}
        self.max_size = max_size
        self.ttl_seconds = ttl_hours * 3600
        self.hits = 0
        self.misses = 0
    
    def _make_key(self, question: str, subject: str, class_level: int) -> str:
        """Create cache key."""
        q_hash = hashlib.md5(question.lower().strip().encode()).hexdigest()[:16]
        return f"rag:{q_hash}:{subject}:{class_level}"
    
    def get(self, question: str, subject: str, class_level: int) -> Optional[Dict]:
        """Get cached answer."""
        key = self._make_key(question, subject, class_level)
        
        if key in self._cache:
            # Check TTL
            if time.time() - self._timestamps[key] < self.ttl_seconds:
                self.hits += 1
                return self._cache[key]
            else:
                # Expired
                del self._cache[key]
                del self._timestamps[key]
        
        self.misses += 1
        return None
    
    def set(self, question: str, subject: str, class_level: int, answer: Dict):
        """Cache an answer."""
        if len(self._cache) >= self.max_size:
            # Evict oldest
            oldest_key = min(self._timestamps, key=self._timestamps.get)
            del self._cache[oldest_key]
            del self._timestamps[oldest_key]
        
        key = self._make_key(question, subject, class_level)
        self._cache[key] = answer
        self._timestamps[key] = time.time()
    
    def get_stats(self) -> Dict:
        """Get cache statistics."""
        total = self.hits + self.misses
        return {
            "size": len(self._cache),
            "hits": self.hits,
            "misses": self.misses,
            "hit_rate": self.hits / total if total > 0 else 0
        }


# Global caches
embedding_cache = EmbeddingCache(max_size=2000)
answer_cache = AnswerCache(max_size=1000)


# ==================== POPULAR HINDI QUERIES CACHE ====================

# Pre-computed responses for frequently asked Hindi literature questions
POPULAR_HINDI_QUERIES = {
    "माँ कह एक कहानी": {
        "summary": "यह एक प्रसिद्ध हिंदी कविता है जो माँ की कहानी सुनाने की परंपरा को दर्शाती है।",
        "class": 7,
        "subject": "hindi"
    },
    "जहाँ सुरभि मनभावनी": {
        "summary": "यह कविता प्रकृति की सुंदरता और खुशबू का वर्णन करती है।",
        "class": 7,
        "subject": "hindi"
    },
    "प्रकाश संश्लेषण": {
        "summary": "प्रकाश संश्लेषण वह प्रक्रिया है जिसमें पौधे सूर्य की रोशनी का उपयोग करके भोजन बनाते हैं।",
        "class": 9,
        "subject": "science"
    }
}


# ==================== OPTIMIZED RAG SERVICE ====================

@dataclass
class OptimizedConfig:
    """Configuration for optimized RAG service."""
    max_gemini_calls: int = 2
    skip_web_for_annotation: bool = True
    skip_web_for_literature: bool = True
    use_openvino_embeddings: bool = True
    cache_enabled: bool = True
    fallback_to_gemini_embed: bool = True


class OptimizedRagService:
    """
    Optimized RAG Service with 2-call maximum.
    
    Intel-optimized: Uses OpenVINO LaBSE for embeddings.
    
    Key optimizations:
    1. Language detection via langdetect (0 Gemini calls)
    2. Embeddings via OpenVINO LaBSE (0 Gemini calls)
    3. Batch Pinecone retrieval across namespaces
    4. Single Gemini call for answer generation
    5. In-memory caching for frequent queries
    
    Result: 60% reduction in Gemini API calls.
    """
    
    def __init__(self, config: Optional[OptimizedConfig] = None):
        self.config = config or OptimizedConfig()
        
        # Services - lazy loaded
        self._multilingual_service = None
        self._gemini_service = None
        self._pinecone_index = None
        
        # Metrics
        self.queries_processed = 0
        self.gemini_calls_saved = 0
        
        logger.info("✅ OptimizedRagService initialized (max 2 Gemini calls/query)")
    
    @property
    def multilingual_service(self):
        """Lazy load multilingual service."""
        if self._multilingual_service is None:
            try:
                from app.services.openvino_multilingual_service import multilingual_service
                self._multilingual_service = multilingual_service
            except Exception as e:
                logger.warning(f"Multilingual service not available: {e}")
        return self._multilingual_service
    
    @property
    def gemini_service(self):
        """Lazy load Gemini service."""
        if self._gemini_service is None:
            from app.services.gemini_service import gemini_service
            self._gemini_service = gemini_service
        return self._gemini_service
    
    @property
    def pinecone_index(self):
        """Lazy load Pinecone index."""
        if self._pinecone_index is None:
            from app.db.mongo import get_pinecone_index
            self._pinecone_index = get_pinecone_index()
        return self._pinecone_index
    
    def detect_language(self, text: str) -> str:
        """
        Detect language using langdetect (0 Gemini calls).
        
        Returns: Language code (en, hi, ur, ta, etc.)
        """
        try:
            from langdetect import detect
            lang = detect(text)
            
            # Map to our supported languages
            supported = ["en", "hi", "ur", "ta", "te", "bn", "mr", "gu", "kn", "ml", "pa"]
            if lang in supported:
                return lang
            
            # Fallback: check for Hindi/Urdu scripts
            if self.multilingual_service:
                return self.multilingual_service.detect_language(text)
            
            return "en"
        except Exception as e:
            logger.debug(f"Language detection failed: {e}")
            return "en"
    
    def get_embedding(self, text: str, lang: str = "en") -> List[float]:
        """
        Get embedding using OpenVINO LaBSE (0 Gemini calls) or cache.
        
        Falls back to Gemini embeddings if OpenVINO unavailable.
        """
        # Check cache first
        if self.config.cache_enabled:
            cached = embedding_cache.get(text, lang)
            if cached:
                logger.debug("📦 Embedding cache hit")
                return cached
        
        # Try OpenVINO LaBSE (Intel-optimized, 0 Gemini calls)
        if self.config.use_openvino_embeddings and self.multilingual_service:
            try:
                if self.multilingual_service.is_available():
                    embedding = self.multilingual_service.generate_embedding(text, lang)
                    if embedding and len(embedding) > 0:
                        if self.config.cache_enabled:
                            embedding_cache.set(text, lang, embedding)
                        self.gemini_calls_saved += 1
                        return embedding
            except Exception as e:
                logger.debug(f"OpenVINO embedding failed: {e}")
        
        # Fallback to Gemini (1 call)
        if self.config.fallback_to_gemini_embed:
            try:
                import google.generativeai as genai
                from app.services.gemini_key_manager import gemini_key_manager
                
                api_key = gemini_key_manager.get_available_key()
                genai.configure(api_key=api_key)
                
                result = genai.embed_content(
                    model="models/text-embedding-004",
                    content=text,
                    task_type="retrieval_query"
                )
                embedding = result['embedding']
                
                api_tracker.record_call("embedding")
                
                if self.config.cache_enabled:
                    embedding_cache.set(text, lang, embedding)
                
                return embedding
            except Exception as e:
                logger.error(f"Gemini embedding failed: {e}")
        
        return [0.0] * 768  # Zero vector fallback
    
    def batch_retrieve(
        self,
        query_embedding: List[float],
        namespaces: List[str],
        top_k: int = 5
    ) -> List[Dict]:
        """
        Batch retrieve from multiple Pinecone namespaces.
        
        Args:
            query_embedding: Query vector
            namespaces: List of namespaces to search
            top_k: Results per namespace
        
        Returns:
            Combined and ranked chunks
        """
        all_chunks = []
        
        for namespace in namespaces:
            try:
                results = self.pinecone_index.query(
                    vector=query_embedding,
                    namespace=namespace,
                    top_k=top_k,
                    include_metadata=True
                )
                
                for match in results.get('matches', []):
                    all_chunks.append({
                        "text": match.get('metadata', {}).get('text', ''),
                        "score": match.get('score', 0),
                        "namespace": namespace,
                        "class": match.get('metadata', {}).get('class'),
                        "chapter": match.get('metadata', {}).get('chapter')
                    })
            except Exception as e:
                logger.debug(f"Namespace {namespace} query failed: {e}")
        
        # Sort by score and deduplicate
        all_chunks.sort(key=lambda x: x['score'], reverse=True)
        
        # CONFIDENCE THRESHOLD: Filter out low relevance chunks to prevent hallucination
        # OpenVINO LaBSE scores: >0.7 is good, <0.6 is usually irrelevant
        CONFIDENCE_THRESHOLD = 0.68
        
        high_confidence_chunks = [c for c in all_chunks if c['score'] >= CONFIDENCE_THRESHOLD]
        
        # If we have high confidence chunks, use only those. 
        # Otherwise, keep top 2 results but flag them.
        if high_confidence_chunks:
            all_chunks = high_confidence_chunks
        else:
            logger.warning(f"⚠️ Low confidence retrieval (Top score: {all_chunks[0]['score'] if all_chunks else 0:.4f})")
            # Keep extremely few chunks if confidence is low to avoid noise
            all_chunks = all_chunks[:2]
        
        # Deduplicate by text content
        seen_texts = set()
        unique_chunks = []
        for chunk in all_chunks:
            text_hash = hashlib.md5(chunk['text'].encode()).hexdigest()
            if text_hash not in seen_texts:
                seen_texts.add(text_hash)
                unique_chunks.append(chunk)
        
        return unique_chunks[:top_k * 2]  # Return top 2x results
    
    def build_rag_prompt(
        self,
        question: str,
        chunks: List[Dict],
        mode: str,
        lang: str,
        class_level: int,
        subject: str
    ) -> str:
        """
        Build optimized RAG prompt with all context.
        
        Single prompt = single Gemini call.
        """
        # Build context
        context_parts = []
        for i, chunk in enumerate(chunks[:10]):  # Max 10 chunks
            ns = chunk.get('namespace', '')
            score = chunk.get('score', 0)
            context_parts.append(f"[Source {i+1} ({ns}, relevance: {score:.2f})]:\n{chunk['text']}")
        
        combined_context = "\n\n".join(context_parts)
        
        # Language instruction
        lang_names = {
            "hi": "Hindi", "ur": "Urdu", "ta": "Tamil", "te": "Telugu",
            "bn": "Bengali", "mr": "Marathi", "gu": "Gujarati",
            "kn": "Kannada", "ml": "Malayalam", "pa": "Punjabi"
        }
        
        lang_instruction = ""
        if lang != "en" and lang in lang_names:
            lang_instruction = f"\n\n**IMPORTANT**: Respond entirely in {lang_names[lang]} using the same script as the question."
        
        # Mode-specific instructions
        if mode in ["annotation", "define"]:
            instructions = """
1. Provide a clear, concise definition
2. Add 2-3 key points
3. Keep under 150 words
4. Use ONLY the provided context"""
        elif mode in ["elaborate", "deepdive"]:
            instructions = """
1. Start with fundamentals
2. Build understanding progressively
3. Include examples from the context
4. Keep response comprehensive but focused"""
        else:
            instructions = """
1. Answer the question directly using the context
2. Be clear and appropriate for the student's level
3. Include examples if available"""
        
        prompt = f"""You are a helpful tutor for Class {class_level} {subject} students.

QUESTION: {question}

CONTEXT FROM TEXTBOOKS:
{combined_context}

CRITICAL RULES (NO HALLUCINATION):
1. ONLY use information strictly from the CONTEXT provided above.
2. If the context does NOT contain the answer, say "I don't have enough information in the textbook to answer this."
3. Do NOT make up facts, tables, or numbers.
4. If the question asks about a table or image, answer ONLY if it is described in the context.

INSTRUCTIONS:{instructions}{lang_instruction}

Answer:"""
        
        return prompt
    
    async def chat(
        self,
        question: str,
        class_level: int,
        subject: str,
        mode: str = "quick",
        chapter: Optional[int] = None
    ) -> Dict:
        """
        Optimized chat with maximum 2 Gemini API calls.
        
        Intel-optimized: Uses OpenVINO for embeddings.
        
        Flow:
        1. Language detection (langdetect, 0 calls)
        2. Embedding (OpenVINO LaBSE or 1 Gemini call)
        3. Batch Pinecone retrieval (0 calls)
        4. Answer generation (1 Gemini call)
        
        Total: 1-2 Gemini calls (vs 5 before)
        """
        self.queries_processed += 1
        gemini_calls_before = len(api_tracker.calls)
        
        # Check answer cache
        if self.config.cache_enabled:
            cached = answer_cache.get(question, subject, class_level)
            if cached:
                logger.info("📦 Answer cache hit!")
                return {**cached, "cached": True, "gemini_calls": 0}
        
        # Check popular queries cache
        q_lower = question.lower().strip()
        for popular_q, data in POPULAR_HINDI_QUERIES.items():
            if popular_q in q_lower:
                logger.info(f"📚 Popular query matched: {popular_q}")
                return {
                    "answer": data["summary"],
                    "sources": [],
                    "lang": "hi",
                    "cached": True,
                    "gemini_calls": 0
                }
        
        # STEP 0: Subject Validation (0 Gemini calls - runs in parallel/optimized)
        # Validate that the question matches the subject
        subject_check = await subject_classifier.classify(question)
        detected_subject = subject_check.get("detected_subject", "Unknown")
        confidence = subject_check.get("confidence", 0)
        
        # Only block if high confidence mismatch
        # Allow "Science" to match Physics/Chem/Bio
        is_science = subject.lower() in ["science", "physics", "chemistry", "biology"]
        detected_is_science = detected_subject.lower() in ["science", "physics", "chemistry", "biology"]
        
        # Lower threshold to 0.60 to ensure we catch mismatches
        # User explicitly requested strict checking
        if confidence > 0.60 and detected_subject.lower() != subject.lower():
             logger.warning(f"⚠️ Subject mismatch: User={subject}, Detected={detected_subject}")
             return {
                 "answer": "The specific topic is not present in the book. Change the book or question.",
                 "blocked": True,
                 "detected_subject": detected_subject,
                 "lang": "en",
                 "sources": [],
                 "gemini_calls": 0
             }
        
        # STEP 1: Language detection (0 Gemini calls)
        lang = self.detect_language(question)
        logger.info(f"🌐 Detected language: {lang}")
        
        # STEP 2: Get embedding (OpenVINO = 0 calls, fallback = 1 call)
        query_embedding = self.get_embedding(question, lang)
        
        # STEP 3: Batch retrieve from relevant namespaces
        namespaces = [
            f"{subject.lower()}",
            f"{subject.lower()}-{lang}" if lang != "en" else None,
            f"{subject.lower()}-en" if lang != "en" else None
        ]
        namespaces = [n for n in namespaces if n]  # Remove None
        
        chunks = self.batch_retrieve(query_embedding, namespaces, top_k=5)
        logger.info(f"📚 Retrieved {len(chunks)} chunks from {len(namespaces)} namespaces")
        
        # Skip web for annotation/literature (optimization)
        skip_web = (
            self.config.skip_web_for_annotation and mode in ["annotation", "define"] or
            self.config.skip_web_for_literature and subject.lower() in ["hindi", "urdu", "english"]
        )
        
        if not skip_web and not chunks:
            # Could add web retrieval here, but we're optimizing
            logger.info("⏭️ Skipping web retrieval for optimization")
        
        # STEP 4: Single Gemini call for answer generation
        prompt = self.build_rag_prompt(question, chunks, mode, lang, class_level, subject)
        
        try:
            answer = self.gemini_service.generate_response(prompt)
            api_tracker.record_call("generation")
        except Exception as e:
            logger.error(f"Generation failed: {e}")
            answer = "I'm sorry, I couldn't generate an answer. Please try again."
        
        # Calculate calls used
        gemini_calls_after = len(api_tracker.calls)
        calls_used = gemini_calls_after - gemini_calls_before
        
        logger.info(f"✅ Optimized query complete: {calls_used} Gemini calls (target: ≤2)")
        
        result = {
            "answer": answer,
            "sources": [c["text"][:200] for c in chunks[:5]],
            "lang": lang,
            "cached": False,
            "gemini_calls": calls_used,
            "chunks_used": len(chunks)
        }
        
        # Cache the result
        if self.config.cache_enabled and answer and len(answer) > 50:
            answer_cache.set(question, subject, class_level, result)
        
        return result
    
    def get_stats(self) -> Dict:
        """Get optimization statistics."""
        return {
            "queries_processed": self.queries_processed,
            "gemini_calls_saved": self.gemini_calls_saved,
            "embedding_cache": embedding_cache.get_stats(),
            "answer_cache": answer_cache.get_stats(),
            "api_tracker": api_tracker.get_stats(),
            "config": {
                "max_calls": self.config.max_gemini_calls,
                "openvino_embeddings": self.config.use_openvino_embeddings,
                "caching": self.config.cache_enabled
            }
        }


# Singleton instance
optimized_rag_service = OptimizedRagService()
