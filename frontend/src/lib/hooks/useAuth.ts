"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { toast } from "@/lib/toast";
import type { SignupRequest, LoginRequest } from "@/types";

/**
 * Hook to get the current authenticated user
 */
export function useCurrentUser() {
    const query = useQuery({
        queryKey: queryKeys.auth.me(),
        queryFn: () => authApi.me(),
        retry: false,
    });

    return {
        user: query.data,
        isLoading: query.isLoading,
        error: query.error,
        isAuthenticated: !!query.data,
    };
}

/**
 * Hook for user login mutation
 */
export function useLogin() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: LoginRequest) => authApi.login(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.auth.all });
            toast.success("Successfully logged in");
        },
        onError: (error: Error) => {
            toast.error(error.message || "Failed to login");
        },
    });
}

/**
 * Hook for user signup mutation
 */
export function useSignup() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: SignupRequest) => authApi.signup(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.auth.all });
            toast.success("Account created successfully");
        },
        onError: (error: Error) => {
            toast.error(error.message || "Failed to create account");
        },
    });
}
