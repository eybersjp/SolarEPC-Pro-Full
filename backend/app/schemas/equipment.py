from typing import Optional
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field


class ModuleBase(BaseModel):
    manufacturer: str = Field(..., min_length=1, max_length=255)
    model: str = Field(..., min_length=1, max_length=255)
    wattage: int = Field(..., gt=0)
    efficiency: float = Field(..., gt=0, le=100)
    
    length_m: float = Field(..., gt=0)
    width_m: float = Field(..., gt=0)
    thickness_m: float = Field(..., gt=0)
    
    voc: float = Field(..., gt=0)
    isc: float = Field(..., gt=0)
    vmp: float = Field(..., gt=0)
    imp: float = Field(..., gt=0)


class ModuleCreate(ModuleBase):
    pass


class ModuleUpdate(BaseModel):
    manufacturer: Optional[str] = Field(None, min_length=1, max_length=255)
    model: Optional[str] = Field(None, min_length=1, max_length=255)
    wattage: Optional[int] = Field(None, gt=0)
    efficiency: Optional[float] = Field(None, gt=0, le=100)
    length_m: Optional[float] = Field(None, gt=0)
    width_m: Optional[float] = Field(None, gt=0)
    thickness_m: Optional[float] = Field(None, gt=0)
    voc: Optional[float] = Field(None, gt=0)
    isc: Optional[float] = Field(None, gt=0)
    vmp: Optional[float] = Field(None, gt=0)
    imp: Optional[float] = Field(None, gt=0)
    is_active: Optional[bool] = None


class ModuleResponse(ModuleBase):
    id: UUID
    tenant_id: Optional[UUID]
    is_global: bool
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class InverterBase(BaseModel):
    manufacturer: str = Field(..., min_length=1, max_length=255)
    model: str = Field(..., min_length=1, max_length=255)
    capacity_kw: float = Field(..., gt=0)
    
    max_dc_voltage: float = Field(..., gt=0)
    mppt_voltage_range_min: float = Field(..., gt=0)
    mppt_voltage_range_max: float = Field(..., gt=0)
    max_input_current: float = Field(..., gt=0)
    num_mppt_channels: int = Field(..., gt=0)


class InverterCreate(InverterBase):
    pass


class InverterUpdate(BaseModel):
    manufacturer: Optional[str] = Field(None, min_length=1, max_length=255)
    model: Optional[str] = Field(None, min_length=1, max_length=255)
    capacity_kw: Optional[float] = Field(None, gt=0)
    max_dc_voltage: Optional[float] = Field(None, gt=0)
    mppt_voltage_range_min: Optional[float] = Field(None, gt=0)
    mppt_voltage_range_max: Optional[float] = Field(None, gt=0)
    max_input_current: Optional[float] = Field(None, gt=0)
    num_mppt_channels: Optional[int] = Field(None, gt=0)
    is_active: Optional[bool] = None


class InverterResponse(InverterBase):
    id: UUID
    tenant_id: Optional[UUID]
    is_global: bool
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True
