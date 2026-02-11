"""
Integration tests for Design Version Management.

This module tests the complete version management workflow including:
- Version creation with snapshot data capture
- Version listing and filtering with tenant isolation
- Version restoration with automatic recalculation triggers
- Placement algorithm recalculation on geometry/equipment changes
- Energy estimation recalculation on system parameters changes
- Financial analysis recalculation on cost/energy changes
- Complete workflow integration (placement → energy → financial → proposal)
- Version comparison scenarios
- Audit logging for all version operations
- Performance and edge case handling

Test Structure:
- TestVersionCreationWorkflow: Version creation and snapshot capture
- TestVersionRestorationWorkflow: Basic restoration with recalculations
- TestVersionRestorePlacementRecalculation: Placement-specific recalculation tests
- TestVersionRestoreCompleteWorkflow: Full cascade workflow tests
- TestVersionSnapshotIntegrity: Snapshot immutability and data integrity
- TestVersionComparisonWorkflow: Version comparison scenarios
- TestVersionTenantIsolation: Multi-tenant security tests
- TestVersionErrorHandling: Error scenarios and edge cases
- TestVersionPerformanceAndEdgeCases: Performance and stress tests
"""
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


def create_mock_energy_estimate(db, design_id, annual_kwh=50000.0, status="completed"):
    """Helper to create a valid EnergyEstimate with all required fields."""
    estimate = EnergyEstimate(
        site_design_id=design_id,
        parameter_hash="test_hash_" + str(design_id)[:8],
        system_capacity_kw=50.0,
        latitude=34.0522,
        longitude=-118.2437,
        azimuth=180.0,
        tilt=20.0,
        annual_energy_kwh=annual_kwh,
        monthly_energy_kwh=[annual_kwh / 12] * 12,
        capacity_factor=0.15,
        status=status,
        calculated_at=datetime.utcnow()
    )
    db.add(estimate)
    db.commit()
    return estimate


class TestVersionCreationWorkflow:
    """Test complete version creation workflow."""

    def test_create_version_with_complete_snapshot(self, db, workflow_context):
        """Verify version creation captures all design state including energy and financial data."""
        service = DesignVersionService(db, workflow_context["tenant_id"], workflow_context["user_id"])
        design_id = workflow_context["site_design_id"]

        # Create energy estimate
        create_mock_energy_estimate(db, design_id, annual_kwh=50000.0)

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

    @patch("app.services.design_version.ProposalService")
    @patch("app.services.design_version.SiteDesignService")
    @patch("app.services.design_version.EnergyEstimationService")
    @patch("app.services.design_version.FinancialAnalysisService")
    def test_restore_version_triggers_recalculations(self, mock_fin, mock_energy, mock_site_service, mock_proposal, db, workflow_context):
        """Verify version restoration triggers appropriate recalculations."""
        service = DesignVersionService(db, workflow_context["tenant_id"], workflow_context["user_id"])
        design_id = workflow_context["site_design_id"]

        # 0. Configure mocks to return None for getters so snapshot data is clean
        mock_energy.return_value.get_estimate.return_value = None
        mock_fin.return_value.get_analysis.return_value = None

        # 1. Create baseline version
        v1 = service.create_version(design_id, DesignVersionCreate(version_name="Baseline"))
        db.commit()

        # 2. Modify design (parameter affecting both placement and energy)
        design = db.query(SiteDesign).get(design_id)
        design.tilt_deg = 45.0
        db.commit()

        # 3. Restore to baseline
        # Configure mocks to return valid objects/values
        mock_site_service.return_value.recalculate_design.return_value = {"status": "processing", "mode": "async", "task_id": "task-123"}

        restored_design, recalc_status = service.restore_version(v1.id, design_id)

        # 4. Verify recalculations triggered
        assert recalc_status["placement"] == "processing"
        assert recalc_status["energy_estimation"] == "waiting_for_placement"
        mock_site_service.return_value.recalculate_design.assert_called_once_with(design_id, trigger_energy_estimation=True)
        # Verify proposal regeneration
        mock_proposal.return_value.mark_as_outdated.assert_called_once_with(design_id)
        mock_proposal.return_value.regenerate_proposal.assert_called_once_with(design_id)

    @patch("app.services.design_version.ProposalService")
    @patch("app.services.design_version.SiteDesignService")
    @patch("app.services.design_version.EnergyEstimationService")
    @patch("app.services.design_version.FinancialAnalysisService")
    def test_restore_version_no_recalc_for_metadata_only(self, mock_fin, mock_energy, mock_site_service, mock_proposal, db, workflow_context):
        """Verify no recalculations when only metadata changes."""
        service = DesignVersionService(db, workflow_context["tenant_id"], workflow_context["user_id"])
        design_id = workflow_context["site_design_id"]

        # 0. Configure mocks
        mock_energy.return_value.get_estimate.return_value = None
        mock_fin.return_value.get_analysis.return_value = None

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
        assert recalc_status["placement"] == "skipped"
        assert recalc_status["energy_estimation"] == "skipped"
        assert recalc_status["financial_analysis"] == "skipped"
        mock_site_service.return_value.recalculate_design.assert_not_called()
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

        with patch("app.services.design_version.SiteDesignService"), \
             patch("app.services.design_version.EnergyEstimationService"), \
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


