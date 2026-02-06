from typing import List, Optional
from uuid import UUID

from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException, status

from app.models.models import DesignVersion, SiteDesign, Tender
from app.schemas.design_version import DesignVersionCreate
from app.services.audit import AuditService
from app.services.energy_estimation import EnergyEstimationService
from app.services.financial_analysis import FinancialAnalysisService


class DesignVersionService:
    def __init__(self, db: Session, tenant_id: UUID, user_id: UUID):
        self.db = db
        self.tenant_id = tenant_id
        self.user_id = user_id
        self.audit = AuditService(db)

    def _validate_snapshot_data(self, snapshot_data: dict):
        """
        Validate presence and basic bounds for critical design parameters.
        """
        errors = []
        
        # Presence and non-empty checks
        if not snapshot_data.get("site_boundary"):
            errors.append("site_boundary is missing or empty")
        
        if not snapshot_data.get("equipment_module_id"):
            errors.append("equipment_module_id is missing")
            
        if not snapshot_data.get("equipment_inverter_id"):
            errors.append("equipment_inverter_id is missing")
            
        # Basic bounds checks
        total_modules = snapshot_data.get("total_modules", 0)
        if total_modules <= 0:
            errors.append("total_modules must be greater than 0")
            
        system_size_kwp = snapshot_data.get("system_size_kwp", 0.0)
        if system_size_kwp <= 0:
            errors.append("system_size_kwp must be greater than 0")
            
        if errors:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid snapshot data: {', '.join(errors)}"
            )

    def _get_site_design_or_404(self, site_design_id: UUID) -> SiteDesign:
        """Fetch site design with tenant isolation."""
        site_design = (
            self.db.query(SiteDesign)
            .join(Tender)
            .options(joinedload(SiteDesign.tender))
            .filter(SiteDesign.id == site_design_id)
            .filter(Tender.tenant_id == self.tenant_id)
            .first()
        )
        if not site_design:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Site design {site_design_id} not found or access denied"
            )
        return site_design

    def _get_version_or_404(self, version_id: UUID) -> DesignVersion:
        """Fetch design version with tenant isolation."""
        version = (
            self.db.query(DesignVersion)
            .join(SiteDesign)
            .join(Tender)
            .options(joinedload(DesignVersion.site_design).joinedload(SiteDesign.tender))
            .filter(DesignVersion.id == version_id)
            .filter(Tender.tenant_id == self.tenant_id)
            .first()
        )
        if not version:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Design version {version_id} not found or access denied"
            )
        return version

    def create_version(self, site_design_id: UUID, version_data: DesignVersionCreate) -> DesignVersion:
        """
        Create a new version (snapshot) of the current site design state.
        """
        # 1. Fetch current design (tenant isolation handled by helper)
        site_design = self._get_site_design_or_404(site_design_id)

        # 2. Construct snapshot data
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
            "total_modules": site_design.total_modules,
            "system_size_kwp": site_design.system_size_kwp,
            "site_area_sqm": site_design.site_area_sqm,
        }

        # 2.1 Validate Snapshot
        self._validate_snapshot_data(snapshot_data)

        # 2.2 Fetch Energy Estimate
        energy_service = EnergyEstimationService(self.db)
        energy_est = energy_service.get_estimate(site_design_id)
        if energy_est:
            snapshot_data["energy_estimate"] = {
                "status": energy_est.status,
                "annual_energy_kwh": energy_est.annual_energy_kwh,
                "monthly_energy_kwh": energy_est.monthly_energy_kwh,
                "capacity_factor": energy_est.capacity_factor,
                "calculated_at": energy_est.calculated_at.isoformat() if energy_est.calculated_at else None,
                "error_message": energy_est.error_message
            }
        else:
            snapshot_data["energy_estimate"] = None

        # 2.3 Fetch Financial Analysis
        financial_service = FinancialAnalysisService(self.db, self.tenant_id, self.user_id)
        fin_analysis = financial_service.get_analysis(site_design_id)
        if fin_analysis:
            snapshot_data["financial_analysis"] = {
                "system_cost_usd": fin_analysis.system_cost_usd,
                "electricity_rate_usd_per_kwh": fin_analysis.electricity_rate_usd_per_kwh,
                "annual_rate_escalation_pct": fin_analysis.annual_rate_escalation_pct,
                "annual_savings_usd": fin_analysis.annual_savings_usd,
                "simple_payback_years": fin_analysis.simple_payback_years,
                "roi_pct": fin_analysis.roi_pct,
                "calculated_at": fin_analysis.calculated_at.isoformat() if fin_analysis.calculated_at else None
            }
        else:
            snapshot_data["financial_analysis"] = None

        # 3. Create DesignVersion
        db_version = DesignVersion(
            site_design_id=site_design_id,
            version_name=version_data.version_name,
            notes=version_data.notes,
            created_by=self.user_id,
            snapshot_data=snapshot_data
        )
        
        self.db.add(db_version)
        self.db.flush() # Ensure ID is generated
        
        # 4. Audit Log via AuditService
        self.audit.log_create(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            entity_type="DesignVersion",
            entity_id=db_version.id,
            new_value={
                "version_name": version_data.version_name,
                "notes": version_data.notes,
                "snapshot_keys": list(snapshot_data.keys())
            }
        )
        
        self.db.commit()
        self.db.refresh(db_version)
        return db_version

    def list_versions(self, site_design_id: UUID) -> List[DesignVersion]:
        """
        List all versions for a site design with tenant isolation.
        """
        # Optional: Log the access for compliance
        self.audit.log(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            entity_type="DesignVersion",
            entity_id=site_design_id, # Using site_design_id as the relevant entity for the list action
            action="list"
        )
        self.db.commit()

        return (
            self.db.query(DesignVersion)
            .join(SiteDesign)
            .join(Tender)
            .filter(DesignVersion.site_design_id == site_design_id)
            .filter(Tender.tenant_id == self.tenant_id)
            .order_by(DesignVersion.created_at.desc())
            .all()
        )
    def get_version_detail(self, version_id: UUID, site_design_id: UUID) -> DesignVersion:
        """
        Fetch full details (including snapshot) for a specific design version.
        """
        version = self._get_version_or_404(version_id)
        
        # Verify version belongs to the specific site design
        if version.site_design_id != site_design_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Design version {version_id} does not belong to site design {site_design_id}"
            )
            
        return version

    def restore_version(self, version_id: UUID, site_design_id: UUID) -> tuple[SiteDesign, dict]:
        """
        Restore a site design to a previous version's state.
        This updates the SiteDesign record with values from the snapshot.
        """
        # 1. Fetch version (tenant isolation handled by helper)
        version = self._get_version_or_404(version_id)
        
        # Verify version belongs to the specific site design from the path
        if version.site_design_id != site_design_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Design version {version_id} does not belong to site design {site_design_id}"
            )

        site_design = version.site_design

        snapshot = version.snapshot_data
        
        # 2. Capture old state for audit
        old_state = {
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
            "total_modules": site_design.total_modules,
            "system_size_kwp": site_design.system_size_kwp,
            "site_area_sqm": site_design.site_area_sqm,
        }

        # 3. Update SiteDesign fields
        site_design.name = snapshot.get("name", site_design.name) 
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

        # 4. Capture new state for audit
        new_state = {
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
            "total_modules": site_design.total_modules,
            "system_size_kwp": site_design.system_size_kwp,
            "site_area_sqm": site_design.site_area_sqm,
        }

        # 5. Create Audit Log via AuditService
        self.audit.log_update(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            entity_type="SiteDesign",
            entity_id=site_design.id,
            old_value=old_state,
            new_value={
                "restored_from_version_id": str(version_id),
                "restored_from_version_name": version.version_name,
                **new_state
            }
        )
        
        self.db.commit()
        self.db.refresh(site_design)

        # 6. Trigger Recalculations if needed
        recalc_status = {
            "energy_estimation": "skipped",
            "financial_analysis": "skipped"
        }

        # Parameters that affect energy estimation:
        energy_params = [
            "site_type", "equipment_module_id", "azimuth_deg", 
            "tilt_deg", "system_size_kwp"
        ]
        
        energy_changed = any(old_state.get(p) != new_state.get(p) for p in energy_params)
        
        if energy_changed:
            energy_service = EnergyEstimationService(self.db)
            try:
                estimate = energy_service.estimate_energy_async(site_design.id)
                recalc_status["energy_estimation"] = estimate.status
            except Exception as e:
                recalc_status["energy_estimation"] = f"error: {str(e)}"

        # Financials depend on energy results and system cost (from BOQ, which might not change here, 
        # but system size change usually implies financials should be updated)
        if energy_changed or old_state.get("system_size_kwp") != new_state.get("system_size_kwp"):
            financial_service = FinancialAnalysisService(self.db, self.tenant_id, self.user_id)
            try:
                # Note: Financial calculation is sync in the current service implementation
                financial_service.calculate_financials(site_design.id)
                recalc_status["financial_analysis"] = "completed"
            except Exception as e:
                recalc_status["financial_analysis"] = f"error: {str(e)}"

        return site_design, recalc_status


def get_design_version_service(db: Session, tenant_id: UUID, user_id: UUID) -> DesignVersionService:
    """Factory function for DesignVersionService."""
    return DesignVersionService(db, tenant_id, user_id)
