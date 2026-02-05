"""
Equipment library service for managing modules and inverters.
"""
from typing import Optional, List
from uuid import UUID

from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models import EquipmentModule, EquipmentInverter
from app.services.audit import AuditService


class EquipmentLibraryService:
    """Service for managing equipment library (modules and inverters)."""
    
    def __init__(self, db: Session, tenant_id: UUID, user_id: UUID):
        self.db = db
        self.tenant_id = tenant_id
        self.user_id = user_id
        self.audit = AuditService(db)
    
    # --- Modules ---
    
    def list_modules(self, search_query: Optional[str] = None) -> List[EquipmentModule]:
        """List global and tenant-specific modules."""
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
        
        return query.all()
    
    def get_module(self, module_id: UUID) -> Optional[EquipmentModule]:
        """Get a module by ID with tenant verification."""
        module = self.db.query(EquipmentModule).filter(
            EquipmentModule.id == module_id,
            or_(
                EquipmentModule.is_global == True,
                EquipmentModule.tenant_id == self.tenant_id
            )
        ).first()
        return module
    
    def create_module(self, module_data: dict) -> EquipmentModule:
        """Create a new tenant-specific module."""
        module = EquipmentModule(
            **module_data,
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
            new_value={
                "manufacturer": module.manufacturer,
                "model": module.model,
                "wattage": module.wattage
            }
        )
        
        return module

    # --- Inverters ---
    
    def list_inverters(self, search_query: Optional[str] = None) -> List[EquipmentInverter]:
        """List global and tenant-specific inverters."""
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
        
        return query.all()
    
    def get_inverter(self, inverter_id: UUID) -> Optional[EquipmentInverter]:
        """Get an inverter by ID with tenant verification."""
        inverter = self.db.query(EquipmentInverter).filter(
            EquipmentInverter.id == inverter_id,
            or_(
                EquipmentInverter.is_global == True,
                EquipmentInverter.tenant_id == self.tenant_id
            )
        ).first()
        return inverter
    
    def create_inverter(self, inverter_data: dict) -> EquipmentInverter:
        """Create a new tenant-specific inverter."""
        inverter = EquipmentInverter(
            **inverter_data,
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
            new_value={
                "manufacturer": inverter.manufacturer,
                "model": inverter.model,
                "capacity_kw": inverter.capacity_kw
            }
        )
        
        return inverter


def get_equipment_service(
    db: Session,
    tenant_id: UUID,
    user_id: UUID
) -> EquipmentLibraryService:
    """Factory function for equipment library service."""
    return EquipmentLibraryService(db, tenant_id, user_id)
