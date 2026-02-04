"""
PV Design API endpoints.
"""
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_current_user, require_role, CurrentUser
from app.models import UserRole
from app.services.pv_design import PVDesignService
from app.schemas import PVDesignCreate, PVDesignResponse

router = APIRouter()


class PVDesignWithValidation(PVDesignResponse):
    """PV design response with validation."""
    valid: bool
    warnings: List[str]


def get_pv_design_service(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> PVDesignService:
    """Dependency to get PV design service."""
    return PVDesignService(
        db=db,
        tenant_id=UUID(current_user.tenant_id),
        user_id=current_user.id,
    )


@router.get("/{tender_id}/pv-designs", response_model=List[PVDesignResponse])
async def list_pv_designs(
    tender_id: UUID,
    pv_service: PVDesignService = Depends(get_pv_design_service),
):
    """List all PV designs for a tender."""
    designs = pv_service.list_designs(tender_id)
    return [PVDesignResponse.model_validate(d) for d in designs]


@router.post("/{tender_id}/pv-designs", response_model=PVDesignWithValidation)
async def create_pv_design(
    tender_id: UUID,
    request: PVDesignCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role(UserRole.ADMIN, UserRole.PM, UserRole.ENGINEER)),
    pv_service: PVDesignService = Depends(get_pv_design_service),
):
    """
    Create a new PV design with automatic calculations.
    
    Calculates DC:AC ratio, total modules, and capacity.
    Requires: Admin, PM, or Engineer role.
    """
    design = pv_service.create_design(
        tender_id=tender_id,
        module_model=request.module_model,
        module_watt=request.module_watt,
        inverter_model=request.inverter_model,
        inverter_kw=request.inverter_kw,
        strings_per_inverter=request.strings_per_inverter,
        modules_per_string=request.modules_per_string,
    )
    
    db.commit()
    db.refresh(design)
    
    validation = pv_service.validate_design(design)
    
    response = PVDesignResponse.model_validate(design)
    return PVDesignWithValidation(
        **response.model_dump(),
        valid=validation["valid"],
        warnings=validation["warnings"],
    )


@router.get("/pv-designs/{design_id}", response_model=PVDesignWithValidation)
async def get_pv_design(
    design_id: UUID,
    pv_service: PVDesignService = Depends(get_pv_design_service),
):
    """Get a PV design by ID with validation info."""
    design = pv_service.get_design_or_404(design_id)
    validation = pv_service.validate_design(design)
    
    response = PVDesignResponse.model_validate(design)
    return PVDesignWithValidation(
        **response.model_dump(),
        valid=validation["valid"],
        warnings=validation["warnings"],
    )


@router.delete("/pv-designs/{design_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pv_design(
    design_id: UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role(UserRole.ADMIN, UserRole.PM)),
    pv_service: PVDesignService = Depends(get_pv_design_service),
):
    """
    Delete a PV design.
    
    Requires: Admin or PM role.
    """
    design = pv_service.get_design_or_404(design_id)
    pv_service.delete_design(design)
    db.commit()
    return None
