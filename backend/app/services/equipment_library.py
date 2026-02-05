"""
Equipment library service for modules and inverters.
"""
from typing import Optional, List
from uuid import UUID

from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.models import EquipmentModule, EquipmentInverter
from app.services.audit import AuditService


class EquipmentLibraryService:
    """Service for managing PV modules and inverters with tenant isolation."""
    
    def __init__(self, db: Session, tenant_id: UUID, user_id: UUID):
        self.db = db
        self.tenant_id = tenant_id
        self.user_id = user_id
        self.audit = AuditService(db)

    # --- Module Methods ---
    
    def list_modules(
        self, 
        search_query: Optional[str] = None, 
        manufacturer: Optional[str] = None
    ) -> List[EquipmentModule]:
        """List accessible modules (global + tenant-specific)."""
        query = self.db.query(EquipmentModule).filter(
            or_(
                EquipmentModule.is_global == True,
                EquipmentModule.tenant_id == self.tenant_id
            ),
            EquipmentModule.is_active == True
        )
        
        if search_query:
            query = query.filter(
                or_(
                    EquipmentModule.manufacturer.ilike(f"%{search_query}%"),
                    EquipmentModule.model.ilike(f"%{search_query}%")
                )
            )
        
        if manufacturer:
            query = query.filter(EquipmentModule.manufacturer == manufacturer)
            
        return query.all()

    def get_module(self, module_id: UUID) -> Optional[EquipmentModule]:
        """Get module by ID with tenant verification."""
        return self.db.query(EquipmentModule).filter(
            EquipmentModule.id == module_id,
            or_(
                EquipmentModule.is_global == True,
                EquipmentModule.tenant_id == self.tenant_id
            )
        ).first()

    def get_module_or_404(self, module_id: UUID) -> EquipmentModule:
        """Get module or raise 404."""
        module = self.get_module(module_id)
        if not module:
            from fastapi import HTTPException, status
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Equipment Module {module_id} not found"
            )
        return module

    def create_module(self, data: dict) -> EquipmentModule:
        """Create tenant-specific module."""
        module = EquipmentModule(
            **data,
            tenant_id=self.tenant_id,
            is_global=False,
            is_active=True
        )
        self.db.add(module)
        self.db.flush()
        
        self.audit.log_create(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            entity_type="EquipmentModule",
            entity_id=module.id,
            new_value=data
        )
        return module

    # --- Inverter Methods ---

    def list_inverters(
        self, 
        search_query: Optional[str] = None, 
        manufacturer: Optional[str] = None
    ) -> List[EquipmentInverter]:
        """List accessible inverters (global + tenant-specific)."""
        query = self.db.query(EquipmentInverter).filter(
            or_(
                EquipmentInverter.is_global == True,
                EquipmentInverter.tenant_id == self.tenant_id
            ),
            EquipmentInverter.is_active == True
        )
        
        if search_query:
            query = query.filter(
                or_(
                    EquipmentInverter.manufacturer.ilike(f"%{search_query}%"),
                    EquipmentInverter.model.ilike(f"%{search_query}%")
                )
            )
        
        if manufacturer:
            query = query.filter(EquipmentInverter.manufacturer == manufacturer)
            
        return query.all()

    def get_inverter(self, inverter_id: UUID) -> Optional[EquipmentInverter]:
        """Get inverter by ID with tenant verification."""
        return self.db.query(EquipmentInverter).filter(
            EquipmentInverter.id == inverter_id,
            or_(
                EquipmentInverter.is_global == True,
                EquipmentInverter.tenant_id == self.tenant_id
            )
        ).first()

    def get_inverter_or_404(self, inverter_id: UUID) -> EquipmentInverter:
        """Get inverter or raise 404."""
        inverter = self.get_inverter(inverter_id)
        if not inverter:
            from fastapi import HTTPException, status
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Equipment Inverter {inverter_id} not found"
            )
        return inverter

    def create_inverter(self, data: dict) -> EquipmentInverter:
        """Create tenant-specific inverter."""
        inverter = EquipmentInverter(
            **data,
            tenant_id=self.tenant_id,
            is_global=False,
            is_active=True
        )
        self.db.add(inverter)
        self.db.flush()
        
        self.audit.log_create(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            entity_type="EquipmentInverter",
            entity_id=inverter.id,
            new_value=data
        )
        return inverter


def get_equipment_library_service(
    db: Session, 
    tenant_id: UUID, 
    user_id: UUID
) -> EquipmentLibraryService:
    """Factory function for equipment library service."""
    return EquipmentLibraryService(db, tenant_id, user_id)
