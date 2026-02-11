import pytest
from uuid import uuid4, UUID
from datetime import datetime
from unittest.mock import MagicMock, patch
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

from app.core.database import Base
from app.models.models import (
    Tenant, User, Tender, EquipmentModule, EquipmentInverter,
    SiteDesign, DesignVersion, AuditLog, UserRole, TenderStatus,
    EnergyEstimate, FinancialAnalysis
)
from app.services.design_version import DesignVersionService
from app.services.site_design import SiteDesignService
from app.services.energy_estimation import EnergyEstimationService
from app.services.financial_analysis import FinancialAnalysisService
from app.schemas.design_version import DesignVersionCreate
from fastapi import HTTPException

# Mark all tests in this file as integration tests
pytestmark = pytest.mark.integration

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
    """Create a fresh database for each test."""
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def workflow_context(db):
    """Setup complete workflow context with tenant, user, equipment, tender, and design."""
    tenant_id = uuid4()
    user_id = uuid4()

    # Create tenant and user
    tenant = Tenant(id=tenant_id, name="Version Test Tenant")
    user = User(
        id=user_id,
        tenant_id=tenant_id,
        email="version_test@example.com",
        firebase_uid="version_test_uid",
        role=UserRole.ADMIN
    )
    db.add(tenant)
    db.add(user)

    # Create equipment
    module = EquipmentModule(
        id=uuid4(),
        tenant_id=tenant_id,
        manufacturer="SunPower",
        model="X21-400",
        wattage=400,
        efficiency=21.0,
        length_m=1.6,
        width_m=1.0,
        thickness_m=0.04,
        voc=48.0,
        isc=10.0,
        vmp=40.0,
        imp=9.5,
        is_active=True
    )
    inverter = EquipmentInverter(
        id=uuid4(),
        tenant_id=tenant_id,
        manufacturer="SolarEdge",
        model="SE10K",
        capacity_kw=10.0,
        max_dc_voltage=1000,
        mppt_voltage_range_min=200,
        mppt_voltage_range_max=800,
        max_input_current=15,
        num_mppt_channels=2,
        is_active=True
    )
    db.add(module)
    db.add(inverter)

    # Create tender
    tender = Tender(
        id=uuid4(),
        tenant_id=tenant_id,
        created_by=user_id,
        name="Version Test Tender",
        status=TenderStatus.DRAFT,
        latitude=34.0522,
        longitude=-118.2437
    )
    db.add(tender)
    db.commit()

    # Create site design
    boundary = {
        "type": "Polygon",
        "coordinates": [[
            [-118.2437, 34.0522],
            [-118.2437 + 0.001, 34.0522],
            [-118.2437 + 0.001, 34.0522 + 0.001],
            [-118.2437, 34.0522 + 0.001],
            [-118.2437, 34.0522]
        ]]
    }

    site_design = SiteDesign(
        tender_id=tender.id,
        name="Original Design",
        site_type="ground_mount",
        equipment_module_id=module.id,
        equipment_inverter_id=inverter.id,
        site_boundary=boundary,
        exclusion_zones=[],
        module_placements=[],
        row_spacing_m=2.0,
        edge_setback_m=1.0,
        module_orientation="portrait",
        azimuth_deg=180.0,
        tilt_deg=20.0,
        total_modules=100,
        system_size_kwp=40.0,
        site_area_sqm=12000.0,
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
        "site_design_id": site_design.id,
        "site_design": site_design
    }


