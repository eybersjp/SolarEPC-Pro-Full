I have created the following plan after thorough exploration and analysis of the codebase. Follow the below plan verbatim. Trust the files and references. Do not re-verify what's written in the plan. Explore only when absolutely necessary. First implement all the proposed file changes and then I'll review all the changes together at the end.

## Observations

The codebase has a well-structured FastAPI backend with automatic OpenAPI/Swagger documentation at `/docs` and `/redoc`. The map-based design canvas feature introduces new database tables (SiteDesign, DesignVersion, EnergyEstimate, FinancialAnalysis) via Alembic migrations, new dependencies (WeasyPrint for PDF generation, Leaflet for maps, Zustand for state management), and async task handling via Celery. The existing documentation follows a clear pattern with markdown files at the root level and detailed performance benchmarks.

## Approach

The documentation will be structured in four parts: (1) Enhance existing OpenAPI/Swagger documentation with detailed descriptions and examples for new endpoints, (2) Create a comprehensive DEPLOYMENT.md covering dependencies, environment variables, database migrations, and Celery worker setup, (3) Update README.md with feature overview and quick start guide, and (4) Create a TROUBLESHOOTING.md guide for common issues. This approach leverages FastAPI's automatic documentation generation while providing deployment-specific guidance that operators need.

## Implementation Steps

### 1. Enhance API Documentation (OpenAPI/Swagger)

**Objective**: Improve the automatically generated API documentation at `/docs` and `/redoc` with detailed descriptions and examples.

#### 1.1 Add Comprehensive Endpoint Descriptions

Update `file:backend/app/api/site_designs.py`:
- Add detailed docstrings to all endpoints with request/response examples
- For `POST /tenders/{tender_id}/site-designs`: Include example GeoJSON polygon in docstring
- For `PUT /site-designs/{design_id}`: Document partial update behavior and which fields trigger recalculation
- For `POST /site-designs/{design_id}/energy-estimate`: Explain async task flow and polling mechanism
- For `GET /site-designs/{design_id}/energy-estimate`: Document all possible status values (calculating, completed, failed, not_calculated)
- For version endpoints: Explain immutability and snapshot behavior

Update `file:backend/app/api/proposals.py`:
- For `POST /site-designs/{design_id}/proposal`: Document optional sections and graceful degradation when energy data is missing
- For `GET /tasks/{task_id}`: Document Celery task status lifecycle (PENDING → SUCCESS/FAILURE)
- For `GET /site-designs/{design_id}/export-csv`: Document CSV format and column headers

#### 1.2 Enhance Schema Documentation

Update `file:backend/app/schemas/site_design.py`:
- Add `Field(..., description="...")` to all schema fields with detailed explanations
- For `GeoJSONPolygon`: Add example valid polygon in schema description
- For `PlacementSettings`: Document default values and valid ranges with engineering context
- For `SiteDesignResponse`: Document calculated fields and when they're populated

Update `file:backend/app/schemas/design_version.py`:
- Add examples showing snapshot_data structure
- Document the relationship between version snapshots and current design state
- Explain when `total_modules` and `system_size_kwp` are extracted from snapshot_data

#### 1.3 Add API Usage Examples

Create `file:backend/docs/API_EXAMPLES.md`:
- **Complete Design Workflow Example**: Step-by-step curl/httpx examples showing:
  - Create tender → Create site design → Update equipment → Draw boundary → Trigger placement → Poll placement status → Calculate energy → Generate proposal
- **Version Management Example**: Save version → List versions → Restore version → Verify recalculation
- **Error Handling Examples**: Show retry logic for PVWatts failures, handling invalid GeoJSON, placement algorithm edge cases
- **Authentication Examples**: Include Firebase token in Authorization header for all requests

#### 1.4 Update FastAPI App Metadata

Update `file:backend/app/main.py`:
- Enhance `FastAPI()` initialization with:
  - `description`: Add detailed multi-paragraph description of the map-based design canvas feature
  - `version`: Update to reflect new feature version
  - `contact`: Add support contact information
  - `license_info`: Add license details if applicable
