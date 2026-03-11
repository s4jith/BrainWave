"""
Smart Notes Service - Generate AI summaries from textbook chapters
"""

from typing import List, Dict, Optional
from app.db.mongo import pinecone_db, mongodb
from app.services.gemini_service import gemini_service
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class SmartNotesService:
    """Generate and manage AI-powered chapter summaries."""
    
    def __init__(self):
        self.gemini = gemini_service
        self.pinecone = pinecone_db
    
    def generate_chapter_summary(
        self,
        subject: str,
        class_level: int,
        chapter_title: str = None
    ) -> Dict:
        """
        Generate a comprehensive summary of a chapter.
        
        Args:
            subject: Subject name
            class_level: Class level  
            chapter_title: Optional chapter title to search for
            
        Returns:
            Dict with summary, key_points, important_terms
        """
        try:
            logger.info(f"📝 Generating summary for {subject} Class {class_level}")
            
            namespace = subject.lower().replace(" ", "_")
            
            query = chapter_title or f"main topics in Class {class_level} {subject}"
            embedding = self.gemini.generate_embedding(query)
            
            results = self.pinecone.index.query(
                namespace=namespace,
                vector=embedding,
                top_k=15,
                include_metadata=True
            )
            
            chunks = []
            for match in results.get('matches', []):
                if match.get('score', 0) >= 0.25:
                    text = match.get('metadata', {}).get('text', '')
                    if text and len(text) > 50:
                        chunks.append(text)
            
            if not chunks:
                return {
                    "success": False,
                    "message": "No content found for this chapter",
                    "summary": "",
                    "key_points": [],
                    "important_terms": []
                }
            
            combined_text = "\n\n".join(chunks[:12])
            
            prompt = f"""Based on this Class {class_level} {subject} textbook content, create comprehensive study notes.

TEXTBOOK CONTENT:
{combined_text}

Generate study notes in this exact JSON format:
{{
  "summary": "A 3-4 paragraph comprehensive summary of the main concepts",
  "key_points": ["Point 1", "Point 2", "Point 3", "Point 4", "Point 5"],
  "important_terms": [
    {{"term": "Term 1", "definition": "Definition 1"}},
    {{"term": "Term 2", "definition": "Definition 2"}}
  ],
  "formulas": ["Formula 1 (if applicable)", "Formula 2"],
  "study_tips": ["Tip 1", "Tip 2"]
}}

Rules:
1. Summary should be clear and easy to understand for Class {class_level} students
2. Include at least 5 key points
3. Include at least 3 important terms with definitions
4. Include formulas only if present in the content
5. Return ONLY valid JSON, no other text

JSON:"""
            
            response = self.gemini.generate_response(prompt)
            
            import json
            import re
            
            json_match = re.search(r'\{[\s\S]*\}', response)
            if json_match:
                notes = json.loads(json_match.group())
                notes["success"] = True
                notes["subject"] = subject
                notes["class_level"] = class_level
                notes["chapter"] = chapter_title or "Overview"
                logger.info(f"📝 Generated summary: {len(notes.get('summary', ''))} chars")
                return notes
            else:
                logger.warning("Could not parse notes from response")
                return {
                    "success": False,
                    "message": "Failed to generate structured notes",
                    "raw_response": response[:500]
                }
                
        except Exception as e:
            logger.error(f" Smart notes generation failed: {e}")
            return {
                "success": False,
                "message": str(e)
            }
    
    def save_notes(
        self,
        user_id: str,
        subject: str,
        class_level: int,
        title: str,
        content: Dict
    ) -> str:
        """Save generated notes for a user."""
        try:
            db = mongodb.db
            notes_col = db["smart_notes"]
            
            doc = {
                "user_id": user_id,
                "subject": subject,
                "class_level": class_level,
                "title": title,
                "content": content,
                "created_at": datetime.now().isoformat()
            }
            
            result = notes_col.insert_one(doc)
            logger.info(f"💾 Saved notes for user {user_id}")
            return str(result.inserted_id)
            
        except Exception as e:
            logger.error(f" Save notes failed: {e}")
            return None
    
    def get_user_notes(
        self,
        user_id: str,
        subject: Optional[str] = None,
        limit: int = 20
    ) -> List[Dict]:
        """Get user's saved notes."""
        try:
            db = mongodb.db
            notes_col = db["smart_notes"]
            
            filter_query = {"user_id": user_id}
            if subject:
                filter_query["subject"] = subject
            
            notes = list(
                notes_col.find(filter_query)
                .sort("created_at", -1)
                .limit(limit)
            )
            
            result = []
            for n in notes:
                result.append({
                    "id": str(n["_id"]),
                    "subject": n.get("subject"),
                    "class_level": n.get("class_level"),
                    "title": n.get("title"),
                    "created_at": n.get("created_at", "")
                })
            
            return result
            
        except Exception as e:
            logger.error(f" Get notes failed: {e}")
            return []

smart_notes_service = SmartNotesService()
