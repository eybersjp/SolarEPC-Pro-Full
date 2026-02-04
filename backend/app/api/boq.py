"""
BOQ (Bill of Quantities) API endpoints.
"""
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import io
import json

from app.core.database import get_db
from app.core.security import get_current_user, require_role, CurrentUser
from app.models import UserRole
from app.services.boq import BOQService
from app.schemas import BOQItemCreate, BOQItemUpdate, BOQItemResponse, BOQSummary

router = APIRouter()


def get_boq_service(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> BOQService:
    """Dependency to get BOQ service."""
    return BOQService(
        db=db,
        tenant_id=UUID(current_user.tenant_id),
        user_id=current_user.id,
    )


@router.get("/{tender_id}/boq", response_model=BOQSummary)
async def get_boq(
    tender_id: UUID,
    boq_service: BOQService = Depends(get_boq_service),
):
    """Get BOQ items with summary totals."""
    items = boq_service.list_items(tender_id)
    summary = boq_service.get_summary(tender_id)
    
    return BOQSummary(
        items=[BOQItemResponse.model_validate(i) for i in items],
        subtotal=summary["subtotal"],
        total_margin=summary["total_margin"],
        grand_total=summary["grand_total"],
    )


@router.post("/{tender_id}/boq", response_model=BOQItemResponse)
async def add_boq_item(
    tender_id: UUID,
    request: BOQItemCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role(UserRole.ADMIN, UserRole.PM)),
    boq_service: BOQService = Depends(get_boq_service),
):
    """
    Add a BOQ line item.
    
    Requires: Admin or PM role.
    """
    item = boq_service.create_item(
        tender_id=tender_id,
        category=request.category,
        description=request.description,
        unit_cost=request.unit_cost,
        quantity=request.quantity,
        margin_pct=request.margin_pct,
    )
    db.commit()
    db.refresh(item)
    return BOQItemResponse.model_validate(item)


@router.put("/boq/{item_id}", response_model=BOQItemResponse)
async def update_boq_item(
    item_id: UUID,
    request: BOQItemUpdate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role(UserRole.ADMIN, UserRole.PM)),
    boq_service: BOQService = Depends(get_boq_service),
):
    """
    Update a BOQ line item.
    
    Requires: Admin or PM role.
    """
    item = boq_service.get_item_or_404(item_id)
    item = boq_service.update_item(
        item=item,
        category=request.category,
        description=request.description,
        unit_cost=request.unit_cost,
        quantity=request.quantity,
        margin_pct=request.margin_pct,
    )
    db.commit()
    db.refresh(item)
    return BOQItemResponse.model_validate(item)


@router.delete("/boq/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_boq_item(
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role(UserRole.ADMIN, UserRole.PM)),
    boq_service: BOQService = Depends(get_boq_service),
):
    """
    Delete a BOQ line item.
    
    Requires: Admin or PM role.
    """
    item = boq_service.get_item_or_404(item_id)
    boq_service.delete_item(item)
    db.commit()
    return None


@router.get("/{tender_id}/boq/export")
async def export_boq(
    tender_id: UUID,
    format: str = "json",
    boq_service: BOQService = Depends(get_boq_service),
):
    """
    Export BOQ to JSON or CSV format.
    
    Query params:
        format: 'json' or 'csv' (default: json)
    """
    items = boq_service.list_items(tender_id)
    summary = boq_service.get_summary(tender_id)
    
    if format == "csv":
        # Generate CSV
        csv_content = "Category,Description,Unit Cost,Quantity,Margin %,Line Total\n"
        for item in items:
            csv_content += f"{item.category},{item.description},{item.unit_cost},{item.quantity},{item.margin_pct},{item.line_total}\n"
        csv_content += f"\n,,,Subtotal,,{summary['subtotal']}\n"
        csv_content += f",,,Margin,,{summary['total_margin']}\n"
        csv_content += f",,,Grand Total,,{summary['grand_total']}\n"
        
        return StreamingResponse(
            io.BytesIO(csv_content.encode()),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=boq_{tender_id}.csv"},
        )
    
    # Default: JSON export
    export_data = {
        "tender_id": str(tender_id),
        "items": [
            {
                "category": item.category,
                "description": item.description,
                "unit_cost": item.unit_cost,
                "quantity": item.quantity,
                "margin_pct": item.margin_pct,
                "line_total": item.line_total,
            }
            for item in items
        ],
        "summary": summary,
    }
    
    return StreamingResponse(
        io.BytesIO(json.dumps(export_data, indent=2).encode()),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=boq_{tender_id}.json"},
    )
