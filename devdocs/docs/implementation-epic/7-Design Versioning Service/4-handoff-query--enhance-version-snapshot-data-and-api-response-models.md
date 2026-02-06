I have the following user query that I want you to help me with. Please implement the requested functionality following best practices.

Improve snapshot completeness and API responses:

- Update `create_version()` in `c:\Users\SSTECH\developments\apps\solarepc-pro\backend\app\services\design_version.py` to include energy estimate and financial analysis results in snapshot_data
- Add `DesignVersionDetail` schema usage in `c:\Users\SSTECH\developments\apps\solarepc-pro\backend\app\api\site_designs.py` for a new GET endpoint `/site-designs/{design_id}/versions/{version_id}` that returns full snapshot data
- Update `DesignVersionResponse` in `c:\Users\SSTECH\developments\apps\solarepc-pro\backend\app\schemas\design_version.py` to include summary statistics (total_modules, system_size_kwp) for list view
- Add validation to ensure all required fields are present in snapshot before creating version
- Document snapshot data structure in schema docstrings