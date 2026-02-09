"""
Authentication Router
- Login with user_id and password (JWT-based)
- Password change for first-time login
- Session management
- Admin endpoints for user creation
"""

from fastapi import APIRouter, HTTPException, Body, Depends
from pydantic import BaseModel, Field
from datetime import datetime, timedelta
from typing import Optional, List
from app.db.mongo import db
from app.core.config import settings
from app.models.rbac_models import UserRole, UserCreate, UserResponse, get_role_permissions
from app.core.permissions import get_current_user, require_role, require_permission
from app.models.rbac_models import Permission, TokenData
import hashlib
import uuid
import jwt
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["authentication"])


# === Pydantic Models ===

class LoginRequest(BaseModel):
    user_id: str
    password: str
    role: Optional[str] = None


class LoginResponse(BaseModel):
    success: bool
    first_login: bool = False
    user_id: str = None
    session_id: str = None
    access_token: str = None
    token_type: str = "bearer"
    user: dict = None
    error: str = None


class PasswordChangeRequest(BaseModel):
    user_id: str
    old_password: str
    new_password: str


class CreateTeacherRequest(BaseModel):
    """Request to create a teacher account (admin only)."""
    name: str = Field(..., min_length=2, description="Teacher's full name")
    email: str = Field(..., description="Teacher's email")
    subjects: List[str] = Field(..., description="Subjects the teacher will teach")
    user_id: str = Field(None, description="Custom user ID (optional, auto-generated if not provided)")


# === Helper Functions ===

