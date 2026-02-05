from typing import List
from app.schemas.helioscope import ScenarioConfig, SimulationResult

class HelioscopeService:
    @staticmethod
    def generate_scenarios(load_kwh: float) -> List[ScenarioConfig]:
        """
        Create a set of target scenarios based on annual load.
        """
        scenarios = []
        
        # Default PV-only scenarios
        for offset in [0.8, 1.0, 1.2]:
            scenarios.append(ScenarioConfig(
                name=f"PV Only - {int(offset*100)}% Offset",
                load_offset_target=offset,
                has_bess=False
            ))
            
        # Default PV+BESS scenarios (Small/Medium/Large battery variants)
        for size_label, cap in [("Small", 50), ("Medium", 100), ("Large", 200)]:
            scenarios.append(ScenarioConfig(
                name=f"PV+BESS ({size_label}) - 100% Offset",
                load_offset_target=1.0,
                has_bess=True,
                battery_capacity_kwh=float(cap),
                battery_power_kw=float(cap / 2) # Assume 2-hour battery
            ))
            
        return scenarios

    @staticmethod
    def get_mock_results(scenarios: List[ScenarioConfig]) -> List[SimulationResult]:
        """
        Return dummy simulation results for development.
        """
        results = []
        for s in scenarios:
            # Mock production based on offset target
            # Rough estimate: 1kWp produces ~1500 kWh/year
            # We don't have capacity yet, so just scale relative to load placeholder
            production = 100000 * s.load_offset_target 
            
            results.append(SimulationResult(
                scenario_name=s.name,
                annual_production_kwh=production,
                performance_ratio=0.82,
                system_loss=14.5,
                specific_yield=1550.0,
                is_complete=True
            ))
        return results
