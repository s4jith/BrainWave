"""
Career Analysis Service

Production-grade scoring engine:
- Difficulty-weighted domain scoring
- 0-100 normalization per domain
- Dot-product career matching against predefined career vectors
- Confidence / reliability metrics
"""

import math
import logging
from datetime import datetime, timezone
from typing import Dict, List, Tuple, Optional
from bson import ObjectId

from app.db.mongo import mongodb
from app.models.career_models import (
    ALL_DOMAINS,
    DOMAIN_LABELS,
    DomainScore,
    CareerMatch,
    ConfidenceMetrics,
)

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# Predefined career vectors   (domain → weight, each vector sums to ~1.0)
# These act as "ideal cognitive profiles" for each career path.
# ═══════════════════════════════════════════════════════════════════════════════

CAREER_VECTORS: Dict[str, Dict[str, float]] = {
    "Mechanical Engineering": {
        "QA": 0.25, "SCI": 0.20, "LOG": 0.15, "COMP": 0.15,
        "BIO": 0.00, "VERB": 0.05, "CREA": 0.15, "SOC": 0.05,
    },
    "Computer Science & Engineering": {
        "QA": 0.15, "SCI": 0.05, "LOG": 0.25, "COMP": 0.30,
        "BIO": 0.00, "VERB": 0.05, "CREA": 0.15, "SOC": 0.05,
    },
    "Medicine (MBBS)": {
        "QA": 0.05, "SCI": 0.25, "LOG": 0.10, "COMP": 0.00,
        "BIO": 0.35, "VERB": 0.10, "CREA": 0.05, "SOC": 0.10,
    },
    "Design (UI/UX / Industrial)": {
        "QA": 0.05, "SCI": 0.05, "LOG": 0.10, "COMP": 0.10,
        "BIO": 0.00, "VERB": 0.15, "CREA": 0.40, "SOC": 0.15,
    },
    "Commerce & Finance": {
        "QA": 0.30, "SCI": 0.00, "LOG": 0.20, "COMP": 0.05,
        "BIO": 0.00, "VERB": 0.15, "CREA": 0.05, "SOC": 0.25,
    },
    "Civil Engineering": {
        "QA": 0.25, "SCI": 0.15, "LOG": 0.15, "COMP": 0.10,
        "BIO": 0.00, "VERB": 0.05, "CREA": 0.20, "SOC": 0.10,
    },
    "Biotechnology": {
        "QA": 0.10, "SCI": 0.25, "LOG": 0.10, "COMP": 0.10,
        "BIO": 0.30, "VERB": 0.05, "CREA": 0.05, "SOC": 0.05,
    },
    "Law": {
        "QA": 0.05, "SCI": 0.00, "LOG": 0.25, "COMP": 0.00,
        "BIO": 0.00, "VERB": 0.30, "CREA": 0.10, "SOC": 0.30,
    },
    "Data Science & AI": {
        "QA": 0.20, "SCI": 0.10, "LOG": 0.20, "COMP": 0.25,
        "BIO": 0.00, "VERB": 0.05, "CREA": 0.10, "SOC": 0.10,
    },
    "Psychology & Counselling": {
        "QA": 0.05, "SCI": 0.10, "LOG": 0.10, "COMP": 0.00,
        "BIO": 0.10, "VERB": 0.20, "CREA": 0.10, "SOC": 0.35,
    },
    "Journalism & Mass Communication": {
        "QA": 0.00, "SCI": 0.00, "LOG": 0.10, "COMP": 0.05,
        "BIO": 0.00, "VERB": 0.35, "CREA": 0.25, "SOC": 0.25,
    },
    "Architecture": {
        "QA": 0.15, "SCI": 0.10, "LOG": 0.10, "COMP": 0.05,
        "BIO": 0.00, "VERB": 0.05, "CREA": 0.40, "SOC": 0.15,
    },
}

