"""
Assessment Service

Handles assessment CRUD, question management, submissions, and grading.
Includes auto-grading for objective questions.
"""

from typing import List, Optional, Dict
from datetime import datetime
from bson import ObjectId
import logging
import uuid

from app.db.mongo import mongodb
from app.models.assessment_models import (
    AssessmentCreateRequest, AssessmentUpdateRequest, AssessmentInDB,
    AssessmentResponse, AssessmentDetailResponse, AssessmentListResponse,
    Question, QuestionCreateRequest, QuestionType, QuestionOption,
    SubmissionInDB, SubmissionResponse, SubmissionDetailResponse,
    SubmissionListResponse, SubmitAssessmentRequest, AnswerSubmission,
    GradeSubmissionRequest, AssessmentStatus, SubmissionStatus,
    StudentAssessmentView
)

logger = logging.getLogger(__name__)

class AssessmentService:
    """Service for managing assessments and submissions."""
    
    def __init__(self):
        self.assessments_collection = "assessments"
        self.submissions_collection = "submissions"
        self._assessments = None
        self._submissions = None
    
    @property
    def assessments(self):
        if self._assessments is None:
            if mongodb.db is not None:
                self._assessments = mongodb.get_collection(self.assessments_collection)
        return self._assessments
    
    @property
    def submissions(self):
        if self._submissions is None:
            if mongodb.db is not None:
                self._submissions = mongodb.get_collection(self.submissions_collection)
        return self._submissions
    
    async def create_assessment(
        self,
        request: AssessmentCreateRequest,
        instructor_id: str
    ) -> AssessmentResponse:
        """Create a new assessment."""
        try:
            questions_list = request.questions or []
            status = AssessmentStatus.PUBLISHED.value
            
            doc = {
                "course_id": request.course_id or "",
                "title": request.title,
                "description": request.description,
                "subject": request.subject,
                "class_level": request.class_level,
                "type": request.type.value if request.type else "quiz",
                "instructor_id": instructor_id,
                "created_by": request.created_by or instructor_id,
                "status": status,
                "questions": [self._transform_question(q) for q in questions_list],
                "settings": request.settings.model_dump(),
                "due_date": request.due_date,
                "available_from": request.available_from,
                "total_points": sum(q.get("marks", q.get("points", 1)) for q in questions_list),
                "duration_minutes": request.duration_minutes,
                "num_attempts": request.num_attempts or 1,
                "show_results_immediately": request.show_results_immediately,
                "start_datetime": request.start_datetime,
                "end_datetime": request.end_datetime,
                "student_ids": request.student_ids or [],
                "group_ids": request.group_ids or [],
                "evaluation_type": getattr(request, 'evaluation_type', None) or "manual",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            
            result = await self.assessments.insert_one(doc)
            doc["id"] = str(result.inserted_id)
            
            logger.info(f"Assessment created: {doc['title']} with status: {status}")
            
            await self._notify_users(doc)
            
            await self._save_new_questions_to_bank(
                questions_list, 
                request.subject, 
                request.class_level, 
                instructor_id
            )
            
            return self._to_response(doc)
            
        except Exception as e:
            logger.error(f"Create assessment error: {e}")
            raise

    async def _notify_users(self, assessment: dict):
        """Send notifications to relevant users."""
        try:
            notifications = []
            created_at = datetime.utcnow()
            title = assessment["title"]
            assessment_id = str(assessment.get("_id", assessment.get("id")))
            
            student_ids = set(assessment.get("student_ids", []))
            
            group_ids = assessment.get("group_ids", [])
            if group_ids:
                groups = await mongodb.db.groups.find({
                    "_id": {"$in": [ObjectId(gid) for gid in group_ids if ObjectId.is_valid(gid)]}
                }).to_list(length=100)
                
                for group in groups:
                    for sid in group.get("student_ids", []):
                        student_ids.add(sid)
            
            for sid in student_ids:
                notifications.append({
                    "title": f"New Test: {title}",
                    "message": f"A new test '{title}' is available for you.",
                    "type": "test_assigned",
                    "recipient_id": sid,
                    "role": "student",
                    "link": f"/assessments/{assessment_id}",
                    "created_at": created_at,
                    "is_read": False
                })
            
            teacher_ids_set = set()
            
            if group_ids:
                if not groups:
                    groups = await mongodb.db.groups.find({
                        "_id": {"$in": [ObjectId(gid) for gid in group_ids if ObjectId.is_valid(gid)]}
                    }).to_list(length=100)
                
                for group in groups:
                    if group.get("teacher_id"):
                        teacher_ids_set.add(group.get("teacher_id"))
                    if group.get("teacher_ids"):
                        for tid in group.get("teacher_ids"):
                            teacher_ids_set.add(tid)
                
                for tid in teacher_ids_set:
                    teacher_user = await mongodb.db.users.find_one({
                        "$or": [{"user_id": tid}, {"_id": ObjectId(tid) if ObjectId.is_valid(tid) else "dummy"}]
                    })
                    if teacher_user:
                        notifications.append({
                            "title": f"New Test Assigned: {title}",
                            "message": f"A new test '{title}' has been assigned to your group. You can now edit and manage questions.",
                            "type": "test_assigned",
                            "recipient_id": teacher_user["user_id"],
                            "role": "teacher",
                            "link": f"/teacher-tests",
                            "created_at": created_at,
                            "is_read": False
                        })
                
            creator_id = assessment.get("created_by", assessment.get("instructor_id"))
            creator = await mongodb.db.users.find_one({"user_id": creator_id})
            creator_role = creator.get("role") if creator else "admin"
            
            if creator_role == "teacher":
                admins = mongodb.db.users.find({"role": "admin"})
                async for admin in admins:
                    notifications.append({
                        "title": f"New Test Created: {title}",
                        "message": f"Teacher {creator.get('name', creator_id)} created a new test.",
                        "type": "info",
                        "recipient_id": admin["user_id"],
                        "role": "admin",
                        "link": "/test-management",
                        "created_at": created_at,
                        "is_read": False
                    })

            if notifications:
                await mongodb.db.notifications.insert_many(notifications)
                
        except Exception as e:
            logger.error(f"Failed to send notifications: {e}")
    
    async def _save_new_questions_to_bank(
        self, 
        questions_list: list, 
        subject: str, 
        class_level: int, 
        instructor_id: str
    ):
        """Save newly created questions (not from question bank) to the questions collection."""
        try:
            new_questions = []
            now = datetime.utcnow().isoformat()
            
            for q in questions_list:
                if q.get("is_bank_question"):
                    continue
                
                question_doc = {
                    "text": q.get("text", q.get("question_text", "")),
                    "subject": subject,
                    "class_level": class_level,
                    "chapter": q.get("chapter", 1),
                    "topic": q.get("topic", ""),
                    "type": q.get("type", "mcq"),
                    "difficulty": q.get("difficulty", "medium"),
                    "marks": q.get("marks", q.get("points", 1)),
                    "options": q.get("options", []),
                    "correct_answer": q.get("correct_answer", ""),
                    "status": "approved",
                    "created_by": instructor_id,
                    "created_role": "teacher",
                    "is_ai_generated": False,
                    "created_at": now,
                    "updated_at": now
                }
                
                if q.get("correct_answers"):
                    question_doc["correct_answers"] = q.get("correct_answers")
                if q.get("fillup_answers"):
                    question_doc["correct_answer"] = q.get("fillup_answers")
                if q.get("answer_text"):
                    question_doc["correct_answer"] = q.get("answer_text")
                
                new_questions.append(question_doc)
            
            if new_questions:
                from app.db.mongo import db as sync_db
                sync_db.questions.insert_many(new_questions)
                logger.info(f"Saved {len(new_questions)} new questions to question bank")
                
        except Exception as e:
            logger.error(f"Failed to save questions to bank: {e}")

    async def get_assessment(
        self,
        assessment_id: str,
        include_questions: bool = True
    ) -> Optional[AssessmentDetailResponse]:
        """Get assessment by ID."""
        try:
            doc = await self.assessments.find_one({"_id": ObjectId(assessment_id)})
            if not doc:
                return None
            return self._to_detail_response(doc) if include_questions else self._to_response(doc)
        except Exception as e:
            logger.error(f"Get assessment error: {e}")
            return None
    
    async def list_assessments(
        self,
        course_id: str = None,
        instructor_id: str = None,
        status: str = None,
        student_id: str = None,
        teacher_id: str = None
    ) -> AssessmentListResponse:
        """List assessments with filters."""
        try:
            query = {}
            if course_id:
                query["course_id"] = course_id
            
            if instructor_id:
                query["instructor_id"] = instructor_id
            
            elif teacher_id:
                teacher_user = await mongodb.db.users.find_one({"user_id": teacher_id})
                teacher_mongo_id = str(teacher_user["_id"]) if teacher_user else None
                
                group_query = {
                    "$or": [
                        {"teacher_ids": teacher_id},
                        {"teacher_id": teacher_id}
                    ]
                }
                
                if teacher_mongo_id and teacher_mongo_id != teacher_id:
                    group_query["$or"].extend([
                        {"teacher_ids": teacher_mongo_id},
                        {"teacher_id": teacher_mongo_id}
                    ])
                
                groups = await mongodb.db.groups.find(group_query).to_list(length=100)
                teacher_group_ids = [str(g["_id"]) for g in groups]
                
                logger.info(f" Teacher {teacher_id} filter debug:")
                logger.info(f"   - Teacher user_id: {teacher_id}")
                logger.info(f"   - Teacher MongoDB _id: {teacher_mongo_id}")
                logger.info(f"   - Found {len(groups)} groups")
                logger.info(f"   - Group IDs: {teacher_group_ids}")
                for g in groups:
                    logger.info(f"   - Group: {g.get('name')} (class={g.get('class_level')}, subject={g.get('subject')})")
                
                or_queries = [{"instructor_id": teacher_id}]
                
                if teacher_group_ids:
                    or_queries.append({"group_ids": {"$in": teacher_group_ids}})
                    logger.info(f"   - Added group filter: {teacher_group_ids}")
                
                criteria = []
                for g in groups:
                    if g.get("class_level") and g.get("subject"):
                        criteria.append({
                            "class_level": g.get("class_level"),
                            "subject": {"$regex": f"^{g.get('subject')}$", "$options": "i"}
                        })
                
                if criteria:
                    admins = await mongodb.db.users.find({"role": "admin"}, {"user_id": 1}).to_list(length=100)
                    admin_ids = [a["user_id"] for a in admins]
                    
                    if admin_ids:
                        or_queries.append({
                            "$and": [
                                {"instructor_id": {"$in": admin_ids}},
                                {"$or": criteria}
                            ]
                        })
                        logger.info(f"   - Added admin test filter: {len(admin_ids)} admins, {len(criteria)} subject/class combos")
                
                query["$or"] = or_queries
                logger.info(f"   - Final OR conditions: {len(or_queries)}")
                logger.info(f"   - Full query: {query}")

            if student_id and not instructor_id and not teacher_id:
                student_user = await mongodb.db.users.find_one({"user_id": student_id})
                student_class = student_user.get("class_level") if student_user else None
                student_mongo_id = str(student_user["_id"]) if student_user else None
                
                student_id_variants = [student_id]
                if student_mongo_id and student_mongo_id != student_id:
                    student_id_variants.append(student_mongo_id)
                
                student_groups = await mongodb.db.groups.find({
                    "student_ids": {"$in": student_id_variants}
                }).to_list(length=100)
                student_group_ids = [str(g["_id"]) for g in student_groups]
                
                logger.info(f" Student {student_id} assessment filter:")
                logger.info(f"   - user_id: {student_id}")
                logger.info(f"   - mongo_id: {student_mongo_id}")
                logger.info(f"   - class_level: {student_class} (type: {type(student_class).__name__})")
                logger.info(f"   - Found {len(student_groups)} groups: {student_group_ids}")
                for g in student_groups:
                    logger.info(f"     Group: {g.get('name')} (id: {str(g['_id'])})")
                
                student_or = []
                
                for sid in student_id_variants:
                    student_or.append({"student_ids": sid})
                
                if student_group_ids:
                    student_or.append({"group_ids": {"$in": student_group_ids}})
                
                if student_class:
                    class_int = int(student_class) if student_class else None
                    if class_int:
                        student_or.append({
                            "class_level": class_int,
                            "student_ids": {"$size": 0},
                            "group_ids": {"$size": 0}
                        })
                        student_or.append({
                            "class_level": class_int,
                            "student_ids": {"$exists": False}
                        })
                
                query["$or"] = student_or
                logger.info(f"   - Student OR conditions: {len(student_or)}")
                logger.info(f"   - Full query: {query}")
                
                if not student_or:
                    logger.warning(f"   - No matching conditions for student {student_id}, returning empty")
                    return AssessmentListResponse(assessments=[], total=0)

            if status:
                query["status"] = status
            else:
                if student_id and not instructor_id and not teacher_id:
                    query["status"] = AssessmentStatus.PUBLISHED.value
            
            total = await self.assessments.count_documents(query)
            logger.info(f"   - Found {total} matching assessments (query: {query})")
            cursor = self.assessments.find(query).sort("created_at", -1)
            
            assessments = []
            async for doc in cursor:
                if teacher_id:
                    logger.info(f"   - Assessment: {doc.get('title')} | group_ids: {doc.get('group_ids', [])} | instructor: {doc.get('instructor_id')}")
                if student_id:
                    logger.info(f"   - Match: {doc.get('title')} | student_ids: {doc.get('student_ids', [])[:3]} | group_ids: {doc.get('group_ids', [])} | status: {doc.get('status')}")
                assessment_id = str(doc["_id"])
                submission_count = await self.submissions.count_documents({"assessment_id": assessment_id})
                
                response = self._to_response(doc, submission_count)
                
                if student_id:
                    submissions = await self.submissions.find({
                        "assessment_id": assessment_id,
                        "student_id": student_id
                    }).to_list(length=100)
                    
                    response.has_attempted = len(submissions) > 0
                    if submissions:
                        best = max(s.get("percentage", 0) for s in submissions)
                        response.best_score = best
                    response.attempts_remaining = (
                        doc.get("settings", {}).get("attempt_limit", 1) - len(submissions)
                    )
                
                assessments.append(response)
            
            return AssessmentListResponse(assessments=assessments, total=total)
            
        except Exception as e:
            logger.error(f"List assessments error: {e}")
            return AssessmentListResponse(assessments=[], total=0)
    
    async def update_assessment(
        self,
        assessment_id: str,
        request: AssessmentUpdateRequest,
        instructor_id: str
    ) -> Optional[AssessmentResponse]:
        """Update an assessment. Teachers can edit if assigned to the test's groups, regardless of status."""
        try:
            existing = await self.assessments.find_one({"_id": ObjectId(assessment_id)})
            
            if not existing:
                return None
            
            is_instructor = existing.get("instructor_id") == instructor_id
            is_assigned_teacher = False
            
            if not is_instructor:
                teacher_user = await mongodb.db.users.find_one({"user_id": instructor_id})
                teacher_mongo_id = str(teacher_user["_id"]) if teacher_user else None
                
                group_ids = existing.get("group_ids", [])
                if group_ids:
                    teacher_match = [
                        {"teacher_ids": instructor_id},
                        {"teacher_id": instructor_id}
                    ]
                    if teacher_mongo_id and teacher_mongo_id != instructor_id:
                        teacher_match.extend([
                            {"teacher_ids": teacher_mongo_id},
                            {"teacher_id": teacher_mongo_id}
                        ])
                    
                    teacher_groups = await mongodb.db.groups.find({
                        "_id": {"$in": [ObjectId(gid) for gid in group_ids if ObjectId.is_valid(gid)]},
                        "$or": teacher_match
                    }).to_list(length=100)
                    is_assigned_teacher = len(teacher_groups) > 0
                    logger.info(f"Update permission check: user={instructor_id}, mongo_id={teacher_mongo_id}, groups_found={len(teacher_groups)}")
            
            if not is_instructor and not is_assigned_teacher:
                logger.warning(f"User {instructor_id} denied access to update assessment {assessment_id}")
                return None
            
            logger.info(f"User {instructor_id} updating assessment {assessment_id} - Instructor: {is_instructor}, Assigned Teacher: {is_assigned_teacher}")
            
            update_data = {"updated_at": datetime.utcnow()}
            
            if request.title:
                update_data["title"] = request.title
            if request.description is not None:
                update_data["description"] = request.description
            if request.type:
                update_data["type"] = request.type.value
            if request.settings:
                update_data["settings"] = request.settings.model_dump()
            if request.due_date is not None:
                update_data["due_date"] = request.due_date
            if request.available_from is not None:
                update_data["available_from"] = request.available_from
            if request.status:
                update_data["status"] = request.status.value
            
            if request.questions is not None:
                questions = [self._transform_question(q) for q in request.questions]
                update_data["questions"] = questions
                update_data["total_points"] = sum(q.get("points", 1) for q in questions)
                if existing.get("status") == AssessmentStatus.DRAFT.value and len(questions) > 0:
                    update_data["status"] = AssessmentStatus.PUBLISHED.value
                    logger.info(f"Auto-publishing assessment {assessment_id} after adding questions")
            
            if request.student_ids is not None:
                update_data["student_ids"] = request.student_ids
            
            if request.group_ids is not None:
                update_data["group_ids"] = request.group_ids
            
            await self.assessments.update_one(
                {"_id": ObjectId(assessment_id)},
                {"$set": update_data}
            )
            
            updated = await self.assessments.find_one({"_id": ObjectId(assessment_id)})
            return self._to_response(updated)
            
        except Exception as e:
            logger.error(f"Update assessment error: {e}")
            return None
    
    async def publish_assessment(
        self,
        assessment_id: str,
        instructor_id: str
    ) -> Optional[AssessmentResponse]:
        """Publish a draft assessment. Teachers can publish if assigned to groups."""
        try:
            assessment = await self.assessments.find_one({"_id": ObjectId(assessment_id)})
            
            if not assessment:
                return None
            
            is_instructor = assessment.get("instructor_id") == instructor_id
            is_assigned_teacher = False
            
            if not is_instructor:
                group_ids = assessment.get("group_ids", [])
                if group_ids:
                    teacher_groups = await mongodb.db.groups.find({
                        "_id": {"$in": [ObjectId(gid) for gid in group_ids if ObjectId.is_valid(gid)]},
                        "$or": [
                            {"teacher_ids": instructor_id},
                            {"teacher_id": instructor_id}
                        ]
                    }).to_list(length=100)
                    is_assigned_teacher = len(teacher_groups) > 0
            
            if not is_instructor and not is_assigned_teacher:
                return None
            
            if assessment.get("status") != AssessmentStatus.DRAFT.value:
                return None
            
            result = await self.assessments.update_one(
                {"_id": ObjectId(assessment_id)},
                {"$set": {
                    "status": AssessmentStatus.PUBLISHED.value,
                    "updated_at": datetime.utcnow()
                }}
            )
            
            if result.modified_count == 0:
                return None
            
            updated = await self.assessments.find_one({"_id": ObjectId(assessment_id)})
            return self._to_response(updated)
            
        except Exception as e:
            logger.error(f"Publish assessment error: {e}")
            return None
    
    async def delete_assessment(
        self,
        assessment_id: str,
        instructor_id: str
    ) -> bool:
        """Delete an assessment. Teachers can delete if assigned to groups or if creator."""
        try:
            assessment = await self.assessments.find_one({"_id": ObjectId(assessment_id)})
            
            if not assessment:
                return False
            
            is_instructor = assessment.get("instructor_id") == instructor_id
            is_assigned_teacher = False
            
            if not is_instructor:
                teacher_user = await mongodb.db.users.find_one({"user_id": instructor_id})
                teacher_mongo_id = str(teacher_user["_id"]) if teacher_user else None
                
                group_ids = assessment.get("group_ids", [])
                logger.info(f"Delete permission check: test_id={assessment_id}, user={instructor_id}, mongo_id={teacher_mongo_id}, group_ids={group_ids}")
                
                if group_ids:
                    teacher_match = [
                        {"teacher_ids": instructor_id},
                        {"teacher_id": instructor_id}
                    ]
                    if teacher_mongo_id and teacher_mongo_id != instructor_id:
                        teacher_match.extend([
                            {"teacher_ids": teacher_mongo_id},
                            {"teacher_id": teacher_mongo_id}
                        ])
                    
                    teacher_groups = await mongodb.db.groups.find({
                        "_id": {"$in": [ObjectId(gid) for gid in group_ids if ObjectId.is_valid(gid)]},
                        "$or": teacher_match
                    }).to_list(length=100)
                    is_assigned_teacher = len(teacher_groups) > 0
                    logger.info(f"Delete permission check: groups_found={len(teacher_groups)}, matched={is_assigned_teacher}")
            
            if not is_instructor and not is_assigned_teacher:
                logger.warning(f"User {instructor_id} DENIED access to delete assessment {assessment_id}")
                return False
            
            logger.info(f"User {instructor_id} ALLOWED to delete assessment {assessment_id} (instructor={is_instructor}, assigned={is_assigned_teacher})")
            
            deleted_submissions = await self.submissions.delete_many({"assessment_id": assessment_id})
            logger.info(f"Deleted {deleted_submissions.deleted_count} submissions for assessment {assessment_id}")
            
            result = await self.assessments.delete_one({"_id": ObjectId(assessment_id)})
            
            if result.deleted_count == 0:
                return False
            
            await mongodb.db.notifications.delete_many({"assessment_id": assessment_id})
            
            logger.info(f"Deleted assessment: {assessment_id} by user {instructor_id}")
            return True
            
        except Exception as e:
            logger.error(f"Delete assessment error: {e}")
            return False
    
    async def add_question(
        self,
        assessment_id: str,
        request: QuestionCreateRequest,
        instructor_id: str
    ) -> Optional[Question]:
        """Add a question to an assessment. Teachers can edit if assigned to the test's groups."""
        try:
            assessment = await self.assessments.find_one({"_id": ObjectId(assessment_id)})
            
            if not assessment:
                return None
            
            is_instructor = assessment.get("instructor_id") == instructor_id
            is_assigned_teacher = False
            
            if not is_instructor:
                teacher_user = await mongodb.db.users.find_one({"user_id": instructor_id})
                teacher_mongo_id = str(teacher_user["_id"]) if teacher_user else None
                
                group_ids = assessment.get("group_ids", [])
                if group_ids:
                    teacher_match = [
                        {"teacher_ids": instructor_id},
                        {"teacher_id": instructor_id}
                    ]
                    if teacher_mongo_id and teacher_mongo_id != instructor_id:
                        teacher_match.extend([
                            {"teacher_ids": teacher_mongo_id},
                            {"teacher_id": teacher_mongo_id}
                        ])
                    
                    teacher_groups = await mongodb.db.groups.find({
                        "_id": {"$in": [ObjectId(gid) for gid in group_ids if ObjectId.is_valid(gid)]},
                        "$or": teacher_match
                    }).to_list(length=100)
                    is_assigned_teacher = len(teacher_groups) > 0
            
            if not is_instructor and not is_assigned_teacher:
                return None
            
            question_id = str(uuid.uuid4())
            order = len(assessment.get("questions", []))
            
            question = {
                "id": question_id,
                "type": request.type.value,
                "question_text": request.question_text,
                "explanation": request.explanation,
                "points": request.points,
                "order": order,
                "options": [opt.model_dump() for opt in request.options],
                "correct_answer_bool": request.correct_answer_bool,
                "correct_answer_text": request.correct_answer_text,
                "matching_pairs": request.matching_pairs,
                "tags": request.tags,
                "difficulty": request.difficulty
            }
            
            current_total = assessment.get("total_points", 0)
            
            await self.assessments.update_one(
                {"_id": ObjectId(assessment_id)},
                {
                    "$push": {"questions": question},
                    "$set": {
                        "total_points": current_total + request.points,
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            
            return Question(**question)
            
        except Exception as e:
            logger.error(f"Add question error: {e}")
            return None
    
    async def update_question(
        self,
        assessment_id: str,
        question_id: str,
        request: QuestionCreateRequest,
        instructor_id: str
    ) -> bool:
        """Update a question in an assessment. Teachers can edit if assigned to the test's groups."""
        try:
            assessment = await self.assessments.find_one({"_id": ObjectId(assessment_id)})
            
            if not assessment:
                return False
            
            is_instructor = assessment.get("instructor_id") == instructor_id
            is_assigned_teacher = False
            
            if not is_instructor:
                teacher_user = await mongodb.db.users.find_one({"user_id": instructor_id})
                teacher_mongo_id = str(teacher_user["_id"]) if teacher_user else None
                
                group_ids = assessment.get("group_ids", [])
                if group_ids:
                    teacher_match = [
                        {"teacher_ids": instructor_id},
                        {"teacher_id": instructor_id}
                    ]
                    if teacher_mongo_id and teacher_mongo_id != instructor_id:
                        teacher_match.extend([
                            {"teacher_ids": teacher_mongo_id},
                            {"teacher_id": teacher_mongo_id}
                        ])
                    
                    teacher_groups = await mongodb.db.groups.find({
                        "_id": {"$in": [ObjectId(gid) for gid in group_ids if ObjectId.is_valid(gid)]},
                        "$or": teacher_match
                    }).to_list(length=100)
                    is_assigned_teacher = len(teacher_groups) > 0
            
            if not is_instructor and not is_assigned_teacher:
                return False
            
            questions = assessment.get("questions", [])
            question_idx = None
            old_points = 0
            
            for idx, q in enumerate(questions):
                if q.get("id") == question_id:
                    question_idx = idx
                    old_points = q.get("points", 0)
                    break
            
            if question_idx is None:
                return False
            
            questions[question_idx].update({
                "type": request.type.value,
                "question_text": request.question_text,
                "explanation": request.explanation,
                "points": request.points,
                "options": [opt.model_dump() for opt in request.options],
                "correct_answer_bool": request.correct_answer_bool,
                "correct_answer_text": request.correct_answer_text,
                "matching_pairs": request.matching_pairs,
                "tags": request.tags,
                "difficulty": request.difficulty
            })
            
            new_total = assessment.get("total_points", 0) - old_points + request.points
            
            await self.assessments.update_one(
                {"_id": ObjectId(assessment_id)},
                {"$set": {
                    "questions": questions,
                    "total_points": new_total,
                    "updated_at": datetime.utcnow()
                }}
            )
            
            return True
            
        except Exception as e:
            logger.error(f"Update question error: {e}")
            return False
    
    async def delete_question(
        self,
        assessment_id: str,
        question_id: str,
        instructor_id: str
    ) -> bool:
        """Delete a question from an assessment. Teachers can delete if assigned to the test's groups."""
        try:
            assessment = await self.assessments.find_one({"_id": ObjectId(assessment_id)})
            
            if not assessment:
                return False
            
            is_instructor = assessment.get("instructor_id") == instructor_id
            is_assigned_teacher = False
            
            if not is_instructor:
                teacher_user = await mongodb.db.users.find_one({"user_id": instructor_id})
                teacher_mongo_id = str(teacher_user["_id"]) if teacher_user else None
                
                group_ids = assessment.get("group_ids", [])
                if group_ids:
                    teacher_match = [
                        {"teacher_ids": instructor_id},
                        {"teacher_id": instructor_id}
                    ]
                    if teacher_mongo_id and teacher_mongo_id != instructor_id:
                        teacher_match.extend([
                            {"teacher_ids": teacher_mongo_id},
                            {"teacher_id": teacher_mongo_id}
                        ])
                    
                    teacher_groups = await mongodb.db.groups.find({
                        "_id": {"$in": [ObjectId(gid) for gid in group_ids if ObjectId.is_valid(gid)]},
                        "$or": teacher_match
                    }).to_list(length=100)
                    is_assigned_teacher = len(teacher_groups) > 0
                    teacher_groups = await mongodb.db.groups.find({
                        "_id": {"$in": [ObjectId(gid) for gid in group_ids if ObjectId.is_valid(gid)]},
                        "$or": [
                            {"teacher_ids": instructor_id},
                            {"teacher_id": instructor_id}
                        ]
                    }).to_list(length=100)
                    is_assigned_teacher = len(teacher_groups) > 0
            
            if not is_instructor and not is_assigned_teacher:
                return False
            
            questions = assessment.get("questions", [])
            points_to_remove = 0
            new_questions = []
            
            for q in questions:
                if q.get("id") == question_id:
                    points_to_remove = q.get("points", 0)
                else:
                    new_questions.append(q)
            
            if len(questions) == len(new_questions):
                return False
            
            for idx, q in enumerate(new_questions):
                q["order"] = idx
            
            new_total = assessment.get("total_points", 0) - points_to_remove
            
            await self.assessments.update_one(
                {"_id": ObjectId(assessment_id)},
                {"$set": {
                    "questions": new_questions,
                    "total_points": max(0, new_total),
                    "updated_at": datetime.utcnow()
                }}
            )
            
            return True
            
        except Exception as e:
            logger.error(f"Delete question error: {e}")
            return False
    
    async def get_student_view(
        self,
        assessment_id: str,
        student_id: str
    ) -> Optional[StudentAssessmentView]:
        """Get assessment for student (hides correct answers)."""
        try:
            assessment = await self.assessments.find_one({
                "_id": ObjectId(assessment_id),
                "status": AssessmentStatus.PUBLISHED.value
            })
            
            if not assessment:
                return None
            
            now = datetime.utcnow()
            if assessment.get("available_from") and now < assessment["available_from"]:
                return None
            
            submissions = await self.submissions.count_documents({
                "assessment_id": assessment_id,
                "student_id": student_id,
                "status": {"$ne": SubmissionStatus.IN_PROGRESS.value}
            })
            
            settings = assessment.get("settings", {})
            if submissions >= settings.get("attempt_limit", 1):
                return None
            
            questions = []
            for q in assessment.get("questions", []):
                stripped = {
                    "id": q.get("id"),
                    "type": q.get("type"),
                    "question_text": q.get("question_text"),
                    "points": q.get("points"),
                    "order": q.get("order")
                }
                
                if q.get("options"):
                    stripped["options"] = [
                        {"id": opt["id"], "text": opt["text"]}
                        for opt in q["options"]
                    ]
                
                if q.get("matching_pairs"):
                    stripped["matching_left"] = list(q["matching_pairs"].keys())
                    stripped["matching_right"] = list(q["matching_pairs"].values())
                
                questions.append(stripped)
            
            return StudentAssessmentView(
                id=str(assessment["_id"]),
                title=assessment["title"],
                description=assessment.get("description"),
                type=assessment["type"],
                time_limit_minutes=settings.get("time_limit_minutes"),
                question_count=len(questions),
                total_points=assessment.get("total_points", 0),
                questions=questions
            )
            
        except Exception as e:
            logger.error(f"Get student view error: {e}")
            return None
    
    async def start_attempt(
        self,
        assessment_id: str,
        student_id: str,
        student_name: str
    ) -> Optional[SubmissionResponse]:
        """Start a new assessment attempt."""
        try:
            existing = await self.submissions.find_one({
                "assessment_id": assessment_id,
                "student_id": student_id,
                "status": SubmissionStatus.IN_PROGRESS.value
            })
            
            if existing:
                return self._submission_to_response(existing)
            
            assessment = await self.assessments.find_one({"_id": ObjectId(assessment_id)})
            if not assessment:
                return None
            
            attempt_count = await self.submissions.count_documents({
                "assessment_id": assessment_id,
                "student_id": student_id
            })
            
            submission = {
                "assessment_id": assessment_id,
                "student_id": student_id,
                "student_name": student_name,
                "attempt_number": attempt_count + 1,
                "status": SubmissionStatus.IN_PROGRESS.value,
                "answers": [],
                "auto_score": 0,
                "manual_score": 0,
                "total_score": 0,
                "max_score": assessment.get("total_points", 0),
                "percentage": 0.0,
                "passed": False,
                "feedback": {},
                "overall_feedback": None,
                "started_at": datetime.utcnow(),
                "submitted_at": None,
                "graded_at": None,
                "time_spent_seconds": 0
            }
            
            result = await self.submissions.insert_one(submission)
            submission["id"] = str(result.inserted_id)
            
            return self._submission_to_response(submission)
            
        except Exception as e:
            logger.error(f"Start attempt error: {e}")
            return None
    
    async def submit_answers(
        self,
        submission_id: str,
        request: SubmitAssessmentRequest,
        student_id: str
    ) -> Optional[SubmissionDetailResponse]:
        """Submit answers and calculate auto-grade."""
        try:
            submission = await self.submissions.find_one({
                "_id": ObjectId(submission_id),
                "student_id": student_id,
                "status": SubmissionStatus.IN_PROGRESS.value
            })
            
            if not submission:
                return None
            
            assessment = await self.assessments.find_one({
                "_id": ObjectId(submission["assessment_id"])
            })
            
            if not assessment:
                return None
            
            auto_score = 0
            needs_manual = False
            questions_map = {q["id"]: q for q in assessment.get("questions", [])}
            
            for answer in request.answers:
                question = questions_map.get(answer.question_id)
                if not question:
                    continue
                
                q_type = question.get("type")
                points = question.get("points", 0)
                
                if q_type == QuestionType.MCQ.value:
                    correct_ids = [
                        opt["id"] for opt in question.get("options", [])
                        if opt.get("is_correct")
                    ]
                    if answer.selected_option_ids == correct_ids:
                        auto_score += points
                
                elif q_type == QuestionType.MCQ_MULTI.value:
                    correct_ids = set(
                        opt["id"] for opt in question.get("options", [])
                        if opt.get("is_correct")
                    )
                    selected_ids = set(answer.selected_option_ids)
                    if correct_ids == selected_ids:
                        auto_score += points
                
                elif q_type == QuestionType.TRUE_FALSE.value:
                    if answer.answer_bool == question.get("correct_answer_bool"):
                        auto_score += points
                
                elif q_type == QuestionType.SHORT_ANSWER.value:
                    correct = question.get("correct_answer_text", "").strip().lower()
                    given = (answer.answer_text or "").strip().lower()
                    if correct and given == correct:
                        auto_score += points
                    elif question.get("accept_partial") and correct in given:
                        auto_score += points // 2
                
                elif q_type in [QuestionType.ESSAY.value, QuestionType.FILE_UPLOAD.value]:
                    needs_manual = True
                
                elif q_type == QuestionType.MATCHING.value:
                    correct_pairs = question.get("matching_pairs", {})
                    given_pairs = answer.matching_answers or {}
                    correct_count = sum(
                        1 for k, v in correct_pairs.items()
                        if given_pairs.get(k) == v
                    )
                    if correct_count == len(correct_pairs):
                        auto_score += points
                    else:
                        auto_score += int(points * correct_count / max(len(correct_pairs), 1))
            
            max_score = assessment.get("total_points", 0)
            total_score = auto_score
            percentage = (total_score / max_score * 100) if max_score > 0 else 0
            passing = assessment.get("settings", {}).get("passing_score_percent", 60)
            passed = percentage >= passing
            
            status = SubmissionStatus.GRADED.value if not needs_manual else SubmissionStatus.SUBMITTED.value
            
            started = submission.get("started_at", datetime.utcnow())
            time_spent = int((datetime.utcnow() - started).total_seconds())
            
            update_data = {
                "answers": [a.model_dump() for a in request.answers],
                "auto_score": auto_score,
                "total_score": total_score,
                "max_score": max_score,
                "percentage": round(percentage, 2),
                "passed": passed,
                "status": status,
                "submitted_at": datetime.utcnow(),
                "time_spent_seconds": time_spent
            }
            
            evaluation_type = assessment.get("evaluation_type", "manual")
            if evaluation_type == "ai":
                try:
                    from app.services.rag_evaluation_service import rag_evaluation_service
                    
                    questions_for_eval = []
                    answers_for_eval = []
                    
                    for answer in request.answers:
                        question = questions_map.get(answer.question_id)
                        if not question:
                            continue
                        
                        q_type = question.get("type", "")
                        expected = ""
                        if question.get("answer_text"):
                            expected = question["answer_text"]
                        elif question.get("fillup_answers"):
                            expected = question["fillup_answers"]
                        elif question.get("correct_answer_text"):
                            expected = question["correct_answer_text"]
                        elif q_type in ["mcq", QuestionType.MCQ.value]:
                            for opt in question.get("options", []):
                                if opt.get("is_correct"):
                                    expected = opt.get("text", opt.get("option_text", ""))
                                    break
                        
                        student_answer = answer.answer_text or ""
                        if not student_answer and answer.selected_option_ids:
                            for opt in question.get("options", []):
                                if opt.get("id") in answer.selected_option_ids:
                                    student_answer = opt.get("text", opt.get("option_text", ""))
                                    break
                        
                        questions_for_eval.append({
                            "question_id": answer.question_id,
                            "question_text": question.get("question_text", question.get("text", "")),
                            "expected_answer": expected,
                            "keywords": question.get("keywords", []),
                            "marks": question.get("points", question.get("marks", 1)),
                            "question_type": q_type,
                            "topic": question.get("topic", ""),
                            "correct_option": question.get("correct_option", ""),
                            "options": question.get("options", {})
                        })
                        
                        answers_for_eval.append({
                            "question_id": answer.question_id,
                            "answer": student_answer
                        })
                    
                    if questions_for_eval:
                        subject = assessment.get("subject", "")
                        class_level = assessment.get("class_level", 10)
                        
                        eval_result = await rag_evaluation_service.evaluate_test_session(
                            session_id=f"staff_{submission_id}",
                            student_id=student_id,
                            class_level=class_level,
                            subject=subject,
                            chapter_number=0,
                            topic_id="",
                            topic_name=assessment.get("title", "Staff Test"),
                            questions=questions_for_eval,
                            answers=answers_for_eval
                        )
                        
                        ai_score_pct = eval_result.get("score", 0)
                        ai_total = round(ai_score_pct * max_score / 100, 1) if max_score > 0 else 0
                        
                        update_data["total_score"] = ai_total
                        update_data["percentage"] = round(ai_score_pct, 2)
                        update_data["passed"] = ai_score_pct >= passing
                        update_data["status"] = SubmissionStatus.GRADED.value
                        update_data["evaluation_details"] = eval_result.get("evaluations", [])
                        update_data["overall_feedback"] = eval_result.get("feedback", "")
                        update_data["strengths"] = eval_result.get("strengths", [])
                        update_data["improvements"] = eval_result.get("improvements", [])
                        update_data["topics_to_review"] = eval_result.get("topics_to_review", [])
                        
                        logger.info(f"AI evaluation complete for staff test submission {submission_id}: {ai_score_pct}%")
                
                except Exception as ai_err:
                    logger.error(f"AI evaluation failed for submission {submission_id}: {ai_err}")
            
            if not needs_manual or evaluation_type == "ai":
                update_data["graded_at"] = datetime.utcnow()
            
            await self.submissions.update_one(
                {"_id": ObjectId(submission_id)},
                {"$set": update_data}
            )
            
            updated = await self.submissions.find_one({"_id": ObjectId(submission_id)})
            return self._submission_to_detail_response(updated)
            
        except Exception as e:
            logger.error(f"Submit answers error: {e}")
            return None
    
    async def grade_submission(
        self,
        submission_id: str,
        request: GradeSubmissionRequest,
        instructor_id: str
    ) -> Optional[SubmissionDetailResponse]:
        """Manually grade a submission."""
        try:
            submission = await self.submissions.find_one({"_id": ObjectId(submission_id)})
            if not submission:
                return None
            
            assessment = await self.assessments.find_one({"_id": ObjectId(submission["assessment_id"])})
            
            if not assessment:
                return None
            
            is_instructor = assessment.get("instructor_id") == instructor_id
            is_assigned_teacher = False
            
            if not is_instructor:
                teacher_user = await mongodb.db.users.find_one({"user_id": instructor_id})
                teacher_mongo_id = str(teacher_user["_id"]) if teacher_user else None
                
                group_ids = assessment.get("group_ids", [])
                if group_ids:
                    teacher_match = [
                        {"teacher_ids": instructor_id},
                        {"teacher_id": instructor_id}
                    ]
                    if teacher_mongo_id and teacher_mongo_id != instructor_id:
                        teacher_match.extend([
                            {"teacher_ids": teacher_mongo_id},
                            {"teacher_id": teacher_mongo_id}
                        ])
                    
                    teacher_groups = await mongodb.db.groups.find({
                        "_id": {"$in": [ObjectId(gid) for gid in group_ids if ObjectId.is_valid(gid)]},
                        "$or": teacher_match
                    }).to_list(length=100)
                    is_assigned_teacher = len(teacher_groups) > 0
            
            if not is_instructor and not is_assigned_teacher:
                return None
            
            manual_score = sum(request.question_grades.values())
            auto_score = submission.get("auto_score", 0)
            total_score = auto_score + manual_score
            max_score = submission.get("max_score", 0)
            percentage = (total_score / max_score * 100) if max_score > 0 else 0
            passing = assessment.get("settings", {}).get("passing_score_percent", 60)
            passed = percentage >= passing
            
            update_data = {
                "manual_score": manual_score,
                "total_score": total_score,
                "percentage": round(percentage, 2),
                "passed": passed,
                "feedback": request.question_grades,
                "overall_feedback": request.overall_feedback,
                "status": SubmissionStatus.GRADED.value,
                "graded_at": datetime.utcnow()
            }
            
            await self.submissions.update_one(
                {"_id": ObjectId(submission_id)},
                {"$set": update_data}
            )
            
            updated = await self.submissions.find_one({"_id": ObjectId(submission_id)})
            return self._submission_to_detail_response(updated)
            
        except Exception as e:
            logger.error(f"Grade submission error: {e}")
            return None
    
    async def get_submissions(
        self,
        assessment_id: str = None,
        student_id: str = None,
        instructor_id: str = None
    ) -> SubmissionListResponse:
        """List submissions with filters."""
        try:
            query = {}
            
            if assessment_id:
                query["assessment_id"] = assessment_id
                
                if instructor_id:
                    assessment = await self.assessments.find_one({"_id": ObjectId(assessment_id)})
                    if not assessment:
                        return SubmissionListResponse(submissions=[], total=0)
                    
                    is_instructor = assessment.get("instructor_id") == instructor_id
                    is_assigned_teacher = False
                    
                    if not is_instructor:
                        teacher_user = await mongodb.db.users.find_one({"user_id": instructor_id})
                        teacher_mongo_id = str(teacher_user["_id"]) if teacher_user else None
                        
                        group_ids = assessment.get("group_ids", [])
                        if group_ids:
                            teacher_match = [
                                {"teacher_ids": instructor_id},
                                {"teacher_id": instructor_id}
                            ]
                            if teacher_mongo_id and teacher_mongo_id != instructor_id:
                                teacher_match.extend([
                                    {"teacher_ids": teacher_mongo_id},
                                    {"teacher_id": teacher_mongo_id}
                                ])
                            
                            teacher_groups = await mongodb.db.groups.find({
                                "_id": {"$in": [ObjectId(gid) for gid in group_ids if ObjectId.is_valid(gid)]},
                                "$or": teacher_match
                            }).to_list(length=100)
                            is_assigned_teacher = len(teacher_groups) > 0
                    
                    if not is_instructor and not is_assigned_teacher:
                        return SubmissionListResponse(submissions=[], total=0)
            
            if student_id:
                query["student_id"] = student_id
            
            total = await self.submissions.count_documents(query)
            cursor = self.submissions.find(query).sort("submitted_at", -1)
            
            submissions = []
            async for doc in cursor:
                submissions.append(self._submission_to_response(doc))
            
            return SubmissionListResponse(submissions=submissions, total=total)
            
        except Exception as e:
            logger.error(f"Get submissions error: {e}")
            return SubmissionListResponse(submissions=[], total=0)
    
    def _to_response(self, doc: dict, submission_count: int = 0) -> AssessmentResponse:
        from app.models.assessment_models import AssessmentSettings
        
        settings_data = doc.get("settings", {})
        settings = AssessmentSettings(**settings_data) if settings_data else AssessmentSettings()
        
        return AssessmentResponse(
            id=str(doc.get("_id", doc.get("id", ""))),
            course_id=doc.get("course_id", ""),
            title=doc["title"],
            description=doc.get("description"),
            type=doc["type"],
            instructor_id=doc["instructor_id"],
            subject=doc.get("subject"),
            class_level=doc.get("class_level", 10),
            status=doc["status"],
            question_count=len(doc.get("questions", [])),
            total_points=doc.get("total_points", 0),
            settings=settings,
            due_date=doc.get("due_date"),
            available_from=doc.get("available_from"),
            start_datetime=doc.get("start_datetime"),
            end_datetime=doc.get("end_datetime"),
            submission_count=submission_count,
            created_at=doc.get("created_at", datetime.utcnow())
        )
    
    def _to_detail_response(self, doc: dict) -> AssessmentDetailResponse:
        base = self._to_response(doc)
        questions = []
        for q in doc.get("questions", []):
            try:
                questions.append(Question(**q))
            except Exception:
                try:
                    transformed = self._transform_question(q.copy())
                    questions.append(Question(**transformed))
                except Exception as e:
                    logger.warning(f"Skipping invalid question in assessment {doc.get('_id')}: {e}")
        
        return AssessmentDetailResponse(
            **base.model_dump(), 
            questions=questions, 
            student_ids=doc.get("student_ids", []),
            group_ids=doc.get("group_ids", [])
        )

    def _transform_question(self, q: dict) -> dict:
        """Transform frontend/question-bank question format to backend Question model format."""
        import uuid
        
        logger.info(f"Transforming question payload: {q}")
        
        if "text" in q:
            q["question_text"] = q["text"]
            
        if "question_text" not in q:
            q["question_text"] = "Question Text Missing"
            
        raw_options = q.get("options", [])
        options_text = []
        
        if raw_options and isinstance(raw_options, list):
            if len(raw_options) > 0:
                if isinstance(raw_options[0], str):
                    options_text = [str(opt) for opt in raw_options]
                elif isinstance(raw_options[0], dict):
                    options_text = [str(opt.get("text", "")) for opt in raw_options]
        
        q_type = q.get("type", "mcq")
        correct_indices = set()
        
        if q_type == "mcq":
            correct_answers_raw = q.get("correct_answers", [])
            for ca in correct_answers_raw:
                try:
                    correct_indices.add(int(ca))
                except (ValueError, TypeError):
                    pass
            
            if not correct_indices:
                raw_correct = q.get("correct_answer")
                if raw_correct is not None:
                    try:
                        correct_indices.add(int(raw_correct))
                    except (ValueError, TypeError):
                        if isinstance(raw_correct, str) and raw_correct in options_text:
                            correct_indices.add(options_text.index(raw_correct))
            
            if len(correct_indices) > 1:
                q["type"] = "mcq_multi"
        
        new_options = []
        for idx, text in enumerate(options_text):
            is_correct = (idx in correct_indices)
            
            opt_id = str(uuid.uuid4())
            if raw_options and isinstance(raw_options[0], dict) and idx < len(raw_options):
                opt_id = str(raw_options[idx].get("id", opt_id))

            new_options.append({
                "id": opt_id,
                "text": text,
                "is_correct": is_correct
            })
            
        q["options"] = new_options
            
        if "id" not in q:
            q["id"] = str(uuid.uuid4())
        
        if "type" not in q:
            q["type"] = "mcq"

        if "points" not in q:
            try:
                q["points"] = int(q.get("marks", 1))
            except (ValueError, TypeError):
                q["points"] = 1

        return q
    
    def _submission_to_response(self, doc: dict) -> SubmissionResponse:
        return SubmissionResponse(
            id=str(doc["_id"]),
            assessment_id=doc["assessment_id"],
            student_id=doc["student_id"],
            student_name=doc["student_name"],
            attempt_number=doc.get("attempt_number", 1),
            status=doc["status"],
            total_score=doc.get("total_score", 0),
            max_score=doc.get("max_score", 0),
            percentage=doc.get("percentage", 0),
            passed=doc.get("passed", False),
            submitted_at=doc.get("submitted_at"),
            graded_at=doc.get("graded_at"),
            admin_comment=doc.get("admin_comment"),
            is_reviewed=doc.get("is_reviewed", False)
        )
    
    def _submission_to_detail_response(self, doc: dict) -> SubmissionDetailResponse:
        base = self._submission_to_response(doc)
        answers = [AnswerSubmission(**a) for a in doc.get("answers", [])]
        return SubmissionDetailResponse(
            **base.model_dump(),
            answers=answers,
            feedback=doc.get("feedback", {}),
            overall_feedback=doc.get("overall_feedback"),
            time_spent_seconds=doc.get("time_spent_seconds", 0)
        )

assessment_service = AssessmentService()
