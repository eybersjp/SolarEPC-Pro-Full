# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SolarEPC Pro is a commercial & utility-scale solar EPC (Engineering, Procurement, Construction) operating system. It supports EPCs from tender → design → pricing → execution → handover. This is NOT for residential solar or DIY installers.

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, TanStack Query
- **Backend**: FastAPI, SQLAlchemy, Pydantic, Python 3.11+
- **Database**: PostgreSQL (via SQLAlchemy)
- **Auth**: Firebase Authentication
- **Workers**: Celery + Redis (async tasks)
- **Tools**: Alembic (migrations), Pytest, Docker Compose

## Development Commands

### Backend (FastAPI)

```bash
cd backend
python -m venv venv
venv\Scripts\activate           # Windows
source venv/bin/activate        # Linux/Mac
pip install -r requirements.txt
uvicorn app.main:app --reload   # Run dev server on :8000
```

**Testing:**
```bash
cd backend
pytest                          # Run all tests
pytest tests/test_file.py       # Run specific test file
pytest tests/test_file.py::test_name  # Run single test
pytest -v                       # Verbose output
pytest --cov=app                # With coverage
```

**Database migrations:**
```bash
cd backend
alembic revision --autogenerate -m "description"  # Create migration
alembic upgrade head                              # Apply migrations
alembic downgrade -1                              # Rollback one migration
```

### Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev     # Dev server on :3000
npm run build   # Production build
npm run lint    # ESLint
```

### Docker (Full Stack)

```bash
docker-compose up              # Start all services
docker-compose up -d           # Start in background
docker-compose down            # Stop all services
docker-compose logs -f backend # Follow backend logs
```

Services:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs
- PostgreSQL: localhost:5432
- Redis: localhost:6379

## Architecture

### Multi-Tenant Structure

The application is multi-tenant with strict tenant isolation enforced at the database and service layers. Each tenant represents an EPC company.

### Backend Architecture

```
backend/app/
├── api/         # FastAPI route handlers (thin layer, no business logic)
├── services/    # Business logic (testable in isolation)
├── models/      # SQLAlchemy ORM models
├── schemas/     # Pydantic request/response schemas
└── core/        # Config, security, dependencies, database
```

**Key architectural rules:**
- **No logic in routes**: API handlers only validate, call services, and return responses
- **Services are the source of truth**: All business logic lives in services
- **Explicit schemas**: All API inputs/outputs must have Pydantic schemas
- **No cross-domain access**: Services should not directly call other domain services without clear boundaries
- **Fail fast**: Raise clear exceptions immediately when validation fails

### Core Domains

1. **Auth & RBAC**: Firebase authentication, role-based access control
2. **Tenants**: EPC company management
3. **Tenders**: Project opportunities and tender management
4. **Preconditions**: Pre-construction site analysis and requirements
5. **PV Design**: Solar array engineering calculations
6. **BOQ**: Bill of Quantities generation and pricing
7. **Dashboard**: Project overview and metrics

### Router Organization

All domain routers are mounted under `/tenders/{tender_id}/...` except:
- `/auth` - Authentication endpoints
- `/tenants` - Tenant management
- `/tenders` - Tender CRUD
- `/dashboard` - Overview metrics

Example: `GET /tenders/{tender_id}/preconditions` → preconditions.py router

### Frontend Architecture

```
frontend/src/
├── app/         # Next.js App Router (pages & layouts)
├── components/  # React components
├── lib/         # API client, utilities
└── types/       # TypeScript type definitions
```

**Key rules:**
- **No business logic in UI**: Components fetch data and render, validation happens server-side
- **Loading + Error states mandatory**: Every async operation needs loading/error handling
- **Validation before submit**: Client-side validation for UX, server validates for security

## Coding Standards

### Backend (Python/FastAPI)

- **Pydantic schemas required** for all API inputs/outputs
- **Type hints mandatory** for all function signatures
- **Services must be testable in isolation** - avoid tight coupling
- **Small, readable functions** - prefer explicit over clever
- **Fail fast with clear errors** - use descriptive exception messages
- **No secrets in logs** - sanitize sensitive data

Example service pattern:
```python
# services/example.py
from sqlalchemy.orm import Session
from app.models import Model
from app.schemas import CreateSchema, ResponseSchema

def create_item(db: Session, tenant_id: int, data: CreateSchema) -> ResponseSchema:
    """Create a new item with explicit validation."""
    # Validate business rules
    if not data.is_valid():
        raise ValueError("Clear error message")

    # Create model
    item = Model(**data.model_dump(), tenant_id=tenant_id)
    db.add(item)
    db.commit()
    db.refresh(item)

    return ResponseSchema.model_validate(item)
```

### Frontend (TypeScript/React)

- **TypeScript strict mode** - no implicit any
- **Component composition** over prop drilling
- **Server state with TanStack Query** - mutations and queries
- **Loading states** - show feedback for all async operations
- **Error boundaries** - graceful degradation

### Security

- **RBAC checked server-side only** - never trust client-side permissions
- **Tenant isolation enforced in queries** - always filter by tenant_id
- **Idempotent mutations** - POST/PUT operations should be safe to retry
- **No secrets in code** - use environment variables via Settings

## Testing Requirements

### Test Levels

- **Unit**: Services, calculations, business logic
- **Integration**: API routes + database interactions
- **E2E**: Critical user flows (Playwright)

### Required for Every Change

- Test the happy path
- Test at least one failure case
- No regressions allowed

### Definition of Done

- All tests pass
- New behavior is covered by tests
- Existing tests still pass

## AI-Generated Code

When using AI assistance (including Claude Code):
- **Must include explanation** - why this approach?
- **Must include tests** - at minimum happy path + one failure case
- **AI outputs must be explainable** - no black box calculations
- **Assistive, not authoritative** - review all generated code

## Antigravity Workflow

When fixing bugs or implementing features:

1. **Restate intent** - confirm understanding of the requirement
2. **Identify root cause** - don't patch symptoms
3. **Explain before fixing** - describe the approach
4. **Include tests** - validate the fix works
5. **Include verification steps** - how to manually test
6. **Rollback plan** - how to undo if needed

## Environment Configuration

### Backend (.env)

Required environment variables in `backend/.env`:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/solarepc
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=your-secret-key
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CREDENTIALS_PATH=/path/to/credentials.json
```

### Frontend (.env.local)

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Database

- **ORM**: SQLAlchemy 2.0+ (async support)
- **Migrations**: Alembic
- **Connection**: Via `app.core.database.get_db()` dependency
- **Tenant isolation**: Always include `tenant_id` in WHERE clauses

## Common Pitfalls

- **Don't add logic to API routes** - keep them thin, move logic to services
- **Don't skip tenant_id filters** - this causes data leakage between tenants
- **Don't use silent defaults** - explicit is better than implicit
- **Don't commit without tests** - tests are not optional
- **Don't bypass RBAC checks** - always validate permissions server-side