- Add tags metadata with descriptions for each router group

### 2. Create Deployment Guide (DEPLOYMENT.md)

**Objective**: Provide comprehensive deployment instructions for production and development environments.

Create `file:DEPLOYMENT.md` with the following sections:

#### 2.1 Prerequisites Section
- Python 3.11+ (for backend)
- Node.js 18+ (for frontend)
- PostgreSQL 15+ (database)
- Redis 7+ (task queue)
- System dependencies for WeasyPrint (Cairo, Pango, GDK-PixBuf)

#### 2.2 New Dependencies Section

**Backend Dependencies** (from `file:backend/requirements.txt`):
- **WeasyPrint (v61.0+)**: PDF generation for proposals
  - System requirements: `apt-get install libcairo2 libpango-1.0-0 libgdk-pixbuf2.0-0` (Ubuntu/Debian)
  - macOS: `brew install cairo pango gdk-pixbuf`
  - Windows: Download GTK+ runtime from https://github.com/tschoonj/GTK-for-Windows-Runtime-Environment-Installer
- **Shapely (v2.0+)**: Geometric operations for placement algorithm
- **Matplotlib (v3.8+)**: Chart generation for proposals
- **Celery (v5.3+)**: Async task processing
- **Redis (v5.0+)**: Celery broker and result backend

**Frontend Dependencies** (from `file:frontend/package.json`):
- **Leaflet (v1.9.4)**: Interactive map rendering
- **React-Leaflet (v4.2.1)**: React bindings for Leaflet
- **Zustand (v5.0.11)**: State management for design canvas
- **Recharts (v3.7.0)**: Energy and financial charts
- **@turf/turf (v6.5.0)**: Geospatial calculations

#### 2.3 Environment Variables Section

**Backend Environment Variables** (extend `file:backend/.env.example`):

```bash
# Core Configuration
DATABASE_URL=postgresql://user:pass@host:5432/solarepc
REDIS_URL=redis://localhost:6379/0
DEBUG=false

# PVWatts API (REQUIRED for energy estimation)
PVWATTS_API_KEY=your_nrel_api_key_here
# Get free API key from: https://developer.nrel.gov/signup/

# Storage Backend (for proposal PDFs)
PROPOSAL_STORAGE_BACKEND=local  # Options: "local" or "s3"
PROPOSAL_LOCAL_DIR=generated_proposals

# S3 Configuration (if PROPOSAL_STORAGE_BACKEND=s3)
S3_BUCKET_NAME=your-bucket-name
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
S3_PRESIGNED_URL_EXPIRATION=3600

# Firebase Authentication
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CREDENTIALS_PATH=/path/to/service-account.json

# Security
SECRET_KEY=generate-random-secret-key-here
CORS_ORIGINS=["https://yourdomain.com"]
```

**Frontend Environment Variables** (extend `file:frontend/.env.local.example`):

```bash
# API Configuration
NEXT_PUBLIC_API_URL=https://api.yourdomain.com

# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef
```

#### 2.4 Database Migration Instructions

**Running Migrations**:

```bash
cd backend

# Check current migration status
alembic current

# View migration history
alembic history

# Upgrade to latest version
alembic upgrade head

# Rollback one version
alembic downgrade -1
```

**New Tables Created** (from `file:backend/alembic/versions/01b88ee7b6fa_add_equipment_library_and_site_designs.py`):
- `equipment_modules`: PV module library (global + tenant-specific)
- `equipment_inverters`: Inverter library (global + tenant-specific)
- `site_designs`: Primary entity for map-based designs
- `design_versions`: Immutable version snapshots
- `energy_estimates`: Cached PVWatts API results
- `financial_analyses`: Financial metrics and ROI calculations

**Seeding Equipment Library**:

```bash
# Seed global equipment library with common modules/inverters
python scripts/seed_equipment.py
```

#### 2.5 Celery Worker Setup

**Starting Celery Worker** (from `file:backend/app/worker.py`):

