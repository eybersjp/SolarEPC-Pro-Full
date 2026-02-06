I have the following user query that I want you to help me with. Please implement the requested functionality following best practices.

Improve the `DesignVersionService` in `c:\Users\SSTECH\developments\apps\solarepc-pro\backend\app\services\design_version.py`:

- Refactor to use instance-based pattern (like `SiteDesignService`) instead of static methods for better tenant isolation
- Integrate `AuditService` from `c:\Users\SSTECH\developments\apps\solarepc-pro\backend\app\services\audit.py` for comprehensive audit logging
- Add tenant_id validation in all methods to ensure proper tenant isolation
- Update `create_version()` to use `AuditService.log_create()` pattern
- Update `restore_from_version()` to use `AuditService.log_update()` pattern with detailed old/new values