"""
Tenant management endpoints.
"""
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_admin, CurrentUser, require_role
from app.models import UserRole
from app.schemas import (
    TenantCreate, 
    TenantResponse, 
    TenantUserResponse, 
    UserInvite
)
from app.services.tenant import TenantService, get_tenant_service

router = APIRouter()


@router.post("/", response_model=TenantResponse, dependencies=[Depends(require_admin)])
async def create_tenant(
    request: TenantCreate,
    current_user: CurrentUser = Depends(get_current_user),
    service: TenantService = Depends(get_tenant_service),
):
    """
    Create a new tenant/organization.
    Only system admins can do this (or maybe platform admins?).
    For now, we restrict to Admin role.
    """
    tenant = service.create_tenant(name=request.name, created_by=current_user.id)
    return tenant


@router.get("/{tenant_id}", response_model=TenantResponse)
async def get_tenant(
    tenant_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    service: TenantService = Depends(get_tenant_service),
):
    """
    Get tenant by ID.
    Enforces tenant isolation: Users can only view their own tenant.
    """
    # Tenant Isolation Check
    # Note: We compare as strings because UUID comparison can be tricky if types mismatch
    # but strictly they should be UUIDs. 
    # CurrentUser.tenant_id is a string in security.py line 120: tenant_id=str(user.tenant_id)
    if str(tenant_id) != current_user.tenant_id:
         raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this tenant",
        )

    tenant = service.get_tenant(tenant_id)
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    return tenant


@router.get("/{tenant_id}/users", response_model=List[TenantUserResponse])
async def list_tenant_users(
    tenant_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    service: TenantService = Depends(get_tenant_service),
):
    """
    List all users in a tenant.
    Enforces tenant isolation.
    """
    if str(tenant_id) != current_user.tenant_id:
         raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this tenant",
        )

    return service.list_tenant_users(tenant_id)


@router.post("/{tenant_id}/users/invite", response_model=TenantUserResponse)
async def invite_user(
    tenant_id: UUID,
    request: UserInvite,
    current_user: CurrentUser = Depends(get_current_user),
    service: TenantService = Depends(get_tenant_service),
):
    """
    Invite a user to the tenant.
    Only Admins of the tenant can invite.
    """
    if str(tenant_id) != current_user.tenant_id:
         raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this tenant",
        )
    
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can invite users",
        )

    try:
        user = service.invite_user(
            tenant_id=tenant_id,
            email=request.email,
            role=request.role,
            invited_by=current_user.id,
            name=request.name
        )
        return user # Helper to convert User to whatever response if needed, likely TenantUserResponse or just generic success
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
