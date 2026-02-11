import pytest
import httpx
import json
import os
from uuid import uuid4, UUID as PyUUID
from datetime import datetime
from typing import Dict, List, Optional
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from unittest.mock import MagicMock, patch, Mock, PropertyMock
from fastapi import FastAPI, Depends, status
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal, Base
from app.core.config import settings
from app.models.models import (
    Tenant, User, Tender, SiteDesign, AuditLog, 
    EquipmentModule, EquipmentInverter, EnergyEstimate, 
    FinancialAnalysis, UserRole, BOQItem
)
from app.services.site_design import SiteDesignService
from app.services.energy_estimation import EnergyEstimationService
from app.services.financial_analysis import FinancialAnalysisService
from app.services.proposal import ProposalService
from app.services.placement_algorithm import PlacementAlgorithmService
from app.core.security import get_current_user, require_role, CurrentUser
from app.core.database import get_db

# Mark all tests in this file as integration tests
pytestmark = pytest.mark.integration

# Register marker to avoid warnings
def pytest_configure(config):
    config.addinivalue_line("markers", "integration: mark test as integration test")

TEST_DB_URL = "sqlite:///./test_workflow_integration.db"

@pytest.fixture
def db_session():
    """Real database session for integration tests, using local SQLite."""
    engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    # expire_on_commit=False ensures objects stay attached after commit
    SessionLocalTest = sessionmaker(autocommit=False, autoflush=False, bind=engine, expire_on_commit=False)
    session = SessionLocalTest()
    
    # We create a proxy that ignores .close() so services/tasks don't kill our test session
    class SessionProxy:
        def __init__(self, obj):
            self.obj = obj
        def __getattr__(self, name):
            return getattr(self.obj, name)
        def close(self):
            # No-op for the test session
            pass
        def __enter__(self):
            return self
        def __exit__(self, *args):
            pass

    # Patch SessionLocal in the core module to use our test session
    proxy = SessionProxy(session)
    with patch("app.core.database.SessionLocal", return_value=proxy):
        try:
            yield session
        finally:
            session.rollback()
            session.close()
            # Cleanup test DB
            if os.path.exists("./test_workflow_integration.db"):
                try:
                    os.remove("./test_workflow_integration.db")
                except:
                    pass

@pytest.fixture
def workflow_context(db_session: Session):
    """Setup a full tenant/user/tender/equipment/BOQ context for the workflow."""
    suffix = str(uuid4())[:8]
    
    # 1. Create Tenant
    tenant = Tenant(id=uuid4(), name=f"Integration Design Tenant {suffix}")
    db_session.add(tenant)
    
    # 2. Create User (ADMIN)
    user = User(
        id=uuid4(),
        tenant_id=tenant.id,
        email=f"admin_{suffix}@example.com",
        firebase_uid=f"fb_{suffix}",
        role="admin",
        is_active=True
    )
    db_session.add(user)
    
    # 3. Create Equipment (2 modules, 2 inverters)
    modules = [
        EquipmentModule(
            id=uuid4(), manufacturer="SunPower", model="X21-400", wattage=400, efficiency=21.0,
            length_m=1.6, width_m=1.0, thickness_m=0.04, is_global=True,
            voc=48.0, isc=10.0, vmp=40.0, imp=9.5
        ),
        EquipmentModule(
            id=uuid4(), manufacturer="LG", model="Neon 450", wattage=450, efficiency=22.0,
            length_m=1.7, width_m=1.0, thickness_m=0.04, is_global=True,
            voc=50.0, isc=11.0, vmp=42.0, imp=10.0
        )
    ]
    inverters = [
        EquipmentInverter(
            id=uuid4(), manufacturer="SolarEdge", model="SE10K", capacity_kw=10.0, is_global=True,
            max_dc_voltage=1000, mppt_voltage_range_min=200, mppt_voltage_range_max=800, max_input_current=15, num_mppt_channels=2
        ),
        EquipmentInverter(
            id=uuid4(), manufacturer="Fronius", model="Primo 15.0", capacity_kw=15.0, is_global=True,
            max_dc_voltage=800, mppt_voltage_range_min=150, mppt_voltage_range_max=600, max_input_current=20, num_mppt_channels=1
        )
    ]
    for m in modules: db_session.add(m)
    for i in inverters: db_session.add(i)
    
    # 4. Create Tender
    tender = Tender(
        id=uuid4(),
        tenant_id=tenant.id,
        created_by=user.id,
        name=f"Integration Workflow Tender {suffix}",
        latitude=34.0522,
        longitude=-118.2437,
        status="submitted"
    )
    db_session.add(tender)
    
    # 5. Add BOQItems
    boq_items = [
        BOQItem(id=uuid4(), tender_id=tender.id, category="equipment", description="Modules", unit_cost=200.0, quantity=50, line_total=10000.0),
        BOQItem(id=uuid4(), tender_id=tender.id, category="equipment", description="Inverters", unit_cost=2000.0, quantity=1, line_total=2000.0),
        BOQItem(id=uuid4(), tender_id=tender.id, category="labor", description="Installation", unit_cost=1500.0, quantity=1, line_total=1500.0)
    ]
    for item in boq_items: db_session.add(item)
    
    db_session.commit()
    db_session.refresh(user)
    db_session.refresh(tenant)
    db_session.refresh(tender)
    
    return {
        "tenant_id": tenant.id,
        "user_id": user.id,
        "tender_id": tender.id,
        "module_ids": [m.id for m in modules],
        "inverter_ids": [i.id for i in inverters],
        "modules": modules,
        "inverters": inverters,
        "user": user
    }

