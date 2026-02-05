"""
Tenant isolation middleware and utilities.
"""
from contextvars import ContextVar
from typing import Optional
from uuid import UUID

from sqlalchemy import event
from sqlalchemy.orm import Session, Query

from app.models import Tenant, User, Tender, Precondition, PVDesign, BOQItem, SiteDesign

# Context variable to hold current tenant ID
_current_tenant_id: ContextVar[Optional[UUID]] = ContextVar('current_tenant_id', default=None)


def set_current_tenant(tenant_id: UUID) -> None:
    """Set the current tenant ID for this request context."""
    _current_tenant_id.set(tenant_id)


def get_current_tenant() -> Optional[UUID]:
    """Get the current tenant ID from request context."""
    return _current_tenant_id.get()


def clear_current_tenant() -> None:
    """Clear the current tenant ID (call at end of request)."""
    _current_tenant_id.set(None)


# Models that require tenant filtering
TENANT_SCOPED_MODELS = {Tender, Precondition, PVDesign, BOQItem, User, SiteDesign}


def apply_tenant_filter(query: Query, model) -> Query:
    """
    Apply tenant filter to a query if the model is tenant-scoped.
    
    This is called automatically via SQLAlchemy event hooks.
    """
    tenant_id = get_current_tenant()
    
    if tenant_id is None:
        # No tenant context - this should only happen for system operations
        return query
    
    if model in TENANT_SCOPED_MODELS:
        if hasattr(model, 'tenant_id'):
            return query.filter(model.tenant_id == tenant_id)
    
    return query


class TenantAwareSession(Session):
    """
    Custom session that automatically applies tenant filtering.
    """
    
    def query(self, *entities, **kwargs):
        """Override query to apply tenant filter."""
        q = super().query(*entities, **kwargs)
        
        # Apply tenant filter to each entity
        for entity in entities:
            if hasattr(entity, '__table__'):
                q = apply_tenant_filter(q, entity)
        
        return q


def validate_tenant_access(db: Session, user_tenant_id: UUID, resource_tenant_id: UUID) -> bool:
    """
    Validate that user has access to a resource's tenant.
    
    Returns True if access is allowed, raises exception otherwise.
    """
    if user_tenant_id != resource_tenant_id:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: resource belongs to different tenant",
        )
    return True


def get_tenant_or_404(db: Session, tenant_id: UUID) -> Tenant:
    """Get tenant by ID or raise 404."""
    from fastapi import HTTPException, status
    
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tenant {tenant_id} not found",
        )
    return tenant
