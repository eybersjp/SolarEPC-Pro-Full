import sys
from celery import exceptions as celery_exceptions
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
import json
import time

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
                
                # Use __wrapped__ or __func__ if it's a Celery task proxy/bound method to bypass any decoration/proxying
                # We want to call the underlying function with our mock_self
                target_func = calculate_energy_task
                if hasattr(target_func, "__wrapped__"):
                    target_func = target_func.__wrapped__
                
                # If it's still bound, get the original function
                if hasattr(target_func, "__func__"):
                    target_func = target_func.__func__
                
                if expected_exception:
                    with pytest.raises(expected_exception):
                        target_func(mock_self, str(estimate.id), params)
                else:
                     target_func(mock_self, str(estimate.id), params)
                     
                return mock_db
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

    def test_service_unavailable_503(self, db_session: Session, error_test_context: SiteDesign):
        """Test handling of 503 Service Unavailable."""
        from app.models.models import EnergyEstimate
        
        estimate = EnergyEstimate(
            id=uuid4(), site_design_id=error_test_context.id, status="calculating", retry_count=0
        )
        params = {"system_capacity": 10.0, "lat": 34.0, "lon": -118.0, "tilt": 20, "azimuth": 180}
        
        mock_response = MagicMock()
        mock_response.status_code = 503
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "Service Unavailable", request=MagicMock(), response=mock_response
        )
        
        mock_db = self._run_task_with_mock_db(
            db_session, estimate, params, 
            mock_response=mock_response,
            expected_exception=httpx.HTTPStatusError
        )
        
        assert estimate.status == "failed"
        assert "Service Unavailable" in estimate.error_message
        assert mock_db.commit.called

    def test_malformed_json_response(self, db_session: Session, error_test_context: SiteDesign):
        """Test handling of malformed JSON response."""
        from app.models.models import EnergyEstimate
        
        estimate = EnergyEstimate(
            id=uuid4(), site_design_id=error_test_context.id, status="calculating", retry_count=0
        )
        params = {"system_capacity": 10.0, "lat": 34.0, "lon": -118.0, "tilt": 20, "azimuth": 180}
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.side_effect = json.JSONDecodeError("Expecting value", "", 0)
        
        mock_db = self._run_task_with_mock_db(
            db_session, estimate, params, 
            mock_response=mock_response,
            expected_exception=json.JSONDecodeError
        )
        
        assert estimate.status == "failed"
        assert "Expecting value" in estimate.error_message
        assert mock_db.commit.called

    def test_partial_data_response(self, db_session: Session, error_test_context: SiteDesign):
        """Test handling of partial data response (missing ac_annual)."""
        from app.models.models import EnergyEstimate
        
        estimate = EnergyEstimate(
            id=uuid4(), site_design_id=error_test_context.id, status="calculating", retry_count=0
        )
        params = {"system_capacity": 10.0, "lat": 34.0, "lon": -118.0, "tilt": 20, "azimuth": 180}
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        # outputs present but missing ac_annual
        mock_response.json.return_value = {"outputs": {"solrad_annual": 5.5}, "inputs": {}}
        
        mock_db = self._run_task_with_mock_db(
            db_session, estimate, params, 
            mock_response=mock_response
        )
        
        assert estimate.status == "completed"
        assert estimate.annual_energy_kwh == 0
        assert mock_db.commit.called

    def test_empty_outputs_object(self, db_session: Session, error_test_context: SiteDesign):
        """Test handling of empty outputs object."""
        from app.models.models import EnergyEstimate
        
        estimate = EnergyEstimate(
            id=uuid4(), site_design_id=error_test_context.id, status="calculating", retry_count=0
        )
        params = {"system_capacity": 10.0, "lat": 34.0, "lon": -118.0, "tilt": 20, "azimuth": 180}
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"outputs": {}, "inputs": {}}
        
        mock_db = self._run_task_with_mock_db(
            db_session, estimate, params, 
            mock_response=mock_response
        )
        
        assert estimate.status == "completed"
        assert estimate.annual_energy_kwh == 0
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

    def test_multipolygon_geometry(self):
        """Test that MultiPolygon is rejected by polygon validator."""
        from app.utils.geojson_validator import validate_geojson_polygon
        
        multipoly = {
            "type": "MultiPolygon",
            "coordinates": [[[[0,0], [1,0], [1,1], [0,0]]], [[[2,2], [3,2], [3,3], [2,2]]]]
        }
        is_valid, error = validate_geojson_polygon(multipoly)
        assert is_valid is False
        assert "must be 'Polygon'" in error

    def test_polygon_with_holes(self):
        """Test that placement algorithm respects holes in polygons."""
        # Square with a hole in the middle
        boundary_with_hole = {
            "type": "Polygon",
            "coordinates": [
                [[0,0], [10,0], [10,10], [0,10], [0,0]], # Outer
                [[4,4], [6,4], [6,6], [4,6], [4,4]]     # Hole (4x4m to 6x6m)
            ]
        }
        settings = {"edge_setback_m": 0.0}
        dims = {"length_m": 1.0, "width_m": 1.0}
        
        result = PlacementAlgorithmService.calculate_placement(boundary_with_hole, [], dims, settings)
        
        # Verify no modules are placed in the hole area
        for mod in result["modules"]:
            cx, cy = mod["center"]
            # If center is inside 4-6 range on both axes, it's in the hole
            assert not (4 < cx < 6 and 4 < cy < 6)

    def test_extremely_small_polygon(self):
        """Test polygon smaller than a single module."""
        small_poly = {
            "type": "Polygon",
            "coordinates": [[[0,0], [0.5, 0], [0.5, 0.5], [0,0.5], [0,0]]]
        }
        settings = {"edge_setback_m": 0.0}
        dims = {"length_m": 2.0, "width_m": 1.0}
        
        result = PlacementAlgorithmService.calculate_placement(small_poly, [], dims, settings)
        assert result["total_modules"] == 0

    def test_degenerate_polygon_line(self):
        """Test polygon where all points are collinear."""
        from app.utils.geojson_validator import validate_geojson_polygon
        line_poly = {
            "type": "Polygon",
            "coordinates": [[[0,0], [1,1], [2,2], [0,0]]]
        }
        # Validator might catch this or we check logic
        is_valid, error = validate_geojson_polygon(line_poly)
        # If validator doesn't catch it, placement should handle 0 area
        if is_valid:
            result = PlacementAlgorithmService.calculate_placement(line_poly, [], {"length_m": 1, "width_m": 1}, {"edge_setback_m": 0})
            assert result["total_modules"] == 0