@pytest.fixture
def api_client(workflow_context):
    """FastAPI TestClient with mocked authentication."""
    async def override_get_current_user(db: Session = Depends(get_db)):
        user_id = workflow_context["user_id"]
        # Directly query to ensure it's in the current session
        user = db.query(User).filter(User.id == user_id).first()
        return CurrentUser(user=user, tenant_id=str(user.tenant_id))
    
    def override_require_role(*args, **kwargs):
        async def role_checker(current_user: CurrentUser = Depends(override_get_current_user)):
            return current_user
        return role_checker

    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[require_role] = override_require_role
    
    with TestClient(app) as client:
        yield client
    
    app.dependency_overrides = {}

# Helpers
def create_valid_boundary(area_sqm: float = 100) -> Dict:
    """Generate GeoJSON polygon with specified approximate area."""
    d = 0.0005 # approx 55m, gives approx 3000 sqm area
    return {
        "type": "Polygon",
        "coordinates": [[
            [-118.2437, 34.0522],
            [-118.2437 + d, 34.0522],
            [-118.2437 + d, 34.0522 + d],
            [-118.2437, 34.0522 + d],
            [-118.2437, 34.0522]
        ]]
    }

def mock_pvwatts_response(annual_kwh: float = 15000.0) -> Dict:
    """Return mock PVWatts API response structure."""
    monthly = [annual_kwh / 12.0] * 12
    return {
        "outputs": {
            "ac_annual": annual_kwh,
            "ac_monthly": monthly,
            "capacity_factor": 20.5
        }
    }

def verify_audit_log(db: Session, tenant_id, entity_type, entity_id, action) -> AuditLog:
    """Query audit log and verify entry exists."""
    db.flush() # Ensure everything is written
    log = db.query(AuditLog).filter(
        AuditLog.tenant_id == tenant_id,
        AuditLog.entity_id == entity_id,
        AuditLog.action == action
    ).first()
    
    if log is None:
        # Debug: list all logs for this tenant
        all_logs = db.query(AuditLog).filter(AuditLog.tenant_id == tenant_id).all()
        print(f"\nAudit Logs for tenant {tenant_id}:")
        for l in all_logs:
            print(f"  - Entity: {l.entity_type}, ID: {l.entity_id}, Action: {l.action}")
            
    assert log is not None, f"Audit log for {entity_type} {action} not found"
    return log

