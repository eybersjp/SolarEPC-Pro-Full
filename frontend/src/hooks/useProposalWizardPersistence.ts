import { toast } from "sonner";

export interface PersistedWizardState {
    step: number;
    title: string;
    selectedSections: Record<string, boolean>;
    taskId: string | null;
    pdfUrl: string | null;
    timestamp: number;
}

const EXPIRATION_TIME = 24 * 60 * 60 * 1000; // 24 hours

export function useProposalWizardPersistence(designId: string) {
    const storageKey = `proposal-wizard-${designId}`;

    const savePersistedState = (state: Omit<PersistedWizardState, "timestamp">) => {
        try {
            const data: PersistedWizardState = {
                ...state,
                timestamp: Date.now(),
            };
            localStorage.setItem(storageKey, JSON.stringify(data));
        } catch (error) {
            console.warn("Failed to save proposal wizard state:", error);
        }
    };

    const loadPersistedState = (): PersistedWizardState | null => {
        try {
            const raw = localStorage.getItem(storageKey);
            if (!raw) return null;

            const data: PersistedWizardState = JSON.parse(raw);
            const now = Date.now();

            if (now - data.timestamp > EXPIRATION_TIME) {
                localStorage.removeItem(storageKey);
                return null;
            }

            return data;
        } catch (error) {
            console.warn("Failed to load proposal wizard state:", error);
            // If parsing fails, clear bad data
            localStorage.removeItem(storageKey);
            return null;
        }
    };

    const clearPersistedState = () => {
        try {
            localStorage.removeItem(storageKey);
        } catch (error) {
            console.warn("Failed to clear proposal wizard state:", error);
        }
    };

    return {
        savePersistedState,
        loadPersistedState,
        clearPersistedState,
    };
}