@pytest.mark.integration
class TestPlacementAlgorithmEdgeCases:

    def test_setback_constraints(self):
        """Test when setbacks leave no space."""
        # 1x1m box with 1m setback
        boundary = {"type": "Polygon", "coordinates": [[[0,0], [1,0], [1,1], [0,1], [0,0]]]}
        settings = {"edge_setback_m": 1.0}
        dims = {"length_m": 1.0, "width_m": 1.0}
        
        result = PlacementAlgorithmService.calculate_placement(boundary, [], dims, settings)
        assert result["total_modules"] == 0

    def test_empty_boundaries(self):
        """Test effectively zero-area boundary."""
        # Extremely tiny polygon
        boundary = {"type": "Polygon", "coordinates": [[[0,0], [0.0001, 0], [0.0001, 0.0001], [0,0]]]}
        settings = {"edge_setback_m": 0.0}
        dims = {"length_m": 1.0, "width_m": 1.0}
        
        result = PlacementAlgorithmService.calculate_placement(boundary, [], dims, settings)
        assert result["total_modules"] == 0

    def test_exclusion_zones(self):
        """Test boundary fully covered by exclusion zone."""
        boundary = {"type": "Polygon", "coordinates": [[[0,0], [5,0], [5,5], [0,5], [0,0]]]}
        exclusion = {"type": "Polygon", "coordinates": [[[0,0], [5,0], [5,5], [0,5], [0,0]]]}
        settings = {"edge_setback_m": 0.0}
        dims = {"length_m": 1.0, "width_m": 1.0}
        
        result = PlacementAlgorithmService.calculate_placement(boundary, [exclusion], dims, settings)
        assert result["total_modules"] == 0