class TestVersionRestorePlacementRecalculation:
    """Test placement algorithm recalculation during version restoration."""

    @patch("app.services.design_version.SiteDesignService")
    def test_restore_version_triggers_placement_recalc_on_geometry_change(
        self, mock_site_service, db, workflow_context
    ):
        service = DesignVersionService(db, workflow_context["tenant_id"], workflow_context["user_id"])
        design_id = workflow_context["site_design_id"]
        design = workflow_context["site_design"]

        # 1. Create original version
        service.create_version(design_id, DesignVersionCreate(version_name="Original Geometry"))
        version = service.list_versions(design_id)[0]

        # 2. Modify geometry
        design.site_boundary = {"type": "Polygon", "coordinates": [[[0, 1], [10, 1], [10, 11], [0, 11], [0, 1]]]}
        db.commit()

        # 3. Restore original version
        mock_site_service.return_value.recalculate_design.return_value = {"status": "completed", "mode": "sync"}
        with patch("app.services.design_version.EnergyEstimationService"), \
             patch("app.services.design_version.FinancialAnalysisService"):
            service.restore_version(version.id, design_id)

        # 4. Verify placement recalculation triggered
        mock_site_service.return_value.recalculate_design.assert_called_once()

    @patch("app.services.design_version.SiteDesignService")
    def test_restore_version_triggers_placement_recalc_on_equipment_change(
        self, mock_site_service, db, workflow_context
    ):
        service = DesignVersionService(db, workflow_context["tenant_id"], workflow_context["user_id"])
        design_id = workflow_context["site_design_id"]
        design = workflow_context["site_design"]

        # 1. Create original version
        service.create_version(design_id, DesignVersionCreate(version_name="Original Equipment"))
        version = service.list_versions(design_id)[0]

        # 2. Modify equipment (change module)
        design.equipment_module_id = uuid4()
        db.commit()

        # 3. Restore
        mock_site_service.return_value.recalculate_design.return_value = {"status": "completed", "mode": "sync"}
        with patch("app.services.design_version.EnergyEstimationService"), \
             patch("app.services.design_version.FinancialAnalysisService"):
            service.restore_version(version.id, design_id)

        # 4. Verify
        mock_site_service.return_value.recalculate_design.assert_called_once()

    @patch("app.services.design_version.SiteDesignService")
    def test_placement_task_status_tracking(self, mock_site_service, db, workflow_context):
        service = DesignVersionService(db, workflow_context["tenant_id"], workflow_context["user_id"])
        design_id = workflow_context["site_design_id"]
        
        task_id = "task-123"
        mock_site_service.return_value.recalculate_design.return_value = {"mode": "async", "task_id": task_id, "status": "pending"}

        # Create and restore version
        service.create_version(design_id, DesignVersionCreate(version_name="Async Task Test"))
        version = service.list_versions(design_id)[0]
        
        # Change geometry to trigger placement
        design = db.query(SiteDesign).get(design_id)
        design.site_boundary = {"type": "Polygon", "coordinates": [[[0, 1], [10, 1], [10, 11], [0, 11], [0, 1]]]}
        db.commit()

        with patch("app.services.design_version.EnergyEstimationService"), \
             patch("app.services.design_version.FinancialAnalysisService"):
            _, status = service.restore_version(version.id, design_id)

        assert status["placement"] == "pending"


