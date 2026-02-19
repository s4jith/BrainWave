"""
Flashcard Service - Generate flashcards from textbook chapters
"""

from typing import List, Dict, Optional
from app.db.mongo import pinecone_db
from app.services.gemini_service import gemini_service
import logging

logger = logging.getLogger(__name__)

class FlashcardService:
    """Generate flashcards from textbook content using AI."""
    
    def __init__(self):
        self.gemini = gemini_service
        self.pinecone = pinecone_db
    
    def generate_flashcards(
        self,
        subject: str,
        class_level: int,
        chapter_id: Optional[str] = None,
        count: int = 10
    ) -> List[Dict]:
        """
        Generate flashcards from textbook chunks.
        
        Args:
            subject: Subject name
            class_level: Class level
            chapter_id: Optional specific chapter
            count: Number of flashcards to generate
            
        Returns:
            List of flashcard dicts with 'front' (question) and 'back' (answer)
        """
        try:
            logger.info(f"🎴 Generating {count} flashcards for {subject} Class {class_level}")
            
            namespace = subject.lower().replace(" ", "_")
            
            sample_queries = [
                f"important concepts in {subject}",
                f"key terms and definitions in {subject}",
                f"main topics in Class {class_level} {subject}"
            ]
            
            all_chunks = []
            for query in sample_queries:
                try:
                    embedding = self.gemini.generate_embedding(query)
                    
                    results = self.pinecone.index.query(
                        namespace=namespace,
                        vector=embedding,
                        top_k=5,
                        include_metadata=True
                    )
                    
                    for match in results.get('matches', []):
                        if match.get('score', 0) >= 0.3:
                            text = match.get('metadata', {}).get('text', '')
                            if text and len(text) > 50:
                                all_chunks.append(text)
                except Exception as e:
                    logger.warning(f"Query failed: {e}")
                    continue
            
            if not all_chunks:
                logger.warning("No chunks found for flashcard generation")
                return []
            
            unique_chunks = list(set(all_chunks))[:15]
            combined_text = "\n\n---\n\n".join(unique_chunks)
            
            prompt = f"""Based on this Class {class_level} {subject} textbook content, create {count} flashcards for studying.

TEXTBOOK CONTENT:
{combined_text}

Generate exactly {count} flashcards in this JSON format:
[
  {{"front": "Question or term", "back": "Answer or definition"}},
  ...
]

Rules:
1. Questions should test key concepts, definitions, formulas, or facts
2. Answers should be concise but complete (1-3 sentences)
3. Suitable for Class {class_level} students
4. Mix of definition, concept, and application questions
5. Return ONLY the JSON array, no other text

JSON:"""
            
            response = self.gemini.generate_response(prompt)
            
            import json
            import re
            
            json_match = re.search(r'\[[\s\S]*\]', response)
            if json_match:
                flashcards = json.loads(json_match.group())
                logger.info(f"🎴 Generated {len(flashcards)} flashcards")
                return flashcards[:count]
            else:
                logger.warning("Could not parse flashcards from response")
                return []
                
        except Exception as e:
            logger.error(f" Flashcard generation failed: {e}")
            return []
    
    def get_saved_flashcards(
        self,
        user_id: str,
        subject: Optional[str] = None
    ) -> List[Dict]:
        """Get user's saved flashcard sets."""
        try:
            from app.db.mongo import mongodb
            db = mongodb.db
            
            filter_query = {"user_id": user_id}
            if subject:
                filter_query["subject"] = subject
                
            flashcard_sets = list(
                db["flashcard_sets"].find(filter_query)
                .sort("created_at", -1)
                .limit(20)
            )
            
            result = []
            for fs in flashcard_sets:
                result.append({
                    "id": str(fs["_id"]),
                    "subject": fs.get("subject"),
                    "class_level": fs.get("class_level"),
                    "card_count": len(fs.get("cards", [])),
                    "created_at": fs.get("created_at", "")
                })
            
            return result
            
        except Exception as e:
            logger.error(f" Get flashcards failed: {e}")
            return []

flashcard_service = FlashcardService()
