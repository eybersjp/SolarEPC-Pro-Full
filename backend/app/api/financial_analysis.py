"""
Financial Analysis API Endpoints.
"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, CurrentUser
from app.models import FinancialAnalysis
from app.services.financial_analysis import FinancialAnalysisService
from pydantic import BaseModel, ConfigDict

router = APIRouter()

class FinancialAnalysisResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    site_design_id: UUID
    system_cost_usd: float
    electricity_rate_usd_per_kwh: float
    annual_rate_escalation_pct: float
    annual_savings_usd: float
    simple_payback_years: float
    roi_pct: float

def get_financial_service(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> FinancialAnalysisService:
    return FinancialAnalysisService(db, UUID(str(current_user.tenant_id)), current_user.id)

@router.get("/site-designs/{design_id}/financial-analysis", response_model=Optional[FinancialAnalysisResponse])
async def get_financial_analysis(
    design_id: UUID,
    service: FinancialAnalysisService = Depends(get_financial_service),
):
    """
    Get financial analysis for a site design.
    Triggers calculation if not exists or stale (optional, here we calculate on demand if missing).
    """
    analysis = service.get_analysis(design_id)
    if not analysis:
        # Auto-calculate if not found
        try:
           analysis = service.calculate_financials(design_id)
        except ValueError:
             # Handle case where design doesn't exist
             from fastapi import HTTPException
             raise HTTPException(status_code=404, detail="Site Design not found")
             
    return analysis
