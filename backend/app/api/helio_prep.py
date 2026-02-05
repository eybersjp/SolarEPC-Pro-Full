from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from app.schemas.helio_prep import InputDataset, ValidationResult, NormalizedDataset
from app.services.helio_prep import HelioPrepService
# from app.api import deps # Assuming deps has get_db and current_user

router = APIRouter()

@router.post("/{tender_id}/validate", response_model=ValidationResult)
async def validate_data(
    tender_id: str,
    data: InputDataset,
    # current_user = Depends(deps.get_current_active_user) # Add auth later if needed
):
    """
    Validate project input data for consistency and errors.
    """
    try:
        result = HelioPrepService.validate_input_data(data)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Validation failed: {str(e)}"
        )

@router.post("/{tender_id}/normalize", response_model=NormalizedDataset)
async def normalize_data(
    tender_id: str,
    data: InputDataset,
):
    """
    Normalize and clean project input data.
    """
    try:
        # First validate
        validation = HelioPrepService.validate_input_data(data)
        if not validation.is_valid:
            errors = [f.message for f in validation.flags if f.severity == "error"]
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot normalize invalid data: {', '.join(errors)}"
            )
            
        result = HelioPrepService.normalize_data(data)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Normalization failed: {str(e)}"
        )
