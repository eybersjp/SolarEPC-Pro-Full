import os
import pytest
import io
import csv
from unittest.mock import MagicMock, patch, ANY
from uuid import uuid4, UUID
from datetime import datetime

# Mock missing optional dependencies for test collection
import sys
from unittest.mock import MagicMock

# Optional dependencies like boto3 are mocked if missing to allow collection
if "boto3" not in sys.modules:
    sys.modules["boto3"] = MagicMock()
if "botocore" not in sys.modules:
    sys.modules["botocore"] = MagicMock()
if "botocore.exceptions" not in sys.modules:
    sys.modules["botocore.exceptions"] = MagicMock()

def is_weasyprint_available():
    """Check if weasyprint is installed and working (GObject libs present)."""
    try:
        import weasyprint
        from weasyprint import HTML
        return True
    except (ImportError, OSError):
        return False

def is_matplotlib_available():
    """Check if matplotlib is installed and working."""
    try:
        import matplotlib.pyplot
        return True
    except (ImportError, OSError):
        return False

from app.services.proposal import ProposalService
from app.services.storage import LocalFileStorage, S3Storage, get_storage_backend
from app.models.models import SiteDesign, BOQItem, Tender, EnergyEstimate, FinancialAnalysis

@pytest.fixture
def mock_db():
    db = MagicMock()
    # Mock query chain: db.query(Model).filter(...).first()
    db.query.return_value.options.return_value.filter.return_value.first.return_value = None
    db.query.return_value.filter.return_value.first.return_value = None
    db.query.return_value.filter.return_value.all.return_value = []
    return db

@pytest.fixture
def mock_storage():
    storage = MagicMock()
    storage.save.return_value = "test_file.pdf"
    storage.get_url.return_value = "http://example.com/test_file.pdf"
    return storage

class TestProposalService:
    @pytest.fixture(autouse=True)
    def maybe_mock_deps(self):
        """Localized mocking for unit tests if real dependencies are missing."""
        patches = {}
        if not is_weasyprint_available():
            patches["weasyprint"] = MagicMock()
        if not is_matplotlib_available():
            patches["matplotlib"] = MagicMock()
            patches["matplotlib.pyplot"] = MagicMock()
        
        if patches:
            with patch.dict(sys.modules, patches):
                yield
        else:
            yield

    def test_generate_bom_csv_success(self, mock_db):
        design_id = uuid4()
        tender_id = uuid4()
        
        design = SiteDesign(id=design_id, tender_id=tender_id, name="Test Design", created_by=uuid4())
        tender = Tender(id=tender_id, name="Test Tender", tenant_id=uuid4())
        item1 = BOQItem(category="Modules", description="P1", unit_cost=100.0, quantity=5, margin_pct=10.0, line_total=550.0)
        
        # Mapping queries
        def side_effect(model):
            mock = MagicMock()
            if model == SiteDesign:
                mock.filter.return_value.first.return_value = design
            elif model == Tender:
                mock.filter.return_value.first.return_value = tender
            elif model == BOQItem:
                mock.filter.return_value.all.return_value = [item1]
            return mock

        mock_db.query.side_effect = side_effect
        
        service = ProposalService(mock_db)
        csv_content = service.generate_bom_csv(design_id)
        
        assert "Modules,P1,100.00,5,10.00,550.00" in csv_content
        assert mock_db.commit.called

    def test_generate_bom_csv_empty(self, mock_db):
        design_id = uuid4()
        design = SiteDesign(id=design_id, tender_id=uuid4(), created_by=uuid4())
        
        mock_db.query.return_value.filter.return_value.first.return_value = design
        mock_db.query.return_value.filter.return_value.all.return_value = []
        
        service = ProposalService(mock_db)
        csv_content = service.generate_bom_csv(design_id)
        
        # Should still have headers
        assert "Category,Description,Unit Cost ($)" in csv_content
        assert len(csv_content.splitlines()) == 1

    @patch("weasyprint.HTML", create=True)
    @patch("weasyprint.CSS", create=True)
    def test_generate_pdf_graceful_degradation(self, mock_css, mock_html, mock_db, mock_storage):
        design_id = uuid4()
        tender_id = uuid4()
        
        design = SiteDesign(id=design_id, tender_id=tender_id, name="NoDataDesign", created_by=uuid4(), system_size_kwp=0.0)
        tender = Tender(id=tender_id, name="T1", tenant_id=uuid4(), latitude=0.0, longitude=0.0)
        
        # design, tender, energy, financials
        mock_db.query.return_value.filter.return_value.first.side_effect = [design, tender, None, None]
        mock_db.query.return_value.filter.return_value.all.return_value = []
        
        service = ProposalService(mock_db, storage=mock_storage)
        
        with patch.object(service, '_generate_monthly_chart', return_value=None):
            storage_id = service.generate_pdf(design_id)
            
            assert storage_id == "test_file.pdf"
            assert mock_html.called or mock_css.called # At least we used WeasyPrint
            # Ensure audit log was attempted
            assert mock_db.commit.called

    def test_chart_generation_variants(self, mock_db):
        service = ProposalService(mock_db)
        
        # 1. Valid list
        with patch("matplotlib.pyplot.savefig"):
            chart = service._generate_monthly_chart([10, 20, 30])
            assert chart is not None
            
        # 2. All zeros
        chart = service._generate_monthly_chart([0, 0, 0])
        assert chart is None
        
        # 3. None
        assert service._generate_monthly_chart(None) is None
        
        # 4. Malformed
        assert service._generate_monthly_chart("not a list") is None

