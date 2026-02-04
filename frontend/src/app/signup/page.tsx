"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Mail, Lock, User, Building, UserPlus, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function SignupPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [tenantName, setTenantName] = useState("");
    const { signup, loading } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await signup({ email, password, name, tenant_name: tenantName });
        } catch (error) {
            // Error handling is handled in the context with toasts
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#020617] relative overflow-hidden py-10">
            {/* Background decorative elements */}
            <div className="absolute top-0 right-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[20%] right-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px]"></div>
                <div className="absolute top-[-10%] left-[-10%] w-[30%] h-[30%] bg-primary/5 rounded-full blur-[120px]"></div>
            </div>

            <Card className="w-full max-w-xl border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl relative z-10 transition-all hover:border-white/20">
                <CardHeader className="space-y-1 text-center">
                    <div className="flex justify-center mb-4">
                        <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center shadow-[0_0_20px_rgba(var(--primary-rgb),0.5)]">
                            <UserPlus className="h-6 w-6 text-primary-foreground" />
                        </div>
                    </div>
                    <CardTitle className="text-3xl font-bold tracking-tight text-white">Scale your Operations</CardTitle>
                    <CardDescription className="text-white/60">
                        Create your SolarEPC Pro tenant and start managing projects
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4 col-span-1 md:col-span-2">
                            <h3 className="text-sm font-semibold uppercase tracking-wider text-primary flex items-center gap-2">
                                <User className="h-4 w-4" /> Personal Information
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name" className="text-white/80">Full Name</Label>
                                    <div className="relative group">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 group-focus-within:text-primary transition-colors" />
                                        <Input
                                            id="name"
                                            placeholder="John Doe"
                                            className="pl-10 bg-white/5 border-white/10 focus:border-primary/50 text-white placeholder:text-white/20 transition-all"
                                            value={name}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email" className="text-white/80">Work Email</Label>
                                    <div className="relative group">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 group-focus-within:text-primary transition-colors" />
                                        <Input
                                            id="email"
                                            type="email"
                                            placeholder="john@solar-solutions.com"
                                            className="pl-10 bg-white/5 border-white/10 focus:border-primary/50 text-white placeholder:text-white/20 transition-all"
                                            value={email}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 col-span-1 md:col-span-2">
                            <h3 className="text-sm font-semibold uppercase tracking-wider text-primary flex items-center gap-2">
                                <Building className="h-4 w-4" /> Tenant Configuration
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="tenant_name" className="text-white/80">Company/Tenant Name</Label>
                                    <div className="relative group">
                                        <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 group-focus-within:text-primary transition-colors" />
                                        <Input
                                            id="tenant_name"
                                            placeholder="Solar Solutions Ltd"
                                            className="pl-10 bg-white/5 border-white/10 focus:border-primary/50 text-white placeholder:text-white/20 transition-all"
                                            value={tenantName}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTenantName(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="password" className="text-white/80">Secure Password</Label>
                                    <div className="relative group">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 group-focus-within:text-primary transition-colors" />
                                        <Input
                                            id="password"
                                            type="password"
                                            className="pl-10 bg-white/5 border-white/10 focus:border-primary/50 text-white placeholder:text-white/20 transition-all"
                                            value={password}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col space-y-4 pb-8">
                        <Button
                            type="submit"
                            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-12 text-base font-bold transition-all hover:scale-[1.01] active:scale-[0.99] shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)] group"
                            disabled={loading}
                        >
                            {loading ? (
                                <div className="flex items-center gap-2">
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent"></div>
                                    Building your workspace...
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    Start Free Trial <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                </div>
                            )}
                        </Button>

                        <p className="text-center text-sm text-white/60">
                            Already have an account?{" "}
                            <Link href="/login" className="text-primary hover:text-primary/80 font-medium underline underline-offset-4 transition-colors">
                                Sign in
                            </Link>
                        </p>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
