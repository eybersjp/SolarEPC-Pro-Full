import sys
from unittest.mock import MagicMock

# Mock weasyprint and matplotlib to avoid dependency issues on Windows
mock_weasyprint = MagicMock()
mock_weasyprint.HTML = MagicMock()
mock_weasyprint.CSS = MagicMock()
sys.modules["weasyprint"] = mock_weasyprint

mock_plt = MagicMock()
sys.modules["matplotlib"] = mock_plt
sys.modules["matplotlib.pyplot"] = mock_plt

import pytest
import httpx
from uuid import uuid4
from unittest.mock import MagicMock, patch
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os

from app.services.energy_estimation import EnergyEstimationService
from app.services.site_design import SiteDesignService
from app.services.placement_algorithm import PlacementAlgorithmService
from app.services.proposal import ProposalService
from app.models.models import SiteDesign, EnergyEstimate, Tender, Tenant, User, EquipmentModule, EquipmentInverter, FinancialAnalysis, BOQItem, Base

# -----------------------------------------------------------------------------
# Fixtures
# -----------------------------------------------------------------------------

@pytest.fixture
def db_session():
    """Real database session for integration tests, using local SQLite."""
    test_db_url = "sqlite:///./test_solarepc_error_scenarios.db"
    engine = create_engine(test_db_url, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    
    SessionLocalTest = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = SessionLocalTest()
    
    # Patch SessionLocal to use our test session
    with patch("app.core.database.SessionLocal", return_value=session):
        try:
            yield session
        finally:
            session.rollback()
            session.close()
            # Cleanup test DB
            if os.path.exists("./test_solarepc_error_scenarios.db"):
                try:
                    os.remove("./test_solarepc_error_scenarios.db")
                except:
                    pass

@pytest.fixture
def error_test_context(db_session: Session):
    """Setup a full tender/design context for error testing."""
    suffix = str(uuid4())[:8]
    tenant = Tenant(id=uuid4(), name=f"Error Test Tenant {suffix}")
    db_session.add(tenant)
    
    user = User(
        id=uuid4(), 
        tenant_id=tenant.id, 
        email=f"errortest_{suffix}@example.com", 
        firebase_uid=f"firebase_err_{suffix}"
    )
    db_session.add(user)

    tender = Tender(
        id=uuid4(),
        tenant_id=tenant.id,
        created_by=user.id,
        name=f"Error Test Tender {suffix}",
        latitude=34.0522,
        longitude=-118.2437
    )
    db_session.add(tender)

    module = EquipmentModule(
        id=uuid4(),
        manufacturer="Test", model="M1", wattage=400, efficiency=20.0,
        length_m=2.0, width_m=1.0, thickness_m=0.04,
        voc=40.0, isc=10.0, vmp=32.0, imp=9.0, is_global=True
    )
    inverter = EquipmentInverter(
        id=uuid4(),
        manufacturer="Test", model="I1", capacity_kw=10.0,
        max_dc_voltage=1000, mppt_voltage_range_min=200, mppt_voltage_range_max=800,
        max_input_current=20, num_mppt_channels=2, is_global=True
    )
    db_session.add(module)
    db_session.add(inverter)
    db_session.commit()

    design = SiteDesign(
        id=uuid4(),
        tender_id=tender.id,
        name=f"Error Test Design {suffix}",
        site_type="rooftop",
        created_by=user.id,
        equipment_module_id=module.id,
        equipment_inverter_id=inverter.id,
        site_boundary={"type": "Polygon", "coordinates": [[[0,0], [0,1], [1,1], [1,0], [0,0]]]},
        tilt_deg=20.0,
        azimuth_deg=180.0,
        system_size_kwp=10.0
    )
    db_session.add(design)
    db_session.commit()
    
    return design

# -----------------------------------------------------------------------------
# 2. PVWatts API Failure Tests
# -----------------------------------------------------------------------------

@pytest.mark.integration
class TestPVWattsAPIFailures:
    
    def _run_task_with_mock_db(self, db_session, estimate, params, side_effect=None, mock_response=None, expected_exception=None):
        """Helper to run task with mocked DB session and httpx."""
        from app.services.tasks import calculate_energy_task
        
        # Mock Session and Query
        mock_db = MagicMock()
        mock_query = MagicMock()
        mock_filter = MagicMock()
        
        # Important: For 'first()', return the existing estimate object
        mock_db.query.return_value = mock_query
        mock_query.filter.return_value = mock_filter
        mock_filter.first.return_value = estimate
        
        # Ensure SessionLocal returns our mock_db
        with patch("app.core.database.SessionLocal", return_value=mock_db):
            # Setup httpx mock
            mock_get_patcher = patch("httpx.get")
            mock_get = mock_get_patcher.start()
            
            if side_effect:
                mock_get.side_effect = side_effect
            elif mock_response:
                mock_get.return_value = mock_response
            
            try:
                mock_self = MagicMock()
                mock_self.request.retries = 3
                mock_self.max_retries = 3
                
                # We need to simulate the Celery task context if relying on self.request
                # Since we pass mock_self explicitly, it should work.
                
                if expected_exception:
                    with pytest.raises(expected_exception):
                        calculate_energy_task.run(mock_self, str(estimate.id), params)
                else:
                     calculate_energy_task.run(mock_self, str(estimate.id), params)
                     
                return mock_db
            except TypeError as e:
                # Fallback if binding issue: try without self
                if "positional arguments" in str(e):
                    if expected_exception:
                         with pytest.raises(expected_exception):
                             calculate_energy_task.run(str(estimate.id), params)
                    else:
                         calculate_energy_task.run(str(estimate.id), params)
                    return mock_db
                raise e
            finally:
                mock_get_patcher.stop()

    def test_timeout_scenario(self, db_session: Session, error_test_context: SiteDesign):
        """Test graceful handling of PVWatts timeouts."""
        from app.models.models import EnergyEstimate
        
        estimate = EnergyEstimate(
            id=uuid4(), site_design_id=error_test_context.id, status="calculating", retry_count=0
        )
        params = {"system_capacity": 10.0, "lat": 34.0, "lon": -118.0, "tilt": 20, "azimuth": 180}
        
        mock_db = self._run_task_with_mock_db(
            db_session, estimate, params, 
            side_effect=Exception("Connection Timeout"),
            expected_exception=Exception
        )
        
        # Verify status update
        assert estimate.status == "failed"
        assert "Connection Timeout" in estimate.error_message
        assert mock_db.commit.called

    def test_rate_limit_scenario(self, db_session: Session, error_test_context: SiteDesign):
        """Test handling of 429 Too Many Requests."""
        from app.models.models import EnergyEstimate
        
        estimate = EnergyEstimate(
            id=uuid4(), site_design_id=error_test_context.id, status="calculating", retry_count=0
        )
        params = {"system_capacity": 10.0, "lat": 34.0, "lon": -118.0, "tilt": 20, "azimuth": 180}
        
        mock_response = MagicMock()
        mock_response.status_code = 429
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "Too Many Requests", request=MagicMock(), response=mock_response
        )
        
        mock_db = self._run_task_with_mock_db(
            db_session, estimate, params, 
            mock_response=mock_response,
            expected_exception=httpx.HTTPStatusError
        )
        
        assert estimate.status == "failed"
        assert "Too Many Requests" in estimate.error_message
        assert mock_db.commit.called

    def test_invalid_response_structure(self, db_session: Session, error_test_context: SiteDesign):
        """Test handling of malformed JSON."""
        from app.models.models import EnergyEstimate
        
        estimate = EnergyEstimate(
            id=uuid4(), site_design_id=error_test_context.id, status="calculating", retry_count=0
        )
        params = {"system_capacity": 10.0, "lat": 34.0, "lon": -118.0, "tilt": 20, "azimuth": 180}
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"inputs": {}, "errors": []} # Missing outputs
        
        mock_db = self._run_task_with_mock_db(
            db_session, estimate, params, 
            mock_response=mock_response
        )
        
        assert estimate.status == "completed"
        assert estimate.annual_energy_kwh == 0
        assert mock_db.commit.called

    def test_network_connection_error(self, db_session: Session, error_test_context: SiteDesign):
        """Test handling of connection errors."""
        from app.models.models import EnergyEstimate
        
        estimate = EnergyEstimate(
            id=uuid4(), site_design_id=error_test_context.id, status="calculating", retry_count=0
        )
        params = {"system_capacity": 10.0, "lat": 34.0, "lon": -118.0, "tilt": 20, "azimuth": 180}
        
        mock_db = self._run_task_with_mock_db(
            db_session, estimate, params, 
            side_effect=httpx.ConnectError("Connection Refused"),
            expected_exception=httpx.ConnectError
        )
        
        assert estimate.status == "failed"
        assert mock_db.commit.called


