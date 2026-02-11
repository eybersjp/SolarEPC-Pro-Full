# API Usage Examples

## Complete Design Workflow

This example demonstrates the full workflow from tender creation to proposal generation.

### 1. Authenticate

```bash
# Get Firebase token (use Firebase SDK in your app)
TOKEN="your-firebase-id-token"
```

### 2. Create Tender

```bash
curl -X POST http://localhost:8000/tenders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Solar Farm Project",
    "client_name": "ABC Energy",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "target_capacity_kw": 5000
  }'

# Response: {"id": "tender-uuid", ...}
TENDER_ID="tender-uuid"
```

### 3. Create Site Design

```bash
curl -X POST http://localhost:8000/api/tenders/$TENDER_ID/site-designs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Main Array",
    "site_type": "ground_mount",
    "equipment_module_id": "module-uuid",
    "equipment_inverter_id": "inverter-uuid",
    "site_boundary": {
      "type": "Polygon",
      "coordinates": [[[0,0], [100,0], [100,100], [0,100], [0,0]]]
    },
    "placement_settings": {
      "edge_setback_m": 2.0,
      "row_spacing_m": 3.0,
      "module_orientation": "portrait",
      "azimuth_deg": 180,
      "tilt_deg": 25
    }
  }'

# Response: {"id": "design-uuid", ...}
DESIGN_ID="design-uuid"
```

### 4. Update Equipment (Optional)

```bash
curl -X PUT http://localhost:8000/api/site-designs/$DESIGN_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "equipment_module_id": "new-module-uuid"
  }'
```

### 5. Draw Boundary and Exclusions

```bash
curl -X PUT http://localhost:8000/api/site-designs/$DESIGN_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "site_boundary": {
      "type": "Polygon",
      "coordinates": [[[0,0], [150,0], [150,150], [0,150], [0,0]]]
    },
    "exclusion_zones": [{
      "type": "Polygon",
      "coordinates": [[[50,50], [60,50], [60,60], [50,60], [50,50]]]
    }]
  }'
```

### 6. Auto-Place Modules

Module placement is triggered automatically when geometry or settings change. Check placement status:

```bash
curl http://localhost:8000/api/site-designs/$DESIGN_ID \
  -H "Authorization: Bearer $TOKEN"

# Response includes:
# "placement_task_status": "completed",
# "total_modules": 1234,
# "system_size_kwp": 567.8
```

For large sites (>1,000 modules), poll task status:

```bash
# Get task ID from design response
TASK_ID="celery-task-uuid"

curl http://localhost:8000/api/tasks/$TASK_ID \
  -H "Authorization: Bearer $TOKEN"

# Response: {"status": "SUCCESS", ...}
```

### 7. Calculate Energy Estimate

```bash
curl -X POST http://localhost:8000/api/site-designs/$DESIGN_ID/energy-estimate \
  -H "Authorization: Bearer $TOKEN"

# Response: {"status": "initiated", "estimate_id": "estimate-uuid"}

# Poll for results
curl http://localhost:8000/api/site-designs/$DESIGN_ID/energy-estimate \
  -H "Authorization: Bearer $TOKEN"

# Response when complete:
# {
#   "status": "completed",
#   "annual_energy_kwh": 1234567,
#   "monthly_energy_kwh": [100000, 110000, ...],
#   "capacity_factor": 0.18
# }
```

### 8. Generate Financials

```bash
curl -X POST http://localhost:8000/api/site-designs/$DESIGN_ID/financial-analysis \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "system_cost_usd": 2500000,
    "electricity_rate_usd_per_kwh": 0.12,
    "annual_rate_escalation_pct": 2.5
  }'

# Response:
# {
#   "annual_savings_usd": 148148,
#   "simple_payback_years": 16.9,
#   "roi_pct": 5.9
# }
```

### 9. Generate Proposal