class TestStorageBackends:
    def test_local_file_storage(self, tmp_path):
        storage_dir = tmp_path / "proposals"
        with patch("app.core.config.settings.PROPOSAL_LOCAL_DIR", str(storage_dir)):
            storage = LocalFileStorage()
            
            # Create a dummy file
            dummy_file = tmp_path / "src.pdf"
            dummy_file.write_text("dummy pdf content")
            
            storage_id = storage.save(str(dummy_file), "saved.pdf")
            assert storage_id == "saved.pdf"
            assert (storage_dir / "saved.pdf").exists()
            assert storage.exists("saved.pdf")
            
            storage.delete("saved.pdf")
            assert not (storage_dir / "saved.pdf").exists()

    @patch("boto3.client")
    def test_s3_storage_upload(self, mock_boto, mock_db):
        with patch("app.core.config.settings.S3_BUCKET_NAME", "test-bucket"):
            storage = S3Storage()
            mock_client = mock_boto.return_value
            
            storage.save("local.pdf", "remote.pdf")
            mock_client.upload_file.assert_called_with("local.pdf", "test-bucket", "remote.pdf")
            
            mock_client.generate_presigned_url.return_value = "http://s3/url"
            url = storage.get_url("remote.pdf")
            assert url == "http://s3/url"

class TestProposalAudit:
    @pytest.fixture(autouse=True)
    def maybe_mock_deps(self):
        """Localized mocking for unit tests if real dependencies are missing."""
        if not is_weasyprint_available():
            with patch.dict(sys.modules, {"weasyprint": MagicMock()}):
                yield
        else:
            yield

    def test_audit_rollback_on_failure(self, mock_db, mock_storage):
        service = ProposalService(mock_db, storage=mock_storage, tenant_id=uuid4(), user_id=uuid4())
        
        # Mock design/tender to pass enough for audit
        design = SiteDesign(id=uuid4(), tender_id=uuid4(), created_by=uuid4(), system_size_kwp=0.0)
        tender = Tender(id=uuid4(), tenant_id=uuid4(), latitude=0.0, longitude=0.0)
        mock_db.query.return_value.filter.return_value.first.side_effect = [design, tender, None, None]
        
        # Make commit fail during audit
        mock_db.commit.side_effect = Exception("DB Fail")
        
        # We need to mock HTML.write_pdf to avoid actual PDF generation
        with patch("weasyprint.HTML", create=True), patch("weasyprint.CSS", create=True):
            # This should not raise because of try-except in service
            storage_id = service.generate_pdf(uuid4())
            
            assert storage_id is not None
            # Rollback should have been called
            assert mock_db.rollback.called