CAREER_DESCRIPTIONS: Dict[str, str] = {
    "Mechanical Engineering": "Design, analyze, and manufacture mechanical systems. Strong math and physics foundation required.",
    "Computer Science & Engineering": "Build software systems, algorithms, and computing solutions. Logical and computational thinking are key.",
    "Medicine (MBBS)": "Diagnose and treat patients. Requires deep biological knowledge and scientific reasoning.",
    "Design (UI/UX / Industrial)": "Create user experiences and product designs. Creativity and empathy are central skills.",
    "Commerce & Finance": "Manage business operations, accounting, and financial planning. Quantitative and social skills matter.",
    "Civil Engineering": "Plan and construct infrastructure — roads, bridges, buildings. Combines math, science, and creativity.",
    "Biotechnology": "Apply biology and technology to develop medical, agricultural, and industrial products.",
    "Law": "Interpret and apply legal frameworks. Strong verbal, logical, and social reasoning needed.",
    "Data Science & AI": "Extract insights from data using statistics, ML, and programming. Math-heavy and computational.",
    "Psychology & Counselling": "Understand human behavior and provide therapeutic support. Social and communication skills dominate.",
    "Journalism & Mass Communication": "Research, write, and broadcast stories. Verbal skills and creativity are essential.",
    "Architecture": "Design buildings and spaces. A creative blend of art, math, and spatial reasoning.",
}


# ═══════════════════════════════════════════════════════════════════════════════
# Service class
# ═══════════════════════════════════════════════════════════════════════════════

