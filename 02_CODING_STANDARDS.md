# Coding Standards

## General

- Small, readable functions  
- Explicit variable names  
- Fail fast with clear errors

## Backend

- Pydantic schemas required  
- No logic in routes  
- Services must be testable in isolation

## Frontend

- No business logic in UI  
- Validation before submit  
- Loading \+ error states mandatory

## Security

- RBAC checked server-side only  
- No secrets in logs  
- Idempotent mutations

## AI-Generated Code

- Must include explanation  
- Must include tests