@pytest.mark.asyncio
async def test_api_export_csv_auth_check():
    # Test the API endpoint logic for CSV export
    from app.main import app
    from fastapi.testclient import TestClient
    from app.core.security import get_current_user, CurrentUser
    
    # Mock user and current_user dependency
    mock_user = MagicMock()
    mock_user.id = uuid4()
    mock_user.tenant_id = uuid4()
    mock_user.role = "admin"
    
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(user=mock_user, tenant_id=str(mock_user.tenant_id))
    
    with patch("app.api.proposals.ProposalService") as MockService:
        mock_instance = MockService.return_value
        mock_instance.generate_bom_csv.return_value = "cat,desc\nm,p1"
        
        client = TestClient(app)
        response = client.get(f"/api/site-designs/{uuid4()}/export-csv")
        
        assert response.status_code == 200
        assert "attachment; filename=bom_design_" in response.headers["Content-Disposition"]
        assert "cat,desc" in response.text
    
    app.dependency_overrides = {}


# --- Integration Tests ---

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import get_db
from app.core.security import get_current_user, CurrentUser
from app.services.tasks import generate_proposal_task
from app.models.models import Base, User, Tenant, BOQItem, EquipmentModule, EquipmentInverter, AuditLog, EnergyEstimate, FinancialAnalysis
from app.core.celery_app import celery_app

# Force Celery to run tasks synchronously in tests
celery_app.conf.task_always_eager = True
celery_app.conf.task_eager_propagates = True

# In-memory DB for integration testing
SQLALCHEMY_DATABASE_URL = "sqlite://"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, expire_on_commit=False)

# Global test IDs
TEST_TENANT_A_ID = uuid4()
TEST_USER_A_ID = uuid4()
TEST_USER_C_ID = uuid4() # Same tenant as A
TEST_TENANT_B_ID = uuid4()
TEST_USER_B_ID = uuid4()

# Context for which user is "current"
current_user_context = {"user_id": TEST_USER_A_ID, "tenant_id": TEST_TENANT_A_ID}

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

def override_get_current_user():
    _uid = current_user_context["user_id"]
    _tid = current_user_context["tenant_id"]
    
    class MockUser:
        id = _uid
        email = "test@example.com"
        tenant_id = _tid
        role = "admin"
        permission_level = 10
        
    return CurrentUser(
        user=MockUser(),
        tenant_id=str(_tid)
    )

@pytest.fixture(autouse=True)
def patch_task_session():
    """Patch SessionLocal in database module to use testing DB."""
    with patch("app.core.database.SessionLocal", TestingSessionLocal):
        yield

