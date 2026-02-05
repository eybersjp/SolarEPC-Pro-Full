from fastapi import APIRouter, HTTPException, status
from typing import List
from app.schemas.helioscope import ScenarioConfig, SimulationResult
from app.services.helioscope import HelioscopeService

router = APIRouter()

@router.post("/{tender_id}/helioscope/scenarios", response_model=List[ScenarioConfig])
async def get_scenarios(
    tender_id: str,
    annual_load_kwh: float = 100000.0, # Default if not provided
):
    """
    Generate simulation scenarios for a given annual load.
    """
    try:
        scenarios = HelioscopeService.generate_scenarios(annual_load_kwh)
        return scenarios
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to generate scenarios: {str(e)}"
        )

@router.get("/{tender_id}/helioscope/results", response_model=List[SimulationResult])
async def get_results(
    tender_id: str,
):
    """
    Fetch simulation results for all generated scenarios.
    """
    try:
        # In a real app, we'd fetch these from a database or Helioscope API
        scenarios = HelioscopeService.generate_scenarios(100000.0)
        results = HelioscopeService.get_mock_results(scenarios)
        return results
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to fetch results: {str(e)}"
        )
