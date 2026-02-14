import os
import csv
import io
import base64
import logging
from datetime import datetime
from uuid import UUID
from typing import Optional, List, Dict, Any

from sqlalchemy.orm import Session
from jinja2 import Environment, FileSystemLoader
import tempfile
from app.services.storage import StorageBackend, get_storage_backend
from app.services.audit import AuditService

logger = logging.getLogger(__name__)

# WeasyPrint and Matplotlib imports (inside methods to avoid import errors if libs missing during dev)
# import matplotlib.pyplot as plt
# from weasyprint import HTML

from app.models.models import SiteDesign, Tender, EnergyEstimate, FinancialAnalysis, BOQItem
from app.core.config import settings

class ProposalService:
    def __init__(self, db: Session, storage: Optional[StorageBackend] = None, tenant_id: Optional[UUID] = None, user_id: Optional[UUID] = None):
        self.db = db
        self.storage = storage or get_storage_backend()
        self.tenant_id = tenant_id
        self.user_id = user_id
        self.audit_service = AuditService(db) if (tenant_id and user_id) else None
        
        # Setup Jinja2
        template_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "templates")
        self.jinja_env = Environment(loader=FileSystemLoader(template_dir))

    def generate_pdf(self, site_design_id: UUID, options: Optional[Dict[str, bool]] = None) -> str:
        """
        Generate PDF proposal for a site design and save to storage.
        Returns the storage identifier (key/filename).
        """
        import matplotlib.pyplot as plt
        from weasyprint import HTML, CSS

        if options is None:
            options = {
                "include_cover": True,
                "include_site_map": True,
                "include_specs": True,
                "include_energy": True,
                "include_financials": True,
                "include_equipment": True
            }

        # 1. Fetch Data
        query = self.db.query(SiteDesign).filter(SiteDesign.id == site_design_id)
        if self.tenant_id:
            query = query.join(Tender).filter(Tender.tenant_id == self.tenant_id)
        
        design = query.first()
        if not design:
            logger.error(f"SiteDesign {site_design_id} not found or access denied")
            raise ValueError(f"SiteDesign {site_design_id} not found")
        
        tender = self.db.query(Tender).filter(Tender.id == design.tender_id).first()
        if not tender:
            logger.error(f"Tender not found for design {site_design_id}")
            raise ValueError(f"Tender not found for design {site_design_id}")

        energy = self.db.query(EnergyEstimate).filter(EnergyEstimate.site_design_id == design.id).first()
        if not energy or energy.status != "completed":
            logger.info(f"Energy estimate missing or not completed for design {design.id}")
            energy = None

        financials = self.db.query(FinancialAnalysis).filter(FinancialAnalysis.site_design_id == design.id).first()
        if not financials:
            logger.info(f"Financial analysis missing for design {design.id}")

        bom_items = self.db.query(BOQItem).filter(BOQItem.tender_id == design.tender_id).all()
        if not bom_items:
            logger.info(f"BOM items missing for tender {design.tender_id}")
            bom_items = []

        # 2. Generate Chart
        chart_b64 = None
        if energy and energy.monthly_energy_kwh:
            try:
                chart_b64 = self._generate_monthly_chart(energy.monthly_energy_kwh)
            except Exception as e:
                logger.error(f"Chart generation failed in generate_pdf: {e}")
                # Continue without chart
                chart_b64 = None

        # 3. Render HTML
        template = self.jinja_env.get_template("proposal.html")
        html_content = template.render(
            tender=tender,
            design=design,
            energy=energy,
            financials=financials,
            bom_items=bom_items,
            chart_image=chart_b64,
            date=datetime.now().strftime("%Y-%m-%d"),
            options=options
        )

        # 4. Convert to PDF and Save to Storage
        filename = f"proposal_{design.id}_{datetime.now().strftime('%Y%m%d%H%M%S')}.pdf"
        css_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "templates", "styles.css")
        
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp_path = tmp.name
        
        try:
            HTML(string=html_content, base_url=".").write_pdf(tmp_path, stylesheets=[CSS(css_path)])
            # Save to storage
            storage_id = self.storage.save(tmp_path, filename)
            
            # 5. Audit Logging
            try:
                t_id = self.tenant_id or tender.tenant_id
                u_id = self.user_id or design.created_by
                if t_id and u_id:
                    audit_service = self.audit_service or AuditService(self.db)
                    audit_service.log(
                        tenant_id=t_id,
                        user_id=u_id,
                        entity_type="Proposal",
                        entity_id=site_design_id,
                        action="generate_pdf",
                        new_value={
                            "options": options,
                            "storage_id": storage_id,
                            "timestamp": datetime.now().isoformat()
                        }
                    )
                    self.db.commit()
            except Exception as audit_err:
                self.db.rollback()
                logger.warning(f"Audit logging failed for PDF generation: {audit_err}")
            
            logger.info(f"Successfully generated PDF proposal for design {site_design_id}")
            return storage_id
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

    def generate_bom_csv(self, site_design_id: UUID) -> str:
        """
        Generate BOM CSV for a site design.
        Returns CSV string.
        """
        # 1. Fetch Data
        query = self.db.query(SiteDesign).filter(SiteDesign.id == site_design_id)
        if self.tenant_id:
            query = query.join(Tender).filter(Tender.tenant_id == self.tenant_id)
            
        design = query.first()
        if not design:
            logger.error(f"SiteDesign {site_design_id} not found or access denied")
            raise ValueError(f"SiteDesign {site_design_id} not found")
        
        tender = self.db.query(Tender).filter(Tender.id == design.tender_id).first()
            
        bom_items = self.db.query(BOQItem).filter(BOQItem.tender_id == design.tender_id).all()
        if not bom_items:
            logger.info(f"Generating empty BOM CSV for design {site_design_id}")
            bom_items = []
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Header
        writer.writerow(["Category", "Description", "Unit Cost ($)", "Quantity", "Margin (%)", "Line Total ($)"])
        
        # Rows
        for item in bom_items:
            writer.writerow([
                getattr(item, 'category', 'N/A') or 'N/A',
                getattr(item, 'description', 'N/A') or 'N/A',
                f"{getattr(item, 'unit_cost', 0.0):.2f}",
                getattr(item, 'quantity', 0),
                f"{getattr(item, 'margin_pct', 0.0):.2f}",
                f"{getattr(item, 'line_total', 0.0):.2f}"
            ])
            
        csv_content = output.getvalue()

        # Audit Logging
        try:
            t_id = self.tenant_id or (tender.tenant_id if tender else None)
            u_id = self.user_id or design.created_by
            if t_id and u_id:
                audit_service = self.audit_service or AuditService(self.db)
                audit_service.log(
                    tenant_id=t_id,
                    user_id=u_id,
                    entity_type="BOM",
                    entity_id=site_design_id,
                    action="export_csv",
                    new_value={
                        "item_count": len(bom_items),
                        "timestamp": datetime.now().isoformat()
                    }
                )
                self.db.commit()
        except Exception as audit_err:
            self.db.rollback()
            logger.warning(f"Audit logging failed for CSV export: {audit_err}")

        logger.info(f"Successfully exported BOM CSV for design {site_design_id}")
        return csv_content

    def mark_as_outdated(self, site_design_id: UUID):
        """
        Mark any existing proposals for this design as outdated.
        Since we don't have a Proposal model yet, we log this event.
        """
        logger.info(f"Proposals for site design {site_design_id} marked as outdated due to design changes")
        if self.audit_service:
            self.audit_service.log(
                tenant_id=self.tenant_id,
                user_id=self.user_id,
                entity_type="Proposal",
                entity_id=site_design_id,
                action="mark_outdated",
                new_value={"reason": "design_restored"}
            )
            self.db.commit()

    def regenerate_proposal(self, site_design_id: UUID):
        """
        Trigger a new proposal generation task automatically.
        Called after version restoration or major design updates.
        """
        from app.services.tasks import generate_proposal_task
        logger.info(f"Triggering automatic proposal regeneration for design {site_design_id}")
        generate_proposal_task.delay(str(site_design_id))

    def _generate_monthly_chart(self, monthly_data: Any) -> Optional[str]:
        """
        Generate a bar chart of monthly energy production.
        Returns base64 encoded PNG.
        """
        import matplotlib.pyplot as plt
        
        try:
            if monthly_data is None:
                return None
                
            # Handle list or dict input (PVWatts usually returns list 0-11)
            months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
            values = []
            
            if isinstance(monthly_data, list):
                values = [float(v) for v in monthly_data[:12]]
                # Pad if short
                while len(values) < 12:
                    values.append(0.0)
            elif isinstance(monthly_data, dict):
                # Try to extract 12 values
                values = [float(v) for v in list(monthly_data.values())[:12]]
                while len(values) < 12:
                    values.append(0.0)
            else:
                logger.warning(f"Unexpected data type for monthly energy: {type(monthly_data)}")
                return None

            # Check for empty/all-zero data
            if not values or all(v == 0 for v in values):
                logger.info("Monthly energy data is empty or all zeros, skipping chart")
                return None

            plt.figure(figsize=(10, 5))
            plt.bar(months, values, color='#e67e22')
            plt.title('Monthly Energy Production (kWh)')
            plt.xlabel('Month')
            plt.ylabel('Energy (kWh)')
            plt.grid(axis='y', linestyle='--', alpha=0.7)
            
            # Save to buffer
            buf = io.BytesIO()
            plt.savefig(buf, format='png', bbox_inches='tight')
            plt.close()
            buf.seek(0)
            
            return base64.b64encode(buf.getvalue()).decode('utf-8')
        except Exception as e:
            logger.error(f"Chart generation failed: {e}")
            return None
