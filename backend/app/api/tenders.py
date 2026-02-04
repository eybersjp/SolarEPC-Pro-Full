"""
Tender management endpoints.
"""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_role, CurrentUser
from app.models import UserRole, TenderStatus
from app.services.tender import TenderService
from app.schemas import (
    TenderCreate,
    TenderUpdate,
    TenderResponse,
    TenderStatusEnum,
)

router = APIRouter()


def get_tender_service(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> TenderService:
    """Dependency to get tender service with current user context."""
    return TenderService(
        db=db,
        tenant_id=UUID(current_user.tenant_id),
        user_id=current_user.id,
    )


@router.get("/", response_model=List[TenderResponse])
async def list_tenders(
    status: Optional[TenderStatusEnum] = None,
    limit: int = 100,
    offset: int = 0,
    tender_service: TenderService = Depends(get_tender_service),
):
    """List all tenders for current tenant."""
    status_filter = TenderStatus(status.value) if status else None
    tenders = tender_service.list_tenders(
        status=status_filter,
        limit=limit,
        offset=offset,
    )
    return [TenderResponse.model_validate(t) for t in tenders]


@router.post("/", response_model=TenderResponse)
async def create_tender(
    request: TenderCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role(UserRole.ADMIN, UserRole.PM)),
    tender_service: TenderService = Depends(get_tender_service),
):
    """
    Create a new tender.
    
    Requires: Admin or PM role.
    """
    tender = tender_service.create_tender(
        name=request.name,
        client_name=request.client_name,
        latitude=request.latitude,
        longitude=request.longitude,
        target_capacity_kw=request.target_capacity_kw,
    )
    db.commit()
    db.refresh(tender)
    return TenderResponse.model_validate(tender)


@router.get("/{tender_id}", response_model=TenderResponse)
async def get_tender(
    tender_id: UUID,
    tender_service: TenderService = Depends(get_tender_service),
):
    """Get tender by ID."""
    tender = tender_service.get_tender_or_404(tender_id)
    return TenderResponse.model_validate(tender)


@router.put("/{tender_id}", response_model=TenderResponse)
async def update_tender(
    tender_id: UUID,
    request: TenderUpdate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role(UserRole.ADMIN, UserRole.PM)),
    tender_service: TenderService = Depends(get_tender_service),
):
    """
    Update tender.
    
    Requires: Admin or PM role.
    """
    tender = tender_service.get_tender_or_404(tender_id)
    
    status_value = TenderStatus(request.status.value) if request.status else None
    
    tender = tender_service.update_tender(
        tender=tender,
        name=request.name,
        client_name=request.client_name,
        latitude=request.latitude,
        longitude=request.longitude,
        target_capacity_kw=request.target_capacity_kw,
        status=status_value,
    )
    db.commit()
    db.refresh(tender)
    return TenderResponse.model_validate(tender)


@router.delete("/{tender_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tender(
    tender_id: UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role(UserRole.ADMIN)),
    tender_service: TenderService = Depends(get_tender_service),
):
    """
    Delete tender (drafts only).
    
    Requires: Admin role.
    """
    tender = tender_service.get_tender_or_404(tender_id)
    tender_service.delete_tender(tender)
    db.commit()
    return None
