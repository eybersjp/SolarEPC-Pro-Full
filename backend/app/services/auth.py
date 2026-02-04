"""
Authentication service for user management.
"""
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models import User, Tenant, UserRole
from app.services.audit import AuditService


class AuthService:
    """Service for authentication and user management."""
    
    def __init__(self, db: Session):
        self.db = db
        self.audit = AuditService(db)
    
    def get_user_by_firebase_uid(self, firebase_uid: str) -> Optional[User]:
        """Look up user by Firebase UID."""
        return self.db.query(User).filter(User.firebase_uid == firebase_uid).first()
    
    def get_user_by_email(self, email: str) -> Optional[User]:
        """Look up user by email."""
        return self.db.query(User).filter(User.email == email).first()
    
    def create_user(
        self,
        firebase_uid: str,
        email: str,
        name: str,
        tenant_id: UUID,
        role: UserRole = UserRole.VIEWER,
    ) -> User:
        """
        Create a new user.
        
        Args:
            firebase_uid: Firebase authentication UID
            email: User email
            name: User display name
            tenant_id: Tenant the user belongs to
            role: User role (default: VIEWER)
        
        Returns:
            Created User object
        """
        user = User(
            firebase_uid=firebase_uid,
            email=email,
            name=name,
            tenant_id=tenant_id,
            role=role,
            is_active=True,
        )
        self.db.add(user)
        self.db.flush()  # Get the ID without committing
        
        # Log the creation (use system user for self-registration)
        self.audit.log_create(
            tenant_id=tenant_id,
            user_id=user.id,
            entity_type="User",
            entity_id=user.id,
            new_value={
                "email": email,
                "name": name,
                "role": role.value,
            },
        )
        
        return user
    
    def create_tenant_with_admin(
        self,
        tenant_name: str,
        firebase_uid: str,
        admin_email: str,
        admin_name: str,
    ) -> tuple[Tenant, User]:
        """
        Create a new tenant with an admin user.
        
        Used for initial signup flow.
        """
        # Create tenant
        tenant = Tenant(name=tenant_name)
        self.db.add(tenant)
        self.db.flush()
        
        # Create admin user
        admin = self.create_user(
            firebase_uid=firebase_uid,
            email=admin_email,
            name=admin_name,
            tenant_id=tenant.id,
            role=UserRole.ADMIN,
        )
        
        return tenant, admin
    
    def update_user_role(
        self,
        user: User,
        new_role: UserRole,
        updated_by: User,
    ) -> User:
        """Update a user's role."""
        old_role = user.role
        user.role = new_role
        
        self.audit.log_update(
            tenant_id=user.tenant_id,
            user_id=updated_by.id,
            entity_type="User",
            entity_id=user.id,
            old_value={"role": old_role.value},
            new_value={"role": new_role.value},
        )
        
        return user
    
    def deactivate_user(self, user: User, deactivated_by: User) -> User:
        """Deactivate a user account."""
        user.is_active = False
        
        self.audit.log_update(
            tenant_id=user.tenant_id,
            user_id=deactivated_by.id,
            entity_type="User",
            entity_id=user.id,
            old_value={"is_active": True},
            new_value={"is_active": False},
        )
        
        return user


def get_auth_service(db: Session) -> AuthService:
    """Dependency to get auth service."""
    return AuthService(db)
