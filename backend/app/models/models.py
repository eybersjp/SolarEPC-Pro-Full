"""
SQLAlchemy models for SolarEPC Pro.
"""
import uuid
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import Column, String, Float, Integer, Boolean, ForeignKey, Enum, DateTime, Text, JSON
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.core.database import Base


# Helper for JSONB on Postgres, JSON on others (SQLite)
JSON_TYPE = JSON().with_variant(JSONB(), "postgresql")


class UserRole(str, PyEnum):
    """User role enumeration."""
    ADMIN = "admin"
    PM = "pm"
    ENGINEER = "engineer"
    VIEWER = "viewer"


class TenderStatus(str, PyEnum):
    """Tender status enumeration."""
    DRAFT = "draft"
    IN_REVIEW = "in_review"
    SUBMITTED = "submitted"
    WON = "won"
    LOST = "lost"


class Tenant(Base):
    """Tenant/organization model."""
    __tablename__ = "tenants"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    users = relationship("User", back_populates="tenant")
    tenders = relationship("Tender", back_populates="tenant")
    equipment_modules = relationship("EquipmentModule", back_populates="tenant")
    equipment_inverters = relationship("EquipmentInverter", back_populates="tenant")


class User(Base):
    """User model with tenant association."""
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    firebase_uid = Column(String(128), unique=True, nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    name = Column(String(255))
    role = Column(Enum(UserRole), default=UserRole.VIEWER)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    tenant = relationship("Tenant", back_populates="users")
    tenders = relationship("Tender", back_populates="created_by_user")


class Tender(Base):
    """Tender/project model."""
    __tablename__ = "tenders"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    name = Column(String(255), nullable=False)
    client_name = Column(String(255))
    latitude = Column(Float)
    longitude = Column(Float)
    target_capacity_kw = Column(Float)
    status = Column(Enum(TenderStatus), default=TenderStatus.DRAFT)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    tenant = relationship("Tenant", back_populates="tenders")
    created_by_user = relationship("User", back_populates="tenders")
    precondition = relationship("Precondition", back_populates="tender", uselist=False)
    pv_designs = relationship("PVDesign", back_populates="tender")
    boq_items = relationship("BOQItem", back_populates="tender")
    site_designs = relationship("SiteDesign", back_populates="tender")


class Precondition(Base):
    """Go/No-Go preconditions checklist."""
    __tablename__ = "preconditions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tender_id = Column(UUID(as_uuid=True), ForeignKey("tenders.id"), unique=True, nullable=False)
    
    grid_connection = Column(Boolean, default=False)
    land_access = Column(Boolean, default=False)
    permits_cleared = Column(Boolean, default=False)
    financing_confirmed = Column(Boolean, default=False)
    
    notes = Column(Text)
    go_decision = Column(Boolean, default=False)
    
    # Relationships
    tender = relationship("Tender", back_populates="precondition")


class PVDesign(Base):
    """PV system design model."""
    __tablename__ = "pv_designs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tender_id = Column(UUID(as_uuid=True), ForeignKey("tenders.id"), nullable=False)
    
    # Module specs
    module_model = Column(String(255))
    module_watt = Column(Integer)
    
    # Inverter specs
    inverter_model = Column(String(255))
    inverter_kw = Column(Integer)
    
    # Sizing results
    strings_per_inverter = Column(Integer)
    modules_per_string = Column(Integer)
    dc_ac_ratio = Column(Float)
    total_modules = Column(Integer)
    total_capacity_kwp = Column(Float)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    tender = relationship("Tender", back_populates="pv_designs")


class BOQItem(Base):
    """Bill of Quantities line item."""
    __tablename__ = "boq_items"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tender_id = Column(UUID(as_uuid=True), ForeignKey("tenders.id"), nullable=False)
    
    category = Column(String(100))  # modules, inverters, bos, labor, logistics
    description = Column(String(500))
    unit_cost = Column(Float)
    quantity = Column(Integer)
    margin_pct = Column(Float, default=0.0)
    line_total = Column(Float)
    
    # Relationships
    tender = relationship("Tender", back_populates="boq_items")


class AuditLog(Base):
    """Immutable audit log for all data mutations."""
    __tablename__ = "audit_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    entity_type = Column(String(100), nullable=False)  # e.g., 'Tender', 'PVDesign'
    entity_id = Column(UUID(as_uuid=True), nullable=False)
    action = Column(String(50), nullable=False)  # 'create', 'update', 'delete'
    
    old_value = Column(JSON, nullable=True)
    new_value = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    tenant = relationship("Tenant")
    user = relationship("User")


class EquipmentModule(Base):
    """Central + tenant-specific PV module library."""
    __tablename__ = "equipment_modules"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=True)
    
    # Module Specifications
    manufacturer = Column(String(255), nullable=False)
    model = Column(String(255), nullable=False)
    wattage = Column(Integer, nullable=False)
    efficiency = Column(Float, nullable=False)
    
    # Physical Dimensions (meters)
    length_m = Column(Float, nullable=False)
    width_m = Column(Float, nullable=False)
    thickness_m = Column(Float, nullable=False)
    
    # Electrical Specs
    voc = Column(Float, nullable=False)  # Open circuit voltage
    isc = Column(Float, nullable=False)  # Short circuit current
    vmp = Column(Float, nullable=False)  # Max power voltage
    imp = Column(Float, nullable=False)  # Max power current
    
    # Library Management
    is_global = Column(Boolean, default=False)  # True = central library
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    tenant = relationship("Tenant", back_populates="equipment_modules")