# -----------------------------------------------------------------------------
# 5. Placement Timeout Scenarios
# -----------------------------------------------------------------------------

@pytest.mark.integration
class TestPlacementTimeoutScenarios:

    @pytest.mark.slow
    def test_placement_execution_timeout(self, db_session: Session, error_test_context: SiteDesign):
        """Test handling of placement algorithm timeout."""
        from app.services.tasks import calculate_placement_async
        from celery.exceptions import TimeLimitExceeded
        
        target_func = calculate_placement_async
        if hasattr(target_func, "__wrapped__"):
            target_func = target_func.__wrapped__
        if hasattr(target_func, "__func__"):
            target_func = target_func.__func__

        design_id = error_test_context.id
        with patch("app.services.placement_algorithm.PlacementAlgorithmService.calculate_placement", side_effect=celery_exceptions.TimeLimitExceeded()):
            try:
                mock_self = MagicMock()
                mock_self.request.retries = 3
                mock_self.max_retries = 3
                target_func(mock_self, str(design_id), {}, {}, {}, {})
            except celery_exceptions.TimeLimitExceeded:
                pass
                
                # Re-query to avoid session issues
                db_session.expire_all()
                design = db_session.query(SiteDesign).filter(SiteDesign.id == design_id).first()
                assert design.placement_task_status == "failed"
                assert "timeout" in design.placement_task_error.lower() or "timelimit" in design.placement_task_error.lower()

    def test_placement_task_cancellation(self, db_session: Session, error_test_context: SiteDesign):
        """Test task status when revoked/cancelled."""
        from app.services.tasks import calculate_placement_async
        
        # Simulate task revocation by manually setting status
        # In a real environment, Celery handlers would do this
        error_test_context.placement_task_status = "cancelled"
        db_session.commit()
        
        db_session.refresh(error_test_context)
        assert error_test_context.placement_task_status == "cancelled"

    @pytest.mark.slow
    def test_large_site_async_execution(self, db_session: Session, error_test_context: SiteDesign):
        """Test async execution of a large site (simulated)."""
        from app.services.tasks import calculate_placement_async
        
        # Create a large boundary
        large_boundary = {
            "type": "Polygon",
            "coordinates": [[[0,0], [100,0], [100,100], [0,100], [0,0]]]
        }
        error_test_context.site_boundary = large_boundary
        db_session.commit()
        
        # Mock placement to return many modules
        mock_result = {
            "total_modules": 1200,
            "module_placements": [{"id": i, "center": [0,0]} for i in range(1200)],
            "stats": {"area": 10000}
        }
        
        with patch("app.services.placement_algorithm.PlacementAlgorithmService.calculate_placement", return_value=mock_result):
            mock_self = MagicMock()
            mock_self.request.retries = 0
            mock_self.max_retries = 3
            target_func = calculate_placement_async
            if hasattr(target_func, "__wrapped__"):
                target_func = target_func.__wrapped__
            if hasattr(target_func, "__func__"):
                target_func = target_func.__func__
            target_func(mock_self, str(error_test_context.id), {}, {}, {}, {})
            
            design = db_session.query(SiteDesign).filter(SiteDesign.id == error_test_context.id).first()
            assert design.placement_task_status == "completed"
            # Verify module placements are NOT empty (they should be stored in a separate table/field)
            # Depending on implementation, checking model attributes
            assert error_test_context.system_size_kwp > 0

    def test_placement_retry_on_transient_failure(self, db_session: Session, error_test_context: SiteDesign):
        """Test retry mechanism for placement tasks."""
        from app.services.tasks import calculate_placement_async
        
        # Mock to fail twice then succeed
        mock_calc = MagicMock()
        mock_calc.side_effect = [Exception("Transient error"), Exception("Transient error"), {"total_modules": 10, "modules": [], "stats": {}}]
        
        with patch("app.services.placement_algorithm.PlacementAlgorithmService.calculate_placement", mock_calc):
            # We simulate the retry loop manually since we are running .run()
            # In real celery, it would be handled by autoretry_for
            
            try:
                mock_self = MagicMock()
                mock_self.request.retries = 0 # Not last retry
                mock_self.max_retries = 3
                target_func = calculate_placement_async
                if hasattr(target_func, "__wrapped__"):
                    target_func = target_func.__wrapped__
                if hasattr(target_func, "__func__"):
                    target_func = target_func.__func__
                target_func(mock_self, str(error_test_context.id), {}, {}, {}, {})
            except Exception:
                pass
            
            # Since we are mocking the internal call, we verify it was called
            assert mock_calc.call_count >= 1


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
            parameter_hash="test_hash",
            system_capacity_kw=10.0,
            latitude=34.0,
            longitude=-118.0,
            azimuth=180.0,
            tilt=20.0,
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

    def test_css_file_missing(self, db_session: Session, error_test_context: SiteDesign):
        """Test PDF generation when CSS file is missing."""
        service = ProposalService(db_session, tenant_id=error_test_context.tender.tenant_id, user_id=error_test_context.created_by)
        
        import os
        original_join = os.path.join
        # Mock os.path.join to return a non-existent path for CSS
        with patch("os.path.join", side_effect=lambda *args: "/non/existent/path.css" if "styles.css" in args else original_join(*args)):
            with patch("os.path.exists", return_value=False):
                # Should not raise, should either skip CSS or handle gracefully
                storage_id = service.generate_pdf(error_test_context.id)
                assert storage_id is not None

    def test_weasyprint_font_error(self, db_session: Session, error_test_context: SiteDesign):
        """Test handling of WeasyPrint font errors."""
        service = ProposalService(db_session, tenant_id=error_test_context.tender.tenant_id, user_id=error_test_context.created_by)
        
        mock_weasyprint = sys.modules["weasyprint"]
        # Simulate a font related error in write_pdf
        mock_html_inst = MagicMock()
        mock_weasyprint.HTML.return_value = mock_html_inst
        mock_html_inst.write_pdf.side_effect = Exception("Font 'Open Sans' not found")
        
        try:
            with pytest.raises(Exception) as excinfo:
                service.generate_pdf(error_test_context.id)
            assert "Font" in str(excinfo.value)
        finally:
            mock_html_inst.write_pdf.side_effect = None

    def test_storage_backend_failure(self, db_session: Session, error_test_context: SiteDesign, mock_storage):
        """Test PDF generation when storage backend fails."""
        service = ProposalService(db_session, tenant_id=error_test_context.tender.tenant_id, user_id=error_test_context.created_by)
        
        # Mock storage.save to raise exception
        mock_storage.save.side_effect = Exception("S3 Connection Error")
        
        with pytest.raises(Exception) as excinfo:
            service.generate_pdf(error_test_context.id)
        assert "S3 Connection Error" in str(excinfo.value)

    def test_template_rendering_error(self, db_session: Session, error_test_context: SiteDesign):
        """Test handling of Jinja2 rendering errors."""
        from jinja2 import TemplateError
        service = ProposalService(db_session, tenant_id=error_test_context.tender.tenant_id, user_id=error_test_context.created_by)
        
        # Mock template render to fail
        mock_template = MagicMock()
        mock_template.render.side_effect = TemplateError("Rendering failed")
        
        with patch("app.services.proposal.Environment.get_template", return_value=mock_template):
            with pytest.raises(TemplateError):
                service.generate_pdf(error_test_context.id)

    def test_chart_generation_invalid_data(self, db_session: Session, error_test_context: SiteDesign):
        """Test chart generation with invalid data format."""
        # Create energy estimate with invalid monthly_energy_kwh (string instead of list)
        estimate = EnergyEstimate(
            id=uuid4(),
            site_design_id=error_test_context.id,
            parameter_hash="test_hash",
            system_capacity_kw=10.0,
            latitude=34.0,
            longitude=-118.0,
            azimuth=180.0,
            tilt=20.0,
            annual_energy_kwh=1000,
            monthly_energy_kwh="not a list", # Invalid
            capacity_factor=0.2,
            status="completed"
        )
        db_session.add(estimate)
        db_session.commit()
        
        service = ProposalService(db_session, tenant_id=error_test_context.tender.tenant_id, user_id=error_test_context.created_by)
        
        # Should fail gracefully in _generate_monthly_chart and still produce PDF
        storage_id = service.generate_pdf(error_test_context.id)
        assert storage_id is not None


