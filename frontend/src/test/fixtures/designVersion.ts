import { DesignVersionResponse, DesignVersionDetail, DesignVersionRestoreResponse } from "@/types";
import { mockSiteDesign } from "./siteDesign";

export const mockVersionResponse: DesignVersionResponse = {
    id: "version-1",
    site_design_id: "design-1",
    version_name: "Initial Layout",
    notes: "First version with basic module placement",
    created_at: new Date().toISOString(),
    created_by_name: "Test User",
    total_modules: 80,
    system_size_kwp: 44.0,
};

export const mockVersionsList: DesignVersionResponse[] = [
    mockVersionResponse,
    {
        id: "version-2",
        site_design_id: "design-1",
        version_name: "Option A",
        notes: null,
        created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        created_by_name: "Test User",
        total_modules: 75,
        system_size_kwp: 41.25,
    },
    {
        id: "version-3",
        site_design_id: "design-1",
        version_name: "Option B",
        notes: "Increased setback for safety",
        created_at: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
        created_by_name: "Another User",
        total_modules: 70,
        system_size_kwp: 38.5,
    },
];

export const mockVersionDetail: DesignVersionDetail = {
    ...mockVersionResponse,
    snapshot_data: {
        site_boundary: mockSiteDesign.site_boundary,
        exclusion_zones: [],
        placement_settings: mockSiteDesign.placement_settings,
        module_placements: [],
    },
};

export const mockVersionRestoreResponse: DesignVersionRestoreResponse = {
    site_design: mockSiteDesign,
    recalculation_status: {
        placement_triggered: true,
        energy_triggered: true,
    },
};

export const createMockVersion = (overrides = {}): DesignVersionResponse => ({
    ...mockVersionResponse,
    ...overrides,
});