class EquipmentInverter(Base):
    """Central + tenant-specific inverter library."""
    __tablename__ = "equipment_inverters"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=True)
    
    # Inverter Specifications
    manufacturer = Column(String(255), nullable=False)
    model = Column(String(255), nullable=False)
    capacity_kw = Column(Float, nullable=False)
    
    # Input Specs
    max_dc_voltage = Column(Float, nullable=False)
    mppt_voltage_range_min = Column(Float, nullable=False)
    mppt_voltage_range_max = Column(Float, nullable=False)
    max_input_current = Column(Float, nullable=False)
    num_mppt_channels = Column(Integer, nullable=False)
    
    # Library Management
    is_global = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    tenant = relationship("Tenant", back_populates="equipment_inverters")


class SiteDesign(Base):
    """Primary entity for map-based designs."""
    __tablename__ = "site_designs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tender_id = Column(UUID(as_uuid=True), ForeignKey("tenders.id"), nullable=False)
    pv_design_id = Column(UUID(as_uuid=True), ForeignKey("pv_designs.id"), nullable=True)
    
    # Metadata
    name = Column(String(255), nullable=False)
    site_type = Column(String(50), nullable=False)  # rooftop, ground_mount, carport
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Equipment Selection
    equipment_module_id = Column(UUID(as_uuid=True), ForeignKey("equipment_modules.id"), nullable=False)
    equipment_inverter_id = Column(UUID(as_uuid=True), ForeignKey("equipment_inverters.id"), nullable=False)
    
    # Geometric Data
    site_boundary = Column(JSON_TYPE, nullable=False)
    exclusion_zones = Column(JSON_TYPE, default=[])
    module_placements = Column(JSON_TYPE, default=[])
    
    # Placement Settings
    edge_setback_m = Column(Float, default=1.0)
    row_spacing_m = Column(Float, default=2.0)
    module_orientation = Column(String(20), default="portrait")
    azimuth_deg = Column(Float, default=180.0)
    tilt_deg = Column(Float, nullable=False)
    
    # Calculated Results
    total_modules = Column(Integer, default=0)
    system_size_kwp = Column(Float, default=0.0)
    site_area_sqm = Column(Float, nullable=True)
    
    # Task Tracking
    placement_task_id = Column(String(255), nullable=True)
    placement_task_status = Column(String(50), nullable=True)
    placement_task_error = Column(Text, nullable=True)
    placement_calculated_at = Column(DateTime, nullable=True)
    
    # Relationships
    tender = relationship("Tender", back_populates="site_designs")
    pv_design = relationship("PVDesign")
    versions = relationship("DesignVersion", back_populates="site_design")
    energy_estimate = relationship("EnergyEstimate", uselist=False)
    financial_analysis = relationship("FinancialAnalysis", uselist=False)

    @property
    def placement_settings(self):
        return {
            "edge_setback_m": self.edge_setback_m,
            "row_spacing_m": self.row_spacing_m,
            "module_orientation": self.module_orientation,
            "azimuth_deg": self.azimuth_deg,
            "tilt_deg": self.tilt_deg,
        }


class DesignVersion(Base):
    """Immutable snapshots of design state."""
    __tablename__ = "design_versions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    site_design_id = Column(UUID(as_uuid=True), ForeignKey("site_designs.id"), nullable=False)
    
    version_name = Column(String(255), nullable=False)
    notes = Column(Text, nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    snapshot_data = Column(JSON_TYPE, nullable=False)
    
    site_design = relationship("SiteDesign", back_populates="versions")


class EnergyEstimate(Base):
    """Cached PVWatts API results."""
    __tablename__ = "energy_estimates"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    site_design_id = Column(UUID(as_uuid=True), ForeignKey("site_designs.id"), unique=True)
    
    parameter_hash = Column(String(64), nullable=False)
    system_capacity_kw = Column(Float, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    azimuth = Column(Float, nullable=False)
    tilt = Column(Float, nullable=False)
    losses_pct = Column(Float, default=14.0)
    
    annual_energy_kwh = Column(Float, nullable=False)
    monthly_energy_kwh = Column(JSON_TYPE, nullable=False)
    capacity_factor = Column(Float, nullable=False)
    
    status = Column(String(20), default="calculating")
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, nullable=False, default=0)
    last_retry_at = Column(DateTime, nullable=True)
    calculated_at = Column(DateTime, default=datetime.utcnow)


class FinancialAnalysis(Base):
    """Basic financial metrics."""
    __tablename__ = "financial_analyses"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    site_design_id = Column(UUID(as_uuid=True), ForeignKey("site_designs.id"), unique=True)
    
    system_cost_usd = Column(Float, nullable=False)
    electricity_rate_usd_per_kwh = Column(Float, nullable=False)
    annual_rate_escalation_pct = Column(Float, default=2.0)
    
    annual_savings_usd = Column(Float, nullable=False)
    simple_payback_years = Column(Float, nullable=False)
    roi_pct = Column(Float, nullable=False)
    
    calculated_at = Column(DateTime, default=datetime.utcnow)
