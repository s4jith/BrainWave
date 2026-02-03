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
        if self._courses is None and mongodb.db:
            self._courses = mongodb.get_collection("courses")
        return self._courses
    
    @property
    def assessments(self):
        if self._assessments is None and mongodb.db:
            self._assessments = mongodb.get_collection("assessments")
        return self._assessments
    
    @property
    def submissions(self):
        if self._submissions is None and mongodb.db:
            self._submissions = mongodb.get_collection("submissions")
        return self._submissions
    
    @property
    def users(self):
        if self._users is None and mongodb.db:
            self._users = mongodb.get_collection("users")
        return self._users
    
    # === Student Gradebook ===
    
    async def get_student_grades(
        self,
        student_id: str,
        course_id: str = None
    ) -> Dict[str, Any]:
        """Get all grades for a student."""
        try:
            query = {"student_id": student_id, "status": "graded"}
            if course_id:
                # Get assessments for this course first
                course_assessments = await self.assessments.find(
                    {"course_id": course_id}
                ).to_list(length=1000)
                assessment_ids = [str(a["_id"]) for a in course_assessments]
                query["assessment_id"] = {"$in": assessment_ids}
            
            submissions = await self.submissions.find(query).to_list(length=1000)
            
            grades = []
            total_score = 0
            total_max = 0
            
            for sub in submissions:
                # Get assessment details
                assessment = await self.assessments.find_one(
                    {"_id": ObjectId(sub["assessment_id"])}
                )
                
                grades.append({
                    "submission_id": str(sub["_id"]),
                    "assessment_id": sub["assessment_id"],
                    "assessment_title": assessment["title"] if assessment else "Unknown",
                    "assessment_type": assessment.get("type") if assessment else None,
                    "score": sub.get("total_score", 0),
                    "max_score": sub.get("max_score", 0),
                    "percentage": sub.get("percentage", 0),
                    "passed": sub.get("passed", False),
                    "submitted_at": sub.get("submitted_at"),
                    "graded_at": sub.get("graded_at")
                })
                
                total_score += sub.get("total_score", 0)
                total_max += sub.get("max_score", 0)
            
            overall_percentage = (total_score / total_max * 100) if total_max > 0 else 0
            
            return {
                "student_id": student_id,
                "course_id": course_id,
                "grades": grades,
                "total_score": total_score,
                "total_max_score": total_max,
                "overall_percentage": round(overall_percentage, 2),
                "grade_count": len(grades)
            }
            
        except Exception as e:
            logger.error(f"Get student grades error: {e}")
            return {
                "student_id": student_id,
                "grades": [],
                "total_score": 0,
                "total_max_score": 0,
                "overall_percentage": 0,
                "grade_count": 0
            }
    
    # === Course Analytics ===
    
    async def get_course_analytics(
        self,
        course_id: str,
        instructor_id: str
    ) -> Dict[str, Any]:
        """Get analytics for a course."""
        try:
            # Verify course ownership
            course = await self.courses.find_one({
                "_id": ObjectId(course_id),
                "instructor_id": instructor_id
            })
            
            if not course:
                return None
            
            # Get assessments
            assessments = await self.assessments.find(
                {"course_id": course_id}
            ).to_list(length=100)
            
            assessment_ids = [str(a["_id"]) for a in assessments]
            
            # Get all submissions
            all_submissions = await self.submissions.find({
                "assessment_id": {"$in": assessment_ids},
                "status": "graded"
            }).to_list(length=10000)
            
            # Calculate statistics
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
            
            # Score distribution
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
            
            # Per-assessment stats
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
    
    # === Assessment Analytics ===
    
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
            
            # Question-by-question analysis
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
                            # Check if answer was correct (simplified)
                            # In reality, we'd compare against correct answers
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
    
    # === Class Gradebook ===
    
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
            
            # Get assessments
            assessments = await self.assessments.find({
                "course_id": course_id,
                "status": "published"
            }).to_list(length=100)
            
            assessment_map = {str(a["_id"]): a for a in assessments}
            
            # Build gradebook
            students = []
            for student_id in enrolled_ids:
                student = await self.users.find_one({"_id": ObjectId(student_id)})
                if not student:
                    continue
                
                student_grades = {}
                total_score = 0
                total_max = 0
                
                for a_id, assessment in assessment_map.items():
                    # Get best submission
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
            
            # Sort by name
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
    
    # === Export ===
    
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
            
            # Header
            header = ["Student Name", "Email"]
            for assessment in gradebook["assessments"]:
                header.append(f"{assessment['title']} ({assessment['max_points']} pts)")
            header.extend(["Total Score", "Total Max", "Overall %"])
            writer.writerow(header)
            
            # Data rows
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
    
    # === Dashboard Stats ===
    
    async def get_teacher_dashboard_stats(
        self,
        instructor_id: str
    ) -> Dict[str, Any]:
        """Get quick stats for teacher dashboard."""
        try:
            # Count courses
            course_count = await self.courses.count_documents({
                "instructor_id": instructor_id
            })
            
            # Get all courses
            courses = await self.courses.find({
                "instructor_id": instructor_id
            }).to_list(length=100)
            
            total_students = sum(
                len(c.get("enrolled_students", [])) for c in courses
            )
            
            # Count assessments
            assessment_count = await self.assessments.count_documents({
                "instructor_id": instructor_id
            })
            
            # Pending submissions (submitted but not graded)
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
            # Count enrollments
            enrolled_courses = await self.courses.count_documents({
                "enrolled_students": student_id
            })
            
            # Get submissions
            submissions = await self.submissions.find({
                "student_id": student_id,
                "status": "graded"
            }).to_list(length=1000)
            
            if submissions:
                avg_score = sum(s.get("percentage", 0) for s in submissions) / len(submissions)
            else:
                avg_score = 0
            
            # Upcoming deadlines
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


# Global instance
analytics_service = AnalyticsService()
