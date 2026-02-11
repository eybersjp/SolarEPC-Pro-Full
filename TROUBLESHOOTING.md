# Troubleshooting Guide

Common issues and solutions for the SolarEPC Pro map-based design canvas.

## 1. PVWatts API Issues

### Error: "API key invalid"

**Symptoms**: Energy estimation fails immediately.
**Solution**:

- Verify `PVWATTS_API_KEY` in `backend/.env`.
- Check if key is expired or rate-limited (1,000 req/hr free tier).
- Test manually:

  ```bash
  curl "https://developer.nrel.gov/api/pvwatts/v8.json?api_key=YOUR_KEY&system_capacity=4&module_type=0&losses=14&array_type=1&tilt=20&azimuth=180&lat=40&lon=-105"
  ```

### Error: Stuck in "calculating"

**Symptoms**: Status never changes to completed/failed.
**Solution**:

- Check Celery worker: `celery -A app.worker.celery_app inspect active`
- Check Redis: `redis-cli ping` -> "PONG"
- Check `energy_estimates` table for `error_message`.

## 2. PDF Generation Issues

### Error: "Cairo library not found"

**Symptoms**: `WeasyPrint` fails during import or generation.
**Solution**:

- Install system dependencies (see `DEPLOYMENT.md`).
- Windows: Ensure GTK3 runtime is in PATH.

### Error: Corrupted PDF

**Symptoms**: File downloads but cannot be opened.
**Solution**:

- Check `PROPOSAL_STORAGE_BACKEND` and `PROPOSAL_LOCAL_DIR` permissions.
- If S3, check bucket permissions.
- Verify file size > 0 bytes.

## 3. Map Rendering Issues

### Blank Map

**Symptoms**: Tiles do not load.
**Solution**:

- Check internet connection (OpenStreetMap tiles require public access).
- Check browser console for CSP or CORS errors.
- Verify `frontend/src/lib/mapConfig.ts` tile URL.

### Polygons Not Rendering

**Symptoms**: Drawn shapes disappear.
**Solution**:

- Verify GeoJSON validity (closed loops, counter-clockwise winding).
- Check browser console for validation errors.

## 4. Placement Algorithm

### Zero Modules Placed

**Symptoms**: `total_modules: 0` returned with no error.
**Solution**:

- **Setbacks**: Ensure `edge_setback_m` < site width/2.
- **Exclusions**: Check if exclusion zones cover the entire available area.
- **Geometry**: Simple convex polygons work best. deeply concave polygons might cause issues if row spacing is large.

### Slow Placement (>10s)

**Symptoms**: API request times out.
**Solution**:

- Large sites (>1,000 modules) should trigger async tasks.
- If synchronous, check module spacing and complexity.

## 5. Database Migrations

### "Relation already exists"

**Solution**:

- `alembic stamp head` (if DB is ahead of migration history).
- `alembic downgrade -1` (if partial failure).

## 6. Authentication

### "Unauthorized" / Firebase Errors

**Solution**:

- Check token expiration (Firebase ID tokens last 1h).
- Verify `FIREBASE_PROJECT_ID` matches frontend and backend.
- Check server time synchronization.

## 7. Performance

### Frontend Lag

**Solution**:

- Reduce module count visible (zoom level).
- Check React DevTools for excessive re-renders.

### Backend Slowness

**Solution**:

- Check DB connection pool (`app.core.database`).
- Enable slow query logging in PostgreSQL.

## 8. Celery Worker

### Tasks Not processing

**Solution**:

- Restart worker: `celery -A app.worker.celery_app control shutdown`
- Check logs: `celery ... --loglevel=debug`
- Purge queue if clogged with stale tasks: `celery -A app.worker.celery_app purge`
