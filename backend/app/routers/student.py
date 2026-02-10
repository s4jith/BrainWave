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
        # Match student_id (string user_id) 
        # Groups store student_ids list
        groups = list(db.groups.find({
            "student_ids": current_user.user_id
        }))
        
        result = []
        for g in groups:
            # Get teacher details
            teacher = None
            # Handle teacher_ids (list) or legacy teacher_id (string)
            tid = None
            if g.get("teacher_ids"):
                tid = g.get("teacher_ids")[0]
            elif g.get("teacher_id"):
                tid = g.get("teacher_id")
                
            if tid:
                teacher_doc = db.users.find_one({
                    "$or": [
                        {"user_id": tid},
                        {"_id": ObjectId(tid) if ObjectId.is_valid(tid) else "invalid"}
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