@pytest.fixture(autouse=True)
def setup_integration_db():
    """Wipe and recreate schema for every integration test."""
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    # Create Tenant and Users for A
    tenant_a = Tenant(id=TEST_TENANT_A_ID, name="Tenant A")
    user_a = User(id=TEST_USER_A_ID, tenant_id=TEST_TENANT_A_ID, email="a@test.com", firebase_uid="uid_a")
    user_c = User(id=TEST_USER_C_ID, tenant_id=TEST_TENANT_A_ID, email="c@test.com", firebase_uid="uid_c")
    
    # Create Tenant and User B
    tenant_b = Tenant(id=TEST_TENANT_B_ID, name="Tenant B")
    user_b = User(id=TEST_USER_B_ID, tenant_id=TEST_TENANT_B_ID, email="b@test.com", firebase_uid="uid_b")
    
    db.add_all([tenant_a, user_a, user_c, tenant_b, user_b])
    db.commit()
    db.close()
    
    # Setup overrides
    original_db = app.dependency_overrides.get(get_db)
    original_user = app.dependency_overrides.get(get_current_user)
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    
    yield
    
    # Restore overrides
    if original_db: app.dependency_overrides[get_db] = original_db
    else: app.dependency_overrides.pop(get_db, None)
    
    if original_user: app.dependency_overrides[get_current_user] = original_user
    else: app.dependency_overrides.pop(get_current_user, None)
    
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def proposal_test_data(setup_integration_db):
    """Fixture to create standard test data for proposal integration."""
    db = TestingSessionLocal()
    
    current_user_context["user_id"] = TEST_USER_A_ID
    current_user_context["tenant_id"] = TEST_TENANT_A_ID
    
    # 1. Tender
    tender = Tender(id=uuid4(), tenant_id=TEST_TENANT_A_ID, created_by=TEST_USER_A_ID, name="Proposal Integration Tender")
    db.add(tender)
    
    # 2. Equipment
    mod = EquipmentModule(
        id=uuid4(), manufacturer="RealMod", model="X1", wattage=400, efficiency=20.0,
        length_m=2.0, width_m=1.0, thickness_m=0.04, voc=48.0, isc=10.0, vmp=40.0, imp=10.0,
        is_global=True, is_active=True
    )
    inv = EquipmentInverter(
        id=uuid4(), manufacturer="RealInv", model="Y1", capacity_kw=10.0,
        max_dc_voltage=1000, mppt_voltage_range_min=200, mppt_voltage_range_max=800,
        max_input_current=20, num_mppt_channels=2, is_global=True, is_active=True
    )
    db.add_all([mod, inv])
    
    # 3. Site Design
    design = SiteDesign(
        id=uuid4(), tender_id=tender.id, name="Integration Design", site_type="rooftop",
        created_by=TEST_USER_A_ID, site_boundary={"type": "Polygon", "coordinates": [[[0,0], [10,0], [10,10], [0,10], [0,0]]]},
        equipment_module_id=mod.id, equipment_inverter_id=inv.id, tilt_deg=20, azimuth_deg=180,
        system_size_kwp=40.0, total_modules=100
    )
    db.add(design)
    
    # 4. BOQ Items
    boq1 = BOQItem(tender_id=tender.id, category="Modules", description="P1", unit_cost=200.0, quantity=100, margin_pct=10.0, line_total=22000.0)
    boq2 = BOQItem(tender_id=tender.id, category="Inverters", description="I1", unit_cost=2000.0, quantity=1, margin_pct=10.0, line_total=2200.0)
    db.add_all([boq1, boq2])
    
    # 5. Energy Estimate (10,000 kWh/year)
    est = EnergyEstimate(
        site_design_id=design.id, parameter_hash="hash1", system_capacity_kw=40.0,
        latitude=0.0, longitude=0.0, azimuth=180, tilt=20,
        annual_energy_kwh=10000.0, monthly_energy_kwh=[800]*12, capacity_factor=2.85,
        status="completed"
    )
    db.add(est)
    
    # 6. Financial Analysis
    fin = FinancialAnalysis(
        site_design_id=design.id, system_cost_usd=24200.0, 
        electricity_rate_usd_per_kwh=0.12, annual_savings_usd=1200.0,
        simple_payback_years=20.17, roi_pct=24.0, calculated_at=datetime.now()
    )
    db.add(fin)
    
    db.commit()
    data = {
        "tender_id": tender.id,
        "design_id": design.id,
        "energy_id": est.id,
        "fin_id": fin.id,
        "mod_id": mod.id,
        "inv_id": inv.id
    }
    db.close()
    return data