```bash
cd backend

# Development (single worker)
celery -A app.worker.celery_app worker --loglevel=info

# Production (multiple workers with concurrency)
celery -A app.worker.celery_app worker \
  --loglevel=info \
  --concurrency=4 \
  --max-tasks-per-child=1000

# With autoscaling
celery -A app.worker.celery_app worker \
  --autoscale=10,3 \
  --loglevel=info
```

**Monitoring Celery Tasks**:

```bash
# Flower (web-based monitoring)
pip install flower
celery -A app.worker.celery_app flower --port=5555
# Access at http://localhost:5555
```

**Celery Tasks Registered**:
- `generate_proposal_task`: Async PDF generation for large proposals
- `calculate_placement_task`: Async module placement for sites >1,000 modules

#### 2.6 Docker Deployment

**Using Docker Compose** (from `file:docker-compose.yml`):

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Run migrations
docker-compose exec backend alembic upgrade head

# Seed equipment library
docker-compose exec backend python scripts/seed_equipment.py

# Stop all services
docker-compose down
```

**Production Docker Compose** (create `docker-compose.prod.yml`):
- Use production-ready images (not --reload)
- Add Celery worker service
- Add Nginx reverse proxy
- Configure health checks
- Use secrets for sensitive environment variables

#### 2.7 Production Checklist

- [ ] Set `DEBUG=false` in backend environment
- [ ] Generate strong `SECRET_KEY` (use `openssl rand -hex 32`)
- [ ] Configure CORS_ORIGINS to production domain only
- [ ] Obtain NREL PVWatts API key (free tier: 1,000 requests/hour)
- [ ] Set up S3 bucket for proposal storage (recommended for production)
- [ ] Configure Firebase project for production
- [ ] Run database migrations: `alembic upgrade head`
- [ ] Seed equipment library: `python scripts/seed_equipment.py`
- [ ] Start Celery worker with supervisor/systemd
- [ ] Configure Nginx/Apache reverse proxy with SSL
- [ ] Set up monitoring (Sentry, Datadog, etc.)
- [ ] Configure database backups
- [ ] Test proposal PDF generation with WeasyPrint
- [ ] Verify PVWatts API connectivity

### 3. Update README.md

**Objective**: Add feature overview and getting started guide for the map-based design canvas.

Update `file:README.md`:

#### 3.1 Add Feature Overview Section

Insert after "Tech Stack" section:

```markdown
## Features

### Map-Based Design Canvas

The map-based design canvas enables solar engineers to:

- **Interactive Site Design**: Draw site boundaries and exclusion zones on Leaflet maps
- **Equipment Selection**: Choose from global or tenant-specific PV modules and inverters
- **Auto-Placement Algorithm**: Automatically place modules with configurable settings:
  - Edge setbacks, row spacing, module orientation
  - Azimuth and tilt angles
  - Handles complex geometries and exclusion zones
- **Energy Estimation**: Integration with NREL PVWatts API for accurate energy predictions
- **Financial Analysis**: Calculate ROI, payback period, and annual savings
- **Proposal Generation**: Export professional PDF proposals and BOM CSV files
- **Version Management**: Save and restore design snapshots with automatic recalculation
- **Real-time Sync**: Auto-save with exponential backoff retry and sync state tracking

**Performance**:
- Small sites (<1,000 modules): <2 seconds
- Large sites: Async task handling via Celery
- Frontend rendering: <500ms for 2,000 modules
- 30-second debounce reduces API calls by 90%

See [PERFORMANCE_BENCHMARKS.md](./PERFORMANCE_BENCHMARKS.md) for detailed metrics.
```

#### 3.2 Update Quick Start Section

Replace existing Quick Start with:

```markdown
## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- NREL PVWatts API Key (get free key at https://developer.nrel.gov/signup/)

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Install WeasyPrint system dependencies
# Ubuntu/Debian:
sudo apt-get install libcairo2 libpango-1.0-0 libgdk-pixbuf2.0-0
# macOS:
brew install cairo pango gdk-pixbuf

# Configure environment
cp .env.example .env
# Edit .env and add your PVWATTS_API_KEY

