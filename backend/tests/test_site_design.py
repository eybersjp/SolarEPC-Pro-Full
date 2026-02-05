
import pytest
from unittest.mock import patch, MagicMock
from uuid import uuid4, UUID
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient
from fastapi import status, HTTPException

from app.main import app
from app.core.database import Base, get_db
from app.core.security import get_current_user, CurrentUser
from app.models.models import (
    Tenant, User, UserRole, Tender, SiteDesign,
    EquipmentModule, EquipmentInverter, AuditLog
)
from app.services.site_design import SiteDesignService
from app.schemas.site_design import (
    SiteTypeEnum, ModuleOrientationEnum, PlacementSettings
)

# === Fixtures & Setup ===

SQLALCHEMY_DATABASE_URL = "sqlite://"

@pytest.fixture
def db():
    # Create in-memory SQLite database for each test
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    Base.metadata.create_all(bind=engine)
    db_session = TestingSessionLocal()
    try:
        yield db_session
    finally:
        db_session.close()
        Base.metadata.drop_all(bind=engine)

@pytest.fixture
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides = {}

@pytest.fixture
def test_data(db):
    # Create Tenant
    tenant = Tenant(name="Test Tenant")
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    
    # Create User (ADMIN)
    user = User(
        email="admin@test.com",
        name="Admin User",
        role=UserRole.ADMIN,
        tenant_id=tenant.id,
        is_active=True,
        firebase_uid="uid_admin"
    )
    db.add(user)
    db.commit() # commit user to get ID
    
    # Create Equipment
    module = EquipmentModule(
        manufacturer="TestSolar",
        model="TS-400",
        wattage=400,
        efficiency=20.0,
        length_m=2.0,
        width_m=1.0,
        thickness_m=0.04,
        voc=40.0, isc=10.0, vmp=32.0, imp=9.0,
        is_global=True,
        is_active=True
    )
    inverter = EquipmentInverter(
        manufacturer="TestInv",
        model="TI-100",
        capacity_kw=100.0,
        max_dc_voltage=1000.0,
        mppt_voltage_range_min=200.0,
        mppt_voltage_range_max=800.0,
        max_input_current=100.0,
        num_mppt_channels=10,
        is_global=True,
        is_active=True
    )
    db.add(module)
    db.add(inverter)
    
    # Create Tender
    tender = Tender(
        name="Test Tender",
        client_name="Test Client",
        tenant_id=tenant.id,
        created_by=user.id,
        status="draft"
    )
    db.add(tender)
    
    db.commit()
    return {
        "tenant": tenant,
        "user": user,
        "module": module,
        "inverter": inverter,
        "tender": tender
    }

@pytest.fixture
def test_user_pm(db, test_data):
    user = User(
        email="pm@test.com",
        name="PM User",
        role=UserRole.PM,
        tenant_id=test_data["tenant"].id,
        is_active=True,
        firebase_uid="uid_pm"
    )
    db.add(user)
    db.commit()
    return user

@pytest.fixture
def test_user_viewer(db, test_data):
    user = User(
        email="viewer@test.com",
        name="Viewer User",
        role=UserRole.VIEWER,
        tenant_id=test_data["tenant"].id,
        is_active=True,
        firebase_uid="uid_viewer"
    )
    db.add(user)
    db.commit()
    return user

@pytest.fixture
def test_user_engineer(db, test_data):
    user = User(
        email="engineer@test.com",
        name="Engineer User",
        role=UserRole.ENGINEER,
        tenant_id=test_data["tenant"].id,
        is_active=True,
        firebase_uid="uid_engineer"
    )
    db.add(user)
    db.commit()
    return user

def mock_current_user(user):
    return CurrentUser(user=user, tenant_id=str(user.tenant_id))

# === Service Layer Tests ===

