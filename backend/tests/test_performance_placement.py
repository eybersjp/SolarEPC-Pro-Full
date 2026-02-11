import pytest
import time
import json
import os
from dataclasses import dataclass, asdict
from typing import Dict, Any, List
from unittest.mock import MagicMock, patch
from concurrent.futures import ThreadPoolExecutor, as_completed
from app.services.placement_algorithm import PlacementAlgorithmService

@dataclass
class PerformanceMetrics:
    test_name: str
    modules: int
    execution_time: float
    modules_per_second: float = 0.0
    memory_usage: float = 0.0  # Placeholder for future enhancement
    timestamp: str = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

class MetricsCollector:
    def __init__(self):
        self.metrics: List[PerformanceMetrics] = []

    def add(self, metric: PerformanceMetrics):
        self.metrics.append(metric)

    def save_to_json(self, filepath: str):
        with open(filepath, 'w') as f:
            json.dump([asdict(m) for m in self.metrics], f, indent=2)

@pytest.fixture(scope="module")
def performance_metrics():
    collector = MetricsCollector()
    yield collector
    
    # Save results if requested via environment variable
    output_path = os.environ.get("PERFORMANCE_REPORT_PATH")
    if output_path:
        # Ensure directory exists
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        collector.save_to_json(output_path)
        print(f"\n[Performance] Report saved to {output_path}")

# Mark all tests in this file as performance tests
pytestmark = pytest.mark.performance

# Register marker to avoid warnings
def pytest_configure(config):
    config.addinivalue_line("markers", "performance: mark test as performance test")
    config.addinivalue_line("markers", "slow: Slow-running tests")

# Helper functions
def create_square_boundary(side_length_deg: float, center_lat: float = 34.0522, center_lon: float = -118.2437) -> Dict[str, Any]:
    """
    Create a square boundary centered at given coordinates.
    
    Args:
        side_length_deg: Side length in degrees (0.001 deg ≈ 111m)
        center_lat: Center latitude
        center_lon: Center longitude
    
    Returns:
        GeoJSON Polygon
    """
    half = side_length_deg / 2
    return {
        "type": "Polygon",
        "coordinates": [[
            [center_lon - half, center_lat - half],
            [center_lon + half, center_lat - half],
            [center_lon + half, center_lat + half],
            [center_lon - half, center_lat + half],
            [center_lon - half, center_lat - half]
        ]]
    }

def create_boundary_for_target_modules(target_modules: int, module_dims: Dict[str, float], settings: Dict[str, Any]) -> Dict[str, Any]:
    """
    Create a boundary that should yield approximately the target number of modules.
    
    This is an approximation based on:
    - Module dimensions
    - Row spacing
    - Edge setback
    - Typical packing efficiency (~70-80%)
    """
    setback = settings.get('edge_setback_m', 1.0)
    row_spacing = settings.get('row_spacing_m', 2.0)
    orientation = settings.get('module_orientation', 'portrait')
    
    # Determine module footprint
    if orientation == 'portrait':
        mod_width = module_dims['width_m']
        mod_height = module_dims['length_m']
    else:
        mod_width = module_dims['length_m']
        mod_height = module_dims['width_m']
    
    # Row pitch (module height + spacing)
    row_pitch = mod_height + row_spacing
    
    # Estimate required area (with 75% packing efficiency)
    module_area = mod_width * mod_height
    total_module_area = target_modules * module_area
    required_gross_area = total_module_area / 0.75
    
    # Account for setbacks (reduce usable area)
    # If side length is L, usable area is (L - 2*setback)^2
    # So L^2 - 4*L*setback + 4*setback^2 = usable_area
    # Approximate: L ≈ sqrt(usable_area) + 2*setback
    side_length_m = (required_gross_area ** 0.5) + (2 * setback)
    
    # Convert meters to degrees (approximate: 1 deg ≈ 111km = 111,000m)
    side_length_deg = side_length_m / 111000.0
    
    return create_square_boundary(side_length_deg)

# Performance Tests

