"""
PV Design service with sizing calculations.
"""
from typing import Optional, List
from uuid import UUID

from sqlalchemy.orm import Session

from app.models import PVDesign, Tender
from app.services.audit import AuditService


class PVDesignService:
    """Service for PV system design and sizing calculations."""
    
    def __init__(self, db: Session, tenant_id: UUID, user_id: UUID):
        self.db = db
        self.tenant_id = tenant_id
        self.user_id = user_id
        self.audit = AuditService(db)
    
    def list_designs(self, tender_id: UUID) -> List[PVDesign]:
        """List all PV designs for a tender."""
        # Verify tender access
        tender = self._get_tender_or_404(tender_id)
        return tender.pv_designs
    
    def get_design(self, design_id: UUID) -> Optional[PVDesign]:
        """Get a PV design by ID."""
        design = self.db.query(PVDesign).filter(PVDesign.id == design_id).first()
        if design:
            # Verify tenant access
            tender = self._get_tender_or_404(design.tender_id)
        return design
    
    def get_design_or_404(self, design_id: UUID) -> PVDesign:
        """Get PV design or raise 404."""
        design = self.get_design(design_id)
        if not design:
            from fastapi import HTTPException, status
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"PV Design {design_id} not found",
            )
        return design
    
    def create_design(
        self,
        tender_id: UUID,
        module_model: str,
        module_watt: int,
        inverter_model: str,
        inverter_kw: int,
        strings_per_inverter: int,
        modules_per_string: int,
    ) -> PVDesign:
        """
        Create a new PV design with automatic calculations.
        
        Calculates:
        - DC:AC ratio
        - Total modules
        - Total capacity (kWp)
        """
        # Verify tender access
        self._get_tender_or_404(tender_id)
        
        # Perform sizing calculations
        dc_ac_ratio = self._calculate_dc_ac_ratio(
            module_watt=module_watt,
            strings_per_inverter=strings_per_inverter,
            modules_per_string=modules_per_string,
            inverter_kw=inverter_kw,
        )
        
        total_modules = strings_per_inverter * modules_per_string
        total_capacity_kwp = (total_modules * module_watt) / 1000
        
        design = PVDesign(
            tender_id=tender_id,
            created_by=self.user_id,
            module_model=module_model,
            module_watt=module_watt,
            inverter_model=inverter_model,
            inverter_kw=inverter_kw,
            strings_per_inverter=strings_per_inverter,
            modules_per_string=modules_per_string,
            dc_ac_ratio=round(dc_ac_ratio, 2),
            total_modules=total_modules,
            total_capacity_kwp=round(total_capacity_kwp, 2),
        )
        
        self.db.add(design)
        self.db.flush()
        
        self.audit.log_create(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            entity_type="PVDesign",
            entity_id=design.id,
            new_value={
                "module_model": module_model,
                "module_watt": module_watt,
                "inverter_model": inverter_model,
                "total_capacity_kwp": design.total_capacity_kwp,
            },
        )
        
        return design
    
    def _calculate_dc_ac_ratio(
        self,
        module_watt: int,
        strings_per_inverter: int,
        modules_per_string: int,
        inverter_kw: int,
    ) -> float:
        """
        Calculate DC:AC ratio.
        
        DC:AC = (Total DC Power in kW) / (Inverter AC Power in kW)
        
        Typical ranges:
        - 1.0 - 1.2: Conservative
        - 1.2 - 1.3: Standard
        - 1.3 - 1.5: Aggressive (more clipping)
        """
        total_dc_kw = (module_watt * strings_per_inverter * modules_per_string) / 1000
        return total_dc_kw / inverter_kw
    
    def validate_design(self, design: PVDesign) -> dict:
        """
        Validate PV design parameters.
        
        Returns dict with 'valid' bool and 'warnings' list.
        """
        warnings = []
        
        # Check DC:AC ratio
        if design.dc_ac_ratio < 1.0:
            warnings.append("DC:AC ratio below 1.0 - inverter may be oversized")
        elif design.dc_ac_ratio > 1.5:
            warnings.append("DC:AC ratio above 1.5 - significant clipping expected")
        
        # Check modules per string (typical range 15-30 for utility scale)
        if design.modules_per_string < 10:
            warnings.append("Modules per string seems low - verify voltage compatibility")
        elif design.modules_per_string > 40:
            warnings.append("Modules per string seems high - verify string voltage limits")
        
        return {
            "valid": len(warnings) == 0,
            "warnings": warnings,
        }
    
    def delete_design(self, design: PVDesign) -> None:
        """Delete a PV design."""
        self.audit.log_delete(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            entity_type="PVDesign",
            entity_id=design.id,
            old_value={
                "module_model": design.module_model,
                "total_capacity_kwp": design.total_capacity_kwp,
            },
        )
        self.db.delete(design)
    
    def _get_tender_or_404(self, tender_id: UUID) -> Tender:
        """Get tender with tenant verification."""
        tender = self.db.query(Tender).filter(
            Tender.id == tender_id,
            Tender.tenant_id == self.tenant_id,
        ).first()
        
        if not tender:
            from fastapi import HTTPException, status
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Tender {tender_id} not found",
            )
        return tender


def get_pv_design_service(
    db: Session,
    tenant_id: UUID,
    user_id: UUID,
) -> PVDesignService:
    """Factory function for PV design service."""
    return PVDesignService(db, tenant_id, user_id)