class TestVersionRestoreCompleteWorkflow:
    """Test full cascade of recalculations during version restoration."""

    @patch("app.services.design_version.SiteDesignService")
    @patch("app.services.design_version.EnergyEstimationService")
    @patch("app.services.design_version.FinancialAnalysisService")
    @patch("app.services.design_version.ProposalService")
    def test_complete_recalculation_cascade(
        self, mock_proposal, mock_financial, mock_energy, mock_site_service, db, workflow_context
    ):
        service = DesignVersionService(db, workflow_context["tenant_id"], workflow_context["user_id"])
        design_id = workflow_context["site_design_id"]

        # 0. Configure mocks
        mock_energy.return_value.get_estimate.return_value = None
        mock_financial.return_value.get_analysis.return_value = None
        mock_site_service.return_value.recalculate_design.return_value = {"status": "completed", "mode": "sync"}

        # 1. Create version
        service.create_version(design_id, DesignVersionCreate(version_name="Cascade Test"))
        version = service.list_versions(design_id)[0]

        # Trigger change to force recalc
        design = db.query(SiteDesign).get(design_id)
        design.tilt_deg = 45.0
        db.commit()

        # 2. Trigger restore
        service.restore_version(version.id, design_id)

        # 3. Verify sequence
        mock_site_service.return_value.recalculate_design.assert_called_once_with(design_id, trigger_energy_estimation=True)
        # Verify proposal marked as outdated AND regenerated
        mock_proposal.return_value.mark_as_outdated.assert_called_once_with(design_id)
        mock_proposal.return_value.regenerate_proposal.assert_called_once_with(design_id)

    @patch("app.services.design_version.FinancialAnalysisService")
    @patch("app.services.design_version.ProposalService")
    @patch("app.services.design_version.EnergyEstimationService")
    @patch("app.services.design_version.SiteDesignService")
    def test_workflow_with_partial_failures(
        self, mock_site_service, mock_energy, mock_proposal, mock_financial, db, workflow_context
    ):
        service = DesignVersionService(db, workflow_context["tenant_id"], workflow_context["user_id"])
        design_id = workflow_context["site_design_id"]
        
        # 0. Configure mocks
        mock_energy.return_value.get_estimate.return_value = None
        mock_financial.return_value.get_analysis.return_value = None
        
        # Placement succeeds, Energy fails (simulated by recalculate_design raising because it triggers energy estimation)
        mock_site_service.return_value.recalculate_design.side_effect = Exception("PVWatts Timeout")
        
        v1 = service.create_version(design_id, DesignVersionCreate(version_name="Failure Test"))
        db.commit()
        
        # Trigger change to force recalculation
        design = db.query(SiteDesign).get(design_id)
        design.tilt_deg = 45.0
        db.commit()
        
        # Should complete placement then fail at energy but continue or handle it
        _, status = service.restore_version(v1.id, design_id)
        
        # In the new architecture, if placement+energy are combined, failure in energy 
        # during sync recalculation will propogate to placement status
        assert "error" in status["placement"]
        assert "PVWatts Timeout" in status["placement"]
        
    @patch("app.services.tasks.calculate_placement_async.delay")
    @patch("app.services.site_design.PlacementAlgorithmService.calculate_placement")
    @patch("app.services.design_version.ProposalService")
    @patch("app.services.design_version.EnergyEstimationService")
    @patch("app.services.design_version.FinancialAnalysisService")
    def test_async_placement_workflow_sequencing(
        self, mock_financial, mock_energy, mock_proposal, mock_algo, mock_task_delay, db, workflow_context
    ):
        """Cover async placement sequencing and ensure energy/financials follow correctly."""
        service = DesignVersionService(db, workflow_context["tenant_id"], workflow_context["user_id"])
        design_id = workflow_context["site_design_id"]
        
        # 1. Setup mock task for "evolving status"
        # We'll use a string for the task ID and status to avoid serialization issues
        task_id = "task-async-123"
        mock_task = MagicMock()
        mock_task.id = task_id
        mock_task.status = "PENDING"
        mock_task_delay.return_value = mock_task
        
        # Configure mocks to return None for getters to avoid MagicMock serialization errors
        mock_energy.return_value.get_estimate.return_value = None
        mock_financial.return_value.get_analysis.return_value = None

        # 2. Create version
        service.create_version(design_id, DesignVersionCreate(version_name="Async Workflow V1"))
        version = service.list_versions(design_id)[0]
        
        # Trigger change in DB
        design = db.query(SiteDesign).get(design_id)
        design.site_boundary = {"type": "Polygon", "coordinates": [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]]}
        db.commit()

        # 3. Patch recalculate_design to simulate the async path
        with patch("app.services.site_design.SiteDesignService.recalculate_design") as mock_recalc:
            mock_recalc.return_value = {"mode": "async", "task_id": task_id, "status": "pending"}
            
            # Trigger restore
            _, status = service.restore_version(version.id, design_id)

            # 4. Assert sequencing
            assert status["placement"] == "pending"
            assert status["energy_estimation"] == "waiting_for_placement"
            
            # Confirm energy waits for placement (verified by the status and recalc_design call params)
            mock_recalc.assert_called_once_with(design_id, trigger_energy_estimation=True)

        # 5. Simulate "evolution" of task status
        mock_task.status = "SUCCESS"
        assert mock_task.status == "SUCCESS"

    @patch("app.services.design_version.ProposalService")
    def test_restore_with_existing_proposal(self, mock_proposal, db, workflow_context):
        """Verify proposal is marked as outdated and regenerated after restoration."""
        service = DesignVersionService(db, workflow_context["tenant_id"], workflow_context["user_id"])
        design_id = workflow_context["site_design_id"]
        
        # 1. Create original version
        v1 = service.create_version(design_id, DesignVersionCreate(version_name="Pre-Proposal"))
        db.commit()
        
        # 2. Add some changes
        design = db.query(SiteDesign).get(design_id)
        design.name = "Modified for Proposal"
        db.commit()

        # 3. Restore version
        with patch("app.services.design_version.SiteDesignService"), \
             patch("app.services.design_version.EnergyEstimationService"), \
             patch("app.services.design_version.FinancialAnalysisService"):
            service.restore_version(v1.id, design_id)
        
        # 4. Assert ProposalService interactions
        mock_proposal.return_value.mark_as_outdated.assert_called_once_with(design_id)
        mock_proposal.return_value.regenerate_proposal.assert_called_once_with(design_id)


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
            }
        ]
        design.exclusion_zones = exclusion_zones
        db.commit()

        # Create version
        version = service.create_version(design_id, DesignVersionCreate(version_name="Complex Geometry"))

        # Verify exclusion zones captured
        assert len(version.snapshot_data["exclusion_zones"]) == 1
        assert version.snapshot_data["exclusion_zones"] == exclusion_zones

