# SolarEPC Pro — Architecture

## High-Level Stack

- Frontend: React / Next.js  
- Backend: FastAPI  
- Workers: Celery  
- Broker: Redis  
- DB: PostgreSQL \+ Firebase (Auth / lightweight data)  
- Infra: Docker, CI/CD, cloud-agnostic

## Core Domains

- Auth & RBAC  
- EPC / Tenant Management  
- Tender & Preconditions  
- Engineering (PV / BESS)  
- Pricing & BOQ  
- Documents & Exports  
- Audit & Logs

## Architectural Rules

- No cross-domain data access without service boundary  
- Explicit schemas for all inputs  
- No silent defaults  
- All calculations reproducible

## AI Usage

- Assistive, not authoritative  
- AI outputs must be explainable  
- No hidden calculations

