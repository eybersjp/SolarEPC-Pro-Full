import pytest
from unittest.mock import MagicMock, patch
from uuid import uuid4
from datetime import datetime

from app.services.financial_analysis import FinancialAnalysisService
from app.models.models import SiteDesign, FinancialAnalysis, EnergyEstimate

@pytest.fixture
def mock_db():
    return MagicMock()

@pytest.fixture
def service(mock_db):
    # Mocking get_boq_service and EnergyEstimationService initialization in constructor
    with patch("app.services.financial_analysis.get_boq_service") as mock_get_boq:
        with patch("app.services.financial_analysis.EnergyEstimationService") as mock_energy_svc:
            svc = FinancialAnalysisService(mock_db, uuid4(), uuid4())
            svc.boq_service = mock_get_boq.return_value
            svc.energy_service = mock_energy_svc.return_value
            return svc

class TestFinancialFormulaAccuracy:
    """Parametrized formula accuracy tests for annual savings, simple payback, and ROI."""

    @pytest.mark.parametrize("energy, cost, expected_savings, expected_payback, expected_roi", [
        (10000, 50000, 1200.0, 41.67, -40.0),    # Normal case
        (20000, 10000, 2400.0, 4.17, 500.0),    # High energy, low cost
        (5000, 100000, 600.0, 166.67, -85.0),   # Low energy, high cost
    ])
    def test_calculation_accuracy(self, service, mock_db, energy, cost, expected_savings, expected_payback, expected_roi):
        site_design_id = uuid4()
        mock_design = MagicMock(spec=SiteDesign)
        mock_design.id = site_design_id
        mock_design.tender_id = uuid4()

        # Mock query chain
        def side_effect_query(model):
            m = MagicMock()
            if model == SiteDesign:
                m.filter.return_value.first.return_value = mock_design
            elif model == FinancialAnalysis:
                m.filter.return_value.first.return_value = None
            return m
        mock_db.query.side_effect = side_effect_query

        service.boq_service.get_summary.return_value = {"grand_total": cost}
        
        mock_est = MagicMock(spec=EnergyEstimate)
        mock_est.annual_energy_kwh = energy
        mock_est.status = "completed"
        service.energy_service.get_estimate.return_value = mock_est

        result = service.calculate_financials(site_design_id)

        assert result.annual_savings_usd == expected_savings
        assert result.simple_payback_years == expected_payback
        assert result.roi_pct == expected_roi

class TestFinancialEdgeCases:
    """Edge-case tests for zero energy, zero cost, missing BOQ data, and failed/missing energy estimates."""
    
    def test_zero_energy(self, service, mock_db):
        site_design_id = uuid4()
        mock_design = MagicMock(spec=SiteDesign, id=site_design_id, tender_id=uuid4())
        mock_db.query.return_value.filter.return_value.first.side_effect = [mock_design, None]

        service.boq_service.get_summary.return_value = {"grand_total": 50000.0}
        service.energy_service.get_estimate.return_value = MagicMock(annual_energy_kwh=0.0, status="completed")

        result = service.calculate_financials(site_design_id)
        assert result.annual_savings_usd == 0.0
        assert result.simple_payback_years == 0.0
        assert result.roi_pct == -100.0

    def test_zero_cost(self, service, mock_db):
        site_design_id = uuid4()
        mock_design = MagicMock(spec=SiteDesign, id=site_design_id, tender_id=uuid4())
        mock_db.query.return_value.filter.return_value.first.side_effect = [mock_design, None]

        service.boq_service.get_summary.return_value = {"grand_total": 0.0}
        service.energy_service.get_estimate.return_value = MagicMock(annual_energy_kwh=10000.0, status="completed")

        result = service.calculate_financials(site_design_id)
        assert result.system_cost_usd == 0.0
        assert result.roi_pct == 0.0

    def test_missing_boq_data(self, service, mock_db):
        site_design_id = uuid4()
        mock_design = MagicMock(spec=SiteDesign, id=site_design_id, tender_id=uuid4())
        mock_db.query.return_value.filter.return_value.first.side_effect = [mock_design, None]

        service.boq_service.get_summary.side_effect = Exception("BOQ Service Error")
        service.energy_service.get_estimate.return_value = MagicMock(annual_energy_kwh=10000.0, status="completed")

        result = service.calculate_financials(site_design_id)
        assert result.system_cost_usd == 0.0 # Graceful degradation to 0

    def test_failed_energy_estimate(self, service, mock_db):
        site_design_id = uuid4()
        mock_design = MagicMock(spec=SiteDesign, id=site_design_id, tender_id=uuid4())
        mock_db.query.return_value.filter.return_value.first.side_effect = [mock_design, None]

        service.boq_service.get_summary.return_value = {"grand_total": 50000.0}
        # Estimate exists but status is failed/processing
        service.energy_service.get_estimate.return_value = MagicMock(annual_energy_kwh=10000.0, status="failed")

        result = service.calculate_financials(site_design_id)
        assert result.annual_savings_usd == 0.0