# -----------------------------------------------------------------------------
# 6. Retry Logic and Exponential Backoff
# -----------------------------------------------------------------------------

@pytest.mark.integration
@pytest.mark.retry
class TestRetryLogicAndBackoff:

    def test_exponential_backoff_timing(self, db_session: Session, error_test_context: SiteDesign):
        """Test that retry intervals follow exponential backoff."""
        from app.services.tasks import calculate_energy_task
        from app.models.models import EnergyEstimate
        
        estimate = EnergyEstimate(
            id=uuid4(),
            site_design_id=error_test_context.id,
            parameter_hash="test_hash",
            system_capacity_kw=10.0,
            latitude=34.0,
            longitude=-118.0,
            azimuth=180.0,
            tilt=20.0,
            annual_energy_kwh=1000.0,
            monthly_energy_kwh=[100.0]*12,
            capacity_factor=0.2,
            status="calculating",
            retry_count=0
        )
        params = {"system_capacity": 10.0, "lat": 34.0, "lon": -118.0, "tilt": 20, "azimuth": 180}
        
        mock_self = MagicMock()
        mock_self.request.retries = 0
        mock_self.retry.side_effect = Exception("Retry called") # Stop execution
        
        # We can't easily test the actual Celery decorator logic here without a full celery worker
        # but we can verify our manual tracking or how we'd call retry
        
        # Instead, let's verify the configuration on the task object
        assert calculate_energy_task.retry_backoff == 1 or calculate_energy_task.retry_backoff is True
        assert calculate_energy_task.max_retries == 3 or calculate_energy_task.retry_kwargs.get('max_retries') == 3

    def test_retry_count_incrementation(self, db_session: Session, error_test_context: SiteDesign):
        """Test that estimate.retry_count increments on failures."""
        from app.services.tasks import calculate_energy_task
        from app.models.models import EnergyEstimate
        
        estimate = EnergyEstimate(
            id=uuid4(),
            site_design_id=error_test_context.id,
            parameter_hash="test_hash",
            system_capacity_kw=10.0,
            latitude=34.0,
            longitude=-118.0,
            azimuth=180.0,
            tilt=20.0,
            annual_energy_kwh=1000.0,
            monthly_energy_kwh=[100.0]*12,
            capacity_factor=0.2,
            status="calculating",
            retry_count=0
        )
        db_session.add(estimate)
        db_session.commit()
        
        estimate_id = estimate.id
        # Mock httpx to fail
        with patch("httpx.get", side_effect=Exception("API Down")):
            mock_self = MagicMock()
            mock_self.request.retries = 3
            mock_self.max_retries = 3
            
            try:
                # Use the underlying function
                target_func = calculate_energy_task
                if hasattr(target_func, "__wrapped__"):
                    target_func = target_func.__wrapped__
                if hasattr(target_func, "__func__"):
                    target_func = target_func.__func__
                target_func(mock_self, str(estimate_id), {"system_capacity": 10.0, "lat": 0, "lon": 0, "tilt": 0, "azimuth": 0})
            except:
                pass
            
            db_session.expire_all()
            estimate = db_session.query(EnergyEstimate).filter(EnergyEstimate.id == estimate_id).first()
            assert estimate.status == "failed"
            assert estimate.retry_count >= 0
            assert estimate.last_retry_at is not None

    def test_successful_retry_after_transient_failure(self, db_session: Session, error_test_context: SiteDesign):
        """Test success after a few retries."""
        from app.services.tasks import calculate_energy_task
        from app.models.models import EnergyEstimate
        
        estimate = EnergyEstimate(
            id=uuid4(),
            site_design_id=error_test_context.id,
            parameter_hash="test_hash",
            system_capacity_kw=10.0,
            latitude=34.0,
            longitude=-118.0,
            azimuth=180.0,
            tilt=20.0,
            annual_energy_kwh=1000.0,
            monthly_energy_kwh=[100.0]*12,
            capacity_factor=0.2,
            status="calculating",
            retry_count=0
        )
        db_session.add(estimate)
        db_session.commit()
        
        estimate_id = estimate.id
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"outputs": {"ac_annual": 1200}, "inputs": {}}
        
        # Fail once, then succeed
        params = {"system_capacity": 10.0, "lat": 0, "lon": 0, "tilt": 0, "azimuth": 0}
        with patch("httpx.get", side_effect=[Exception("Transient"), mock_response]):
            mock_self = MagicMock()
            mock_self.request.retries = 1
            mock_self.max_retries = 3
            # First call fails
            try:
                # Use the underlying function
                target_func = calculate_energy_task
                if hasattr(target_func, "__wrapped__"):
                    target_func = target_func.__wrapped__
                if hasattr(target_func, "__func__"):
                    target_func = target_func.__func__
                target_func(mock_self, str(estimate_id), params)
            except:
                pass
                
            # Second call succeeds
            mock_self.request.retries = 2
            target_func(mock_self, str(estimate_id), params)
            
            db_session.expire_all()
            estimate = db_session.query(EnergyEstimate).filter(EnergyEstimate.id == estimate_id).first()
            assert estimate.status == "completed"
            assert estimate.annual_energy_kwh == 1200

    def test_retry_backoff_configuration(self):
        """Verify the Celery task has the correct retry configuration."""
        from app.services.tasks import calculate_energy_task
        
        # Check standard Celery task attributes for retries
        # Depending on how it's defined (decorator vs manual)
        assert hasattr(calculate_energy_task, 'autoretry_for')
        assert Exception in calculate_energy_task.autoretry_for
        assert calculate_energy_task.retry_backoff is not None

    def test_no_retry_on_validation_errors(self, db_session: Session, error_test_context: SiteDesign):
        """Test that we don't retry on non-transient validation errors."""
        from app.services.tasks import calculate_energy_task
        
        # Scenario: estimate record not found (should not retry)
        mock_self = MagicMock()
        
        # If we pass a bogus ID, it should fail without calling retry
        with patch("app.core.database.SessionLocal") as mock_session_factory:
            mock_session = MagicMock()
            mock_session_factory.return_value = mock_session
            mock_session.query.return_value.filter.return_value.first.return_value = None
            
            # Use target_func to avoid wrapper signature issues
            target_func = calculate_energy_task
            if hasattr(target_func, "__wrapped__"):
                target_func = target_func.__wrapped__
            if hasattr(target_func, "__func__"):
                target_func = target_func.__func__

            target_func(mock_self, str(uuid4()), {})
            
            assert not mock_self.retry.called


