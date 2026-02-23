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
            
            response = response.strip()
            if response.startswith("```json"):
                response = response[7:]
            if response.endswith("```"):
                response = response[:-3]
            
            data = json.loads(response)
            
            detected = data.get("detected_subject", "Unknown")
            if detected.lower() in ["math", "maths", "mathematics"]: 
                detected = "Maths"
            
            data["detected_subject"] = detected
            return data
            
        except Exception as e:
            logger.error(f"Subject classification failed: {e}")
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
- Physics: Forces, motion, energy, electricity, optics, units, Newton's laws, gravitation, thermodynamics (physical aspect), speed, velocity, acceleration, waves, sound, light, magnetism, pressure, work-energy theorem
- Chemistry: Elements, reactions, atomic structure, periodic table, bonding, thermodynamics (chemical aspect), stoichiometry, acids, bases, salts, carbon compounds
- Mathematics: Algebra, geometry, calculus, numbers, probability, equations (y=mx+c), trigonometry, arithmetic, fractions, percentages, profit-loss, area, volume, statistics, polynomials, quadratic equations
- Biology: Living organisms, cells, genetics, human body, plants, ecology, classification, reproduction
- English: Grammar, literature, comprehension, poetry
- Hindi: Grammar, literature, poems (in Hindi/Devanagari)
- Social Science: History, geography, civics, economics

IMPORTANT DISAMBIGUATION RULES:
- "Newton's Laws" is PHYSICS.
- "y = mx + c" is MATHEMATICS.
- The word "sum" or "solve this sum" is AMBIGUOUS — it can mean:
  * A Physics numerical problem (if context mentions force, motion, energy, current, etc.)
  * A Mathematics arithmetic/algebra problem (if context mentions numbers, equations, area, etc.)
  Use surrounding keywords to decide. Do NOT default to one subject.
- "problem" and "question" are generic — classify by the TOPIC, not the word "problem".
- Be precise. Do not use generic "Science" if a specific subject applies.

Return ONLY a JSON object:
{{
    "detected_subject": "Subject Name",
    "confidence": 0.95,
    "reasoning": "Brief explanation",
    "keywords": ["key", "words"]
}}"""

subject_classifier = SubjectClassifier()
