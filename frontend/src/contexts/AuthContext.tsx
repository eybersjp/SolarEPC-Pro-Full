"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    User as FirebaseUser
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { authApi } from "@/lib/api";
import { User, LoginRequest, SignupRequest } from "@/types";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface AuthContextType {
    user: User | null;
    firebaseUser: FirebaseUser | null;
    loading: boolean;
    login: (credentials: LoginRequest) => Promise<void>;
    signup: (data: SignupRequest) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    const fetchUserProfile = async () => {
        try {
            const profile = await authApi.me();
            setUser(profile);
        } catch (error) {
            console.error("Failed to fetch user profile:", error);
            setUser(null);
        }
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (fUser) => {
            setFirebaseUser(fUser);
            if (fUser) {
                await fetchUserProfile();
            } else {
                setUser(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const login = async (credentials: LoginRequest) => {
        setLoading(true);
        try {
            const userCredential = await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
            const token = await userCredential.user.getIdToken();

            // Sync with backend
            await authApi.login({ firebase_token: token });

            await fetchUserProfile();
            toast.success("Successfully logged in");
            router.push("/");
        } catch (error: any) {
            console.error("Login error:", error);
            const message = error.response?.data?.detail || error.message || "Failed to login";
            toast.error(message);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const signup = async (data: SignupRequest) => {
        setLoading(true);
        try {
            // 1. Create user in Firebase
            const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
            const token = await userCredential.user.getIdToken();

            // 2. Create user/tenant in Backend
            await authApi.signup({
                ...data,
                firebase_token: token
            });

            // 3. Refresh profile
            await fetchUserProfile();

            toast.success("Account created successfully");
            router.push("/");
        } catch (error: any) {
            console.error("Signup error:", error);
            const message = error.response?.data?.detail || error.message || "Failed to sign up";
            toast.error(message);

            // If backend fails but firebase succeeded, we might want to clean up or handle it
            if (auth.currentUser) {
                try {
                    await auth.currentUser.delete();
                } catch (deleteError) {
                    console.error("Failed to delete Firebase user after backend failure:", deleteError);
                    await signOut(auth);
                }
            }
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const logout = async () => {
        setLoading(true);
        try {
            await signOut(auth);
            setUser(null);
            setFirebaseUser(null);
            toast.success("Logged out successfully");
            router.push("/login");
        } catch (error: any) {
            toast.error("Failed to logout");
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthContext.Provider value={{ user, firebaseUser, loading, login, signup, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