def test_small_site_auto_placement_performance(performance_metrics):
    """
    Test that auto-placement for small sites (<1,000 modules) completes in <2 seconds.
    
    Acceptance Criteria:
    - Site with <1,000 modules
    - Execution time <2 seconds
    - Correct module placement
    """
    # Setup: Create boundary for ~800 modules
    module_dims = {
        "length_m": 2.0,
        "width_m": 1.0
    }
    
    settings = {
        "edge_setback_m": 1.0,
        "row_spacing_m": 2.0,
        "module_orientation": "portrait",
        "azimuth_deg": 180.0
    }
    
    boundary = create_boundary_for_target_modules(800, module_dims, settings)
    
    # Execute and measure time
    start_time = time.time()
    result = PlacementAlgorithmService.calculate_placement(
        boundary,
        [],  # No exclusion zones
        module_dims,
        settings
    )
    execution_time = time.time() - start_time
    
    # Assertions
    assert result["total_modules"] > 0, "Should place at least some modules"
    assert result["total_modules"] < 1000, f"Should be <1,000 modules for small site test, got {result['total_modules']}"
    assert execution_time < 2.0, f"Execution time {execution_time:.3f}s exceeds 2s threshold"
    assert len(result["module_placements"]) == result["total_modules"], "Module placement count mismatch"
    
    # Collect metrics
    performance_metrics.add(PerformanceMetrics(
        test_name="test_small_site_auto_placement_performance",
        modules=result["total_modules"],
        execution_time=execution_time,
        modules_per_second=result["total_modules"] / execution_time if execution_time > 0 else 0
    ))

    # Log performance
    print(f"\n✓ Small site performance: {result['total_modules']} modules in {execution_time:.3f}s")

def test_large_site_async_task_handling():
    """
    Test that large sites (>1,000 modules) are handled via async tasks.
    
    Acceptance Criteria:
    - Site with >1,000 modules
    - Async task is triggered (not executed synchronously in API handler)
    - Task status transitions correctly
    
    Note: This test verifies the service layer behavior, not the algorithm itself.
    """
    from app.services.site_design import SiteDesignService
    from app.models.models import SiteDesign, Tenant, User, Tender, EquipmentModule, EquipmentInverter
    from app.core.database import SessionLocal
    from uuid import uuid4
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from app.core.database import Base
    
    # Create test database
    TEST_DB_URL = "sqlite:///./test_perf_large_site.db"
    engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    SessionLocalTest = sessionmaker(autocommit=False, autoflush=False, bind=engine, expire_on_commit=False)
    session = SessionLocalTest()
    
    try:
        # Setup test data
        tenant = Tenant(id=uuid4(), name="Perf Test Tenant")
        session.add(tenant)
        
        user = User(
            id=uuid4(),
            tenant_id=tenant.id,
            email="perf@test.com",
            firebase_uid="perf_test",
            role="admin",
            is_active=True
        )
        session.add(user)
        
        module = EquipmentModule(
            id=uuid4(),
            manufacturer="Test",
            model="T-400",
            wattage=400,
            efficiency=20.0,
            length_m=2.0,
            width_m=1.0,
            thickness_m=0.04,
            is_global=True,
            voc=48.0,
            isc=10.0,
            vmp=40.0,
            imp=9.5
        )
        session.add(module)
        
        inverter = EquipmentInverter(
            id=uuid4(),
            manufacturer="Test",
            model="I-50K",
            capacity_kw=50.0,
            is_global=True,
            max_dc_voltage=1000,
            mppt_voltage_range_min=200,
            mppt_voltage_range_max=800,
            max_input_current=15,
            num_mppt_channels=2
        )
        session.add(inverter)
        
        tender = Tender(
            id=uuid4(),
            tenant_id=tenant.id,
            created_by=user.id,
            name="Perf Test Tender",
            latitude=34.0522,
            longitude=-118.2437,
            status="submitted"
        )
        session.add(tender)
        session.commit()
        
        # Create large boundary (should yield >1,000 modules)
        module_dims = {"length_m": 2.0, "width_m": 1.0}
        settings = {
            "edge_setback_m": 1.0,
            "row_spacing_m": 2.0,
            "module_orientation": "portrait",
            "azimuth_deg": 180.0
        }
        large_boundary = create_boundary_for_target_modules(1500, module_dims, settings)
        
        # Create design
        sd_service = SiteDesignService(session, tenant_id=tenant.id, user_id=user.id)
        design = sd_service.create_design(
            tender_id=tender.id,
            name="Large Site Performance Test",
            site_type="ground_mount",
            equipment_module_id=module.id,
            equipment_inverter_id=inverter.id,
            site_boundary=large_boundary,
            placement_settings=settings
        )
        session.commit()
        
        # Mock the async task to verify it's called
        with patch("app.services.tasks.calculate_placement_async.delay") as mock_delay:
            mock_delay.return_value = MagicMock(id="test_task_id")
            
            # Trigger recalculation (should use async for large site)
            sd_service.recalculate_design(design.id)
            
            # Verify async task was called
            assert mock_delay.called, "Async task should be triggered for large sites"
            
            # Verify design status
            session.refresh(design)
            assert design.placement_task_status == "pending", "Task status should be pending"
            assert design.placement_task_id == "test_task_id", "Task ID should be set"
        
        print(f"\n✓ Large site async handling: Task queued for site with >1,000 expected modules")
        
    finally:
        session.close()
        import os
        if os.path.exists("./test_perf_large_site.db"):
            try:
                os.remove("./test_perf_large_site.db")
            except:
                pass

