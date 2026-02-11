# Deployment Guide

This guide covers deployment instructions for the SolarEPC Pro map-based design canvas feature.

## 1. Prerequisites

- **Python**: 3.11+
- **Node.js**: 18+
- **PostgreSQL**: 15+
- **Redis**: 7+ (Task Queue)
- **System Dependencies** (for PDF generation):
  - Ubuntu/Debian: `libcairo2 libpango-1.0-0 libgdk-pixbuf2.0-0`
  - macOS: `cairo pango gdk-pixbuf`
  - Windows: GTK+ Runtime

## 2. New Dependencies

### Backend

| Dependency | Version | Purpose |
|------------|---------|---------|
| WeasyPrint | v61.0+ | PDF generation for proposals |
| Shapely | v2.0+ | Geometric operations for placement algorithm |
| Matplotlib | v3.8+ | Chart generation for proposals |
| Celery | v5.3+ | Async task processing |
| Redis | v5.0+ | Celery broker and result backend |

### Frontend

| Dependency | Version | Purpose |
|------------|---------|---------|
| Leaflet | v1.9.4 | Interactive map rendering |
| React-Leaflet | v4.2.1 | React bindings for Leaflet |
| Zustand | v5.0.11 | State management for design canvas |
| Recharts | v3.7.0 | Energy and financial charts |
| @turf/turf | v6.5.0 | Geospatial calculations |

## 3. Environment Variables

### Backend (.env)

Adjust `backend/.env` with the following:

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

### Frontend (.env.local)

Adjust `frontend/.env.local`:

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

## 4. Database Migrations

Run migrations to create new tables (`site_designs`, `equipment_modules`, etc.):

```bash
cd backend

# Upgrade to latest version
alembic upgrade head

# Rollback one version (if needed)
alembic downgrade -1
```

**Seed Equipment Library**:

```bash
python scripts/seed_equipment.py
```

## 5. Celery Worker Setup

The map-based design canvas uses Celery for heavy tasks (placement, PDF generation, energy estimation).

**Start Worker**:

```bash
cd backend

# Development
celery -A app.worker.celery_app worker --loglevel=info

# Production (with concurrency)
celery -A app.worker.celery_app worker \
  --loglevel=info \
  --concurrency=4 \
  --max-tasks-per-child=1000
```

**Monitoring**:
Install and run Flower:

```bash
pip install flower
celery -A app.worker.celery_app flower --port=5555
```

## 6. Docker Deployment

**Using Docker Compose**:

```bash
# Start all services
docker-compose up -d

# Check logs
docker-compose logs -f backend

# Run migrations inside container
docker-compose exec backend alembic upgrade head
```

**Production Docker Compose (`docker-compose.prod.yml`) considerations**:

- Use production-ready images.
- Add dedicated `worker` service for Celery.
- Add `nginx` reverse proxy.
- Use Docker secrets for sensitive env vars.

## 7. Production Checklist

- [ ] Set `DEBUG=false` in backend.
- [ ] Generate strong `SECRET_KEY`.
- [ ] Configure `CORS_ORIGINS` strictly.
- [ ] Obtain and test NREL PVWatts API key.
- [ ] Set up S3 bucket for proposal storage.
- [ ] Run `alembic upgrade head`.
- [ ] Seed equipment library.
- [ ] Start Celery worker(s).
- [ ] Configure SSL/TLS.
- [ ] Set up monitoring (Sentry, etc.).
