"""
Analytics and Gradebook Service

Provides aggregated analytics for courses, assessments, and student performance.
Includes grade calculations and export functionality.
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from bson import ObjectId
import logging
import csv
import io

from app.db.mongo import mongodb

logger = logging.getLogger(__name__)

class AnalyticsService:
    """Service for analytics and gradebook functionality."""
    
    def __init__(self):
        self._courses = None
        self._assessments = None
        self._submissions = None
        self._enrollments = None
        self._users = None
    
    @property
    def courses(self):
        if self._courses is None and mongodb.db is not None:
            self._courses = mongodb.get_collection("courses")
        return self._courses
    
    @property
    def assessments(self):
        if self._assessments is None and mongodb.db is not None:
            self._assessments = mongodb.get_collection("assessments")
        return self._assessments
    
    @property
    def submissions(self):
        if self._submissions is None and mongodb.db is not None:
            self._submissions = mongodb.get_collection("submissions")
        return self._submissions
    
    @property
    def users(self):
        if self._users is None and mongodb.db is not None:
            self._users = mongodb.get_collection("users")
        return self._users
    
    async def get_student_grades(
        self,
        student_id: str,
        course_id: str = None
    ) -> Dict[str, Any]:
        """Get all grades for a student — includes both staff test submissions and AI test sessions."""
        try:
            grades = []
            total_score = 0
            total_max = 0
            topic_performance = {}

            student_mongo_id = None
            user_doc = await self.users.find_one({"user_id": student_id})
            if user_doc:
                student_mongo_id = str(user_doc["_id"])
            logger.info(f"📊 Resolved student: user_id={student_id}, mongo_id={student_mongo_id}")

            query = {"student_id": student_id, "status": {"$in": ["graded", "submitted"]}}
            if course_id:
                course_assessments = await self.assessments.find(
                    {"course_id": course_id}
                ).to_list(length=1000)
                assessment_ids = [str(a["_id"]) for a in course_assessments]
                query["assessment_id"] = {"$in": assessment_ids}
            
            submissions = await self.submissions.find(query).to_list(length=1000)
            
            for sub in submissions:
                assessment = await self.assessments.find_one(
                    {"_id": ObjectId(sub["assessment_id"])}
                )
                
                score = sub.get("total_score", 0)
                max_score = sub.get("max_score", 0)
                
                grades.append({
                    "id": str(sub["_id"]),
                    "source": "staff_test",
                    "assessment_id": sub["assessment_id"],
                    "title": assessment["title"] if assessment else "Unknown",
                    "type": assessment.get("type") if assessment else "test",
                    "subject": assessment.get("subject", "") if assessment else "",
                    "score": score,
                    "max_score": max_score,
                    "percentage": sub.get("percentage", 0),
                    "passed": sub.get("passed", False),
                    "completed_at": sub.get("graded_at") or sub.get("submitted_at"),
                    "evaluation_type": assessment.get("evaluation_type", "manual") if assessment else "manual",
                    "evaluations": sub.get("evaluation_details", []),
                    "feedback": sub.get("overall_feedback", ""),
                    "strengths": sub.get("strengths", []),
                    "improvements": sub.get("improvements", []),
                })
                
                total_score += score
                total_max += max_score
                
                if assessment:
                    for q in assessment.get("questions", []):
                        topic = q.get("topic") or q.get("chapter_name", "General")
                        if topic not in topic_performance:
                            topic_performance[topic] = {"correct": 0, "total": 0, "scores": []}
                        topic_performance[topic]["total"] += 1

            test_sessions_collection = mongodb.db["test_sessions"]
            ai_student_ids = [student_id]
            if student_mongo_id and student_mongo_id != student_id:
                ai_student_ids.append(student_mongo_id)
            ai_sessions = await test_sessions_collection.find({
                "student_id": {"$in": ai_student_ids},
                "status": "completed"
            }).sort("completed_at", -1).to_list(length=500)
            
            for session in ai_sessions:
                session_score = session.get("score", 0)
                total_q = session.get("total_questions", 0)
                correct = session.get("correct_count", 0)
                max_marks = 20
                earned = round(session_score * max_marks / 100, 1) if max_marks > 0 else 0
                
                chapter_name = session.get("chapter_name", f"Ch.{session.get('chapter_number', 0)}")
                topic_name = session.get("topic_name", "")
                subject = session.get("subject", "Unknown")
                
                eval_status = session.get("evaluation_status", "completed")
                grades.append({
                    "id": session.get("session_id", str(session.get("_id", ""))),
                    "source": "ai_test",
                    "title": f"{subject} - {chapter_name}" + (f" ({topic_name})" if topic_name else ""),
                    "type": "chapter_test",
                    "subject": subject,
                    "chapter_name": chapter_name,
                    "topic_name": topic_name,
                    "score": earned,
                    "max_score": max_marks,
                    "percentage": round(session_score, 1),
                    "passed": session_score >= 40,
                    "completed_at": session.get("completed_at"),
                    "total_questions": total_q,
                    "correct_count": correct,
                    "evaluation_type": "ai",
                    "evaluation_status": eval_status,
                    "evaluations": session.get("evaluation_details", []),
                    "feedback": session.get("overall_feedback", {}).get("summary", "") if isinstance(session.get("overall_feedback"), dict) else "",
                    "strengths": session.get("overall_feedback", {}).get("strengths", []) if isinstance(session.get("overall_feedback"), dict) else [],
                    "improvements": session.get("overall_feedback", {}).get("improvements", []) if isinstance(session.get("overall_feedback"), dict) else [],
                    "topics_to_review": session.get("topics_to_review", []),
                    "topic_analytics": session.get("topic_analytics", {}),
                })
                
                total_score += earned
                total_max += max_marks
                
                for ev in session.get("evaluation_details", []):
                    t = ev.get("topic") or topic_name or chapter_name or "General"
                    if t not in topic_performance:
                        topic_performance[t] = {"correct": 0, "total": 0, "scores": []}
                    topic_performance[t]["total"] += 1
                    if ev.get("is_correct"):
                        topic_performance[t]["correct"] += 1
                    topic_performance[t]["scores"].append(ev.get("score", 0))

            def _sort_key(g):
                dt = g.get("completed_at")
                if dt is None:
                    return datetime.min
                if isinstance(dt, str):
                    try:
                        return datetime.fromisoformat(dt.replace("Z", "+00:00"))
                    except Exception:
                        return datetime.min
                return dt
            grades.sort(key=_sort_key, reverse=True)
            
            overall_percentage = (total_score / total_max * 100) if total_max > 0 else 0
            
            topic_analysis = []
            for topic, data in topic_performance.items():
                avg_score = round(sum(data["scores"]) / len(data["scores"]), 1) if data["scores"] else 0
                accuracy = round(data["correct"] / data["total"] * 100, 1) if data["total"] > 0 else 0
                status = "strong" if accuracy >= 70 else ("moderate" if accuracy >= 40 else "weak")
                topic_analysis.append({
                    "topic": topic,
                    "total_questions": data["total"],
                    "correct": data["correct"],
                    "accuracy": accuracy,
                    "avg_score": avg_score,
                    "status": status
                })
            topic_analysis.sort(key=lambda x: x["accuracy"], reverse=True)
            
            strong_topics = [t["topic"] for t in topic_analysis if t["status"] == "strong"]
            weak_topics = [t["topic"] for t in topic_analysis if t["status"] == "weak"]
            
            return {
                "student_id": student_id,
                "course_id": course_id,
                "grades": grades,
                "total_score": round(total_score, 1),
                "total_max_score": round(total_max, 1),
                "overall_percentage": round(overall_percentage, 2),
                "grade_count": len(grades),
                "topic_analysis": topic_analysis,
                "strong_topics": strong_topics,
                "weak_topics": weak_topics,
            }
            
        except Exception as e:
            logger.error(f"Get student grades error: {e}")
            return {
                "student_id": student_id,
                "grades": [],
                "total_score": 0,
                "total_max_score": 0,
                "overall_percentage": 0,
                "grade_count": 0,
                "topic_analysis": [],
                "strong_topics": [],
                "weak_topics": [],
            }
    
    async def get_course_analytics(
        self,
        course_id: str,
        instructor_id: str
    ) -> Dict[str, Any]:
        """Get analytics for a course."""
        try:
            course = await self.courses.find_one({
                "_id": ObjectId(course_id),
                "instructor_id": instructor_id
            })
            
            if not course:
                return None
            
            assessments = await self.assessments.find(
                {"course_id": course_id}
            ).to_list(length=100)
            
            assessment_ids = [str(a["_id"]) for a in assessments]
            
            all_submissions = await self.submissions.find({
                "assessment_id": {"$in": assessment_ids},
                "status": "graded"
            }).to_list(length=10000)
            
            total_submissions = len(all_submissions)
            if total_submissions == 0:
                return {
                    "course_id": course_id,
                    "course_title": course["title"],
                    "total_students": len(course.get("enrolled_students", [])),
                    "total_assessments": len(assessments),
                    "total_submissions": 0,
                    "average_score": 0,
                    "pass_rate": 0,
                    "score_distribution": {},
                    "assessment_stats": []
                }
            
            scores = [s.get("percentage", 0) for s in all_submissions]
            average_score = sum(scores) / len(scores)
            pass_count = sum(1 for s in all_submissions if s.get("passed", False))
            pass_rate = (pass_count / total_submissions * 100)
            
            distribution = {"0-20": 0, "21-40": 0, "41-60": 0, "61-80": 0, "81-100": 0}
            for score in scores:
                if score <= 20:
                    distribution["0-20"] += 1
                elif score <= 40:
                    distribution["21-40"] += 1
                elif score <= 60:
                    distribution["41-60"] += 1
                elif score <= 80:
                    distribution["61-80"] += 1
                else:
                    distribution["81-100"] += 1
            
            assessment_stats = []
            for assessment in assessments:
                a_id = str(assessment["_id"])
                a_submissions = [s for s in all_submissions if s["assessment_id"] == a_id]
                
                if a_submissions:
                    a_scores = [s.get("percentage", 0) for s in a_submissions]
                    assessment_stats.append({
                        "assessment_id": a_id,
                        "title": assessment["title"],
                        "type": assessment.get("type"),
                        "submission_count": len(a_submissions),
                        "average_score": round(sum(a_scores) / len(a_scores), 2),
                        "highest_score": max(a_scores),
                        "lowest_score": min(a_scores)
                    })
            
            return {
                "course_id": course_id,
                "course_title": course["title"],
                "total_students": len(course.get("enrolled_students", [])),
                "total_assessments": len(assessments),
                "total_submissions": total_submissions,
                "average_score": round(average_score, 2),
                "pass_rate": round(pass_rate, 2),
                "score_distribution": distribution,
                "assessment_stats": assessment_stats
            }
            
        except Exception as e:
            logger.error(f"Get course analytics error: {e}")
            return None
    
    async def get_assessment_analytics(
        self,
        assessment_id: str,
        instructor_id: str
    ) -> Dict[str, Any]:
        """Get detailed analytics for an assessment."""
        try:
            assessment = await self.assessments.find_one({
                "_id": ObjectId(assessment_id),
                "instructor_id": instructor_id
            })
            
            if not assessment:
                return None
            
            submissions = await self.submissions.find({
                "assessment_id": assessment_id,
                "status": "graded"
            }).to_list(length=10000)
            
            if not submissions:
                return {
                    "assessment_id": assessment_id,
                    "title": assessment["title"],
                    "total_submissions": 0,
                    "average_score": 0,
                    "question_stats": []
                }
            
            scores = [s.get("percentage", 0) for s in submissions]
            
            questions = assessment.get("questions", [])
            question_stats = []
            
            for question in questions:
                q_id = question.get("id")
                correct_count = 0
                total_answered = 0
                
                for sub in submissions:
                    for ans in sub.get("answers", []):
                        if ans.get("question_id") == q_id:
                            total_answered += 1
                            break
                
                question_stats.append({
                    "question_id": q_id,
                    "question_text": question.get("question_text", "")[:100],
                    "type": question.get("type"),
                    "points": question.get("points", 0),
                    "times_answered": total_answered
                })
            
            return {
                "assessment_id": assessment_id,
                "title": assessment["title"],
                "total_submissions": len(submissions),
                "average_score": round(sum(scores) / len(scores), 2),
                "highest_score": max(scores),
                "lowest_score": min(scores),
                "pass_rate": round(
                    sum(1 for s in submissions if s.get("passed", False)) / len(submissions) * 100,
                    2
                ),
                "question_stats": question_stats
            }
            
        except Exception as e:
            logger.error(f"Get assessment analytics error: {e}")
            return None
    
    async def get_class_gradebook(
        self,
        course_id: str,
        instructor_id: str
    ) -> Dict[str, Any]:
        """Get gradebook for all students in a course."""
        try:
            course = await self.courses.find_one({
                "_id": ObjectId(course_id),
                "instructor_id": instructor_id
            })
            
            if not course:
                return None
            
            enrolled_ids = course.get("enrolled_students", [])
            
            assessments = await self.assessments.find({
                "course_id": course_id,
                "status": "published"
            }).to_list(length=100)
            
            assessment_map = {str(a["_id"]): a for a in assessments}
            
            students = []
            for student_id in enrolled_ids:
                student = await self.users.find_one({"_id": ObjectId(student_id)})
                if not student:
                    continue
                
                student_grades = {}
                total_score = 0
                total_max = 0
                
                for a_id, assessment in assessment_map.items():
                    submission = await self.submissions.find_one({
                        "assessment_id": a_id,
                        "student_id": student_id,
                        "status": "graded"
                    }, sort=[("percentage", -1)])
                    
                    if submission:
                        student_grades[a_id] = {
                            "score": submission.get("total_score", 0),
                            "max_score": submission.get("max_score", 0),
                            "percentage": submission.get("percentage", 0),
                            "passed": submission.get("passed", False)
                        }
                        total_score += submission.get("total_score", 0)
                        total_max += submission.get("max_score", 0)
                    else:
                        student_grades[a_id] = None
                
                students.append({
                    "student_id": student_id,
                    "student_name": student.get("name", "Unknown"),
                    "email": student.get("email", ""),
                    "grades": student_grades,
                    "total_score": total_score,
                    "total_max": total_max,
                    "overall_percentage": round(total_score / total_max * 100, 2) if total_max > 0 else 0
                })
            
            students.sort(key=lambda x: x["student_name"])
            
            return {
                "course_id": course_id,
                "course_title": course["title"],
                "assessments": [
                    {"id": a_id, "title": a["title"], "max_points": a.get("total_points", 0)}
                    for a_id, a in assessment_map.items()
                ],
                "students": students,
                "total_students": len(students)
            }
            
        except Exception as e:
            logger.error(f"Get class gradebook error: {e}")
            return None
    
    async def export_grades_csv(
        self,
        course_id: str,
        instructor_id: str
    ) -> Optional[str]:
        """Export gradebook as CSV string."""
        try:
            gradebook = await self.get_class_gradebook(course_id, instructor_id)
            if not gradebook:
                return None
            
            output = io.StringIO()
            writer = csv.writer(output)
            
            header = ["Student Name", "Email"]
            for assessment in gradebook["assessments"]:
                header.append(f"{assessment['title']} ({assessment['max_points']} pts)")
            header.extend(["Total Score", "Total Max", "Overall %"])
            writer.writerow(header)
            
            for student in gradebook["students"]:
                row = [student["student_name"], student["email"]]
                for assessment in gradebook["assessments"]:
                    grade = student["grades"].get(assessment["id"])
                    if grade:
                        row.append(f"{grade['score']}/{grade['max_score']}")
                    else:
                        row.append("-")
                row.extend([
                    student["total_score"],
                    student["total_max"],
                    f"{student['overall_percentage']}%"
                ])
                writer.writerow(row)
            
            return output.getvalue()
            
        except Exception as e:
            logger.error(f"Export grades error: {e}")
            return None
    
    async def get_teacher_dashboard_stats(
        self,
        instructor_id: str
    ) -> Dict[str, Any]:
        """Get quick stats for teacher dashboard."""
        try:
            course_count = await self.courses.count_documents({
                "instructor_id": instructor_id
            })
            
            courses = await self.courses.find({
                "instructor_id": instructor_id
            }).to_list(length=100)
            
            total_students = sum(
                len(c.get("enrolled_students", [])) for c in courses
            )
            
            assessment_count = await self.assessments.count_documents({
                "instructor_id": instructor_id
            })
            
            course_ids = [str(c["_id"]) for c in courses]
            assessment_list = await self.assessments.find({
                "course_id": {"$in": course_ids}
            }).to_list(length=1000)
            assessment_ids = [str(a["_id"]) for a in assessment_list]
            
            pending_count = await self.submissions.count_documents({
                "assessment_id": {"$in": assessment_ids},
                "status": "submitted"
            })
            
            return {
                "total_courses": course_count,
                "total_students": total_students,
                "total_assessments": assessment_count,
                "pending_grading": pending_count
            }
            
        except Exception as e:
            logger.error(f"Get teacher stats error: {e}")
            return {
                "total_courses": 0,
                "total_students": 0,
                "total_assessments": 0,
                "pending_grading": 0
            }
    
    async def get_student_dashboard_stats(
        self,
        student_id: str
    ) -> Dict[str, Any]:
        """Get quick stats for student dashboard."""
        try:
            enrolled_courses = await self.courses.count_documents({
                "enrolled_students": student_id
            })
            
            submissions = await self.submissions.find({
                "student_id": student_id,
                "status": {"$in": ["graded", "submitted"]}
            }).to_list(length=1000)
            
            if submissions:
                avg_score = sum(s.get("percentage", 0) for s in submissions) / len(submissions)
            else:
                avg_score = 0
            
            now = datetime.utcnow()
            upcoming = await self.assessments.count_documents({
                "status": "published",
                "due_date": {"$gt": now, "$lt": now + timedelta(days=7)}
            })
            
            return {
                "enrolled_courses": enrolled_courses,
                "completed_assessments": len(submissions),
                "average_score": round(avg_score, 1),
                "upcoming_deadlines": upcoming
            }
            
        except Exception as e:
            logger.error(f"Get student stats error: {e}")
            return {
                "enrolled_courses": 0,
                "completed_assessments": 0,
                "average_score": 0,
                "upcoming_deadlines": 0
            }

analytics_service = AnalyticsService()
