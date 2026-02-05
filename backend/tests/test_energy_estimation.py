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
    
    # Check params passed to task
    args, _ = mock_delay.call_args
    assert args[0] == str(estimate.id)
    assert args[1]["system_capacity"] == 10.0
    assert args[1]["lat"] == 34.0

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
    mock_db_session.add.assert_not_called() # Should update existing

# Note: Testing the Celery task itself is tricky without a real broker or extensive mocking of `self`.
# We rely on unit testing the logic inside or integration tests.
# Here is a basic test for the task functonal logic effectively wrapped if we extracted it, 
# but testing `app.services.tasks` directly requires mocking internal imports.
