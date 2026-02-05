# Epic Brief: Map-Based Solar Design Canvas

## Summary

EPCs currently spend hours or days creating solar site layouts using complex CAD tools or expensive specialized software, when they need to generate proposals in minutes to stay competitive. This Epic introduces a map-based design canvas integrated directly into the SolarEPC Pro tender workflow, enabling users to draw site boundaries on satellite imagery, automatically place PV modules, estimate energy production, and generate proposal-ready PDFs with financial analysis—all within a single, streamlined workflow. The solution eliminates the CAD bottleneck, reduces proposal turnaround time from days to minutes, and provides EPCs with a complete design-to-proposal toolchain. Phase 1 delivers the core workflow for single-tenant validation, Phase 2 adds multi-tenant capabilities and advanced features, and Phase 3 introduces AI-assisted optimization.

---

## Context & Problem

### Who's Affected

**Primary Users:**
- **EPC Project Managers** - Need to respond to tenders quickly with accurate, professional proposals
- **Solar Engineers** - Spend excessive time on repetitive layout work in CAD tools
- **Sales Teams** - Require fast turnaround for client proposals to close deals

**Current State:**
- SolarEPC Pro has basic PV design capabilities (module/inverter selection, sizing calculations) in `file:backend/app/models/models.py` (PVDesign model)
- No visual design tools, no satellite imagery integration, no auto-placement algorithms
- No proposal generation or financial analysis capabilities
- Engineers must export to CAD software for layout work, then manually create proposals

### The Pain

**Speed Bottleneck:**
- Creating a site layout in CAD takes 2-8 hours for commercial projects
- Manual proposal creation adds another 1-2 hours
- Total time from tender receipt to proposal delivery: 1-3 days
- Competitors with faster tools win more bids

**Complexity Barrier:**
- CAD tools (AutoCAD, SketchUp) require specialized training
- Expensive licenses ($1,500-$3,000/year per seat)
- Steep learning curve prevents sales teams from creating quick estimates
- Engineers become bottlenecks in the sales process

**Disconnected Workflow:**
- Data re-entry between tender system, CAD, and proposal documents
- No integration with existing tender workflow in `file:backend/app/api/tenders.py`
- Manual BOQ creation instead of leveraging existing `file:backend/app/services/boq.py`
- Version control and collaboration challenges across tools

**Accuracy & Credibility:**
- Manual calculations prone to errors
- Inconsistent proposal quality across team members
- Lack of bankable energy estimates reduces client confidence
- No standardized financial analysis framework

### Why This Matters

**Business Impact:**
- **Win Rate:** Faster proposal turnaround increases tender win rate by 15-25%
- **Capacity:** Engineers can handle 3-5x more projects when layout is automated
- **Cost Savings:** Eliminate CAD license costs ($1,500-$3,000/seat/year)
- **Revenue:** Sales teams can generate preliminary designs, expanding pipeline

**Strategic Value:**
- Completes the SolarEPC Pro vision: Tender → Design → Pricing → Execution
- Differentiates from competitors still using CAD-based workflows
- Creates data foundation for AI-assisted optimization (Phase 3)
- Enables multi-tenant SaaS business model (Phase 2)

### Success Looks Like

**Phase 1 (MVP - Months 1-4):**
- Project Manager launches design canvas from a tender in `file:backend/app/api/tenders.py`
- Engineer draws site boundary on satellite imagery in under 2 minutes
- System auto-places PV modules with basic grid fill algorithm
- Energy production estimated via PVWatts API
- PDF proposal generated with layout, specs, basic financials, and CSV BOM
- Total time from tender to proposal: 15-30 minutes (vs. 1-3 days)

**Phase 2 (Advanced - Months 5-7):**
- Multiple EPC companies using the platform with isolated data
- Complex rooftop designs supported (multi-plane, pitch, obstructions)
- Comprehensive financial models with sensitivity analysis
- Team collaboration with design versioning and comparison

**Phase 3 (AI/Optimization - Months 8-9):**
- AI suggests optimal layouts based on site characteristics
- Automated shading analysis and risk warnings
- Intelligent proposal content generation

---

## Scope Boundaries

### In Scope (Phase 1)
- Map-based design canvas with OpenStreetMap/Leaflet
- Site boundary and exclusion zone drawing tools
- Basic auto-placement (grid fill with setbacks and spacing)
- Simple rooftop (single plane), ground-mount, and simple carports
- Equipment library (hybrid: central database + tenant-specific)
- PVWatts API integration for energy estimation
- Basic financial metrics (payback, ROI)
- BOQ integration with existing system
- PDF + CSV BOM export
- Basic versioning (save/load designs)
- Single-tenant operation

### Out of Scope (Deferred to Phase 2+)
- Multi-tenant setup and RBAC
- Complex rooftop (multi-plane, pitch)
- Shading analysis and terrain considerations
- Comprehensive financial modeling
- Full collaboration features
- AI-assisted optimization
- KML/GeoJSON export
- Utility-scale specific features (trackers, large parcels)

### Explicitly Not Doing
- CAD replacement (initially)
- Full electrical single-line diagrams
- Bankable-grade custom energy simulation (using PVWatts instead)
- Residential solar support
- Consumer-facing portals