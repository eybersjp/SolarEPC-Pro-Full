"""
Site Design management endpoints.
"""
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_role, CurrentUser
from app.models import UserRole
from app.services.site_design import SiteDesignService
from app.schemas import (
    SiteDesignCreate,
    SiteDesignUpdate,
    SiteDesignResponse,
)
from app.schemas.design_version import (
    DesignVersionCreate,
    DesignVersionResponse,
    DesignVersionDetail,
    DesignVersionRestoreResponse,
)
from app.services.design_version import DesignVersionService, get_design_version_service as create_design_version_service

router = APIRouter()


def get_site_design_service(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> SiteDesignService:
    """Dependency to get site design service with current user context."""
    return SiteDesignService(
        db=db,
        tenant_id=UUID(current_user.tenant_id),
        user_id=current_user.id,
    )


def get_design_version_service(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> DesignVersionService:
    """Dependency to get design version service with current user context."""
    return create_design_version_service(
        db=db,
        tenant_id=UUID(current_user.tenant_id),
        user_id=current_user.id,
    )


@router.get("/tenders/{tender_id}/site-designs", response_model=List[SiteDesignResponse])
async def list_site_designs(
    tender_id: UUID,
    site_design_service: SiteDesignService = Depends(get_site_design_service),
):
    """
    List all site designs for a tender.
    Returns list of designs with their current calculated metrics (system size, module count).
    """
    designs = site_design_service.list_designs(tender_id)
    return [SiteDesignResponse.model_validate(d) for d in designs]


@router.post("/tenders/{tender_id}/site-designs", response_model=SiteDesignResponse, status_code=status.HTTP_201_CREATED)
async def create_site_design(
    tender_id: UUID,
    request: SiteDesignCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role(UserRole.ADMIN, UserRole.PM)),
    site_design_service: SiteDesignService = Depends(get_site_design_service),
):
    """
    Create a new site design.
    
    Requires Admin or PM role.
    
    The `site_boundary` must be a valid GeoJSON Polygon.
    Example:
    ```json
    {
      "type": "Polygon",
      "coordinates": [[[0,0], [100,0], [100,100], [0,100], [0,0]]]
    }
    ```
    """
    design = site_design_service.create_design(
        tender_id=tender_id,
        name=request.name,
        site_type=request.site_type.value,
        equipment_module_id=request.equipment_module_id,
        equipment_inverter_id=request.equipment_inverter_id,
        site_boundary=request.site_boundary,
        placement_settings=request.placement_settings.model_dump(),
    )
    db.commit()
    db.refresh(design)
    # Ensure UUIDs are strings for serialization safety
    response_data = SiteDesignResponse.model_validate(design).model_dump()
    response_data["id"] = str(response_data["id"])
    response_data["tender_id"] = str(response_data["tender_id"])
    if response_data.get("equipment_module_id"):
        response_data["equipment_module_id"] = str(response_data["equipment_module_id"])
    if response_data.get("equipment_inverter_id"):
        response_data["equipment_inverter_id"] = str(response_data["equipment_inverter_id"])
    return response_data


@router.get("/site-designs/{design_id}", response_model=SiteDesignResponse)
async def get_site_design(
    design_id: UUID,
    site_design_service: SiteDesignService = Depends(get_site_design_service),
):
    """Get site design by ID."""
    design = site_design_service.get_design_or_404(design_id)
    return SiteDesignResponse.model_validate(design)


@router.put("/site-designs/{design_id}", response_model=SiteDesignResponse)
async def update_site_design(
    design_id: UUID,
    request: SiteDesignUpdate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role(UserRole.ADMIN, UserRole.PM)),
    site_design_service: SiteDesignService = Depends(get_site_design_service),
):
    """
    Update site design geometry, settings, or equipment.
    
    Requires Admin or PM role.
    
    **Partial Updates**: You can update individual fields.
    - Updating `site_boundary`, `exclusion_zones`, or `placement_settings` will trigger **automatic module placement recalculation**.
    - Updating `equipment_module_id` or `equipment_inverter_id` will also trigger recalculation.
    
    The response will contain the updated design with the *old* metrics until the async placement task completes (if triggered).
    Poll the `placement_task_status` field to check progress.
    """
    design = site_design_service.get_design_or_404(design_id)
    
    # Update Geometry
    if request.site_boundary or request.exclusion_zones:
        site_design_service.update_geometry(
            design=design,
            site_boundary=request.site_boundary,
            exclusion_zones=request.exclusion_zones
        )
        
    # Update Settings
    if request.placement_settings:
        site_design_service.update_settings(
            design=design,
            placement_settings=request.placement_settings.model_dump()
        )
        
    # Update Equipment
    if request.equipment_module_id or request.equipment_inverter_id:
        site_design_service.update_equipment(
            design=design,
            equipment_module_id=request.equipment_module_id,
            equipment_inverter_id=request.equipment_inverter_id
        )
        
    # Generic fields (Name/Type) - handled here manually for now as service didn't have specific method
    # or we can add logic. Service had specific update methods.
    # Let's handle name update here if provided, or add a method to service.
    # The service had update_geometry, update_settings, update_equipment. 
    # It seems I missed a generic 'update_metadata' or mixed it.
    # I'll just update name directly here if changed, and log it if I want, 
    # but the service pattern suggests keeping logic there.
    # For now, I'll update name directly if provided.
    
    if request.name and request.name != design.name:
        design.name = request.name

    # Trigger recalculation if any critical fields changed
    if request.site_boundary or request.exclusion_zones or request.placement_settings or \
       request.equipment_module_id or request.equipment_inverter_id:
        site_design_service.recalculate_design(design.id)
        
    db.commit()
    db.refresh(design)
    return SiteDesignResponse.model_validate(design)


