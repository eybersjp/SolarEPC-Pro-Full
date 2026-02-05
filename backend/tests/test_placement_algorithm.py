import pytest
from app.services.placement_algorithm import PlacementAlgorithmService

# Mock data
# Use valid Lat/Lon. 0.001 deg ~ 111m.
# Square ~110m x 110m.
SQUARE_BOUNDARY = {
    "type": "Polygon",
    "coordinates": [[
        [0, 0], [0.001, 0], [0.001, 0.001], [0, 0.001], [0, 0]
    ]]
}

MODULE_DIMS = {
    "length_m": 2.0,
    "width_m": 1.0
}

SETTINGS = {
    "edge_setback_m": 1.0,
    "row_spacing_m": 2.0,
    "module_orientation": "portrait",
    "azimuth_deg": 180.0
}

def test_calculate_placement_simple():
    result = PlacementAlgorithmService.calculate_placement(
        SQUARE_BOUNDARY,
        [],
        MODULE_DIMS,
        SETTINGS
    )
    
    assert result["total_modules"] > 0
    assert len(result["module_placements"]) == result["total_modules"]
    
    # Check bounds
    # Safe area is 98x98
    # Portrait: 1m wide, 2m high.
    # Spacing 2m. 
    # Row height = 2m + 2m = 4m pitch? Or 2m module + 2m space?
    # Yes, typically "row spacing" is inter-row gap. Pitch = mod_y + gap.
    # Max rows approx 98 / 4 = 24.
    # Max cols approx 98 / 1.02 = 96.
    # Rough calc: 24 * 96 ~ 2300 modules.
    
    # Just ensure it's reasonable
    assert result["total_modules"] > 500

def test_placement_with_exclusion():
    # Exclusion in middle
    exclusion = {
        "type": "Polygon",
        "coordinates": [[
            [0.0004, 0.0004], [0.0006, 0.0004], [0.0006, 0.0006], [0.0004, 0.0006], [0.0004, 0.0004]
        ]]
    }
    
    result_base = PlacementAlgorithmService.calculate_placement(
        SQUARE_BOUNDARY,
        [],
        MODULE_DIMS,
        SETTINGS
    )
    
    result_excl = PlacementAlgorithmService.calculate_placement(
        SQUARE_BOUNDARY,
        [exclusion],
        MODULE_DIMS,
        SETTINGS
    )
    
    assert result_excl["total_modules"] < result_base["total_modules"]
    
def test_placement_rotation():
    # Rotate 90 deg (West facing?) -> Rows should run N-S
    settings_rot = SETTINGS.copy()
    settings_rot["azimuth_deg"] = 90.0
    
    result = PlacementAlgorithmService.calculate_placement(
        SQUARE_BOUNDARY,
        [],
        MODULE_DIMS,
        settings_rot
    )
    
    assert result["total_modules"] > 0
    # verify coordinates logic if possible or trust visuals later
