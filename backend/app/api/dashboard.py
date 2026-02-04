"""
Dashboard API for project overview.
"""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_current_user, CurrentUser
from app.models import Tender, TenderStatus

router = APIRouter()


class TenderSummary(BaseModel):
    """Summary of a tender for dashboard."""
    id: UUID
    name: str
    client_name: Optional[str]
    status: str
    target_capacity_kw: Optional[float]
    has_designs: bool
    has_boq: bool


class DashboardStats(BaseModel):
    """Dashboard statistics."""
    total_tenders: int
    draft_count: int
    in_review_count: int
    submitted_count: int
    won_count: int
    lost_count: int
    total_capacity_mw: float


class DashboardResponse(BaseModel):
    """Full dashboard response."""
    stats: DashboardStats
    recent_tenders: List[TenderSummary]


@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Get dashboard overview for current tenant.
    
    Returns statistics and recent tenders.
    """
    tenant_id = UUID(current_user.tenant_id)
    
    # Get all tenders for tenant
    tenders = db.query(Tender).filter(Tender.tenant_id == tenant_id).all()
    
    # Calculate stats
    stats = DashboardStats(
        total_tenders=len(tenders),
        draft_count=sum(1 for t in tenders if t.status == TenderStatus.DRAFT),
        in_review_count=sum(1 for t in tenders if t.status == TenderStatus.IN_REVIEW),
        submitted_count=sum(1 for t in tenders if t.status == TenderStatus.SUBMITTED),
        won_count=sum(1 for t in tenders if t.status == TenderStatus.WON),
        lost_count=sum(1 for t in tenders if t.status == TenderStatus.LOST),
        total_capacity_mw=sum(
            (t.target_capacity_kw or 0) / 1000 
            for t in tenders 
            if t.status in [TenderStatus.WON, TenderStatus.SUBMITTED]
        ),
    )
    
    # Get recent tenders (last 10)
    recent = sorted(tenders, key=lambda t: t.created_at, reverse=True)[:10]
    
    recent_summaries = [
        TenderSummary(
            id=t.id,
            name=t.name,
            client_name=t.client_name,
            status=t.status.value,
            target_capacity_kw=t.target_capacity_kw,
            has_designs=len(t.pv_designs) > 0,
            has_boq=len(t.boq_items) > 0,
        )
        for t in recent
    ]
    
    return DashboardResponse(
        stats=stats,
        recent_tenders=recent_summaries,
    )
