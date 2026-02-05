# Proposal Generation Wizard & Export

## Objective

Implement multi-step wizard for proposal configuration, preview, and download (PDF + CSV).

## Scope

**In Scope:**
- Modal wizard with 3 steps: Configure, Preview, Download
- Step 1: Proposal title, section selection (checkboxes)
- Step 2: PDF preview (iframe or thumbnail)
- Step 3: Download links for PDF and CSV
- Task polling for async PDF generation
- Loading states and error handling
- Integration with ProposalGenerationService

**Out of Scope:**
- Email delivery (future)
- Custom template editor (Phase 2)
- Proposal history/archive (future)

## Acceptance Criteria

- [ ] Wizard modal opens when "Generate Proposal" clicked
- [ ] Step 1: Configure proposal title and sections to include (5 checkboxes)
- [ ] Step 2: Trigger PDF generation via `POST /api/site-designs/{id}/generate-proposal`
- [ ] Poll task status via `GET /api/tasks/{task_id}/status`
- [ ] Display loading state: "Generating proposal..."
- [ ] Step 2: Show PDF preview when ready (iframe or thumbnail)
- [ ] Step 3: Download buttons for PDF and CSV BOM
- [ ] CSV download via `GET /api/site-designs/{id}/export-csv`
- [ ] Error handling: if PDF generation fails, show error and allow retry
- [ ] "Done" button closes wizard and returns to canvas
- [ ] Wizard state persists if user closes and reopens (within session)
- [ ] Unit tests for wizard flow and task polling

## Technical References

- `spec:56e1ef8e-0c2e-42d1-a477-ed6c411cf46a/45ed4022-b415-4778-8bb8-febc85f19df9` - Tech Plan: Proposal Generation Wizard
- `spec:56e1ef8e-0c2e-42d1-a477-ed6c411cf46a/f040b177-a20b-4165-a77a-cb6602a7313b` - Core Flows: Flow 5 (Generate Proposal), Wireframe

## Dependencies

- Ticket: Design Canvas Page & Routing
- Ticket: Proposal Generation Service (provides PDF and CSV)