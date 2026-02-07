I have the following user query that I want you to help me with. Please implement the requested functionality following best practices.

Enhance proposal generation with configurable sections:

- Update `ProposalGenerateRequest` schema in `c:\Users\SSTECH\developments\apps\solarepc-pro\backend\app\schemas\proposal.py` to include section toggles (cover, site_map, specs, energy, financials, equipment)
- Modify `ProposalService.generate_pdf()` in `c:\Users\SSTECH\developments\apps\solarepc-pro\backend\app\services\proposal.py` to accept options parameter
- Update Jinja2 template `c:\Users\SSTECH\developments\apps\solarepc-pro\backend\templates\proposal.html` with conditional blocks for each section
- Update `generate_proposal_task` in `c:\Users\SSTECH\developments\apps\solarepc-pro\backend\app\services\tasks.py` to pass options to service
- Modify API endpoint in `c:\Users\SSTECH\developments\apps\solarepc-pro\backend\app\api\proposals.py` to accept request body with options