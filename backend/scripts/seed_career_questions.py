"""
Seed script for Career Analysis questions.

Run:  python -m scripts.seed_career_questions
      (from the backend/ directory with venv active)

Inserts 45 sample questions (15 per difficulty) covering all 8 cognitive domains.
Skips if questions already exist.
"""

import asyncio
import sys
import os
from datetime import datetime, timezone

# Add the backend directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings


SAMPLE_QUESTIONS = [
    # ═══ DIFFICULTY 1 (Easy) ═══════════════════════════════════════════════════
    {
        "subject": "Math",
        "question_text": "What is 15% of 200?",
        "options": ["20", "25", "30", "35"],
        "correct_answer": 2,
        "difficulty": 1,
        "domain_weights": {"QA": 0.8, "LOG": 0.2},
    },
    {
        "subject": "Biology",
        "question_text": "Which organ in the human body is responsible for pumping blood?",
        "options": ["Liver", "Heart", "Lungs", "Kidney"],
        "correct_answer": 1,
        "difficulty": 1,
        "domain_weights": {"BIO": 0.9, "SCI": 0.1},
    },
    {
        "subject": "Logic",
        "question_text": "If all cats are animals and all animals breathe, what can we conclude about cats?",
        "options": ["Cats can fly", "Cats breathe", "Cats are plants", "Cats don't breathe"],
        "correct_answer": 1,
        "difficulty": 1,
        "domain_weights": {"LOG": 0.9, "VERB": 0.1},
    },
    {
        "subject": "Programming",
        "question_text": "What does HTML stand for?",
        "options": [
            "Hyper Text Markup Language",
            "High Tech Modern Language",
            "Hyper Transfer Markup Language",
            "Home Tool Markup Language",
        ],
        "correct_answer": 0,
        "difficulty": 1,
        "domain_weights": {"COMP": 0.8, "LOG": 0.2},
    },
    {
        "subject": "English",
        "question_text": "Choose the correct synonym for 'Happy'.",
        "options": ["Sad", "Joyful", "Angry", "Tired"],
        "correct_answer": 1,
        "difficulty": 1,
        "domain_weights": {"VERB": 0.9, "SOC": 0.1},
    },
    {
        "subject": "Physics",
        "question_text": "What is the SI unit of force?",
        "options": ["Joule", "Watt", "Newton", "Pascal"],
        "correct_answer": 2,
        "difficulty": 1,
        "domain_weights": {"SCI": 0.8, "QA": 0.2},
    },
    {
        "subject": "General Knowledge",
        "question_text": "Which planet is known as the Red Planet?",
        "options": ["Venus", "Mars", "Jupiter", "Saturn"],
        "correct_answer": 1,
        "difficulty": 1,
        "domain_weights": {"SCI": 0.7, "LOG": 0.3},
    },
    {
        "subject": "Art & Design",
        "question_text": "Which of the following is a primary colour?",
        "options": ["Green", "Orange", "Red", "Purple"],
        "correct_answer": 2,
        "difficulty": 1,
        "domain_weights": {"CREA": 0.8, "SCI": 0.2},
    },
    {
        "subject": "Social Studies",
        "question_text": "What is democracy?",
        "options": [
            "Rule by one person",
            "Rule by the people",
            "Rule by the military",
            "Rule by the wealthy",
        ],
        "correct_answer": 1,
        "difficulty": 1,
        "domain_weights": {"SOC": 0.8, "VERB": 0.2},
    },
    {
        "subject": "Math",
        "question_text": "What is the value of 7 × 8?",
        "options": ["54", "56", "58", "64"],
        "correct_answer": 1,
        "difficulty": 1,
        "domain_weights": {"QA": 1.0},
    },
    {
        "subject": "Logic",
        "question_text": "Complete the pattern: 2, 4, 8, 16, __",
        "options": ["20", "24", "32", "30"],
        "correct_answer": 2,
        "difficulty": 1,
        "domain_weights": {"LOG": 0.7, "QA": 0.3},
    },
    {
        "subject": "Biology",
        "question_text": "Which part of the plant conducts photosynthesis?",
        "options": ["Root", "Stem", "Leaf", "Flower"],
        "correct_answer": 2,
        "difficulty": 1,
        "domain_weights": {"BIO": 0.8, "SCI": 0.2},
    },
    {
        "subject": "Programming",
        "question_text": "Which of these is a programming language?",
        "options": ["Photoshop", "Python", "PowerPoint", "PageMaker"],
        "correct_answer": 1,
        "difficulty": 1,
        "domain_weights": {"COMP": 0.9, "LOG": 0.1},
    },
    {
        "subject": "English",
        "question_text": "What type of sentence is 'Please close the door.'?",
        "options": ["Declarative", "Interrogative", "Imperative", "Exclamatory"],
        "correct_answer": 2,
        "difficulty": 1,
        "domain_weights": {"VERB": 0.8, "LOG": 0.2},
    },
    {
        "subject": "Social Studies",
        "question_text": "Who is considered the Father of the Indian Nation?",
        "options": ["Jawaharlal Nehru", "Subhas Chandra Bose", "Mahatma Gandhi", "B.R. Ambedkar"],
        "correct_answer": 2,
        "difficulty": 1,
        "domain_weights": {"SOC": 0.7, "VERB": 0.3},
    },

    # ═══ DIFFICULTY 2 (Medium) ═════════════════════════════════════════════════
    {
        "subject": "Math",
        "question_text": "If the area of a circle is 154 cm², what is its radius? (Use π ≈ 22/7)",
        "options": ["7 cm", "14 cm", "21 cm", "49 cm"],
        "correct_answer": 0,
        "difficulty": 2,
        "domain_weights": {"QA": 0.7, "LOG": 0.3},
    },
    {
        "subject": "Physics",
        "question_text": "A car accelerates from 0 to 60 km/h in 10 seconds. What is its acceleration?",
        "options": ["6 km/h²", "1.67 m/s²", "6 m/s²", "16.7 m/s²"],
        "correct_answer": 1,
        "difficulty": 2,
        "domain_weights": {"SCI": 0.5, "QA": 0.5},
    },
    {
        "subject": "Biology",
        "question_text": "Which type of blood cell is responsible for fighting infections?",
        "options": ["Red blood cells", "Platelets", "White blood cells", "Plasma"],
        "correct_answer": 2,
        "difficulty": 2,
        "domain_weights": {"BIO": 0.8, "SCI": 0.2},
    },
    {
        "subject": "Programming",
        "question_text": "What is the time complexity of binary search?",
        "options": ["O(n)", "O(n²)", "O(log n)", "O(1)"],
        "correct_answer": 2,
        "difficulty": 2,
        "domain_weights": {"COMP": 0.6, "LOG": 0.3, "QA": 0.1},
    },
    {
        "subject": "Logic",
        "question_text": "In a family of 6, A is the father of B. C is the mother of B. D is the brother of A. Who is D to B?",
        "options": ["Father", "Uncle", "Grandfather", "Brother"],
        "correct_answer": 1,
        "difficulty": 2,
        "domain_weights": {"LOG": 0.8, "SOC": 0.2},
    },
    {
        "subject": "English",
        "question_text": "Which literary device is used in 'The world is a stage'?",
        "options": ["Simile", "Metaphor", "Alliteration", "Onomatopoeia"],
        "correct_answer": 1,
        "difficulty": 2,
        "domain_weights": {"VERB": 0.6, "CREA": 0.4},
    },
    {
        "subject": "Art & Design",
        "question_text": "In UI design, what does the term 'whitespace' refer to?",
        "options": [
            "A design error",
            "Empty space that gives breathing room to elements",
            "The colour white used in backgrounds",
            "Blank pages in a document",
        ],
        "correct_answer": 1,
        "difficulty": 2,
        "domain_weights": {"CREA": 0.7, "COMP": 0.3},
    },
    {
        "subject": "Social Studies",
        "question_text": "Which of the following is NOT a fundamental right in the Indian Constitution?",
        "options": [
            "Right to Equality",
            "Right to Property",
            "Right to Freedom",
            "Right against Exploitation",
        ],
        "correct_answer": 1,
        "difficulty": 2,
        "domain_weights": {"SOC": 0.7, "VERB": 0.2, "LOG": 0.1},
    },
    {
        "subject": "Math",
        "question_text": "If f(x) = 2x + 3, what is f(f(1))?",
        "options": ["5", "7", "13", "11"],
        "correct_answer": 3,
        "difficulty": 2,
        "domain_weights": {"QA": 0.6, "LOG": 0.4},
    },
    {
        "subject": "Physics",
        "question_text": "Which type of lens is used to correct myopia (short-sightedness)?",
        "options": ["Convex lens", "Concave lens", "Bifocal lens", "Cylindrical lens"],
        "correct_answer": 1,
        "difficulty": 2,
        "domain_weights": {"SCI": 0.7, "BIO": 0.3},
    },
    {
        "subject": "Programming",
        "question_text": "What does the 'return' keyword do in a function?",
        "options": [
            "Prints output to screen",
            "Stops the program entirely",
            "Sends a value back to the caller",
            "Declares a variable",
        ],
        "correct_answer": 2,
        "difficulty": 2,
        "domain_weights": {"COMP": 0.8, "LOG": 0.2},
    },
    {
        "subject": "Biology",
        "question_text": "What is the role of ribosomes in a cell?",
        "options": [
            "Energy production",
            "Protein synthesis",
            "Cell division",
            "Waste removal",
        ],
        "correct_answer": 1,
        "difficulty": 2,
        "domain_weights": {"BIO": 0.9, "SCI": 0.1},
    },
    {
        "subject": "Logic",
        "question_text": "A clock shows 3:15. What is the angle between the hour and minute hands?",
        "options": ["0°", "7.5°", "15°", "22.5°"],
        "correct_answer": 1,
        "difficulty": 2,
        "domain_weights": {"LOG": 0.5, "QA": 0.5},
    },
    {
        "subject": "Art & Design",
        "question_text": "Which colour model is used in digital screens?",
        "options": ["CMYK", "RGB", "HSL", "Pantone"],
        "correct_answer": 1,
        "difficulty": 2,
        "domain_weights": {"CREA": 0.6, "COMP": 0.4},
    },
    {
        "subject": "Social Studies",
        "question_text": "What is the primary cause of inflation in an economy?",
        "options": [
            "Decrease in demand",
            "Increase in money supply",
            "Decrease in population",
            "Increase in exports",
        ],
        "correct_answer": 1,
        "difficulty": 2,
        "domain_weights": {"SOC": 0.5, "QA": 0.3, "LOG": 0.2},
    },

    # ═══ DIFFICULTY 3 (Hard) ═══════════════════════════════════════════════════
    {
        "subject": "Math",
        "question_text": "What is the determinant of the matrix [[3, 8], [4, 6]]?",
        "options": ["-14", "14", "-2", "50"],
        "correct_answer": 0,
        "difficulty": 3,
        "domain_weights": {"QA": 0.8, "LOG": 0.2},
    },
    {
        "subject": "Physics",
        "question_text": "In a photoelectric effect experiment, increasing the intensity of incident light will:",
        "options": [
            "Increase the kinetic energy of photoelectrons",
            "Increase the number of photoelectrons",
            "Decrease the threshold frequency",
            "Increase the work function",
        ],
        "correct_answer": 1,
        "difficulty": 3,
        "domain_weights": {"SCI": 0.7, "LOG": 0.2, "QA": 0.1},
    },
    {
        "subject": "Biology",
        "question_text": "During cellular respiration, the electron transport chain is located in the:",
        "options": [
            "Cytoplasm",
            "Inner mitochondrial membrane",
            "Nucleus",
            "Cell membrane",
        ],
        "correct_answer": 1,
        "difficulty": 3,
        "domain_weights": {"BIO": 0.8, "SCI": 0.2},
    },
    {
        "subject": "Programming",
        "question_text": "What is the output of: print([x**2 for x in range(5) if x % 2 != 0])?",
        "options": ["[0, 4, 16]", "[1, 9]", "[1, 4, 9]", "[0, 1, 4, 9, 16]"],
        "correct_answer": 1,
        "difficulty": 3,
        "domain_weights": {"COMP": 0.7, "LOG": 0.2, "QA": 0.1},
    },
    {
        "subject": "Logic",
        "question_text": "Five people A, B, C, D, E sit in a row. C sits to the immediate right of A. B sits at one of the extreme ends. D does not sit next to B. Who sits in the middle?",
        "options": ["A", "C", "D", "E"],
        "correct_answer": 0,
        "difficulty": 3,
        "domain_weights": {"LOG": 0.9, "QA": 0.1},
    },
    {
        "subject": "English",
        "question_text": "In George Orwell's '1984', what does the concept of 'doublethink' represent?",
        "options": [
            "Ability to think twice before speaking",
            "Holding two contradictory beliefs simultaneously",
            "A mathematical concept",
            "A memory improvement technique",
        ],
        "correct_answer": 1,
        "difficulty": 3,
        "domain_weights": {"VERB": 0.5, "LOG": 0.2, "SOC": 0.3},
    },
    {
        "subject": "Art & Design",
        "question_text": "In design thinking, what is the correct order of stages?",
        "options": [
            "Define, Empathize, Ideate, Prototype, Test",
            "Empathize, Define, Ideate, Prototype, Test",
            "Ideate, Empathize, Define, Prototype, Test",
            "Empathize, Ideate, Define, Test, Prototype",
        ],
        "correct_answer": 1,
        "difficulty": 3,
        "domain_weights": {"CREA": 0.5, "SOC": 0.3, "LOG": 0.2},
    },
    {
        "subject": "Social Studies",
        "question_text": "The concept of 'Tragedy of the Commons' in economics refers to:",
        "options": [
            "A common marketplace for tragic events",
            "Overuse of shared resources due to individual self-interest",
            "Government failure in managing public spaces",
            "A type of market failure in monopolies",
        ],
        "correct_answer": 1,
        "difficulty": 3,
        "domain_weights": {"SOC": 0.5, "LOG": 0.3, "VERB": 0.2},
    },
    {
        "subject": "Math",
        "question_text": "If log₂(x) + log₂(x-2) = 3, find x.",
        "options": ["4", "2", "8", "6"],
        "correct_answer": 0,
        "difficulty": 3,
        "domain_weights": {"QA": 0.7, "LOG": 0.3},
    },
    {
        "subject": "Physics",
        "question_text": "A positively charged particle enters a uniform magnetic field perpendicular to its velocity. The path of the particle will be:",
        "options": ["Straight line", "Parabolic", "Circular", "Elliptical"],
        "correct_answer": 2,
        "difficulty": 3,
        "domain_weights": {"SCI": 0.6, "QA": 0.2, "LOG": 0.2},
    },
    {
        "subject": "Programming",
        "question_text": "In a hash table with open addressing and linear probing, what is the worst-case time complexity for search?",
        "options": ["O(1)", "O(log n)", "O(n)", "O(n²)"],
        "correct_answer": 2,
        "difficulty": 3,
        "domain_weights": {"COMP": 0.6, "LOG": 0.3, "QA": 0.1},
    },
    {
        "subject": "Biology",
        "question_text": "CRISPR-Cas9 technology is used primarily for:",
        "options": [
            "Medical imaging",
            "Gene editing",
            "Drug delivery",
            "Protein purification",
        ],
        "correct_answer": 1,
        "difficulty": 3,
        "domain_weights": {"BIO": 0.6, "SCI": 0.2, "COMP": 0.2},
    },
    {
        "subject": "Logic",
        "question_text": "A says 'B always lies.' B says 'A and I both tell the truth.' How many of them tell the truth?",
        "options": ["0", "1", "2", "Cannot be determined"],
        "correct_answer": 1,
        "difficulty": 3,
        "domain_weights": {"LOG": 0.8, "VERB": 0.2},
    },
    {
        "subject": "Art & Design",
        "question_text": "The 'Golden Ratio' (approximately 1.618) is frequently used in design. Which of these sequences naturally converges to it?",
        "options": [
            "Arithmetic sequence",
            "Fibonacci sequence",
            "Geometric sequence",
            "Harmonic sequence",
        ],
        "correct_answer": 1,
        "difficulty": 3,
        "domain_weights": {"CREA": 0.4, "QA": 0.4, "LOG": 0.2},
    },
    {
        "subject": "Social Studies",
        "question_text": "Amartya Sen's 'Capability Approach' argues that development should be measured by:",
        "options": [
            "GDP growth rate",
            "Military strength",
            "People's freedoms and capabilities",
            "Industrial output",
        ],
        "correct_answer": 2,
        "difficulty": 3,
        "domain_weights": {"SOC": 0.6, "VERB": 0.2, "LOG": 0.2},
    },
]


async def seed():
    """Insert sample career questions into MongoDB."""
    client = AsyncIOMotorClient(settings.MONGO_URI)
    db = client.ncert_learning_db
    col = db["career_questions"]

    existing = await col.count_documents({})
    if existing > 0:
        print(f"⚠  career_questions already has {existing} documents — skipping seed.")
        client.close()
        return

    now = datetime.now(timezone.utc)
    docs = []
    for q in SAMPLE_QUESTIONS:
        docs.append({
            **q,
            "is_active": True,
            "created_by": "system_seed",
            "created_at": now,
            "updated_at": now,
        })

    result = await col.insert_many(docs)
    print(f"✅  Inserted {len(result.inserted_ids)} career questions.")

    # Create indexes
    await col.create_index("subject")
    await col.create_index("difficulty")
    await col.create_index("is_active")
    print("✅  Indexes created on career_questions.")

    # Also create indexes on career_tests and career_results
    await db["career_tests"].create_index("student_id")
    await db["career_tests"].create_index("status")
    await db["career_results"].create_index("student_id")
    await db["career_results"].create_index("test_id")
    print("✅  Indexes created on career_tests & career_results.")

    client.close()


if __name__ == "__main__":
    asyncio.run(seed())
