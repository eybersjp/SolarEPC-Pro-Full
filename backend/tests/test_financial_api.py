import pytest
from uuid import uuid4
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.database import get_db
from app.core.security import get_current_user, CurrentUser
from app.models.models import Base, SiteDesign, Tender, User, Tenant, EnergyEstimate, FinancialAnalysis, UserRole
from app.services.financial_analysis import FinancialAnalysisService

# In-memory DB
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
        
TEST_TENANT_ID = uuid4()
TEST_USER_ID = uuid4()

def override_get_current_user():
    class MockUser:
        id = TEST_USER_ID
        email = "test@example.com"
        tenant_id = TEST_TENANT_ID
        role = UserRole.ADMIN
        permission_level = 10
        
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
    
    # Setup Tenant/User
    tenant = Tenant(id=TEST_TENANT_ID, name="Test Tenant")
    user = User(id=TEST_USER_ID, tenant_id=TEST_TENANT_ID, email="test@example.com", firebase_uid="uid")
    db.add(tenant)
    db.add(user)
    
    yield db
    
    db.close()
    Base.metadata.drop_all(bind=engine)

def test_get_financial_analysis(test_db):
    # Setup Data
    tender = Tender(tenant_id=TEST_TENANT_ID, created_by=TEST_USER_ID, name="Fin Tender")
    test_db.add(tender)
    test_db.commit()
    
    # Needs BOQ Items for cost
    # We can mock BOQService inside the app dependency, OR just insert BOQ Items if logic uses DB.
    # The `FinancialAnalysisService` uses `BOQService`. `BOQService` queries `BOQItem`.
    # So we can just add BOQ Items to DB.
    from app.models.models import BOQItem
    boq_item = BOQItem(
        tender_id=tender.id,
        category="Test",
        description="Test Item",
        unit_cost=1000.0,
        quantity=10,
        margin_pct=10.0,
        line_total=11000.0 # 1000 * 10 * 1.1 = 11000
    )
    test_db.add(boq_item)
    
    # Design
    design = SiteDesign(
        tender_id=tender.id,
        name="Fin Design",
        site_type="rooftop",
        created_by=TEST_USER_ID,
        site_boundary={},
        # Equipment Foreign Keys need to be valid or nullable? 
        # Models say nullable=False usually. Let's make minimal valid.
        equipment_module_id=uuid4(), # We might need to insert these if validation is strict foreign key in SQLite
        equipment_inverter_id=uuid4(),
        tilt_deg=10
    )
    # Bypass FK? SQLite enforces if enabled. `StaticPool` might or might not. 
    # Usually easier to just add dummy equipment.
    
    from app.models.models import EquipmentModule, EquipmentInverter
    mod = EquipmentModule(id=design.equipment_module_id, manufacturer="A", model="B", wattage=100, efficiency=20, length_m=1, width_m=1, thickness_m=0.1, voc=1, isc=1, vmp=1, imp=1)
    inv = EquipmentInverter(id=design.equipment_inverter_id, manufacturer="A", model="B", capacity_kw=100, max_dc_voltage=100, mppt_voltage_range_min=1, mppt_voltage_range_max=100, max_input_current=1, num_mppt_channels=1)
    test_db.add(mod)
    test_db.add(inv)
    
    test_db.add(design)
    test_db.commit()
    
    # Energy Estimate
    est = EnergyEstimate(
        site_design_id=design.id,
        parameter_hash="hash",
        system_capacity_kw=10,
        latitude=0, longitude=0, azimuth=180, tilt=10,
        annual_energy_kwh=20000.0,
        monthly_energy_kwh={},
        capacity_factor=20.0,
        status="completed"
    )
    test_db.add(est)
    test_db.commit()

    # Call API
    response = client.get(f"/api/site-designs/{design.id}/financial-analysis")
    assert response.status_code == 200
    data = response.json()
    
    # Verify
    # Cost = 11,000
    # Energy = 20,000
    # Savings = 20,000 * 0.12 = 2,400
    # Payback = 11,000 / 2,400 = 4.58
    assert data["system_cost_usd"] == 11000.0
    assert data["annual_savings_usd"] == 2400.0
    assert data["simple_payback_years"] == 4.58

