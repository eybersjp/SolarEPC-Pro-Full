I have the following user query that I want you to help me with. Please implement the requested functionality following best practices.

Create `c:\Users\SSTECH\developments\apps\solarepc-pro\backend\app\services\site_design.py` following the service pattern from `c:\Users\SSTECH\developments\apps\solarepc-pro\backend\app\services\tender.py`:

- Implement `SiteDesignService` class with `__init__(db, tenant_id, user_id)`
- Add CRUD methods: `create_design()`, `get_design()`, `get_design_or_404()`, `list_designs()`, `update_design()`, `delete_design()`
- Integrate GeoJSON validation using `validate_geojson_polygon()` from `c:\Users\SSTECH\developments\apps\solarepc-pro\backend\app\utils\geojson_validator.py`
- Calculate site area using `calculate_polygon_area_sqm()` and store in `site_area_sqm` field
- Validate equipment references (`equipment_module_id`, `equipment_inverter_id`) exist using `EquipmentLibraryService`
- Apply default `tilt_deg` based on `site_type` if not provided (rooftop: 10°, ground_mount: 25°, carport: 5°)
- Enforce tenant isolation (designs accessible only via `tender.tenant_id`)
- Integrate `AuditService` for all mutations (create, update, delete)
- Handle placement settings from nested `PlacementSettings` schema