@pytest.mark.parametrize("target_modules,expected_max_time", [
    (100, 0.5),
    (500, 1.0),
    (1000, 2.0),
    (2000, 4.0),
    (5000, 10.0),
])
def test_placement_algorithm_efficiency_various_sizes(target_modules: int, expected_max_time: float, performance_metrics):
    """
    Test placement algorithm efficiency across various site sizes.
    
    Verifies that execution time scales reasonably with site size.
    Expected scaling: roughly linear or sub-linear with module count.
    """
    module_dims = {
        "length_m": 2.0,
        "width_m": 1.0
    }
    
    settings = {
        "edge_setback_m": 1.0,
        "row_spacing_m": 2.0,
        "module_orientation": "portrait",
        "azimuth_deg": 180.0
    }
    
    boundary = create_boundary_for_target_modules(target_modules, module_dims, settings)
    
    # Execute and measure
    start_time = time.time()
    result = PlacementAlgorithmService.calculate_placement(
        boundary,
        [],
        module_dims,
        settings
    )
    execution_time = time.time() - start_time
    
    # Assertions
    assert result["total_modules"] > 0, "Should place modules"
    assert execution_time < expected_max_time, \
        f"Execution time {execution_time:.3f}s exceeds expected {expected_max_time}s for ~{target_modules} modules"
    
    # Calculate modules per second
    modules_per_second = result["total_modules"] / execution_time if execution_time > 0 else 0
    
    # Collect metrics
    performance_metrics.add(PerformanceMetrics(
        test_name=f"test_placement_algorithm_efficiency_{target_modules}",
        modules=result["total_modules"],
        execution_time=execution_time,
        modules_per_second=modules_per_second
    ))

    print(f"\n✓ Performance for ~{target_modules} modules: "
          f"{result['total_modules']} actual modules in {execution_time:.3f}s "
          f"({modules_per_second:.0f} modules/s)")