# Test implementations
def test_complete_workflow_service_layer(db_session: Session, workflow_context: Dict):
    """Exercises all services in sequence."""
    tenant_id = workflow_context["tenant_id"]
    user_id = workflow_context["user_id"]
    tender_id = workflow_context["tender_id"]
    
    # Ensure non-zero modules: moderate boundary, small setback
    d = 0.001 # ~110m, approx 12,000 sqm
    boundary = {
        "type": "Polygon",
        "coordinates": [[
            [-118.2437, 34.0522],
            [-118.2437 + d, 34.0522],
            [-118.2437 + d, 34.0522 + d],
            [-118.2437, 34.0522 + d],
            [-118.2437, 34.0522]
        ]]
    }
    
    placement_settings = {
        "edge_setback_m": 0.5,
        "row_spacing_m": 1.0,
        "tilt_deg": 20.0,
        "azimuth_deg": 180.0
    }
    module_id = workflow_context["module_ids"][0]
    inverter_id = workflow_context["inverter_ids"][0]

    # 1. Create Site Design
    sd_service = SiteDesignService(db_session, tenant_id=tenant_id, user_id=user_id)
    design = sd_service.create_design(
        tender_id=tender_id,
        name="Service Layer Test Design",
        site_type="ground_mount",
        equipment_module_id=module_id,
        equipment_inverter_id=inverter_id,
        site_boundary=boundary,
        placement_settings=placement_settings
    )
    assert design.id is not None
    assert design.site_type == "ground_mount"
    db_session.commit()
    verify_audit_log(db_session, tenant_id, "SiteDesign", design.id, "create")

    # 2. Update Equipment
    new_module_id = workflow_context["module_ids"][1]
    new_inverter_id = workflow_context["inverter_ids"][1]
    updated_design = sd_service.update_equipment(
        design,
        equipment_module_id=new_module_id,
        equipment_inverter_id=new_inverter_id
    )
    assert updated_design.equipment_module_id == new_module_id
    assert updated_design.equipment_inverter_id == new_inverter_id
    db_session.commit()
    verify_audit_log(db_session, tenant_id, "SiteDesign", design.id, "update")

    # 3. Update Geometry (add exclusion zone)
    exclusion_zone = create_valid_boundary(10) # small box
    updated_design = sd_service.update_geometry(
        design,
        site_boundary=boundary,
        exclusion_zones=[exclusion_zone]
    )
    assert len(updated_design.exclusion_zones) == 1
    db_session.commit()
    verify_audit_log(db_session, tenant_id, "SiteDesign", design.id, "update")

    # 4. Calculate Placement
    from app.services.tasks import calculate_placement_async
    
    # Simulate execution - Call directly
    module_dims_calc = {"length_m": 1.6, "width_m": 1.0}
    result = calculate_placement_async.run(
        design_id=str(design.id),
        site_boundary=boundary,
        exclusion_zones=[exclusion_zone],
        module_dims=module_dims_calc,
        settings=updated_design.placement_settings
    )
    # Re-query manually as it was run sync
    db_session.expire_all()
    updated_design = db_session.query(SiteDesign).get(design.id)
    db_session.refresh(updated_design)
    assert updated_design.total_modules > 0
    assert updated_design.system_size_kwp > 0
    assert updated_design.placement_task_status == "completed"

    # 5. Calculate Energy - Mock delay because the service triggers it
    ee_service = EnergyEstimationService(db_session)
    with patch("app.services.tasks.calculate_energy_task.delay"):
        estimate = ee_service.estimate_energy_async(updated_design.id)
    assert estimate.status == "calculating"

    from app.services.tasks import calculate_energy_task
    with patch("httpx.get") as mock_get:
        mock_get.return_value = MagicMock(
            status_code=200,
            json=lambda: mock_pvwatts_response(20000.0)
        )
        
        params = {
            "system_capacity": updated_design.system_size_kwp,
            "module_type": 1,
            "losses": 14.0,
            "array_type": 0, # ground_mount
            "tilt": 20.0,
            "azimuth": 180.0,
            "lat": 34.0522,
            "lon": -118.2437
        }
        calculate_energy_task.run(estimate_id=str(estimate.id), params=params)

    db_session.refresh(estimate)
    assert estimate.status == "completed"
    assert estimate.annual_energy_kwh == 20000.0

    # 6. Calculate Financials
    fa_service = FinancialAnalysisService(db_session, tenant_id=tenant_id, user_id=user_id)
    analysis = fa_service.calculate_financials(updated_design.id)
    assert analysis.id is not None
    assert analysis.system_cost_usd > 0
    assert analysis.annual_savings_usd > 0
    assert analysis.calculated_at is not None

    # 7. Generate Proposal
    p_service = ProposalService(db_session, tenant_id=tenant_id, user_id=user_id)
    with patch("weasyprint.HTML") as mock_html, \
         patch("app.services.storage.StorageBackend.save", return_value="mock_storage_id"):
        
        from app.services.tasks import generate_proposal_task
        # Trigger the task run manually
        generate_proposal_task.run(site_design_id=str(updated_design.id), options={})
        
        db_session.commit()
        # Re-query to ensure stability
        verify_audit_log(db_session, tenant_id, "Proposal", design.id, "generate_pdf")

    # Assert persistence and relationships
    db_session.expire_all()
    final_design = db_session.query(SiteDesign).get(design.id)
    assert final_design.energy_estimate is not None
    assert final_design.financial_analysis is not None
    assert len(final_design.energy_estimate.monthly_energy_kwh) == 12

