I have the following comments after thorough review of file. Implement the comments by following the instructions verbatim.

---
## Comment 1: Task status endpoint allows any authenticated user to fetch any proposal task result URL across tenants.

In `backend/app/api/proposals.py` `get_task_status()`, fetch the task’s originating tenant/user (store it in the task result or task meta) and ensure `current_user.tenant_id` matches before returning any status or URL; return 404/403 on mismatch.

### Relevant Files
- c:\Users\SSTECH\developments\apps\solarepc-pro\backend\app\api\proposals.py
- c:\Users\SSTECH\developments\apps\solarepc-pro\backend\app\services\tasks.py
---
## Comment 2: Local storage returns an absolute filesystem path as the download URL, which is both unusable and leaks internals.

In `backend/app/services/storage.py` adjust `LocalFileStorage.get_url()` to return an HTTP-accessible route (or static URL) and update `backend/app/services/tasks.py` to return that routable link instead of a filesystem path.

### Relevant Files
- c:\Users\SSTECH\developments\apps\solarepc-pro\backend\app\services\storage.py
- c:\Users\SSTECH\developments\apps\solarepc-pro\backend\app\services\tasks.py
---
## Comment 3: BOM CSV export can crash when BOQ numeric fields are None due to direct float formatting.

In `backend/app/services/proposal.py` `generate_bom_csv()`, coalesce BOQ fields (e.g., `unit_cost`, `margin_pct`, `line_total`) to 0.0 and `description/category` to empty/N/A before formatting to prevent TypeError when values are None.

### Relevant Files
- c:\Users\SSTECH\developments\apps\solarepc-pro\backend\app\services\proposal.py
---