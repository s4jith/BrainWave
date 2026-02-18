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
import random
import string
from app.utils.email import send_credentials_email, send_otp_email

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
        "user_id": user_id,  # Human-readable ID (TCH...)
        "mongo_id": mongo_id,   # MongoDB _id for internal use
        "email": email,
        "role": role,
        "exp": expire,
        "iat": datetime.utcnow()
    }
    
    token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return token


# Admin token endpoint for client-side admin login
class AdminTokenRequest(BaseModel):
    email: str
    password: str

@router.post("/admin-token")
async def get_admin_token(request: AdminTokenRequest):
    """
    Generate a JWT token for the hardcoded admin account.
    This is used by the frontend when admin logs in with the client-side credentials.
    """
    # Validate against hardcoded admin credentials
    ADMIN_EMAIL = "admin1@gmail.com"
    ADMIN_PASSWORD = "admin1234"
    
    if request.email != ADMIN_EMAIL or request.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid admin credentials")
    
    # Generate token with admin role
    expire = datetime.utcnow() + timedelta(hours=settings.JWT_EXPIRATION_HOURS)
    payload = {
        "user_id": "ADMIN_ROOT",
        "email": ADMIN_EMAIL,
        "role": "admin",
        "exp": expire,
        "iat": datetime.utcnow()
    }
    token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    
    return {"access_token": token, "token_type": "bearer"}

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
        # === Hardcoded Admin Login ===
        ADMIN_EMAIL = "admin1@gmail.com"
        ADMIN_PASSWORD = "admin1234"
        ADMIN_IDS = ["admin1", ADMIN_EMAIL, "ADMIN_ROOT"]
        
        if request.user_id in ADMIN_IDS and request.password == ADMIN_PASSWORD:
            # Generate admin JWT token
            access_token = create_access_token(
                user_id="ADMIN_ROOT",
                email=ADMIN_EMAIL,
                role="admin",
                mongo_id="admin-root"
            )
            role_enum = UserRole("admin")
            permissions = [p.value for p in get_role_permissions(role_enum)]
            
            return {
                "success": True,
                "first_login": False,
                "user_id": "ADMIN_ROOT",
                "session_id": str(uuid.uuid4()),
                "access_token": access_token,
                "token_type": "bearer",
                "user": {
                    "id": "admin-root",
                    "user_id": "ADMIN_ROOT",
                    "name": "Administrator",
                    "email": ADMIN_EMAIL,
                    "role": "admin",
                    "class_level": None,
                    "subjects": [],
                    "is_onboarded": True,
                    "permissions": permissions
                }
            }
        
        # === Normal DB Login ===
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
        
        # Send credentials via email
        email_sent = send_credentials_email(request.email, teacher_id, default_password, request.name)
        
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
                "default_password": default_password,
                "email_status": "sent" if email_sent else "failed"
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
        user = db.users.find_one({"user_id": current_user.user_id})
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
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


# === Forgot Password / OTP Flow ===

class ForgotPasswordRequest(BaseModel):
    email: str

class VerifyOTPRequest(BaseModel):
    email: str
    otp: str

class ResetPasswordRequest(BaseModel):
    email: str
    reset_token: str
    new_password: str

class ChangePasswordConfirmRequest(BaseModel):
    user_id: str
    old_password: str
    new_password: str
    confirm_password: str


def generate_otp(length: int = 6) -> str:
    """Generate a numeric OTP."""
    return ''.join(random.choices(string.digits, k=length))


@router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    """
    Send OTP to user's email for password reset.
    OTP is valid for 10 minutes.
    """
    try:
        user = db.users.find_one({"email": request.email})
        if not user:
            # Don't reveal whether email exists
            return {"success": True, "message": "If an account with that email exists, an OTP has been sent."}
        
        otp = generate_otp()
        otp_hash = hash_password(otp)
        
        # Store OTP in password_resets collection (TTL: 10 min)
        db.password_resets.delete_many({"email": request.email})
        db.password_resets.insert_one({
            "email": request.email,
            "otp_hash": otp_hash,
            "created_at": datetime.utcnow(),
            "expires_at": datetime.utcnow() + timedelta(minutes=10),
            "verified": False,
            "attempts": 0
        })
        
        email_sent = send_otp_email(request.email, otp)
        if not email_sent:
            logger.warning(f"Failed to send OTP email to {request.email}")
        
        return {"success": True, "message": "If an account with that email exists, an OTP has been sent."}
        
    except Exception as e:
        logger.error(f"Forgot password error: {e}")
        return {"success": False, "error": "Something went wrong. Please try again."}