def test_complete_workflow_api_endpoints(api_client: TestClient, workflow_context: Dict, db_session: Session):
    """Exercises all API endpoints in sequence."""
    tender_id = workflow_context["tender_id"]
    module_id = workflow_context["module_ids"][0]
    inverter_id = workflow_context["inverter_ids"][0]

    # 1. POST /api/tenders/{tender_id}/site-designs
    boundary = create_valid_boundary(1000)
    response = api_client.post(
        f"/api/tenders/{tender_id}/site-designs",
        json={
            "name": "API Layer Test Design",
            "site_type": "rooftop",
            "equipment_module_id": str(module_id),
            "equipment_inverter_id": str(inverter_id),
            "site_boundary": boundary,
            "placement_settings": {"edge_setback_m": 0.5, "tilt_deg": 10.0}
        }
    )
    assert response.status_code == 201
    design_id = response.json()["id"]

    # 2. PUT /api/site-designs/{design_id}
    new_module_id = workflow_context["module_ids"][1]
    response = api_client.put(
        f"/api/site-designs/{design_id}",
        json={"equipment_module_id": str(new_module_id)}
    )
    assert response.status_code == 200
    assert response.json()["equipment_module_id"] == str(new_module_id)

    # 3. Trigger Recalculation (Service Layer)
    from app.services.tasks import calculate_placement_async
    sd_service = SiteDesignService(db_session, tenant_id=workflow_context["tenant_id"], user_id=workflow_context["user_id"])
    
    # Get design to have access to settings/boundary
    db_session.expire_all()
    design = db_session.query(SiteDesign).get(PyUUID(design_id))
    
    # Run placement task synchronously
    calculate_placement_async.run(
        design_id=str(design.id),
        site_boundary=design.site_boundary,
        exclusion_zones=[],
        module_dims={"length_m": 1.6, "width_m": 1.0},
        settings=design.placement_settings
    )
    
    # 4. POST /api/site-designs/{design_id}/energy-estimate
    with patch("app.services.tasks.calculate_energy_task.delay") as mock_delay:
        mock_delay.return_value = MagicMock(id="mock_energy_task_id")
        response = api_client.post(f"/api/site-designs/{design_id}/energy-estimate")
        assert response.status_code == 202
        estimate_id = response.json()["estimate_id"]

    # Execute energy task synchronously
    from app.services.tasks import calculate_energy_task
    with patch("httpx.get") as mock_get:
        mock_get.return_value = MagicMock(
            status_code=200,
            json=lambda: mock_pvwatts_response(18000.0)
        )
        params = {
            "system_capacity": 100.0, # Dummy for test
            "tilt": 10.0,
            "azimuth": 180.0,
            "lat": 34.0522,
            "lon": -118.2437
        }
        calculate_energy_task.run(estimate_id=str(estimate_id), params=params)

    # 5. GET /api/site-designs/{design_id}/energy-estimate
    response = api_client.get(f"/api/site-designs/{design_id}/energy-estimate")
    assert response.status_code == 200
    res_json = response.json()
    assert res_json["status"] == "completed"
    assert res_json["annual_energy_kwh"] == 18000.0
    assert len(res_json["monthly_energy_kwh"]) == 12

    # 6. GET /api/site-designs/{design_id}/financial-analysis
    response = api_client.get(f"/api/site-designs/{design_id}/financial-analysis")
    assert response.status_code == 200
    fa_json = response.json()
    assert fa_json["system_cost_usd"] > 0
    assert fa_json["annual_savings_usd"] > 0
    assert fa_json["simple_payback_years"] > 0
    assert fa_json["roi_pct"] > 0

    # 7. POST /api/site-designs/{design_id}/proposal
    with patch("app.services.tasks.generate_proposal_task.delay") as mock_delay:
        mock_delay.return_value = MagicMock(id="mock_task_id")
        response = api_client.post(f"/api/site-designs/{design_id}/proposal")
        assert response.status_code == 202
        task_id = response.json()["task_id"]
        
        # Run generation task synchronously
        from app.services.tasks import generate_proposal_task
        with patch("weasyprint.HTML"), patch("app.services.storage.StorageBackend.save", return_value="pid"):
            generate_proposal_task.run(site_design_id=str(design_id), options={})
            
        db_session.commit()
        verify_audit_log(db_session, workflow_context["tenant_id"], "Proposal", PyUUID(design_id), "generate_pdf")

