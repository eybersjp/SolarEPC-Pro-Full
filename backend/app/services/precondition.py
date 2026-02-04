"""
Preconditions service for go/no-go evaluation.
"""
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models import Precondition, Tender
from app.services.audit import AuditService


class PreconditionService:
    """Service for managing tender preconditions."""
    
    def __init__(self, db: Session, tenant_id: UUID, user_id: UUID):
        self.db = db
        self.tenant_id = tenant_id
        self.user_id = user_id
        self.audit = AuditService(db)
    
    def get_precondition(self, tender_id: UUID) -> Optional[Precondition]:
        """Get precondition for a tender."""
        # Verify tender belongs to tenant
        tender = self.db.query(Tender).filter(
            Tender.id == tender_id,
            Tender.tenant_id == self.tenant_id,
        ).first()
        
        if not tender:
            return None
        
        return tender.precondition
    
    def get_precondition_or_404(self, tender_id: UUID) -> Precondition:
        """Get precondition or raise 404."""
        precondition = self.get_precondition(tender_id)
        if not precondition:
            from fastapi import HTTPException, status
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Precondition for tender {tender_id} not found",
            )
        return precondition
    
    def update_precondition(
        self,
        precondition: Precondition,
        grid_connection: Optional[bool] = None,
        land_access: Optional[bool] = None,
        permits_cleared: Optional[bool] = None,
        financing_confirmed: Optional[bool] = None,
        go_decision: Optional[bool] = None,
        notes: Optional[str] = None,
    ) -> Precondition:
        """
        Update precondition fields and recompute go_decision.
        
        Go decision is True only if ALL preconditions are met,
        unless a manual go_decision is explicitly provided.
        """
        old_values = {}
        new_values = {}
        
        if grid_connection is not None and grid_connection != precondition.grid_connection:
            old_values["grid_connection"] = precondition.grid_connection
            new_values["grid_connection"] = grid_connection
            precondition.grid_connection = grid_connection
        
        if land_access is not None and land_access != precondition.land_access:
            old_values["land_access"] = precondition.land_access
            new_values["land_access"] = land_access
            precondition.land_access = land_access
        
        if permits_cleared is not None and permits_cleared != precondition.permits_cleared:
            old_values["permits_cleared"] = precondition.permits_cleared
            new_values["permits_cleared"] = permits_cleared
            precondition.permits_cleared = permits_cleared
        
        if financing_confirmed is not None and financing_confirmed != precondition.financing_confirmed:
            old_values["financing_confirmed"] = precondition.financing_confirmed
            new_values["financing_confirmed"] = financing_confirmed
            precondition.financing_confirmed = financing_confirmed
        
        if notes is not None and notes != precondition.notes:
            old_values["notes"] = precondition.notes
            new_values["notes"] = notes
            precondition.notes = notes
        
        # Recompute or set go decision
        old_go = precondition.go_decision
        if go_decision is not None:
            precondition.go_decision = go_decision
        else:
            precondition.go_decision = self._compute_go_decision(precondition)
        
        if old_go != precondition.go_decision:
            old_values["go_decision"] = old_go
            new_values["go_decision"] = precondition.go_decision
        
        if new_values:
            self.audit.log_update(
                tenant_id=self.tenant_id,
                user_id=self.user_id,
                entity_type="Precondition",
                entity_id=precondition.id,
                old_value=old_values,
                new_value=new_values,
            )
        
        return precondition
    
    def _compute_go_decision(self, precondition: Precondition) -> bool:
        """
        Compute go/no-go decision.
        
        All critical items must be True for a GO decision.
        """
        return all([
            precondition.grid_connection,
            precondition.land_access,
            precondition.permits_cleared,
            precondition.financing_confirmed,
        ])
    
    def get_blockers(self, precondition: Precondition) -> list[str]:
        """Get list of blocking items that prevent GO decision."""
        blockers = []
        
        if not precondition.grid_connection:
            blockers.append("Grid connection not confirmed")
        if not precondition.land_access:
            blockers.append("Land access not secured")
        if not precondition.permits_cleared:
            blockers.append("Permits not cleared")
        if not precondition.financing_confirmed:
            blockers.append("Financing not confirmed")
        
        return blockers


def get_precondition_service(
    db: Session,
    tenant_id: UUID,
    user_id: UUID,
) -> PreconditionService:
    """Factory function for precondition service."""
    return PreconditionService(db, tenant_id, user_id)
