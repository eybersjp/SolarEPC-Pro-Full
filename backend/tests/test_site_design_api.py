import pytest
from uuid import uuid4
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.database import get_db
from app.core.security import get_current_user, CurrentUser
from app.models.models import Base, Tenant, User, Tender, EquipmentModule, EquipmentInverter, UserRole
from app.api import site_designs

# In-memory DB for API tests
SQLALCHEMY_DATABASE_URL = "sqlite://"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

# Mock user
TEST_TENANT_ID = uuid4()
TEST_USER_ID = uuid4()
TEST_USER_EMAIL = "test@example.com"

def override_get_current_user():
    # Mock the SQLAlchemy User object required by CurrentUser
    class MockUser:
        id = TEST_USER_ID
        email = TEST_USER_EMAIL
        role = UserRole.ADMIN # Using Enum as test file imports it
        is_active = True
        firebase_uid = "uid"
        
    return CurrentUser(
        user=MockUser(),
        tenant_id=str(TEST_TENANT_ID)
    )

@pytest.fixture
def test_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    yield db
    db.close()
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def client(test_db):
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    with TestClient(app) as c:
        yield c
    app.dependency_overrides = {}

def test_create_and_get_site_design(test_db, client):
    # Setup Data
    module = EquipmentModule(manufacturer="Test", model="Mod", wattage=300, efficiency=20, length_m=1, width_m=1, thickness_m=0.1, voc=30, isc=10, vmp=25, imp=9, is_global=True, is_active=True)
    inverter = EquipmentInverter(manufacturer="Test", model="Inv", capacity_kw=100, max_dc_voltage=1000, mppt_voltage_range_min=200, mppt_voltage_range_max=800, max_input_current=20, num_mppt_channels=2, is_global=True, is_active=True)
    test_db.add(module)
    test_db.add(inverter)
    test_db.commit()
    
    tender = Tender(tenant_id=TEST_TENANT_ID, created_by=TEST_USER_ID, name="Test Tender")
    test_db.add(tender)
    test_db.commit()
    
    # Test Create
    payload = {
        "name": "API Design",
        "site_type": "ground_mount",
        "equipment_module_id": str(module.id),
        "equipment_inverter_id": str(inverter.id),
        "site_boundary": {
            "type": "Polygon",
            "coordinates": [[[0,0], [0.001,0], [0.001,0.001], [0,0.001], [0,0]]]
        },
        "placement_settings": {
            "row_spacing_m": 4.0
        }
    }
    
    response = client.post(f"/api/tenders/{tender.id}/site-designs", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "API Design"
    design_id = data["id"]
    
    # Test Get
    response = client.get(f"/api/site-designs/{design_id}")
    assert response.status_code == 200
    assert response.json()["id"] == design_id

def test_get_designs_list(test_db, client):
    tender = Tender(tenant_id=TEST_TENANT_ID, created_by=TEST_USER_ID, name="List Tender")
    test_db.add(tender)
    test_db.commit()
    
    response = client.get(f"/api/tenders/{tender.id}/site-designs")
    assert response.status_code == 200
    assert response.json() == []

def test_validation_error(test_db, client):
    tender = Tender(tenant_id=TEST_TENANT_ID, created_by=TEST_USER_ID, name="Validation Tender")
    test_db.add(tender)
    test_db.commit()
    
    # Invalid GeoJSON (not closed)
    payload = {
        "name": "Invalid",
        "site_type": "ground_mount",
        "equipment_module_id": str(uuid4()), # Non-existent too
        "equipment_inverter_id": str(uuid4()),
        "site_boundary": {
            "type": "Polygon",
            "coordinates": [[[0,0], [1,0], [0,1]]]
        }
    }
    response = client.post(f"/api/tenders/{tender.id}/site-designs", json=payload)
    assert response.status_code == 400