class TestFinancialBOQIntegration:
    """BOQ integration tests across varied grand totals and exception paths."""
    
    def test_boq_varied_totals(self, service, mock_db):
        site_design_id = uuid4()
        mock_design = MagicMock(spec=SiteDesign, id=site_design_id, tender_id=uuid4())
        mock_db.query.return_value.filter.return_value.first.side_effect = [mock_design, None]

        service.boq_service.get_summary.return_value = {"grand_total": 75234.56}
        service.energy_service.get_estimate.return_value = MagicMock(annual_energy_kwh=15000.0, status="completed")

        result = service.calculate_financials(site_design_id)
        assert result.system_cost_usd == 75234.56

class TestFinancialAssumptionDefaults:
    """Tests asserting default assumptions (electricity_rate, escalation, lifespan) are applied."""
    
    def test_default_values(self, service, mock_db):
        site_design_id = uuid4()
        mock_design = MagicMock(spec=SiteDesign, id=site_design_id, tender_id=uuid4())
        mock_db.query.return_value.filter.return_value.first.side_effect = [mock_design, None]

        service.boq_service.get_summary.return_value = {"grand_total": 10000.0}
        service.energy_service.get_estimate.return_value = MagicMock(annual_energy_kwh=1000.0, status="completed")

        result = service.calculate_financials(site_design_id)
        
        # Verify defaults from service implementation
        assert result.electricity_rate_usd_per_kwh == 0.12
        assert result.annual_rate_escalation_pct == 2.0
        # Lifespan is used in ROI calc: ROI = ((Savings * 25) - Cost) / Cost * 100
        # Savings = 1000 * 0.12 = 120
        # ROI = (120 * 25 - 10000) / 10000 * 100 = (3000 - 10000) / 10000 * 100 = -70.0
        assert result.roi_pct == -70.0

class TestFinancialGracefulDegradation:
    """Graceful degradation tests for missing site design and update vs create flows."""
    
    def test_missing_site_design(self, service, mock_db):
        site_design_id = uuid4()
        mock_db.query.return_value.filter.return_value.first.return_value = None
        
        with pytest.raises(ValueError, match="SiteDesign .* not found"):
            service.calculate_financials(site_design_id)

    def test_update_flow(self, service, mock_db):
        site_design_id = uuid4()
        mock_design = MagicMock(spec=SiteDesign, id=site_design_id, tender_id=uuid4())
        
        existing_analysis = FinancialAnalysis(site_design_id=site_design_id, system_cost_usd=100.0)
        
        def side_effect_query(model):
            m = MagicMock()
            if model == SiteDesign:
                m.filter.return_value.first.return_value = mock_design
            elif model == FinancialAnalysis:
                m.filter.return_value.first.return_value = existing_analysis
            return m
        mock_db.query.side_effect = side_effect_query

        service.boq_service.get_summary.return_value = {"grand_total": 10000.0}
        service.energy_service.get_estimate.return_value = MagicMock(annual_energy_kwh=1000.0, status="completed")

        result = service.calculate_financials(site_design_id)
        
        assert result == existing_analysis # Should update existing
        assert result.system_cost_usd == 10000.0
        mock_db.add.assert_not_called() # Should not call add on update

class TestFinancialRecalculationTriggers:
    """Recalculation trigger tests asserting db add/commit/refresh calls and updated timestamps."""
    
    def test_db_interactions(self, service, mock_db):
        site_design_id = uuid4()
        mock_design = MagicMock(spec=SiteDesign, id=site_design_id, tender_id=uuid4())
        mock_db.query.return_value.filter.return_value.first.side_effect = [mock_design, None]

        service.boq_service.get_summary.return_value = {"grand_total": 10000.0}
        service.energy_service.get_estimate.return_value = MagicMock(annual_energy_kwh=1000.0, status="completed")

        before_calculation = datetime.utcnow()
        result = service.calculate_financials(site_design_id)
        
        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()
        mock_db.refresh.assert_called_once_with(result)
        assert result.calculated_at >= before_calculation