# -----------------------------------------------------------------------------
# 3. Invalid Polygon Geometry Tests
# -----------------------------------------------------------------------------

@pytest.mark.integration
class TestInvalidGeometryHandling:

    def test_self_intersecting_polygon(self):
        """Test bowtie shape (self-intersecting)."""
        from app.utils.geojson_validator import validate_geojson_polygon
        
        # Bowtie
        bowtie = {
            "type": "Polygon",
            "coordinates": [[[0,0], [1,1], [0,1], [1,0], [0,0]]]
        }
        
        is_valid, error = validate_geojson_polygon(bowtie)
        assert is_valid is False
        assert "Invalid geometry" in error

    def test_too_few_points(self):
        """Test polygon with insufficient points."""
        from app.utils.geojson_validator import validate_geojson_polygon
        
        line = {
            "type": "Polygon",
            "coordinates": [[[0,0], [1,1]]]
        }
        
        is_valid, error = validate_geojson_polygon(line)
        assert is_valid is False
        assert "at least 3 vertices" in error

    def test_unclosed_polygon(self):
        """Test polygon where start != end."""
        from app.utils.geojson_validator import validate_geojson_polygon
        
        open_poly = {
            "type": "Polygon",
            "coordinates": [[[0,0], [1,0], [1,1], [0,1]]] # No closing [0,0]
        }
        
        is_valid, error = validate_geojson_polygon(open_poly)
        assert is_valid is False
        assert "must be closed" in error

    def test_invalid_structure(self):
        """Test malformed GeoJSON."""
        from app.utils.geojson_validator import validate_geojson_polygon
        
        bad_type = {"type": "Point", "coordinates": [0,0]}
        is_valid, error = validate_geojson_polygon(bad_type)
        assert is_valid is False
        assert "must be 'Polygon'" in error
        
        missing_coords = {"type": "Polygon"}
        is_valid, error = validate_geojson_polygon(missing_coords)
        assert is_valid is False
        assert "Invalid coordinates" in error

    def test_out_of_range_coordinates(self):
        """Test coordinates outside WGS84 bounds."""
        from app.utils.geojson_validator import validate_geojson_polygon
        
        bad_coords = {
            "type": "Polygon",
            "coordinates": [[[0,0], [200, 0], [200, 10], [0, 10], [0,0]]] # Longitude 200
        }
        
        is_valid, error = validate_geojson_polygon(bad_coords)
        assert is_valid is False
        assert "Invalid coordinate values" in error


