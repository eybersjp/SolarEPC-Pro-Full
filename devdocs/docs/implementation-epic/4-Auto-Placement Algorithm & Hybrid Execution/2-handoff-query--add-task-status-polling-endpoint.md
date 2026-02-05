I have the following user query that I want you to help me with. Please implement the requested functionality following best practices.

Create API endpoint for checking async task status:

- Add GET `/site-designs/{design_id}/placement-task/{task_id}` endpoint in `c:\Users\SSTECH\developments\apps\solarepc-pro\backend\app\api\site_designs.py`
- Return task status (pending/running/completed/failed), progress percentage, and results when complete
- Add corresponding Pydantic schemas in `c:\Users\SSTECH\developments\apps\solarepc-pro\backend\app\schemas\site_design.py`
- Handle edge cases (task not found, expired tasks)