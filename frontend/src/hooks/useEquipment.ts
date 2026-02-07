import { useQuery } from "@tanstack/react-query";
import { equipmentApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import type { EquipmentModule, EquipmentInverter } from "@/types";

/**
 * Hook for fetching list of equipment modules with optional filters.
 */
export const useEquipmentModulesQuery = (filters?: { search?: string; manufacturer?: string }) => {
    return useQuery({
        queryKey: queryKeys.equipment.modulesList(filters),
        queryFn: () => equipmentApi.listModules(filters),
    });
};

/**
 * Hook for fetching list of equipment inverters with optional filters.
 */
export const useEquipmentInvertersQuery = (filters?: { search?: string; manufacturer?: string }) => {
    return useQuery({
        queryKey: queryKeys.equipment.invertersList(filters),
        queryFn: () => equipmentApi.listInverters(filters),
    });
};
