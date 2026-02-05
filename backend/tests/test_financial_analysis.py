import pytest
from unittest.mock import MagicMock
from uuid import uuid4
from datetime import datetime

from app.services.financial_analysis import FinancialAnalysisService
from app.models.models import SiteDesign, FinancialAnalysis, EnergyEstimate

@pytest.fixture
def mock_db():
    return MagicMock()

@pytest.fixture
def service(mock_db):
    return FinancialAnalysisService(mock_db, uuid4(), uuid4())

def test_calculate_financials(service, mock_db):
    # Setup
    site_design_id = uuid4()
    tender_id = uuid4()
    
    mock_design = MagicMock(spec=SiteDesign)
    mock_design.id = site_design_id
    mock_design.tender_id = tender_id
    
    # Mock SiteDesign Query
    mock_db.query.return_value.filter.return_value.first.return_value = mock_design
    
    # Mock BOQ Service (via internal mocking or dependency injection mock)
    # Since we can't easily patch the `getting` of service inside __init__ without patching the class import,
    # we can manually attach a mock to the instance.
    service.boq_service = MagicMock()
    service.boq_service.get_summary.return_value = {"grand_total": 50000.0}
    
    # Mock Energy Service
    service.energy_service = MagicMock()
    mock_est = MagicMock(spec=EnergyEstimate)
    mock_est.annual_energy_kwh = 100000.0
    mock_est.status = "completed" # Must be completed
    service.energy_service.get_estimate.return_value = mock_est
    
    # Mock Existing Analysis check
    # Let's say it returns None first (create new)
    # But wait, `get_analysis` uses db.query.
    # We need to distinguish calls.
    # Let's rely on `mock_db.query` returning specific items for specific calls.
    # This is hard with `return_value` chains. 
    # Instead, we can mock `get_analysis` on the service itself if we want to isolate calculation logic, 
    # but that's partial mocking.
    
    # Let's just mock the DB query for FinancialAnalysis to return None
    def side_effect_query(model):
        m = MagicMock()
        if model == SiteDesign:
            m.filter.return_value.first.return_value = mock_design
        elif model == FinancialAnalysis:
            # First call inside calculate_financials is get_analysis
            m.filter.return_value.first.return_value = None
        return m
    
    mock_db.query.side_effect = side_effect_query
    
    # Execute
    result = service.calculate_financials(site_design_id)
    
    # Verify
    # Cost = 50,000
    # Energy = 100,000 kWh
    # Rate = 0.12
    # Savings = 12,000
    # Payback = 50,000 / 12,000 = 4.17
    # ROI = (12,000 * 25 - 50,000) / 50,000 * 100 = (300,000 - 50,000)/50,000 * 100 = 250,000/50,000 * 100 = 500%
    
    mock_db.add.assert_called_once()
    mock_db.commit.assert_called()
    
    # Since specific verification of the returned object attributes from a mock is tricky 
    # (as it might be the mock object passed to `add`), let's check what was verified.
    # The `result` is the object passed to `add` (or retrieved).
    
    assert result.system_cost_usd == 50000.0
    assert result.annual_savings_usd == 12000.0
    assert result.simple_payback_years == 4.17
    assert result.roi_pct == 500.0

def test_calculate_financials_zero_energy(service, mock_db):
    # Setup
    site_design_id = uuid4()
    mock_design = MagicMock(spec=SiteDesign)
    mock_design.tender_id = uuid4()
    
    mock_db.query.return_value.filter.return_value.first.return_value = mock_design
    
    service.boq_service = MagicMock()
    service.boq_service.get_summary.return_value = {"grand_total": 50000.0}
    
    service.energy_service = MagicMock()
    mock_est = MagicMock(spec=EnergyEstimate)
    mock_est.annual_energy_kwh = 0.0 # Zero energy
    mock_est.status = "completed"
    service.energy_service.get_estimate.return_value = mock_est
    
    # Execute
    result = service.calculate_financials(site_design_id)
    
    # Verify
    assert result.annual_savings_usd == 0.0
    assert result.simple_payback_years == 0.0 # Or handle infinity
    assert result.roi_pct == -100.0 
    # ROI = (0 - 50000)/50000 = -1 * 100 = -100%