class TestVersionCreationWorkflow:
    """Test complete version creation workflow."""

    def test_create_version_with_complete_snapshot(self, db, workflow_context):
        """Verify version creation captures all design state including energy and financial data."""
        service = DesignVersionService(db, workflow_context["tenant_id"], workflow_context["user_id"])
        design_id = workflow_context["site_design_id"]

        # Create energy estimate
        energy_estimate = EnergyEstimate(
            site_design_id=design_id,
            status="completed",
            annual_energy_kwh=50000.0,
            monthly_energy_kwh=[4000.0] * 12,
            capacity_factor=14.2,
            calculated_at=datetime.utcnow()
        )
        db.add(energy_estimate)

        # Create financial analysis
        financial_analysis = FinancialAnalysis(
            site_design_id=design_id,
            system_cost_usd=80000.0,
            electricity_rate_usd_per_kwh=0.12,
            annual_rate_escalation_pct=3.0,
            annual_savings_usd=6000.0,
            simple_payback_years=13.3,
            roi_pct=7.5,
            calculated_at=datetime.utcnow()
        )
        db.add(financial_analysis)
        db.commit()

        # Create version
        version_data = DesignVersionCreate(
            version_name="Complete Snapshot V1",
            notes="Testing complete data capture"
        )
        version = service.create_version(design_id, version_data)

        # Verify snapshot contains all data
        snapshot = version.snapshot_data
        assert snapshot["name"] == "Original Design"
        assert snapshot["total_modules"] == 100
        assert snapshot["system_size_kwp"] == 40.0
        assert snapshot["row_spacing_m"] == 2.0
        assert snapshot["tilt_deg"] == 20.0

        # Verify energy data in snapshot
        assert snapshot["energy_estimate"] is not None
        assert snapshot["energy_estimate"]["annual_energy_kwh"] == 50000.0
        assert snapshot["energy_estimate"]["status"] == "completed"
        assert len(snapshot["energy_estimate"]["monthly_energy_kwh"]) == 12

        # Verify financial data in snapshot
        assert snapshot["financial_analysis"] is not None
        assert snapshot["financial_analysis"]["system_cost_usd"] == 80000.0
        assert snapshot["financial_analysis"]["annual_savings_usd"] == 6000.0
        assert snapshot["financial_analysis"]["simple_payback_years"] == 13.3

        # Verify audit log
        audit_log = db.query(AuditLog).filter(
            AuditLog.entity_id == version.id,
            AuditLog.action == "create"
        ).first()
        assert audit_log is not None
        assert audit_log.new_value["version_name"] == "Complete Snapshot V1"

    def test_create_multiple_versions_chronological_order(self, db, workflow_context):
        """Verify multiple versions are created and listed in chronological order."""
        service = DesignVersionService(db, workflow_context["tenant_id"], workflow_context["user_id"])
        design_id = workflow_context["site_design_id"]

        # Create three versions
        v1 = service.create_version(design_id, DesignVersionCreate(version_name="Version 1"))
        db.commit()

        # Modify design
        design = db.query(SiteDesign).get(design_id)
        design.row_spacing_m = 3.0
        db.commit()

        v2 = service.create_version(design_id, DesignVersionCreate(version_name="Version 2"))
        db.commit()

        # Modify again
        design.tilt_deg = 25.0
        db.commit()

        v3 = service.create_version(design_id, DesignVersionCreate(version_name="Version 3"))
        db.commit()

        # List versions
        versions = service.list_versions(design_id)

        assert len(versions) == 3
        # Should be in reverse chronological order (newest first)
        assert versions[0].version_name == "Version 3"
        assert versions[1].version_name == "Version 2"
        assert versions[2].version_name == "Version 1"

        # Verify snapshots capture different states
        assert versions[2].snapshot_data["row_spacing_m"] == 2.0  # V1
        assert versions[1].snapshot_data["row_spacing_m"] == 3.0  # V2
        assert versions[0].snapshot_data["tilt_deg"] == 25.0      # V3