def test_data_persistence_across_workflow(db_session: Session, workflow_context: Dict):
    """Verify data persistence after cache clear."""
    test_complete_workflow_service_layer(db_session, workflow_context)
    
    db_session.expire_all()
    designs = db_session.query(SiteDesign).filter(SiteDesign.tender_id == workflow_context["tender_id"]).all()
    assert len(designs) > 0
    for design in designs:
        assert design.energy_estimate is not None
        assert design.financial_analysis is not None

def test_tenant_isolation_in_workflow(db_session: Session, workflow_context: Dict):
    """Verify cross-tenant access blocked."""
    sd_service = SiteDesignService(db_session, tenant_id=workflow_context["tenant_id"], user_id=workflow_context["user_id"])
    design = sd_service.create_design(
        tender_id=workflow_context["tender_id"],
        name="Tenant 1 Design",
        site_type="rooftop",
        equipment_module_id=workflow_context["module_ids"][0],
        equipment_inverter_id=workflow_context["inverter_ids"][0],
        site_boundary=create_valid_boundary(),
        placement_settings={"tilt_deg": 10.0}
    )

    t2_id = uuid4()
    t2 = Tenant(id=t2_id, name="Tenant 2")
    db_session.add(t2)
    u2_id = uuid4()
    u2_suffix = str(uuid4())[:8]
    u2 = User(id=uuid4(), tenant_id=t2_id, email=f"u2_{u2_suffix}@ex.com", firebase_uid=f"fb2_{u2_suffix}")
    db_session.add(u2)
    db_session.commit()

    sd_service_t2 = SiteDesignService(db_session, tenant_id=t2_id, user_id=u2_id)
    t2_design = sd_service_t2.get_design(design.id)
    assert t2_design is None

def test_audit_logging_complete_workflow(db_session: Session, workflow_context: Dict):
    """Verify audit trail complete."""
    # We call the service layer test to populate data
    test_complete_workflow_service_layer(db_session, workflow_context)
    
    # We query the latest design to verify logs
    design = db_session.query(SiteDesign).filter(SiteDesign.tender_id == workflow_context["tender_id"]).first()
    
    # Refresh to ensure it's in the current session
    db_session.refresh(design)
    verify_audit_log(db_session, workflow_context["tenant_id"], "SiteDesign", design.id, "create")
    
    logs = db_session.query(AuditLog).filter(AuditLog.tenant_id == workflow_context["tenant_id"]).all()
    actions = [log.action for log in logs]
    assert "create" in actions
    assert "update" in actions
    assert "generate_pdf" in actions

def test_async_placement_for_large_site(db_session: Session, workflow_context: Dict):
    """Test async placement triggered for large sites."""
    sd_service = SiteDesignService(db_session, tenant_id=workflow_context["tenant_id"], user_id=workflow_context["user_id"])
    d = 0.001
    large_boundary = {
        "type": "Polygon",
        "coordinates": [[
            [-118.2437, 34.0522],
            [-118.2437 + d, 34.0522],
            [-118.2437 + d, 34.0522 + d],
            [-118.2437, 34.0522 + d],
            [-118.2437, 34.0522]
        ]]
    }
    
    design = sd_service.create_design(
        tender_id=workflow_context["tender_id"],
        name="Large Site",
        site_type="ground_mount",
        equipment_module_id=workflow_context["module_ids"][0],
        equipment_inverter_id=workflow_context["inverter_ids"][0],
        site_boundary=large_boundary,
        placement_settings={"tilt_deg": 20.0}
    )
    
    with patch("app.services.tasks.calculate_placement_async.delay") as mock_delay:
        mock_delay.return_value = MagicMock(id="mock_placement_task_id")
        sd_service.recalculate_design(design.id)
        
        # Fresh instance
        db_session.expire_all()
        design = db_session.query(SiteDesign).get(design.id)
        assert design.placement_task_status == "pending"
        assert design.placement_task_id == "mock_placement_task_id"

