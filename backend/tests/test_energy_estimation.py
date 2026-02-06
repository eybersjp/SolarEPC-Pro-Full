import pytest
from unittest.mock import MagicMock, patch
from uuid import uuid4
from sqlalchemy.orm import Session
from app.services.energy_estimation import EnergyEstimationService
from app.models.models import SiteDesign, EnergyEstimate, Tender
from app.services import tasks

@pytest.fixture
def mock_db_session():
    return MagicMock(spec=Session)

@pytest.fixture
def service(mock_db_session):
    return EnergyEstimationService(mock_db_session)

@pytest.fixture
def mock_site_design():
    design = MagicMock(spec=SiteDesign)
    design.id = uuid4()
    design.tender_id = uuid4()
    design.system_size_kwp = 10.0
    design.site_type = "rooftop"
    design.tilt_deg = 20.0
    design.azimuth_deg = 180.0
    return design

@pytest.fixture
def mock_tender():
    tender = MagicMock(spec=Tender)
    tender.latitude = 34.0
    tender.longitude = -118.0
    return tender

def test_compute_hash(service):
    params = {"a": 1, "b": 2}
    hash1 = service._compute_hash(params)
    hash2 = service._compute_hash(params)
    assert hash1 == hash2
    
    params2 = {"b": 2, "a": 1}
    hash3 = service._compute_hash(params2)
    assert hash1 == hash3 # Order shouldn't matter due to sort_keys=True

    params3 = {"a": 1, "b": 3}
    assert hash1 != service._compute_hash(params3)

@patch("app.services.tasks.calculate_energy_task.delay")
def test_estimate_energy_async_new(mock_delay, service, mock_db_session, mock_site_design, mock_tender):
    """Test creating a new estimation."""
    mock_db_session.query.return_value.filter.return_value.first.side_effect = [
        mock_site_design, # SiteDesign
        mock_tender,      # Tender
        None              # No existing EnergyEstimate
    ]
    
    # Setup add returning the input object
    def side_effect_add(obj):
        obj.id = uuid4()
        return obj
    mock_db_session.add.side_effect = side_effect_add

    # Execute
    estimate = service.estimate_energy_async(mock_site_design.id)

    # Verify
    assert estimate.status == "calculating"
    assert estimate.site_design_id == mock_site_design.id
    mock_db_session.add.assert_called_once()
    mock_db_session.commit.assert_called()
    mock_delay.assert_called_once()
    
    args, _ = mock_delay.call_args
    assert args[0] == str(estimate.id)
    sent_params = args[1]
    assert sent_params == {
        "system_capacity": 10.0,
        "module_type": 1,
        "losses": 14.0,
        "array_type": 1,
        "tilt": 20.0,
        "azimuth": 180.0,
        "lat": 34.0,
        "lon": -118.0
    }

@patch("app.services.tasks.calculate_energy_task.delay")
def test_estimate_energy_async_cached(mock_delay, service, mock_db_session, mock_site_design, mock_tender):
    """Test returning cached estimation."""
    # Pre-calculate hash
    params = {
        "system_capacity": 10.0,
        "module_type": 1, "losses": 14.0, "array_type": 1,
        "tilt": 20.0, "azimuth": 180.0, "lat": 34.0, "lon": -118.0
    }
    expected_hash = service._compute_hash(params)

    existing_estimate = MagicMock(spec=EnergyEstimate)
    existing_estimate.parameter_hash = expected_hash
    existing_estimate.status = "completed"

    mock_db_session.query.return_value.filter.return_value.first.side_effect = [
        mock_site_design,
        mock_tender,
        existing_estimate
    ]

    # Execute
    result = service.estimate_energy_async(mock_site_design.id)

    # Verify
    assert result == existing_estimate
    mock_delay.assert_not_called()
    mock_db_session.add.assert_not_called()