class TestVersionRestorationWorkflow:
    """Test complete version restoration workflow with recalculations."""

    @patch("app.services.design_version.EnergyEstimationService")
    @patch("app.services.design_version.FinancialAnalysisService")
    def test_restore_version_triggers_recalculations(self, mock_fin, mock_energy, db, workflow_context):
        """Verify version restoration triggers appropriate recalculations."""
        service = DesignVersionService(db, workflow_context["tenant_id"], workflow_context["user_id"])
        design_id = workflow_context["site_design_id"]

        # Create baseline version
        v1 = service.create_version(design_id, DesignVersionCreate(version_name="Baseline"))
        db.commit()

        # Modify design parameters that affect energy
        design = db.query(SiteDesign).get(design_id)
        original_tilt = design.tilt_deg
        original_system_size = design.system_size_kwp

        design.tilt_deg = 30.0
        design.system_size_kwp = 50.0
        design.azimuth_deg = 200.0
        db.commit()

        # Setup mocks
        mock_energy_instance = mock_energy.return_value
        mock_energy_instance.estimate_energy_async.return_value = MagicMock(status="initiated")

        # Restore to baseline
        restored_design, recalc_status = service.restore_version(v1.id, design_id)

        # Verify design was restored
        assert restored_design.tilt_deg == original_tilt
        assert restored_design.system_size_kwp == original_system_size

        # Verify recalculations were triggered
        assert recalc_status["energy_estimation"] == "initiated"
        assert recalc_status["financial_analysis"] == "completed"
        mock_energy_instance.estimate_energy_async.assert_called_once_with(design_id)
        mock_fin.return_value.calculate_financials.assert_called_once_with(design_id)

    @patch("app.services.design_version.EnergyEstimationService")
    @patch("app.services.design_version.FinancialAnalysisService")
    def test_restore_version_no_recalc_for_metadata_only(self, mock_fin, mock_energy, db, workflow_context):
        """Verify no recalculations when only metadata changes."""
        service = DesignVersionService(db, workflow_context["tenant_id"], workflow_context["user_id"])
        design_id = workflow_context["site_design_id"]

        # Create baseline version
        v1 = service.create_version(design_id, DesignVersionCreate(version_name="Baseline"))
        db.commit()

        # Modify only metadata (name)
        design = db.query(SiteDesign).get(design_id)
        design.name = "Modified Name"
        db.commit()

        # Restore to baseline
        restored_design, recalc_status = service.restore_version(v1.id, design_id)

        # Verify no recalculations
        assert recalc_status["energy_estimation"] == "skipped"
        assert recalc_status["financial_analysis"] == "skipped"
        mock_energy.return_value.estimate_energy_async.assert_not_called()
        mock_fin.return_value.calculate_financials.assert_not_called()

    def test_restore_version_audit_trail(self, db, workflow_context):
        """Verify complete audit trail for version restoration."""
        service = DesignVersionService(db, workflow_context["tenant_id"], workflow_context["user_id"])
        design_id = workflow_context["site_design_id"]

        # Create version
        v1 = service.create_version(design_id, DesignVersionCreate(version_name="Audit Test"))
        db.commit()

        # Modify and restore
        design = db.query(SiteDesign).get(design_id)
        design.row_spacing_m = 5.0
        db.commit()

        with patch("app.services.design_version.EnergyEstimationService"), \
             patch("app.services.design_version.FinancialAnalysisService"):
            service.restore_version(v1.id, design_id)

        # Verify audit logs
        create_log = db.query(AuditLog).filter(
            AuditLog.entity_id == v1.id,
            AuditLog.action == "create"
        ).first()
        assert create_log is not None

        restore_log = db.query(AuditLog).filter(
            AuditLog.entity_id == design_id,
            AuditLog.action == "update"
        ).first()
        assert restore_log is not None
        assert "restored_from_version_id" in restore_log.new_value
        assert restore_log.new_value["restored_from_version_id"] == str(v1.id)


