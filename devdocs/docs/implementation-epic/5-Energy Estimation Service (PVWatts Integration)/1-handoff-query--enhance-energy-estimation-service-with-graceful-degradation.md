I have the following user query that I want you to help me with. Please implement the requested functionality following best practices.

Enhance the existing energy estimation implementation to meet all acceptance criteria:

- Review and verify hash-based cache invalidation in `c:\Users\SSTECH\developments\apps\solarepc-pro\backend\app\services\energy_estimation.py` (SHA256 of energy parameters)
- Ensure graceful degradation: proposal generation proceeds without energy data if API fails
- Add manual retry capability via API endpoint in `c:\Users\SSTECH\developments\apps\solarepc-pro\backend\app\api\site_designs.py`
- Verify retry logic in `c:\Users\SSTECH\developments\apps\solarepc-pro\backend\app\services\tasks.py` (3 attempts, exponential backoff: 1s, 2s, 4s)
- Update `c:\Users\SSTECH\developments\apps\solarepc-pro\backend\app\models\models.py` if needed to support error tracking and retry metadata