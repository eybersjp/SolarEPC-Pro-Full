import pytest
from uuid import uuid4
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base
from app.models.models import Tenant, User, Tender, EquipmentModule, EquipmentInverter, SiteDesign, TenderStatus, UserRole
from app.services.site_design import SiteDesignService
from app.services.tender import TenderService
from fastapi import HTTPException

# Create in-memory SQLite for testing
SQLALCHEMY_DATABASE_URL = "sqlite://"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture
def db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

@pytest.fixture
def test_data(db):
    """Create basic test data: Tenant, User, Equipment, Tender."""
    tenant_id = uuid4()
    user_id = uuid4()
    
    tenant = Tenant(id=tenant_id, name="Test Tenant")
    user = User(id=user_id, tenant_id=tenant_id, email="test@example.com", firebase_uid="test_uid", role=UserRole.ADMIN)
    
    db.add(tenant)
    db.add(user)
    db.commit()
    
    # Equipment
    module = EquipmentModule(
        tenant_id=tenant_id, manufacturer="Test", model="Mod 1", wattage=400, efficiency=20.0,
        length_m=1.0, width_m=1.0, thickness_m=0.1, voc=40, isc=10, vmp=32, imp=9, is_active=True
    )
    inverter = EquipmentInverter(
        tenant_id=tenant_id, manufacturer="Test", model="Inv 1", capacity_kw=100,
        max_dc_voltage=1000, mppt_voltage_range_min=200, mppt_voltage_range_max=800,
        max_input_current=20, num_mppt_channels=2, is_active=True
    )
    db.add(module)
    db.add(inverter)
    db.commit()
    
    # Tender
    tender = Tender(
        id=uuid4(), tenant_id=tenant_id, created_by=user_id, name="Test Tender", status=TenderStatus.DRAFT
    )
    db.add(tender)
    db.commit()
    
    return {
        "tenant_id": tenant_id,
        "user_id": user_id,
        "module_id": module.id,
        "inverter_id": inverter.id,
        "tender_id": tender.id
    }

def test_create_design_success(db, test_data):
    service = SiteDesignService(db, test_data["tenant_id"], test_data["user_id"])
    
    # Valid GeoJSON Polygon (Square 100x100m approx)
    # Coordinates in lat/lon. 0,0 to 0.001, 0.001 roughly.
    # 0.001 deg lat is ~111m.
    boundary = {
        "type": "Polygon",
        "coordinates": [[
            [0.0, 0.0],
            [0.001, 0.0],
            [0.001, 0.001],
            [0.0, 0.001],
            [0.0, 0.0]
        ]]
    }
    
    design = service.create_design(
        tender_id=test_data["tender_id"],
        name="Design 1",
        site_type="ground_mount",
        equipment_module_id=test_data["module_id"],
        equipment_inverter_id=test_data["inverter_id"],
        site_boundary=boundary,
        placement_settings={"row_spacing_m": 3.0}
    )
    
    assert design.id is not None
    assert design.name == "Design 1"
    assert design.site_area_sqm > 0
    assert design.row_spacing_m == 3.0
    assert design.tilt_deg == 20.0  # Default for ground_mount

def test_create_design_invalid_geojson(db, test_data):
    service = SiteDesignService(db, test_data["tenant_id"], test_data["user_id"])
    
    # Invalid: Not closed
    boundary = {
        "type": "Polygon",
        "coordinates": [[
            [0.0, 0.0],
            [0.001, 0.0],
            [0.0, 0.001]
        ]]
    }
    
    with pytest.raises(HTTPException) as exc:
        service.create_design(
            tender_id=test_data["tender_id"],
            name="Design Invalid",
            site_type="ground_mount",
            equipment_module_id=test_data["module_id"],
            equipment_inverter_id=test_data["inverter_id"],
            site_boundary=boundary,
            placement_settings={}
        )
    assert exc.value.status_code == 400
    assert "Invalid site boundary" in exc.value.detail

def test_update_geometry(db, test_data):
    service = SiteDesignService(db, test_data["tenant_id"], test_data["user_id"])
    
    boundary = {
        "type": "Polygon",
        "coordinates": [[[0,0], [0.001,0], [0.001,0.001], [0,0.001], [0,0]]]
    }
    
    design = service.create_design(
        tender_id=test_data["tender_id"],
        name="Update Test",
        site_type="rooftop",
        equipment_module_id=test_data["module_id"],
        equipment_inverter_id=test_data["inverter_id"],
        site_boundary=boundary,
        placement_settings={}
    )
    
    initial_area = design.site_area_sqm
    
    # Larger polygon
    new_boundary = {
        "type": "Polygon",
        "coordinates": [[[0,0], [0.002,0], [0.002,0.002], [0,0.002], [0,0]]]
    }
    
    updated = service.update_geometry(design, site_boundary=new_boundary)
    assert updated.site_area_sqm > initial_area

def test_tenant_isolation(db, test_data):
    # Try to access with different user/tenant
    other_tenant_id = uuid4()
    other_user_id = uuid4()
    
    service = SiteDesignService(db, other_tenant_id, other_user_id)
    
    # Try to access the tender (should fail)
    with pytest.raises(HTTPException) as exc:
        service.list_designs(test_data["tender_id"])
    assert exc.value.status_code == 404  # Not found because filtered out
