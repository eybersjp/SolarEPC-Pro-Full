
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from uuid import uuid4
from app.models.models import Tender, User, Tenant, UserRole

@pytest.fixture
def mock_auth_headers(db_session):
    tenant = Tenant(name="API Test Tenant")
    db_session.add(tenant)
    db_session.flush()
    user = User(
        tenant_id=tenant.id,
        firebase_uid=f"api_user_{uuid4()}",
        email=f"api_{uuid4()}@example.com",
        name="API User",
        role=UserRole.PM, # PM can create tenders
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    
    with patch("app.core.security.verify_firebase_token") as mock:
        mock.return_value = {"uid": user.firebase_uid}
        yield {"Authorization": "Bearer mock_token"}, tenant, user

def test_create_tender_endpoint(client: TestClient, mock_auth_headers):
    headers, tenant, user = mock_auth_headers
    
    payload = {
        "name": "API Tender",
        "target_capacity_kw": 100,
        "latitude": 30.0,
        "longitude": -100.0,
        "client_name": "API Client"
    }
    
    response = client.post("/tenders/", json=payload, headers=headers)
    assert response.status_code == 200 # Or 201
    data = response.json()
    assert data["name"] == "API Tender"
    assert data["status"] == "draft"

def test_list_tenders_endpoint(client: TestClient, mock_auth_headers, db_session):
    headers, tenant, user = mock_auth_headers
    
    # Create a tender manually
    t = Tender(name="List Me", tenant_id=tenant.id, created_by=user.id)
    db_session.add(t)
    db_session.commit()
    
    response = client.get("/tenders/", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert any(item["name"] == "List Me" for item in data)

def test_get_tender_endpoint(client: TestClient, mock_auth_headers, db_session):
    headers, tenant, user = mock_auth_headers
    t = Tender(name="Get Me", tenant_id=tenant.id, created_by=user.id)
    db_session.add(t)
    db_session.commit()
    
    response = client.get(f"/tenders/{t.id}", headers=headers)
    assert response.status_code == 200
    assert response.json()["name"] == "Get Me"

def test_update_tender_endpoint(client: TestClient, mock_auth_headers, db_session):
    headers, tenant, user = mock_auth_headers
    t = Tender(name="Update Me", tenant_id=tenant.id, created_by=user.id)
    db_session.add(t)
    db_session.commit()
    
    payload = {"name": "Updated API"}
    response = client.put(f"/tenders/{t.id}", json=payload, headers=headers)
    assert response.status_code == 200
    assert response.json()["name"] == "Updated API"

def test_delete_tender_endpoint(client: TestClient, mock_auth_headers, db_session):
    headers, tenant, user = mock_auth_headers
    t = Tender(name="Delete Me", tenant_id=tenant.id, created_by=user.id, status="draft")
    db_session.add(t)
    db_session.commit()
    
    response = client.delete(f"/tenders/{t.id}", headers=headers)
    assert response.status_code == 200 # Or 204
    
    # Verify gone
    response = client.get(f"/tenders/{t.id}", headers=headers)
    assert response.status_code == 404

def test_create_tender_unauthorized(client: TestClient, db_session):
    # Viewer role
    tenant = Tenant(name="Viewer Tenant")
    db_session.add(tenant)
    db_session.flush()
    user = User(tenant_id=tenant.id, firebase_uid="viewer_uid", email="viewer@ex.com", role=UserRole.VIEWER, is_active=True)
    db_session.add(user)
    db_session.commit()
    
    with patch("app.core.security.verify_firebase_token") as mock:
        mock.return_value = {"uid": "viewer_uid"}
        
        payload = {"name": "Viewer Tender"}
        response = client.post("/tenders/", json=payload, headers={"Authorization": "Bearer token"})
        assert response.status_code == 403

def test_cross_tenant_access(client: TestClient, mock_auth_headers, db_session):
    headers, tenant, user = mock_auth_headers
    
    other_tenant = Tenant(name="Other")
    db_session.add(other_tenant)
    db_session.commit()
    other_tender = Tender(name="Other Tender", tenant_id=other_tenant.id, created_by=uuid4())
    db_session.add(other_tender)
    db_session.commit()
    
    # Try get
    response = client.get(f"/tenders/{other_tender.id}", headers=headers)
    assert response.status_code == 404 # Or 403, usually filtered out so 404
