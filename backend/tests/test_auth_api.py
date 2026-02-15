
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from uuid import uuid4
from app.models.models import User, Tenant, UserRole

@pytest.fixture
def mock_verify_token():
    with patch("app.core.security.verify_firebase_token") as mock:
        yield mock

def test_signup_success(client: TestClient, db_session, mock_verify_token):
    mock_verify_token.return_value = {"uid": "new_firebase_uid"}
    
    payload = {
        "firebase_token": "valid_token",
        "email": "signup@example.com",
        "name": "Signup User",
        "tenant_name": "My New Tenant"
    }
    
    response = client.post("/auth/signup", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["user"]["email"] == "signup@example.com"
    assert data["tenant"]["name"] == "My New Tenant"

def test_signup_duplicate_user(client: TestClient, db_session, mock_verify_token):
    # Setup existing user
    tenant = Tenant(name="Existing Tenant")
    db_session.add(tenant)
    db_session.flush()
    user = User(tenant_id=tenant.id, firebase_uid="existing_uid", email="existing@example.com", name="Existing")
    db_session.add(user)
    db_session.commit()
    
    # Try to signup with same email
    mock_verify_token.return_value = {"uid": "another_uid"}
    payload = {
        "firebase_token": "token",
        "email": "existing@example.com", # Duplicate
        "name": "Signup User",
        "tenant_name": "New Tenant"
    }
    
    response = client.post("/auth/signup", json=payload)
    assert response.status_code == 400
    assert "User with this email already exists" in response.text

def test_login_success(client: TestClient, db_session, mock_verify_token):
    # Setup user
    tenant = Tenant(name="Login Tenant")
    db_session.add(tenant)
    db_session.flush()
    user = User(
        tenant_id=tenant.id, 
        firebase_uid="login_uid", 
        email="login@example.com", 
        name="Login User",
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    
    mock_verify_token.return_value = {"uid": "login_uid"}
    
    response = client.post("/auth/login", json={"firebase_token": "valid_token"})
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "login@example.com"

def test_login_invalid_token(client: TestClient, mock_verify_token):
    from fastapi import HTTPException, status
    mock_verify_token.side_effect = HTTPException(status_code=401, detail="Invalid token")
    
    response = client.post("/auth/login", json={"firebase_token": "invalid_token"})
    assert response.status_code == 401

def test_login_inactive_user(client: TestClient, db_session, mock_verify_token):
    # Setup inactive user
    tenant = Tenant(name="Inactive Tenant")
    db_session.add(tenant)
    db_session.flush()
    user = User(
        tenant_id=tenant.id, 
        firebase_uid="inactive_uid", 
        email="inactive@example.com", 
        name="Inactive User",
        is_active=False
    )
    db_session.add(user)
    db_session.commit()
    
    mock_verify_token.return_value = {"uid": "inactive_uid"}
    
    response = client.post("/auth/login", json={"firebase_token": "valid_token"})
    assert response.status_code == 403
    assert "deactivated" in response.text

def test_get_current_user(client: TestClient, db_session, mock_verify_token):
    # Setup user
    tenant = Tenant(name="Me Tenant")
    db_session.add(tenant)
    db_session.flush()
    user = User(
        tenant_id=tenant.id, 
        firebase_uid="me_uid", 
        email="me@example.com", 
        name="Me User",
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    
    mock_verify_token.return_value = {"uid": "me_uid"}
    
    # Needs Authorization header
    response = client.get("/auth/me", headers={"Authorization": "Bearer valid_token"})
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "me@example.com"

def test_unauthorized_access(client: TestClient):
    response = client.get("/auth/me") # No header
    assert response.status_code == 401
