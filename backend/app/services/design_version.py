from typing import List, Optional
from uuid import UUID

from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.models import DesignVersion, SiteDesign, AuditLog
from app.schemas.design_version import DesignVersionCreate
from app.schemas.site_design import SiteDesignUpdate


class DesignVersionService:
    @staticmethod
    def create_version(
        db: Session, 
        site_design_id: UUID, 
        user_id: UUID, 
        version_data: DesignVersionCreate
    ) -> DesignVersion:
        """
        Create a new version (snapshot) of the current site design state.
        """
        # 1. Fetch current design
        site_design = db.query(SiteDesign).filter(SiteDesign.id == site_design_id).first()
        if not site_design:
            raise HTTPException(status_code=404, detail="Site design not found")

        # 2. Construct snapshot data
        # We include all fields that define the design's geometric and configuration state
        snapshot_data = {
            "name": site_design.name,
            "site_type": site_design.site_type,
            "equipment_module_id": str(site_design.equipment_module_id),
            "equipment_inverter_id": str(site_design.equipment_inverter_id),
            "site_boundary": site_design.site_boundary,
            "exclusion_zones": site_design.exclusion_zones,
            "module_placements": site_design.module_placements,
            "edge_setback_m": site_design.edge_setback_m,
            "row_spacing_m": site_design.row_spacing_m,
            "module_orientation": site_design.module_orientation,
            "azimuth_deg": site_design.azimuth_deg,
            "tilt_deg": site_design.tilt_deg,
            # Calculated results are also stored to avoid re-calculation if parameters match
            "total_modules": site_design.total_modules,
            "system_size_kwp": site_design.system_size_kwp,
            "site_area_sqm": site_design.site_area_sqm,
        }

        # 3. Create DesignVersion
        db_version = DesignVersion(
            site_design_id=site_design_id,
            version_name=version_data.version_name,
            notes=version_data.notes,
            created_by=user_id,
            snapshot_data=snapshot_data
        )
        
        db.add(db_version)
        db.flush() # Ensure ID is generated
        
        # 4. Audit Log
        audit = AuditLog(
            tenant_id=site_design.tender.tenant_id, # Assumes site_design.tender is loaded or lazy loaded
            user_id=user_id,
            entity_type="DesignVersion",
            entity_id=db_version.id, 
            action="create",
            new_value={"version_name": version_data.version_name}
        )
        db.add(audit)
        
        db.commit()
        db.refresh(db_version)
        return db_version

    @staticmethod
    def list_versions(
        db: Session, 
        site_design_id: UUID
    ) -> List[DesignVersion]:
        """
        List all versions for a site design.
        """
        return db.query(DesignVersion).filter(
            DesignVersion.site_design_id == site_design_id
        ).order_by(DesignVersion.created_at.desc()).all()

    @staticmethod
    def restore_version(
        db: Session, 
        version_id: UUID, 
        user_id: UUID
    ) -> SiteDesign:
        """
        Restore a site design to a previous version's state.
        This updates the SiteDesign record with values from the snapshot.
        """
        version = db.query(DesignVersion).filter(DesignVersion.id == version_id).first()
        if not version:
            raise HTTPException(status_code=404, detail="Design version not found")
            
        site_design = db.query(SiteDesign).filter(SiteDesign.id == version.site_design_id).first()
        if not site_design:
            # Should not happen due to FK, but safe check
            raise HTTPException(status_code=404, detail="Parent site design not found")

        snapshot = version.snapshot_data
        print(f"DEBUG: Restoring snapshot: {snapshot}")
        
        # Capture old state for audit
        old_state = {
            "name": site_design.name,
            "system_size_kwp": site_design.system_size_kwp
        }

        # Update SiteDesign fields
        site_design.name = snapshot.get("name", site_design.name) 
        # site_type usually doesn't change easily, but if snapshot has it, we should trust it 
        # or warn if incompatible. For now, assume consistent site_type.
        site_design.site_type = snapshot.get("site_type", site_design.site_type)
        
        site_design.equipment_module_id = UUID(snapshot["equipment_module_id"])
        site_design.equipment_inverter_id = UUID(snapshot["equipment_inverter_id"])
        
        site_design.site_boundary = snapshot["site_boundary"]
        site_design.exclusion_zones = snapshot.get("exclusion_zones", [])
        site_design.module_placements = snapshot.get("module_placements", [])
        
        site_design.edge_setback_m = snapshot.get("edge_setback_m", 1.0)
        site_design.row_spacing_m = snapshot.get("row_spacing_m", 2.0)
        site_design.module_orientation = snapshot.get("module_orientation", "portrait")
        site_design.azimuth_deg = snapshot.get("azimuth_deg", 180.0)
        site_design.tilt_deg = snapshot.get("tilt_deg", 0.0)
        
        site_design.total_modules = snapshot.get("total_modules", 0)
        site_design.system_size_kwp = snapshot.get("system_size_kwp", 0.0)
        site_design.site_area_sqm = snapshot.get("site_area_sqm")

        # Create Audit Log
        audit = AuditLog(
            tenant_id=site_design.tender.tenant_id,
            user_id=user_id,
            entity_type="SiteDesign",
            entity_id=site_design.id,
            action="restore_version",
            old_value=old_state,
            new_value={"restored_from_version_id": str(version_id)}
        )
        db.add(audit)
        
        db.commit()
        db.refresh(site_design)
        return site_design