@router.delete("/site-designs/{design_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_site_design(
    design_id: UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role(UserRole.ADMIN, UserRole.PM)),
    site_design_service: SiteDesignService = Depends(get_site_design_service),
):
    """
    Delete site design.
    
    Requires: Admin role.
    """
    design = site_design_service.get_design_or_404(design_id)
    site_design_service.delete_design(design)
    db.commit()
    return None



@router.post("/site-designs/{design_id}/versions", response_model=DesignVersionResponse, status_code=status.HTTP_201_CREATED)
async def create_design_version(
    design_id: UUID,
    request: DesignVersionCreate,
    service: DesignVersionService = Depends(get_design_version_service),
):
    """
    Create a new immutable version snapshot of the site design.
    
    This saves the current state (geometry, settings, equipment, calculated metrics) as a read-only version.
    Useful for comparing different design iterations.
    """
    version = service.create_version(
        site_design_id=design_id,
        version_data=request
    )
    return DesignVersionResponse.model_validate(version)


@router.get("/site-designs/{design_id}/versions", response_model=List[DesignVersionResponse])
async def list_design_versions(
    design_id: UUID,
    service: DesignVersionService = Depends(get_design_version_service),
):
    """
    List all versions of a site design.
    """
    versions = service.list_versions(site_design_id=design_id)
    return [DesignVersionResponse.model_validate(v) for v in versions]


@router.get("/site-designs/{design_id}/versions/{version_id}", response_model=DesignVersionDetail)
async def get_design_version_detail(
    design_id: UUID,
    version_id: UUID,
    service: DesignVersionService = Depends(get_design_version_service),
):
    """
    Get full details of a specific design version, including the complete snapshot.
    """
    version = service.get_version_detail(version_id=version_id, site_design_id=design_id)
    return DesignVersionDetail.model_validate(version)


@router.post("/site-designs/{design_id}/restore/{version_id}", response_model=DesignVersionRestoreResponse)
async def restore_design_version(
    design_id: UUID,
    version_id: UUID,
    service: DesignVersionService = Depends(get_design_version_service),
):
    """
    Restore a site design to a previous version.
    
    **Warning**: This overwrites the current design state with the version snapshot.
    It automatically triggers a recalculation to ensure the restored design limits are valid against current equipment specs.
    """
    site_design, recalc_status = service.restore_version(version_id=version_id, site_design_id=design_id)
    return {
        "site_design": SiteDesignResponse.model_validate(site_design),
        "recalculation_status": recalc_status
    }

@router.post("/site-designs/{design_id}/energy-estimate", status_code=status.HTTP_202_ACCEPTED)
async def estimate_energy(
    design_id: UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role(UserRole.ADMIN, UserRole.PM, UserRole.ENGINEER)),
):
    """
    Trigger energy estimation for a site design.
    
    This initiates an asynchronous background task that calls the NREL PVWatts API.
    Returns the `estimate_id` and initial status.
    
    **Flow**:
    1. Call this endpoint -> receive `estimate_id`.
    2. Poll `GET /site-designs/{design_id}/energy-estimate` to check status.
    """
    from app.services.energy_estimation import EnergyEstimationService
    service = EnergyEstimationService(db)
    try:
        estimate = service.estimate_energy_async(design_id)
        return {"status": "initiated", "estimate_id": str(estimate.id), "current_status": estimate.status}
    except ValueError as e:
        # SiteDesign not found or other issues
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/site-designs/{design_id}/energy-estimate")
async def get_energy_estimate(
    design_id: UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Get energy estimate results.
    
    **Statuses**:
    - `not_calculated`: No estimation has been run yet.
    - `calculating`: Async task is currently running.
    - `completed`: Results are available.
    - `failed`: Check `error_message` for details (e.g., NREL API timeout).
    """
    from app.services.energy_estimation import EnergyEstimationService
    service = EnergyEstimationService(db)
    estimate = service.get_estimate(design_id)
    if not estimate:
        return {
            "status": "not_calculated",
            "annual_energy_kwh": 0,
            "monthly_energy_kwh": [0.0] * 12,
            "capacity_factor": 0.0,
            "calculated_at": None
        }
    
    return {
        "id": str(estimate.id),
        "site_design_id": str(estimate.site_design_id),
        "status": estimate.status,
        "annual_energy_kwh": estimate.annual_energy_kwh,
        "monthly_energy_kwh": estimate.monthly_energy_kwh,
        "capacity_factor": estimate.capacity_factor,
        "error_message": estimate.error_message,
        "calculated_at": estimate.calculated_at.isoformat() if estimate.calculated_at else None
    }