@patch("app.services.tasks.calculate_energy_task.delay")
def test_estimate_energy_async_invalidation(mock_delay, service, mock_db_session, mock_site_design, mock_tender):
    """Test invalidation when parameters change."""
    existing_estimate = MagicMock(spec=EnergyEstimate)
    existing_estimate.parameter_hash = "old_hash"
    existing_estimate.status = "completed"
    existing_estimate.id = uuid4()

    mock_db_session.query.return_value.filter.return_value.first.side_effect = [
        mock_site_design,
        mock_tender,
        existing_estimate
    ]

    # Execute
    result = service.estimate_energy_async(mock_site_design.id)

    # Verify
    assert result == existing_estimate
    assert result.status == "calculating"
    assert result.parameter_hash != "old_hash"
    mock_delay.assert_called_once()
    
    # Verify full params in invalidation case
    sent_params = mock_delay.call_args.args[1]
    assert len(sent_params) == 8
    assert sent_params["system_capacity"] == 10.0

# Additional Verification Tests

@patch("app.services.tasks.calculate_energy_task.delay")
def test_estimate_energy_async_failed_reset(mock_delay, service, mock_db_session, mock_site_design, mock_tender):
    """
    Test that calling estimate_energy_async on a 'failed' estimate resets it 
    and re-enqueues the task with the correct full parameters.
    """
    params = {
        "system_capacity": 10.0, "module_type": 1, "losses": 14.0, "array_type": 1,
        "tilt": 20.0, "azimuth": 180.0, "lat": 34.0, "lon": -118.0
    }
    expected_hash = service._compute_hash(params)
    
    # Mock existing failed estimate with matching hash
    existing_estimate = EnergyEstimate(
        id=uuid4(),
        parameter_hash=expected_hash,
        status="failed",
        retry_count=3,
        error_message="API fail",
        last_retry_at="some_date"
    )

    mock_db_session.query.return_value.filter.return_value.first.side_effect = [
        mock_site_design, mock_tender, existing_estimate
    ]
    
    # Execute
    result = service.estimate_energy_async(mock_site_design.id)
    
    # Verify Reset
    assert result.status == "calculating"
    assert result.retry_count == 0
    assert result.error_message is None
    assert result.last_retry_at is None
    mock_db_session.commit.assert_called()
    
    # Verify Task Enqueued with full params
    mock_delay.assert_called_once()
    args, _ = mock_delay.call_args
    assert args[0] == str(existing_estimate.id)
    sent_params = args[1]
    
    assert sent_params == {
        "system_capacity": 10.0,
        "module_type": 1,
        "losses": 14.0,
        "array_type": 1,
        "tilt": 20.0,
        "azimuth": 180.0,
        "lat": 34.0,
        "lon": -118.0
    }

@pytest.mark.parametrize("site_type, expected_array_type", [
    ("rooftop", 1),
    ("ground_mount", 0),
    ("carport", 0)
])
@patch("app.services.tasks.calculate_energy_task.delay")
def test_celery_params_full(mock_delay, service, mock_db_session, mock_site_design, mock_tender, site_type, expected_array_type):
    """
    Verify full 8-key Celery parameter payload across different site types.
    """
    mock_site_design.site_type = site_type
    mock_db_session.query.return_value.filter.return_value.first.side_effect = [
        mock_site_design, mock_tender, None
    ]
    
    service.estimate_energy_async(mock_site_design.id)
    
    # Extract params
    sent_params = mock_delay.call_args.args[1]
    
    assert sent_params == {
        "system_capacity": 10.0,
        "module_type": 1,
        "losses": 14.0,
        "array_type": expected_array_type,
        "tilt": 20.0,
        "azimuth": 180.0,
        "lat": 34.0,
        "lon": -118.0
    }

@patch("app.services.tasks.calculate_energy_task.delay")
def test_estimate_energy_async_idempotency(mock_delay, service, mock_db_session, mock_site_design, mock_tender):
    """
    Verify that multiple calls for an estimate already 'calculating' do not re-enqueue task.
    """
    params = {
        "system_capacity": 10.0, "module_type": 1, "losses": 14.0, "array_type": 1,
        "tilt": 20.0, "azimuth": 180.0, "lat": 34.0, "lon": -118.0
    }
    expected_hash = service._compute_hash(params)
    
    existing_estimate = MagicMock(spec=EnergyEstimate)
    existing_estimate.parameter_hash = expected_hash
    existing_estimate.status = "calculating"

    mock_db_session.query.return_value.filter.return_value.first.side_effect = [
        mock_site_design, mock_tender, existing_estimate
    ]
    
    result = service.estimate_energy_async(mock_site_design.id)
    
    assert result == existing_estimate
    mock_delay.assert_not_called()

