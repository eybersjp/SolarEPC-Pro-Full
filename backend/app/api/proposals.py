from datetime import datetime
from uuid import UUID
from typing import Optional

from fastapi import APIRouter, Depends, Query, status, HTTPException
from fastapi.responses import FileResponse, PlainTextResponse
from sqlalchemy.orm import Session
from celery.result import AsyncResult

from app.core.database import get_db
from app.core.security import get_current_user, require_role, CurrentUser
from app.models import UserRole
from app.services import tasks
from app.services.proposal import ProposalService
from app.schemas.proposal import ProposalTaskResponse, ProposalStatusResponse, ProposalGenerateRequest

router = APIRouter()

@router.post("/site-designs/{design_id}/proposal", response_model=ProposalTaskResponse, status_code=status.HTTP_202_ACCEPTED)
async def generate_proposal(
    design_id: UUID,
    request: Optional[ProposalGenerateRequest] = None,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role(UserRole.ADMIN, UserRole.PM, UserRole.ENGINEER)),
):
    """
    Trigger async PDF proposal generation.
    Returns a task ID to poll.
    
    **Optional Sections**:
    You can selectively include sections via the request body:
    - `include_energy_analysis`: Requires completed energy estimate.
    - `include_financial_analysis`: Requires financial parameters.
    - `include_bom`: Detailed Bill of Materials.
    
    If energy/financial data is missing but requested, the proposal will be generated with those sections omitted (graceful degradation).
    """
    # Verify design exists and belongs to tenant
    from app.models.models import SiteDesign, Tender
    t_id = UUID(current_user.tenant_id) if isinstance(current_user.tenant_id, str) else current_user.tenant_id
    design = db.query(SiteDesign).join(Tender).filter(
        SiteDesign.id == design_id,
        Tender.tenant_id == t_id
    ).first()
    if not design:
        raise HTTPException(status_code=404, detail="Design not found")
        
    if request is None:
        request = ProposalGenerateRequest()
        
    options = request.model_dump()
    task = tasks.generate_proposal_task.delay(str(design_id), options)
    return {"task_id": task.id, "status": "PENDING"}


@router.get("/tasks/{task_id}", response_model=ProposalStatusResponse)
async def get_task_status(
    task_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Check stats of a background task (Proposal Generation).
    
    **Lifecycle**:
    - `PENDING`: Task is waiting in queue.
    - `STARTED`: Task is currently executing.
    - `SUCCESS`: Task completed. `result_url` contains the download link.
    - `FAILURE`: Task failed. `error` contains details.
    """
    task_result = AsyncResult(task_id)
    
    response = {
        "task_id": task_id,
        "status": task_result.status,
    }
    
    if task_result.successful():
        result = task_result.result
        # The task returns {"status": "success", "result_url": ...}
        if isinstance(result, dict):
            response["result_url"] = result.get("result_url")
    elif task_result.failed():
        response["error"] = str(task_result.result)
        
    return response


@router.get("/site-designs/{design_id}/export-csv", response_class=PlainTextResponse)
async def export_bom_csv(
    design_id: UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role(UserRole.ADMIN, UserRole.PM, UserRole.ENGINEER)),
):
    """
    Download BOM as CSV.
    
    Returns a CSV file with columns:
    - Component (Module, Inverter, BOS)
    - Manufacturer
    - Model
    - Quantity
    - Unit Price (if available)
    - Total Cost
    """
    t_id = UUID(current_user.tenant_id) if isinstance(current_user.tenant_id, str) else current_user.tenant_id
    service = ProposalService(db, tenant_id=t_id, user_id=current_user.id)
    try:
        csv_content = service.generate_bom_csv(design_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    
    timestamp = datetime.now().strftime("%Y%m%d")
    filename = f"bom_design_{design_id}_{timestamp}.csv"
    
    return PlainTextResponse(
        content=csv_content,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
