Add abstracted storage backend for proposal PDFs:

- Create storage interface in new file backend/app/services/storage.py with `StorageBackend` abstract class  
- Implement `LocalFileStorage` and `S3Storage` classes  
- Add `PROPOSAL_STORAGE_BACKEND` and `S3_BUCKET_NAME` settings to `c:\Users\SSTECH\developments\apps\solarepc-pro\backend\app\core\config.py`  
- Update `ProposalService.generate_pdf()` to use storage backend for saving PDFs  
- Update `generate_proposal_task` in `c:\Users\SSTECH\developments\apps\solarepc-pro\backend\app\services\tasks.py` to return proper download URL based on storage type  
- Add boto3 to `c:\Users\SSTECH\developments\apps\solarepc-pro\backend\requirements.txt` (optional dependency)

