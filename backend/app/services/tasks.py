from app.core.celery_app import celery_app
from app.services.placement_algorithm import PlacementAlgorithmService
from typing import Dict, Any, List

@celery_app.task
def calculate_placement_async(
    site_boundary: Dict[str, Any],
    exclusion_zones: List[Dict[str, Any]],
    module_dims: Dict[str, float],
    settings: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Async wrapper for placement calculation.
    """
    return PlacementAlgorithmService.calculate_placement(
        site_boundary,
        exclusion_zones,
        module_dims,
        settings
    )
