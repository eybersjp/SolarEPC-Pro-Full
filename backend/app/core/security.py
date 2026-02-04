"""
Security utilities: Firebase auth verification, RBAC dependencies.
"""
from typing import Optional
from functools import wraps

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models import User, UserRole

# Firebase Admin SDK (lazy init)
_firebase_app = None

def get_firebase_app():
    """Lazy initialize Firebase Admin SDK."""
    global _firebase_app
    if _firebase_app is None:
        import firebase_admin
        from firebase_admin import credentials
        
        if settings.FIREBASE_CREDENTIALS_PATH:
            cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)
            _firebase_app = firebase_admin.initialize_app(cred)
        else:
            # Use default credentials (for local dev without Firebase)
            _firebase_app = firebase_admin.initialize_app()
    return _firebase_app


security = HTTPBearer(auto_error=False)


class CurrentUser:
    """Container for current authenticated user context."""
    def __init__(self, user: User, tenant_id: str):
        self.user = user
        self.id = user.id
        self.email = user.email
        self.role = user.role
        self.tenant_id = tenant_id


async def verify_firebase_token(token: str) -> dict:
    """
    Verify Firebase ID token and return decoded claims.
    
    Returns:
        dict with 'uid', 'email', etc.
    
    Raises:
        HTTPException if token is invalid.
    """
    try:
        from firebase_admin import auth
        get_firebase_app()
        decoded = auth.verify_id_token(token)
        return decoded
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> CurrentUser:
    """
    FastAPI dependency to get the current authenticated user.
    
    Verifies Firebase token and loads user from database.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Verify token
    decoded = await verify_firebase_token(credentials.credentials)
    firebase_uid = decoded.get("uid")
    
    if not firebase_uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token: missing uid",
        )
    
    # Load user from database
    user = db.query(User).filter(User.firebase_uid == firebase_uid).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found. Please complete registration.",
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated",
        )
    
    return CurrentUser(user=user, tenant_id=str(user.tenant_id))


def require_role(*allowed_roles: UserRole):
    """
    Dependency factory to require specific roles.
    
    Usage:
        @router.post("/", dependencies=[Depends(require_role(UserRole.ADMIN, UserRole.PM))])
    """
    async def role_checker(current_user: CurrentUser = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{current_user.role}' not permitted for this action",
            )
        return current_user
    return role_checker


# Convenience dependencies for common role checks
require_admin = require_role(UserRole.ADMIN)
require_pm_or_above = require_role(UserRole.ADMIN, UserRole.PM)
require_engineer_or_above = require_role(UserRole.ADMIN, UserRole.PM, UserRole.ENGINEER)
