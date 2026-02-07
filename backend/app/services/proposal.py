import os
import csv
import io
import base64
from datetime import datetime
from uuid import UUID
from typing import Optional, List, Dict, Any

from sqlalchemy.orm import Session
from jinja2 import Environment, FileSystemLoader

# WeasyPrint and Matplotlib imports (inside methods to avoid import errors if libs missing during dev)
# import matplotlib.pyplot as plt
# from weasyprint import HTML

from app.models.models import SiteDesign, Tender, EnergyEstimate, FinancialAnalysis, BOQItem
from app.core.config import settings

class ProposalService:
    def __init__(self, db: Session):
        self.db = db
        # Setup Jinja2
        template_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "templates")
        self.jinja_env = Environment(loader=FileSystemLoader(template_dir))

    def generate_pdf(self, site_design_id: UUID, options: Optional[Dict[str, bool]] = None) -> str:
        """
        Generate PDF proposal for a site design.
        Returns the path to the generated PDF.
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
        design = self.db.query(SiteDesign).filter(SiteDesign.id == site_design_id).first()
        if not design:
            raise ValueError(f"SiteDesign {site_design_id} not found")
        
        tender = self.db.query(Tender).filter(Tender.id == design.tender_id).first()
        energy = self.db.query(EnergyEstimate).filter(EnergyEstimate.site_design_id == design.id).first()
        financials = self.db.query(FinancialAnalysis).filter(FinancialAnalysis.site_design_id == design.id).first()
        bom_items = self.db.query(BOQItem).filter(BOQItem.tender_id == design.tender_id).all() # Assuming BOQ is per tender

        # 2. Generate Chart
        chart_b64 = None
        if energy and energy.monthly_energy_kwh:
            chart_b64 = self._generate_monthly_chart(energy.monthly_energy_kwh)

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

        # 4. Convert to PDF
        # Ensure output dir exists
        output_dir = os.path.join(os.getcwd(), "generated_proposals")
        os.makedirs(output_dir, exist_ok=True)
        
        filename = f"proposal_{design.id}_{datetime.now().strftime('%Y%m%d%H%M%S')}.pdf"
        output_path = os.path.join(output_dir, filename)

        # CSS path
        css_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "templates", "styles.css")
        
        HTML(string=html_content, base_url=".").write_pdf(output_path, stylesheets=[CSS(css_path)])

        return output_path

    def generate_bom_csv(self, site_design_id: UUID) -> str:
        """
        Generate BOM CSV for a site design.
        Returns CSV string.
        """
        design = self.db.query(SiteDesign).filter(SiteDesign.id == site_design_id).first()
        if not design:
            raise ValueError(f"SiteDesign {site_design_id} not found")
            
        bom_items = self.db.query(BOQItem).filter(BOQItem.tender_id == design.tender_id).all()
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Header
        writer.writerow(["Category", "Description", "Unit Cost ($)", "Quantity", "Margin (%)", "Line Total ($)"])
        
        # Rows
        for item in bom_items:
            writer.writerow([
                item.category,
                item.description,
                f"{item.unit_cost:.2f}",
                item.quantity,
                f"{item.margin_pct:.2f}",
                f"{item.line_total:.2f}"
            ])
            
        return output.getvalue()

    def _generate_monthly_chart(self, monthly_data: Dict[str, float] or List[float]) -> str:
        """
        Generate a bar chart of monthly energy production.
        Returns base64 encoded PNG.
        """
        import matplotlib.pyplot as plt
        
        # Handle list or dict input (PVWatts usually returns list 0-11)
        months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        values = []
        
        if isinstance(monthly_data, list):
            values = monthly_data[:12]
            # Pad if short
            while len(values) < 12:
                values.append(0)
        elif isinstance(monthly_data, dict):
            # Try to map keys to months if dict
            # Not standardized yet, assuming standard order
            values = list(monthly_data.values())[:12]
        else:
            values = [0] * 12

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