class TestVersionSnapshotIntegrity:
    """Test version snapshot data integrity and immutability."""

    def test_snapshot_immutability(self, db, workflow_context):
        """Verify version snapshots remain unchanged when design is modified."""
        service = DesignVersionService(db, workflow_context["tenant_id"], workflow_context["user_id"])
        design_id = workflow_context["site_design_id"]

        # Create version
        v1 = service.create_version(design_id, DesignVersionCreate(version_name="Immutable Test"))
        original_snapshot = v1.snapshot_data.copy()
        db.commit()

        # Modify design extensively
        design = db.query(SiteDesign).get(design_id)
        design.name = "Completely Different"
        design.row_spacing_m = 10.0
        design.tilt_deg = 45.0
        design.total_modules = 200
        design.system_size_kwp = 80.0
        db.commit()

        # Verify snapshot unchanged
        db.refresh(v1)
        assert v1.snapshot_data == original_snapshot
        assert v1.snapshot_data["name"] == "Original Design"
        assert v1.snapshot_data["row_spacing_m"] == 2.0
        assert v1.snapshot_data["tilt_deg"] == 20.0

    def test_snapshot_with_complex_geometry(self, db, workflow_context):
        """Verify snapshot correctly captures complex geometries."""
        service = DesignVersionService(db, workflow_context["tenant_id"], workflow_context["user_id"])
        design_id = workflow_context["site_design_id"]

        # Add exclusion zones
        design = db.query(SiteDesign).get(design_id)
        exclusion_zones = [
            {
                "type": "Polygon",
                "coordinates": [[
                    [-118.2437 + 0.0001, 34.0522 + 0.0001],
                    [-118.2437 + 0.0002, 34.0522 + 0.0001],
                    [-118.2437 + 0.0002, 34.0522 + 0.0002],
                    [-118.2437 + 0.0001, 34.0522 + 0.0002],
                    [-118.2437 + 0.0001, 34.0522 + 0.0001]
                ]]
            },
            {
                "type": "Polygon",
                "coordinates": [[
                    [-118.2437 + 0.0003, 34.0522 + 0.0003],
                    [-118.2437 + 0.0004, 34.0522 + 0.0003],
                    [-118.2437 + 0.0004, 34.0522 + 0.0004],
                    [-118.2437 + 0.0003, 34.0522 + 0.0004],
                    [-118.2437 + 0.0003, 34.0522 + 0.0003]
                ]]
            }
        ]
        design.exclusion_zones = exclusion_zones
        db.commit()

        # Create version
        version = service.create_version(design_id, DesignVersionCreate(version_name="Complex Geometry"))

        # Verify exclusion zones captured
        assert len(version.snapshot_data["exclusion_zones"]) == 2
        assert version.snapshot_data["exclusion_zones"] == exclusion_zones


class TestVersionComparisonWorkflow:
    """Test version comparison scenarios."""

    def test_compare_multiple_versions(self, db, workflow_context):
        """Verify ability to compare multiple versions."""
        service = DesignVersionService(db, workflow_context["tenant_id"], workflow_context["user_id"])
        design_id = workflow_context["site_design_id"]

        # Create baseline
        v1 = service.create_version(design_id, DesignVersionCreate(
            version_name="Conservative",
            notes="Conservative spacing for safety"
        ))
        db.commit()

        # Modify for aggressive layout
        design = db.query(SiteDesign).get(design_id)
        design.row_spacing_m = 1.5
        design.edge_setback_m = 0.5
        design.total_modules = 120
        design.system_size_kwp = 48.0
        db.commit()

        v2 = service.create_version(design_id, DesignVersionCreate(
            version_name="Aggressive",
            notes="Maximized module count"
        ))
        db.commit()

        # Modify for balanced approach
        design.row_spacing_m = 1.75
        design.edge_setback_m = 0.75
        design.total_modules = 110
        design.system_size_kwp = 44.0
        db.commit()

        v3 = service.create_version(design_id, DesignVersionCreate(
            version_name="Balanced",
            notes="Balanced approach"
        ))
        db.commit()

        # Retrieve all versions
        versions = service.list_versions(design_id)
        assert len(versions) == 3

        # Compare key metrics
        conservative = next(v for v in versions if v.version_name == "Conservative")
        aggressive = next(v for v in versions if v.version_name == "Aggressive")
        balanced = next(v for v in versions if v.version_name == "Balanced")

        assert conservative.snapshot_data["total_modules"] == 100
        assert aggressive.snapshot_data["total_modules"] == 120
        assert balanced.snapshot_data["total_modules"] == 110

        assert conservative.snapshot_data["row_spacing_m"] == 2.0
        assert aggressive.snapshot_data["row_spacing_m"] == 1.5
        assert balanced.snapshot_data["row_spacing_m"] == 1.75


