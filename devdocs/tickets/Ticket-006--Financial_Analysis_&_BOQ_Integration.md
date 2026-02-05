# Financial Analysis & BOQ Integration

## Objective

Implement financial analysis service with basic metrics (payback, ROI) and integration with existing BOQ system.

## Scope

**In Scope:**
- `FinancialAnalysisService` with calculation methods
- Integration with existing `file:backend/app/services/boq.py` for system cost
- Calculations: annual savings, simple payback, ROI
- Default assumptions: electricity rate, escalation rate
- API endpoint: `GET /api/site-designs/{id}/financial-analysis`
- Automatic recalculation when energy estimate or BOQ changes

**Out of Scope:**
- Comprehensive financial model (NPV, IRR, sensitivity analysis - Phase 2)
- User-configurable assumptions (Phase 2)
- Financing scenarios (Phase 2)

## Acceptance Criteria

- [ ] FinancialAnalysisService.calculate_financials() implements basic calculations
- [ ] System cost fetched from BOQ via BOQService.get_summary()
- [ ] Annual savings = annual_energy_kwh × electricity_rate
- [ ] Simple payback = system_cost / annual_savings
- [ ] ROI = ((annual_savings × 25 years) - system_cost) / system_cost × 100
- [ ] Default assumptions: electricity_rate=$0.12/kWh, escalation=2%
- [ ] Results stored in financial_analyses table
- [ ] Recalculation triggered when energy estimate or BOQ total changes
- [ ] API endpoint returns financial metrics
- [ ] Handles missing energy estimate gracefully (returns null or estimated values)
- [ ] Unit tests for calculations and BOQ integration

## Technical References

- `spec:56e1ef8e-0c2e-42d1-a477-ed6c411cf46a/45ed4022-b415-4778-8bb8-febc85f19df9` - Tech Plan: FinancialAnalysisService, BOQ Integration
- `file:backend/app/services/boq.py` - Existing BOQ service
- `spec:56e1ef8e-0c2e-42d1-a477-ed6c411cf46a/f040b177-a20b-4165-a77a-cb6602a7313b` - Core Flows: Flow 4 (Financial Metrics)

## Dependencies

- Ticket: SiteDesign Service & CRUD API
- Ticket: Energy Estimation Service (provides annual_energy_kwh)