# -----------------------------------------------------------------------------
# 4. Placement Algorithm Edge Cases
# -----------------------------------------------------------------------------

@pytest.mark.integration
class TestPlacementAlgorithmEdgeCases:
    
    def test_no_modules_fit_due_to_setback(self):
        """Test small boundary with large setback."""
        # 10x10m square
        boundary = {
            "type": "Polygon",
            "coordinates": [[[0,0], [10,0], [10,10], [0,10], [0,0]]]
        }
        # Setback 6m -> implies 12m needed, so empty safe area
        settings = {"edge_setback_m": 6.0}
        dims = {"length_m": 2.0, "width_m": 1.0}
        
        result = PlacementAlgorithmService.calculate_placement(boundary, [], dims, settings)
        
        assert result["total_modules"] == 0
        assert "Setback too large" in result["stats"].get("error", "")

    def test_empty_boundary_area(self):
        """Test effectively empty boundary."""
        # Zero area polygon (e.g. all points same or collinear)
        # Note: geojson validator normally catches this, but service should handle if passed
        boundary = {
            "type": "Polygon",
            "coordinates": [[[0,0], [0,0], [0,0], [0,0]]]
        }
        
        # This basically causes safe_area.is_empty or just 0 area
        # We can simulate by a very small polygon < setback
        boundary_small = {
            "type": "Polygon",
            "coordinates": [[[0,0], [0.1,0], [0.1,0.1], [0,0.1], [0,0]]]
        }
        settings = {"edge_setback_m": 1.0}
        dims = {"length_m": 2.0, "width_m": 1.0}
        
        result = PlacementAlgorithmService.calculate_placement(boundary_small, [], dims, settings)
        # Should be empty, possibly error message
        assert result["total_modules"] == 0
    
    def test_exclusion_zones_covering_site(self):
        """Test exclusion zone that overlaps entire safe area."""
        boundary = {
            "type": "Polygon",
            "coordinates": [[[0,0], [10,0], [10,10], [0,10], [0,0]]]
        }
        exclusion = {
            "type": "Polygon",
            # Cover entire area
            "coordinates": [[[-1,-1], [11,-1], [11,11], [-1,11], [-1,-1]]]
        }
        
        settings = {"edge_setback_m": 0.0}
        dims = {"length_m": 1.0, "width_m": 1.0}
        
        result = PlacementAlgorithmService.calculate_placement(boundary, [exclusion], dims, settings)
        assert result["total_modules"] == 0