# Run migrations
alembic upgrade head

# Seed equipment library
python scripts/seed_equipment.py

# Start backend
uvicorn app.main:app --reload

# In separate terminal, start Celery worker
celery -A app.worker.celery_app worker --loglevel=info
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.local.example .env.local
# Edit .env.local and add Firebase configuration

# Start frontend
npm run dev
```

### Access the Application

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs
- Celery Flower (optional): http://localhost:5555

### Docker Setup (Alternative)

```bash
# Start all services
docker-compose up -d

# Run migrations
docker-compose exec backend alembic upgrade head

# Seed equipment library
docker-compose exec backend python scripts/seed_equipment.py
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for production deployment instructions.
```

#### 3.3 Add Documentation Links Section

Add before the closing:

```markdown
## Documentation

- [API Documentation](http://localhost:8000/docs) - Interactive OpenAPI/Swagger docs
- [Performance Benchmarks](./PERFORMANCE_BENCHMARKS.md) - Performance metrics and optimization
- [Deployment Guide](./DEPLOYMENT.md) - Production deployment instructions
- [Troubleshooting Guide](./TROUBLESHOOTING.md) - Common issues and solutions
- [API Examples](./backend/docs/API_EXAMPLES.md) - Complete workflow examples
```

### 4. Create Troubleshooting Guide

**Objective**: Document common issues and their solutions.

Create `file:TROUBLESHOOTING.md`:

#### 4.1 PVWatts API Issues

**Issue**: Energy estimation fails with "API key invalid" error

**Solution**:
- Verify `PVWATTS_API_KEY` is set in `backend/.env`
- Get free API key from https://developer.nrel.gov/signup/
- Check API key hasn't exceeded rate limit (1,000 requests/hour for free tier)
- Test API key manually: `curl "https://developer.nrel.gov/api/pvwatts/v8.json?api_key=YOUR_KEY&system_capacity=4&module_type=0&losses=14&array_type=1&tilt=20&azimuth=180&lat=40&lon=-105"`

**Issue**: Energy estimation stuck in "calculating" status

**Solution**:
- Check Celery worker is running: `celery -A app.worker.celery_app inspect active`
- Check Redis connection: `redis-cli ping` should return "PONG"
- View Celery logs for errors: `celery -A app.worker.celery_app worker --loglevel=debug`
- Check `energy_estimates` table for error_message: `SELECT error_message FROM energy_estimates WHERE status='failed';`
- Retry failed estimate: Delete record and trigger new calculation

**Issue**: PVWatts API timeout errors

**Solution**:
- Increase timeout in `file:backend/app/services/energy_estimation.py` (default: 30 seconds)
- Check network connectivity to NREL servers
- Verify no firewall blocking outbound HTTPS to api.nrel.gov
- Consider implementing exponential backoff (already implemented with `retry_count` field)

#### 4.2 PDF Generation Issues

**Issue**: WeasyPrint fails with "Cairo library not found"

**Solution**:
- **Ubuntu/Debian**: `sudo apt-get install libcairo2 libpango-1.0-0 libgdk-pixbuf2.0-0 libffi-dev shared-mime-info`
- **macOS**: `brew install cairo pango gdk-pixbuf libffi`
- **Windows**: Download GTK+ runtime from https://github.com/tschoonj/GTK-for-Windows-Runtime-Environment-Installer
- Verify installation: `python -c "import weasyprint; print(weasyprint.__version__)"`

**Issue**: PDF generation fails with template errors

**Solution**:
- Check `file:backend/templates/proposal.html` exists and is valid HTML
- Verify Jinja2 template syntax is correct
- Check `file:backend/templates/styles.css` exists
- Test template rendering manually in Python shell:
  ```python
  from jinja2 import Environment, FileSystemLoader
  env = Environment(loader=FileSystemLoader('templates'))
  template = env.get_template('proposal.html')
  html = template.render(design={...})
  ```
- Check Celery worker logs for detailed error messages

**Issue**: PDF generation succeeds but file is corrupted

**Solution**:
- Verify storage backend configuration in `file:backend/app/core/config.py`
- For local storage: Check `PROPOSAL_LOCAL_DIR` exists and is writable
- For S3 storage: Verify S3 credentials and bucket permissions
- Test file download manually: `curl http://localhost:8000/api/tasks/{task_id}`
- Check file size is non-zero: `ls -lh generated_proposals/`

#### 4.3 Map Rendering Issues

**Issue**: Map tiles not loading (blank map)

**Solution**:
- Check browser console for CORS errors
- Verify Leaflet tile server is accessible: https://tile.openstreetmap.org/
- Check `file:frontend/src/lib/mapConfig.ts` for correct tile URL
- Try alternative tile provider (Mapbox, CartoDB, etc.)
- Verify no ad-blocker blocking tile requests
- Check network tab for 403/404 errors on tile requests

**Issue**: Polygons not rendering on map

**Solution**:
- Verify GeoJSON format is valid: Use https://geojson.io/ to validate
- Check polygon coordinates are in [longitude, latitude] order (not lat/lon)
- Verify polygon is closed (first and last coordinates are identical)
- Check browser console for validation errors from `file:frontend/src/lib/geojsonValidation.ts`
- Inspect React DevTools for `GeometryLayer` component props

**Issue**: Drawing tools not working

**Solution**:
- Verify equipment is selected (drawing is disabled until equipment is chosen)
- Check `useDesignCanvasStore` state in React DevTools
- Verify Leaflet.draw is loaded: Check browser console for errors
- Clear browser cache and reload
- Check `file:frontend/src/components/DesignCanvas/PolygonDrawingLayer.tsx` for event handlers

#### 4.4 Placement Algorithm Issues

**Issue**: Auto-placement returns zero modules

**Solution**:
- Check site boundary is valid and not self-intersecting
- Verify edge setback isn't larger than site dimensions
- Check exclusion zones aren't covering entire site
- Reduce setback values in placement settings
- Verify module dimensions are reasonable (check equipment library)
- Check backend logs for placement algorithm errors
- Test with simpler geometry (rectangular boundary, no exclusions)

**Issue**: Placement task stuck in "pending" status

**Solution**:
- Verify Celery worker is running: `celery -A app.worker.celery_app inspect active`
- Check Redis connection: `redis-cli ping`
- View Celery task queue: `celery -A app.worker.celery_app inspect reserved`
- Check `site_designs` table for `placement_task_error`: `SELECT placement_task_error FROM site_designs WHERE placement_task_status='failed';`
- Restart Celery worker: `celery -A app.worker.celery_app control shutdown` then restart

**Issue**: Placement algorithm very slow (>10 seconds)

**Solution**:
- Check site size: Sites >1,000 modules should use async tasks
- Verify no excessive exclusion zones (>20 zones may slow algorithm)
- Simplify boundary geometry (reduce number of vertices)
- Check server CPU usage during placement
- Review `file:backend/app/services/placement_algorithm.py` for optimization opportunities
- See [PERFORMANCE_BENCHMARKS.md](./PERFORMANCE_BENCHMARKS.md) for expected performance

#### 4.5 Database Migration Issues

**Issue**: Alembic migration fails with "relation already exists"

**Solution**:
- Check current migration version: `alembic current`
- View migration history: `alembic history`
- If tables exist, stamp database to current version: `alembic stamp head`
- If migration is partially applied, manually rollback: `alembic downgrade -1`
- Check PostgreSQL logs for detailed error: `docker-compose logs db`

**Issue**: Foreign key constraint violations

**Solution**:
- Ensure migrations run in correct order (check `depends_on` in migration files)
- Verify referenced tables exist before creating foreign keys
- Check data integrity: Orphaned records may prevent migration
- Manually fix data issues before re-running migration

#### 4.6 Authentication Issues

**Issue**: Firebase authentication fails

**Solution**:
- Verify Firebase configuration in `file:frontend/.env.local`
- Check Firebase project settings match environment variables
- Verify Firebase service account JSON is valid in `file:backend/.env`
- Test Firebase token manually: Use Firebase Auth REST API
- Check browser console for Firebase SDK errors
- Verify CORS settings allow Firebase domains

**Issue**: "Unauthorized" errors on API requests

**Solution**:
- Verify Firebase token is included in Authorization header
- Check token hasn't expired (tokens expire after 1 hour)
- Verify user has correct role (Admin/PM/Engineer) for endpoint
- Check `file:backend/app/core/security.py` for role requirements
- Test with Postman/curl to isolate frontend vs backend issue

#### 4.7 Performance Issues

**Issue**: Frontend slow with large module counts

**Solution**:
- Check module count: >2,000 modules may cause slowness
- Verify React Query caching is working (check Network tab)
- Enable React DevTools Profiler to identify slow components
- Check `file:frontend/src/components/DesignCanvas/performance.test.tsx` for benchmarks
- Consider implementing virtual scrolling for module lists
- Reduce map zoom level to render fewer features

**Issue**: Backend slow for concurrent requests

**Solution**:
- Check database connection pool size in `file:backend/app/core/database.py`
- Verify PostgreSQL has sufficient resources (CPU, memory)
- Add database indexes on frequently queried fields
- Enable query logging to identify slow queries
- Consider Redis caching for frequently accessed designs
- Scale horizontally with multiple backend instances

#### 4.8 Celery Worker Issues

**Issue**: Celery worker not processing tasks

**Solution**:
- Verify worker is running: `celery -A app.worker.celery_app inspect active`
- Check Redis connection: `redis-cli ping`
- View worker logs: `celery -A app.worker.celery_app worker --loglevel=debug`
- Verify tasks are registered: `celery -A app.worker.celery_app inspect registered`
- Check task queue: `redis-cli LLEN celery`
- Restart worker: `celery -A app.worker.celery_app control shutdown` then restart

**Issue**: Tasks failing with import errors

**Solution**:
- Verify all dependencies installed: `pip install -r requirements.txt`
- Check Python path includes app directory
- Verify `file:backend/app/worker.py` imports tasks correctly
- Check Celery worker logs for detailed traceback
- Test task import manually: `python -c "from app.services import tasks"`

### 5. Create API Examples Documentation

**Objective**: Provide complete workflow examples for developers.

Create `file:backend/docs/API_EXAMPLES.md`:

#### 5.1 Complete Design Workflow Example

```markdown
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
```

#### 5.2 Version Management Example

Include examples for:
- Saving a version snapshot
- Listing all versions
- Viewing version details
- Restoring a previous version
- Verifying automatic recalculation after restore

#### 5.3 Error Handling Examples

Include examples for:
- Invalid GeoJSON (self-intersecting polygon)
- PVWatts API failure with retry
- Placement algorithm edge cases (no modules fit)
- Missing energy data when generating proposal (graceful degradation)

### 6. Update API Router Tags and Descriptions

**Objective**: Improve API documentation organization in Swagger UI.

Update `file:backend/app/main.py`:

Add tags metadata before router includes:

```python
tags_metadata = [
    {
        "name": "Site Designs",
        "description": "Map-based solar site design operations. Create, update, and manage site designs with interactive geometry, equipment selection, and auto-placement.",
    },
    {
        "name": "Proposals",
        "description": "Generate professional PDF proposals and export BOM CSV files. Supports async generation for large proposals.",
    },
    {
        "name": "Equipment Library",
        "description": "Manage PV modules and inverters. Supports global library and tenant-specific equipment.",
    },
    {
        "name": "Financial Analysis",
        "description": "Calculate ROI, payback period, and annual savings based on energy estimates and system costs.",
    },
    # ... existing tags
]

app = FastAPI(
    title="SolarEPC Pro API",
    description="...",
    version="0.2.0",  # Update version
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_tags=tags_metadata,
)
```

This project uses a task-tracking convention. After completing all changes, create the file `~/.traycer/yolo_artifacts/8b3d19bb-a66c-4777-8517-3aa3896440b6.json` with content `{}`. This is a standard development workflow to signal task completion to the Traycer platform.