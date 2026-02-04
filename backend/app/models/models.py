"""
SQLAlchemy models for SolarEPC Pro.
"""
import uuid
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import Column, String, Float, Integer, Boolean, ForeignKey, Enum, DateTime, Text, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


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
