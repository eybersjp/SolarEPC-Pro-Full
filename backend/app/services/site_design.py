"""
Site Design service for managing site layout and configuration.
"""
from typing import Optional, List, Dict, Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models import (
    SiteDesign, 
    Tender, 
    EquipmentModule, 
    EquipmentInverter,
    User
)
from app.services.audit import AuditService
from app.services.equipment_library import EquipmentLibraryService
from app.utils.geojson_validator import validate_geojson_polygon, calculate_polygon_area_sqm
from app.services.placement_algorithm import PlacementAlgorithmService
from app.services.tasks import calculate_placement_async
from celery.result import AsyncResult
from datetime import datetime
import math

class SiteDesignService:
    """Service for site design CRUD and management."""
    
    def __init__(self, db: Session, tenant_id: UUID, user_id: UUID):
        self.db = db
        self.tenant_id = tenant_id
        self.user_id = user_id
        self.audit = AuditService(db)
        self.equipment_lib = EquipmentLibraryService(db, tenant_id, user_id)
    
    def _get_tender_or_404(self, tender_id: UUID) -> Tender:
        """Get tender or raise 404 (tenant-scoped)."""
        tender = self.db.query(Tender).filter(
            Tender.id == tender_id,
            Tender.tenant_id == self.tenant_id
        ).first()
        
        if not tender:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Tender {tender_id} not found"
            )
        return tender

    def _validate_equipment(self, module_id: UUID, inverter_id: UUID) -> None:
        """Validate equipment exists and is accessible."""
        # Use EquipmentLibraryService for validation
        try:
            module = self.equipment_lib.get_module_or_404(module_id)
            if not module.is_active:
                raise HTTPException(status_code=400, detail=f"Equipment Module {module_id} is inactive")
                
            inverter = self.equipment_lib.get_inverter_or_404(inverter_id)
            if not inverter.is_active:
                raise HTTPException(status_code=400, detail=f"Equipment Inverter {inverter_id} is inactive")
        except HTTPException as e:
            if e.status_code == 404:
                # Re-raise as 400 as requested for validation errors
                raise HTTPException(status_code=400, detail=e.detail)
            raise e

    def list_designs(self, tender_id: UUID) -> List[SiteDesign]:
        """List all designs for a tender."""
        self._get_tender_or_404(tender_id)  # Ensure access
        return self.db.query(SiteDesign).filter(
            SiteDesign.tender_id == tender_id
        ).order_by(SiteDesign.created_at.desc()).all()

    def get_design(self, design_id: UUID) -> Optional[SiteDesign]:
        """Get design by ID (tenant-scoped via tender)."""
        return self.db.query(SiteDesign).join(Tender).filter(
            SiteDesign.id == design_id,
            Tender.tenant_id == self.tenant_id
        ).first()

    def get_design_or_404(self, design_id: UUID) -> SiteDesign:
        """Get design or raise 404."""
        design = self.get_design(design_id)
        if not design:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Site Design {design_id} not found"
            )
        return design

    def create_design(
        self,
        tender_id: UUID,
        name: str,
        site_type: str,
        equipment_module_id: UUID,
        equipment_inverter_id: UUID,
        site_boundary: Dict[str, Any],
        placement_settings: Dict[str, Any]
    ) -> SiteDesign:
        """Create a new site design."""
        tender = self._get_tender_or_404(tender_id)
        self._validate_equipment(equipment_module_id, equipment_inverter_id)
        
        # GeoJSON Validation
        is_valid, error = validate_geojson_polygon(site_boundary)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid site boundary: {error}"
            )
            
        # Area Calculation
        site_area = calculate_polygon_area_sqm(site_boundary)
        
        # Determine default tilt if not provided in settings
        tilt_deg = placement_settings.get("tilt_deg")
        if tilt_deg is None:
            defaults = {"ground_mount": 20.0, "rooftop": 10.0, "carport": 0.0}
            tilt_deg = defaults.get(site_type, 20.0)
        
        # Flatten placement settings for DB columns where applicable, 
        # or keep specific ones. 
        # The model has specific columns: edge_setback_m, row_spacing_m, etc.
        # We assume placement_settings dict matches those keys.
        
        design = SiteDesign(
            tender_id=tender.id,
            name=name,
            site_type=site_type,
            created_by=self.user_id,
            equipment_module_id=equipment_module_id,
            equipment_inverter_id=equipment_inverter_id,
            site_boundary=site_boundary,
            site_area_sqm=site_area,
            
            # Placement Settings
            edge_setback_m=placement_settings.get("edge_setback_m", 1.0),
            row_spacing_m=placement_settings.get("row_spacing_m", 2.0),
            module_orientation=placement_settings.get("module_orientation", "portrait"),
            azimuth_deg=placement_settings.get("azimuth_deg", 180.0),
            tilt_deg=tilt_deg
        )
        
        self.db.add(design)
        self.db.flush()
        
        self.audit.log_create(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            entity_type="SiteDesign",
            entity_id=design.id,
            new_value={
                "name": name,
                "site_type": site_type,
                "equipment_module_id": str(equipment_module_id),
                "equipment_inverter_id": str(equipment_inverter_id)
            }
        )
        self.db.flush()
        
        return design

    def update_geometry(
        self,
        design: SiteDesign,
        site_boundary: Optional[Dict[str, Any]] = None,
        exclusion_zones: Optional[List[Dict[str, Any]]] = None
    ) -> SiteDesign:
        """Update geometric properties."""
        old_values = {}
        new_values = {}
        
        if site_boundary:
            is_valid, error = validate_geojson_polygon(site_boundary)
            if not is_valid:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid site boundary: {error}"
                )
            
            old_values["site_boundary"] = design.site_boundary
            new_values["site_boundary"] = site_boundary
            
            design.site_boundary = site_boundary
            design.site_area_sqm = calculate_polygon_area_sqm(site_boundary)
            
        if exclusion_zones is not None:
            # Validate each exclusion zone
            for idx, zone in enumerate(exclusion_zones):
                is_valid, error = validate_geojson_polygon(zone)
                if not is_valid:
                     raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Invalid exclusion zone at index {idx}: {error}"
                    )
            
            old_values["exclusion_zones"] = design.exclusion_zones
            new_values["exclusion_zones"] = exclusion_zones
            design.exclusion_zones = exclusion_zones
            
        if new_values:
            self.audit.log_update(
                tenant_id=self.tenant_id,
                user_id=self.user_id,
                entity_type="SiteDesign",
                entity_id=design.id,
                old_value=old_values,
                new_value=new_values
            )
            
        return design

    def update_settings(
        self,
        design: SiteDesign,
        placement_settings: Dict[str, Any]
    ) -> SiteDesign:
        """Update placement settings."""
        old_values = {}
        new_values = {}
        
        # Map fields
        fields = ["edge_setback_m", "row_spacing_m", "module_orientation", "azimuth_deg", "tilt_deg"]
        
        for field in fields:
            if field in placement_settings:
                val = placement_settings[field]
                current_val = getattr(design, field)
                if val is not None and val != current_val:
                    old_values[field] = current_val
                    new_values[field] = val
                    setattr(design, field, val)
        
        if new_values:
            self.audit.log_update(
                tenant_id=self.tenant_id,
                user_id=self.user_id,
                entity_type="SiteDesign",
                entity_id=design.id,
                old_value=old_values,
                new_value=new_values
            )
            
        return design

    def update_equipment(
        self,
        design: SiteDesign,
        equipment_module_id: Optional[UUID] = None,
        equipment_inverter_id: Optional[UUID] = None
    ) -> SiteDesign:
        """Update equipment selection."""
        old_values = {}
        new_values = {}
        
        # Only validate and update if changed
        new_mod = equipment_module_id or design.equipment_module_id
        new_inv = equipment_inverter_id or design.equipment_inverter_id
        
        if equipment_module_id and equipment_module_id != design.equipment_module_id:
            old_values["equipment_module_id"] = str(design.equipment_module_id)
            new_values["equipment_module_id"] = str(equipment_module_id)
            design.equipment_module_id = equipment_module_id
            
        if equipment_inverter_id and equipment_inverter_id != design.equipment_inverter_id:
            old_values["equipment_inverter_id"] = str(design.equipment_inverter_id)
            new_values["equipment_inverter_id"] = str(equipment_inverter_id)
            design.equipment_inverter_id = equipment_inverter_id
            
        if new_values:
            # Re-validate with new set
            self._validate_equipment(new_mod, new_inv)
            
            self.audit.log_update(
                tenant_id=self.tenant_id,
                user_id=self.user_id,
                entity_type="SiteDesign",
                entity_id=design.id,
                old_value=old_values,
                new_value=new_values
            )
            
        return design

    def delete_design(self, design: SiteDesign) -> None:
        """Delete a design."""
        self.audit.log_delete(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            entity_type="SiteDesign",
            entity_id=design.id,
            old_value={"name": design.name, "site_type": design.site_type}
        )
        self.db.delete(design)

    def recalculate_design(self, design_id: UUID, trigger_energy_estimation: bool = False) -> Dict[str, Any]:
        """
        Recalculate module placement.
        Hybrid execution:
        - Small sites (< 1000 modules est): Sync
        - Large sites: Async via Celery
        """
        design = self.get_design_or_404(design_id)
        
        # 1. Gather Inputs
        site_boundary = design.site_boundary
        exclusion_zones = design.exclusion_zones or []
        
        # Get module dims
        module = self.db.query(EquipmentModule).filter(EquipmentModule.id == design.equipment_module_id).first()
        if not module:
             raise HTTPException(status_code=400, detail="Equipment module not found")
             
        module_dims = {
            "length_m": module.length_m,
            "width_m": module.width_m
        }
        
        # Get settings
        settings = {
            "edge_setback_m": design.edge_setback_m,
            "row_spacing_m": design.row_spacing_m,
            "module_orientation": design.module_orientation,
            "azimuth_deg": design.azimuth_deg,
            # Use tilt from design, or default if not set? Model says default is set on creation.
            "tilt_deg": design.tilt_deg
        }
        
        # 2. Estimate Count
        # Simple estimate: Area * 0.8 (fill factor) / Module Area
        # This is a heuristic to decide execution mode.
        site_area = design.site_area_sqm or calculate_polygon_area_sqm(site_boundary)
        module_area = module.length_m * module.width_m
        if module_area > 0:
            est_modules = (site_area * 0.6) / module_area # Conservative 60% GCR
        else:
            est_modules = 0
            
        THRESHOLD = 1000
        
        if est_modules < THRESHOLD:
            # SYNC EXECUTION
            result = PlacementAlgorithmService.calculate_placement(
                site_boundary,
                exclusion_zones,
                module_dims,
                settings
            )
            
            # Update DB immediately
            design.module_placements = result["module_placements"]
            design.total_modules = result["total_modules"]
            
            # System size
            design.system_size_kwp = (design.total_modules * module.wattage) / 1000.0
            
            # Status and calculation timestamp
            design.placement_task_status = "completed"
            design.placement_calculated_at = datetime.utcnow()
            design.placement_task_id = None
            design.placement_task_error = None
            
            self.audit.log(
                tenant_id=self.tenant_id,
                user_id=self.user_id,
                entity_type="SiteDesign",
                entity_id=design.id,
                action="recalculate",
                new_value={"mode": "sync", "total_modules": design.total_modules}
            )
            
            self.db.commit()
            self.db.refresh(design)

            # Trigger Energy Estimation if requested (Sync mode)
            if trigger_energy_estimation:
                from app.services.energy_estimation import EnergyEstimationService
                energy_service = EnergyEstimationService(self.db)
                energy_service.estimate_energy_async(design.id)
            
            return {
                "mode": "sync",
                "status": "completed",
                "total_modules": design.total_modules,
                "system_size_kwp": design.system_size_kwp,
                "stats": result["stats"]
            }
        else:
            # ASYNC EXECUTION
            # 1. Set status to pending
            design.placement_task_status = "pending"
            design.placement_task_error = None
            self.db.commit()

            # 2. Queue task
            task = calculate_placement_async.delay(
                str(design.id),
                site_boundary,
                exclusion_zones,
                module_dims,
                settings,
                trigger_energy_estimation=trigger_energy_estimation
            )
            
            # 3. Store task ID
            design.placement_task_id = task.id
            
            self.audit.log(
                tenant_id=self.tenant_id,
                user_id=self.user_id,
                entity_type="SiteDesign",
                entity_id=design.id,
                action="recalculate",
                new_value={"mode": "async", "task_id": task.id}
            )
            self.db.commit()

            return {
                "mode": "async",
                "task_id": task.id,
                "estimated_modules": est_modules
            }


def get_site_design_service(
    db: Session,
    tenant_id: UUID,
    user_id: UUID,
) -> SiteDesignService:
    """Factory function for site design service."""
    return SiteDesignService(db, tenant_id, user_id)
