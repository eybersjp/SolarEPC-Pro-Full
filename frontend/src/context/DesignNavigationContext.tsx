"use client";

import { createContext, useContext } from "react";

export interface NavigationContextType {
    push: (url: string) => void;
    replace: (url: string) => void;
    back: () => void;
}

export const NavigationContext = createContext<NavigationContextType | null>(null);

export const useDesignNavigation = () => {
    const context = useContext(NavigationContext);
    if (!context) {
        throw new Error("useDesignNavigation must be used within a NavigationProvider");
    }
    return context;
};