# -----------------------------------------------------------------------------
# 5. PDF Generation Failure Tests
# -----------------------------------------------------------------------------

@pytest.mark.integration
class TestProposalGenerationErrors:
    
    @pytest.fixture(autouse=True)
    def mock_storage(self):
        """Mock storage backend for all tests in this class."""
        with patch("app.services.proposal.get_storage_backend") as mock_get_backend:
            mock_backend = MagicMock()
            mock_backend.save.return_value = "mock_storage_id_123"
            mock_get_backend.return_value = mock_backend
            yield mock_backend

    def test_missing_energy_data(self, db_session: Session, error_test_context: SiteDesign):
        """Test PDF generation when energy estimate is missing."""
        service = ProposalService(db_session, tenant_id=error_test_context.tender.tenant_id, user_id=error_test_context.created_by)
        
        # Ensure no energy estimate
        db_session.query(EnergyEstimate).filter(EnergyEstimate.site_design_id == error_test_context.id).delete()
        db_session.commit()
        
        # Should not raise
        storage_id = service.generate_pdf(error_test_context.id)
        assert storage_id is not None

    def test_weasyprint_failure(self, db_session: Session, error_test_context: SiteDesign):
        """Test handling of PDF rendering exceptions."""
        service = ProposalService(db_session, tenant_id=error_test_context.tender.tenant_id, user_id=error_test_context.created_by)
        
        # Mock HTML via sys.modules['weasyprint'] which is already mocked in this file
        mock_weasyprint = sys.modules["weasyprint"]
        mock_weasyprint.HTML.side_effect = Exception("WeasyPrint crash")
        
        try:
            with pytest.raises(Exception) as excinfo:
                service.generate_pdf(error_test_context.id)
            assert "WeasyPrint crash" in str(excinfo.value)
        finally:
            # Cleanup side effect
            mock_weasyprint.HTML.side_effect = None
            
    def test_chart_generation_failure(self, db_session: Session, error_test_context: SiteDesign):
        """Test graceful continuation if chart generation fails."""
        # Create energy estimate
        estimate = EnergyEstimate(
            id=uuid4(),
            site_design_id=error_test_context.id,
            status="completed",
            annual_energy_kwh=1000,
            monthly_energy_kwh=[100]*12,
            capacity_factor=0.2
        )
        db_session.add(estimate)
        db_session.commit()
        
        service = ProposalService(db_session, tenant_id=error_test_context.tender.tenant_id, user_id=error_test_context.created_by)
        
        # Mock _generate_monthly_chart to fail or return None
        with patch.object(service, '_generate_monthly_chart', side_effect=Exception("Matplotlib crash")):
            # Should still succeed in generating PDF, just without chart
            storage_id = service.generate_pdf(error_test_context.id)
            assert storage_id is not None

    def test_template_not_found(self, db_session: Session, error_test_context: SiteDesign):
        """Test handling when Jinja2 template is missing."""
        from jinja2 import TemplateNotFound
        service = ProposalService(db_session, tenant_id=error_test_context.tender.tenant_id, user_id=error_test_context.created_by)
        
        # Mock Environment.get_template to raise TemplateNotFound
        with patch("app.services.proposal.Environment.get_template", side_effect=TemplateNotFound("proposal.html")):
             with pytest.raises(TemplateNotFound):
                 service.generate_pdf(error_test_context.id)

    def test_missing_financial_and_bom_data(self, db_session: Session, error_test_context: SiteDesign):
        """Test PDF generation when Financial Analysis and BOM are missing."""
        service = ProposalService(db_session, tenant_id=error_test_context.tender.tenant_id, user_id=error_test_context.created_by)
        
        # Ensure no financial/BOM data
        db_session.query(FinancialAnalysis).filter(FinancialAnalysis.site_design_id == error_test_context.id).delete()
        db_session.query(BOQItem).filter(BOQItem.tender_id == error_test_context.tender_id).delete()
        db_session.commit()
        
        # Should succeed with graceful defaults
        storage_id = service.generate_pdf(error_test_context.id)
        assert storage_id is not None


