"""
Subject Classifier Service

Uses Gemini to classify student questions into specific NCERT subjects.
Used to prevent hallucination by verifying if the question matches the current subject context.
"""

import logging
import json
from typing import Dict, Optional
from app.services.gemini_service import gemini_service

logger = logging.getLogger(__name__)

class SubjectClassifier:
    """Service to classify questions into NCERT subjects."""
    
    def __init__(self):
        self.gemini = gemini_service
        self.valid_subjects = [
            "Physics", "Chemistry", "Maths", "Biology", 
            "Science", "English", "Hindi", "Social Science"
        ]
        logger.info("SubjectClassifier initialized")
    
    async def classify(self, question: str) -> Dict:
        """
        Classify a question into a subject.
        
        Returns:
            Dict containing:
            - detected_subject: str
            - confidence: float
            - reasoning: str
            - keywords: List[str]
        """
        try:
            prompt = self._build_classification_prompt(question)
            response = self.gemini.generate_response(prompt)
            
            # Clean response to ensure valid JSON
            response = response.strip()
            if response.startswith("```json"):
                response = response[7:]
            if response.endswith("```"):
                response = response[:-3]
            
            data = json.loads(response)
            
            # Normalize detected subject
            detected = data.get("detected_subject", "Unknown")
            # Map common variations
            if detected.lower() in ["math", "maths", "mathematics"]: 
                detected = "Maths"
            
            data["detected_subject"] = detected
            return data
            
        except Exception as e:
            logger.error(f"Subject classification failed: {e}")
            # Fail open - assume correct subject if classification fails
            return {
                "detected_subject": "Unknown",
                "confidence": 0.0,
                "reasoning": "Classification failed",
                "keywords": []
            }
            
    def _build_classification_prompt(self, question: str) -> str:
        return f"""ANALYZE this student question and classify its subject.

QUESTION: "{question}"

VALID SUBJECTS: {', '.join(self.valid_subjects)}

CRITERIA:
- Physics: Forces, motion, energy, electricity, optics, units, Newton's laws, gravitation, thermodynamics (physical aspect)
- Chemistry: Elements, reactions, atomic structure, periodic table, bonding, thermodynamics (chemical aspect), stoichiometry
- Mathematics: Algebra, geometry, calculus, numbers, probability, equations (y=mx+c), trigonometry
- Biology: Living organisms, cells, genetics, human body, plants
- English: Grammar, literature, comprehension, poetry
- Hindi: Grammar, literature, poems (in Hindi/Devanagari)
- Social Science: History, geography, civics, economics

IMPORTANT:
- "Newton's Laws" is PHYSICS.
- "y = mx + c" is MATHEMATICS.
- Be precise. Do not use generic "Science" if a specific subject applies.

Return ONLY a JSON object:
{{
    "detected_subject": "Subject Name",
    "confidence": 0.95,
    "reasoning": "Brief explanation",
    "keywords": ["key", "words"]
}}"""

# Singleton instance
subject_classifier = SubjectClassifier()
