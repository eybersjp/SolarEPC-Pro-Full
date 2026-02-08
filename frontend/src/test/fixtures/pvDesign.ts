import { PVDesign } from "@/types";

export const mockPVDesign: PVDesign = {
    id: "pv-design-1",
    module_model: "test-module",
    module_watt: 400,
    inverter_model: "test-inverter",
    inverter_kw: 100,
    strings_per_inverter: 4,
    modules_per_string: 20,
    dc_ac_ratio: 1.25,
    total_modules: 80,
    total_capacity_kwp: 32,
    created_at: new Date().toISOString(),
    valid: true,
    warnings: [],
};
