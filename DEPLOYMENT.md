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

## 2. CI/CD Pipeline

The project uses GitHub Actions for automated testing and deployment.

### Workflows

| Workflow | Trigger | Description |
|----------|---------|-------------|
| **Backend CI** | Push/PR to `main` | Lints (Ruff, MyPy), runs unit/integration tests, scans security (Bandit). |
| **Frontend Tests** | Push/PR to `main` | Runs unit components tests and E2E tests with Playwright. |
| **Full Stack Integration** | Push/PR to `main` | Docker Compose based E2E testing of the entire stack. |
| **Deploy** | Tag `v*` or Manual | Builds Docker images, pushes to GHCR, and deploys to Staging/Production. |

### Environment Secrets

Configure these secrets in GitHub Repository Settings:

- `DOCKER_USERNAME` / `GITHUB_TOKEN`: For GHCR/Docker Hub access.
- `STAGING_HOST`, `STAGING_USER`, `STAGING_SSH_KEY`: Staging server credentials.
- `PROD_HOST`, `PROD_USER`, `PROD_SSH_KEY`: Production server credentials.
- `CODECOV_TOKEN`: For coverage reporting.

## 3. Manual Deployment

### Docker (Production)

1. **Build Images**:

    ```bash
    docker-compose -f docker-compose.prod.yml build
    ```

2. **Start Services**:

    ```bash
    docker-compose -f docker-compose.prod.yml up -d
    ```

3. **Run Migrations**:

    ```bash
    docker-compose -f docker-compose.prod.yml exec backend alembic upgrade head
    ```

4. **Seed Data**:

    ```bash
    docker-compose -f docker-compose.prod.yml exec backend python scripts/seed_equipment.py
    docker-compose -f docker-compose.prod.yml exec backend python scripts/seed_tenants.py
    ```

## 4. Rollback Procedures

If a deployment fails:

1. **Revert Docker Image**:
    - Identify the previous working tag (e.g., `v1.2.3`).
    - Update `docker-compose.prod.yml` or redeploy that tag via GitHub Actions.

2. **Database Rollback**:
    - If a migration caused issues, rollback the last step:

    ```bash
    docker-compose -f docker-compose.prod.yml exec backend alembic downgrade -1
    ```

3. **Restore Backup**:
    - If data corruption occurred, restore from the latest nightly backup.

## 5. Environment Variables

Reference the `PRODUCTION_CHECKLIST.md` for a complete list of required environment variables.
