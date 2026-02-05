I have created the following plan after thorough exploration and analysis of the codebase. Follow the below plan verbatim. Trust the files and references. Do not re-verify what's written in the plan. Explore only when absolutely necessary. First implement all the proposed file changes and then I'll review all the changes together at the end.

## Observations

The codebase already has two separate test files (`test_site_design_service.py` and `test_site_design_api.py`) with basic coverage. The service implements comprehensive CRUD operations with GeoJSON validation, area calculation, equipment validation, tenant isolation, and audit logging. The existing tests cover basic scenarios but lack comprehensive coverage for edge cases, validation scenarios, and audit logging verification.

## Approach

Create a comprehensive unified test file `test_site_design.py` that consolidates and expands existing tests following the `test_equipment.py` pattern. The file will include extensive service-level tests for all CRUD operations, GeoJSON validation edge cases, area calculation accuracy, equipment reference validation, tenant isolation, and audit logging. API tests will cover authentication, authorization, error handling, and all HTTP endpoints with proper status codes.

## Implementation Instructions

### 1. Create Comprehensive Test File Structure

Create `file:backend/tests/test_site_design.py` with the following sections:

#### Test Setup and Fixtures

- Import required modules: `pytest`, `uuid`, `sqlalchemy`, `FastAPI TestClient`, models, services, schemas
- Create in-memory SQLite database configuration using `StaticPool` (same pattern as `test_equipment.py`)
- Define `db` fixture that creates/drops all tables for each test
- Define `test_data` fixture that creates: Tenant, User (ADMIN role), EquipmentModule, EquipmentInverter, Tender
- Define separate `test_user_pm` and `test_user_viewer` fixtures for role-based testing
- Configure FastAPI dependency overrides for `get_db` and `get_current_user`

### 2. Service Layer Tests - CRUD Operations

#### Test Create Design Success
- Use valid GeoJSON polygon (closed, 4+ vertices)
- Verify design created with correct attributes
- Verify `site_area_sqm` calculated and stored
- Verify default `tilt_deg` applied based on `site_type`:
  - `ground_mount`: 20.0°
  - `rooftop`: 10.0°
  - `carport`: 0.0°
- Verify audit log entry created with action="create"

#### Test Create Design with Custom Tilt
- Provide custom `tilt_deg` in `placement_settings`
- Verify custom tilt used instead of default

#### Test Get Design
- Create design, then retrieve by ID
- Verify all fields match

#### Test Get Design or 404
- Test with valid ID returns design
- Test with invalid ID raises HTTPException with status 404

#### Test List Designs
- Create multiple designs for same tender
- Verify all returned in descending order by `created_at`
- Verify empty list for tender with no designs

#### Test Update Geometry
- Create design with initial boundary
- Update with larger boundary
- Verify `site_area_sqm` recalculated
- Verify audit log entry with old/new values

#### Test Update Exclusion Zones
- Create design
- Add exclusion zones (valid GeoJSON polygons)
- Verify stored correctly
- Verify audit log entry

#### Test Update Settings
- Update `row_spacing_m`, `edge_setback_m`, `module_orientation`, `azimuth_deg`, `tilt_deg`
- Verify each field updated independently
- Verify audit log entries for changed fields only

#### Test Update Equipment
- Update `equipment_module_id` and `equipment_inverter_id`
- Verify equipment validated before update
- Verify audit log entry

#### Test Delete Design
- Create design, then delete
- Verify removed from database
- Verify audit log entry with action="delete"

### 3. Service Layer Tests - GeoJSON Validation

#### Test Valid Polygon
- Closed polygon with 4+ coordinates
- Verify validation passes

#### Test Polygon Not Closed
- First and last coordinates don't match
- Verify HTTPException raised with status 400
- Verify error message contains "must be closed"

#### Test Polygon Minimum Vertices
- Only 3 coordinates (triangle not closed)
- Verify HTTPException raised
- Verify error message contains "at least 3 vertices"

#### Test Invalid Coordinate Ranges
- Coordinates outside WGS84 bounds (lon: -180 to 180, lat: -90 to 90)
- Test longitude > 180
- Test latitude > 90
- Verify HTTPException raised with "Invalid coordinate values"

#### Test Self-Intersecting Polygon
- Create polygon with crossing edges
- Verify validation catches via Shapely
- Verify error message contains "Invalid geometry"

#### Test Invalid GeoJSON Type
- Provide `type: "Point"` instead of "Polygon"
- Verify HTTPException raised

#### Test Empty Coordinates
- Empty coordinates array
- Verify HTTPException raised

### 4. Service Layer Tests - Area Calculation

#### Test Area Calculation Accuracy
- Create known polygon (e.g., 0.001° × 0.001° square at equator ≈ 12,321 m²)
- Verify calculated area within 5% tolerance
- Test multiple polygon sizes (small, medium, large)

#### Test Area Calculation for Complex Polygon
- Non-rectangular polygon with 6+ vertices
- Verify area calculated correctly using Shapely

### 5. Service Layer Tests - Equipment Validation

#### Test Valid Equipment References
- Use existing module and inverter IDs
- Verify creation succeeds

#### Test Invalid Module ID
- Use non-existent UUID
- Verify HTTPException raised with status 400
- Verify error message contains "Equipment Module"

#### Test Invalid Inverter ID
- Use non-existent UUID
- Verify HTTPException raised with status 400
- Verify error message contains "Equipment Inverter"

