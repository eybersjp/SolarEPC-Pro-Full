"""
Equipment Library API endpoints.
"""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_role, CurrentUser
from app.models.models import UserRole
from app.services.equipment_library import EquipmentLibraryService
from app.schemas import (
    EquipmentModuleCreate, 
    EquipmentModuleResponse,
    EquipmentInverterCreate,
    EquipmentInverterResponse
)

router = APIRouter()


def get_equipment_service(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> EquipmentLibraryService:
    """Dependency to get equipment library service."""
    return EquipmentLibraryService(
        db=db,
        tenant_id=UUID(current_user.tenant_id),
        user_id=current_user.id,
    )


# --- Module Endpoints ---

@router.get("/modules", response_model=List[EquipmentModuleResponse])
async def list_modules(
    search: Optional[str] = Query(None),
    manufacturer: Optional[str] = Query(None),
    equipment_service: EquipmentLibraryService = Depends(get_equipment_service),
):
    """
    List all accessible modules (global + tenant-specific).
    """
    return equipment_service.list_modules(search_query=search, manufacturer=manufacturer)


@router.post("/modules", response_model=EquipmentModuleResponse, status_code=status.HTTP_201_CREATED)
async def create_module(
    request: EquipmentModuleCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role(UserRole.ADMIN, UserRole.PM)),
    equipment_service: EquipmentLibraryService = Depends(get_equipment_service),
):
    """
    Create a new tenant-specific module.
    Requires: Admin or PM role.
    """
    module = equipment_service.create_module(request.model_dump())
    db.commit()
    db.refresh(module)
    return module


@router.get("/modules/{module_id}", response_model=EquipmentModuleResponse)
async def get_module(
    module_id: UUID,
    equipment_service: EquipmentLibraryService = Depends(get_equipment_service),
):
    """
    Get a single module by ID.
    """
    return equipment_service.get_module_or_404(module_id)


# --- Inverter Endpoints ---

@router.get("/inverters", response_model=List[EquipmentInverterResponse])
async def list_inverters(
    search: Optional[str] = Query(None),
    manufacturer: Optional[str] = Query(None),
    equipment_service: EquipmentLibraryService = Depends(get_equipment_service),
):
    """
    List all accessible inverters (global + tenant-specific).
    """
    return equipment_service.list_inverters(search_query=search, manufacturer=manufacturer)


@router.post("/inverters", response_model=EquipmentInverterResponse, status_code=status.HTTP_201_CREATED)
async def create_inverter(
    request: EquipmentInverterCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role(UserRole.ADMIN, UserRole.PM)),
    equipment_service: EquipmentLibraryService = Depends(get_equipment_service),
):
    """
    Create a new tenant-specific inverter.
    Requires: Admin or PM role.
    """
    inverter = equipment_service.create_inverter(request.model_dump())
    db.commit()
    db.refresh(inverter)
    return inverter


@router.get("/inverters/{inverter_id}", response_model=EquipmentInverterResponse)
async def get_inverter(
    inverter_id: UUID,
    equipment_service: EquipmentLibraryService = Depends(get_equipment_service),
):
    """
    Get a single inverter by ID.
    """
    return equipment_service.get_inverter_or_404(inverter_id)
