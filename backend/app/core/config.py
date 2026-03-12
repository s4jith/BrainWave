"""
Configuration module for NCERT AI Learning Backend.
Loads environment variables and application settings.
"""

from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    APP_NAME: str = "NCERT AI Learning Backend"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    
    MONGO_URI: str
    
    GEMINI_API_KEY: Optional[str] = None
    
    PINECONE_API_KEY: str
    
    PINECONE_MASTER_INDEX: str
    PINECONE_MASTER_HOST: str
    
    PINECONE_MATH_INDEX: str
    PINECONE_MATH_HOST: str
    
    PINECONE_PHYSICS_INDEX: str
    PINECONE_PHYSICS_HOST: str
    
    PINECONE_CHEMISTRY_INDEX: str
    PINECONE_CHEMISTRY_HOST: str
    
    PINECONE_BIOLOGY_INDEX: str
    PINECONE_BIOLOGY_HOST: str
    
    PINECONE_SOCIAL_INDEX: str
    PINECONE_SOCIAL_HOST: str
    
    PINECONE_ENGLISH_INDEX: str
    PINECONE_ENGLISH_HOST: str
    
    PINECONE_HINDI_INDEX: str
    PINECONE_HINDI_HOST: str
    
    PINECONE_LLM_INDEX: str = "ncert-llm"
    PINECONE_LLM_HOST: Optional[str] = None
    
    PINECONE_INDEX: str
    PINECONE_HOST: str
    
    FRONTEND_URL: str = "http://localhost:5173"
    
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    OPENAI_API_KEY: Optional[str] = None
    SECRET_KEY: Optional[str] = None
    
    JWT_SECRET_KEY: str = "ncert-super-secret-jwt-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24
    
    RESEND_API_KEY: Optional[str] = None
    RESEND_FROM_EMAIL: str = "noreply@micro-learning.app"

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"

settings = Settings()
