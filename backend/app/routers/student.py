"""
Student Router
Handles student-specific operations:
- Fetching assigned groups
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any
from bson import ObjectId

from app.db.mongo import db
from app.core.permissions import get_current_user, require_role
from app.models.rbac_models import UserRole, TokenData

router = APIRouter(prefix="/api/student", tags=["student"])

@router.get("/groups")
async def get_student_groups(current_user: TokenData = Depends(require_role([UserRole.STUDENT]))):
    """Get groups the current student is assigned to."""
    try:
        # Match student_id (string user_id) or _id (ObjectId string)
        # Groups store student_ids list
        groups = list(db.groups.find({
            "student_ids": {
                "$in": [current_user.user_id, str(current_user.mongo_id)]
            }
        }))
        
        result = []
        for g in groups:
            # Get teacher details
            teacher = None
            if g.get("teacher_id"):
                teacher_doc = db.users.find_one({
                    "$or": [
                        {"user_id": g.get("teacher_id")},
                        {"_id": ObjectId(g.get("teacher_id")) if ObjectId.is_valid(g.get("teacher_id")) else "invalid"}
                    ]
                })
                if teacher_doc:
                    teacher = {
                        "name": teacher_doc.get("name"),
                        "email": teacher_doc.get("email")
                    }

            result.append({
                "id": str(g["_id"]),
                "name": g.get("name"),
                "description": g.get("description", ""),
                "teacher": teacher,
                "created_at": g.get("created_at").isoformat() if g.get("created_at") else None
            })
            
        return {"groups": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
