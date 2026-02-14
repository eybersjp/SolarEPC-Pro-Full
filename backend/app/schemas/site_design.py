from datetime import datetime
from enum import Enum
from typing import List, Optional, Any, Dict
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict


class SiteTypeEnum(str, Enum):
    ROOFTOP = "rooftop"
    GROUND_MOUNT = "ground_mount"
    CARPORT = "carport"


class ModuleOrientationEnum(str, Enum):
    PORTRAIT = "portrait"
    LANDSCAPE = "landscape"


class GeoJSONPolygon(BaseModel):
    """
    Schema for validating GeoJSON Polygon structure.
    We'll do deeper semantic validation (closure, self-intersection) in the service layer util.
    """
    type: str = Field(..., pattern="^Polygon$")
    coordinates: List[List[List[float]]] = Field(
        ...,
        description="Array of linear rings. The first ring is the exterior boundary. Subsequent rings are holes.",
        json_schema_extra={"examples": [[[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]]]}
    )


class PlacementSettings(BaseModel):
    edge_setback_m: float = Field(1.0, ge=0.0, description="Minimum distance from site boundary to modules (meters).")
    row_spacing_m: float = Field(2.0, ge=0.0, description="Spacing between rows of modules (meters).")
    module_orientation: ModuleOrientationEnum = ModuleOrientationEnum.PORTRAIT
    azimuth_deg: float = Field(180.0, ge=0.0, le=360.0, description="Azimuth angle in degrees (180 = South).")
    tilt_deg: Optional[float] = Field(None, ge=0.0, le=90.0, description="Tilt angle in degrees. If not provided, defaults based on site_type (e.g., 20 deg for ground mount).")


class SiteDesignBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    site_type: SiteTypeEnum
    
    equipment_module_id: UUID
    equipment_inverter_id: UUID
    
    site_boundary: Dict[str, Any] = Field(..., description="GeoJSON Polygon")
    placement_settings: PlacementSettings = Field(default_factory=PlacementSettings)

    model_config = ConfigDict(from_attributes=True)


class SiteDesignCreate(SiteDesignBase):
    pass


class SiteDesignUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    site_boundary: Optional[Dict[str, Any]] = None
    exclusion_zones: Optional[List[Dict[str, Any]]] = None
    
    # Allow updating these independently
    equipment_module_id: Optional[UUID] = None
    equipment_inverter_id: Optional[UUID] = None
    
    placement_settings: Optional[PlacementSettings] = None
    
    # We might allow updating site_type, but that usually implies significant redesign
    site_type: Optional[SiteTypeEnum] = None


class SiteDesignResponse(SiteDesignBase):
    id: UUID
    tender_id: UUID
    pv_design_id: Optional[UUID] = None
    
    exclusion_zones: List[Dict[str, Any]] = []
    module_placements: List[Dict[str, Any]] = []
    
    # Ensure tilt_deg is populated in the response version of placement_settings if we ever want to flatten it
    # but currently it's nested in placement_settings.
    
    # Calculated Results
    total_modules: int = Field(..., description="Total number of modules placed.")
    system_size_kwp: float = Field(..., description="Total system capacity in kWp (modules * rating).")
    site_area_sqm: Optional[float] = Field(None, description="Total area of the site boundary in square meters.")
    
    # Task Tracking
    placement_task_id: Optional[str] = None
    placement_task_status: Optional[str] = None
    placement_task_error: Optional[str] = None
    placement_calculated_at: Optional[datetime] = None
    
    created_at: datetime
    updated_at: datetime




