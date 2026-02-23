"""
Role-Based Access Control (RBAC) Models and Permissions

Defines user roles (Admin, Teacher, Student) and their permissions.
"""

from enum import Enum
from typing import List, Set
from pydantic import BaseModel, Field
from datetime import datetime

class UserRole(str, Enum):
    """User role enumeration."""
    ADMIN = "admin"
    TEACHER = "teacher"
    STUDENT = "student"

class Permission(str, Enum):
    """System permissions."""
    CREATE_USER = "create_user"
    UPDATE_USER = "update_user"
    DELETE_USER = "delete_user"
    VIEW_ALL_USERS = "view_all_users"
    DEACTIVATE_USER = "deactivate_user"
    
    CREATE_COURSE = "create_course"
    UPDATE_COURSE = "update_course"
    DELETE_COURSE = "delete_course"
    PUBLISH_COURSE = "publish_course"
    VIEW_ALL_COURSES = "view_all_courses"
    ENROLL_COURSE = "enroll_course"
    
    CREATE_MODULE = "create_module"
    UPDATE_MODULE = "update_module"
    DELETE_MODULE = "delete_module"
    UPLOAD_CONTENT = "upload_content"
    
    CREATE_ASSESSMENT = "create_assessment"
    UPDATE_ASSESSMENT = "update_assessment"
    DELETE_ASSESSMENT = "delete_assessment"
    GRADE_SUBMISSION = "grade_submission"
    VIEW_QUESTION_BANK = "view_question_bank"
    MANAGE_QUESTION_BANK = "manage_question_bank"
    
    TAKE_ASSESSMENT = "take_assessment"
    SUBMIT_ASSIGNMENT = "submit_assignment"
    VIEW_OWN_GRADES = "view_own_grades"
    VIEW_OWN_PROGRESS = "view_own_progress"
    
    VIEW_PLATFORM_ANALYTICS = "view_platform_analytics"
    VIEW_CLASS_ANALYTICS = "view_class_analytics"
    VIEW_STUDENT_ANALYTICS = "view_student_analytics"
    EXPORT_DATA = "export_data"
    
    VIEW_SYSTEM_HEALTH = "view_system_health"
    MANAGE_SETTINGS = "manage_settings"
    MODERATE_CONTENT = "moderate_content"

ROLE_PERMISSIONS: dict[UserRole, Set[Permission]] = {
    UserRole.ADMIN: {
        Permission.CREATE_USER,
        Permission.UPDATE_USER,
        Permission.DELETE_USER,
        Permission.VIEW_ALL_USERS,
        Permission.DEACTIVATE_USER,
        Permission.CREATE_COURSE,
        Permission.UPDATE_COURSE,
        Permission.DELETE_COURSE,
        Permission.PUBLISH_COURSE,
        Permission.VIEW_ALL_COURSES,
        Permission.CREATE_MODULE,
        Permission.UPDATE_MODULE,
        Permission.DELETE_MODULE,
        Permission.UPLOAD_CONTENT,
        Permission.CREATE_ASSESSMENT,
        Permission.UPDATE_ASSESSMENT,
        Permission.DELETE_ASSESSMENT,
        Permission.GRADE_SUBMISSION,
        Permission.VIEW_QUESTION_BANK,
        Permission.MANAGE_QUESTION_BANK,
        Permission.VIEW_PLATFORM_ANALYTICS,
        Permission.VIEW_CLASS_ANALYTICS,
        Permission.VIEW_STUDENT_ANALYTICS,
        Permission.EXPORT_DATA,
        Permission.VIEW_SYSTEM_HEALTH,
        Permission.MANAGE_SETTINGS,
        Permission.MODERATE_CONTENT,
    },
    
    UserRole.TEACHER: {
        Permission.CREATE_COURSE,
        Permission.UPDATE_COURSE,
        Permission.DELETE_COURSE,
        Permission.PUBLISH_COURSE,
        Permission.VIEW_ALL_COURSES,
        Permission.CREATE_MODULE,
        Permission.UPDATE_MODULE,
        Permission.DELETE_MODULE,
        Permission.UPLOAD_CONTENT,
        Permission.CREATE_ASSESSMENT,
        Permission.UPDATE_ASSESSMENT,
        Permission.DELETE_ASSESSMENT,
        Permission.GRADE_SUBMISSION,
        Permission.VIEW_QUESTION_BANK,
        Permission.MANAGE_QUESTION_BANK,
        Permission.VIEW_CLASS_ANALYTICS,
        Permission.VIEW_STUDENT_ANALYTICS,
        Permission.EXPORT_DATA,
    },
    
    UserRole.STUDENT: {
        Permission.ENROLL_COURSE,
        Permission.TAKE_ASSESSMENT,
        Permission.SUBMIT_ASSIGNMENT,
        Permission.VIEW_OWN_GRADES,
        Permission.VIEW_OWN_PROGRESS,
    },
}

def get_role_permissions(role: UserRole) -> Set[Permission]:
    """Get all permissions for a role."""
    return ROLE_PERMISSIONS.get(role, set())

def has_permission(role: UserRole, permission: Permission) -> bool:
    """Check if a role has a specific permission."""
    return permission in get_role_permissions(role)

def has_any_permission(role: UserRole, permissions: List[Permission]) -> bool:
    """Check if a role has any of the specified permissions."""
    role_perms = get_role_permissions(role)
    return any(p in role_perms for p in permissions)

def has_all_permissions(role: UserRole, permissions: List[Permission]) -> bool:
    """Check if a role has all of the specified permissions."""
    role_perms = get_role_permissions(role)
    return all(p in role_perms for p in permissions)

class UserBase(BaseModel):
    """Base user model."""
    email: str = Field(..., description="User email address")
    name: str = Field(..., description="Full name")
    role: UserRole = Field(default=UserRole.STUDENT, description="User role")

class UserCreate(UserBase):
    """Model for creating a new user."""
    password: str = Field(..., min_length=6, description="Password (min 6 chars)")
    class_level: int | None = Field(None, ge=1, le=12, description="Class level (students)")
    subjects: List[str] | None = Field(None, description="Subjects taught (teachers)")

class UserUpdate(BaseModel):
    """Model for updating a user."""
    name: str | None = None
    email: str | None = None
    role: UserRole | None = None
    class_level: int | None = None
    subjects: List[str] | None = None
    is_active: bool | None = None

class UserInDB(UserBase):
    """User model as stored in database."""
    id: str = Field(..., description="User ID")
    class_level: int | None = Field(None, description="Class level (students)")
    subjects: List[str] | None = Field(None, description="Subjects taught (teachers)")
    is_active: bool = Field(default=True, description="Account status")
    created_at: datetime = Field(..., description="Account creation time")
    last_login: datetime | None = Field(None, description="Last login time")
    
    class Config:
        from_attributes = True

class UserResponse(BaseModel):
    """API response model for user data."""
    id: str
    email: str
    name: str
    role: UserRole
    class_level: int | None = None
    subjects: List[str] | None = None
    is_active: bool = True
    permissions: List[str] = Field(default_factory=list, description="User permissions")
    
    @classmethod
    def from_db(cls, user: UserInDB) -> "UserResponse":
        """Create response from database model."""
        perms = [p.value for p in get_role_permissions(user.role)]
        return cls(
            id=user.id,
            email=user.email,
            name=user.name,
            role=user.role,
            class_level=user.class_level,
            subjects=user.subjects,
            is_active=user.is_active,
            permissions=perms
        )

class TokenData(BaseModel):
    """JWT token payload data."""
    user_id: str
    email: str
    role: UserRole
    exp: datetime | None = None
