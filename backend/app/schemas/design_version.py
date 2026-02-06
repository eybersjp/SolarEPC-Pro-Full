from datetime import datetime
from typing import Optional, Dict, Any
from uuid import UUID

from pydantic import BaseModel, Field

# We might want to re-use SiteDesign schemas for the snapshot data
# but keeping it as Dict[str, Any] is more flexible and robust to schema changes over time.


class DesignVersionBase(BaseModel):
    version_name: str = Field(..., min_length=1, max_length=255)
    notes: Optional[str] = None


class DesignVersionCreate(DesignVersionBase):
    pass


class DesignVersionResponse(DesignVersionBase):
    id: UUID
    site_design_id: UUID
    created_by: UUID
    created_at: datetime
    
    # We generally don't return the full snapshot data in the list view
    # But for a detail view we might.
    # For now, let's keep it minimal for the list. 
    # If we need the snapshot data, we can add a flag or a separate endpoint.
    
    class Config:
        from_attributes = True


class DesignVersionDetail(DesignVersionResponse):
    snapshot_data: Dict[str, Any]


class DesignVersionRestoreResponse(BaseModel):
    site_design: Any  # Usually SiteDesignResponse, but Any avoids circular import issues here
    recalculation_status: Dict[str, Any]
