/**
 * Test data fixtures for E2E cross-browser tests
 */

export const sampleSiteBoundary = {
    type: 'Feature' as const,
    geometry: {
        type: 'Polygon' as const,
        coordinates: [
            [
                [-122.4194, 37.7749],
                [-122.4184, 37.7749],
                [-122.4184, 37.7739],
                [-122.4194, 37.7739],
                [-122.4194, 37.7749],
            ],
        ],
    },
    properties: {
        name: 'Test Site Boundary',
        area_sqm: 1000,
    },
};

export const sampleExclusionZone = {
    type: 'Feature' as const,
    geometry: {
        type: 'Polygon' as const,
        coordinates: [
            [
                [-122.4192, 37.7747],
                [-122.4190, 37.7747],
                [-122.4190, 37.7745],
                [-122.4192, 37.7745],
                [-122.4192, 37.7747],
            ],
        ],
    },
    properties: {
        name: 'Chimney Exclusion',
        type: 'chimney',
    },
};

export const sampleEquipmentConfig = {
    module: {
        id: 'module-1',
        manufacturer: 'Test Solar',
        model: 'TS-550W',
        power_watts: 550,
        efficiency: 0.21,
        dimensions: {
            length_mm: 2278,
            width_mm: 1134,
            height_mm: 35,
        },
    },
    inverter: {
        id: 'inverter-1',
        manufacturer: 'Test Inverters',
        model: 'TI-10K',
        power_watts: 10000,
        efficiency: 0.98,
        mppt_channels: 2,
    },
};

export const samplePlacementSettings = {
    row_spacing_m: 2.5,
    module_spacing_mm: 20,
    setback_m: 1.0,
    tilt_deg: 20,
    azimuth_deg: 180,
    orientation: 'portrait' as const,
};

export const sampleDesignData = {
    name: 'Test Solar Design',
    address: '123 Solar Street, San Francisco, CA 94102',
    latitude: 37.7749,
    longitude: -122.4194,
    system_size_kwp: 44.0,
    module_count: 80,
    annual_production_kwh: 65000,
};

export const sampleEnergyEstimate = {
    id: 'energy-1',
    design_id: 'design-1',
    annual_production_kwh: 65000,
    monthly_production_kwh: [
        4500, 5200, 6100, 6800, 7200, 7500,
        7400, 7000, 6300, 5500, 4700, 4300,
    ],
    capacity_factor: 0.168,
    specific_yield_kwh_kwp: 1477,
    status: 'completed' as const,
};

export const sampleFinancialAnalysis = {
    id: 'financial-1',
    design_id: 'design-1',
    total_cost_usd: 88000,
    cost_per_watt_usd: 2.0,
    annual_savings_usd: 9750,
    payback_period_years: 9.0,
    roi_percent: 11.1,
    npv_usd: 45000,
    irr_percent: 12.5,
    status: 'completed' as const,
};

export const sampleProposal = {
    id: 'proposal-1',
    design_id: 'design-1',
    pdf_url: 'https://example.com/proposals/proposal-1.pdf',
    csv_url: 'https://example.com/proposals/proposal-1.csv',
    generated_at: new Date().toISOString(),
    status: 'completed' as const,
};

// Polygon drawing coordinates (relative to map container)
export const polygonCoordinates = [
    { x: 400, y: 300 },
    { x: 600, y: 300 },
    { x: 600, y: 450 },
    { x: 400, y: 450 },
];

export const exclusionZoneCoordinates = [
    { x: 450, y: 350 },
    { x: 500, y: 350 },
    { x: 500, y: 400 },
    { x: 450, y: 400 },
];

// Viewport configurations for responsive testing
export const viewports = {
    desktop: { width: 1920, height: 1080 },
    laptop: { width: 1366, height: 768 },
    tablet: { width: 768, height: 1024 },
    tabletLandscape: { width: 1024, height: 768 },
    mobile: { width: 375, height: 667 },
    mobileLandscape: { width: 667, height: 375 },
};

// Browser-specific test data
export const browserSpecificData = {
    chrome: {
        userAgent: /Chrome/,
        features: ['clipboard', 'geolocation', 'indexedDB'],
    },
    firefox: {
        userAgent: /Firefox/,
        features: ['clipboard', 'geolocation', 'indexedDB'],
    },
    safari: {
        userAgent: /Safari/,
        features: ['geolocation', 'indexedDB'],
        knownIssues: ['clipboard API limited'],
    },
    edge: {
        userAgent: /Edg/,
        features: ['clipboard', 'geolocation', 'indexedDB'],
    },
};