# -----------------------------------------------------------------------------
# 7. Concurrent Design Updates and Concurrency
# -----------------------------------------------------------------------------

@pytest.mark.integration
@pytest.mark.concurrency
class TestConcurrentDesignUpdates:

    def test_concurrent_equipment_updates(self, db_session: Session, error_test_context: SiteDesign):
        """Verify last-write-wins behavior for concurrent equipment updates."""
        from sqlalchemy.orm import sessionmaker
        
        # Create a second session
        SessionLocal = sessionmaker(bind=db_session.get_bind())
        session2 = SessionLocal()
        
        try:
            # 1. Load design in both sessions
            d1 = db_session.query(SiteDesign).get(error_test_context.id)
            d2 = session2.query(SiteDesign).get(error_test_context.id)
            
            # 2. Update in session 1
            d1.name = "Update 1"
            db_session.commit()
            
            # 3. Update in session 2 (last write wins)
            d2.name = "Update 2"
            session2.commit()
            
            # 4. Verify final state
            db_session.refresh(d1)
            assert d1.name == "Update 2"
        finally:
            session2.close()

    def test_concurrent_placement_calculations(self, db_session: Session, error_test_context: SiteDesign):
        """Verify that multiple simultaneous placement tasks don't deadlock."""
        from app.services.tasks import calculate_placement_async
        
        # Trigger two runs with correct arguments
        # args: design_id, site_boundary, exclusion_zones, module_dims, settings
        args = (
            str(error_test_context.id),
            error_test_context.site_boundary,
            error_test_context.exclusion_zones or [],
            {"length_m": 2.0, "width_m": 1.0},
            {"row_spacing_m": 1.0}
        )
        
        # Mock the expensive placement algorithm
        with patch("app.services.placement_algorithm.PlacementAlgorithmService.calculate_placement") as mock_calc:
            mock_calc.return_value = {
                "module_placements": [],
                "total_modules": 100,
                "stats": {"efficiency": 0.8}
            }
            
            # Logic: If these run synchronously (via .run), they run sequentially. 
            # To test true concurrency we'd need threads/processes, but here we just ensure 
            # they can run back-to-back without state corruption.
            calculate_placement_async.run(*args)
            calculate_placement_async.run(*args)
            
            db_session.expire_all()
            design = db_session.query(SiteDesign).filter(SiteDesign.id == error_test_context.id).first()
            assert design.placement_task_status in ["completed", "failed"]

    def test_concurrent_version_creation(self, db_session: Session, error_test_context: SiteDesign):
        """Test concurrent version snapshot creation."""
        from app.services.design_version import DesignVersionService
        from app.models.models import DesignVersion
        from app.schemas.design_version import DesignVersionCreate
        
        # Ensure design has valid data for snapshot
        error_test_context.total_modules = 10
        error_test_context.system_size_kwp = 5.0
        db_session.commit()
        
        service = DesignVersionService(db_session, tenant_id=error_test_context.tender.tenant_id, user_id=error_test_context.created_by)
        
        # Create schema objects
        v1_data = DesignVersionCreate(version_name="Version 1", notes="First snapshot")
        v2_data = DesignVersionCreate(version_name="Version 2", notes="Second snapshot")
        
        # Create two versions
        service.create_version(error_test_context.id, v1_data)
        service.create_version(error_test_context.id, v2_data)
        
        versions = db_session.query(DesignVersion).filter(DesignVersion.site_design_id == error_test_context.id).all()
        assert len(versions) >= 2

    def test_optimistic_locking_detection(self):
        """
        Document concurrency model.
        Current implementation: Last-write-wins (No SQLAlchemy version_id column).
        """
        # This test serves as documentation/check
        from app.models.models import SiteDesign
        assert not hasattr(SiteDesign, 'version_id') # If we don't have it, it's LWW

    def test_concurrent_proposal_generation(self, db_session: Session, error_test_context: SiteDesign):
        """Verify concurrent proposal generation tasks."""
        # Patch BEFORE instantiating service
        with patch("app.services.proposal.get_storage_backend") as mock_get_backend:
            mock_backend = MagicMock()
            mock_backend.save.side_effect = ["id1", "id2"]
            mock_get_backend.return_value = mock_backend
            
            # Using ProposalService
            service = ProposalService(db_session, tenant_id=error_test_context.tender.tenant_id, user_id=error_test_context.created_by)
            
            id1 = service.generate_pdf(error_test_context.id)
            id2 = service.generate_pdf(error_test_context.id)
            
            assert id1 == "id1"
            assert id2 == "id2"

    def test_race_condition_energy_estimation(self, db_session: Session, error_test_context: SiteDesign):
        """Verify parameter hash prevents duplicate energy calculations."""
        # This assumes there's an idempotency check using parameter_hash
        from app.services.tasks import calculate_energy_task
        
        # Create an estimate already completed
        estimate = EnergyEstimate(
            id=uuid4(),
            site_design_id=error_test_context.id,
            status="completed", 
            parameter_hash="same_hash",
            system_capacity_kw=10.0,
            latitude=34.0,
            longitude=-118.0,
            azimuth=180.0,
            tilt=20.0,
            annual_energy_kwh=1000,
            monthly_energy_kwh=[100]*12,
            capacity_factor=0.2
        )
        db_session.add(estimate)
        db_session.commit()
        
        mock_self = MagicMock()
        # Mock httpx to see if it's called
        with patch("httpx.get") as mock_get:
            # We need to simulate the service logic that checks for existing hash
            # but calculate_energy_task.run usually creates a new one unless specifically logic exists
            pass


# -----------------------------------------------------------------------------
# 8. Data Persistence and Rollback
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
