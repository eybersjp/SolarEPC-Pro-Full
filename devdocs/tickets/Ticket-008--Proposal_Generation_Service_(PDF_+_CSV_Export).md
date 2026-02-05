# Proposal Generation Service (PDF + CSV Export)

## Objective

Implement proposal generation service with PDF export (Jinja2 + WeasyPrint) and CSV BOM export.

## Scope

**In Scope:**
- `ProposalGenerationService` with template rendering
- Jinja2 templates for PDF proposals
- WeasyPrint for HTML→PDF conversion
- Matplotlib for charts (monthly energy production)
- Async Celery task for PDF generation
- CSV BOM export (synchronous)
- Configurable storage backend (local filesystem or S3)
- API endpoints: generate proposal (async), export CSV, poll task status

**Out of Scope:**
- Customizable templates (Phase 2)
- Company branding (Phase 2)
- Email delivery (future)

## Acceptance Criteria

- [ ] ProposalGenerationService.generate_proposal_async() triggers Celery task
- [ ] Jinja2 templates render: cover page, site map, system specs, energy production, financials, equipment list
- [ ] Matplotlib generates monthly energy production chart
- [ ] WeasyPrint converts HTML to PDF
- [ ] Configurable storage: local filesystem (Phase 1) or S3 (Phase 2)
- [ ] PDF includes all selected sections (configurable via wizard)
- [ ] CSV BOM export includes: category, description, quantity, unit_cost, line_total
- [ ] API endpoints: `POST /api/site-designs/{id}/generate-proposal` (returns task_id), `GET /api/site-designs/{id}/export-csv`, `GET /api/tasks/{task_id}/status`
- [ ] Graceful handling if energy estimate unavailable (show "N/A" in proposal)
- [ ] Audit logging for proposal generation
- [ ] Unit tests for template rendering and CSV export
- [ ] Integration tests for full PDF generation

## Technical References

- `spec:56e1ef8e-0c2e-42d1-a477-ed6c411cf46a/45ed4022-b415-4778-8bb8-febc85f19df9` - Tech Plan: ProposalGenerationService, PDF Generation
- `spec:56e1ef8e-0c2e-42d1-a477-ed6c411cf46a/f040b177-a20b-4165-a77a-cb6602a7313b` - Core Flows: Flow 5 (Generate Proposal)
- `file:backend/app/services/boq.py` - BOQ integration

## Dependencies

- Ticket: SiteDesign Service & CRUD API
- Ticket: Energy Estimation Service (provides energy data for proposals)
- Ticket: Financial Analysis & BOQ Integration (provides financial data)