@pytest.mark.integration
class TestProposalGenerationIntegration:
    @pytest.mark.skipif(not is_weasyprint_available(), reason="WeasyPrint (or GObject) not available")
    def test_full_pdf_generation_flow_with_celery_task(self, proposal_test_data):
        design_id = proposal_test_data["design_id"]
        options = {"include_cover": True, "include_energy": True}
        
        # 1. Trigger via API
        client = TestClient(app)
        response = client.post(f"/api/site-designs/{design_id}/proposal", json=options)
        assert response.status_code == 202
        task_id = response.json()["task_id"]
        
        # 2. Execute Task Synchronously
        # Mock self for Celery task
        mock_self = MagicMock()
        mock_self.request.retries = 0
        mock_self.max_retries = 3
        
        result = generate_proposal_task.run(str(design_id), options)
        
        assert result["status"] == "success"
        assert "result_url" in result
        storage_id = result["storage_id"]
        
        # 3. Verify storage (local backend default in tests)
        storage = get_storage_backend()
        assert storage.exists(storage_id)
        
        # Cleanup
        storage.delete(storage_id)

    @pytest.mark.skipif(not is_weasyprint_available(), reason="WeasyPrint (or GObject) not available")
    @pytest.mark.slow
    def test_pdf_generation_with_all_sections_enabled(self, proposal_test_data):
        design_id = proposal_test_data["design_id"]
        options = {
            "include_cover": True, "include_site_map": True, "include_specs": True,
            "include_energy": True, "include_financials": True, "include_equipment": True
        }
        
        mock_self = MagicMock()
        result = generate_proposal_task.run(str(design_id), options)
        assert result["status"] == "success"
        
        # Verify it's a real PDF
        storage = get_storage_backend()
        path = os.path.join(os.environ.get("PROPOSAL_LOCAL_DIR", "storage/proposals"), result["storage_id"])
        if os.path.exists(path):
            with open(path, "rb") as f:
                header = f.read(5)
                assert header == b"%PDF-"
        
        storage.delete(result["storage_id"])

@pytest.mark.integration
class TestProposalAPIEndpoints:
    def test_generate_proposal_endpoint_authentication(self, proposal_test_data):
        design_id = proposal_test_data["design_id"]
        
        # Temporarily remove override
        original = app.dependency_overrides.pop(get_current_user)
        try:
            client = TestClient(app)
            response = client.post(f"/api/site-designs/{design_id}/proposal", json={})
            assert response.status_code == 401 # No bearer token
        finally:
            app.dependency_overrides[get_current_user] = original

    def test_csv_export_endpoint_success(self, proposal_test_data):
        design_id = proposal_test_data["design_id"]
        client = TestClient(app)
        response = client.get(f"/api/site-designs/{design_id}/export-csv")
        
        assert response.status_code == 200
        assert "text/plain" in response.headers["content-type"]
        assert "attachment; filename=bom_design_" in response.headers["content-disposition"]
        
        # Parse CSV
        content = response.text
        lines = content.strip().split("\n")
        assert len(lines) == 3 # Header + 2 items
        assert "Modules,P1" in lines[1]
        assert "Inverters,I1" in lines[2]

    def test_csv_export_endpoint_empty_boq(self, proposal_test_data):
        design_id = proposal_test_data["design_id"]
        tender_id = proposal_test_data["tender_id"]
        
        db = TestingSessionLocal()
        db.query(BOQItem).filter(BOQItem.tender_id == tender_id).delete()
        db.commit()
        db.close()
        
        client = TestClient(app)
        response = client.get(f"/api/site-designs/{design_id}/export-csv")
        assert response.status_code == 200
        lines = response.text.strip().split("\n")
        assert len(lines) == 1 # Only header


