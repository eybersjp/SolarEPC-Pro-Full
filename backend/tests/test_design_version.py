import pytest
from uuid import uuid4
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.database import get_db
from app.core.security import get_current_user, CurrentUser
from app.models.models import Base, Tenant, User, Tender, EquipmentModule, EquipmentInverter, UserRole, SiteDesign
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
    class MockUser:
        id = TEST_USER_ID
        email = TEST_USER_EMAIL
        role = UserRole.ADMIN
        is_active = True
        firebase_uid = "uid"
        tenant_id = str(TEST_TENANT_ID)
        
    return CurrentUser(
        user=MockUser(),
        tenant_id=str(TEST_TENANT_ID)
    )

app.dependency_overrides[get_db] = override_get_db
app.dependency_overrides[get_current_user] = override_get_current_user

client = TestClient(app)

@pytest.fixture
def test_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    tenant = Tenant(id=TEST_TENANT_ID, name="Test Tenant")
    user = User(id=TEST_USER_ID, tenant_id=TEST_TENANT_ID, email=TEST_USER_EMAIL, role=UserRole.ADMIN, firebase_uid="uid")
    db.add(tenant)
    db.add(user)
    db.commit()
    
    yield db
    
    db.close()
    Base.metadata.drop_all(bind=engine)

def setup_site_design(db):
    module = EquipmentModule(manufacturer="Test", model="Mod", wattage=300, efficiency=20, length_m=1, width_m=1, thickness_m=0.1, voc=30, isc=10, vmp=25, imp=9, is_global=True, is_active=True)
    inverter = EquipmentInverter(manufacturer="Test", model="Inv", capacity_kw=100, max_dc_voltage=1000, mppt_voltage_range_min=200, mppt_voltage_range_max=800, max_input_current=20, num_mppt_channels=2, is_global=True, is_active=True)
    db.add(module)
    db.add(inverter)
    db.commit()

    tender = Tender(tenant_id=TEST_TENANT_ID, created_by=TEST_USER_ID, name="Test Tender")
    db.add(tender)
    db.commit()

    site_design = SiteDesign(
        tender_id=tender.id,
        name="Original Design",
        site_type="ground_mount",
        equipment_module_id=module.id,
        equipment_inverter_id=inverter.id,
        site_boundary={"type": "Polygon", "coordinates": [[[0,0], [1,0], [1,1], [0,1], [0,0]]]},
        
        # Placement Settings (Flattened)
        row_spacing_m=2.0,
        edge_setback_m=1.0,
        module_orientation="portrait",
        azimuth_deg=180.0,
        tilt_deg=10.0,
        
        created_by=TEST_USER_ID,
    )
    db.add(site_design)
    db.commit()
    db.refresh(site_design)
    return site_design

def test_create_and_list_version(test_db):
    site_design = setup_site_design(test_db)
    
    # Create Version
    payload = {
        "version_name": "V1",
        "notes": "Initial state"
    }
    response = client.post(f"/site-designs/{site_design.id}/versions", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["version_name"] == "V1"
    assert data["site_design_id"] == str(site_design.id)
    version_id = data["id"]
    
    # List Versions
    response = client.get(f"/site-designs/{site_design.id}/versions")
    assert response.status_code == 200
    versions = response.json()
    assert len(versions) == 1
    assert versions[0]["id"] == version_id

def test_restore_version(test_db):
    site_design = setup_site_design(test_db)
    original_id = site_design.id
    
    # Create Version V1
    client.post(f"/site-designs/{site_design.id}/versions", json={"version_name": "V1", "notes": "Baseline"})
    
    # List to get ID
    versions = client.get(f"/site-designs/{site_design.id}/versions").json()
    v1_id = versions[0]["id"]
    
    # Modify Site Design
    update_payload = {
        "placement_settings": {"row_spacing_m": 5.0}
    }
    client.put(f"/site-designs/{site_design.id}", json=update_payload)
    
    # Verify Change
    design = client.get(f"/site-designs/{site_design.id}").json()
    assert design["placement_settings"]["row_spacing_m"] == 5.0
    
    # Restore V1
    restore_response = client.post(f"/site-designs/{site_design.id}/restore/{v1_id}")
    assert restore_response.status_code == 200
    restored_data = restore_response.json()
    
    # Verify Restored State
    # Note: The response model for site design might present placement_settings differently depending on nesting
    # In schemas/site_design.py: 
    # class SiteDesignResponse(SiteDesignBase):
    #     placement_settings: PlacementSettings
    # And Base has placement_settings field.
    
    assert restored_data["placement_settings"]["row_spacing_m"] == 2.0
