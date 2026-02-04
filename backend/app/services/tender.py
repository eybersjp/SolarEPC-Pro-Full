"""
Tender service for managing tender lifecycle.
"""
from typing import Optional, List
from uuid import UUID

from sqlalchemy.orm import Session

from app.models import Tender, Precondition, TenderStatus
from app.services.audit import AuditService


class TenderService:
    """Service for tender CRUD and lifecycle management."""
    
    def __init__(self, db: Session, tenant_id: UUID, user_id: UUID):
        self.db = db
        self.tenant_id = tenant_id
        self.user_id = user_id
        self.audit = AuditService(db)
    
    def list_tenders(
        self,
        status: Optional[TenderStatus] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[Tender]:
        """List tenders for current tenant with optional status filter."""
        query = self.db.query(Tender).filter(Tender.tenant_id == self.tenant_id)
        
        if status:
            query = query.filter(Tender.status == status)
        
        return query.order_by(Tender.created_at.desc()).offset(offset).limit(limit).all()
    
    def get_tender(self, tender_id: UUID) -> Optional[Tender]:
        """Get a tender by ID (tenant-scoped)."""
        return self.db.query(Tender).filter(
            Tender.id == tender_id,
            Tender.tenant_id == self.tenant_id,
        ).first()
    
    def get_tender_or_404(self, tender_id: UUID) -> Tender:
        """Get tender or raise 404."""
        tender = self.get_tender(tender_id)
        if not tender:
            from fastapi import HTTPException, status
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Tender {tender_id} not found",
            )
        return tender
    
    def create_tender(
        self,
        name: str,
        client_name: Optional[str] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        target_capacity_kw: Optional[float] = None,
    ) -> Tender:
        """Create a new tender."""
        tender = Tender(
            tenant_id=self.tenant_id,
            created_by=self.user_id,
            name=name,
            client_name=client_name,
            latitude=latitude,
            longitude=longitude,
            target_capacity_kw=target_capacity_kw,
            status=TenderStatus.DRAFT,
        )
        self.db.add(tender)
        self.db.flush()
        
        # Create default precondition record
        precondition = Precondition(
            tender_id=tender.id,
            grid_connection=False,
            land_access=False,
            permits_cleared=False,
            financing_confirmed=False,
            go_decision=False,
        )
        self.db.add(precondition)
        
        # Audit log
        self.audit.log_create(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            entity_type="Tender",
            entity_id=tender.id,
            new_value={
                "name": name,
                "client_name": client_name,
                "target_capacity_kw": target_capacity_kw,
                "status": "draft",
            },
        )
        
        return tender
    
    def update_tender(
        self,
        tender: Tender,
        name: Optional[str] = None,
        client_name: Optional[str] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        target_capacity_kw: Optional[float] = None,
        status: Optional[TenderStatus] = None,
    ) -> Tender:
        """Update tender fields."""
        old_values = {}
        new_values = {}
        
        if name is not None and name != tender.name:
            old_values["name"] = tender.name
            new_values["name"] = name
            tender.name = name
        
        if client_name is not None and client_name != tender.client_name:
            old_values["client_name"] = tender.client_name
            new_values["client_name"] = client_name
            tender.client_name = client_name
        
        if latitude is not None and latitude != tender.latitude:
            old_values["latitude"] = tender.latitude
            new_values["latitude"] = latitude
            tender.latitude = latitude
        
        if longitude is not None and longitude != tender.longitude:
            old_values["longitude"] = tender.longitude
            new_values["longitude"] = longitude
            tender.longitude = longitude
        
        if target_capacity_kw is not None and target_capacity_kw != tender.target_capacity_kw:
            old_values["target_capacity_kw"] = tender.target_capacity_kw
            new_values["target_capacity_kw"] = target_capacity_kw
            tender.target_capacity_kw = target_capacity_kw
        
        if status is not None and status != tender.status:
            # Validate status transition
            self._validate_status_transition(tender.status, status)
            old_values["status"] = tender.status.value
            new_values["status"] = status.value
            tender.status = status
        
        if new_values:
            self.audit.log_update(
                tenant_id=self.tenant_id,
                user_id=self.user_id,
                entity_type="Tender",
                entity_id=tender.id,
                old_value=old_values,
                new_value=new_values,
            )
        
        return tender
    
    def _validate_status_transition(
        self,
        current: TenderStatus,
        new: TenderStatus,
    ) -> None:
        """Validate status transition is allowed."""
        # Define allowed transitions
        allowed = {
            TenderStatus.DRAFT: [TenderStatus.IN_REVIEW],
            TenderStatus.IN_REVIEW: [TenderStatus.DRAFT, TenderStatus.SUBMITTED],
            TenderStatus.SUBMITTED: [TenderStatus.WON, TenderStatus.LOST],
            TenderStatus.WON: [],
            TenderStatus.LOST: [],
        }
        
        if new not in allowed.get(current, []):
            from fastapi import HTTPException, status
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot transition from {current.value} to {new.value}",
            )
    
    def delete_tender(self, tender: Tender) -> None:
        """Delete a tender (only drafts can be deleted)."""
        if tender.status != TenderStatus.DRAFT:
            from fastapi import HTTPException, status
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only draft tenders can be deleted",
            )
        
        self.audit.log_delete(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            entity_type="Tender",
            entity_id=tender.id,
            old_value={"name": tender.name, "status": tender.status.value},
        )
        
        # Delete precondition first
        if tender.precondition:
            self.db.delete(tender.precondition)
        
        self.db.delete(tender)


def get_tender_service(
    db: Session,
    tenant_id: UUID,
    user_id: UUID,
) -> TenderService:
    """Factory function for tender service."""
    return TenderService(db, tenant_id, user_id)
