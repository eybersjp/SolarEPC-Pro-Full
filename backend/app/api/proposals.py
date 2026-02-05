from datetime import datetime
from uuid import UUID
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import FileResponse, PlainTextResponse
from sqlalchemy.orm import Session
from celery.result import AsyncResult

from app.core.database import get_db
from app.core.security import get_current_user, require_role, CurrentUser
from app.models import UserRole
from app.services import tasks
from app.services.proposal import ProposalService
from app.schemas.proposal import ProposalTaskResponse, ProposalStatusResponse

router = APIRouter()

@router.post("/site-designs/{design_id}/proposal", response_model=ProposalTaskResponse, status_code=status.HTTP_202_ACCEPTED)
async def generate_proposal(
    design_id: UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role(UserRole.ADMIN, UserRole.PM, UserRole.ENGINEER)),
):
    """
    Trigger async PDF proposal generation.
    Returns a task ID to poll.
    """
    # Verify design exists? Service inside task checks, but better to check here too?
    # Keeping it lightweight, let task fail if invalid id.
    
    task = tasks.generate_proposal_task.delay(str(design_id))
    return {"task_id": task.id, "status": "PENDING"}


@router.get("/tasks/{task_id}", response_model=ProposalStatusResponse)
async def get_task_status(
    task_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Check stats of a background task (Proposal Generation).
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
    """
    service = ProposalService(db)
    csv_content = service.generate_bom_csv(design_id)
    
    timestamp = datetime.now().strftime("%Y%m%d")
    filename = f"bom_design_{design_id}_{timestamp}.csv"
    
    return PlainTextResponse(
        content=csv_content,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
