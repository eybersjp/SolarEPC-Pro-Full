I have the following user query that I want you to help me with. Implement the requested functionality following best practices.

Add new SQLAlchemy models to `c:\Users\SSTECH\developments\apps\solarepc-pro\backend\app\models\models.py`:

- Add enums: `SiteType`, `ModuleOrientation`, `EnergyEstimateStatus`
- Add models: `EquipmentModule`, `EquipmentInverter`, `SiteDesign`, `DesignVersion`, `EnergyEstimate`, `FinancialAnalysis`
- Include JSONB columns for GeoJSON data (site_boundary, exclusion_zones, module_placements)
- Add relationship to `Tender` model: `site_designs`
- Update <traycer-file absPath="c:\Users\SSTECH\developments\apps\solarepc-pro\backend\app\models_*init*_.py">backend/app/models/**init**.py</traycer-file> with new model imports