from typing import Optional
from uuid import UUID
from pydantic import BaseModel

class ProposalGenerateRequest(BaseModel):
    """Configuration for proposal generation."""
    include_cover: bool = True
    include_site_map: bool = True
    include_specs: bool = True
    include_energy: bool = True
    include_financials: bool = True
    include_equipment: bool = True

class ProposalTaskResponse(BaseModel):
    """Response when starting a generation task."""
    task_id: str
    status: str

class ProposalStatusResponse(BaseModel):
    """Status of the generation task."""
    task_id: str
    status: str # PENDING, STARTED, SUCCESS, FAILURE
    result_url: Optional[str] = None
    error: Optional[str] = None
