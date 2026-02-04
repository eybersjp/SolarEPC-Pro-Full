"""
Authentication endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, verify_firebase_token, CurrentUser
from app.services.auth import AuthService
from app.schemas import SignupRequest, LoginRequest, UserResponse

router = APIRouter()


@router.post("/signup", response_model=UserResponse)
async def signup(
    request: SignupRequest,
    db: Session = Depends(get_db),
):
    """
    Register a new user with a new tenant.
    
    Creates a new tenant and the user as admin.
    """
    # Verify Firebase token
    decoded = await verify_firebase_token(request.firebase_token)
    firebase_uid = decoded.get("uid")
    
    if not firebase_uid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Firebase token: missing uid",
        )
    
    auth_service = AuthService(db)
    
    # Check if user already exists
    existing = auth_service.get_user_by_firebase_uid(firebase_uid)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User already registered",
        )
    
    # Check if email already taken
    if auth_service.get_user_by_email(request.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )
    
    # Create tenant and admin user
    tenant, user = auth_service.create_tenant_with_admin(
        tenant_name=request.tenant_name,
        firebase_uid=firebase_uid,
        admin_email=request.email,
        admin_name=request.name,
    )
    
    db.commit()
    
    return UserResponse.model_validate(user)


@router.post("/login", response_model=UserResponse)
async def login(
    request: LoginRequest,
    db: Session = Depends(get_db),
):
    """
    Login existing user.
    
    Verifies Firebase token and returns user data.
    """
    # Verify Firebase token
    decoded = await verify_firebase_token(request.firebase_token)
    firebase_uid = decoded.get("uid")
    
    if not firebase_uid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Firebase token: missing uid",
        )
    
    auth_service = AuthService(db)
    
    # Look up user
    user = auth_service.get_user_by_firebase_uid(firebase_uid)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found. Please sign up first.",
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account deactivated",
        )
    
    return UserResponse.model_validate(user)


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get current authenticated user info."""
    return UserResponse.model_validate(current_user.user)
