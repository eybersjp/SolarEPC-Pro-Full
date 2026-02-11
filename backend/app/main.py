"""
SolarEPC Pro - FastAPI Application
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api import auth, tenants, tenders, preconditions, pv_designs, boq, dashboard, helio_prep, helioscope, equipment, site_designs, financial_analysis

tags_metadata = [
    {
        "name": "Site Designs",
        "description": "Map-based solar site design operations. Create, update, and manage site designs with interactive geometry, equipment selection, and auto-placement.",
    },
    {
        "name": "Proposals",
        "description": "Generate professional PDF proposals and export BOM CSV files. Supports async generation for large proposals.",
    },
    {
        "name": "Equipment Library",
        "description": "Manage PV modules and inverters. Supports global library and tenant-specific equipment.",
    },
    {
        "name": "Financial Analysis",
        "description": "Calculate ROI, payback period, and annual savings based on energy estimates and system costs.",
    },
    {
        "name": "Authentication",
        "description": "User authentication and token management.",
    },
    {
        "name": "Tenants",
        "description": "Tenant management operations.",
    },
    {
        "name": "Tenders",
        "description": "Tender management operations.",
    },
]

app = FastAPI(
    title="SolarEPC Pro API",
    description="""
    Commercial & utility-scale solar EPC operating system.
    
    ## Map-Based Design Canvas
    
    The new map-based design canvas enables:
    - Interactive site boundary drawing on Leaflet maps
    - Automated module placement with setback and spacing constraints
    - Energy estimation via NREL PVWatts API
    - Financial analysis (ROI, IRR, Payback Period)
    - PDF Proposal generation
    
    ## usage
    
    All endpoints require Firebase Authentication token in the `Authorization` header: `Bearer <token>`.
    """,
    version="0.2.0",
    contact={
        "name": "SolarEPC Pro Support",
        "url": "https://solarepc.pro/support",
        "email": "support@solarepc.pro",
    },
    license_info={
        "name": "Proprietary",
        "url": "https://solarepc.pro/license",
    },
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_tags=tags_metadata,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "version": "0.2.0"}


# Include routers
app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(tenants.router, prefix="/tenants", tags=["Tenants"])
app.include_router(tenders.router, prefix="/tenders", tags=["Tenders"])
app.include_router(preconditions.router, prefix="/tenders", tags=["Preconditions"])
app.include_router(pv_designs.router, prefix="/tenders", tags=["PV Designs"])
app.include_router(boq.router, prefix="/tenders", tags=["BOQ"])
app.include_router(helio_prep.router, prefix="/tenders", tags=["HelioPrep"])
app.include_router(helioscope.router, prefix="/tenders", tags=["Helioscope"])
app.include_router(equipment.router, prefix="/api/equipment", tags=["Equipment Library"])
app.include_router(site_designs.router, prefix="/api", tags=["Site Designs"])
app.include_router(financial_analysis.router, prefix="/api", tags=["Financial Analysis"])
app.include_router(dashboard.router, tags=["Dashboard"])

from app.api import proposals
app.include_router(proposals.router, prefix="/api", tags=["Proposals"])
