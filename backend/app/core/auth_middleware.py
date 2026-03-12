"""
Global Authentication Middleware

Enforces JWT authentication on all /api/ routes except explicitly public ones.
This ensures no endpoint is accidentally left unprotected.
"""

import jwt
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from fastapi import Request

from app.core.config import settings

logger = logging.getLogger(__name__)

# Routes that do NOT require authentication
# Use exact paths or prefixes — checked with startswith()
PUBLIC_PATHS = [
    # Auth routes (login, signup, password reset)
    "/api/auth/login",
    "/api/auth/signup",
    "/api/auth/admin-token",
    "/api/auth/forgot-password",
    "/api/auth/verify-otp",
    "/api/auth/reset-password",

    # Health / maintenance checks
    "/api/public/maintenance",
    "/api/admin/public/maintenance",
    "/api/admin/health",

    # OpenAPI docs
    "/docs",
    "/redoc",
    "/openapi.json",

    # Root health check
    "/",
    "/health",
]


class AuthMiddleware(BaseHTTPMiddleware):
    """
    Middleware that validates JWT Bearer tokens on all /api/ routes.
    Public routes are whitelisted above.
    """

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # Allow non-API routes (docs, health, static files)
        if not path.startswith("/api"):
            return await call_next(request)

        # Allow explicitly public paths
        if self._is_public(path):
            return await call_next(request)

        # Allow CORS preflight requests
        if request.method == "OPTIONS":
            return await call_next(request)

        # Extract and validate token
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return JSONResponse(
                status_code=401,
                content={"detail": "Authentication required"},
                headers={"WWW-Authenticate": "Bearer"},
            )

        token = auth_header[7:]  # Strip "Bearer "

        try:
            payload = jwt.decode(
                token,
                settings.JWT_SECRET_KEY,
                algorithms=[settings.JWT_ALGORITHM],
            )
            # Attach user info to request state for downstream use
            request.state.user_id = payload.get("user_id")
            request.state.user_email = payload.get("email")
            request.state.user_role = payload.get("role", "student")
        except jwt.ExpiredSignatureError:
            return JSONResponse(
                status_code=401,
                content={"detail": "Token has expired"},
            )
        except jwt.InvalidTokenError:
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid token"},
            )

        return await call_next(request)

    @staticmethod
    def _is_public(path: str) -> bool:
        """Check if a path is in the public whitelist."""
        # Normalize: strip trailing slash for consistent matching
        normalized = path.rstrip("/")
        for public_path in PUBLIC_PATHS:
            pub_normalized = public_path.rstrip("/")
            if normalized == pub_normalized:
                return True
        return False
