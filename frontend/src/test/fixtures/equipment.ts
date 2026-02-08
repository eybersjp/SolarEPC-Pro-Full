import { EquipmentModule, EquipmentInverter } from '@/types';

export const mockEquipmentModule: EquipmentModule = {
    id: 'module-1',
    manufacturer: 'Test Solar',
    model: 'TS-400',
    wattage: 400,
    efficiency: 21.5,
    length_m: 2.0,
    width_m: 1.0,
    thickness_m: 0.04,
    voc: 45.5,
    isc: 11.2,
    vmp: 38.4,
    imp: 10.4,
    tenant_id: 'tenant-1',
    is_global: true,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
};

export const mockEquipmentInverter: EquipmentInverter = {
    id: 'inverter-1',
    manufacturer: 'Test Energy',
    model: 'TE-50K',
    capacity_kw: 50,
    max_dc_voltage: 1000,
    mppt_voltage_range_min: 200,
    mppt_voltage_range_max: 800,
    max_input_current: 50,
    num_mppt_channels: 4,
    tenant_id: 'tenant-1',
    is_global: true,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
};

export const mockModulesList = [
    mockEquipmentModule,
    {
        ...mockEquipmentModule,
        id: 'module-2',
        model: 'TS-450',
        wattage: 450
    }
];

export const mockInvertersList = [
    mockEquipmentInverter,
    {
        ...mockEquipmentInverter,
        id: 'inverter-2',
        model: 'TE-100K',
        capacity_kw: 100
    }
];
