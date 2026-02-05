I have created the following plan after thorough exploration and analysis of the codebase. Follow the below plan verbatim. Trust the files and references. Do not re-verify what's written in the plan. Explore only when absolutely necessary. First implement all the proposed file changes and then I'll review all the changes together at the end.

## Observations

The SiteDesign API endpoints have already been fully implemented in `file:backend/app/api/site_designs.py`. The implementation includes all required CRUD operations, proper dependency injection, role-based access control, and follows the established patterns from `file:backend/app/api/tenders.py` and `file:backend/app/api/equipment.py`. The router is registered in `file:backend/app/main.py` with the tag `["Site Designs"]`. Additional endpoints for versioning and energy estimation have also been included.

## Approach

Since the implementation is already complete, this plan focuses on verification and potential refinements. The existing code follows best practices with proper separation of concerns, tenant isolation through the service layer, comprehensive validation, and audit logging. The API endpoints correctly use the schemas from `file:backend/app/schemas/site_design.py` and integrate seamlessly with the `SiteDesignService` from `file:backend/app/services/site_design.py`.

## Implementation Status

### ✅ Already Implemented

All required functionality has been implemented:

**1. Router Setup (`file:backend/app/api/site_designs.py`)**
- APIRouter initialized on line 24
- Dependency injection function `get_site_design_service()` on lines 27-36
- All required endpoints are present and functional

**2. CRUD Endpoints**
- **GET** `/tenders/{tender_id}/site-designs` (lines 39-48) - Lists all site designs for a tender
- **POST** `/tenders/{tender_id}/site-designs` (lines 51-75) - Creates new site design with 201 status code
- **GET** `/site-designs/{design_id}` (lines 78-85) - Retrieves single site design
- **PUT** `/site-designs/{design_id}` (lines 88-142) - Updates site design with granular control
- **DELETE** `/site-designs/{design_id}` (lines 145-160) - Deletes site design with 204 status code

**3. Schema Integration**
- Imports `SiteDesignCreate`, `SiteDesignUpdate`, `SiteDesignResponse` from schemas (lines 15-18)
- Properly validates requests using Pydantic schemas
- Converts responses using `model_validate()` pattern

**4. Security & Authorization**
- Uses `get_current_user` dependency for authentication
- Applies `require_role(UserRole.ADMIN, UserRole.PM)` for create/update operations (lines 56, 93)
- Restricts delete to `UserRole.ADMIN` only (line 149)
- Tenant isolation enforced through service layer

**5. Service Integration**
- Calls `create_design()` with all required parameters including placement settings (lines 64-72)
- Validates tender ownership implicitly through service
- Handles geometry updates via `update_geometry()` (lines 104-109)
- Handles settings updates via `update_settings()` (lines 112-116)
- Handles equipment updates via `update_equipment()` (lines 119-124)
- Properly commits and refreshes database objects

**6. Router Registration**
- Registered in `file:backend/app/main.py` on line 44
- Uses prefix `""` (empty) since endpoints define full paths
- Tagged as `["Site Designs"]`

**7. Bonus Features**
- Design versioning endpoints (lines 164-221)
- Energy estimation endpoints (lines 223-256)
- Proper error handling with 404 responses
- Name update handling in PUT endpoint (lines 135-138)

### Verification Checklist

To ensure the implementation meets all requirements:

| Requirement | Status | Location |
|------------|--------|----------|
| Router with APIRouter() | ✅ | Line 24 |
| GET /tenders/{tender_id}/site-designs | ✅ | Lines 39-48 |
| POST /tenders/{tender_id}/site-designs | ✅ | Lines 51-75 |
| GET /site-designs/{design_id} | ✅ | Lines 78-85 |
| PUT /site-designs/{design_id} | ✅ | Lines 88-142 |
| DELETE /site-designs/{design_id} | ✅ | Lines 145-160 |
| SiteDesignCreate schema usage | ✅ | Line 54 |
| SiteDesignUpdate schema usage | ✅ | Line 91 |
| SiteDesignResponse schema usage | ✅ | Lines 39, 51, 78, 88 |
| Dependency injection pattern | ✅ | Lines 27-36 |
| get_current_user integration | ✅ | Line 29 |
| Role-based access control | ✅ | Lines 56, 93, 149 |
| Tender ownership validation | ✅ | Via service layer |
| HTTP 201 for create | ✅ | Line 51 |
| HTTP 204 for delete | ✅ | Line 145 |
| HTTP 404 handling | ✅ | Via service `get_design_or_404()` |
| Router registration in main.py | ✅ | Line 44 |
| Tag ["Site Designs"] | ✅ | Line 44 |

### Potential Refinements (Optional)

While the implementation is complete and functional, consider these minor enhancements:

**1. Consolidate Update Logic**
The update endpoint (lines 88-142) handles updates through multiple service methods. Consider adding a unified `update_design()` method in the service that handles all updates atomically, including name changes with proper audit logging.

**2. Router Prefix Consistency**
The router is registered with `prefix=""` in `file:backend/app/main.py` line 44. While this works correctly, consider whether to align with other routers that use `/api` prefix for consistency. Current paths are:
- `/tenders/{tender_id}/site-designs`
- `/site-designs/{design_id}`

If using `/api` prefix, paths would become:
- `/api/tenders/{tender_id}/site-designs`
- `/api/site-designs/{design_id}`

**3. Response Model Validation**
Ensure all response models properly serialize nested `PlacementSettings`. The current implementation uses `model_validate()` which should handle this correctly through the `placement_settings` property in the `SiteDesign` model (lines 288-295 in models.py).

**4. Error Message Consistency**
Verify error messages from the service layer provide sufficient context for API consumers. The service already raises appropriate HTTPExceptions with descriptive messages.

### Testing Recommendations

The implementation should be tested with:

1. **Authentication Tests** - Verify unauthenticated requests are rejected
2. **Authorization Tests** - Verify role restrictions (ADMIN/PM for mutations)
3. **CRUD Operations** - Test all endpoints with valid/invalid data
4. **Tenant Isolation** - Verify users cannot access other tenants' designs
5. **GeoJSON Validation** - Test with valid/invalid polygons
6. **Equipment Validation** - Test with valid/invalid equipment IDs
7. **Placement Settings** - Test default tilt values for different site types
8. **Concurrent Updates** - Test update endpoint with partial data
9. **Cascade Deletes** - Verify related data handling on delete
10. **Audit Logging** - Verify all mutations are logged