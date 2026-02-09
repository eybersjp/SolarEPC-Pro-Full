/**
 * TypeScript type definitions for SolarEPC Pro API.
 */

// Enums
export type UserRole = 'admin' | 'pm' | 'engineer' | 'viewer';
export type TenderStatus = 'draft' | 'in_review' | 'submitted' | 'won' | 'lost';

// Auth Request/Response Types
export interface SignupRequest {
    email?: string;
    password?: string;
    name?: string;
    tenant_name?: string;
    firebase_token?: string; // Added for backend registration
}

export interface LoginRequest {
    email?: string;
    password?: string;
    firebase_token?: string; // Added for backend login
}

export interface UserResponse {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    tenant_id: string;
}

// User
export interface User {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    tenant_id: string;
}

// Tenant
export interface Tenant {
    id: string;
    name: string;
}

// Tender Types
export interface Tender {
    id: string;
    name: string;
    client_name: string | null;
    latitude: number | null;
    longitude: number | null;
    target_capacity_kw: number | null;
    status: TenderStatus;
    created_at: string;
}

export interface TenderCreate {
    name: string;
    client_name?: string;
    latitude?: number;
    longitude?: number;
    target_capacity_kw?: number;
}

export interface TenderUpdate {
    name?: string;
    client_name?: string;
    latitude?: number;
    longitude?: number;
    target_capacity_kw?: number;
    status?: TenderStatus;
}

export interface TenderResponse extends Tender {
    updated_at: string;
    tenant_id: string;
}

// Preconditions Types
export interface Precondition {
    grid_connection: boolean;
    land_access: boolean;
    permits_cleared: boolean;
    financing_confirmed: boolean;
    go_decision: boolean;
    notes: string | null;
}

export interface PreconditionWithBlockers extends Precondition {
    blockers: string[];
}

export interface PreconditionUpdate {
    grid_connection?: boolean;
    land_access?: boolean;
    permits_cleared?: boolean;
    financing_confirmed?: boolean;
    go_decision?: boolean;
    notes?: string;
}

// PV Design Types
export interface PVDesign {
    id: string;
    module_model: string;
    module_watt: number;
    inverter_model: string;
    inverter_kw: number;
    strings_per_inverter: number;
    modules_per_string: number;
    dc_ac_ratio: number;
    total_modules: number;
    total_capacity_kwp: number;
    created_at: string;
    valid?: boolean;
    warnings?: string[];
}

export interface PVDesignWithValidation extends PVDesign {
    valid: boolean;
    warnings: string[];
}

export interface PVDesignCreate {
    module_model: string;
    module_watt: number;
    inverter_model: string;
    inverter_kw: number;
    strings_per_inverter: number;
    modules_per_string: number;
}

export interface PVDesignUpdate {
    module_model?: string;
    module_watt?: number;
    inverter_model?: string;
    inverter_kw?: number;
    strings_per_inverter?: number;
    modules_per_string?: number;
}

// BOQ Types
export interface BOQItem {
    id: string;
    category: string;
    description: string;
    unit_cost: number;
    quantity: number;
    margin_pct: number;
    line_total: number;
}

export interface BOQItemCreate {
    category: string;
    description: string;
    unit_cost: number;
    quantity: number;
    margin_pct?: number;
}

export interface BOQItemUpdate {
    category?: string;
    description?: string;
    unit_cost?: number;
    quantity?: number;
    margin_pct?: number;
}

export interface BOQSummary {
    items: BOQItem[];
    subtotal: number;
    total_margin: number;
    grand_total: number;
}

// Dashboard Types
export interface DashboardStats {
    total_tenders: number;
    active_tenders: number;
    won_tenders: number;
    total_capacity_kw: number;
}

export interface TenderSummary {
    id: string;
    name: string;
    client_name: string | null;
    status: TenderStatus;
    created_at: string;
    target_capacity_kw: number | null;
}

export interface DashboardResponse {
    stats: DashboardStats;
    recent_tenders: TenderSummary[];
}

// HelioPrep Types
export type UnitType = 'kW' | 'kWh' | 'MW' | 'mWh';
export type IntervalType = '15min' | '30min' | 'hourly' | 'monthly';

export interface UtilityBillEntry {
    start_date: string;
    end_date: string;
    consumption_kwh: number;
    demand_kw?: number;
    cost?: number;
}

export interface LoadProfileEntry {
    timestamp: string;
    value: number;
    unit: UnitType;
}

export interface SiteData {
    address: string;
    latitude: number;
    longitude: number;
    utility_name: string;
    tariff_name: string;
    meter_number?: string;
}

export interface InputDataset {
    site_data: SiteData;
    utility_bills?: UtilityBillEntry[];
    load_profile?: LoadProfileEntry[];
    interval?: IntervalType;
}

export interface ValidationFlag {
    field: string;
    message: string;
    severity: 'error' | 'warning';
}

