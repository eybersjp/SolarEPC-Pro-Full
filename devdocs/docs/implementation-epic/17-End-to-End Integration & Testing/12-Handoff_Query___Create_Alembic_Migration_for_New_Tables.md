I have the following user query that I want you to help me with. Implement the requested functionality following best practices.

Generate and configure Alembic migration:

- Run `alembic revision -m "add_site_design_and_equipment_tables"`
- Create 6 tables: `equipment_modules`, `equipment_inverters`, `site_designs`, `design_versions`, `energy_estimates`, `financial_analyses`
- Add indexes for performance: tenant_id, is_global, tender_id, equipment IDs, parameter_hash
- Implement proper `upgrade()` and `downgrade()` functions
- Test migration: run upgrade, verify tables, test rollback