"""
Audit logging service for tracking all data mutations.
"""
import json
from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.models import AuditLog


class AuditService:
    """Service for creating audit log entries."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def log(
        self,
        tenant_id: UUID,
        user_id: UUID,
        entity_type: str,
        entity_id: UUID,
        action: str,
        old_value: Optional[dict] = None,
        new_value: Optional[dict] = None,
    ) -> AuditLog:
        """
        Create an audit log entry.
        
        Args:
            tenant_id: Tenant this action belongs to
            user_id: User who performed the action
            entity_type: Type of entity (e.g., 'Tender', 'PVDesign')
            entity_id: ID of the affected entity
            action: Action performed ('create', 'update', 'delete')
            old_value: Previous state (for updates/deletes)
            new_value: New state (for creates/updates)
        """
        log_entry = AuditLog(
            tenant_id=tenant_id,
            user_id=user_id,
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            old_value=old_value,
            new_value=new_value,
        )
        self.db.add(log_entry)
        return log_entry
    
    def log_create(
        self,
        tenant_id: UUID,
        user_id: UUID,
        entity_type: str,
        entity_id: UUID,
        new_value: dict,
    ) -> AuditLog:
        """Log a create action."""
        return self.log(
            tenant_id=tenant_id,
            user_id=user_id,
            entity_type=entity_type,
            entity_id=entity_id,
            action="create",
            new_value=new_value,
        )
    
    def log_update(
        self,
        tenant_id: UUID,
        user_id: UUID,
        entity_type: str,
        entity_id: UUID,
        old_value: dict,
        new_value: dict,
    ) -> AuditLog:
        """Log an update action."""
        return self.log(
            tenant_id=tenant_id,
            user_id=user_id,
            entity_type=entity_type,
            entity_id=entity_id,
            action="update",
            old_value=old_value,
            new_value=new_value,
        )
    
    def log_delete(
        self,
        tenant_id: UUID,
        user_id: UUID,
        entity_type: str,
        entity_id: UUID,
        old_value: dict,
    ) -> AuditLog:
        """Log a delete action."""
        return self.log(
            tenant_id=tenant_id,
            user_id=user_id,
            entity_type=entity_type,
            entity_id=entity_id,
            action="delete",
            old_value=old_value,
        )


def get_audit_service(db: Session) -> AuditService:
    """Dependency to get audit service."""
    return AuditService(db)
