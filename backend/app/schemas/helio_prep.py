from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Dict, Any
from enum import Enum
from datetime import datetime

class UnitType(str, Enum):
    KW = "kW"
    KWH = "kWh"
    MW = "MW"
    MWH = "mWh"

class IntervalType(str, Enum):
    MIN_15 = "15min"
    MIN_30 = "30min"
    HOURLY = "hourly"
    MONTHLY = "monthly"

class UtilityBillEntry(BaseModel):
    start_date: datetime
    end_date: datetime
    consumption_kwh: float
    demand_kw: Optional[float] = None
    cost: Optional[float] = None

class LoadProfileEntry(BaseModel):
    timestamp: datetime
    value: float
    unit: UnitType

class SiteData(BaseModel):
    address: str
    latitude: float
    longitude: float
    utility_name: str
    tariff_name: str
    meter_number: Optional[str] = None

class InputDataset(BaseModel):
    site_data: SiteData
    utility_bills: List[UtilityBillEntry] = []
    load_profile: List[LoadProfileEntry] = []
    interval: IntervalType = IntervalType.MONTHLY

class ValidationFlag(BaseModel):
    field: str
    message: str
    severity: str  # "error" or "warning"

class ValidationResult(BaseModel):
    is_valid: bool
    flags: List[ValidationFlag] = []

class NormalizedDataset(BaseModel):
    site_id: str
    normalized_load_profile: List[LoadProfileEntry]
    annual_consumption_kwh: float
    peak_demand_kw: float
    standardized_tariff_name: str