class CareerService:
    """Handles all career-analysis business logic."""

    # ── Collections ────────────────────────────────────────────────────────────

    @property
    def questions_col(self):
        return mongodb.db["career_questions"]

    @property
    def tests_col(self):
        return mongodb.db["career_tests"]

    @property
    def results_col(self):
        return mongodb.db["career_results"]

    @property
    def assignments_col(self):
        return mongodb.db["career_assignments"]

    # ── Assignment management ──────────────────────────────────────────────────

    async def create_assignment(self, data: dict, created_by: str) -> dict:
        """Create a new active career-test assignment (deactivates any existing one first)."""
        # Deactivate any currently active assignment
        await self.assignments_col.update_many(
            {"is_active": True},
            {"$set": {"is_active": False, "deactivated_at": datetime.now(timezone.utc)}},
        )
        doc = {
            "title": data.get("title", "Career Analysis Test"),
            "description": data.get("description", ""),
            "is_active": True,
            "created_by": created_by,
            "created_at": datetime.now(timezone.utc),
            "deactivated_at": None,
        }
        result = await self.assignments_col.insert_one(doc)
        doc["_id"] = result.inserted_id
        return self._serialize_assignment(doc)

    async def get_active_assignment(self) -> Optional[dict]:
        """Return the current active career-test assignment, or None."""
        doc = await self.assignments_col.find_one({"is_active": True})
        return self._serialize_assignment(doc) if doc else None

    async def deactivate_assignment(self, assignment_id: str) -> bool:
        """Deactivate a career-test assignment by ID."""
        result = await self.assignments_col.update_one(
            {"_id": ObjectId(assignment_id), "is_active": True},
            {"$set": {"is_active": False, "deactivated_at": datetime.now(timezone.utc)}},
        )
        return result.modified_count == 1

    async def list_assignments(self, skip: int = 0, limit: int = 20) -> Tuple[List[dict], int]:
        """Return all assignments (latest first) for admin view."""
        total = await self.assignments_col.count_documents({})
        cursor = self.assignments_col.find({}).sort("created_at", -1).skip(skip).limit(limit)
        docs = [self._serialize_assignment(doc) async for doc in cursor]
        return docs, total

    def _serialize_assignment(self, doc: dict) -> dict:
        if not doc:
            return doc
        return {
            "id": str(doc["_id"]),
            "title": doc.get("title", "Career Analysis Test"),
            "description": doc.get("description", ""),
            "is_active": doc.get("is_active", False),
            "created_by": doc.get("created_by"),
            "created_at": doc.get("created_at").isoformat() if doc.get("created_at") else None,
            "deactivated_at": doc.get("deactivated_at").isoformat() if doc.get("deactivated_at") else None,
        }

    # ── Question CRUD ──────────────────────────────────────────────────────────

    async def create_question(self, data: dict, created_by: str) -> dict:
        doc = {
            **data,
            "is_active": True,
            "created_by": created_by,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        result = await self.questions_col.insert_one(doc)
        doc["_id"] = result.inserted_id
        return self._serialize_question(doc)

    async def list_questions(
        self,
        subject: Optional[str] = None,
        difficulty: Optional[int] = None,
        is_active: Optional[bool] = True,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[dict], int]:
        query: dict = {}
        if subject:
            query["subject"] = {"$regex": f"^{subject}$", "$options": "i"}
        if difficulty is not None:
            query["difficulty"] = difficulty
        if is_active is not None:
            query["is_active"] = is_active

        total = await self.questions_col.count_documents(query)
        cursor = self.questions_col.find(query).sort("created_at", -1).skip(skip).limit(limit)
        questions = [self._serialize_question(doc) async for doc in cursor]
        return questions, total

    async def get_question(self, question_id: str) -> Optional[dict]:
        doc = await self.questions_col.find_one({"_id": ObjectId(question_id)})
        return self._serialize_question(doc) if doc else None

    async def update_question(self, question_id: str, updates: dict) -> Optional[dict]:
        updates = {k: v for k, v in updates.items() if v is not None}
        if not updates:
            return await self.get_question(question_id)
        updates["updated_at"] = datetime.now(timezone.utc)
        await self.questions_col.update_one(
            {"_id": ObjectId(question_id)}, {"$set": updates}
        )
        return await self.get_question(question_id)

    async def delete_question(self, question_id: str) -> bool:
        result = await self.questions_col.delete_one({"_id": ObjectId(question_id)})
        return result.deleted_count == 1

    async def get_question_stats(self) -> dict:
        """Return aggregate statistics for the question pool."""
        pipeline = [
            {"$match": {"is_active": True}},
            {"$group": {
                "_id": None,
                "total": {"$sum": 1},
                "subjects": {"$addToSet": "$subject"},
                "avg_difficulty": {"$avg": "$difficulty"},
            }},
        ]
        result = await self.questions_col.aggregate(pipeline).to_list(1)
        if not result:
            return {"total": 0, "subjects": [], "avg_difficulty": 0}
        r = result[0]
        return {
            "total": r["total"],
            "subjects": sorted(r["subjects"]),
            "avg_difficulty": round(r["avg_difficulty"], 2),
        }

    # ── Test lifecycle ─────────────────────────────────────────────────────────

    async def start_test(self, student_id: str) -> dict:
        """
        Select 30 questions (stratified by difficulty) and create a test document.
        Returns test_id + student-safe question list.
        Requires an active career-test assignment created by an admin.
        """
        # Ensure an admin has activated the career test
        active_assignment = await self.get_active_assignment()
        if not active_assignment:
            raise ValueError(
                "No active career test assignment. Please contact your admin to open the career test."
            )

        # Check for an existing in-progress test
        existing = await self.tests_col.find_one({
            "student_id": student_id,
            "status": "in_progress",
        })
        if existing:
            # Return the existing test instead of creating a new one
            questions = await self._hydrate_questions(existing["question_ids"])
            return {
                "test_id": str(existing["_id"]),
                "questions": self._strip_answers(questions),
                "total_questions": len(questions),
                "time_limit_minutes": 45,
            }

        # Stratified sampling: 10 easy, 10 medium, 10 hard
        pool: List[dict] = []
        for diff, count in [(1, 10), (2, 10), (3, 10)]:
            pipeline = [
                {"$match": {"is_active": True, "difficulty": diff}},
                {"$sample": {"size": count}},
            ]
            docs = await self.questions_col.aggregate(pipeline).to_list(count)
            pool.extend(docs)

        if len(pool) < 10:
            raise ValueError(
                f"Not enough questions in the pool ({len(pool)} found, minimum 10 required). "
                "Ask your admin to add more career-analysis questions."
            )

        # If we got fewer than 30, fill from remaining pool
        if len(pool) < 30:
            existing_ids = [d["_id"] for d in pool]
            shortfall = 30 - len(pool)
            extra = await self.questions_col.aggregate([
                {"$match": {"is_active": True, "_id": {"$nin": existing_ids}}},
                {"$sample": {"size": shortfall}},
            ]).to_list(shortfall)
            pool.extend(extra)

        question_ids = [doc["_id"] for doc in pool]

        test_doc = {
            "student_id": student_id,
            "question_ids": question_ids,
            "status": "in_progress",
            "started_at": datetime.now(timezone.utc),
            "completed_at": None,
        }
        result = await self.tests_col.insert_one(test_doc)

        return {
            "test_id": str(result.inserted_id),
            "questions": self._strip_answers(pool),
            "total_questions": len(pool),
            "time_limit_minutes": 45,
        }

    async def submit_test(self, student_id: str, test_id: str, answers: List[dict]) -> dict:
        """
        Evaluate submitted answers, compute domain scores, and return career matches.
        """
        test = await self.tests_col.find_one({"_id": ObjectId(test_id)})
        if not test:
            raise ValueError("Test not found")
        if test["student_id"] != student_id:
            raise PermissionError("This test does not belong to you")
        if test["status"] == "completed":
            # Return existing result
            existing_result = await self.results_col.find_one({"test_id": test_id})
            if existing_result:
                return self._serialize_result(existing_result)
            raise ValueError("Test already completed but result not found")

        # Hydrate full question docs
        questions = await self._hydrate_questions(test["question_ids"])
        q_map = {str(q["_id"]): q for q in questions}

        # Build answer map (question_id → selected_option)
        answer_map: Dict[str, int] = {}
        for ans in answers:
            answer_map[ans["question_id"]] = ans["selected_option"]

        # ── Scoring ────────────────────────────────────────────────────────
        raw_scores: Dict[str, float] = {d: 0.0 for d in ALL_DOMAINS}
        max_possible: Dict[str, float] = {d: 0.0 for d in ALL_DOMAINS}
        correct_count = 0
        attempted = 0

        for qid_str, q_doc in q_map.items():
            diff = q_doc.get("difficulty", 1)
            difficulty_factor = 1.0 + (diff * 0.15)
            weights = q_doc.get("domain_weights", {})

            # Accumulate theoretical max for normalization
            for domain, w in weights.items():
                max_possible[domain] += w * difficulty_factor

            # Only score if student answered this question
            if qid_str in answer_map:
                attempted += 1
                selected = answer_map[qid_str]
                if selected == q_doc["correct_answer"]:
                    correct_count += 1
                    for domain, w in weights.items():
                        raw_scores[domain] += w * difficulty_factor

        # ── Normalize to 0-100 ────────────────────────────────────────────
        normalized: Dict[str, float] = {}
        for domain in ALL_DOMAINS:
            mp = max_possible[domain]
            if mp > 0:
                normalized[domain] = round((raw_scores[domain] / mp) * 100, 2)
            else:
                normalized[domain] = 0.0

        domain_scores = [
            DomainScore(
                domain=d,
                label=DOMAIN_LABELS[d],
                raw_score=round(raw_scores[d], 4),
                normalized_score=normalized[d],
            )
            for d in ALL_DOMAINS
        ]

        # ── Career matching (cosine similarity) ──────────────────────────
        student_vec = normalized
        career_matches = self._match_careers(student_vec)

        # ── Confidence metrics ────────────────────────────────────────────
        confidence = self._compute_confidence(
            attempted=attempted,
            correct=correct_count,
            total_questions=len(q_map),
            normalized_scores=normalized,
        )

        # ── Persist result ────────────────────────────────────────────────
        now = datetime.now(timezone.utc)
        result_doc = {
            "student_id": student_id,
            "test_id": test_id,
            "answers": answers,
            "correct_count": correct_count,
            "attempted": attempted,
            "domain_scores": {d: normalized[d] for d in ALL_DOMAINS},
            "raw_scores": {d: round(raw_scores[d], 4) for d in ALL_DOMAINS},
            "top_careers": [
                {"career": m.career, "match_percentage": m.match_percentage, "description": m.description}
                for m in career_matches[:3]
            ],
            "all_career_matches": [
                {"career": m.career, "match_percentage": m.match_percentage, "description": m.description}
                for m in career_matches
            ],
            "confidence": {
                "questions_attempted": confidence.questions_attempted,
                "questions_correct": confidence.questions_correct,
                "accuracy_pct": confidence.accuracy_pct,
                "domain_coverage": confidence.domain_coverage,
                "confidence_score": confidence.confidence_score,
                "confidence_label": confidence.confidence_label,
            },
            "completed_at": now,
        }
        insert = await self.results_col.insert_one(result_doc)
        result_doc["_id"] = insert.inserted_id

        # Mark test completed
        await self.tests_col.update_one(
            {"_id": ObjectId(test_id)},
            {"$set": {"status": "completed", "completed_at": now}},
        )

        return self._serialize_result(result_doc)

    async def get_result(self, result_id: str) -> Optional[dict]:
        doc = await self.results_col.find_one({"_id": ObjectId(result_id)})
        return self._serialize_result(doc) if doc else None

    async def get_student_results(self, student_id: str) -> List[dict]:
        cursor = self.results_col.find({"student_id": student_id}).sort("completed_at", -1)
        return [self._serialize_result(doc) async for doc in cursor]

    async def get_all_results(self, skip: int = 0, limit: int = 50) -> Tuple[List[dict], int]:
        """Admin: list all career results."""
        total = await self.results_col.count_documents({})
        cursor = self.results_col.find().sort("completed_at", -1).skip(skip).limit(limit)
        results = [self._serialize_result(doc) async for doc in cursor]
        return results, total

    # ═══════════════════════════════════════════════════════════════════════════
    # Private helpers
    # ═══════════════════════════════════════════════════════════════════════════

    def _match_careers(self, student_scores: Dict[str, float]) -> List[CareerMatch]:
        """
        Compute cosine similarity between the student's normalized domain vector
        and each career vector, return sorted list.
        """
        matches: List[CareerMatch] = []

        # Convert student 0-100 scores to a unit vector
        s_vec = [student_scores.get(d, 0.0) for d in ALL_DOMAINS]
        s_mag = math.sqrt(sum(x ** 2 for x in s_vec)) or 1e-9

        for career_name, c_weights in CAREER_VECTORS.items():
            c_vec = [c_weights.get(d, 0.0) for d in ALL_DOMAINS]
            c_mag = math.sqrt(sum(x ** 2 for x in c_vec)) or 1e-9

            dot = sum(s * c for s, c in zip(s_vec, c_vec))
            cosine = dot / (s_mag * c_mag)

            # Clamp and scale to percentage
            pct = round(max(0.0, min(1.0, cosine)) * 100, 2)

            matches.append(CareerMatch(
                career=career_name,
                match_percentage=pct,
                description=CAREER_DESCRIPTIONS.get(career_name, ""),
            ))

        matches.sort(key=lambda m: m.match_percentage, reverse=True)
        return matches

    def _compute_confidence(
        self,
        attempted: int,
        correct: int,
        total_questions: int,
        normalized_scores: Dict[str, float],
    ) -> ConfidenceMetrics:
        """
        Confidence formula:
          confidence = 0.4 × attempt_ratio + 0.3 × accuracy + 0.3 × domain_coverage

        attempt_ratio  = attempted / total
        accuracy       = correct / attempted
        domain_coverage = fraction of domains with score > 0
        """
        attempt_ratio = (attempted / total_questions) if total_questions > 0 else 0
        accuracy = (correct / attempted) if attempted > 0 else 0
        domains_hit = sum(1 for v in normalized_scores.values() if v > 0)
        coverage = domains_hit / len(ALL_DOMAINS)

        raw_conf = (0.4 * attempt_ratio) + (0.3 * accuracy) + (0.3 * coverage)
        score = round(raw_conf * 100, 2)

        if score >= 70:
            label = "High"
        elif score >= 40:
            label = "Moderate"
        else:
            label = "Low"

        return ConfidenceMetrics(
            questions_attempted=attempted,
            questions_correct=correct,
            accuracy_pct=round(accuracy * 100, 2),
            domain_coverage=round(coverage, 4),
            confidence_score=score,
            confidence_label=label,
        )

    async def _hydrate_questions(self, question_ids: List[ObjectId]) -> List[dict]:
        cursor = self.questions_col.find({"_id": {"$in": question_ids}})
        return await cursor.to_list(len(question_ids))

    @staticmethod
    def _strip_answers(questions: List[dict]) -> List[dict]:
        """Remove correct_answer and domain_weights for student-facing response."""
        safe = []
        for q in questions:
            safe.append({
                "id": str(q["_id"]),
                "subject": q["subject"],
                "question_text": q["question_text"],
                "options": q["options"],
                "difficulty": q["difficulty"],
            })
        return safe

    @staticmethod
    def _serialize_question(doc: dict) -> dict:
        if not doc:
            return doc
        doc["id"] = str(doc.pop("_id"))
        if "created_at" in doc and isinstance(doc["created_at"], datetime):
            pass  # keep as-is for Pydantic
        return doc

    @staticmethod
    def _serialize_result(doc: dict) -> dict:
        if not doc:
            return doc
        result = {
            "result_id": str(doc["_id"]),
            "student_id": doc["student_id"],
            "test_id": doc["test_id"],
            "domain_scores": [
                {
                    "domain": d,
                    "label": DOMAIN_LABELS[d],
                    "raw_score": doc.get("raw_scores", {}).get(d, 0),
                    "normalized_score": doc.get("domain_scores", {}).get(d, 0),
                }
                for d in ALL_DOMAINS
            ],
            "top_careers": doc.get("top_careers", []),
            "all_career_matches": doc.get("all_career_matches", []),
            "confidence": doc.get("confidence", {}),
            "cognitive_profile": doc.get("domain_scores", {}),
            "completed_at": doc.get("completed_at"),
        }
        return result


career_service = CareerService()