class TestVersionTenantIsolation:
    """Test tenant isolation for version operations."""

    def test_cross_tenant_version_access_denied(self, db, workflow_context):
        """Verify cross-tenant version access is blocked."""
        service = DesignVersionService(db, workflow_context["tenant_id"], workflow_context["user_id"])
        design_id = workflow_context["site_design_id"]

        # Create version
        version = service.create_version(design_id, DesignVersionCreate(version_name="Tenant 1 Version"))
        db.commit()

        # Create another tenant
        tenant2_id = uuid4()
        user2_id = uuid4()
        tenant2 = Tenant(id=tenant2_id, name="Tenant 2")
        user2 = User(
            id=user2_id,
            tenant_id=tenant2_id,
            email="tenant2@example.com",
            firebase_uid="tenant2_uid",
            role=UserRole.ADMIN
        )
        db.add(tenant2)
        db.add(user2)
        db.commit()

        # Try to access version from tenant 2
        service2 = DesignVersionService(db, tenant2_id, user2_id)

        with pytest.raises(HTTPException) as exc:
            service2.get_version_detail(version.id, design_id)
        assert exc.value.status_code == 404

        # Try to restore from tenant 2
        with pytest.raises(HTTPException) as exc:
            service2.restore_version(version.id, design_id)
        assert exc.value.status_code == 404

    def test_version_list_filtered_by_tenant(self, db, workflow_context):
        """Verify version listing is filtered by tenant."""
        service = DesignVersionService(db, workflow_context["tenant_id"], workflow_context["user_id"])
        design_id = workflow_context["site_design_id"]

        # Create versions for tenant 1
        service.create_version(design_id, DesignVersionCreate(version_name="T1 Version 1"))
        service.create_version(design_id, DesignVersionCreate(version_name="T1 Version 2"))
        db.commit()

        # Create another tenant and try to list
        tenant2_id = uuid4()
        user2_id = uuid4()
        tenant2 = Tenant(id=tenant2_id, name="Tenant 2")
        user2 = User(
            id=user2_id,
            tenant_id=tenant2_id,
            email="tenant2@example.com",
            firebase_uid="tenant2_uid",
            role=UserRole.ADMIN
        )
        db.add(tenant2)
        db.add(user2)
        db.commit()

        service2 = DesignVersionService(db, tenant2_id, user2_id)
        versions = service2.list_versions(design_id)
        assert len(versions) == 0


class TestVersionErrorHandling:
    """Test error handling in version workflows."""

    def test_restore_nonexistent_version(self, db, workflow_context):
        """Verify error when restoring non-existent version."""
        service = DesignVersionService(db, workflow_context["tenant_id"], workflow_context["user_id"])

        with pytest.raises(HTTPException) as exc:
            service.restore_version(uuid4(), workflow_context["site_design_id"])
        assert exc.value.status_code == 404

    def test_restore_version_to_wrong_design(self, db, workflow_context):
        """Verify error when restoring version to wrong design."""
        service = DesignVersionService(db, workflow_context["tenant_id"], workflow_context["user_id"])
        design_id = workflow_context["site_design_id"]

        # Create version
        version = service.create_version(design_id, DesignVersionCreate(version_name="Test"))
        db.commit()

        # Create another design
        design2 = SiteDesign(
            tender_id=workflow_context["tender_id"],
            name="Other Design",
            site_type="rooftop",
            equipment_module_id=workflow_context["module_id"],
            equipment_inverter_id=workflow_context["inverter_id"],
            site_boundary={"type": "Polygon", "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]},
            tilt_deg=10.0,
            created_by=workflow_context["user_id"]
        )
        db.add(design2)
        db.commit()

        # Try to restore version to wrong design
        with pytest.raises(HTTPException) as exc:
            service.restore_version(version.id, design2.id)
        assert exc.value.status_code == 404
        assert "does not belong" in exc.value.detail

    def test_create_version_with_invalid_snapshot(self, db, workflow_context):
        """Verify validation of snapshot data."""
        service = DesignVersionService(db, workflow_context["tenant_id"], workflow_context["user_id"])
        design_id = workflow_context["site_design_id"]

        # Corrupt design data
        design = db.query(SiteDesign).get(design_id)
        design.total_modules = 0  # Invalid
        design.system_size_kwp = 0  # Invalid
        db.commit()

        # Try to create version
        with pytest.raises(HTTPException) as exc:
            service.create_version(design_id, DesignVersionCreate(version_name="Invalid"))
        assert exc.value.status_code == 400
        assert "Invalid snapshot data" in exc.value.detail
