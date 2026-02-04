/**
 * Environment variable configuration with runtime validation.
 */

// API URL defaults to /api for Next.js proxy
export const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

// Firebase configuration
export const FIREBASE_CONFIG = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
};

/**
 * Validate required environment variables in production.
 * Call this in your app initialization if needed.
 */
export function validateEnv(): void {
    if (process.env.NODE_ENV === "production") {
        const required = [
            "NEXT_PUBLIC_FIREBASE_API_KEY",
            "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
            "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
        ];

        const missing = required.filter((key) => !process.env[key]);

        if (missing.length > 0) {
            throw new Error(
                `Missing required environment variables: ${missing.join(", ")}`
            );
        }
    }
}
