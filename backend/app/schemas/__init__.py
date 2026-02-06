"""
Pydantic schemas for request/response validation.
"""
from typing import Optional
from datetime import datetime
from uuid import UUID
from enum import Enum

from pydantic import BaseModel, EmailStr, Field


# Enums
class UserRoleEnum(str, Enum):
    ADMIN = "admin"
    PM = "pm"
    ENGINEER = "engineer"
    VIEWER = "viewer"


class TenderStatusEnum(str, Enum):
    DRAFT = "draft"
    IN_REVIEW = "in_review"
    SUBMITTED = "submitted"
    WON = "won"
    LOST = "lost"


# Auth Schemas
class SignupRequest(BaseModel):
    """User signup with new tenant."""
    firebase_token: str
    email: EmailStr
    name: str
    tenant_name: str = Field(..., min_length=2, max_length=100)


class LoginRequest(BaseModel):
    """User login."""
    firebase_token: str


class UserResponse(BaseModel):
    """User response."""
    id: UUID
    email: str
    name: Optional[str]
    role: UserRoleEnum
    tenant_id: UUID
    is_active: bool
    
    class Config:
        from_attributes = True


class UserInvite(BaseModel):
    """Invite user to tenant."""
    email: EmailStr
    name: str
    role: UserRoleEnum = UserRoleEnum.VIEWER


# Tenant Schemas
class TenantCreate(BaseModel):
    """Create tenant."""
    name: str = Field(..., min_length=2, max_length=100)


class TenantResponse(BaseModel):
    """Tenant response."""
    id: UUID
    name: str
    
    class Config:
        from_attributes = True


# Tender Schemas
class TenderCreate(BaseModel):
    """Create tender."""
    name: str = Field(..., min_length=2, max_length=200)
    client_name: Optional[str] = None
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    target_capacity_kw: Optional[float] = Field(None, gt=0)


class TenderUpdate(BaseModel):
    """Update tender."""
    name: Optional[str] = Field(None, min_length=2, max_length=200)
    client_name: Optional[str] = None
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    target_capacity_kw: Optional[float] = Field(None, gt=0)
    status: Optional[TenderStatusEnum] = None


class TenderResponse(BaseModel):
    """Tender response."""
    id: UUID
    name: str
    client_name: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]
    target_capacity_kw: Optional[float]
    status: TenderStatusEnum
    created_at: datetime
    
    class Config:
        from_attributes = True


# Precondition Schemas
class PreconditionUpdate(BaseModel):
    """Update preconditions."""
    grid_connection: Optional[bool] = None
    land_access: Optional[bool] = None
    permits_cleared: Optional[bool] = None
    financing_confirmed: Optional[bool] = None
    go_decision: Optional[bool] = None
    notes: Optional[str] = None


class PreconditionResponse(BaseModel):
    """Precondition response."""
    grid_connection: bool
    land_access: bool
    permits_cleared: bool
    financing_confirmed: bool
    go_decision: bool
    notes: Optional[str]
    
    class Config:
        from_attributes = True


# PV Design Schemas
class PVDesignCreate(BaseModel):
    """Create PV design."""
    module_model: str
    module_watt: int = Field(..., gt=0)
    inverter_model: str
    inverter_kw: int = Field(..., gt=0)
    strings_per_inverter: int = Field(..., gt=0)
    modules_per_string: int = Field(..., gt=0)


class PVDesignResponse(BaseModel):
    """PV design response with calculated fields."""
    id: UUID
    module_model: str
    module_watt: int
    inverter_model: str
    inverter_kw: int
    strings_per_inverter: int
    modules_per_string: int
    dc_ac_ratio: float
    total_modules: int
    total_capacity_kwp: float
    created_at: datetime
    
    class Config:
        from_attributes = True


# BOQ Schemas
class BOQItemCreate(BaseModel):
    """Create BOQ item."""
    category: str
    description: str
    unit_cost: float = Field(..., ge=0)
    quantity: int = Field(..., gt=0)
    margin_pct: float = Field(0.0, ge=0, le=100)


class BOQItemUpdate(BaseModel):
    """Update BOQ item."""
    category: Optional[str] = None
    description: Optional[str] = None
    unit_cost: Optional[float] = Field(None, ge=0)
    quantity: Optional[int] = Field(None, gt=0)
    margin_pct: Optional[float] = Field(None, ge=0, le=100)


class BOQItemResponse(BaseModel):
    """BOQ item response."""
    id: UUID
    category: str
    description: str
    unit_cost: float
    quantity: int
    margin_pct: float
    line_total: float
    
    class Config:
        from_attributes = True


class BOQSummary(BaseModel):
    """BOQ summary with totals."""
    items: list[BOQItemResponse]
    subtotal: float
    total_margin: float
    grand_total: float


# Equipment Schemas
class EquipmentModuleCreate(BaseModel):
    """Create Equipment Module."""
    manufacturer: str = Field(..., min_length=1, max_length=255)
    model: str = Field(..., min_length=1, max_length=255)
    wattage: int = Field(..., gt=0)
    efficiency: float = Field(..., ge=0, le=100)
    
    length_m: float = Field(..., gt=0)
    width_m: float = Field(..., gt=0)
    thickness_m: float = Field(..., gt=0)
    
    voc: float = Field(..., gt=0)
    isc: float = Field(..., gt=0)
    vmp: float = Field(..., gt=0)
    imp: float = Field(..., gt=0)


class EquipmentModuleResponse(EquipmentModuleCreate):
    """Equipment Module response."""
    id: UUID
    tenant_id: Optional[UUID]
    is_global: bool
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class EquipmentInverterCreate(BaseModel):
    """Create Equipment Inverter."""
    manufacturer: str = Field(..., min_length=1, max_length=255)
    model: str = Field(..., min_length=1, max_length=255)
    capacity_kw: float = Field(..., gt=0)
    
    max_dc_voltage: float = Field(..., gt=0)
    mppt_voltage_range_min: float = Field(..., gt=0)
    mppt_voltage_range_max: float = Field(..., gt=0)
    max_input_current: float = Field(..., gt=0)
    num_mppt_channels: int = Field(..., gt=0)


class EquipmentInverterResponse(EquipmentInverterCreate):
    """Equipment Inverter response."""
    id: UUID
    tenant_id: Optional[UUID]
    is_global: bool
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class EquipmentSearchParams(BaseModel):
    """Query parameters for equipment search."""
    search_query: Optional[str] = None
    manufacturer: Optional[str] = None
    min_wattage: Optional[int] = None
    max_wattage: Optional[int] = None


# Site Design Schemas
from .site_design import (
    SiteDesignCreate,
    SiteDesignUpdate,
    SiteDesignResponse,
    SiteTypeEnum,
    ModuleOrientationEnum,
    GeoJSONPolygon,
    PlacementSettings,
)
