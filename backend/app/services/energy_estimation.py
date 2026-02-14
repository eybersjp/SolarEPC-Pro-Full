"""
Service for energy estimation using NREL PVWatts API.
"""
import hashlib
import json
from datetime import UTC, datetime
from typing import Dict, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.models import SiteDesign, EnergyEstimate, Tender
from app.services import tasks


class EnergyEstimationService:
    def __init__(self, db: Session):
        self.db = db

    def get_estimate(self, site_design_id: UUID) -> Optional[EnergyEstimate]:
        """Get existing energy estimate for a site design."""
        return self.db.query(EnergyEstimate).filter(
            EnergyEstimate.site_design_id == site_design_id
        ).first()

    def estimate_energy_async(self, site_design_id: UUID) -> EnergyEstimate:
        """
        Trigger async energy estimation.
        Checks for existing valid estimate (hash match) before triggering task.
        """
        site_design = self.db.query(SiteDesign).filter(SiteDesign.id == site_design_id).first()
        if not site_design:
            raise ValueError(f"SiteDesign {site_design_id} not found")

        # 1. Prepare parameters for PVWatts
        # We need: system_capacity, azimuth, tilt, array_type, losses, lat, lon
        tender = self.db.query(Tender).filter(Tender.id == site_design.tender_id).first()
        if not tender:
             raise ValueError(f"Tender for SiteDesign {site_design_id} not found")

        # SiteDesign should have these results from placement
        system_capacity = site_design.system_size_kwp or 0.0
        # If capacity is 0, we can't estimate validly, but we might want to return an "empty" estimate or error.
        # For now let's proceed, API might reject or return 0.
        
        # Determine array_type based on site_type
        # PVWatts array_type: 0: fixed open, 1: fixed roof, 2: 1-axis, 3: 1-axis back, 4: 2-axis
        # Our site_type: rooftop, ground_mount, carport
        array_type_map = {
            "rooftop": 1,
            "ground_mount": 0,
            "carport": 0, # Approximation
        }
        array_type_val = array_type_map.get(site_design.site_type, 0)

        # Default losses
        losses = 14.0 # Standard default

        params = {
            "system_capacity": system_capacity,
            "module_type": 1, # Standard
            "losses": losses,
            "array_type": array_type_val,
            "tilt": site_design.tilt_deg,
            "azimuth": site_design.azimuth_deg,
            # For lat/lon, we use the Tender's location
            "lat": tender.latitude,
            "lon": tender.longitude
        }

        # 2. Compute Hash
        param_hash = self._compute_hash(params)

        # 3. Check existing estimate
        existing_estimate = self.get_estimate(site_design_id)
        
        if existing_estimate:
            # If hash matches and status is completed, return it (cache hit)
            if existing_estimate.parameter_hash == param_hash and existing_estimate.status == "completed":
                return existing_estimate
            
            # If hash matches and is calculating, return it (idempotent)
            if existing_estimate.parameter_hash == param_hash and existing_estimate.status == "calculating":
                return existing_estimate

            # Otherwise (hash mismatch or failed), update existing record to reset
            existing_estimate.parameter_hash = param_hash
            existing_estimate.status = "calculating"
            existing_estimate.error_message = None
            existing_estimate.retry_count = 0
            existing_estimate.last_retry_at = None
            existing_estimate.calculated_at = datetime.now(UTC)
            # Update params stored in model
            existing_estimate.system_capacity_kw = params["system_capacity"]
            existing_estimate.latitude = params["lat"] or 0
            existing_estimate.longitude = params["lon"] or 0
            existing_estimate.azimuth = params["azimuth"]
            existing_estimate.tilt = params["tilt"]
            
            self.db.commit()
            self.db.refresh(existing_estimate)
        else:
            # Create new estimate record
            existing_estimate = EnergyEstimate(
                site_design_id=site_design_id,
                parameter_hash=param_hash,
                system_capacity_kw=params["system_capacity"],
                latitude=params["lat"] or 0,
                longitude=params["lon"] or 0,
                azimuth=params["azimuth"],
                tilt=params["tilt"],
                status="calculating",
                retry_count=0,
                last_retry_at=None,
                annual_energy_kwh=0,
                monthly_energy_kwh={},
                capacity_factor=0
            )
            self.db.add(existing_estimate)
            self.db.commit()
            self.db.refresh(existing_estimate)

        # 4. Trigger Celery Task
        # We pass estimate_id so task can update the record
        # We pass params explicitly to avoid DB lookup in worker if possible, or just for clarity
        tasks.calculate_energy_task.delay(
            str(existing_estimate.id), 
            params
        )

        # Log audit entry
        from app.services.audit import AuditService
        audit = AuditService(self.db)
        audit.log(
            tenant_id=tender.tenant_id,
            user_id=site_design.created_by,
            entity_type="EnergyEstimate",
            entity_id=existing_estimate.id,
            action="calculate_energy",
            new_value={"site_design_id": str(site_design_id)}
        )

        return existing_estimate

    def _compute_hash(self, params: Dict) -> str:
        """Compute SHA256 hash of parameters for caching."""
        # Sort keys to ensure consistent JSON
        param_str = json.dumps(params, sort_keys=True)
        return hashlib.sha256(param_str.encode("utf-8")).hexdigest()