@router.post("/verify-otp")
async def verify_otp(request: VerifyOTPRequest):
    """
    Verify OTP and return a temporary reset token.
    Max 5 attempts. After that the OTP is invalidated.
    """
    try:
        record = db.password_resets.find_one({"email": request.email})
        
        if not record:
            return {"success": False, "error": "No OTP request found. Please request a new OTP."}
        
        # Check expiry
        if datetime.utcnow() > record["expires_at"]:
            db.password_resets.delete_one({"_id": record["_id"]})
            return {"success": False, "error": "OTP has expired. Please request a new one."}
        
        # Check attempts
        if record.get("attempts", 0) >= 5:
            db.password_resets.delete_one({"_id": record["_id"]})
            return {"success": False, "error": "Too many failed attempts. Please request a new OTP."}
        
        # Verify OTP
        if not verify_password(request.otp, record["otp_hash"]):
            db.password_resets.update_one(
                {"_id": record["_id"]},
                {"$inc": {"attempts": 1}}
            )
            remaining = 5 - record.get("attempts", 0) - 1
            return {"success": False, "error": f"Invalid OTP. {remaining} attempts remaining."}
        
        # OTP is valid — generate a reset token
        reset_token = str(uuid.uuid4())
        reset_token_hash = hash_password(reset_token)
        
        db.password_resets.update_one(
            {"_id": record["_id"]},
            {"$set": {
                "verified": True,
                "reset_token_hash": reset_token_hash,
                "token_expires_at": datetime.utcnow() + timedelta(minutes=15)
            }}
        )
        
        return {"success": True, "reset_token": reset_token, "message": "OTP verified. You can now reset your password."}
        
    except Exception as e:
        logger.error(f"Verify OTP error: {e}")
        return {"success": False, "error": "Verification failed. Please try again."}


@router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest):
    """
    Reset password using the reset token obtained after OTP verification.
    """
    try:
        record = db.password_resets.find_one({"email": request.email, "verified": True})
        
        if not record:
            return {"success": False, "error": "Invalid or expired reset request."}
        
        # Check token expiry
        if datetime.utcnow() > record.get("token_expires_at", datetime.utcnow()):
            db.password_resets.delete_one({"_id": record["_id"]})
            return {"success": False, "error": "Reset token has expired. Please start over."}
        
        # Verify reset token
        if not verify_password(request.reset_token, record.get("reset_token_hash", "")):
            return {"success": False, "error": "Invalid reset token."}
        
        # Validate new password
        if len(request.new_password) < 8:
            return {"success": False, "error": "Password must be at least 8 characters."}
        
        # Update password
        new_hashed = hash_password(request.new_password)
        result = db.users.update_one(
            {"email": request.email},
            {"$set": {"password": new_hashed, "password_changed_at": datetime.utcnow()}}
        )
        
        if result.modified_count == 0:
            return {"success": False, "error": "User not found."}
        
        # Clean up
        db.password_resets.delete_many({"email": request.email})
        
        return {"success": True, "message": "Password reset successfully. You can now login with your new password."}
        
    except Exception as e:
        logger.error(f"Reset password error: {e}")
        return {"success": False, "error": "Password reset failed. Please try again."}


@router.post("/change-password-secure")
async def change_password_secure(request: ChangePasswordConfirmRequest):
    """
    Change password with old password verification and confirmation.
    Used from dashboard settings pages.
    """
    try:
        # Validate confirmation
        if request.new_password != request.confirm_password:
            return {"success": False, "error": "New password and confirmation do not match."}
        
        # Validate length
        if len(request.new_password) < 8:
            return {"success": False, "error": "New password must be at least 8 characters."}
        
        # Find user
        user = db.users.find_one({"user_id": request.user_id})
        if not user:
            return {"success": False, "error": "User not found."}
        
        # Verify old password
        if not verify_password(request.old_password, user.get("password", "")):
            return {"success": False, "error": "Current password is incorrect."}
        
        # Don't allow same password
        if request.old_password == request.new_password:
            return {"success": False, "error": "New password must be different from current password."}
        
        # Update
        new_hashed = hash_password(request.new_password)
        db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"password": new_hashed, "password_changed_at": datetime.utcnow()}}
        )
        
        return {"success": True, "message": "Password changed successfully."}
        
    except Exception as e:
        logger.error(f"Change password secure error: {e}")
        return {"success": False, "error": "Failed to change password."}
