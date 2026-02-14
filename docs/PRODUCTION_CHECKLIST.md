# Production Release Checklist

## 1. Environment Configuration

### Backend (`.env.prod`)

- [ ] `DEBUG=False`
- [ ] `SECRET_KEY` is a strong, random string (min 32 chars)
- [ ] `ALLOWED_HOSTS` includes only your domain(s) and load balancer IPs
- [ ] `CORS_ORIGINS` is restricted to your frontend domain
- [ ] `DATABASE_URL` points to production PostgreSQL
- [ ] `REDIS_URL` points to production Redis (with password if applicable)
- [ ] `Sentry/GlitchTip` DSN configured for error tracking

### Frontend (`.env.production`)

- [ ] `NEXT_PUBLIC_API_URL` points to production API (HTTPS)
- [ ] `NEXT_PUBLIC_FIREBASE_*` keys are for production project

## 2. Infrastructure & Deployment

### Docker

- [ ] Build images using `Dockerfile.prod`
- [ ] verify image size is optimized (backend < 500MB, frontend < 200MB)
- [ ] Scan images for vulnerabilities (`trivy image <image_name>`)

### Database

- [ ] Backup existing data (if any)
- [ ] Run migrations: `docker-compose -f docker-compose.prod.yml exec backend alembic upgrade head`
- [ ] Seed initial data: `docker-compose -f docker-compose.prod.yml exec backend python scripts/seed_equipment.py`

### Web Server (Nginx/Load Balancer)

- [ ] SSL/TLS Certificates configured (e.g., Let's Encrypt)
- [ ] HTTP to HTTPS redirect enabled
- [ ] HSTS header enabled

## 3. Monitoring & Observability

### Logging

- [ ] Backend logs are outputting JSON
- [ ] Log aggregation connected (ELK, Datadog, or Cloudwatch)

### Health Checks

- [ ] `/health` endpoint returns 200 OK and reports DB/Redis connectivity
- [ ] External uptime monitoring configured (Pingdom, UptimeRobot)

## 4. Security Verification

- [ ] Rate limiting is active (test by spamming an endpoint)
- [ ] CORS is blocking unauthorized domains
- [ ] Database is not publicly accessible
- [ ] Redis is not publicly accessible

## 5. Rollback Plan

If deployment fails:

1. Revert to previous Docker image tags.
2. Downgrade database if migration caused issues: `alembic downgrade -1`
3. Restore database backup if data corruption occurred.
