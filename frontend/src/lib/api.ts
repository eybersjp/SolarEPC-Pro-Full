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
    PVDesignCreate,
    Precondition,
    PreconditionUpdate,
    BOQItem,
    BOQItemCreate,
    BOQItemUpdate,
    BOQSummary,
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
        fetchApi<{ token: string }>("/auth/login", {
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

    get: (tenderId: string, designId: string) =>
        fetchApi<PVDesign>(`/tenders/${tenderId}/pv-designs/${designId}`),

    create: (tenderId: string, data: PVDesignCreate) =>
        fetchApi<PVDesign>(`/tenders/${tenderId}/pv-designs`, {
            method: "POST",
            body: data,
        }),

    delete: (tenderId: string, designId: string) =>
        fetchApi<void>(`/tenders/${tenderId}/pv-designs/${designId}`, {
            method: "DELETE",
        }),
};

// Preconditions API
export const preconditionsApi = {
    get: (tenderId: string) =>
        fetchApi<Precondition>(`/tenders/${tenderId}/preconditions`),

    update: (tenderId: string, data: PreconditionUpdate) =>
        fetchApi<Precondition>(`/tenders/${tenderId}/preconditions`, {
            method: "PUT",
            body: data,
        }),
};

// BOQ API
export const boqApi = {
    list: (tenderId: string) =>
        fetchApi<BOQItem[]>(`/tenders/${tenderId}/boq`),

    getSummary: (tenderId: string) =>
        fetchApi<BOQSummary>(`/tenders/${tenderId}/boq/summary`),

    create: (tenderId: string, data: BOQItemCreate) =>
        fetchApi<BOQItem>(`/tenders/${tenderId}/boq`, {
            method: "POST",
            body: data,
        }),

    update: (tenderId: string, itemId: string, data: BOQItemUpdate) =>
        fetchApi<BOQItem>(`/tenders/${tenderId}/boq/${itemId}`, {
            method: "PUT",
            body: data,
        }),

    delete: (tenderId: string, itemId: string) =>
        fetchApi<void>(`/tenders/${tenderId}/boq/${itemId}`, {
            method: "DELETE",
        }),
};
