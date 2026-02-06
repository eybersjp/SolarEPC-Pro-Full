import pytest
from uuid import uuid4, UUID
from datetime import datetime
from unittest.mock import MagicMock, patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base
from app.models.models import (
    Tenant, User, Tender, EquipmentModule, EquipmentInverter, 
    SiteDesign, DesignVersion, AuditLog, UserRole, TenderStatus
)
from app.services.design_version import DesignVersionService
from app.schemas.design_version import DesignVersionCreate
from fastapi import HTTPException

# In-memory SQLite for testing
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
    """Create basic test data factory."""
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
        tenant_id=tenant_id, created_by=user_id, name="Test Tender", status=TenderStatus.DRAFT
    )
    db.add(tender)
    db.commit()

    # Site Design
    site_design = SiteDesign(
        tender_id=tender.id,
        name="Original Design",
        site_type="ground_mount",
        equipment_module_id=module.id,
        equipment_inverter_id=inverter.id,
        site_boundary={"type": "Polygon", "coordinates": [[[0,0], [1,0], [1,1], [0,1], [0,0]]]},
        exclusion_zones=[],
        module_placements=[],
        row_spacing_m=2.0,
        edge_setback_m=1.0,
        module_orientation="portrait",
        azimuth_deg=180.0,
        tilt_deg=10.0,
        total_modules=100,
        system_size_kwp=40.0,
        site_area_sqm=1000.0,
        created_by=user_id
    )
    db.add(site_design)
    db.commit()
    db.refresh(site_design)
    
    return {
        "tenant_id": tenant_id,
        "user_id": user_id,
        "module_id": module.id,
        "inverter_id": inverter.id,
        "tender_id": tender.id,
        "site_design_id": site_design.id
    }

@pytest.fixture
def service(db, test_data):
    return DesignVersionService(db, test_data["tenant_id"], test_data["user_id"])

class TestDesignVersionSnapshot:
    def test_create_version_snapshot_fidelity(self, db, test_data, service):
        """Verify that all relevant fields are captured in the snapshot."""
        version_data = DesignVersionCreate(version_name="Snapshot V1", notes="Test Snapshot")
        version = service.create_version(test_data["site_design_id"], version_data)
        
        snapshot = version.snapshot_data
        assert snapshot["name"] == "Original Design"
        assert snapshot["row_spacing_m"] == 2.0
        assert snapshot["system_size_kwp"] == 40.0
        assert snapshot["equipment_module_id"] == str(test_data["module_id"])
        assert snapshot["site_boundary"]["type"] == "Polygon"

    def test_restore_version_fidelity(self, db, test_data, service):
        """Verify that restoration correctly updates all SiteDesign fields."""
        # 1. Create Baseline Version
        service.create_version(test_data["site_design_id"], DesignVersionCreate(version_name="Baseline"))
        v1 = db.query(DesignVersion).first()
        
        # 2. Modify Site Design
        design = db.query(SiteDesign).get(test_data["site_design_id"])
        design.name = "Modified Name"
        design.row_spacing_m = 10.0
        db.commit()
        
        # 3. Restore Baseline
        with patch("app.services.design_version.EnergyEstimationService"), \
             patch("app.services.design_version.FinancialAnalysisService"):
            service.restore_version(v1.id, design.id)
            
        db.refresh(design)
        assert design.name == "Original Design"
        assert design.row_spacing_m == 2.0

class TestDesignVersionTenantIsolation:
    def test_cross_tenant_create_denied(self, db, test_data):
        """Verify cross-tenant creation is blocked."""
        other_tenant_id = uuid4()
        other_service = DesignVersionService(db, other_tenant_id, test_data["user_id"])
        
        with pytest.raises(HTTPException) as exc:
            other_service.create_version(test_data["site_design_id"], DesignVersionCreate(version_name="Evil"))
        assert exc.value.status_code == 404

    def test_cross_tenant_list_filtered(self, db, test_data, service):
        """Verify cross-tenant listing returns empty list or filtered results."""
        service.create_version(test_data["site_design_id"], DesignVersionCreate(version_name="V1"))
        
        other_tenant_id = uuid4()
        other_service = DesignVersionService(db, other_tenant_id, test_data["user_id"])
        versions = other_service.list_versions(test_data["site_design_id"])
        assert len(versions) == 0

    def test_mismatched_site_design_restore_denied(self, db, test_data, service):
        """Verify restore is blocked if version doesn't belong to design_id."""
        version = service.create_version(test_data["site_design_id"], DesignVersionCreate(version_name="V1"))
        
        # Create another design in same tenant
        other_design = SiteDesign(
            tender_id=test_data["tender_id"], name="Other", site_type="rooftop",
            equipment_module_id=test_data["module_id"], equipment_inverter_id=test_data["inverter_id"],
            site_boundary={"type": "Polygon", "coordinates": [[[0,0], [1,0], [1,1], [0,1], [0,0]]]},
            tilt_deg=0.0, created_by=test_data["user_id"]
        )
        db.add(other_design)
        db.commit()
        
        with pytest.raises(HTTPException) as exc:
            service.restore_version(version.id, other_design.id)
        assert exc.value.status_code == 404
        assert "does not belong" in exc.value.detail

