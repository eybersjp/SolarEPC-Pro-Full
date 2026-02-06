import pytest
import time
from uuid import UUID, uuid4
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from datetime import datetime, timezone

from app.main import app
from app.core.database import get_db
from app.core.security import get_current_user, CurrentUser
from app.models.models import (
    Base, SiteDesign, Tender, User, Tenant, EnergyEstimate, 
    FinancialAnalysis, UserRole, BOQItem, EquipmentModule, EquipmentInverter
)

# In-memory DB for integration testing
SQLALCHEMY_DATABASE_URL = "sqlite://"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
# Use expire_on_commit=False to avoid DetachedInstanceError in tests
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, expire_on_commit=False)

# Global test IDs
TEST_TENANT_A_ID = uuid4()
TEST_USER_A_ID = uuid4()
TEST_USER_C_ID = uuid4() # Same tenant as A
TEST_TENANT_B_ID = uuid4()
TEST_USER_B_ID = uuid4()

# Context for which user is "current"
current_user_context = {"user_id": TEST_USER_A_ID, "tenant_id": TEST_TENANT_A_ID}

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

def override_get_current_user():
    _uid = current_user_context["user_id"]
    _tid = current_user_context["tenant_id"]
    
    class MockUser:
        id = _uid
        email = "test@example.com"
        tenant_id = _tid
        role = UserRole.ADMIN
        permission_level = 10
        
    return CurrentUser(
        user=MockUser(),
        tenant_id=str(_tid)
    )

app.dependency_overrides[get_db] = override_get_db
app.dependency_overrides[get_current_user] = override_get_current_user

client = TestClient(app)

def calculate_expected(cost: float, energy: float) -> dict:
    """Helper to calculate expected financial values."""
    electricity_rate = 0.12
    lifespan_years = 25
    
    annual_savings = round(energy * electricity_rate, 2)
    payback = round(cost / annual_savings, 2) if annual_savings > 0 else 0.0
    roi = round(((annual_savings * lifespan_years) - cost) / cost * 100, 2) if cost > 0 else 0.0
    
    return {
        "system_cost_usd": cost,
        "annual_savings_usd": annual_savings,
        "simple_payback_years": payback,
        "roi_pct": roi
    }

@pytest.fixture(autouse=True)
def setup_db():
    """Wipe and recreate schema for every test."""
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    # Create Tenant and Users for A
    tenant_a = Tenant(id=TEST_TENANT_A_ID, name="Tenant A")
    user_a = User(id=TEST_USER_A_ID, tenant_id=TEST_TENANT_A_ID, email="a@test.com", firebase_uid="uid_a")
    user_c = User(id=TEST_USER_C_ID, tenant_id=TEST_TENANT_A_ID, email="c@test.com", firebase_uid="uid_c")
    
    # Create Tenant and User B
    tenant_b = Tenant(id=TEST_TENANT_B_ID, name="Tenant B")
    user_b = User(id=TEST_USER_B_ID, tenant_id=TEST_TENANT_B_ID, email="b@test.com", firebase_uid="uid_b")
    
    db.add_all([tenant_a, user_a, user_c, tenant_b, user_b])
    db.commit()
    
    db.close()
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def test_data(setup_db):
    """Fixture to create standard test data: tender, equipment, site design, BOQ, energy."""
    db = TestingSessionLocal()
    
    # Reset context to User A
    current_user_context["user_id"] = TEST_USER_A_ID
    current_user_context["tenant_id"] = TEST_TENANT_A_ID
    
    # 1. Tender
    tender = Tender(id=uuid4(), tenant_id=TEST_TENANT_A_ID, created_by=TEST_USER_A_ID, name="Integration Tender")
    db.add(tender)
    
    # 2. Equipment
    mod = EquipmentModule(
        id=uuid4(), manufacturer="SunPower", model="X21", wattage=345, efficiency=21.5,
        length_m=1.5, width_m=1.0, thickness_m=0.04, voc=40.0, isc=10.0, vmp=35.0, imp=9.5,
        is_global=True, is_active=True
    )
    inv = EquipmentInverter(
        id=uuid4(), manufacturer="SMA", model="SunnyBoy", capacity_kw=5.0,
        max_dc_voltage=600, mppt_voltage_range_min=100, mppt_voltage_range_max=500,
        max_input_current=15, num_mppt_channels=2, is_global=True, is_active=True
    )
    db.add_all([mod, inv])
    
    # 3. Site Design
    design = SiteDesign(
        id=uuid4(), tender_id=tender.id, name="Test Design", site_type="rooftop",
        created_by=TEST_USER_A_ID, site_boundary={"type": "Polygon", "coordinates": [[[0,0], [10,0], [10,10], [0,10], [0,0]]]},
        equipment_module_id=mod.id, equipment_inverter_id=inv.id, tilt_deg=20
    )
    db.add(design)
    
    # 4. BOQ Items (Total = 10,000 + 10% margin = 11,000)
    boq = BOQItem(
        tender_id=tender.id, category="Panels", description="PV Panels",
        unit_cost=1000.0, quantity=10, margin_pct=10.0, line_total=11000.0
    )
    db.add(boq)
    
    # 5. Energy Estimate (10,000 kWh/year)
    est = EnergyEstimate(
        site_design_id=design.id, parameter_hash="xyz", system_capacity_kw=3.45,
        latitude=34.0, longitude=-118.0, azimuth=180, tilt=20,
        annual_energy_kwh=10000.0, monthly_energy_kwh={}, capacity_factor=33.1,
        status="completed"
    )
    db.add(est)
    
    db.commit()
    
    data = {
        "tender_id": tender.id,
        "design_id": design.id,
        "boq_id": boq.id,
        "energy_id": est.id,
        "mod_id": mod.id,
        "inv_id": inv.id
    }
    db.close()
    return data

