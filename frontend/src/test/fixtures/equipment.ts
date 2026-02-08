import { EquipmentModule, EquipmentInverter } from '@/types';

export const mockEquipmentModule: EquipmentModule = {
    id: 'module-1',
    manufacturer: 'Test Solar',
    model: 'TS-400',
    wattage: 400,
    efficiency: 21.5,
    length_m: 2.0,
    width_m: 1.0,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
};

export const mockEquipmentInverter: EquipmentInverter = {
    id: 'inverter-1',
    manufacturer: 'Test Energy',
    model: 'TE-50K',
    capacity_kw: 50,
    max_dc_voltage: 1000,
    num_mppt_channels: 4,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
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