class TestDesignVersionAudit:
    def test_audit_log_on_create(self, db, test_data, service):
        version_data = DesignVersionCreate(version_name="Audit V1")
        version = service.create_version(test_data["site_design_id"], version_data)
        
        log = db.query(AuditLog).filter(AuditLog.entity_id == version.id, AuditLog.action == "create").first()
        assert log is not None
        assert log.new_value["version_name"] == "Audit V1"

    def test_audit_log_on_list(self, db, test_data, service):
        service.list_versions(test_data["site_design_id"])
        log = db.query(AuditLog).filter(AuditLog.action == "list", AuditLog.entity_id == test_data["site_design_id"]).first()
        assert log is not None

    def test_audit_log_on_restore(self, db, test_data, service):
        version = service.create_version(test_data["site_design_id"], DesignVersionCreate(version_name="V1"))
        
        with patch("app.services.design_version.EnergyEstimationService"), \
             patch("app.services.design_version.FinancialAnalysisService"):
            service.restore_version(version.id, test_data["site_design_id"])
            
        log = db.query(AuditLog).filter(AuditLog.action == "update", AuditLog.entity_id == test_data["site_design_id"]).first()
        assert log is not None
        assert "restored_from_version_id" in log.new_value

class TestDesignVersionRecalculations:
    @patch("app.services.design_version.EnergyEstimationService")
    @patch("app.services.design_version.FinancialAnalysisService")
    def test_recalculation_triggers_on_parameter_change(self, mock_fin, mock_energy, db, test_data, service):
        """Verify recalculations ARE triggered when relevant parameters change."""
        # 1. Create Baseline
        service.create_version(test_data["site_design_id"], DesignVersionCreate(version_name="Baseline"))
        v1 = db.query(DesignVersion).first()
        
        # 2. Modify tilt (relevant for energy)
        design = db.query(SiteDesign).get(test_data["site_design_id"])
        design.tilt_deg = 45.0
        db.commit()
        
        # 3. Restore
        mock_energy_instance = mock_energy.return_value
        mock_energy_instance.estimate_energy_async.return_value = MagicMock(status="initiated")
        
        _, status = service.restore_version(v1.id, design.id)
        
        assert status["energy_estimation"] == "initiated"
        assert status["financial_analysis"] == "completed"
        mock_energy_instance.estimate_energy_async.assert_called_once()
        mock_fin.return_value.calculate_financials.assert_called_once()

    @patch("app.services.design_version.EnergyEstimationService")
    @patch("app.services.design_version.FinancialAnalysisService")
    def test_no_recalculation_on_metadata_only_change(self, mock_fin, mock_energy, db, test_data, service):
        """Verify recalculations ARE NOT triggered when only non-calculating fields change."""
        # 1. Create Baseline
        service.create_version(test_data["site_design_id"], DesignVersionCreate(version_name="Baseline"))
        v1 = db.query(DesignVersion).first()
        
        # 2. Modify notes/name (not relevant for energy)
        design = db.query(SiteDesign).get(test_data["site_design_id"])
        design.name = "Renamed"
        db.commit()
        
        # 3. Restore
        _, status = service.restore_version(v1.id, design.id)
        
        assert status["energy_estimation"] == "skipped"
        assert status["financial_analysis"] == "skipped"
        mock_energy.return_value.estimate_energy_async.assert_not_called()
        mock_fin.return_value.calculate_financials.assert_not_called()

class TestDesignVersionEdgeCases:
    def test_restore_with_complex_geometry(self, db, test_data, service):
        """Verify restoration handles complex snapshot data like exclusion zones."""
        design = db.query(SiteDesign).get(test_data["site_design_id"])
        design.exclusion_zones = [{"type": "Polygon", "coordinates": [[[0.1, 0.1], [0.2, 0.1], [0.2, 0.2], [0.1, 0.2], [0.1, 0.1]]]}]
        db.commit()
        
        service.create_version(test_data["site_design_id"], DesignVersionCreate(version_name="Complex V1"))
        v1 = db.query(DesignVersion).first()
        
        # Clear zones
        design.exclusion_zones = []
        db.commit()
        
        with patch("app.services.design_version.EnergyEstimationService"), \
             patch("app.services.design_version.FinancialAnalysisService"):
            service.restore_version(v1.id, design.id)
            
        db.refresh(design)
        assert len(design.exclusion_zones) == 1

    def test_invalid_version_id_raises_404(self, service):
        with pytest.raises(HTTPException) as exc:
            service.restore_version(uuid4(), uuid4())
        assert exc.value.status_code == 404
