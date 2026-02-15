
import pytest
from uuid import uuid4
from sqlalchemy.orm import Session
from app.services.auth import AuthService, get_auth_service
from app.models.models import User, Tenant, UserRole
from app.services.audit import AuditService

def test_get_user_by_firebase_uid(db_session: Session):
    service = AuthService(db_session)
    tenant = Tenant(name="Test Tenant")
    db_session.add(tenant)
    db_session.commit()
    
    user = User(
        tenant_id=tenant.id,
        firebase_uid="firebase_123",
        email="test@example.com",
        name="Test User",
        role=UserRole.VIEWER
    )
    db_session.add(user)
    db_session.commit()
    
    fetched = service.get_user_by_firebase_uid("firebase_123")
    assert fetched is not None
    assert fetched.id == user.id
    assert fetched.email == "test@example.com"
    
    missing = service.get_user_by_firebase_uid("nonexistent")
    assert missing is None

def test_get_user_by_email(db_session: Session):
    service = AuthService(db_session)
    tenant = Tenant(name="Test Tenant")
    db_session.add(tenant)
    db_session.flush()
    
    user = User(
        tenant_id=tenant.id,
        firebase_uid="firebase_456",
        email="email@example.com",
        name="Test User 2",
        role=UserRole.VIEWER
    )
    db_session.add(user)
    db_session.commit()
    
    fetched = service.get_user_by_email("email@example.com")
    assert fetched is not None
    assert fetched.id == user.id
    
    missing = service.get_user_by_email("wrong@example.com")
    assert missing is None

def test_create_user(db_session: Session):
    service = AuthService(db_session)
    tenant = Tenant(name="Test Tenant")
    db_session.add(tenant)
    db_session.commit()
    
    user = service.create_user(
        firebase_uid="new_uid",
        email="new@example.com",
        name="New User",
        tenant_id=tenant.id,
        role=UserRole.ENGINEER
    )
    
    assert user.id is not None
    assert user.email == "new@example.com"
    assert user.role == UserRole.ENGINEER
    
    # Verify persistence
    saved = db_session.query(User).filter(User.id == user.id).first()
    assert saved is not None

def test_create_tenant_with_admin(db_session: Session):
    service = AuthService(db_session)
    
    tenant, admin = service.create_tenant_with_admin(
        tenant_name="New Corp",
        firebase_uid="admin_uid",
        admin_email="admin@newcorp.com",
        admin_name="The Admin"
    )
    
    assert tenant.id is not None
    assert tenant.name == "New Corp"
    
    assert admin.id is not None
    assert admin.email == "admin@newcorp.com"
    assert admin.role == UserRole.ADMIN
    assert admin.tenant_id == tenant.id

def test_update_user_role(db_session: Session):
    service = AuthService(db_session)
    tenant, admin = service.create_tenant_with_admin("Corp", "uid1", "admin@corp.com", "Admin")
    
    user = service.create_user("uid2", "user@corp.com", "User", tenant.id, UserRole.VIEWER)
    db_session.commit()
    
    updated = service.update_user_role(user, UserRole.ENGINEER, updated_by=admin)
    assert updated.role == UserRole.ENGINEER
    
    db_session.refresh(user)
    assert user.role == UserRole.ENGINEER

def test_deactivate_user(db_session: Session):
    service = AuthService(db_session)
    tenant, admin = service.create_tenant_with_admin("Corp", "uid1", "admin@corp.com", "Admin")
    
    user = service.create_user("uid2", "user@corp.com", "User", tenant.id, UserRole.VIEWER)
    db_session.commit()
    
    deactivated = service.deactivate_user(user, deactivated_by=admin)
    assert deactivated.is_active is False
    
    db_session.refresh(user)
    assert user.is_active is False

def test_create_user_duplicate_email(db_session: Session):
    service = AuthService(db_session)
    tenant = Tenant(name="Test Tenant")
    db_session.add(tenant)
    db_session.commit()
    
    service.create_user("uid1", "dup@example.com", "User 1", tenant.id)
    db_session.commit()
    
    # SQLAlchemy IntegrityError should be raised upon commit usually, 
    # but create_user does flush.
    # Depending on DB setup (SQLite enforcement), this might raise IntegrityError.
    
    from sqlalchemy.exc import IntegrityError
    
    try:
        service.create_user("uid2", "dup@example.com", "User 2", tenant.id)
        db_session.commit()
        pytest.fail("Should have raised IntegrityError")
    except IntegrityError:
        db_session.rollback()

def test_create_user_invalid_tenant(db_session: Session):
    service = AuthService(db_session)
    
    # Use a random UUID that doesn't exist
    import uuid
    random_id = uuid.uuid4()
    
    from sqlalchemy.exc import IntegrityError

    try:
        service.create_user("uid1", "test@example.com", "User", random_id)
        db_session.commit()
        pytest.fail("Should have raised IntegrityError due to FK constraint")
    except IntegrityError:
        db_session.rollback()
