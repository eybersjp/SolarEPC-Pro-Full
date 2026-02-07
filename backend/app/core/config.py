"""
Application configuration using Pydantic Settings.
"""
from typing import List
from pydantic import model_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # App
    APP_NAME: str = "SolarEPC Pro"
    DEBUG: bool = False
    
    # Database
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/solarepc"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000"]
    
    # Firebase
    FIREBASE_PROJECT_ID: str = ""
    FIREBASE_CREDENTIALS_PATH: str = ""

    # NREL PVWatts
    PVWATTS_API_KEY: str = "DEMO_KEY"

    # Storage
    PROPOSAL_STORAGE_BACKEND: str = "local" # "local" or "s3"
    PROPOSAL_LOCAL_DIR: str = "generated_proposals"
    S3_BUCKET_NAME: str = ""
    S3_REGION: str = "us-east-1"
    S3_ACCESS_KEY_ID: str = ""
    S3_SECRET_ACCESS_KEY: str = ""
    S3_PRESIGNED_URL_EXPIRATION: int = 3600 # 1 hour
    
    @model_validator(mode="after")
    def validate_s3_settings(self) -> 'Settings':
        if self.PROPOSAL_STORAGE_BACKEND == "s3" and not self.S3_BUCKET_NAME:
            raise ValueError("S3_BUCKET_NAME is required when PROPOSAL_STORAGE_BACKEND is 's3'")
        return self
    
    # Security
    SECRET_KEY: str = "change-me-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
