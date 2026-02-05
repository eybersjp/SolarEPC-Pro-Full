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