class TestFinancialAPIHappyPath:
    def test_get_financial_analysis_automatic_creation(self, test_data):
        design_id = test_data["design_id"]
        response = client.get(f"/api/site-designs/{design_id}/financial-analysis")
        assert response.status_code == 200
        data = response.json()
        expected = calculate_expected(11000.0, 10000.0)
        assert data["system_cost_usd"] == expected["system_cost_usd"]

    def test_financial_analysis_response_shape(self, test_data):
        design_id = test_data["design_id"]
        response = client.get(f"/api/site-designs/{design_id}/financial-analysis")
        data = response.json()
        assert "id" in data
        assert "site_design_id" in data

class TestFinancialRecalculation:
    def test_recalculation_after_energy_estimate_update(self, test_data):
        design_id = test_data["design_id"]
        client.get(f"/api/site-designs/{design_id}/financial-analysis")
        
        db = TestingSessionLocal()
        energy = db.query(EnergyEstimate).filter(EnergyEstimate.site_design_id == design_id).first()
        energy.annual_energy_kwh = 20000.0
        db.commit()
        
        from app.services.financial_analysis import FinancialAnalysisService
        svc = FinancialAnalysisService(db, TEST_TENANT_A_ID, TEST_USER_A_ID)
        svc.calculate_financials(design_id)
        db.close()
        
        data = client.get(f"/api/site-designs/{design_id}/financial-analysis").json()
        assert data["annual_savings_usd"] == 2400.0

    def test_recalculation_after_boq_update(self, test_data):
        design_id = test_data["design_id"]
        boq_id = test_data["boq_id"]
        client.get(f"/api/site-designs/{design_id}/financial-analysis")
        
        db = TestingSessionLocal()
        from app.services.boq import BOQService
        boq_service = BOQService(db, TEST_TENANT_A_ID, TEST_USER_A_ID)
        item = boq_service.get_item(boq_id)
        boq_service.update_item(item, unit_cost=2000.0)
        db.commit()
        db.close()
        
        data = client.get(f"/api/site-designs/{design_id}/financial-analysis").json()
        assert data["system_cost_usd"] == 22000.0

    def test_recalculation_after_boq_add_delete(self, test_data):
        design_id = test_data["design_id"]
        tender_id = test_data["tender_id"]
        client.get(f"/api/site-designs/{design_id}/financial-analysis")
        
        db = TestingSessionLocal()
        from app.services.boq import BOQService
        boq_service = BOQService(db, TEST_TENANT_A_ID, TEST_USER_A_ID)
        boq_service.create_item(tender_id, "Inverters", "String Inverter", 5000.0, 1, 0.0)
        db.commit()
        
        data = client.get(f"/api/site-designs/{design_id}/financial-analysis").json()
        assert data["system_cost_usd"] == 16000.0
        
        item = db.query(BOQItem).filter(BOQItem.id == test_data["boq_id"]).first()
        boq_service.delete_item(item)
        db.commit()
        db.close()
        
        data = client.get(f"/api/site-designs/{design_id}/financial-analysis").json()
        assert data["system_cost_usd"] == 5000.0

class TestFinancialAccessControl:
    def test_cross_tenant_isolation(self, test_data):
        design_id = test_data["design_id"]
        current_user_context["user_id"] = TEST_USER_B_ID
        current_user_context["tenant_id"] = TEST_TENANT_B_ID
        response = client.get(f"/api/site-designs/{design_id}/financial-analysis")
        assert response.status_code == 404

    def test_same_tenant_different_user(self, test_data):
        design_id = test_data["design_id"]
        current_user_context["user_id"] = TEST_USER_C_ID
        current_user_context["tenant_id"] = TEST_TENANT_A_ID
        response = client.get(f"/api/site-designs/{design_id}/financial-analysis")
        assert response.status_code == 200

