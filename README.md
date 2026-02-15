# SolarEPC Pro

[![Backend CI](https://github.com/eybersjp/SolarEPC-Pro-Full/actions/workflows/backend-ci.yml/badge.svg)](https://github.com/eybersjp/SolarEPC-Pro-Full/actions/workflows/backend-ci.yml)
[![Frontend Tests](https://github.com/eybersjp/SolarEPC-Pro-Full/actions/workflows/test.yml/badge.svg)](https://github.com/eybersjp/SolarEPC-Pro-Full/actions/workflows/test.yml)
[![Full Stack Integration](https://github.com/eybersjp/SolarEPC-Pro-Full/actions/workflows/integration.yml/badge.svg)](https://github.com/eybersjp/SolarEPC-Pro-Full/actions/workflows/integration.yml)
[![Deploy](https://github.com/eybersjp/SolarEPC-Pro-Full/actions/workflows/deploy.yml/badge.svg)](https://github.com/eybersjp/SolarEPC-Pro-Full/actions/workflows/deploy.yml)

Commercial & utility-scale solar EPC operating system.

## Project Structure

```
solarepc-pro/
├── backend/          # FastAPI backend
│   ├── app/
│   │   ├── api/      # Route handlers
│   │   ├── core/     # Config, security, deps
│   │   ├── models/   # SQLAlchemy models
│   │   ├── schemas/  # Pydantic schemas
│   │   ├── services/ # Business logic
│   │   └── main.py
│   ├── tests/
│   ├── alembic/      # DB migrations
│   └── requirements.txt
├── frontend/         # Next.js frontend
│   ├── src/
│   │   ├── app/      # App router pages
│   │   ├── components/
│   │   ├── lib/      # API client, utils
│   │   └── types/
│   └── package.json
└── docker-compose.yml
```

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- NREL PVWatts API Key (get free key at <https://developer.nrel.gov/signup/>)

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

- Frontend: <http://localhost:3000>
- Backend API: <http://localhost:8000>
- API Documentation: <http://localhost:8000/docs>
- Celery Flower (optional): <http://localhost:5555>

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

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Backend**: FastAPI, SQLAlchemy, Pydantic
- **Database**: PostgreSQL
- **Auth**: Firebase Authentication
- **Workers**: Celery + Redis

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

## Performance

SolarEPC-Pro meets strict performance requirements:

- ✓ Small sites (<1,000 modules): <2 seconds
- ✓ Large sites: Async task handling
- ✓ Frontend rendering: <500ms for 2,000 modules
- ✓ 30-second debounce reduces API calls by 90%

### Running Performance Tests

```bash
# Backend
cd backend && ./scripts/run_performance_tests.sh

# Frontend
cd frontend && npm run test:performance
```

See [PERFORMANCE_BENCHMARKS.md](./PERFORMANCE_BENCHMARKS.md) for details.

## Documentation

- [API Documentation](http://localhost:8000/docs) - Interactive OpenAPI/Swagger docs
- [Performance Benchmarks](./PERFORMANCE_BENCHMARKS.md) - Performance metrics and optimization
- [Deployment Guide](./DEPLOYMENT.md) - Production deployment instructions
- [Troubleshooting Guide](./TROUBLESHOOTING.md) - Common issues and solutions
- [API Examples](./backend/docs/API_EXAMPLES.md) - Complete workflow examples
