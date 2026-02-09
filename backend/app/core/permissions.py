"""
Permission Decorators and Dependencies for FastAPI

Provides route protection based on user roles and permissions.
"""

from functools import wraps
from typing import List, Optional, Callable
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
import logging

from app.core.config import settings
from app.models.rbac_models import UserRole, Permission, has_permission, has_any_permission, TokenData

logger = logging.getLogger(__name__)

# Security scheme for JWT Bearer tokens
security = HTTPBearer(auto_error=False)


def decode_token(token: str) -> TokenData:
    """
    Decode and validate JWT token.
    
    Args:
        token: JWT token string
        
    Returns:
        TokenData with user information
        
    Raises:
        HTTPException: If token is invalid or expired
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        
        return TokenData(
            user_id=payload.get("user_id"),
            email=payload.get("email"),
            role=UserRole(payload.get("role", "student"))
        )
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}"
        )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> TokenData:
    """
    Dependency to get current authenticated user from JWT token.
    
    Usage:
        @router.get("/protected")
        async def protected_route(user: TokenData = Depends(get_current_user)):
            return {"user": user.email}
    """
    if not credentials:
        logger.warning("No credentials provided in request - Authorization header missing or empty")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    logger.info(f"Token received, attempting decode...")
    return decode_token(credentials.credentials)


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Optional[TokenData]:
    """
    Dependency to get current user if authenticated, None otherwise.
    Useful for routes that work differently for authenticated users.
    """
    if not credentials:
        return None
    
    try:
        return decode_token(credentials.credentials)
    except HTTPException:
        return None


def require_role(allowed_roles: List[UserRole]):
    """
    Dependency factory to require specific roles.
    
    Usage:
        @router.get("/admin-only")
        async def admin_route(user: TokenData = Depends(require_role([UserRole.ADMIN]))):
            return {"message": "Admin access granted"}
    """
    async def role_checker(
        user: TokenData = Depends(get_current_user)
    ) -> TokenData:
        if user.role not in allowed_roles:
            logger.warning(f"Access denied for {user.email} (role: {user.role})")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {[r.value for r in allowed_roles]}"
            )
        return user
    
    return role_checker


def require_permission(permission: Permission):
    """
    Dependency factory to require a specific permission.
    
    Usage:
        @router.post("/users")
        async def create_user(user: TokenData = Depends(require_permission(Permission.CREATE_USER))):
            return {"message": "User created"}
    """
    async def permission_checker(
        user: TokenData = Depends(get_current_user)
    ) -> TokenData:
        if not has_permission(user.role, permission):
            logger.warning(f"Permission denied: {user.email} lacks {permission.value}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: {permission.value} required"
            )
        return user
    
    return permission_checker


def require_any_permission(permissions: List[Permission]):
    """
    Dependency factory to require any of the specified permissions.
    
    Usage:
        @router.get("/analytics")
        async def get_analytics(
            user: TokenData = Depends(require_any_permission([
                Permission.VIEW_PLATFORM_ANALYTICS,
                Permission.VIEW_CLASS_ANALYTICS
            ]))
        ):
            return {"data": "analytics"}
    """
    async def permission_checker(
        user: TokenData = Depends(get_current_user)
    ) -> TokenData:
        if not has_any_permission(user.role, permissions):
            logger.warning(f"Permission denied: {user.email} lacks any of {[p.value for p in permissions]}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: One of {[p.value for p in permissions]} required"
            )
        return user
    
    return permission_checker


# Convenience dependencies for common role checks
require_admin = require_role([UserRole.ADMIN])
require_teacher = require_role([UserRole.TEACHER, UserRole.ADMIN])
require_student = require_role([UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN])


# Helper function to check resource ownership (for teachers managing their own courses)
def check_resource_ownership(
    user: TokenData,
    resource_owner_id: str,
    allow_admin: bool = True
) -> bool:
    """
    Check if user owns a resource or is admin.
    
    Args:
        user: Current user token data
        resource_owner_id: ID of the resource owner
        allow_admin: If True, admins can access any resource
        
    Returns:
        True if access allowed, False otherwise
    """
    if allow_admin and user.role == UserRole.ADMIN:
        return True
    return user.user_id == resource_owner_id


def ensure_ownership(resource_owner_id: str, user: TokenData, resource_name: str = "resource"):
    """
    Raise 403 if user doesn't own the resource.
    
    Args:
        resource_owner_id: ID of the resource owner
        user: Current authenticated user
        resource_name: Name of resource for error message
    
    Raises:
        HTTPException: If user doesn't own the resource
    """
    if not check_resource_ownership(user, resource_owner_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You don't have permission to modify this {resource_name}"
        )
