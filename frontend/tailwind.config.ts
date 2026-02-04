import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: "class",
    content: [
        "./src/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: "var(--color-primary)",
                    dark: "var(--color-primary-dark)",
                },
                secondary: "var(--color-secondary)",
                success: "var(--color-success)",
                danger: "var(--color-danger)",
                warning: "var(--color-warning)",
                background: "var(--color-bg)",
                card: "var(--color-bg-card)",
                input: "var(--color-bg-input)",
                foreground: "var(--color-text)",
                muted: "var(--color-text-muted)",
                border: "var(--color-border)",
            },
            borderRadius: {
                DEFAULT: "var(--radius)",
            },
            boxShadow: {
                DEFAULT: "var(--shadow)",
            },
        },
    },
    plugins: [],
};

export default config;
