"""
Integration Tests for Energy Estimation Service.
Exercises real PVWatts API calls using configured API key.

Prerequisites:
- Network access to developer.nrel.gov
- Valid PVWATTS_API_KEY in environment or .env (defaults to DEMO_KEY)
"""

import pytest
import httpx
from uuid import uuid4
from unittest.mock import MagicMock, patch
from sqlalchemy.orm import Session

from app.services.energy_estimation import EnergyEstimationService
from app.models.models import SiteDesign, EnergyEstimate, Tender, Tenant, User, EquipmentModule, EquipmentInverter
from app.core.database import SessionLocal
from app.core.config import settings

@pytest.fixture
def db_session():
    """Real database session for integration tests, using local SQLite."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from app.models.models import Base
    
    test_db_url = "sqlite:///./test_solarepc_int.db"
    engine = create_engine(test_db_url, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    
    SessionLocalTest = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = SessionLocalTest()
    
    # Patch SessionLocal in the core module to use our test session
    # Since tasks.py and energy_estimation.py import it, patching core.database should be enough
    with patch("app.core.database.SessionLocal", return_value=session):
        try:
            yield session
        finally:
            session.rollback()
            session.close()
            # Cleanup test DB
            import os
            if os.path.exists("./test_solarepc_int.db"):
                try:
                    os.remove("./test_solarepc_int.db")
                except:
                    pass

@pytest.fixture
def site_context(db_session: Session):
    """Setup a full tender/design context for estimation."""
    from app.models.models import Tenant, User, Tender, EquipmentModule, EquipmentInverter, SiteDesign
    
    suffix = str(uuid4())[:8]
    tenant = Tenant(id=uuid4(), name=f"Integration Test Tenant {suffix}")
    db_session.add(tenant)
    
    user = User(
        id=uuid4(), 
        tenant_id=tenant.id, 
        email=f"test_{suffix}@example.com", 
        firebase_uid=f"firebase_{suffix}"
    )
    db_session.add(user)

    tender = Tender(
        id=uuid4(),
        tenant_id=tenant.id,
        created_by=user.id,
        name=f"Integration Test Tender {suffix}",
        latitude=34.0522, # LA
        longitude=-118.2437
    )
    db_session.add(tender)

    module = EquipmentModule(
        id=uuid4(),
        manufacturer="Test", model="M1", wattage=400, efficiency=20.0,
        length_m=2.0, width_m=1.0, thickness_m=0.04,
        voc=40.0, isc=10.0, vmp=32.0, imp=9.0, is_global=True
    )
    inverter = EquipmentInverter(
        id=uuid4(),
        manufacturer="Test", model="I1", capacity_kw=10.0,
        max_dc_voltage=1000, mppt_voltage_range_min=200, mppt_voltage_range_max=800,
        max_input_current=20, num_mppt_channels=2, is_global=True
    )
    db_session.add(module)
    db_session.add(inverter)
    db_session.commit()

    design = SiteDesign(
        id=uuid4(),
        tender_id=tender.id,
        name=f"Test Design {suffix}",
        site_type="rooftop",
        created_by=user.id,
        equipment_module_id=module.id,
        equipment_inverter_id=inverter.id,
        site_boundary={"type": "Polygon", "coordinates": [[[0,0], [0,1], [1,1], [1,0], [0,0]]]},
        tilt_deg=20.0,
        azimuth_deg=180.0,
        system_size_kwp=10.0
    )
    db_session.add(design)
    db_session.commit()
    
    yield design

@pytest.mark.integration
class TestEnergyEstimationIntegration:
    
    def test_pvwatts_api_success(self, db_session: Session, site_context: SiteDesign):
        """Test a successful real API call and persistence."""
        service = EnergyEstimationService(db_session)
        
        # Trigger estimation (sets up the record and hash)
        estimate = service.estimate_energy_async(site_context.id)
        
        assert estimate.status == "calculating"
        assert estimate.site_design_id == site_context.id
        
        # Run task logic synchronously
        from app.services.tasks import calculate_energy_task
        
        # Prepare params as service would
        tender = db_session.query(Tender).filter(Tender.id == site_context.tender_id).first()
        params = {
            "system_capacity": site_context.system_size_kwp,
            "module_type": 1,
            "losses": 14.0,
            "array_type": 1,
            "tilt": site_context.tilt_deg,
            "azimuth": site_context.azimuth_deg,
            "lat": tender.latitude,
            "lon": tender.longitude
        }
        
        # Call task run method directly
        mock_self = MagicMock()
        mock_self.request.retries = 0
        mock_self.max_retries = 3
        
        calculate_energy_task.run(mock_self, str(estimate.id), params)
        
        # Refresh from DB
        db_session.refresh(estimate)
        
        assert estimate.status == "completed"
        assert estimate.annual_energy_kwh > 0
        assert len(estimate.monthly_energy_kwh) == 12
        assert estimate.capacity_factor > 0
        assert estimate.calculated_at is not None

    @pytest.mark.parametrize("site_type, expected_array_type", [
        ("rooftop", 1),
        ("ground_mount", 0),
        ("carport", 0)
    ])
    def test_array_type_mapping_integration(self, db_session: Session, site_context: SiteDesign, site_type, expected_array_type):
        """Verify task receives correct array_type based on site_type mapping."""
        site_context.site_type = site_type
        db_session.commit()
        
        # Clear existing
        db_session.query(EnergyEstimate).filter(EnergyEstimate.site_design_id == site_context.id).delete()
        db_session.commit()

        # We want to verify what the service passes to the task
        with patch("app.services.tasks.calculate_energy_task.delay") as mock_delay:
            service = EnergyEstimationService(db_session)
            service.estimate_energy_async(site_context.id)
            
            assert mock_delay.called
            sent_params = mock_delay.call_args[0][1]
            assert sent_params["array_type"] == expected_array_type

    def test_rate_limit_scenario_integration(self, db_session: Session, site_context: SiteDesign):
        """Simulate a rate limit (429) from PVWatts."""
        from app.services.tasks import calculate_energy_task

        # Ensure we have an estimate record
        db_session.query(EnergyEstimate).filter(EnergyEstimate.site_design_id == site_context.id).delete()
        db_session.commit()
        
        service = EnergyEstimationService(db_session)
        estimate = service.estimate_energy_async(site_context.id)

        params = {"system_capacity": 10.0, "tilt": 20.0, "azimuth": 180.0, "lat": 34.0, "lon": -118.0}

        with patch("httpx.get") as mock_get:
            mock_response = MagicMock()
            mock_response.status_code = 429
            mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
                "Too Many Requests", 
                request=MagicMock(), 
                response=mock_response
            )
            mock_get.return_value = mock_response
            
            mock_self = MagicMock()
            mock_self.request.retries = 3 # Final retry
            mock_self.max_retries = 3

            # Should raise and eventually mark as failed
            with pytest.raises(httpx.HTTPStatusError):
                calculate_energy_task.run(mock_self, str(estimate.id), params)
            
            db_session.refresh(estimate)
            assert estimate.status == "failed"
            assert "Too Many Requests" in estimate.error_message

    def test_timeout_scenario_integration(self, db_session: Session, site_context: SiteDesign):
        """Simulate a timeout from PVWatts."""
        from app.services.tasks import calculate_energy_task

        # Ensure we have an estimate record
        db_session.query(EnergyEstimate).filter(EnergyEstimate.site_design_id == site_context.id).delete()
        db_session.commit()
        
        service = EnergyEstimationService(db_session)
        estimate = service.estimate_energy_async(site_context.id)

        params = {"system_capacity": 10.0, "tilt": 20.0, "azimuth": 180.0, "lat": 34.0, "lon": -118.0}

        with patch("httpx.get", side_effect=httpx.TimeoutException("Connection Timeout")):
            mock_self = MagicMock()
            mock_self.request.retries = 3
            mock_self.max_retries = 3

            with pytest.raises(httpx.TimeoutException):
                calculate_energy_task.run(mock_self, str(estimate.id), params)
            
            db_session.refresh(estimate)
            assert estimate.status == "failed"
            assert "Timeout" in estimate.error_message
