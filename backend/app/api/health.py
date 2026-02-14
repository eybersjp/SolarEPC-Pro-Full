from fastapi import APIRouter
from sqlalchemy import text
from app.core.database import SessionLocal
from app.core.celery_app import celery_app
from redis import Redis
import os

router = APIRouter()

@router.get("/health")
async def health_check():
    """
    Enhanced health check endpoint.
    Verifies connectivity to:
    - Database (PostgreSQL)
    - Redis (Broker/Backend)
    """
    health_status = {
        "status": "healthy",
        "version": "0.2.0",
        "dependencies": {
            "database": "unknown",
            "redis": "unknown"
        }
    }
    
    # Check Database
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        health_status["dependencies"]["database"] = "healthy"
    except Exception as e:
        health_status["dependencies"]["database"] = f"unhealthy: {str(e)}"
        health_status["status"] = "degraded"

    # Check Redis
    try:
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        r = Redis.from_url(redis_url)
        r.ping()
        health_status["dependencies"]["redis"] = "healthy"
    except Exception as e:
        health_status["dependencies"]["redis"] = f"unhealthy: {str(e)}"
        health_status["status"] = "degraded"

    return health_status