class TestFinancialEdgeCases:
    def test_edge_case_no_energy(self, test_data):
        design_id = test_data["design_id"]
        db = TestingSessionLocal()
        db.query(EnergyEstimate).filter(EnergyEstimate.site_design_id == design_id).delete()
        db.commit()
        db.close()
        data = client.get(f"/api/site-designs/{design_id}/financial-analysis").json()
        assert data["annual_savings_usd"] == 0.0

    def test_edge_case_empty_boq(self, test_data):
        design_id = test_data["design_id"]
        tender_id = test_data["tender_id"]
        db = TestingSessionLocal()
        db.query(BOQItem).filter(BOQItem.tender_id == tender_id).delete()
        db.commit()
        db.close()
        data = client.get(f"/api/site-designs/{design_id}/financial-analysis").json()
        assert data["system_cost_usd"] == 0.0

    def test_edge_case_failed_energy(self, test_data):
        design_id = test_data["design_id"]
        db = TestingSessionLocal()
        est = db.query(EnergyEstimate).filter(EnergyEstimate.site_design_id == design_id).first()
        est.status = "failed"
        db.commit()
        db.close()
        data = client.get(f"/api/site-designs/{design_id}/financial-analysis").json()
        assert data["annual_savings_usd"] == 0.0

    def test_idempotency(self, test_data):
        design_id = test_data["design_id"]
        id1 = client.get(f"/api/site-designs/{design_id}/financial-analysis").json()["id"]
        id2 = client.get(f"/api/site-designs/{design_id}/financial-analysis").json()["id"]
        assert id1 == id2

class TestFinancialEndToEnd:
    def test_full_api_flow(self, setup_db):
        current_user_context["user_id"] = TEST_USER_A_ID
        current_user_context["tenant_id"] = TEST_TENANT_A_ID
        
        tr = client.post("/tenders", json={"name": "E2E"})
        tender_id = tr.json()["id"]
        
        db = TestingSessionLocal()
        mod = EquipmentModule(manufacturer="M", model="M", wattage=400, efficiency=20, length_m=2, width_m=1, thickness_m=0.04, voc=40, isc=10, vmp=35, imp=9, is_global=True, is_active=True)
        inv = EquipmentInverter(manufacturer="I", model="I", capacity_kw=10, max_dc_voltage=1000, mppt_voltage_range_min=200, mppt_voltage_range_max=800, max_input_current=20, num_mppt_channels=2, is_global=True, is_active=True)
        db.add_all([mod, inv])
        db.commit()
        mid, iid = mod.id, inv.id
        db.close()
        
        dr = client.post(f"/api/tenders/{tender_id}/site-designs", json={
            "name": "D", "site_type": "rooftop", "equipment_module_id": str(mid), "equipment_inverter_id": str(iid),
            "site_boundary": {"type": "Polygon", "coordinates": [[[0,0], [10,0], [10,10], [0,10], [0,0]]]},
            "placement_settings": {"tilt_deg": 20}
        })
        assert dr.status_code == 201
        design_id = dr.json()["id"]
        
        # Setup Energy BEFORE BOQ so recalc trigger sees it
        db = TestingSessionLocal()
        db.add(EnergyEstimate(
            site_design_id=UUID(design_id), parameter_hash="h",
            system_capacity_kw=1.0, latitude=0.0, longitude=0.0,
            azimuth=180.0, tilt=20.0,
            annual_energy_kwh=1000.0, monthly_energy_kwh={}, capacity_factor=11.4,
            status="completed"
        ))
        db.commit()
        db.close()
        
        # Add BOQ item (triggers recalc)
        client.post(f"/tenders/{tender_id}/boq", json={"category": "C", "description": "D", "unit_cost": 1000, "quantity": 1, "margin_pct": 0})
        
        data = client.get(f"/api/site-designs/{design_id}/financial-analysis").json()
        assert data["system_cost_usd"] == 1000.0
        assert data["annual_savings_usd"] == 120.0

    def test_complex_boq_multiple_items(self, setup_db, test_data):
        design_id = test_data["design_id"]
        tender_id = test_data["tender_id"]
        client.post(f"/tenders/{tender_id}/boq", json={"category": "C1", "description": "D1", "unit_cost": 5000, "quantity": 1, "margin_pct": 5})
        client.post(f"/tenders/{tender_id}/boq", json={"category": "C2", "description": "D2", "unit_cost": 2000, "quantity": 1, "margin_pct": 15})
        data = client.get(f"/api/site-designs/{design_id}/financial-analysis").json()
        assert data["system_cost_usd"] == 18550.0