export interface ValidationResult {
    is_valid: boolean;
    flags: ValidationFlag[];
}

export interface NormalizedDataset {
    site_id: string;
    normalized_load_profile: LoadProfileEntry[];
    annual_consumption_kwh: number;
    peak_demand_kw: number;
    standardized_tariff_name: string;
}

// Helioscope Types
export interface ScenarioConfig {
    name: string;
    load_offset_target: number;
    inverter_ratio: number;
    has_bess: boolean;
    battery_capacity_kwh?: number;
    battery_power_kw?: number;
}

export interface SimulationResult {
    scenario_name: string;
    annual_production_kwh: number;
    performance_ratio: number;
    system_loss: number;
    specific_yield: number;
    is_complete: boolean;
    error?: string;
}

// Site Design Types
export type SiteType = 'rooftop' | 'ground_mount' | 'carport';
export type ModuleOrientation = 'portrait' | 'landscape';

export interface GeoJSONPolygon {
    type: 'Polygon';
    coordinates: number[][][];
}

export interface PlacementSettings {
    edge_setback_m: number;
    row_spacing_m: number;
    module_orientation: ModuleOrientation;
    azimuth_deg: number;
    tilt_deg: number | null;
}

export interface SiteDesignBase {
    name: string;
    site_type: SiteType;
    equipment_module_id: string;
    equipment_inverter_id: string;
    site_boundary: GeoJSONPolygon;
    placement_settings: PlacementSettings;
}

export interface SiteDesignCreate extends SiteDesignBase { }

export interface SiteDesignUpdate {
    name?: string;
    site_boundary?: GeoJSONPolygon;
    exclusion_zones?: GeoJSONPolygon[];
    equipment_module_id?: string;
    equipment_inverter_id?: string;
    placement_settings?: Partial<PlacementSettings>;
    site_type?: SiteType;
}

export interface SiteDesignResponse extends SiteDesignBase {
    id: string;
    tender_id: string;
    pv_design_id: string | null;
    exclusion_zones: GeoJSONPolygon[];
    module_placements: any[]; // Using any for GeoJSON points for now
    total_modules: number;
    system_size_kwp: number;
    site_area_sqm: number | null;
    placement_task_id: string | null;
    placement_task_status: string | null;
    placement_task_error: string | null;
    placement_calculated_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface DesignVersionCreate {
    version_name: string;
    notes?: string;
}

export interface DesignVersionResponse {
    id: string;
    site_design_id: string;
    version_name: string;
    notes: string | null;
    created_at: string;
    total_modules: number | null;
    system_size_kwp: number | null;
}

export interface DesignVersionDetail extends DesignVersionResponse {
    snapshot_data: Record<string, any>;
}

export interface DesignVersionRestoreResponse {
    site_design: SiteDesignResponse;
    recalculation_status: Record<string, any>;
}
// Equipment Types
export interface EquipmentModule {
    id: string;
    manufacturer: string;
    model: string;
    wattage: number;
    efficiency: number;
    length_m: number;
    width_m: number;
    thickness_m: number;
    voc: number;
    isc: number;
    vmp: number;
    imp: number;
    tenant_id: string | null;
    is_global: boolean;
    is_active: boolean;
    created_at: string;
}

export interface EquipmentInverter {
    id: string;
    manufacturer: string;
    model: string;
    capacity_kw: number;
    max_dc_voltage: number;
    mppt_voltage_range_min: number;
    mppt_voltage_range_max: number;
    max_input_current: number;
    num_mppt_channels: number;
    tenant_id: string | null;
    is_global: boolean;
    is_active: boolean;
    created_at: string;
}

// Energy and Financial Types

export type EnergyEstimateStatus = 'not_calculated' | 'calculating' | 'completed' | 'failed';

export interface MonthlyEnergyData {
    month: string;
    energy_kwh: number;
}

export interface EnergyEstimateResponse {
    id: string;
    design_id: string;
    status: EnergyEstimateStatus;
    annual_energy_kwh: number;
    monthly_energy_kwh: number[]; // Array of 12 numbers from API
    capacity_factor: number;
    error_message?: string;
    calculated_at: string | null;
}

export interface FinancialAnalysisResponse {
    id: string;
    design_id: string;
    system_cost_usd: number;
    electricity_rate_usd_per_kwh: number;
    annual_rate_escalation_pct: number;
    annual_savings_usd: number;
    simple_payback_years: number;
    roi_pct: number;
    calculated_at: string;
}

// Proposals Types
export interface ProposalGenerateRequest {
    title?: string;
    include_cover?: boolean;
    include_site_map?: boolean;
    include_specs?: boolean;
    include_energy?: boolean;
    include_financials?: boolean;
    include_equipment?: boolean;
}

export interface ProposalTaskResponse {
    task_id: string;
    status: string;
}

export interface ProposalStatusResponse {
    task_id: string;
    status: string;
    result_url?: string;
    error?: string;
}
