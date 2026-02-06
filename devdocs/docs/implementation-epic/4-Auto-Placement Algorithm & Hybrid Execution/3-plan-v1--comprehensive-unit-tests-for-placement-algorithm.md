I have created the following plan after thorough exploration and analysis of the codebase. Follow the below plan verbatim. Trust the files and references. Do not re-verify what's written in the plan. Explore only when absolutely necessary. First implement all the proposed file changes and then I'll review all the changes together at the end.

## Observations

The current test coverage in `test_placement_algorithm.py` is minimal with only three basic tests. The `PlacementAlgorithmService` uses Shapely for geometric operations, projects WGS84 coordinates to local meters, handles setbacks and exclusion zones, and generates grid-based module placements. The algorithm supports different orientations (portrait/landscape), azimuth angles, and returns GeoJSON Feature collections. The existing tests use a simple square boundary and don't cover edge cases, complex geometries, or performance scenarios.

## Approach

Expand the test suite systematically by organizing tests into logical groups: edge cases (boundary conditions, extreme setbacks, empty results), orientation and azimuth variations (all cardinal directions, both orientations), complex boundary shapes (L-shaped, irregular, concave polygons), GeoJSON output validation (structure, coordinate validity, feature properties), and performance testing (1,000+ module scenarios). Each test will use realistic GeoJSON polygon data, validate both the algorithm's behavior and output structure, and ensure the implementation handles all specified requirements robustly.

## Implementation Steps

### 1. Add Edge Case Tests

Create test functions in `file:backend/tests/test_placement_algorithm.py` to cover boundary conditions:

**Test very small boundaries:**
- Create a polygon with dimensions smaller than module size plus setbacks
- Verify `total_modules` returns 0
- Verify `module_placements` is an empty list
- Check that `stats` contains appropriate error or warning message

**Test large setbacks:**
- Use the existing `SQUARE_BOUNDARY` with setback larger than half the boundary size
- Verify the safe area becomes empty and no modules are placed
- Validate the error message in stats: `"Setback too large, no placement area remaining"`

**Test multiple exclusion zones:**
- Create 3-5 exclusion zones distributed across the boundary
- Compare total module count with baseline (no exclusions)
- Verify modules don't intersect with any exclusion zone by checking geometry
- Test overlapping exclusion zones to ensure proper handling

**Test boundary at edge of valid coordinates:**
- Create polygons near coordinate extremes (e.g., near poles, date line)
- Verify projection and transformation work correctly
- Validate output coordinates remain within valid WGS84 ranges

### 2. Add Orientation and Azimuth Tests

Expand orientation testing beyond the existing 90° test:

**Test portrait vs landscape orientation:**
- Create two test cases with identical boundaries and settings, varying only orientation
- For portrait: `module_orientation: "portrait"` (width=1m, height=2m)
- For landscape: `module_orientation: "landscape"` (width=2m, height=1m)
- Compare module counts and verify they differ based on boundary shape
- Validate module footprint dimensions in the output geometry

**Test all cardinal azimuth angles:**
- Test azimuth at 0° (North), 90° (East), 180° (South), 270° (West)
- Use a rectangular boundary (not square) to see orientation effects
- Verify module placement rotation by checking coordinate patterns
- Ensure total module count remains consistent across azimuths for symmetric boundaries

**Test intermediate azimuth angles:**
- Test 45°, 135°, 225°, 315° to verify rotation logic
- Validate that rotated modules still respect boundary and exclusion zones

### 3. Add Complex Boundary Shape Tests

Create test data for non-rectangular polygons:

**L-shaped polygon:**
```python
L_SHAPED_BOUNDARY = {
    "type": "Polygon",
    "coordinates": [[
        [0, 0], [0.002, 0], [0.002, 0.001], 
        [0.001, 0.001], [0.001, 0.002], 
        [0, 0.002], [0, 0]
    ]]
}
```
- Verify algorithm handles the concave corner correctly
- Check that modules fill both arms of the L-shape
- Validate no modules are placed outside the boundary

**Irregular polygon (pentagon/hexagon):**
- Create a 5 or 6-sided polygon with varying edge lengths
- Verify the algorithm adapts to the irregular shape
- Check edge setback is applied uniformly around all edges

**Concave polygon:**
- Create a polygon with one or more inward-pointing vertices
- Verify Shapely's `contains()` check properly excludes modules in concave areas
- Validate total module count is less than equivalent convex hull area

**Polygon with holes (interior rings):**
```python
POLYGON_WITH_HOLE = {
    "type": "Polygon",
    "coordinates": [
        [[0, 0], [0.002, 0], [0.002, 0.002], [0, 0.002], [0, 0]],  # Exterior
        [[0.0008, 0.0008], [0.0012, 0.0008], [0.0012, 0.0012], [0.0008, 0.0012], [0.0008, 0.0008]]  # Hole
    ]
}
```
- Verify modules are not placed in the interior hole
- Compare with exclusion zone approach to ensure consistency

### 4. Add GeoJSON Output Validation Tests

Create comprehensive output structure validation:

**Validate GeoJSON Feature structure:**
- Assert each item in `module_placements` has `type: "Feature"`
- Verify `geometry` key exists with `type: "Polygon"`
- Check `coordinates` is a list of lists (exterior ring)
- Validate `properties` contains `{"type": "module"}`

**Validate coordinate validity:**
- For each module placement, extract coordinates
- Verify all coordinates are within valid WGS84 ranges: longitude [-180, 180], latitude [-90, 90]
- Check polygon closure: first coordinate equals last coordinate
- Verify minimum 4 coordinates (triangle + closure)

**Validate module geometry dimensions:**
- Transform module polygon back to meters using the same projection
- Calculate actual width and height from coordinates
- Assert dimensions match expected module size (within tolerance for projection errors)
- Verify module rectangles are properly oriented based on azimuth setting

**Validate stats output:**
- Check `stats` dictionary contains `safe_area_sqm` and `boundary_area_sqm`
- Verify `safe_area_sqm` < `boundary_area_sqm` when setback > 0
- Calculate expected safe area and compare with actual (within tolerance)

### 5. Add Performance Tests

Create tests for large-scale scenarios:

**Test with estimated 1,000 modules:**
- Create a large boundary (e.g., 0.01° x 0.01° ≈ 1.1km x 1.1km)
- Use small modules (2m x 1m) and minimal spacing
- Measure execution time using `pytest` fixtures or `time.time()`
- Assert execution completes within reasonable time (e.g., < 5 seconds)
- Verify `total_modules` >= 1000

**Test with estimated 2,000-5,000 modules:**
- Scale up boundary size or reduce module size
- Verify algorithm remains performant
- Check memory usage doesn't explode (monitor list sizes)

**Test performance with multiple exclusion zones:**
- Create scenario with 1,000+ modules and 10+ exclusion zones
- Measure performance impact of exclusion zone checking
- Verify correctness is maintained at scale

### 6. Add Parametrized Tests

Use `pytest.mark.parametrize` to reduce code duplication:

**Parametrize orientation tests:**
```python
@pytest.mark.parametrize("orientation,expected_min_modules", [
    ("portrait", 500),
    ("landscape", 400),
])
def test_orientation_variations(orientation, expected_min_modules):
    # Test implementation
```

**Parametrize azimuth tests:**
```python
@pytest.mark.parametrize("azimuth", [0, 45, 90, 135, 180, 225, 270, 315])
def test_azimuth_angles(azimuth):
    # Test implementation
```

**Parametrize setback values:**
```python
@pytest.mark.parametrize("setback,should_have_modules", [
    (0.5, True),
    (1.0, True),
    (5.0, True),
    (50.0, False),  # Too large
])
def test_setback_variations(setback, should_have_modules):
    # Test implementation
```

### 7. Add Helper Functions and Fixtures

Create reusable test utilities at the top of the test file:

**Geometry creation helpers:**
```python
def create_rectangle_boundary(width_deg, height_deg, center_lon=0, center_lat=0):
    """Create a rectangular GeoJSON polygon."""
    
def create_l_shaped_boundary(arm_length_deg, arm_width_deg):
    """Create an L-shaped GeoJSON polygon."""
    
def create_exclusion_zone(center_lon, center_lat, size_deg):
    """Create a small square exclusion zone."""
```

**Validation helpers:**
```python
def validate_geojson_feature(feature):
    """Validate a single GeoJSON feature structure."""
    
def validate_module_placement_output(result):
    """Validate the complete placement algorithm output."""
    
def calculate_module_area_from_coords(coords, module_dims):
    """Calculate actual module dimensions from WGS84 coordinates."""
```

**Performance measurement fixture:**
```python
@pytest.fixture
def performance_timer():
    """Fixture to measure test execution time."""
```

### 8. Add Regression Tests

Create tests that capture current behavior to prevent regressions:

**Snapshot test for known configuration:**
- Use a fixed boundary, settings, and module dimensions
- Store expected module count and key coordinates
- Assert future runs produce identical results
- Update snapshot when algorithm intentionally changes

**Test consistency across runs:**
- Run the same calculation multiple times
- Verify deterministic output (same input → same output)
- Check for any randomness or floating-point inconsistencies

### 9. Documentation and Test Organization

Organize the test file with clear sections:

```python
# ============================================================================
# TEST DATA AND FIXTURES
# ============================================================================

# ============================================================================
# EDGE CASE TESTS
# ============================================================================

# ============================================================================
# ORIENTATION AND AZIMUTH TESTS
# ============================================================================

# ============================================================================
# COMPLEX BOUNDARY TESTS
# ============================================================================

# ============================================================================
# GEOJSON OUTPUT VALIDATION TESTS
# ============================================================================

# ============================================================================
# PERFORMANCE TESTS
# ============================================================================
```

Add docstrings to each test function explaining:
- What scenario is being tested
- Expected behavior
- Why this test is important

### 10. Integration with Existing Test Infrastructure

Ensure compatibility with the existing test setup:

- Use the same import patterns as existing tests
- Leverage any fixtures from `conftest.py` if applicable
- Follow the existing naming convention (`test_*`)
- Ensure tests can run independently and in any order
- Add markers for slow tests: `@pytest.mark.slow` for performance tests