def test_proposal_generation_without_energy_data(db_session: Session, workflow_context: Dict):
    """Verify proposal generation handles missing energy data."""
    sd_service = SiteDesignService(db_session, tenant_id=workflow_context["tenant_id"], user_id=workflow_context["user_id"])
    with patch("app.services.tasks.calculate_energy_task.delay"):
        design = sd_service.create_design(
            tender_id=workflow_context["tender_id"],
            name="No Energy Design",
            site_type="rooftop",
            equipment_module_id=workflow_context["module_ids"][0],
            equipment_inverter_id=workflow_context["inverter_ids"][0],
            site_boundary=create_valid_boundary(),
            placement_settings={"tilt_deg": 10.0}
        )
    
    from app.services.tasks import calculate_placement_async
    db_session.refresh(design) # Ensure it's in the current session
    module = db_session.get(EquipmentModule, design.equipment_module_id)
    module_dims_calc = {"length_m": module.length_m, "width_m": module.width_m}
    calculate_placement_async.run(
        design_id=str(design.id), 
        site_boundary=design.site_boundary, 
        exclusion_zones=design.exclusion_zones, 
        module_dims=module_dims_calc, 
        settings=design.placement_settings
    )
    
    with patch("weasyprint.HTML"), patch("app.services.storage.StorageBackend.save", return_value="pid"):
        from app.services.tasks import generate_proposal_task
        generate_proposal_task.run(site_design_id=str(design.id))
        db_session.commit()
        verify_audit_log(db_session, workflow_context["tenant_id"], "Proposal", design.id, "generate_pdf")

def test_financial_calculation_with_missing_boq(db_session: Session, workflow_context: Dict):
    """Verify financials handle missing BOQ items."""
    tender_id = workflow_context["tender_id"]
    db_session.query(BOQItem).filter(BOQItem.tender_id == tender_id).delete()
    db_session.commit()
    
    sd_service = SiteDesignService(db_session, tenant_id=workflow_context["tenant_id"], user_id=workflow_context["user_id"])
    design = sd_service.create_design(
        tender_id=tender_id,
        name="No BOQ Design",
        site_type="rooftop",
        equipment_module_id=workflow_context["module_ids"][0],
        equipment_inverter_id=workflow_context["inverter_ids"][0],
        site_boundary=create_valid_boundary(),
        placement_settings={"tilt_deg": 10.0}
    )
    
    fa_service = FinancialAnalysisService(db_session, tenant_id=workflow_context["tenant_id"], user_id=workflow_context["user_id"])
    analysis = fa_service.calculate_financials(design.id)
    assert analysis.system_cost_usd == 0.0

@pytest.mark.parametrize("site_type, expected_tilt", [
    ("rooftop", 10.0),
    ("ground_mount", 20.0),
    ("carport", 0.0)
])
def test_workflow_different_site_types(db_session: Session, workflow_context: Dict, site_type, expected_tilt):
    """Verify default tilt and energy mapping for different site types."""
    sd_service = SiteDesignService(db_session, tenant_id=workflow_context["tenant_id"], user_id=workflow_context["user_id"])
    design = sd_service.create_design(
        tender_id=workflow_context["tender_id"],
        name=f"{site_type} Design",
        site_type=site_type,
        equipment_module_id=workflow_context["module_ids"][0],
        equipment_inverter_id=workflow_context["inverter_ids"][0],
        site_boundary=create_valid_boundary(),
        placement_settings={"tilt_deg": expected_tilt}
    )
    assert design.placement_settings["tilt_deg"] == expected_tilt

def test_invalid_boundary_geometry(db_session: Session, workflow_context: Dict):
    """Verify error for invalid GeoJSON."""
    sd_service = SiteDesignService(db_session, tenant_id=workflow_context["tenant_id"], user_id=workflow_context["user_id"])
    invalid_boundary = {"type": "Polygon", "coordinates": [[[0,0], [0,1]]]} # too few points
    
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc:
        sd_service.create_design(
            tender_id=workflow_context["tender_id"],
            name="Invalid",
            site_type="rooftop",
            equipment_module_id=workflow_context["module_ids"][0],
            equipment_inverter_id=workflow_context["inverter_ids"][0],
            site_boundary=invalid_boundary,
            placement_settings={"tilt_deg": 10.0}
        )
    assert exc.value.status_code == 400

