import pytest
from uuid import uuid4
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base
from app.models.models import EquipmentModule, EquipmentInverter, Tenant
from app.services.equipment import EquipmentLibraryService

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
def tenant_id():
    return uuid4()

@pytest.fixture
def user_id():
    return uuid4()

def test_list_modules_tenant_isolation(db, tenant_id, user_id):
    # Setup
    other_tenant_id = uuid4()
    
    # Global module
    global_module = EquipmentModule(
        manufacturer="Global", model="Model G", wattage=400, efficiency=20.0,
        length_m=1.7, width_m=1.0, thickness_m=0.03,
        voc=40.0, isc=10.0, vmp=32.0, imp=9.0,
        is_global=True, is_active=True
    )
    # Tenant specific module
    tenant_module = EquipmentModule(
        manufacturer="Tenant", model="Model T", wattage=410, efficiency=21.0,
        length_m=1.7, width_m=1.0, thickness_m=0.03,
        voc=41.0, isc=11.0, vmp=33.0, imp=10.0,
        tenant_id=tenant_id, is_global=False, is_active=True
    )
    # Other tenant module
    other_module = EquipmentModule(
        manufacturer="Other", model="Model O", wattage=420, efficiency=22.0,
        length_m=1.7, width_m=1.0, thickness_m=0.03,
        voc=42.0, isc=12.0, vmp=34.0, imp=11.0,
        tenant_id=other_tenant_id, is_global=False, is_active=True
    )
    
    db.add_all([global_module, tenant_module, other_module])
    db.commit()
    
    service = EquipmentLibraryService(db, tenant_id, user_id)
    modules = service.list_modules()
    
    models = [m.model for m in modules]
    assert "Model G" in models
    assert "Model T" in models
    assert "Model O" not in models
    assert len(modules) == 2

def test_create_module(db, tenant_id, user_id):
    service = EquipmentLibraryService(db, tenant_id, user_id)
    module_data = {
        "manufacturer": "New",
        "model": "Model X",
        "wattage": 450,
        "efficiency": 23.0,
        "length_m": 1.8,
        "width_m": 1.1,
        "thickness_m": 0.035,
        "voc": 45.0,
        "isc": 13.0,
        "vmp": 35.0,
        "imp": 12.0
    }
    
    module = service.create_module(module_data)
    db.commit()
    
    assert module.id is not None
    assert module.tenant_id == tenant_id
    assert module.is_global is False
    assert module.model == "Model X"

def test_list_inverters_tenant_isolation(db, tenant_id, user_id):
    # Setup
    other_tenant_id = uuid4()
    
    # Global inverter
    global_inv = EquipmentInverter(
        manufacturer="Global", model="Inv G", capacity_kw=10.0,
        max_dc_voltage=1000.0, mppt_voltage_range_min=200.0, mppt_voltage_range_max=800.0,
        max_input_current=20.0, num_mppt_channels=2,
        is_global=True, is_active=True
    )
    # Tenant specific inverter
    tenant_inv = EquipmentInverter(
        manufacturer="Tenant", model="Inv T", capacity_kw=5.0,
        max_dc_voltage=600.0, mppt_voltage_range_min=100.0, mppt_voltage_range_max=500.0,
        max_input_current=15.0, num_mppt_channels=1,
        tenant_id=tenant_id, is_global=False, is_active=True
    )
    
    db.add_all([global_inv, tenant_inv])
    db.commit()
    
    service = EquipmentLibraryService(db, tenant_id, user_id)
    inverters = service.list_inverters()
    
    models = [i.model for i in inverters]
    assert "Inv G" in models
    assert "Inv T" in models
    assert len(inverters) == 2
