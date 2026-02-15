
import pytest
from uuid import uuid4
from sqlalchemy.orm import Session
from app.services.boq import BOQService
from app.models.models import BOQItem, Tender, User, Tenant, UserRole

@pytest.fixture
def boq_test_context(db_session: Session):
    tenant = Tenant(name="BOQ Tenant")
    db_session.add(tenant)
    db_session.flush()
    user = User(tenant_id=tenant.id, email=f"boq_{uuid4()}@ex.com", firebase_uid=f"boq_{uuid4()}", name="BOQ User")
    db_session.add(user)
    db_session.commit()
    
    tender = Tender(name="BOQ Tender", tenant_id=tenant.id, created_by=user.id)
    db_session.add(tender)
    db_session.commit()
    
    return tenant, user, tender

def test_create_boq_item(db_session: Session, boq_test_context):
    tenant, user, tender = boq_test_context
    service = BOQService(db_session)
    
    item = service.create_boq_item(
        tender_id=tender.id,
        category="Hardware",
        name="Solar Panel X",
        quantity=10,
        unit_price=200.0,
        currency="USD"
    )
    
    assert item.id is not None
    assert item.total_price == 2000.0
    assert item.tender_id == tender.id

def test_list_boq_items(db_session: Session, boq_test_context):
    tenant, user, tender = boq_test_context
    service = BOQService(db_session)
    
    service.create_boq_item(tender.id, "Cat1", "Item1", 1, 100)
    service.create_boq_item(tender.id, "Cat1", "Item2", 2, 50)
    
    items = service.list_boq_items(tender.id)
    assert len(items) == 2

def test_update_boq_item(db_session: Session, boq_test_context):
    tenant, user, tender = boq_test_context
    service = BOQService(db_session)
    item = service.create_boq_item(tender.id, "Cat", "Name", 1, 100)
    
    updated = service.update_boq_item(item.id, {"quantity": 2})
    assert updated.quantity == 2
    assert updated.total_price == 200.0

def test_delete_boq_item(db_session: Session, boq_test_context):
    tenant, user, tender = boq_test_context
    service = BOQService(db_session)
    item = service.create_boq_item(tender.id, "Cat", "Name", 1, 100)
    
    service.delete_boq_item(item.id)
    
    deleted = db_session.query(BOQItem).filter(BOQItem.id == item.id).first()
    assert deleted is None

def test_calculate_total_cost(db_session: Session, boq_test_context):
    tenant, user, tender = boq_test_context
    service = BOQService(db_session)
    
    service.create_boq_item(tender.id, "Cat", "Item1", 1, 100) # 100
    service.create_boq_item(tender.id, "Cat", "Item2", 2, 50)  # 100
    
    total = service.calculate_total_cost(tender.id)
    assert total == 200.0
