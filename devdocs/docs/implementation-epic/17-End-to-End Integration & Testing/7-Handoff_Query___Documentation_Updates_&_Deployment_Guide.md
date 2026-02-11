I have the following user query that I want you to help me with. Implement the requested functionality following best practices.

Update documentation for the map-based design canvas feature:

- Update API documentation:
  - Generate OpenAPI/Swagger docs for new endpoints in `c:\Users\SSTECH\developments\apps\solarepc-pro\backend\app\api\site_designs.py`, `c:\Users\SSTECH\developments\apps\solarepc-pro\backend\app\api\proposals.py`
  - Document request/response schemas from `c:\Users\SSTECH\developments\apps\solarepc-pro\backend\app\schemas\site_design.py`, `c:\Users\SSTECH\developments\apps\solarepc-pro\backend\app\schemas\design_version.py`
  - Add API usage examples for design workflow
- Create deployment guide in DEPLOYMENT.md:
  - Document new dependencies: WeasyPrint, Leaflet, Zustand, React-Leaflet
  - Add environment variables for PVWatts API key, storage backend
  - Document Celery worker setup for async tasks
  - Add database migration instructions for new tables (SiteDesign, DesignVersion, EnergyEstimate, FinancialAnalysis)
- Update `c:\Users\SSTECH\developments\apps\solarepc-pro\README.md` with feature overview and getting started guide
- Create troubleshooting guide for common issues (PVWatts failures, PDF generation, map rendering)