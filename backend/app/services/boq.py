"""
BOQ (Bill of Quantities) Pricing service.
"""
from typing import Optional, List
from uuid import UUID

from sqlalchemy.orm import Session

from app.models import BOQItem, Tender
from app.services.audit import AuditService


class BOQService:
    """Service for BOQ management and pricing calculations."""
    
    def __init__(self, db: Session, tenant_id: UUID, user_id: UUID):
        self.db = db
        self.tenant_id = tenant_id
        self.user_id = user_id
        self.audit = AuditService(db)

    def _trigger_recalculation(self, tender_id: UUID):
        """Trigger financial recalculation for all designs in tender."""
        try:
             from app.models.models import SiteDesign
             from app.services.financial_analysis import FinancialAnalysisService
             
             designs = self.db.query(SiteDesign).filter(SiteDesign.tender_id == tender_id).all()
             fin_service = FinancialAnalysisService(self.db, self.tenant_id, self.user_id)
             
             for design in designs:
                 fin_service.calculate_financials(design.id)
        except Exception as e:
            # Prevent BOQ operations from failing due to calculation errors
            print(f"Financial recalculation failed: {e}")

    
    def list_items(self, tender_id: UUID) -> List[BOQItem]:
        """List all BOQ items for a tender."""
        self._get_tender_or_404(tender_id)
        return self.db.query(BOQItem).filter(
            BOQItem.tender_id == tender_id
        ).order_by(BOQItem.category, BOQItem.id).all()
    
    def get_item(self, item_id: UUID) -> Optional[BOQItem]:
        """Get a BOQ item by ID."""
        item = self.db.query(BOQItem).filter(BOQItem.id == item_id).first()
        if item:
            self._get_tender_or_404(item.tender_id)
        return item
    
    def get_item_or_404(self, item_id: UUID) -> BOQItem:
        """Get BOQ item or raise 404."""
        item = self.get_item(item_id)
        if not item:
            from fastapi import HTTPException, status
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"BOQ item {item_id} not found",
            )
        return item
    
    def create_item(
        self,
        tender_id: UUID,
        category: str,
        description: str,
        unit_cost: float,
        quantity: int,
        margin_pct: float = 0.0,
    ) -> BOQItem:
        """Create a new BOQ item with calculated line total."""
        self._get_tender_or_404(tender_id)
        
        line_total = self._calculate_line_total(unit_cost, quantity, margin_pct)
        
        item = BOQItem(
            tender_id=tender_id,
            category=category,
            description=description,
            unit_cost=unit_cost,
            quantity=quantity,
            margin_pct=margin_pct,
            line_total=round(line_total, 2),
        )
        
        self.db.add(item)
        self.db.flush()
        
        self.audit.log_create(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            entity_type="BOQItem",
            entity_id=item.id,
            new_value={
                "category": category,
                "description": description,
                "line_total": item.line_total,
            },
        )
        
        self.db.flush()
        self._trigger_recalculation(tender_id)
        
        return item
    
    def update_item(
        self,
        item: BOQItem,
        category: Optional[str] = None,
        description: Optional[str] = None,
        unit_cost: Optional[float] = None,
        quantity: Optional[int] = None,
        margin_pct: Optional[float] = None,
    ) -> BOQItem:
        """Update BOQ item and recalculate line total."""
        old_values = {}
        new_values = {}
        
        if category is not None and category != item.category:
            old_values["category"] = item.category
            new_values["category"] = category
            item.category = category
        
        if description is not None and description != item.description:
            old_values["description"] = item.description
            new_values["description"] = description
            item.description = description
        
        if unit_cost is not None and unit_cost != item.unit_cost:
            old_values["unit_cost"] = item.unit_cost
            new_values["unit_cost"] = unit_cost
            item.unit_cost = unit_cost
        
        if quantity is not None and quantity != item.quantity:
            old_values["quantity"] = item.quantity
            new_values["quantity"] = quantity
            item.quantity = quantity
        
        if margin_pct is not None and margin_pct != item.margin_pct:
            old_values["margin_pct"] = item.margin_pct
            new_values["margin_pct"] = margin_pct
            item.margin_pct = margin_pct
        
        # Recalculate line total if any pricing field changed
        if any(k in new_values for k in ["unit_cost", "quantity", "margin_pct"]):
            old_values["line_total"] = item.line_total
            item.line_total = round(
                self._calculate_line_total(item.unit_cost, item.quantity, item.margin_pct),
                2,
            )
            new_values["line_total"] = item.line_total
        
        if new_values:
            self.audit.log_update(
                tenant_id=self.tenant_id,
                user_id=self.user_id,
                entity_type="BOQItem",
                entity_id=item.id,
                old_value=old_values,
                new_value=new_values,
            )
        
        self.db.flush() # Ensure update is visible
        self._trigger_recalculation(item.tender_id)
        
        return item
    
    def delete_item(self, item: BOQItem) -> None:
        """Delete a BOQ item."""
        self.audit.log_delete(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            entity_type="BOQItem",
            entity_id=item.id,
            old_value={
                "category": item.category,
                "description": item.description,
                "line_total": item.line_total,
            },
        )
        self.db.delete(item)
        self.db.flush()
        self._trigger_recalculation(item.tender_id)
    
    def get_summary(self, tender_id: UUID) -> dict:
        """
        Get BOQ summary with totals.
        
        Returns:
            dict with subtotal, total_margin, grand_total
        """
        items = self.list_items(tender_id)
        
        subtotal = sum(item.unit_cost * item.quantity for item in items)
        total_margin = sum(
            item.unit_cost * item.quantity * (item.margin_pct / 100)
            for item in items
        )
        grand_total = subtotal + total_margin
        
        return {
            "subtotal": round(subtotal, 2),
            "total_margin": round(total_margin, 2),
            "grand_total": round(grand_total, 2),
            "item_count": len(items),
        }
    
    def _calculate_line_total(
        self,
        unit_cost: float,
        quantity: int,
        margin_pct: float,
    ) -> float:
        """Calculate line total with margin."""
        base = unit_cost * quantity
        margin = base * (margin_pct / 100)
        return base + margin
    
    def _get_tender_or_404(self, tender_id: UUID) -> Tender:
        """Get tender with tenant verification."""
        tender = self.db.query(Tender).filter(
            Tender.id == tender_id,
            Tender.tenant_id == self.tenant_id,
        ).first()
        
        if not tender:
            from fastapi import HTTPException, status
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Tender {tender_id} not found",
            )
        return tender


def get_boq_service(
    db: Session,
    tenant_id: UUID,
    user_id: UUID,
) -> BOQService:
    """Factory function for BOQ service."""
    return BOQService(db, tenant_id, user_id)
