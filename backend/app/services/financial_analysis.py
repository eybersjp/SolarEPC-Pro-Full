"""
Financial Analysis Service.
"""
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models import FinancialAnalysis, SiteDesign
from app.services.boq import BOQService, get_boq_service
from app.services.energy_estimation import EnergyEstimationService


class FinancialAnalysisService:
    """
    Service for calculating and managing financial metrics for site designs.
    """

    def __init__(self, db: Session, tenant_id: UUID, user_id: UUID):
        self.db = db
        self.tenant_id = tenant_id
        self.user_id = user_id
        # Initialize dependencies
        self.boq_service = get_boq_service(db, tenant_id, user_id)
        self.energy_service = EnergyEstimationService(db)

    def get_analysis(self, site_design_id: UUID) -> Optional[FinancialAnalysis]:
        """Get existing financial analysis for a site design with tenant isolation."""
        from app.models import Tender
        return self.db.query(FinancialAnalysis).join(SiteDesign).join(Tender).filter(
            SiteDesign.id == site_design_id,
            Tender.tenant_id == self.tenant_id
        ).first()

    def calculate_financials(self, site_design_id: UUID) -> FinancialAnalysis:
        """
        Calculate and store financial metrics.
        ... (Formulae docs truncated)
        """
        # 1. Fetch Site Design with tenant isolation
        from app.models import Tender
        site_design = self.db.query(SiteDesign).join(Tender).filter(
            SiteDesign.id == site_design_id,
            Tender.tenant_id == self.tenant_id
        ).first()
        
        if not site_design:
            raise ValueError(f"SiteDesign {site_design_id} not found or access denied")
        # 2. Get System Cost from BOQ
        # We need the tender_id from the site_design. 
        # Note: BOQ is currently per Tender. If we have multiple site designs, 
        # we might assume the BOQ applies to the active design or the whole tender.
        # Requirement says: "System cost fetched from BOQ via BOQService.get_summary()"
        # This implies BOQ total is the system cost for the tender's design.
        try:
            boq_summary = self.boq_service.get_summary(site_design.tender_id)
            system_cost = boq_summary.get("grand_total", 0.0)
        except Exception:
            # If BOQ service fails or no items, assume 0
            system_cost = 0.0

        # 3. Get Annual Energy from Energy Estimate
        energy_est = self.energy_service.get_estimate(site_design_id)
        annual_energy = energy_est.annual_energy_kwh if energy_est and energy_est.status == "completed" else 0.0

        # 4. Parameters
        electricity_rate = 0.12
        escalation_rate = 2.0
        lifespan_years = 25

        # 5. Calculations
        annual_savings = annual_energy * electricity_rate
        
        if annual_savings > 0:
            simple_payback = system_cost / annual_savings
        else:
            simple_payback = 0.0 # Or infinity/null, but float 0.0 is safer for DB
            
        if system_cost > 0:
            roi = ((annual_savings * lifespan_years) - system_cost) / system_cost * 100
        else:
            roi = 0.0

        # 6. Store Result
        analysis = self.get_analysis(site_design_id)
        if not analysis:
            analysis = FinancialAnalysis(
                site_design_id=site_design_id
            )
            self.db.add(analysis)
        
        analysis.system_cost_usd = system_cost
        analysis.electricity_rate_usd_per_kwh = electricity_rate
        analysis.annual_rate_escalation_pct = escalation_rate
        analysis.annual_savings_usd = round(annual_savings, 2)
        analysis.simple_payback_years = round(simple_payback, 2)
        analysis.roi_pct = round(roi, 2)
        analysis.calculated_at = datetime.now(timezone.utc)

        self.db.commit()
        self.db.refresh(analysis)
        return analysis

def get_financial_service(
    db: Session,
    tenant_id: UUID,
    user_id: UUID,
) -> FinancialAnalysisService:
    """Factory function."""
    return FinancialAnalysisService(db, tenant_id, user_id)