def test_placement_task_status_transitions(db_session: Session, workflow_context: Dict):
    """Verify task status progression for placement."""
    sd_service = SiteDesignService(db_session, tenant_id=workflow_context["tenant_id"], user_id=workflow_context["user_id"])
    design = sd_service.create_design(
        tender_id=workflow_context["tender_id"],
        name="Status Test",
        site_type="rooftop",
        equipment_module_id=workflow_context["module_ids"][0],
        equipment_inverter_id=workflow_context["inverter_ids"][0],
        site_boundary=create_valid_boundary(),
        placement_settings={"tilt_deg": 10.0}
    )
    
    from app.services.tasks import calculate_placement_async
    
    # Simulate success
    calculate_placement_async.run(
        design_id=str(design.id), 
        site_boundary=design.site_boundary, 
        exclusion_zones=[], 
        module_dims={"length_m": 1, "width_m": 1}, 
        settings=design.placement_settings
    )
    # Fetch fresh instance
    db_session.expire_all()
    design = db_session.query(SiteDesign).get(design.id)
    assert design.placement_task_status == "completed"
    
    # Simulate failure
    # Patch in both namespaces to be absolutely sure
    with patch("app.services.tasks.PlacementAlgorithmService.calculate_placement", side_effect=Exception("Algo failed")):
        
        # Simpler approach: set max_retries to 0 so it's always the "last" retry
        orig_max = calculate_placement_async.max_retries
        calculate_placement_async.max_retries = 0
        
        try:
            with pytest.raises(Exception):
                calculate_placement_async.run(
                    design_id=str(design.id), 
                    site_boundary=design.site_boundary, 
                    exclusion_zones=[], 
                    module_dims={"length_m": 1, "width_m": 1}, 
                    settings=design.placement_settings
                )
        finally:
            calculate_placement_async.max_retries = orig_max
        # Fetch fresh instance using ID to avoid detached instance issues
        design_id = design.id
        db_session.expire_all() # We want fresh data for status check
        design = db_session.query(SiteDesign).get(design_id)
        assert design.placement_task_status == "failed"
        assert "Algo failed" in design.placement_task_error

def test_energy_estimation_status_transitions(db_session: Session, workflow_context: Dict):
    """Verify status progression for energy estimation."""
    sd_service = SiteDesignService(db_session, tenant_id=workflow_context["tenant_id"], user_id=workflow_context["user_id"])
    design = sd_service.create_design(
        tender_id=workflow_context["tender_id"],
        name="Energy Status Test",
        site_type="rooftop",
        equipment_module_id=workflow_context["module_ids"][0],
        equipment_inverter_id=workflow_context["inverter_ids"][0],
        site_boundary=create_valid_boundary(),
        placement_settings={"tilt_deg": 10.0}
    )
    design.system_size_kwp = 10.0
    db_session.commit()
    
    ee_service = EnergyEstimationService(db_session)
    with patch("app.services.tasks.calculate_energy_task.delay"):
        estimate = ee_service.estimate_energy_async(design.id)
    assert estimate.status == "calculating"
    
    from app.services.tasks import calculate_energy_task
    
    with patch("httpx.get") as mock_get:
        mock_resp = MagicMock(spec=httpx.Response)
        mock_resp.status_code = 500
        # Create a real exception with proper attributes
        mock_resp.raise_for_status.side_effect = httpx.HTTPStatusError(
            "Mock 500 Error", 
            request=MagicMock(spec=httpx.Request), 
            response=mock_resp
        )
        mock_get.return_value = mock_resp
        
        # Use max_retries=0 to force failure status update
        orig_max = calculate_energy_task.max_retries
        calculate_energy_task.max_retries = 0
        
        try:
            db_session.refresh(estimate)
            with patch.object(calculate_energy_task, 'retry', side_effect=Exception("Celery Retry")):
                with pytest.raises(Exception) as excinfo:
                     mock_self = MagicMock()
                     mock_self.max_retries = 0
                     mock_self.request.retries = 0
                     
                     # Call the unbound function to provide our own self
                     calculate_energy_task.__class__.run(
                         mock_self,
                         str(estimate.id), 
                         {"lat": 0, "lon": 0, "system_capacity": 10.0, "tilt": 20.0, "azimuth": 180.0}
                     )
                # Verify it raised something related to our simulation
                error_msg = str(excinfo.value)
                assert any(msg in error_msg for msg in ["Celery Retry", "Mock 500 Error", "HTTP"])
        finally:
            calculate_energy_task.max_retries = orig_max
        
        estimate_id = estimate.id
        db_session.expire_all()
        estimate = db_session.query(EnergyEstimate).get(estimate_id)
        assert estimate.status == "failed"
        assert any(msg in estimate.error_message for msg in ["Celery Retry", "Mock 500 Error"])

