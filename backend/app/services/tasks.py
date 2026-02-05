from app.core.celery_app import celery_app
from app.services.placement_algorithm import PlacementAlgorithmService
from typing import Dict, Any, List

@celery_app.task
def calculate_placement_async(
    site_boundary: Dict[str, Any],
    exclusion_zones: List[Dict[str, Any]],
    module_dims: Dict[str, float],
    settings: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Async wrapper for placement calculation.
    """
    return PlacementAlgorithmService.calculate_placement(
        site_boundary,
        exclusion_zones,
        module_dims,
        settings
    )


@celery_app.task(bind=True)
def generate_proposal_task(self, site_design_id: str) -> Dict[str, Any]:
    """
    Async task to generate PDF proposal.
    """
    from app.core.database import SessionLocal
    from app.services.proposal import ProposalService
    from uuid import UUID
    
    db = SessionLocal()
    try:
        service = ProposalService(db)
        # Generate PDF
        pdf_path = service.generate_pdf(UUID(site_design_id))
        
        # In a real app with S3, we would upload here and return the URL.
        # For now, we return the local path.
        # Construct a relative URL or just the path.
        return {"status": "success", "result_url": pdf_path}
    except Exception as e:
        # self.update_state(state='FAILURE', meta={'exc': str(e)}) # Celery does this automatically slightly differently
        raise e
    finally:
        db.close()



@celery_app.task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={'max_retries': 3})
def calculate_energy_task(self, estimate_id: str, params: Dict[str, Any]):
    """
    Async task to call PVWatts API.
    """
    import httpx
    import time
    from sqlalchemy.orm import Session
    from app.core.database import SessionLocal
    from app.models.models import EnergyEstimate
    from app.core.config import settings

    estimate_id_uuid = estimate_id
    db: Session = SessionLocal()
    try:
        estimate = db.query(EnergyEstimate).filter(EnergyEstimate.id == estimate_id_uuid).first()
        if not estimate:
            # Should not happen if called correctly
            return {"error": "Estimate record not found"}

        # API Configuration
        api_key = settings.PVWATTS_API_KEY
        base_url = "https://developer.nrel.gov/api/pvwatts/v8.json"
        
        # Prepare params for API
        api_params = {
            "api_key": api_key,
            "system_capacity": params["system_capacity"],
            "module_type": params.get("module_type", 1),
            "losses": params.get("losses", 14),
            "array_type": params.get("array_type", 1),
            "tilt": params["tilt"],
            "azimuth": params["azimuth"],
            "lat": params["lat"],
            "lon": params["lon"],
            "dataset": "nsrdb", # or international
            "radius": 0
        }

        # Make Request
        response = httpx.get(base_url, params=api_params, timeout=30.0)
        
        if response.status_code != 200:
            # If 429 or 5xx, we might want to let Celery retry.
            # but autoretry_for(Exception) catches raises.
            response.raise_for_status()
            
        data = response.json()
        
        # Parse Results
        outputs = data.get("outputs", {})
        ac_annual = outputs.get("ac_annual", 0)
        ac_monthly = outputs.get("ac_monthly", [])
        capacity_factor = outputs.get("capacity_factor", 0)
        
        # Update Record
        estimate.annual_energy_kwh = ac_annual
        estimate.monthly_energy_kwh = ac_monthly
        estimate.capacity_factor = capacity_factor
        estimate.status = "completed"
        estimate.error_message = None
        
        db.commit()
        
        if estimate.status == "completed":
            # Trigger Financial Analysis
            try:
                from app.services.financial_analysis import FinancialAnalysisService
                from app.models.models import SiteDesign, Tender
                
                # We need context for the service. 
                # EnergyEstimate -> SiteDesign -> Tender -> Tenant/User
                site_design = db.query(SiteDesign).filter(SiteDesign.id == estimate.site_design_id).first()
                if site_design:
                    tender = db.query(Tender).filter(Tender.id == site_design.tender_id).first()
                    if tender:
                        # Use tender creator as the "user" for this system action
                        fin_service = FinancialAnalysisService(db, tender.tenant_id, tender.created_by)
                        fin_service.calculate_financials(site_design.id)
            except Exception as e:
                # Log but don't fail the energy task
                print(f"Failed to calculate financials: {e}")

        return {"status": "success", "annual_energy": ac_annual}

    except Exception as e:
        db.rollback()
        # Update status to failed only if we are on the last retry
        if self.request.retries >= self.max_retries:
             estimate = db.query(EnergyEstimate).filter(EnergyEstimate.id == estimate_id_uuid).first()
             if estimate:
                estimate.status = "failed"
                # Keep error brief
                estimate.error_message = str(e)[:500]
                db.commit()
        raise e
    finally:
        db.close()
