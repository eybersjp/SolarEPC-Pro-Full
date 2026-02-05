from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class ScenarioConfig(BaseModel):
    name: str
    load_offset_target: float  # e.g., 0.8, 1.0, 1.2
    inverter_ratio: float = 1.2
    has_bess: bool = False
    battery_capacity_kwh: Optional[float] = None
    battery_power_kw: Optional[float] = None

class SimulationResult(BaseModel):
    scenario_name: str
    annual_production_kwh: float
    performance_ratio: float
    system_loss: float
    specific_yield: float
    is_complete: bool = False
    error: Optional[str] = None

class HelioscopeProject(BaseModel):
    id: str
    external_id: str
    name: str
    status: str