@patch("app.services.tasks.calculate_energy_task.delay")
def test_estimate_energy_async_lat_none(mock_delay, service, mock_db_session, mock_site_design, mock_tender):
    """
    Verify handling of lat=None in Tender coordinates.
    Expects params['lat'] to be None while estimate.latitude is 0.
    """
    mock_tender.latitude = None
    mock_tender.longitude = None
    
    # Mock for creating new estimate
    def side_effect_add(obj):
        obj.id = uuid4()
        return obj
    mock_db_session.add.side_effect = side_effect_add
    
    mock_db_session.query.return_value.filter.return_value.first.side_effect = [
        mock_site_design, mock_tender, None
    ]
    
    estimate = service.estimate_energy_async(mock_site_design.id)
    
    # Check estimate storage (uses 'or 0')
    assert estimate.latitude == 0
    
    # Check task params (should be None)
    sent_params = mock_delay.call_args.args[1]
    assert sent_params["lat"] is None
    assert sent_params["lon"] is None

@patch("httpx.get")
@patch("app.core.database.SessionLocal")
def test_calculate_energy_task_retry_logic(mock_session, mock_get):
    """
    Test the task logic for retries and status updates.
    Mocks the internal database session and API calls.
    Uses .run() to call the original function.
    """
    from app.services.tasks import calculate_energy_task
    from app.models.models import EnergyEstimate
    
    mock_db = MagicMock()
    mock_session.return_value = mock_db
    
    estimate = EnergyEstimate(
        id=uuid4(), status="calculating", retry_count=0,
        system_capacity_kw=10.0, latitude=34.0, longitude=-118.0,
        azimuth=180.0, tilt=20.0
    )
    expected_params = {"system_capacity": 10.0, "tilt": 20.0, "azimuth": 180.0, "lat": 34.0, "lon": -118.0}
    
    # Simpler mock that returns our objects regardless of exact class match issues
    mock_db.query.return_value.filter.return_value.first.side_effect = [estimate, estimate, estimate]
    
    mock_get.side_effect = [
        Exception("API Error"),
        MagicMock(status_code=200, json=lambda: {"outputs": {"ac_annual": 15000, "ac_monthly": [1200]*12, "capacity_factor": 0.18}})
    ]
    
    mock_self = MagicMock()
    mock_self.request.retries = 0
    mock_self.max_retries = 3
    
    params = {"system_capacity": 10.0, "tilt": 20.0, "azimuth": 180.0, "lat": 34.0, "lon": -118.0}
    
    # First attempt (fails at httpx.get after incrementing retry_count)
    try:
        calculate_energy_task.run(mock_self, str(estimate.id), params)
    except Exception:
        pass
    
    # Verify increment (happens before API call failure)
    assert estimate.retry_count == 1
    assert mock_db.commit.called
    
    # Second attempt (succeeds)
    mock_self.request.retries = 1
    calculate_energy_task.run(mock_self, str(estimate.id), params)
    
    assert estimate.retry_count == 2
    assert estimate.status == "completed"
    assert estimate.annual_energy_kwh == 15000

@patch("httpx.get")
@patch("app.core.database.SessionLocal")
def test_calculate_energy_task_all_fail(mock_session, mock_get):
    """Test behavior when all retries fail."""
    from app.services.tasks import calculate_energy_task
    from app.models.models import EnergyEstimate
    
    mock_db = MagicMock()
    mock_session.return_value = mock_db
    
    estimate = EnergyEstimate(id=uuid4(), status="calculating", retry_count=2)
    
    def mock_query(model):
        q = MagicMock()
        model_name = getattr(model, "__name__", str(model))
        if model_name == "EnergyEstimate":
            q.filter.return_value.first.return_value = estimate
        return q
    mock_db.query.side_effect = mock_query

    mock_get.side_effect = Exception("Final Failure")
    
    mock_self = MagicMock()
    mock_self.request.retries = 3 
    mock_self.max_retries = 3
    
    params = {"system_capacity": 10.0, "tilt": 20.0, "azimuth": 180.0, "lat": 34.0, "lon": -118.0}
    
    with pytest.raises(Exception):
        calculate_energy_task.run(mock_self, str(estimate.id), params)
        
    assert estimate.status == "failed"
    assert "Final Failure" in estimate.error_message