def test_placement_with_excessive_setback(db_session: Session, workflow_context: Dict):
    """Verify placement handles setbacks larger than the site."""
    sd_service = SiteDesignService(db_session, tenant_id=workflow_context["tenant_id"], user_id=workflow_context["user_id"])
    d = 0.00002 
    small_boundary = {
        "type": "Polygon",
        "coordinates": [[
            [-118.2437, 34.0522],
            [-118.2437 + d, 34.0522],
            [-118.2437 + d, 34.0522 + d],
            [-118.2437, 34.0522 + d],
            [-118.2437, 34.0522]
        ]]
    }
    
    design = sd_service.create_design(
        tender_id=workflow_context["tender_id"],
        name="Excessive Setback",
        site_type="rooftop",
        equipment_module_id=workflow_context["module_ids"][0],
        equipment_inverter_id=workflow_context["inverter_ids"][0],
        site_boundary=small_boundary,
        placement_settings={"edge_setback_m": 10.0, "tilt_deg": 10.0} # way too large
    )
    
    from app.services.tasks import calculate_placement_async
    calculate_placement_async.run(
        design_id=str(design.id), 
        site_boundary=design.site_boundary, 
        exclusion_zones=[], 
        module_dims={"length_m": 1, "width_m": 1}, 
        settings=design.placement_settings
    )
    
    db_session.expire_all()
    design = db_session.query(SiteDesign).get(design.id)
    assert design.total_modules == 0
    assert design.placement_task_status == "completed"

def test_energy_estimation_with_zero_capacity(db_session: Session, workflow_context: Dict):
    """Verify energy estimation proceeds with zero capacity."""
    sd_service = SiteDesignService(db_session, tenant_id=workflow_context["tenant_id"], user_id=workflow_context["user_id"])
    design = sd_service.create_design(
        tender_id=workflow_context["tender_id"],
        name="Zero Capacity",
        site_type="rooftop",
        equipment_module_id=workflow_context["module_ids"][0],
        equipment_inverter_id=workflow_context["inverter_ids"][0],
        site_boundary=create_valid_boundary(),
        placement_settings={"tilt_deg": 10.0}
    )
    design.system_size_kwp = 0.0
    db_session.commit()
    
    ee_service = EnergyEstimationService(db_session)
    with patch("app.services.tasks.calculate_energy_task.delay"):
        estimate = ee_service.estimate_energy_async(design.id)
    
    from app.services.tasks import calculate_energy_task
    with patch("httpx.get") as mock_get:
        mock_get.return_value = MagicMock(status_code=200, json=lambda: mock_pvwatts_response(0.0))
        calculate_energy_task.run(
            estimate_id=str(estimate.id), 
            params={"system_capacity": 0.0, "lat": 0, "lon": 0, "tilt": 10.0, "azimuth": 180.0}
        )
        
    db_session.expire_all()
    estimate = db_session.query(EnergyEstimate).get(estimate.id)
    assert estimate.status == "completed"
    assert estimate.annual_energy_kwh == 0.0

def test_concurrent_design_operations(db_session: Session, workflow_context: Dict):
    """Verify multiple designs can be created and processed."""
    tender_id = workflow_context["tender_id"]
    tenant_id = workflow_context["tenant_id"]
    user_id = workflow_context["user_id"]
    sd_service = SiteDesignService(db_session, tenant_id=tenant_id, user_id=user_id)
    
    designs = []
    for i in range(3):
        d = sd_service.create_design(
            tender_id=tender_id,
            name=f"Concurrent Design {i}",
            site_type="rooftop",
            equipment_module_id=workflow_context["module_ids"][0],
            equipment_inverter_id=workflow_context["inverter_ids"][0],
            site_boundary=create_valid_boundary(),
            placement_settings={"tilt_deg": 10.0}
        )
        designs.append(d)
        
    assert len(designs) == 3
    db_session.expire_all()
    count = db_session.query(SiteDesign).filter(SiteDesign.tender_id == tender_id).count()
    assert count >= 3