@pytest.mark.integration
class TestTaskStatusPolling:
    def test_task_status_polling_pending(self):
        task_id = str(uuid4())
        with patch("app.api.proposals.AsyncResult") as mock_result:
            mock_result.return_value.status = "PENDING"
            mock_result.return_value.id = task_id
            
            client = TestClient(app)
            response = client.get(f"/api/tasks/{task_id}")
            assert response.status_code == 200
            assert response.json()["status"] == "PENDING"

    def test_task_status_polling_success(self, proposal_test_data):
        task_id = str(uuid4())
        with patch("app.api.proposals.AsyncResult") as mock_result:
            mock_result.return_value.status = "SUCCESS"
            mock_result.return_value.result = {"status": "success", "result_url": "http://ok"}
            
            client = TestClient(app)
            response = client.get(f"/api/tasks/{task_id}")
            assert response.status_code == 200
            assert response.json()["status"] == "SUCCESS"
            assert response.json()["result_url"] == "http://ok"

    def test_task_status_polling_failure(self):
        """Test the polling endpoint with a failed task result."""
        task_id = str(uuid4())
        with patch("app.api.proposals.AsyncResult") as mock_result:
            mock_result.return_value.status = "FAILURE"
            mock_result.return_value.result = Exception("PDF generation failed due to template error")
            mock_result.return_value.failed.return_value = True
            mock_result.return_value.successful.return_value = False
            
            client = TestClient(app)
            response = client.get(f"/api/tasks/{task_id}")
            assert response.status_code == 200
            assert response.json()["status"] == "FAILURE"
            assert "PDF generation failed" in response.json()["error"]

    def test_task_status_polling_failure(self):
        """Test the polling endpoint with a failed task result."""
        task_id = str(uuid4())
        with patch("app.api.proposals.AsyncResult") as mock_result:
            mock_result.return_value.status = "FAILURE"
            mock_result.return_value.result = Exception("PDF generation failed due to template error")
            mock_result.return_value.failed.return_value = True
            mock_result.return_value.successful.return_value = False
            
            client = TestClient(app)
            response = client.get(f"/api/tasks/{task_id}")
            assert response.status_code == 200
            assert response.json()["status"] == "FAILURE"
            assert "PDF generation failed" in response.json()["error"]

@pytest.mark.integration
class TestProposalModelIntegration:
    @pytest.mark.skipif(not is_weasyprint_available(), reason="WeasyPrint required for PDF tasks")
    def test_proposal_with_missing_energy_estimate(self, proposal_test_data):
        design_id = proposal_test_data["design_id"]
        db = TestingSessionLocal()
        db.query(EnergyEstimate).filter(EnergyEstimate.site_design_id == design_id).delete()
        db.commit()
        db.close()
        
        mock_self = MagicMock()
        result = generate_proposal_task.run(str(design_id), {})
        assert result["status"] == "success"

    @pytest.mark.skipif(not is_weasyprint_available(), reason="WeasyPrint required for PDF tasks")
    def test_proposal_with_failed_energy_estimate(self, proposal_test_data):
        design_id = proposal_test_data["design_id"]
        db = TestingSessionLocal()
        est = db.query(EnergyEstimate).filter(EnergyEstimate.site_design_id == design_id).first()
        est.status = "failed"
        db.commit()
        db.close()
        
        mock_self = MagicMock()
        result = generate_proposal_task.run(str(design_id), {})
        assert result["status"] == "success"

@pytest.mark.integration
class TestProposalStorageIntegration:
    def test_local_storage_backend_selection(self):
        with patch("app.services.storage.settings.PROPOSAL_STORAGE_BACKEND", "local"):
            storage = get_storage_backend()
            assert isinstance(storage, LocalFileStorage)

    @patch("boto3.client")
    def test_s3_storage_backend_selection(self, mock_boto):
        with patch("app.services.storage.settings.PROPOSAL_STORAGE_BACKEND", "s3"):
            storage = get_storage_backend()
            assert isinstance(storage, S3Storage)

