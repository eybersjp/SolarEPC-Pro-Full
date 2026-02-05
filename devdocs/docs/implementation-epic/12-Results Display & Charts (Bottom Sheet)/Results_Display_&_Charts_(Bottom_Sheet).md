# Results Display & Charts (Bottom Sheet)

## Objective

Implement bottom sheet component for displaying energy estimates and financial analysis with charts.

## Scope

**In Scope:**
- Bottom sheet component (slide-up panel)
- Summary view (collapsed): total modules, system size, annual energy, payback
- Detailed view (expanded): tabbed sections for System Overview, Energy Production, Financial Metrics
- Monthly energy production chart (bar chart using Chart.js or Recharts)
- Polling for energy estimate status (calculating → completed/failed)
- Error handling and retry UI for failed estimates
- "View Details" button to expand sheet

**Out of Scope:**
- Advanced charts (Phase 2)
- Comparison charts between designs (Phase 2)
- Export charts as images (future)

## Acceptance Criteria

- [ ] Bottom sheet component slides up from bottom (collapsed by default)
- [ ] Summary view shows: total modules, system size (kWp), annual energy (MWh), payback (years)
- [ ] "View Details" button expands sheet to full height
- [ ] Detailed view has 3 tabs: System Overview, Energy Production, Financial Metrics
- [ ] Energy Production tab shows monthly bar chart (12 months)
- [ ] Polling: if energy_estimate.status="calculating", poll every 2 seconds
- [ ] Display "Calculating energy..." state while polling
- [ ] If status="failed", show error message and "Retry" button
- [ ] If energy unavailable, show "Energy estimation unavailable" (graceful degradation)
- [ ] Financial metrics display assumptions (electricity rate, escalation)
- [ ] Sheet can be collapsed via drag handle or minimize button
- [ ] Responsive to window resize
- [ ] Unit tests for component and polling logic

## Technical References

- `spec:56e1ef8e-0c2e-42d1-a477-ed6c411cf46a/45ed4022-b415-4778-8bb8-febc85f19df9` - Tech Plan: Results Bottom Sheet
- `spec:56e1ef8e-0c2e-42d1-a477-ed6c411cf46a/f040b177-a20b-4165-a77a-cb6602a7313b` - Core Flows: Flow 4 (View Detailed Results)

## Dependencies

- Ticket: Design Canvas Page & Routing
- Ticket: Energy Estimation Service (provides energy data)
- Ticket: Financial Analysis & BOQ Integration (provides financial data)