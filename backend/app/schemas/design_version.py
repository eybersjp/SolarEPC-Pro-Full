from datetime import datetime
from typing import Optional, Dict, Any
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

# We might want to re-use SiteDesign schemas for the snapshot data
# but keeping it as Dict[str, Any] is more flexible and robust to schema changes over time.


class DesignVersionBase(BaseModel):
    version_name: str = Field(..., min_length=1, max_length=255)
    notes: Optional[str] = None


class DesignVersionCreate(DesignVersionBase):
    pass


    created_at: datetime
    total_modules: Optional[int] = None
    system_size_kwp: Optional[float] = None
    
    @model_validator(mode="before")
    @classmethod
    def pull_stats_from_snapshot(cls, data: Any) -> Any:
        if hasattr(data, "snapshot_data") and isinstance(data.snapshot_data, dict):
            # If it's an ORM object
            if not getattr(data, "total_modules", None):
                setattr(data, "total_modules", data.snapshot_data.get("total_modules"))
            if not getattr(data, "system_size_kwp", None):
                setattr(data, "system_size_kwp", data.snapshot_data.get("system_size_kwp"))
        elif isinstance(data, dict) and "snapshot_data" in data and isinstance(data["snapshot_data"], dict):
            # If it's a dict
            if "total_modules" not in data or data["total_modules"] is None:
                data["total_modules"] = data["snapshot_data"].get("total_modules")
            if "system_size_kwp" not in data or data["system_size_kwp"] is None:
                data["system_size_kwp"] = data["snapshot_data"].get("system_size_kwp")
        return data

    class Config:
        from_attributes = True


class DesignVersionDetail(DesignVersionResponse):
    snapshot_data: Dict[str, Any]


class DesignVersionRestoreResponse(BaseModel):
    site_design: Any  # Usually SiteDesignResponse, but Any avoids circular import issues here
    recalculation_status: Dict[str, Any]