class TestSiteDesignService:

    def get_service(self, db, test_data, user=None):
        if user is None:
            user = test_data["user"]
        return SiteDesignService(db, test_data["tenant"].id, user.id)

    # 1. CRUD Operations
    
    def test_create_design_success(self, db, test_data):
        service = self.get_service(db, test_data)
        
        # Valid closed polygon
        boundary = {
            "type": "Polygon",
            "coordinates": [[[0,0], [0,1], [1,1], [1,0], [0,0]]]
        }
        
        settings = PlacementSettings(row_spacing_m=2.5) # Default tilt should apply
        
        design = service.create_design(
            tender_id=test_data["tender"].id,
            name="Test Design",
            site_type=SiteTypeEnum.GROUND_MOUNT,
            equipment_module_id=test_data["module"].id,
            equipment_inverter_id=test_data["inverter"].id,
            site_boundary=boundary,
            placement_settings=settings.model_dump()
        )
        
        assert design.id is not None
        assert design.name == "Test Design"
        assert design.site_area_sqm > 0
        assert design.placement_settings["tilt_deg"] == 20.0 # Default for ground_mount
        
        # Verify audit log
        db.flush()
        log = db.query(AuditLog).filter(AuditLog.entity_id == design.id).first()
        if log is None:
            all_logs = db.query(AuditLog).all()
            print(f"All logs: {[ (l.action, str(l.entity_id)) for l in all_logs ]}")
            print(f"Searching for design.id: {str(design.id)}")
            
        assert log is not None
        assert log.action == "create"
        
    def test_create_design_custom_tilt(self, db, test_data):
        service = self.get_service(db, test_data)
        boundary = {"type": "Polygon", "coordinates": [[[0,0], [0,1], [1,1], [1,0], [0,0]]]}
        settings = {"tilt_deg": 15.0}
        
        design = service.create_design(
            tender_id=test_data["tender"].id,
            name="Tilt Test",
            site_type=SiteTypeEnum.GROUND_MOUNT,
            equipment_module_id=test_data["module"].id,
            equipment_inverter_id=test_data["inverter"].id,
            site_boundary=boundary,
            placement_settings=settings
        )
        assert design.placement_settings["tilt_deg"] == 15.0

    def test_get_design(self, db, test_data):
        service = self.get_service(db, test_data)
        boundary = {"type": "Polygon", "coordinates": [[[0,0], [0,1], [1,1], [1,0], [0,0]]]}
        design = service.create_design(
            tender_id=test_data["tender"].id,
            name="Get Test",
            site_type=SiteTypeEnum.ROOFTOP,
            equipment_module_id=test_data["module"].id,
            equipment_inverter_id=test_data["inverter"].id,
            site_boundary=boundary,
            placement_settings={}
        )
        
        fetched = service.get_design_or_404(design.id)
        assert fetched.id == design.id
        assert fetched.name == "Get Test"

    def test_get_design_404(self, db, test_data):
        service = self.get_service(db, test_data)
        with pytest.raises(HTTPException) as exc:
            service.get_design_or_404(uuid4())
        assert exc.value.status_code == 404

    def test_list_designs(self, db, test_data):
        service = self.get_service(db, test_data)
        boundary = {"type": "Polygon", "coordinates": [[[0,0], [0,1], [1,1], [1,0], [0,0]]]}
        
        service.create_design(test_data["tender"].id, "Design 1", SiteTypeEnum.GROUND_MOUNT, 
                            test_data["module"].id, test_data["inverter"].id, boundary, {})
        service.create_design(test_data["tender"].id, "Design 2", SiteTypeEnum.GROUND_MOUNT, 
                            test_data["module"].id, test_data["inverter"].id, boundary, {})
                            
        designs = service.list_designs(test_data["tender"].id)
        assert len(designs) == 2
        # Verify descending order by created_at (Design 2 created last should be first)
        assert designs[0].name == "Design 2"

    def test_update_geometry(self, db, test_data):
        service = self.get_service(db, test_data)
        boundary_small = {"type": "Polygon", "coordinates": [[[0,0], [0,1], [1,1], [1,0], [0,0]]]}
        boundary_large = {"type": "Polygon", "coordinates": [[[0,0], [0,2], [2,2], [2,0], [0,0]]]}
        
        design = service.create_design(test_data["tender"].id, "Geo Test", SiteTypeEnum.GROUND_MOUNT,
                                     test_data["module"].id, test_data["inverter"].id, boundary_small, {})
        original_area = design.site_area_sqm
        
        updated = service.update_geometry(design, site_boundary=boundary_large)
        db.flush() # Ensure update persists
        assert updated.site_area_sqm > original_area
        
        log = db.query(AuditLog).filter(
            AuditLog.entity_id == design.id,
            AuditLog.action == "update"
        ).order_by(AuditLog.created_at.desc()).first()
        
        assert log is not None
        assert log.entity_type == "SiteDesign"
        assert "site_boundary" in log.old_value
        assert "site_boundary" in log.new_value
        assert log.new_value["site_boundary"] == boundary_large

    def test_update_exclusion_zones(self, db, test_data):
        service = self.get_service(db, test_data)
        boundary = {"type": "Polygon", "coordinates": [[[0,0], [0,10], [10,10], [10,0], [0,0]]]}
        exclusion = [{"type": "Polygon", "coordinates": [[[2,2], [2,3], [3,3], [3,2], [2,2]]]}]
        
        design = service.create_design(test_data["tender"].id, "Excl Test", SiteTypeEnum.GROUND_MOUNT,
                                     test_data["module"].id, test_data["inverter"].id, boundary, {})
        
        updated = service.update_geometry(design, exclusion_zones=exclusion)
        db.flush()
        assert len(updated.exclusion_zones) == 1
        
        log = db.query(AuditLog).filter(
            AuditLog.entity_id == design.id,
            AuditLog.action == "update"
        ).order_by(AuditLog.created_at.desc()).first()
        
        assert log is not None
        assert "exclusion_zones" in log.new_value
        assert log.new_value["exclusion_zones"] == exclusion
        
    def test_update_settings(self, db, test_data):
        service = self.get_service(db, test_data)
        boundary = {"type": "Polygon", "coordinates": [[[0,0], [0,1], [1,1], [1,0], [0,0]]]}
        design = service.create_design(test_data["tender"].id, "Settings Test", SiteTypeEnum.GROUND_MOUNT,
                                     test_data["module"].id, test_data["inverter"].id, boundary, {})
                                     
        new_settings = {"row_spacing_m": 5.0, "tilt_deg": 30.0}
        updated = service.update_settings(design, new_settings)
        db.flush()
        
        assert updated.placement_settings["row_spacing_m"] == 5.0
        assert updated.placement_settings["tilt_deg"] == 30.0
        
        log = db.query(AuditLog).filter(
            AuditLog.entity_id == design.id,
            AuditLog.action == "update"
        ).order_by(AuditLog.created_at.desc()).first()
        
        assert log is not None
        assert log.new_value["row_spacing_m"] == 5.0
        assert log.new_value["tilt_deg"] == 30.0
        assert "row_spacing_m" in log.old_value

    def test_update_equipment(self, db, test_data):
        service = self.get_service(db, test_data)
        boundary = {"type": "Polygon", "coordinates": [[[0,0], [0,1], [1,1], [1,0], [0,0]]]}
        design = service.create_design(test_data["tender"].id, "Equip Test", SiteTypeEnum.GROUND_MOUNT,
                                     test_data["module"].id, test_data["inverter"].id, boundary, {})
        
        # Create new equipment
        new_module = EquipmentModule(
            manufacturer="New", model="Mod2", wattage=500, efficiency=21.0, 
            length_m=2, width_m=1, thickness_m=0.04, voc=50, isc=12, vmp=40, imp=10, 
            is_global=True, is_active=True
        )
        db.add(new_module)
        db.commit()
        
        updated = service.update_equipment(design, equipment_module_id=new_module.id)
        db.flush()
        assert updated.equipment_module_id == new_module.id
        
        log = db.query(AuditLog).filter(
            AuditLog.entity_id == design.id,
            AuditLog.action == "update"
        ).order_by(AuditLog.created_at.desc()).first()
        
        assert log is not None
        assert log.new_value["equipment_module_id"] == str(new_module.id)
        assert "equipment_module_id" in log.old_value

    def test_delete_design(self, db, test_data):
        service = self.get_service(db, test_data)
        boundary = {"type": "Polygon", "coordinates": [[[0,0], [0,1], [1,1], [1,0], [0,0]]]}
        design = service.create_design(test_data["tender"].id, "Delete Test", SiteTypeEnum.GROUND_MOUNT,
                                     test_data["module"].id, test_data["inverter"].id, boundary, {})
                                     
        service.delete_design(design)
        db.flush() # Need flush to effect delete in session query
        
        deleted = db.query(SiteDesign).filter(SiteDesign.id == design.id).first()
        assert deleted is None
        
        log = db.query(AuditLog).filter(
            AuditLog.entity_id == design.id, 
            AuditLog.action == "delete"
        ).first()
        assert log is not None
        assert log.entity_type == "SiteDesign"
        assert log.old_value["name"] == "Delete Test"

    # 2. GeoJSON Validation
    
    def test_geojson_polygon_not_closed(self, db, test_data):
        service = self.get_service(db, test_data)
        # Not closed (last point != first point)
        boundary = {"type": "Polygon", "coordinates": [[[0,0], [0,1], [1,1], [1,0]]]}
        
        with pytest.raises(HTTPException) as exc:
            service.create_design(test_data["tender"].id, "Bad Poly", SiteTypeEnum.GROUND_MOUNT,
                                test_data["module"].id, test_data["inverter"].id, boundary, {})
        assert exc.value.status_code == 400
        assert "must be closed" in str(exc.value.detail)

    def test_geojson_min_vertices(self, db, test_data):
        service = self.get_service(db, test_data)
        # Triangle but not closed effectively (needs 4 coords for closed triangle: A-B-C-A)
        boundary = {"type": "Polygon", "coordinates": [[[0,0], [0,1], [1,0]]]}
        
        with pytest.raises(HTTPException) as exc:
            service.create_design(test_data["tender"].id, "Bad Poly", SiteTypeEnum.GROUND_MOUNT,
                                test_data["module"].id, test_data["inverter"].id, boundary, {})
        assert exc.value.status_code == 400
        assert "at least 3 vertices" in str(exc.value.detail) or "closed" in str(exc.value.detail)

    def test_geojson_invalid_coordinates(self, db, test_data):
        service = self.get_service(db, test_data)
        boundary = {"type": "Polygon", "coordinates": [[[0,0], [0,200], [1,1], [0,0]]]} # Lat 200 invalid
        
        with pytest.raises(HTTPException) as exc:
            service.create_design(test_data["tender"].id, "Bad Poly", SiteTypeEnum.GROUND_MOUNT,
                                test_data["module"].id, test_data["inverter"].id, boundary, {})
        assert exc.value.status_code == 400
        assert "Invalid coordinate" in str(exc.value.detail)

    def test_geojson_self_intersecting(self, db, test_data):
        service = self.get_service(db, test_data)
        # Bowtie shape (self-intersecting)
        boundary = {"type": "Polygon", "coordinates": [[[0,0], [1,1], [0,1], [1,0], [0,0]]]}
        
        with pytest.raises(HTTPException) as exc:
            service.create_design(test_data["tender"].id, "Bad Poly", SiteTypeEnum.GROUND_MOUNT,
                                test_data["module"].id, test_data["inverter"].id, boundary, {})
        assert exc.value.status_code == 400
        assert "Invalid geometry" in str(exc.value.detail)

    def test_geojson_invalid_type(self, db, test_data):
        service = self.get_service(db, test_data)
        boundary = {"type": "Point", "coordinates": [0,0]}
        
        with pytest.raises(HTTPException) as exc:
            service.create_design(test_data["tender"].id, "Bad Poly", SiteTypeEnum.GROUND_MOUNT,
                                test_data["module"].id, test_data["inverter"].id, boundary, {})
        assert exc.value.status_code == 400

    def test_geojson_empty_coords(self, db, test_data):
        service = self.get_service(db, test_data)
        boundary = {"type": "Polygon", "coordinates": []}
        
        with pytest.raises(HTTPException) as exc:
            service.create_design(test_data["tender"].id, "Bad Poly", SiteTypeEnum.GROUND_MOUNT,
                                test_data["module"].id, test_data["inverter"].id, boundary, {})
        assert exc.value.status_code == 400

    # 3. Area Calculation
    
    def test_area_calculation_accuracy(self, db, test_data):
        service = self.get_service(db, test_data)
        # 1 degree approx 111km. 0.001 deg approx 111m.
        # Square of 0.001 x 0.001 deg at equator approx 111m x 111m = 12,321 sqm
        boundary = {"type": "Polygon", "coordinates": [[[0,0], [0,0.001], [0.001,0.001], [0.001,0], [0,0]]]}
        
        design = service.create_design(test_data["tender"].id, "Area Test", SiteTypeEnum.GROUND_MOUNT,
                                     test_data["module"].id, test_data["inverter"].id, boundary, {})
        
        # Allow 5% tolerance due to projection
        expected = 12321
        assert expected * 0.95 <= design.site_area_sqm <= expected * 1.05

    # 4. Equipment Validation
    
    def test_invalid_module_id(self, db, test_data):
        service = self.get_service(db, test_data)
        boundary = {"type": "Polygon", "coordinates": [[[0,0], [0,1], [1,1], [1,0], [0,0]]]}
        
        with pytest.raises(HTTPException) as exc:
            service.create_design(
                test_data["tender"].id, "Bad Equip", SiteTypeEnum.GROUND_MOUNT,
                uuid4(), test_data["inverter"].id, boundary, {}
            )
        assert exc.value.status_code == 400
        assert "Equipment Module" in str(exc.value.detail)

    def test_inactive_equipment(self, db, test_data):
        service = self.get_service(db, test_data)
        boundary = {"type": "Polygon", "coordinates": [[[0,0], [0,1], [1,1], [1,0], [0,0]]]}
        
        inactive_mod = EquipmentModule(
            manufacturer="Inactive", model="X", wattage=100, efficiency=10, 
            length_m=1, width_m=1, thickness_m=0.1, voc=10, isc=1, vmp=10, imp=1,
            is_global=True, is_active=False
        )
        db.add(inactive_mod)
        db.commit()
        
        with pytest.raises(HTTPException) as exc:
            service.create_design(
                test_data["tender"].id, "Bad Equip", SiteTypeEnum.GROUND_MOUNT,
                inactive_mod.id, test_data["inverter"].id, boundary, {}
            )
        assert exc.value.status_code == 400

    def test_tenant_equipment_access(self, db, test_data):
        service = self.get_service(db, test_data)
        boundary = {"type": "Polygon", "coordinates": [[[0,0], [0,1], [1,1], [1,0], [0,0]]]}
        
        # Create equipment for another tenant
        other_tenant = Tenant(name="Other")
        db.add(other_tenant)
        db.commit()
        
        other_mod = EquipmentModule(
            manufacturer="Other", model="X", wattage=100, efficiency=10,
            length_m=1, width_m=1, thickness_m=0.1, voc=10, isc=1, vmp=10, imp=1,
            tenant_id=other_tenant.id, is_global=False, is_active=True
        )
        db.add(other_mod)
        db.commit()
        
        with pytest.raises(HTTPException) as exc:
            service.create_design(
                test_data["tender"].id, "Bad Equip", SiteTypeEnum.GROUND_MOUNT,
                other_mod.id, test_data["inverter"].id, boundary, {}
            )
        assert exc.value.status_code == 400

    # 5. Tenant Isolation
    
    def test_tenant_isolation_list(self, db, test_data):
        # Create design for tenant A
        boundary = {"type": "Polygon", "coordinates": [[[0,0], [0,1], [1,1], [1,0], [0,0]]]}
        service_a = self.get_service(db, test_data)
        service_a.create_design(test_data["tender"].id, "Design A", SiteTypeEnum.GROUND_MOUNT,
                              test_data["module"].id, test_data["inverter"].id, boundary, {})
        
        # User from tenant B tries to list for tender A (which belongs to tenant A)
        other_tenant = Tenant(name="Other")
        db.add(other_tenant)
        db.commit()
        
        user_b = User(email="b@test.com", name="B", role=UserRole.ADMIN, tenant_id=other_tenant.id, is_active=True, firebase_uid="uid_b")
        db.add(user_b)
        db.commit()
        
        service_b = SiteDesignService(db, other_tenant.id, user_b.id)
        
        # Should fail accessing tender from another tenant
        with pytest.raises(HTTPException) as exc:
            service_b.list_designs(test_data["tender"].id)
        assert exc.value.status_code == 404

    # 6. Audit Logging
    
    def test_audit_log_fields_update(self, db, test_data):
        service = self.get_service(db, test_data)
        boundary = {"type": "Polygon", "coordinates": [[[0,0], [0,1], [1,1], [1,0], [0,0]]]}
        design = service.create_design(test_data["tender"].id, "Audit", SiteTypeEnum.GROUND_MOUNT,
                                     test_data["module"].id, test_data["inverter"].id, boundary, {})
        
        service.update_settings(design, {"tilt_deg": 45.0})
        db.flush() # Ensure flush
        
        log = db.query(AuditLog).filter(
            AuditLog.entity_id == design.id, 
            AuditLog.action == "update"
        ).order_by(AuditLog.created_at.desc()).first()
        
        assert log is not None
        assert "tilt_deg" in str(log.new_value)

    # 7. Additional Service Tests
    
    def test_invalid_inverter_id(self, db, test_data):
        service = self.get_service(db, test_data)
        boundary = {"type": "Polygon", "coordinates": [[[0,0], [0,1], [1,1], [1,0], [0,0]]]}
        
        with pytest.raises(HTTPException) as exc:
            service.create_design(
                test_data["tender"].id, "Bad Equip", SiteTypeEnum.GROUND_MOUNT,
                test_data["module"].id, uuid4(), boundary, {}
            )
        assert exc.value.status_code == 400
        assert "Equipment Inverter" in str(exc.value.detail)

    def test_global_equipment_access(self, db, test_data):
        service = self.get_service(db, test_data)
        boundary = {"type": "Polygon", "coordinates": [[[0,0], [0,1], [1,1], [1,0], [0,0]]]}
        
        # Test that global equipment is accessible
        design = service.create_design(
            test_data["tender"].id, "Global Equip Test", SiteTypeEnum.GROUND_MOUNT,
            test_data["module"].id, test_data["inverter"].id, boundary, {}
        )
        assert design is not None

    def test_get_design_tenant_isolation(self, db, test_data):
        service_a = self.get_service(db, test_data)
        boundary = {"type": "Polygon", "coordinates": [[[0,0], [0,1], [1,1], [1,0], [0,0]]]}
        design = service_a.create_design(test_data["tender"].id, "Design A", SiteTypeEnum.GROUND_MOUNT,
                                       test_data["module"].id, test_data["inverter"].id, boundary, {})
        
        # Another tenant
        other_tenant = Tenant(name="Other")
        db.add(other_tenant)
        db.flush() # Get ID
        user_b = User(email="b@test.com", firebase_uid="b_uid_isolation", tenant_id=other_tenant.id, role=UserRole.ADMIN)
        db.add(user_b)
        db.commit()
        
        service_b = SiteDesignService(db, other_tenant.id, user_b.id)
        assert service_b.get_design(design.id) is None

    def test_update_design_tenant_isolation(self, db, test_data):
        service_a = self.get_service(db, test_data)
        boundary = {"type": "Polygon", "coordinates": [[[0,0], [0,1], [1,1], [1,0], [0,0]]]}
        design = service_a.create_design(test_data["tender"].id, "Design A", SiteTypeEnum.GROUND_MOUNT,
                                       test_data["module"].id, test_data["inverter"].id, boundary, {})
        
        other_tenant = Tenant(name="Other Update")
        db.add(other_tenant)
        db.flush()
        user_b = User(email="b_upd@test.com", firebase_uid="b_uid_upd", tenant_id=other_tenant.id, role=UserRole.ADMIN)
        db.add(user_b)
        db.commit()
        
        service_b = SiteDesignService(db, other_tenant.id, user_b.id)
        # Even if we have the object, get_design_or_404 should fail
        with pytest.raises(HTTPException) as exc:
            service_b.get_design_or_404(design.id)
        assert exc.value.status_code == 404

    def test_audit_log_on_create(self, db, test_data):
        service = self.get_service(db, test_data)
        boundary = {"type": "Polygon", "coordinates": [[[0,0], [0,1], [1,1], [1,0], [0,0]]]}
        design = service.create_design(test_data["tender"].id, "Logged", SiteTypeEnum.GROUND_MOUNT,
                                     test_data["module"].id, test_data["inverter"].id, boundary, {})
        
        db.flush()
        log = db.query(AuditLog).filter(
            AuditLog.entity_id == design.id,
            AuditLog.action == "create"
        ).first()
        assert log is not None
        assert log.entity_type == "SiteDesign"
        assert log.new_value["name"] == "Logged"

    def test_create_design_no_settings_defaults(self, db, test_data):
        service = self.get_service(db, test_data)
        boundary = {"type": "Polygon", "coordinates": [[[0,0], [0,1], [1,1], [1,0], [0,0]]]}
        # placement_settings empty dict
        design = service.create_design(test_data["tender"].id, "Simple", SiteTypeEnum.GROUND_MOUNT,
                                     test_data["module"].id, test_data["inverter"].id, boundary, {})
        assert design.edge_setback_m == 1.0 # default
        assert design.row_spacing_m == 2.0 # default
        assert design.tilt_deg == 20.0 # default for ground_mount

    def test_update_geometry_invalid_type(self, db, test_data):
        service = self.get_service(db, test_data)
        boundary = {"type": "Polygon", "coordinates": [[[0,0], [0,1], [1,1], [1,0], [0,0]]]}
        design = service.create_design(test_data["tender"].id, "Geo", SiteTypeEnum.GROUND_MOUNT,
                                     test_data["module"].id, test_data["inverter"].id, boundary, {})
        
        with pytest.raises(HTTPException) as exc:
            service.update_geometry(design, site_boundary={"type": "Point", "coordinates": [0,0]})
        assert exc.value.status_code == 400

    def test_update_exclusion_zones_invalid_poly(self, db, test_data):
        service = self.get_service(db, test_data)
        boundary = {"type": "Polygon", "coordinates": [[[0,0], [0,1], [1,1], [1,0], [0,0]]]}
        design = service.create_design(test_data["tender"].id, "Geo", SiteTypeEnum.GROUND_MOUNT,
                                     test_data["module"].id, test_data["inverter"].id, boundary, {})
        
        with pytest.raises(HTTPException) as exc:
            service.update_geometry(design, exclusion_zones=[{"type": "Polygon", "coordinates": [[[0,0], [0,1], [1,1]]]}]) # Not closed
        assert exc.value.status_code == 400

    def test_get_design_or_404_failure(self, db, test_data):
        service = self.get_service(db, test_data)
        with pytest.raises(HTTPException) as exc:
            service.get_design_or_404(uuid4())
        assert exc.value.status_code == 404

    def test_create_design_mocks_equipment_library(self, db, test_data):
        # Patch the class itself so when service is instantiated, it uses the mock
        with patch("app.services.site_design.EquipmentLibraryService") as mock_lib_class:
            mock_instance = mock_lib_class.return_value
            service = self.get_service(db, test_data)
            
            boundary = {"type": "Polygon", "coordinates": [[[0,0], [0,1], [1,1], [1,0], [0,0]]]}
            
            service.create_design(
                tender_id=test_data["tender"].id,
                name="Mock Test",
                site_type=SiteTypeEnum.GROUND_MOUNT,
                equipment_module_id=test_data["module"].id,
                equipment_inverter_id=test_data["inverter"].id,
                site_boundary=boundary,
                placement_settings={}
            )
            
            # Assert mock was called with module/inverter IDs
            mock_instance.get_module_or_404.assert_called_with(test_data["module"].id)
            mock_instance.get_inverter_or_404.assert_called_with(test_data["inverter"].id)

