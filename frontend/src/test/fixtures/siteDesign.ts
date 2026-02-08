import { SiteDesignResponse, SiteType, ModuleOrientation } from "@/types";

export const mockSiteDesign: SiteDesignResponse = {
    id: "design-1",
    tender_id: "tender-1",
    name: "Main Test Design",
    site_type: "rooftop" as SiteType,
    equipment_module_id: "module-1",
    equipment_inverter_id: "inverter-1",
    pv_design_id: null,
    site_boundary: {
        type: "Polygon",
        coordinates: [
            [
                [0, 0],
                [0, 10],
                [10, 10],
                [10, 0],
                [0, 0],
            ],
        ],
    },
    exclusion_zones: [],
    placement_settings: {
        edge_setback_m: 1,
        row_spacing_m: 0.5,
        module_orientation: "portrait" as ModuleOrientation,
        azimuth_deg: 0,
        tilt_deg: 10,
    },
    module_placements: [],
    total_modules: 0,
    system_size_kwp: 0,
    site_area_sqm: 100,
    placement_task_id: null,
    placement_task_status: null,
    placement_task_error: null,
    placement_calculated_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
};

export const createMockSiteDesign = (overrides = {}): SiteDesignResponse => ({
    ...mockSiteDesign,
    ...overrides,
});

export const mockEnergyEstimate: any = {
    id: "energy-1",
    design_id: "design-1",
    status: "completed",
    annual_energy_kwh: 1500000,
    monthly_energy_kwh: [
        120000, 110000, 130000, 140000, 150000, 160000,
        155000, 145000, 135000, 125000, 115000, 105000
    ],
    capacity_factor: 18.2,
    error_message: null,
    calculated_at: new Date().toISOString(),
};

export const mockFinancialAnalysis: any = {
    id: "financial-1",
    design_id: "design-1",
    system_cost_usd: 1200000,
    electricity_rate_usd_per_kwh: 0.12,
    annual_rate_escalation_pct: 2.5,
    annual_savings_usd: 180000,
    simple_payback_years: 6.7,
    roi_pct: 15.4,
    calculated_at: new Date().toISOString(),
};
