import { getAuth } from "firebase/auth";
import { API_URL } from "@/lib/env";
import type {
    SignupRequest,
    LoginRequest,
    UserResponse,
    Tender,
    TenderCreate,
    TenderUpdate,
    TenderResponse,
    DashboardResponse,
    PVDesign,
    PVDesignWithValidation,
    PVDesignCreate,
    Precondition,
    PreconditionWithBlockers,
    PreconditionUpdate,
    BOQItem,
    BOQItemCreate,
    BOQItemUpdate,
    BOQSummary,
    InputDataset,
    ValidationResult,
    NormalizedDataset,
    ScenarioConfig,
    SimulationResult,
} from "@/types";

export class ApiError extends Error {
    status: number;
    details?: unknown;

    constructor(message: string, status: number, details?: unknown) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.details = details;
    }
}

interface FetchOptions {
    method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    body?: unknown;
    headers?: Record<string, string>;
    skipAuth?: boolean;
}

export async function fetchApi<T>(
    endpoint: string,
    options: FetchOptions = {}
): Promise<T> {
    const { method = "GET", body, headers = {}, skipAuth = false } = options;

    const requestHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        ...headers,
    };

    // Add Firebase auth token if available and not skipped
    if (!skipAuth) {
        try {
            const auth = getAuth();
            const token = await auth.currentUser?.getIdToken();
            if (token) {
                requestHeaders["Authorization"] = `Bearer ${token}`;
            }
        } catch (error) {
            console.warn("Failed to get auth token:", error);
        }
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
    });

    let data: unknown;
    try {
        data = await response.json();
    } catch {
        data = null;
    }

    if (!response.ok) {
        const errorMessage =
            (data as { detail?: string })?.detail ||
            (data as { message?: string })?.message ||
            "An error occurred";
        throw new ApiError(errorMessage, response.status, data);
    }

    return data as T;
}

// Auth API
export const authApi = {
    signup: (data: SignupRequest) =>
        fetchApi<UserResponse>("/auth/signup", {
            method: "POST",
            body: data,
            skipAuth: true,
        }),

    login: (data: LoginRequest) =>
        fetchApi<UserResponse>("/auth/login", {
            method: "POST",
            body: data,
            skipAuth: true,
        }),

    me: () => fetchApi<UserResponse>("/auth/me"),
};

// Tenders API
export const tendersApi = {
    list: (params?: { status?: string; limit?: number; offset?: number }) => {
        const searchParams = new URLSearchParams();
        if (params?.status) searchParams.set("status", params.status);
        if (params?.limit) searchParams.set("limit", params.limit.toString());
        if (params?.offset) searchParams.set("offset", params.offset.toString());
        const query = searchParams.toString();
        return fetchApi<Tender[]>(`/tenders${query ? `?${query}` : ""}`);
    },

    get: (id: string) => fetchApi<TenderResponse>(`/tenders/${id}`),

    create: (data: TenderCreate) =>
        fetchApi<TenderResponse>("/tenders", { method: "POST", body: data }),

    update: (id: string, data: TenderUpdate) =>
        fetchApi<TenderResponse>(`/tenders/${id}`, { method: "PUT", body: data }),

    delete: (id: string) =>
        fetchApi<void>(`/tenders/${id}`, { method: "DELETE" }),
};

// Dashboard API
export const dashboardApi = {
    get: () => fetchApi<DashboardResponse>("/dashboard"),
};

// PV Designs API
export const pvDesignsApi = {
    list: (tenderId: string) =>
        fetchApi<PVDesign[]>(`/tenders/${tenderId}/pv-designs`),

    get: (designId: string) =>
        fetchApi<PVDesignWithValidation>(`/pv-designs/${designId}`),

    create: (tenderId: string, data: PVDesignCreate) =>
        fetchApi<PVDesignWithValidation>(`/tenders/${tenderId}/pv-designs`, {
            method: "POST",
            body: data,
        }),

    delete: (designId: string) =>
        fetchApi<void>(`/pv-designs/${designId}`, {
            method: "DELETE",
        }),
};

// Preconditions API
export const preconditionsApi = {
    get: (tenderId: string) =>
        fetchApi<PreconditionWithBlockers>(`/tenders/${tenderId}/preconditions`),

    update: (tenderId: string, data: PreconditionUpdate) =>
        fetchApi<PreconditionWithBlockers>(`/tenders/${tenderId}/preconditions`, {
            method: "PUT",
            body: data,
        }),
};

// BOQ API
export const boqApi = {
    list: (tenderId: string) =>
        fetchApi<BOQSummary>(`/tenders/${tenderId}/boq`),

    create: (tenderId: string, data: BOQItemCreate) =>
        fetchApi<BOQItem>(`/tenders/${tenderId}/boq`, {
            method: "POST",
            body: data,
        }),

    update: (itemId: string, data: BOQItemUpdate) =>
        fetchApi<BOQItem>(`/boq/${itemId}`, {
            method: "PUT",
            body: data,
        }),

    delete: (itemId: string) =>
        fetchApi<void>(`/boq/${itemId}`, {
            method: "DELETE",
        }),

    export: async (tenderId: string, format: 'json' | 'csv') => {
        const auth = getAuth();
        const token = await auth.currentUser?.getIdToken();
        const headers: Record<string, string> = {};
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_URL}/tenders/${tenderId}/boq/export?format=${format}`, {
            headers
        });

        if (!response.ok) {
            let errorData: any;
            try {
                errorData = await response.json();
            } catch {
                errorData = null;
            }
            const errorMessage = errorData?.detail || errorData?.message || response.statusText || "Export failed";
            throw new ApiError(errorMessage, response.status, errorData);
        }

        return response.blob();
    },
};

// HelioPrep API
export const helioPrepApi = {
    validate: (tenderId: string, data: InputDataset) =>
        fetchApi<ValidationResult>(`/tenders/${tenderId}/helio-prep/validate`, {
            method: "POST",
            body: data,
        }),

    normalize: (tenderId: string, data: InputDataset) =>
        fetchApi<NormalizedDataset>(`/tenders/${tenderId}/helio-prep/normalize`, {
            method: "POST",
            body: data,
        }),
};

// Helioscope API
export const helioscopeApi = {
    getScenarios: (tenderId: string, annualLoadKwh?: number) =>
        fetchApi<ScenarioConfig[]>(`/tenders/${tenderId}/helioscope/scenarios${annualLoadKwh ? `?annual_load_kwh=${annualLoadKwh}` : ''}`, {
            method: "POST",
        }),

    getResults: (tenderId: string) =>
        fetchApi<SimulationResult[]>(`/tenders/${tenderId}/helioscope/results`),
};
