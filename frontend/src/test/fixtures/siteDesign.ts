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