@pytest.mark.integration
class TestProposalTenantIsolation:
    def test_cross_tenant_proposal_generation_blocked(self, proposal_test_data):
        """Verify that a user from a different tenant cannot trigger proposal generation."""
        design_id = proposal_test_data["design_id"]
        
        # Switch context to User B (Tenant B)
        current_user_context["user_id"] = TEST_USER_B_ID
        current_user_context["tenant_id"] = TEST_TENANT_B_ID
        
        client = TestClient(app)
        response = client.post(f"/api/site-designs/{design_id}/proposal", json={})
        
        assert response.status_code == 404

    def test_cross_tenant_csv_export_blocked(self, proposal_test_data):
        design_id = proposal_test_data["design_id"]
        current_user_context["user_id"] = TEST_USER_B_ID
        current_user_context["tenant_id"] = TEST_TENANT_B_ID
        
        client = TestClient(app)
        response = client.get(f"/api/site-designs/{design_id}/export-csv")
        assert response.status_code == 404

    @pytest.mark.skipif(not is_weasyprint_available(), reason="WeasyPrint required for PDF tasks")
    def test_audit_log_records_correct_tenant_and_user(self, proposal_test_data):
        design_id = proposal_test_data["design_id"]
        mock_self = MagicMock()
        generate_proposal_task.run(str(design_id), {})
        
        db = TestingSessionLocal()
        log = db.query(AuditLog).filter(
            AuditLog.entity_type == "Proposal",
            AuditLog.action == "generate_pdf"
        ).first()
        
        assert log is not None
        assert log.tenant_id == TEST_TENANT_A_ID
        assert log.user_id == TEST_USER_A_ID
        db.close()


@pytest.mark.integration
@pytest.mark.slow
class TestWeasyPrintIntegration:
    def test_real_pdf_generation_with_weasyprint(self, proposal_test_data):
        # Allow real rendering or skip if missing
        try:
            import weasyprint
            from weasyprint import HTML
        except (ImportError, OSError):
            pytest.skip("WeasyPrint not installed or broken (GObject missing), skipping real PDF test")
            
        # Ensure it's not a generic MagicMock from some other test
        if hasattr(weasyprint, "__file__") is False:
             pytest.skip("WeasyPrint is a mock object, skipping real PDF test")
            
        # This tests real rendering without mocks
        design_id = proposal_test_data["design_id"]
        
        result = generate_proposal_task.run(str(design_id), {})
        assert result["status"] == "success"
        
        storage = get_storage_backend()
        path = os.path.join(os.environ.get("PROPOSAL_LOCAL_DIR", "storage/proposals"), result["storage_id"])
        
        assert os.path.exists(path)
        with open(path, "rb") as f:
            content = f.read()
            assert b"%PDF-" in content
            assert len(content) > 1000 # Should be > 1KB
            
        storage.delete(result["storage_id"])

@pytest.mark.integration
class TestProposalErrorHandling:
    def test_proposal_generation_with_invalid_design_id(self):
        mock_self = MagicMock()
        invalid_id = str(uuid4())
        result = generate_proposal_task.run(invalid_id, {})
        assert result["status"] == "error"
        assert "not found" in result["message"].lower()

    def test_csv_export_with_special_characters(self, proposal_test_data):
        tender_id = proposal_test_data["tender_id"]
        design_id = proposal_test_data["design_id"]
        
        db = TestingSessionLocal()
        item = BOQItem(
            tender_id=tender_id, category="Special", 
            description='Description with "quotes", commas, and \n newlines', 
            unit_cost=100.0, quantity=1, margin_pct=0, line_total=100.0
        )
        db.add(item)
        db.commit()
        db.close()
        
        client = TestClient(app)
        response = client.get(f"/api/site-designs/{design_id}/export-csv")
        assert response.status_code == 200
        assert 'Description with ""quotes"", commas' in response.text or 'Description with "quotes", commas' in response.text
        # CSV writers usually quote fields with commas

# --- Utilities ---

def cleanup_generated_files():
    """Helper to remove test PDFs from local storage."""
    storage_dir = os.environ.get("PROPOSAL_LOCAL_DIR", "storage/proposals")
    if os.path.exists(storage_dir):
        for f in os.listdir(storage_dir):
            if f.endswith(".pdf"):
                try:
                    os.remove(os.path.join(storage_dir, f))
                except:
                    pass

@pytest.fixture(scope="session", autouse=True)
def session_cleanup():
    yield
    cleanup_generated_files()