# -----------------------------------------------------------------------------
# 6. Data Persistence and Rollback
# -----------------------------------------------------------------------------

@pytest.mark.integration
class TestDataPersistenceAndRollback:
    
    def test_transaction_rollback_on_error(self, db_session: Session, error_test_context: SiteDesign):
        """Verify mismatched updates roll back."""
        original_name = error_test_context.name
        
        try:
            with db_session.begin_nested(): # Create savepoint
                error_test_context.name = "New Name"
                db_session.flush()
                raise ValueError("Simulated error")
        except ValueError:
            db_session.rollback()
            
        db_session.refresh(error_test_context)
        assert error_test_context.name == original_name

    def test_concurrent_updates_optimistic(self, db_session: Session, error_test_context: SiteDesign):
        """
        Simulate concurrent edits.
        
        Note: Use distinct sessions to simulate real concurrency if using a real DB.
        With SQLite in-memory/file shared thread, it's tricky, but we can verify logic.
        """
        # This is more about ensuring we don't end up with corrupted state
        # or that SQLAlchemy handles versioning if configured (we don't have version col, so 'last write wins')
        
        # 1. Update in main session
        error_test_context.tilt_deg = 25.0
        db_session.commit()
        
        # 2. Simulate another update
        error_test_context.tilt_deg = 30.0
        db_session.commit()
        
        # Final state should be 30.0 (last write)
        db_session.refresh(error_test_context)
        assert error_test_context.tilt_deg == 30.0