# === API Tests ===

class TestSiteDesignAPI:
    
    def test_unauthenticated_request(self, client):
        # We don't override get_current_user, so it should default to real behavior 
        # which expects token. Or we override it to raise 401.
        response = client.get(f"/api/tenders/{uuid4()}/site-designs")
        assert response.status_code == 401

    def test_create_design_api(self, client, db, test_data):
        app.dependency_overrides[get_current_user] = lambda: mock_current_user(test_data["user"])
        
        boundary = {"type": "Polygon", "coordinates": [[[0,0], [0,1], [1,1], [1,0], [0,0]]]}
        payload = {
            "name": "API Design",
            "site_type": "ground_mount",
            "equipment_module_id": str(test_data["module"].id),
            "equipment_inverter_id": str(test_data["inverter"].id),
            "site_boundary": boundary,
            "placement_settings": {"row_spacing_m": 3.0}
        }
        
        response = client.post(f"/api/tenders/{test_data['tender'].id}/site-designs", json=payload)
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "API Design"
        assert "id" in data

    def test_create_design_api_forbidden(self, client, db, test_data, test_user_viewer):
        app.dependency_overrides[get_current_user] = lambda: mock_current_user(test_user_viewer)
        
        boundary = {"type": "Polygon", "coordinates": [[[0,0], [0,1], [1,1], [1,0], [0,0]]]}
        payload = {
            "name": "API Design",
            "site_type": "ground_mount",
            "equipment_module_id": str(test_data["module"].id),
            "equipment_inverter_id": str(test_data["inverter"].id),
            "site_boundary": boundary,
            "placement_settings": {}
        }
        
        response = client.post(f"/api/tenders/{test_data['tender'].id}/site-designs", json=payload)
        assert response.status_code == 403

    def test_get_designs_api(self, client, db, test_data):
        app.dependency_overrides[get_current_user] = lambda: mock_current_user(test_data["user"])
        
        # Create via service first
        service = SiteDesignService(db, test_data["tenant"].id, test_data["user"].id)
        boundary = {"type": "Polygon", "coordinates": [[[0,0], [0,1], [1,1], [1,0], [0,0]]]}
        service.create_design(test_data["tender"].id, "D1", SiteTypeEnum.GROUND_MOUNT, 
                            test_data["module"].id, test_data["inverter"].id, boundary, {})
        
        response = client.get(f"/api/tenders/{test_data['tender'].id}/site-designs")
        assert response.status_code == 200
        assert len(response.json()) == 1

    def test_list_designs_empty_api(self, client, db, test_data):
        app.dependency_overrides[get_current_user] = lambda: mock_current_user(test_data["user"])
        # New tender with no designs
        other_tender = Tender(name="Empty Tender", tenant_id=test_data["tenant"].id, created_by=test_data["user"].id)
        db.add(other_tender)
        db.commit()
        
        response = client.get(f"/api/tenders/{other_tender.id}/site-designs")
        assert response.status_code == 200
        assert len(response.json()) == 0

    def test_recalculate_api(self, client, db, test_data):
        app.dependency_overrides[get_current_user] = lambda: mock_current_user(test_data["user"])
        service = SiteDesignService(db, test_data["tenant"].id, test_data["user"].id)
        # Small polygon: ~10m x 10m
        boundary = {"type": "Polygon", "coordinates": [[[0,0], [0,0.0001], [0.0001,0.0001], [0.0001,0], [0,0]]]}
        design = service.create_design(test_data["tender"].id, "D1", SiteTypeEnum.GROUND_MOUNT, 
                            test_data["module"].id, test_data["inverter"].id, boundary, {})
        
        response = client.post(f"/api/site-designs/{design.id}/recalculate")
        assert response.status_code == 200
        data = response.json()
        assert data["mode"] == "sync" # Now it should be small enough
        assert "design" in data
        assert data["design"]["total_modules"] > 0

    def test_get_design_api_404(self, client, db, test_data):
        app.dependency_overrides[get_current_user] = lambda: mock_current_user(test_data["user"])
        response = client.get(f"/api/site-designs/{uuid4()}")
        assert response.status_code == 404

    def test_update_design_api(self, client, db, test_data):
        app.dependency_overrides[get_current_user] = lambda: mock_current_user(test_data["user"])
        
        service = SiteDesignService(db, test_data["tenant"].id, test_data["user"].id)
        boundary = {"type": "Polygon", "coordinates": [[[0,0], [0,1], [1,1], [1,0], [0,0]]]}
        design = service.create_design(test_data["tender"].id, "D1", SiteTypeEnum.GROUND_MOUNT, 
                            test_data["module"].id, test_data["inverter"].id, boundary, {})
                            
        payload = {
            "name": "Updated Name",
            "placement_settings": {"tilt_deg": 40.0}
        }
        
        response = client.put(f"/api/site-designs/{design.id}", json=payload)
        assert response.status_code == 200
        assert response.json()["name"] == "Updated Name"
        assert response.json()["placement_settings"]["tilt_deg"] == 40.0

    def test_delete_design_api_pm(self, client, db, test_data, test_user_pm):
        # PM should be able to delete
        app.dependency_overrides[get_current_user] = lambda: mock_current_user(test_user_pm)
        
        service = SiteDesignService(db, test_data["tenant"].id, test_user_pm.id)
        boundary = {"type": "Polygon", "coordinates": [[[0,0], [0,1], [1,1], [1,0], [0,0]]]}
        design = service.create_design(test_data["tender"].id, "To Delete", SiteTypeEnum.GROUND_MOUNT, 
                            test_data["module"].id, test_data["inverter"].id, boundary, {})
                            
        response = client.delete(f"/api/site-designs/{design.id}")
        assert response.status_code == 204
        
        # Verify gone
        assert db.query(SiteDesign).filter(SiteDesign.id == design.id).first() is None

    def test_delete_design_api_viewer_forbidden(self, client, db, test_data, test_user_viewer):
        app.dependency_overrides[get_current_user] = lambda: mock_current_user(test_user_viewer)
        
        service = SiteDesignService(db, test_data["tenant"].id, test_data["user"].id)
        boundary = {"type": "Polygon", "coordinates": [[[0,0], [0,1], [1,1], [1,0], [0,0]]]}
        design = service.create_design(test_data["tender"].id, "No Delete", SiteTypeEnum.GROUND_MOUNT, 
                            test_data["module"].id, test_data["inverter"].id, boundary, {})
        
        response = client.delete(f"/api/site-designs/{design.id}")
        assert response.status_code == 403

    def test_api_update_design_invalid_id(self, client, db, test_data):
        app.dependency_overrides[get_current_user] = lambda: mock_current_user(test_data["user"])
        payload = {"name": "Whatever"}
        response = client.put(f"/api/site-designs/{uuid4()}", json=payload)
        assert response.status_code == 404

    def test_api_update_design_forbidden_viewer(self, client, db, test_data, test_user_viewer):
        app.dependency_overrides[get_current_user] = lambda: mock_current_user(test_user_viewer)
        
        service = SiteDesignService(db, test_data["tenant"].id, test_data["user"].id)
        boundary = {"type": "Polygon", "coordinates": [[[0,0], [0,1], [1,1], [1,0], [0,0]]]}
        design = service.create_design(test_data["tender"].id, "No Update", SiteTypeEnum.GROUND_MOUNT, 
                            test_data["module"].id, test_data["inverter"].id, boundary, {})
        
        response = client.put(f"/api/site-designs/{design.id}", json={"name": "Hacker"})
        assert response.status_code == 403

    def test_api_recalculate_large_site_async(self, client, db, test_data):
        app.dependency_overrides[get_current_user] = lambda: mock_current_user(test_data["user"])
        service = SiteDesignService(db, test_data["tenant"].id, test_data["user"].id)
        
        # Large polygon: 1x1 degree (~100km x 100km)
        boundary = {"type": "Polygon", "coordinates": [[[0,0], [0,1], [1,1], [1,0], [0,0]]]}
        design = service.create_design(test_data["tender"].id, "Large Site", SiteTypeEnum.GROUND_MOUNT, 
                            test_data["module"].id, test_data["inverter"].id, boundary, {})
        
        with patch("app.services.site_design.calculate_placement_async.delay") as mock_delay:
            mock_delay.return_value.id = "fake-task-id"
            
            response = client.post(f"/api/site-designs/{design.id}/recalculate")
            assert response.status_code == 200
            data = response.json()
            assert data["mode"] == "async"
            assert data["task_id"] == "fake-task-id"
            assert data["estimated_modules"] > 1000

    def test_api_create_design_nonexistent_equipment(self, client, db, test_data):
        app.dependency_overrides[get_current_user] = lambda: mock_current_user(test_data["user"])
        payload = {
            "name": "Bad IDs",
            "site_type": "ground_mount",
            "equipment_module_id": str(uuid4()),
            "equipment_inverter_id": str(uuid4()),
            "site_boundary": {"type": "Polygon", "coordinates": [[[0,0], [0,1], [1,1], [1,0], [0,0]]]}
        }
        response = client.post(f"/api/tenders/{test_data['tender'].id}/site-designs", json=payload)
        assert response.status_code == 400
        assert "not found" in response.json()["detail"].lower()

    def test_api_create_design_missing_fields(self, client, test_data):
        app.dependency_overrides[get_current_user] = lambda: mock_current_user(test_data["user"])
        # Missing site_boundary
        payload = {
            "name": "Incomplete",
            "site_type": "ground_mount",
            "equipment_module_id": str(test_data["module"].id),
            "equipment_inverter_id": str(test_data["inverter"].id)
        }
        response = client.post(f"/api/tenders/{test_data['tender'].id}/site-designs", json=payload)
        assert response.status_code == 422

    def test_api_update_invalid_exclusion_geojson(self, client, db, test_data):
        app.dependency_overrides[get_current_user] = lambda: mock_current_user(test_data["user"])
        service = SiteDesignService(db, test_data["tenant"].id, test_data["user"].id)
        boundary = {"type": "Polygon", "coordinates": [[[0,0], [0,1], [1,1], [1,0], [0,0]]]}
        design = service.create_design(test_data["tender"].id, "Excl Test", SiteTypeEnum.GROUND_MOUNT, 
                            test_data["module"].id, test_data["inverter"].id, boundary, {})
        
        # Invalid exclusion zone (not closed)
        payload = {
            "exclusion_zones": [{"type": "Polygon", "coordinates": [[[0,0], [0,1], [1,1]]]}]
        }
        response = client.put(f"/api/site-designs/{design.id}", json=payload)
        assert response.status_code == 400
        assert "Invalid exclusion zone" in response.json()["detail"]

    def test_api_mutation_cross_tenant_forbidden(self, client, db, test_data):
        # Create design in Tenant A
        service_a = SiteDesignService(db, test_data["tenant"].id, test_data["user"].id)
        boundary = {"type": "Polygon", "coordinates": [[[0,0], [0,1], [1,1], [1,0], [0,0]]]}
        design = service_a.create_design(test_data["tender"].id, "Tenant A Design", SiteTypeEnum.GROUND_MOUNT, 
                            test_data["module"].id, test_data["inverter"].id, boundary, {})
        
        # Create User in Tenant B
        other_tenant = Tenant(name="Tenant B")
        db.add(other_tenant)
        db.flush()
        user_b = User(email="b@test.com", firebase_uid="uid_b", tenant_id=other_tenant.id, role=UserRole.ADMIN)
        db.add(user_b)
        db.commit()
        
        app.dependency_overrides[get_current_user] = lambda: mock_current_user(user_b)
        
        # Try to Update design from Tenant A
        response = client.put(f"/api/site-designs/{design.id}", json={"name": "Hacked"})
        assert response.status_code == 404 # Should not even see it
        
        # Try to Delete design from Tenant A
        response = client.delete(f"/api/site-designs/{design.id}")
        assert response.status_code == 404

    def test_api_role_based_access_crud(self, client, db, test_data, test_user_pm, test_user_viewer, test_user_engineer):
        boundary = {"type": "Polygon", "coordinates": [[[0,0], [0,1], [1,1], [1,0], [0,0]]]}
        service = SiteDesignService(db, test_data["tenant"].id, test_data["user"].id)
        design = service.create_design(test_data["tender"].id, "RBAC Test", SiteTypeEnum.GROUND_MOUNT, 
                            test_data["module"].id, test_data["inverter"].id, boundary, {})
        
        # PM: Mutation succeeds
        app.dependency_overrides[get_current_user] = lambda: mock_current_user(test_user_pm)
        response = client.put(f"/api/site-designs/{design.id}", json={"name": "PM Upd"})
        assert response.status_code == 200
        
        # VIEWER: Mutation forbidden
        app.dependency_overrides[get_current_user] = lambda: mock_current_user(test_user_viewer)
        response = client.put(f"/api/site-designs/{design.id}", json={"name": "Viewer Upd"})
        assert response.status_code == 403
        response = client.delete(f"/api/site-designs/{design.id}")
        assert response.status_code == 403
        
        # ENGINEER: Mutation forbidden
        app.dependency_overrides[get_current_user] = lambda: mock_current_user(test_user_engineer)
        response = client.put(f"/api/site-designs/{design.id}", json={"name": "Eng Upd"})
        assert response.status_code == 403
        response = client.delete(f"/api/site-designs/{design.id}")
        assert response.status_code == 403
