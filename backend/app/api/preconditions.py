"""
Preconditions API endpoints.
"""
from uuid import UUID
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_current_user, require_role, CurrentUser
from app.models import UserRole
from app.services.precondition import PreconditionService
from app.schemas import PreconditionUpdate, PreconditionResponse

router = APIRouter()


class PreconditionWithBlockers(PreconditionResponse):
    """Precondition response with blocker list."""
    blockers: List[str]


def get_precondition_service(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> PreconditionService:
    """Dependency to get precondition service."""
    return PreconditionService(
        db=db,
        tenant_id=UUID(current_user.tenant_id),
        user_id=current_user.id,
    )


@router.get("/{tender_id}/preconditions", response_model=PreconditionWithBlockers)
async def get_preconditions(
    tender_id: UUID,
    precondition_service: PreconditionService = Depends(get_precondition_service),
):
    """Get tender preconditions with blocker list."""
    precondition = precondition_service.get_precondition_or_404(tender_id)
    blockers = precondition_service.get_blockers(precondition)
    
    response = PreconditionResponse.model_validate(precondition)
    return PreconditionWithBlockers(
        **response.model_dump(),
        blockers=blockers,
    )


@router.put("/{tender_id}/preconditions", response_model=PreconditionWithBlockers)
async def update_preconditions(
    tender_id: UUID,
    request: PreconditionUpdate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role(UserRole.ADMIN, UserRole.PM)),
    precondition_service: PreconditionService = Depends(get_precondition_service),
):
    """
    Update tender preconditions.
    
    Go/no-go decision is automatically recomputed.
    Requires: Admin or PM role.
    """
    precondition = precondition_service.get_precondition_or_404(tender_id)
    
    precondition = precondition_service.update_precondition(
        precondition=precondition,
        grid_connection=request.grid_connection,
        land_access=request.land_access,
        permits_cleared=request.permits_cleared,
        financing_confirmed=request.financing_confirmed,
        go_decision=request.go_decision,
        notes=request.notes,
    )
    
    db.commit()
    db.refresh(precondition)
    
    blockers = precondition_service.get_blockers(precondition)
    response = PreconditionResponse.model_validate(precondition)
    
    return PreconditionWithBlockers(
        **response.model_dump(),
        blockers=blockers,
    )