def hash_password(password: str) -> str:
    """Hash password using SHA-256"""
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash"""
    return hash_password(plain_password) == hashed_password


def create_access_token(user_id: str, email: str, role: str, mongo_id: str) -> str:
    """
    Create JWT access token with user information.
    
    Args:
        user_id: The user's login ID (e.g., NCERT2025001)
        email: User's email
        role: User's role (admin, teacher, student)
        mongo_id: MongoDB document _id as string
        
    Returns:
        JWT token string
    """
    expire = datetime.utcnow() + timedelta(hours=settings.JWT_EXPIRATION_HOURS)
    
    payload = {
        "user_id": mongo_id,  # MongoDB _id for internal use
        "login_id": user_id,   # Human-readable ID
        "email": email,
        "role": role,
        "exp": expire,
        "iat": datetime.utcnow()
    }
    
    token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return token


def generate_teacher_id() -> str:
    """Generate unique teacher ID like TCH2026001"""
    year = datetime.now().year
    prefix = f"TCH{year}"
    
    # Get counter for teachers
    counter = db.student_counters.find_one_and_update(
        {"_id": "teacher_counter"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True
    )
    
    seq = counter.get("seq", 1)
    return f"{prefix}{seq:03d}"


# === Authentication Endpoints ===

@router.post("/login")
async def login(request: LoginRequest):
    """
    Login with user_id and password.
    Returns user data, session token, and JWT access token.
    """
    try:
        # Pydantic validation handles missing fields for us if they were required
        # Since role is optional, we build query dynamically
        query = {"user_id": request.user_id}
        if request.role:
            query["role"] = request.role
            
        user = db.users.find_one(query)
        
        if not user:
            role_msg = f"No {request.role}" if request.role else "No user"
            return {
                "success": False,
                "error": f"{role_msg} found with this user ID"
            }
        
        # Verify password
        if not verify_password(request.password, user.get("password", "")):
            return {
                "success": False,
                "error": "Invalid password"
            }
        
        # Check if account is active
        if not user.get("is_active", True):
            return {
                "success": False,
                "error": "Account is deactivated. Please contact admin."
            }
        
        # Check if this is first login (password is default pattern)
        is_first_login = False
        try:
            if user["role"] == "teacher":
                clean_name = user.get("name", "").lower().replace(" ", "").replace(".", "")
                default_password = f"{clean_name}@123"
                is_first_login = request.password == default_password
            elif user["role"] == "student":
                clean_name = user.get("name", "").lower().replace(" ", "").replace(".", "")
                age = user.get("age", "")
                default_password = f"{clean_name}{age}"
                is_first_login = request.password == default_password
            else:
                default_password = f"{request.user_id}@123"
                is_first_login = request.password == default_password
        except Exception as e:
            logger.warning(f"Error checking first login: {e}")
            is_first_login = False
        
        # Update last login time
        db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"last_login": datetime.utcnow()}}
        )
        
        # Generate session ID and JWT
        session_id = str(uuid.uuid4())
        access_token = create_access_token(
            user_id=user["user_id"],
            email=user.get("email", ""),
            role=user["role"],
            mongo_id=str(user["_id"])
        )
        
        # Get user permissions
        role_enum = UserRole(user["role"])
        permissions = [p.value for p in get_role_permissions(role_enum)]
        
        # Return user data
        return {
            "success": True,
            "first_login": is_first_login,
            "user_id": user["user_id"],
            "session_id": session_id,
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": str(user["_id"]),
                "user_id": user["user_id"],
                "name": user.get("name", "User"),
                "email": user.get("email", ""),
                "role": user["role"],
                "class_level": user.get("class_level"),
                "subjects": user.get("subjects", []),
                "is_onboarded": user.get("isOnboarded", False),
                "permissions": permissions
            }
        }
    
    except Exception as e:
        logger.error(f"Login error: {e}")
        return {
            "success": False,
            "error": "Login failed. Please try again."
        }


@router.post("/change-password")
async def change_password(request: PasswordChangeRequest):
    """
    Change user password (for first-time login or password reset)
    """
    try:
        # Find user
        user = db.users.find_one({"user_id": request.user_id})
        
        if not user:
            return {
                "success": False,
                "error": "User not found"
            }
        
        # Verify old password
        if not verify_password(request.old_password, user.get("password", "")):
            return {
                "success": False,
                "error": "Current password is incorrect"
            }
        
        # Validate new password
        if len(request.new_password) < 8:
            return {
                "success": False,
                "error": "New password must be at least 8 characters"
            }
        
        # Hash and update password
        new_hashed = hash_password(request.new_password)
        
        db.users.update_one(
            {"_id": user["_id"]},
            {
                "$set": {
                    "password": new_hashed,
                    "password_changed_at": datetime.utcnow()
                }
            }
        )
        
        return {
            "success": True,
            "message": "Password changed successfully"
        }
    
    except Exception as e:
        logger.error(f"Password change error: {e}")
        return {
            "success": False,
            "error": "Failed to change password"
        }


@router.post("/complete-onboarding")
async def complete_onboarding(data: dict = Body(...)):
    """
    Complete student onboarding and save profile data to MongoDB
    This marks the student as onboarded so they go directly to dashboard on next login
    """
    try:
        user_id = data.get("user_id")
        
        if not user_id:
            return {
                "success": False,
                "error": "User ID is required"
            }
        
        # Find user
        user = db.users.find_one({"user_id": user_id})
        
        if not user:
            return {
                "success": False,
                "error": "User not found"
            }
        
        # Prepare update data
        update_data = {
            "isOnboarded": True,
            "onboarded_at": datetime.utcnow()
        }
        
        # Save optional onboarding data if provided
        if data.get("profile"):
            profile = data["profile"]
            if profile.get("name"):
                update_data["name"] = profile["name"]
            if profile.get("classLevel"):
                update_data["class_level"] = profile["classLevel"]
        
        if data.get("avatar"):
            avatar = data["avatar"]
            if avatar.get("seed"):
                update_data["avatar_seed"] = avatar["seed"]
            if avatar.get("style"):
                update_data["avatar_style"] = avatar["style"]
            if avatar.get("username"):
                update_data["display_username"] = avatar["username"]
        
        if data.get("academics"):
            update_data["previous_academics"] = data["academics"]
        
        if data.get("calendar"):
            update_data["exam_calendar"] = data["calendar"]
        
        # Update user in database
        result = db.users.update_one(
            {"_id": user["_id"]},
            {"$set": update_data}
        )
        
        if result.modified_count > 0 or result.matched_count > 0:
            logger.info(f"Onboarding completed for user: {user_id}")
            return {
                "success": True,
                "message": "Onboarding completed successfully"
            }
        else:
            return {
                "success": False,
                "error": "Failed to update user"
            }
        
    except Exception as e:
        logger.error(f"Complete onboarding error: {e}")
        return {
            "success": False,
            "error": "Failed to complete onboarding"
        }


@router.post("/signup")
async def signup(user_data: dict = Body(...)):
    """
    Student signup - DISABLED (admin creates students only)
    This endpoint returns an error message
    """
    return {
        "success": False,
        "error": "Student registration is disabled. Please contact your admin to create an account."
    }


# === Admin Endpoints ===

@router.post("/admin/create-teacher")
async def create_teacher(
    request: CreateTeacherRequest,
    current_user: TokenData = Depends(require_permission(Permission.CREATE_USER))
):
    """
    Admin-only: Create a new teacher account.
    
    - Generates unique teacher ID (TCH2026XXX)
    - Sets default password: {teacher_id}@123
    - Teacher must change password on first login
    """
    try:
        # Check if email already exists
        existing = db.users.find_one({"email": request.email})
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
        
        # Generate or use provided teacher ID
        teacher_id = request.user_id if request.user_id else generate_teacher_id()
        
        # Check if user_id already exists
        existing_id = db.users.find_one({"user_id": teacher_id})
        if existing_id:
            raise HTTPException(status_code=400, detail="User ID already exists")
        
        # Create default password
        default_password = f"{teacher_id}@123"
        
        # Create teacher document
        teacher_doc = {
            "user_id": teacher_id,
            "name": request.name,
            "email": request.email,
            "password": hash_password(default_password),
            "role": UserRole.TEACHER.value,
            "subjects": request.subjects,
            "is_active": True,
            "created_at": datetime.utcnow(),
            "created_by": current_user.user_id
        }
        
        result = db.users.insert_one(teacher_doc)
        
        logger.info(f"Teacher created: {teacher_id} by admin {current_user.email}")
        
        return {
            "success": True,
            "message": f"Teacher account created successfully",
            "teacher": {
                "id": str(result.inserted_id),
                "user_id": teacher_id,
                "name": request.name,
                "email": request.email,
                "subjects": request.subjects,
                "default_password": default_password  # Return so admin can share with teacher
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Create teacher error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create teacher account")


@router.get("/admin/users")
async def list_users(
    role: Optional[str] = None,
    current_user: TokenData = Depends(require_permission(Permission.VIEW_ALL_USERS))
):
    """
    Admin-only: List all users with optional role filter.
    """
    try:
        query = {}
        if role:
            query["role"] = role
        
        users = list(db.users.find(query, {
            "_id": 1,
            "user_id": 1,
            "name": 1,
            "email": 1,
            "role": 1,
            "class_level": 1,
            "subjects": 1,
            "is_active": 1,
            "created_at": 1,
            "last_login": 1
        }))
        
        # Convert ObjectId to string
        for user in users:
            user["id"] = str(user.pop("_id"))
        
        return {
            "success": True,
            "count": len(users),
            "users": users
        }
        
    except Exception as e:
        logger.error(f"List users error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch users")


@router.patch("/admin/users/{user_id}/toggle-active")
async def toggle_user_active(
    user_id: str,
    current_user: TokenData = Depends(require_permission(Permission.DEACTIVATE_USER))
):
    """
    Admin-only: Activate or deactivate a user account.
    """
    try:
        user = db.users.find_one({"user_id": user_id})
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Toggle is_active
        new_status = not user.get("is_active", True)
        
        db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"is_active": new_status}}
        )
        
        status_text = "activated" if new_status else "deactivated"
        logger.info(f"User {user_id} {status_text} by {current_user.email}")
        
        return {
            "success": True,
            "message": f"User {status_text} successfully",
            "is_active": new_status
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Toggle user active error: {e}")
        raise HTTPException(status_code=500, detail="Failed to update user status")


@router.get("/me")
async def get_current_user_info(current_user: TokenData = Depends(get_current_user)):
    """
    Get current authenticated user's information.
    """
    try:
        from bson import ObjectId
        
        user = db.users.find_one({"_id": ObjectId(current_user.user_id)})
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get permissions
        role_enum = UserRole(user["role"])
        permissions = [p.value for p in get_role_permissions(role_enum)]
        
        return {
            "id": str(user["_id"]),
            "user_id": user["user_id"],
            "name": user.get("name", "User"),
            "email": user.get("email", ""),
            "role": user["role"],
            "class_level": user.get("class_level"),
            "subjects": user.get("subjects", []),
            "is_active": user.get("is_active", True),
            "permissions": permissions
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get current user error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get user info")
