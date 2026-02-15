"""
Tenant service for managing organizations and users.
"""
from typing import List, Optional
from uuid import UUID

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Tenant, User, UserRole
from app.services.audit import AuditService


class TenantService:
    """Service for tenant management."""

    def __init__(self, db: Session):
        self.db = db
        self.audit = AuditService(db)

    def create_tenant(self, name: str, created_by: UUID) -> Tenant:
        """
        Create a new tenant.
        
        Args:
            name: Tenant name
            created_by: ID of the user creating the tenant (system admin)
        """
        tenant = Tenant(name=name)
        self.db.add(tenant)
        self.db.flush()

        # Log creation
        self.audit.log_create(
            tenant_id=tenant.id,
            user_id=created_by,
            entity_type="Tenant",
            entity_id=tenant.id,
            new_value={"name": name}
        )
        
        self.db.commit()
        self.db.refresh(tenant)
        return tenant

    def get_tenant(self, tenant_id: UUID) -> Optional[Tenant]:
        """Get tenant by ID."""
        return self.db.query(Tenant).filter(Tenant.id == tenant_id).first()

    def list_tenant_users(self, tenant_id: UUID) -> List[User]:
        """List all users in a tenant."""
        return self.db.query(User).filter(
            User.tenant_id == tenant_id,
            User.is_active == True
        ).all()

    def invite_user(
        self, 
        tenant_id: UUID, 
        email: str, 
        role: UserRole, 
        invited_by: UUID,
        name: str = ""
    ) -> User:
        """
        Invite a user to the tenant.
        
        Creates a user record with a pending status (or just active for now as per simple auth).
        """
        # Check if user already exists
        existing_user = self.db.query(User).filter(User.email == email).first()
        if existing_user:
            raise ValueError("User with this email already exists")

        # Create user (placeholder firebase_uid until they sign up, or maybe we generate one?)
        # For this implementation, we might simulate an invite flow or just create the user 
        # with a flag. The requirements say "Invite user", but the auth service creation 
        # requires a firebase_uid. 
        # Typically invites involve sending an email and letting the user sign up.
        # However, to strictly follow the plan "invite_user(...) -> User", we might need 
        # to create a User object.
        # Let's assume for now we create a user with a placeholder UID or handle it differently.
        # But wait, `create_user` in `auth.py` takes `firebase_uid`.
        # If we invite, we might not have a firebase_uid yet.
        # Let's assume we create a placeholder or this is for adding *existing* users?
        # No, "invite" implies new.
        # Let's check `User` model definition if possible, but I should trust the plan.
        # The plan says "invite_user... -> User".
        # I will implement it by creating a User with a temporary or null firebase_uid if allowed,
        # or maybe we interpret this as "pre-provisioning".
        # Actually, let's look at `auth.create_user`. It takes `firebase_uid`.
        # I'll generate a UUID for the firebase_uid placeholder for now to satisfy constraints,
        # or maybe the model allows nullable?
        # I'll generate a placeholder "invite:{uuid}" to identify them.
        
        import uuid
        placeholder_uid = f"invite:{uuid.uuid4()}"
        
        user = User(
            firebase_uid=placeholder_uid,
            email=email,
            name=name,
            tenant_id=tenant_id,
            role=role,
            is_active=True # Or False if we want them to activate
        )
        self.db.add(user)
        self.db.flush()

        self.audit.log_create(
            tenant_id=tenant_id,
            user_id=invited_by,
            entity_type="User",
            entity_id=user.id,
            new_value={
                "email": email,
                "role": role.value,
                "status": "invited"
            }
        )
        
        self.db.commit()
        self.db.refresh(user)
        return user


def get_tenant_service(db: Session = Depends(get_db)) -> TenantService:
    """Dependency to get tenant service."""
    return TenantService(db)
