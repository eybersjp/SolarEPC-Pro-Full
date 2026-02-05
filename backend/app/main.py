"""
SolarEPC Pro - FastAPI Application
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api import auth, tenants, tenders, preconditions, pv_designs, boq, dashboard, helio_prep, helioscope, equipment, site_designs

app = FastAPI(
    title="SolarEPC Pro API",
    description="Commercial & utility-scale solar EPC operating system",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
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
    return {"status": "healthy", "version": "0.1.0"}


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
app.include_router(site_designs.router, prefix="", tags=["Site Designs"])
app.include_router(dashboard.router, tags=["Dashboard"])