```bash
curl -X POST http://localhost:8000/api/site-designs/$DESIGN_ID/proposal \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "include_energy_analysis": true,
    "include_financial_analysis": true,
    "include_bom": true
  }'

# Response: {"task_id": "proposal-task-uuid", "status": "PENDING"}

# Poll for completion
PROPOSAL_TASK_ID="proposal-task-uuid"
curl http://localhost:8000/api/tasks/$PROPOSAL_TASK_ID \
  -H "Authorization: Bearer $TOKEN"

# Response when complete:
# {
#   "status": "SUCCESS",
#   "result_url": "/api/proposals/download/proposal-uuid.pdf"
# }

# Download PDF
curl http://localhost:8000/api/proposals/download/proposal-uuid.pdf \
  -H "Authorization: Bearer $TOKEN" \
  -o proposal.pdf
```

### 10. Export BOM CSV

```bash
curl http://localhost:8000/api/site-designs/$DESIGN_ID/export-csv \
  -H "Authorization: Bearer $TOKEN" \
  -o bom.csv
```

## Version Management Example

### 1. Save Version

```bash
curl -X POST http://localhost:8000/api/site-designs/$DESIGN_ID/versions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "version_name": "v1.0 Initial Layout",
    "notes": "Before changing inverter type"
  }'

# Response: {"id": "version-uuid", ...}
VERSION_ID="version-uuid"
```

### 2. List Versions

```bash
curl http://localhost:8000/api/site-designs/$DESIGN_ID/versions \
  -H "Authorization: Bearer $TOKEN"
```

### 3. Restore Version

```bash
curl -X POST http://localhost:8000/api/site-designs/$DESIGN_ID/restore/$VERSION_ID \
  -H "Authorization: Bearer $TOKEN"
  
# Response verifies recalculation triggered
```

## Error Handling Examples

### Invalid GeoJSON

```bash
curl -X POST http://localhost:8000/api/tenders/$TENDER_ID/site-designs \
  ...
  -d '{
    ...
    "site_boundary": {
      "type": "Polygon",
      "coordinates": [[[0,0], [10,0], [0,0]]]  # Invalid: not closed, too few points
    }
  }'
  
# Response: 422 Unprocessable Entity
```

### Placement Algorithm Edge Cases

#### Scenario 1: Site too small for setbacks

If the site boundary is smaller than the combined edge setbacks, no modules can be placed.

```bash
curl http://localhost:8000/api/site-designs/$DESIGN_ID \
  -H "Authorization: Bearer $TOKEN"

# Response:
{
  "total_modules": 0,
  "system_size_kwp": 0.0,
  "placement_task_status": "completed",
  "placement_task_error": null
}
```

**Client Action**: Suggest the user reduce `edge_setback_m` or `row_spacing_m` in `placement_settings`.

#### Scenario 2: Complex Geometry / Self-Intersection

If the polygon is self-intersecting, the API may return 422 or the placement task may fail.

```bash
# Response for invalid geometry update:
{
  "detail": "Invalid GeoJSON: Polygon has self-intersection at [x, y]"
}
```

### Handling NREL PVWatts Errors

Energy estimation relies on the external NREL API. Clients should implement robust polling and error handling.

#### Scenario: NREL API Timeout or 503 Service Unavailable

1. Client triggers estimation:

   ```bash
   curl -X POST .../energy-estimate
   # Response: {"status": "initiated", ...}
   ```

2. Client polls status:

   ```bash
   curl .../energy-estimate
   ```

3. Response indicates failure:

   ```json
   {
     "status": "failed",
     "error_message": "NREL API request timed out after 30s",
     "annual_energy_kwh": 0
   }
   ```

**Client Action**:

- Implement **Exponential Backoff**: Wait 2s, then 4s, then 8s before retrying.
- Allow user to manually "Retry" via UI button (which calls `POST .../energy-estimate` again).
- Check `backend/.env` for correct `PVWATTS_API_KEY`.
