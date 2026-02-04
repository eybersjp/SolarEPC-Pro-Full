"use client";

import { useEffect, useState } from "react";

interface HealthStatus {
    status: string;
    version: string;
}

export default function Home() {
    const [health, setHealth] = useState<HealthStatus | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch("/api/health")
            .then((res) => res.json())
            .then(setHealth)
            .catch(() => setError("Backend not connected"));
    }, []);

    return (
        <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
            {/* Hero Section */}
            <section style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)",
                padding: "2rem",
            }}>
                <div style={{ textAlign: "center", maxWidth: "800px" }}>
                    {/* Logo */}
                    <div style={{
                        width: "80px",
                        height: "80px",
                        background: "linear-gradient(135deg, #f59e0b, #ef4444)",
                        borderRadius: "16px",
                        margin: "0 auto 2rem",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 10px 40px rgba(245, 158, 11, 0.3)",
                    }}>
                        <span style={{ fontSize: "2.5rem" }}>☀️</span>
                    </div>

                    <h1 style={{
                        fontSize: "3.5rem",
                        fontWeight: "800",
                        marginBottom: "1rem",
                        background: "linear-gradient(135deg, #f8fafc, #94a3b8)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                    }}>
                        SolarEPC Pro
                    </h1>

                    <p style={{
                        fontSize: "1.25rem",
                        color: "#94a3b8",
                        marginBottom: "2.5rem",
                        lineHeight: "1.8",
                    }}>
                        The operating system for commercial &amp; utility-scale solar EPCs.
                        <br />
                        From tender to handover — one platform.
                    </p>

                    {/* Status Card */}
                    <div className="card" style={{
                        display: "inline-block",
                        padding: "1rem 2rem",
                    }}>
                        {error ? (
                            <span style={{ color: "var(--color-danger)" }}>⚠️ {error}</span>
                        ) : health ? (
                            <span style={{ color: "var(--color-success)" }}>
                                ✓ API {health.status} — v{health.version}
                            </span>
                        ) : (
                            <span style={{ color: "var(--color-text-muted)" }}>
                                Connecting to backend...
                            </span>
                        )}
                    </div>

                    {/* CTA Buttons */}
                    <div style={{ marginTop: "2.5rem", display: "flex", gap: "1rem", justifyContent: "center" }}>
                        <button className="btn btn-primary">
                            Get Started
                        </button>
                        <button className="btn" style={{
                            background: "transparent",
                            border: "1px solid var(--color-border)",
                            color: "var(--color-text)",
                        }}>
                            View Documentation
                        </button>
                    </div>
                </div>
            </section>

            {/* Features Grid */}
            <section style={{
                padding: "4rem 2rem",
                background: "var(--color-bg)",
            }}>
                <div className="container">
                    <h2 style={{
                        textAlign: "center",
                        fontSize: "2rem",
                        marginBottom: "3rem",
                        color: "var(--color-text)",
                    }}>
                        MVP Capabilities
                    </h2>

                    <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                        gap: "1.5rem",
                    }}>
                        {[
                            { icon: "📋", title: "Tender Intake", desc: "Capture site data, attach documents, track status" },
                            { icon: "✓", title: "Go/No-Go Checklist", desc: "Evaluate preconditions before committing" },
                            { icon: "⚡", title: "PV Sizing", desc: "String sizing, DC:AC ratio, module layout" },
                            { icon: "💰", title: "Pricing Engine", desc: "BOQ generation with margin controls" },
                            { icon: "👥", title: "Multi-Tenant", desc: "Isolated data per EPC organization" },
                            { icon: "📊", title: "Dashboard", desc: "Track all tenders in one view" },
                        ].map((feature, i) => (
                            <div key={i} className="card" style={{
                                transition: "transform 0.2s, box-shadow 0.2s",
                            }}>
                                <div style={{
                                    fontSize: "2rem",
                                    marginBottom: "1rem",
                                }}>
                                    {feature.icon}
                                </div>
                                <h3 style={{ marginBottom: "0.5rem", fontSize: "1.1rem" }}>
                                    {feature.title}
                                </h3>
                                <p style={{ color: "var(--color-text-muted)", fontSize: "0.9rem" }}>
                                    {feature.desc}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </main>
    );
}
