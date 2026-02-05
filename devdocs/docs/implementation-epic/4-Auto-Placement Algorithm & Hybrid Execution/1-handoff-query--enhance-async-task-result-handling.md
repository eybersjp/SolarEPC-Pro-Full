I have the following user query that I want you to help me with. Please implement the requested functionality following best practices.

Implement async task result persistence and status tracking:

- Update `calculate_placement_async` in `c:\Users\SSTECH\developments\apps\solarepc-pro\backend\app\services\tasks.py` to save results to database upon completion
- Add task status tracking (pending/running/completed/failed) to `SiteDesign` model or create a separate `PlacementTask` table
- Implement retry logic with exponential backoff for failed tasks
- Add error handling and logging for task failures