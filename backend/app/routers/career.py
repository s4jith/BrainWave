"""
Career Analysis Router

Admin endpoints:
  POST   /api/career/questions          – create question
  GET    /api/career/questions          – list (paginated, filterable)
  GET    /api/career/questions/stats    – pool statistics
  GET    /api/career/questions/{id}     – single question
  PUT    /api/career/questions/{id}     – update
  DELETE /api/career/questions/{id}     – delete
  POST   /api/career/assignment         – create/activate a career test assignment
  DELETE /api/career/assignment/{id}    – deactivate an assignment
  GET    /api/career/assignments        – list all assignments

Student endpoints:
  GET    /api/career/assignment/active  – check if a test is available
  POST   /api/career/test/start        – start a 30-question test
  POST   /api/career/test/submit       – submit answers → get results
  GET    /api/career/results/me        – all my past results
  GET    /api/career/results/{id}      – single result detail

Admin read-only:
  GET    /api/career/results           – all students' results
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional
import logging

from app.core.permissions import get_current_user, require_role
from app.models.rbac_models import UserRole, TokenData
from app.models.career_models import (
    CareerQuestionCreate,
    CareerQuestionUpdate,
    CareerTestSubmit,
    CareerAssignmentCreate,
    ALL_DOMAINS,
    DOMAIN_LABELS,
)
from app.services.career_service import career_service, CAREER_VECTORS, CAREER_DESCRIPTIONS

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/career", tags=["Career Analysis"])


# ═══════════════════════════════════════════════════════════════════════════════
# Admin – Question CRUD
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/questions", status_code=201)
async def create_question(
    body: CareerQuestionCreate,
    user: TokenData = Depends(require_role([UserRole.ADMIN])),
):
    """Create a new career-analysis MCQ (admin only)."""
    try:
        question = await career_service.create_question(
            data=body.model_dump(),
            created_by=user.user_id,
        )
        return {"success": True, "question": question}
    except Exception as e:
        logger.error(f"Create career question failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/questions")
async def list_questions(
    subject: Optional[str] = Query(None),
    difficulty: Optional[int] = Query(None, ge=1, le=3),
    is_active: Optional[bool] = Query(True),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    user: TokenData = Depends(require_role([UserRole.ADMIN])),
):
    """List career questions with optional filters (admin only)."""
    skip = (page - 1) * limit
    questions, total = await career_service.list_questions(
        subject=subject, difficulty=difficulty, is_active=is_active,
        skip=skip, limit=limit,
    )
    return {
        "questions": questions,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
    }


@router.get("/questions/stats")
async def question_stats(
    user: TokenData = Depends(require_role([UserRole.ADMIN])),
):
    """Aggregate statistics for the career-question pool."""
    stats = await career_service.get_question_stats()
    return stats


@router.get("/questions/{question_id}")
async def get_question(
    question_id: str,
    user: TokenData = Depends(require_role([UserRole.ADMIN])),
):
    """Get a single question by ID (admin only)."""
    q = await career_service.get_question(question_id)
    if not q:
        raise HTTPException(404, "Question not found")
    return q


@router.put("/questions/{question_id}")
async def update_question(
    question_id: str,
    body: CareerQuestionUpdate,
    user: TokenData = Depends(require_role([UserRole.ADMIN])),
):
    """Update a career question (admin only)."""
    updated = await career_service.update_question(question_id, body.model_dump())
    if not updated:
        raise HTTPException(404, "Question not found")
    return {"success": True, "question": updated}


@router.delete("/questions/{question_id}")
async def delete_question(
    question_id: str,
    user: TokenData = Depends(require_role([UserRole.ADMIN])),
):
    """Delete a career question (admin only)."""
    deleted = await career_service.delete_question(question_id)
    if not deleted:
        raise HTTPException(404, "Question not found")
    return {"success": True, "message": "Question deleted"}


# ═══════════════════════════════════════════════════════════════════════════════
# Admin – Career Test Assignments
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/assignment", status_code=201)
async def create_assignment(
    body: CareerAssignmentCreate,
    user: TokenData = Depends(require_role([UserRole.ADMIN])),
):
    """Create/activate a career test assignment (admin only). Deactivates any existing active assignment."""
    try:
        assignment = await career_service.create_assignment(
            data=body.model_dump(),
            created_by=user.user_id,
        )
        return {"success": True, "assignment": assignment}
    except Exception as e:
        logger.error(f"Create career assignment failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/assignment/active")
async def get_active_assignment(
    user: TokenData = Depends(get_current_user),
):
    """Check whether an active career test assignment exists (student + admin)."""
    assignment = await career_service.get_active_assignment()
    if not assignment:
        return {"active": False, "assignment": None}
    return {"active": True, "assignment": assignment}


@router.get("/assignments")
async def list_assignments(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user: TokenData = Depends(require_role([UserRole.ADMIN])),
):
    """List all career test assignments (admin only)."""
    skip = (page - 1) * limit
    assignments, total = await career_service.list_assignments(skip=skip, limit=limit)
    return {
        "assignments": assignments,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
    }


@router.delete("/assignment/{assignment_id}")
async def deactivate_assignment(
    assignment_id: str,
    user: TokenData = Depends(require_role([UserRole.ADMIN])),
):
    """Deactivate a career test assignment (admin only)."""
    deactivated = await career_service.deactivate_assignment(assignment_id)
    if not deactivated:
        raise HTTPException(404, "Assignment not found or already inactive")
    return {"success": True, "message": "Assignment deactivated"}


# ═══════════════════════════════════════════════════════════════════════════════
# Student – Test lifecycle
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/test/start")
async def start_test(
    user: TokenData = Depends(get_current_user),
):
    """
    Start a 30-question career analysis test.
    If a test is already in progress, returns it instead of creating a new one.
    """
    try:
        result = await career_service.start_test(student_id=user.user_id)
        return result
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        logger.error(f"Start career test failed: {e}")
        raise HTTPException(500, f"Failed to start test: {str(e)}")


@router.post("/test/submit")
async def submit_test(
    body: CareerTestSubmit,
    user: TokenData = Depends(get_current_user),
):
    """Submit answers for a career test and receive domain scores + career recommendations."""
    try:
        result = await career_service.submit_test(
            student_id=user.user_id,
            test_id=body.test_id,
            answers=[a.model_dump() for a in body.answers],
        )
        return result
    except ValueError as e:
        raise HTTPException(400, str(e))
    except PermissionError as e:
        raise HTTPException(403, str(e))
    except Exception as e:
        logger.error(f"Submit career test failed: {e}")
        raise HTTPException(500, f"Failed to submit test: {str(e)}")


# ═══════════════════════════════════════════════════════════════════════════════
# Results
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/results/me")
async def my_results(
    user: TokenData = Depends(get_current_user),
):
    """Get all career results for the current student."""
    results = await career_service.get_student_results(user.user_id)
    return {"results": results, "total": len(results)}


@router.get("/results/{result_id}")
async def get_result(
    result_id: str,
    user: TokenData = Depends(get_current_user),
):
    """Get a single career result by ID."""
    result = await career_service.get_result(result_id)
    if not result:
        raise HTTPException(404, "Result not found")
    # Students can only see their own results; admins can see all
    if user.role != UserRole.ADMIN and result["student_id"] != user.user_id:
        raise HTTPException(403, "Access denied")
    return result


@router.get("/results")
async def all_results(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    user: TokenData = Depends(require_role([UserRole.ADMIN])),
):
    """Admin: list all career results (paginated)."""
    skip = (page - 1) * limit
    results, total = await career_service.get_all_results(skip=skip, limit=limit)
    return {
        "results": results,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# Reference data
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/domains")
async def list_domains():
    """Return the 8 cognitive domains with labels (public reference)."""
    return {
        "domains": [
            {"code": d, "label": DOMAIN_LABELS[d]}
            for d in ALL_DOMAINS
        ]
    }


@router.get("/careers")
async def list_careers():
    """Return all predefined career vectors (public reference)."""
    return {
        "careers": [
            {
                "name": name,
                "description": CAREER_DESCRIPTIONS.get(name, ""),
                "vector": vec,
            }
            for name, vec in CAREER_VECTORS.items()
        ]
    }