def test_placement_with_complex_geometries(performance_metrics):
    """
    Test placement performance with complex geometries (multiple exclusion zones).
    
    Verifies that algorithm handles complex inputs efficiently.
    """
    # Create main boundary for ~800 modules
    module_dims = {
        "length_m": 2.0,
        "width_m": 1.0
    }
    
    settings = {
        "edge_setback_m": 1.0,
        "row_spacing_m": 2.0,
        "module_orientation": "portrait",
        "azimuth_deg": 180.0
    }
    
    boundary = create_boundary_for_target_modules(800, module_dims, settings)
    
    # Create 10 small exclusion zones scattered across the site
    exclusion_zones = []
    for i in range(10):
        offset_lat = (i % 3 - 1) * 0.0001
        offset_lon = (i // 3 - 1) * 0.0001
        exclusion = create_square_boundary(0.00005, center_lat=34.0522 + offset_lat, center_lon=-118.2437 + offset_lon)
        exclusion_zones.append(exclusion)
    
    # Execute and measure
    start_time = time.time()
    result = PlacementAlgorithmService.calculate_placement(
        boundary,
        exclusion_zones,
        module_dims,
        settings
    )
    execution_time = time.time() - start_time
    
    # Assertions
    assert result["total_modules"] > 0, "Should place modules despite exclusions"
    assert execution_time < 3.0, f"Complex geometry execution time {execution_time:.3f}s exceeds 3s threshold"
    
    # Collect metrics
    performance_metrics.add(PerformanceMetrics(
        test_name="test_placement_with_complex_geometries",
        modules=result["total_modules"],
        execution_time=execution_time,
        modules_per_second=result["total_modules"] / execution_time if execution_time > 0 else 0
    ))

    # Verify exclusions had an effect
    result_no_exclusions = PlacementAlgorithmService.calculate_placement(
        boundary,
        [],
        module_dims,
        settings
    )
    assert result["total_modules"] < result_no_exclusions["total_modules"], \
        "Exclusion zones should reduce module count"
    
    print(f"\n✓ Complex geometry performance: {result['total_modules']} modules "
          f"with 10 exclusion zones in {execution_time:.3f}s")

def test_concurrent_design_operations(performance_metrics):
    """
    Test concurrent placement calculations to verify thread safety and throughput.
    
    Simulates multiple users calculating placements simultaneously.
    """
    module_dims = {
        "length_m": 2.0,
        "width_m": 1.0
    }
    
    settings = {
        "edge_setback_m": 1.0,
        "row_spacing_m": 2.0,
        "module_orientation": "portrait",
        "azimuth_deg": 180.0
    }
    
    # Create 5 different boundaries (simulating different designs)
    boundaries = [
        create_boundary_for_target_modules(300 + i * 100, module_dims, settings)
        for i in range(5)
    ]
    
    def calculate_placement_task(boundary_idx: int) -> Dict[str, Any]:
        """Task to execute in thread pool"""
        boundary = boundaries[boundary_idx]
        start = time.time()
        result = PlacementAlgorithmService.calculate_placement(
            boundary,
            [],
            module_dims,
            settings
        )
        elapsed = time.time() - start
        return {
            "boundary_idx": boundary_idx,
            "modules": result["total_modules"],
            "time": elapsed
        }
    
    # Execute concurrently
    start_time = time.time()
    results = []
    
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(calculate_placement_task, i) for i in range(5)]
        for future in as_completed(futures):
            results.append(future.result())
    
    total_time = time.time() - start_time
    
    # Assertions
    assert len(results) == 5, "All 5 calculations should complete"
    for result in results:
        assert result["modules"] > 0, f"Boundary {result['boundary_idx']} should place modules"
        assert result["time"] < 2.0, f"Individual calculation time {result['time']:.3f}s exceeds 2s"
    
    # Calculate throughput
    total_modules = sum(r["modules"] for r in results)
    throughput = len(results) / total_time
    
    # Collect metrics
    performance_metrics.add(PerformanceMetrics(
        test_name="test_concurrent_design_operations",
        modules=total_modules,
        execution_time=total_time,
        modules_per_second=total_modules / total_time if total_time > 0 else 0
    ))

    print(f"\n✓ Concurrent operations: {len(results)} designs ({total_modules} total modules) "
          f"in {total_time:.3f}s ({throughput:.2f} designs/s)")
    
    # Verify reasonable concurrency (should be faster than sequential)
    sequential_time_estimate = sum(r["time"] for r in results)
    assert total_time < sequential_time_estimate * 0.8, \
        "Concurrent execution should be faster than sequential"