#### Test Inactive Equipment
- Create equipment with `is_active=False`
- Attempt to use in design
- Verify HTTPException raised

#### Test Global Equipment Access
- Create global equipment (`is_global=True`, `tenant_id=None`)
- Verify accessible by any tenant

#### Test Tenant-Specific Equipment Access
- Create equipment for tenant A
- Attempt to use from tenant B
- Verify HTTPException raised (not accessible)

### 6. Service Layer Tests - Tenant Isolation

#### Test List Designs Tenant Isolation
- Create designs for tenant A
- Attempt to list from tenant B
- Verify HTTPException raised with status 404 (tender not found)

#### Test Get Design Tenant Isolation
- Create design for tenant A
- Attempt to get from tenant B
- Verify returns None or raises 404

#### Test Update Design Tenant Isolation
- Create design for tenant A
- Attempt to update from tenant B
- Verify HTTPException raised

### 7. Service Layer Tests - Audit Logging

#### Test Audit Log on Create
- Create design
- Query `AuditLog` table
- Verify entry exists with:
  - `action="create"`
  - `entity_type="SiteDesign"`
  - `entity_id=design.id`
  - `new_value` contains name, site_type, equipment IDs

#### Test Audit Log on Update Geometry
- Update site boundary
- Verify audit entry with old/new boundary values

#### Test Audit Log on Update Settings
- Update multiple settings
- Verify audit entry with old/new values for changed fields

#### Test Audit Log on Delete
- Delete design
- Verify audit entry with `action="delete"` and old values

### 8. API Tests - CRUD Endpoints

#### Test POST /tenders/{tender_id}/site-designs
- Valid payload with all required fields
- Verify response status 201
- Verify response contains design ID and all fields
- Test with ADMIN role succeeds
- Test with PM role succeeds
- Test with VIEWER role fails (403 Forbidden)

#### Test GET /tenders/{tender_id}/site-designs
- Create multiple designs
- Verify response status 200
- Verify returns list of designs
- Test empty list for tender with no designs

#### Test GET /site-designs/{design_id}
- Create design, then retrieve
- Verify response status 200
- Verify all fields present in response

#### Test GET /site-designs/{design_id} Not Found
- Use non-existent UUID
- Verify response status 404

#### Test PUT /site-designs/{design_id}
- Update name, geometry, settings, equipment
- Verify response status 200
- Verify updated fields in response
- Test with ADMIN role succeeds
- Test with PM role succeeds
- Test with VIEWER role fails (403)

#### Test DELETE /site-designs/{design_id}
- Create design, then delete
- Verify response status 204
- Verify subsequent GET returns 404
- Test with ADMIN role succeeds
- Test with PM role succeeds
- Test with VIEWER role fails (403)

### 9. API Tests - Validation and Error Handling

#### Test Create with Invalid GeoJSON
- Send polygon not closed
- Verify response status 400
- Verify error message in response

#### Test Create with Invalid Equipment ID
- Send non-existent equipment UUID
- Verify response status 400
- Verify error message contains "Equipment"

#### Test Create with Missing Required Fields
- Omit `name` or `site_type`
- Verify response status 422 (Pydantic validation error)

#### Test Update with Invalid Exclusion Zone
- Send exclusion zone with invalid GeoJSON
- Verify response status 400

### 10. API Tests - Authentication and Authorization

#### Test Unauthenticated Request
- Mock `get_current_user` to raise 401
- Attempt any endpoint
- Verify response status 401

#### Test Role-Based Access Control
- Create designs with different user roles
- Verify ADMIN can create/update/delete
- Verify PM can create/update/delete
- Verify ENGINEER can read only
- Verify VIEWER can read only

### 11. Mock Equipment Library Service Tests

#### Test Equipment Validation with Mock
- Use `unittest.mock.patch` to mock `EquipmentLibraryService`
- Mock `_validate_equipment` method
- Test create design with mocked validation
- Verify mock called with correct parameters

### 12. Integration Tests

#### Test Complete Workflow
- Create tender
- Create design with valid data
- Update geometry
- Update settings
- Create version snapshot
- Delete design
- Verify all audit logs created

#### Test Recalculate Design (if applicable)
- Create design with small boundary (sync mode)
- Call recalculate endpoint
- Verify response contains mode="sync" and results

## Test Organization

```
test_site_design.py
├── Fixtures (db, test_data, test_users)
├── Service Tests
│   ├── CRUD Operations (8 tests)
│   ├── GeoJSON Validation (8 tests)
│   ├── Area Calculation (2 tests)
│   ├── Equipment Validation (6 tests)
│   ├── Tenant Isolation (3 tests)
│   └── Audit Logging (4 tests)
└── API Tests
    ├── CRUD Endpoints (6 tests)
    ├── Validation & Errors (4 tests)
    ├── Authentication & Authorization (5 tests)
    └── Integration (2 tests)
```

**Total: ~48 comprehensive tests**

## Key Testing Patterns

- Use in-memory SQLite with `StaticPool` for fast, isolated tests
- Create fresh database for each test via fixtures
- Use `pytest.raises(HTTPException)` for exception testing
- Verify audit logs by querying `AuditLog` table after mutations
- Mock external dependencies where appropriate
- Test both success and failure paths
- Verify HTTP status codes match REST conventions (201, 200, 204, 400, 404, 403)
- Use `TestClient` from FastAPI for API endpoint testing
- Override dependencies for authentication/database in API tests