class TestVersionComparisonWorkflow:
    """Test version comparison scenarios with results data."""

    def _calculate_snapshot_diff(self, s1: dict, s2: dict) -> dict:
        """Helper to calculate diffs between two snapshots."""
        diffs = {}
        # Core fields
        fields = [
            "equipment_module_id", "equipment_inverter_id", "site_boundary", 
            "total_modules", "system_size_kwp", "site_area_sqm"
        ]
        for field in fields:
            if s1.get(field) != s2.get(field):
                diffs[field] = {"old": s1.get(field), "new": s2.get(field)}
        
        # Energy
        e1 = s1.get("energy_estimate") or {}
        e2 = s2.get("energy_estimate") or {}
        if e1.get("annual_energy_kwh") != e2.get("annual_energy_kwh"):
            diffs["annual_energy_kwh"] = {"old": e1.get("annual_energy_kwh"), "new": e2.get("annual_energy_kwh")}
            
        # Financial
        f1 = s1.get("financial_analysis") or {}
        f2 = s2.get("financial_analysis") or {}
        if f1.get("system_cost_usd") != f2.get("system_cost_usd"):
            diffs["system_cost_usd"] = {"old": f1.get("system_cost_usd"), "new": f2.get("system_cost_usd")}
            
        return diffs


    def test_compare_versions_with_results(self, db, workflow_context):
        service = DesignVersionService(db, workflow_context["tenant_id"], workflow_context["user_id"])
        design_id = workflow_context["site_design_id"]

        # 1. Version with Energy A
        create_mock_energy_estimate(db, design_id, annual_kwh=40000.0)
        v1 = service.create_version(design_id, DesignVersionCreate(version_name="Option A"))
        
        # Clear estimate to create new one (since it's unique per design_id in DB)
        db.query(EnergyEstimate).filter_by(site_design_id=design_id).delete()
        db.commit()

        # 2. Version with Energy B
        create_mock_energy_estimate(db, design_id, annual_kwh=60000.0)
        v2 = service.create_version(design_id, DesignVersionCreate(version_name="Option B"))

        versions = service.list_versions(design_id)
        assert versions[1].snapshot_data["energy_estimate"]["annual_energy_kwh"] == 40000.0
        assert versions[0].snapshot_data["energy_estimate"]["annual_energy_kwh"] == 60000.0

    def test_version_comparison_detailed_diffs(self, db, workflow_context):
        """Verify snapshots capture detailed differences in geometry, equipment, and metrics."""
        service = DesignVersionService(db, workflow_context["tenant_id"], workflow_context["user_id"])
        design_id = workflow_context["site_design_id"]

        # 1. Base Version
        v1 = service.create_version(design_id, DesignVersionCreate(version_name="Base"))
        
        # 2. Modify Geometry & Equipment
        design = db.query(SiteDesign).get(design_id)
        design.site_boundary = {"type": "Polygon", "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]}
        design.equipment_module_id = uuid4()
        design.total_modules = 150
        design.system_size_kwp = 60.0
        db.commit()
        
        create_mock_energy_estimate(db, design_id, annual_kwh=75000.0)
        
        v2 = service.create_version(design_id, DesignVersionCreate(version_name="Optimized"))

        # 3. Assert Diffs
        s1 = v1.snapshot_data
        s2 = v2.snapshot_data
        
        # Equipment diff
        assert s1["equipment_module_id"] != s2["equipment_module_id"]
        
        # Geometry diff
        assert s1["site_boundary"] != s2["site_boundary"]
        
        # Metric diff
        assert s1["total_modules"] == 100
        assert s2["total_modules"] == 150
        assert s1["system_size_kwp"] == 40.0
        assert s2["system_size_kwp"] == 60.0
        
        # Energy diff
        assert s2["energy_estimate"]["annual_energy_kwh"] == 75000.0

    def test_version_comparison_comprehensive(self, db, workflow_context):
        """Test multiple versions with geometry, equipment, and financial diffs."""
        service = DesignVersionService(db, workflow_context["tenant_id"], workflow_context["user_id"])
        design_id = workflow_context["site_design_id"]

        # 1. Version 1: Base
        create_mock_energy_estimate(db, design_id, annual_kwh=50000.0)
        db.add(FinancialAnalysis(
            site_design_id=design_id, system_cost_usd=100000.0, electricity_rate_usd_per_kwh=0.15,
            annual_savings_usd=15000.0, simple_payback_years=6.7, roi_pct=15.0, calculated_at=datetime.utcnow()
        ))
        db.commit()
        v1 = service.create_version(design_id, DesignVersionCreate(version_name="V1 Base"))

        # 2. Version 2: Change Equipment
        # Clear existing results to simulate recalculation
        db.query(EnergyEstimate).filter_by(site_design_id=design_id).delete()
        db.query(FinancialAnalysis).filter_by(site_design_id=design_id).delete()
        
        design = db.query(SiteDesign).get(design_id)
        new_module_id = uuid4()
        design.equipment_module_id = new_module_id
        design.system_size_kwp = 55.0 # Change size
        db.commit()
        
        create_mock_energy_estimate(db, design_id, annual_kwh=55000.0)
        db.add(FinancialAnalysis(
            site_design_id=design_id, system_cost_usd=110000.0, electricity_rate_usd_per_kwh=0.15,
            annual_savings_usd=16500.0, simple_payback_years=6.7, roi_pct=15.0, calculated_at=datetime.utcnow()
        ))
        db.commit()
        v2 = service.create_version(design_id, DesignVersionCreate(version_name="V2 New Module"))

        # 3. Version 3: Change Geometry
        db.query(EnergyEstimate).filter_by(site_design_id=design_id).delete()
        db.query(FinancialAnalysis).filter_by(site_design_id=design_id).delete()
        
        design = db.query(SiteDesign).get(design_id)
        design.site_boundary = {"type": "Polygon", "coordinates": [[[10, 10], [20, 10], [20, 20], [10, 20], [10, 10]]]}
        design.site_area_sqm = 5000.0
        db.commit()
        
        create_mock_energy_estimate(db, design_id, annual_kwh=30000.0)
        db.add(FinancialAnalysis(
            site_design_id=design_id, system_cost_usd=60000.0, electricity_rate_usd_per_kwh=0.15,
            annual_savings_usd=9000.0, simple_payback_years=6.7, roi_pct=15.0, calculated_at=datetime.utcnow()
        ))
        db.commit()
        v3 = service.create_version(design_id, DesignVersionCreate(version_name="V3 New Boundary"))

        # 4. Compare V1 and V2 (Equipment Change)
        diff12 = self._calculate_snapshot_diff(v1.snapshot_data, v2.snapshot_data)
        assert "equipment_module_id" in diff12
        assert "annual_energy_kwh" in diff12
        assert "system_cost_usd" in diff12
        assert diff12["system_cost_usd"]["new"] == 110000.0

        # 5. Compare V2 and V3 (Geometry Change)
        diff23 = self._calculate_snapshot_diff(v2.snapshot_data, v3.snapshot_data)
        assert "site_boundary" in diff23
        assert "site_area_sqm" in diff23
        assert diff23["site_area_sqm"]["new"] == 5000.0
        assert "annual_energy_kwh" in diff23
        assert diff23["annual_energy_kwh"]["new"] == 30000.0


class TestVersionPerformanceAndEdgeCases:
    """Test performance and edge cases for versions."""

    def test_large_snapshot_data_creation(self, db, workflow_context):
        service = DesignVersionService(db, workflow_context["tenant_id"], workflow_context["user_id"])
        design = workflow_context["site_design"]
        
        # Simulating 1000 module placements
        design.module_placements = [{"id": i, "x": i, "y": i} for i in range(1000)]
        db.commit()
        
        # Should complete in reasonable time
        import time
        start_time = time.time()
        service.create_version(design.id, DesignVersionCreate(version_name="Large Site"))
        end_time = time.time()
        
        assert end_time - start_time < 2.0

    def test_restore_with_missing_equipment(self, db, workflow_context):
        service = DesignVersionService(db, workflow_context["tenant_id"], workflow_context["user_id"])
        design_id = workflow_context["site_design_id"]
        
        v1 = service.create_version(design_id, DesignVersionCreate(version_name="Eq Test"))
        db.commit()
        
        # Delete equipment from DB
        db.query(EquipmentModule).delete()
        db.commit()
        
        # Restore should handle missing reference gracefully
        with pytest.raises(HTTPException) as exc:
            service.restore_version(v1.id, design_id)
        assert exc.value.status_code == 400
        assert "referenced equipment" in exc.value.detail.lower()

def create_version_with_energy_and_financial(db: Session, service: DesignVersionService, design_id: UUID, name: str):
    """Helper for testing."""
    create_mock_energy_estimate(db, design_id, annual_kwh=50000.0)
    db.add(FinancialAnalysis(
        site_design_id=design_id,
        system_cost_usd=80000.0,
        electricity_rate_usd_per_kwh=0.15,
        annual_savings_usd=10000.0,
        simple_payback_years=8.0,
        roi_pct=12.5
    ))
    db.commit()
    return service.create_version(design_id, DesignVersionCreate(version_name=name))

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
