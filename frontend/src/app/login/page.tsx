"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Mail, Lock, LogIn, Github, Chrome } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const { login, loading } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await login({ email, password });
        } catch (error) {
            // Error handling is handled in the context with toasts
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#020617] relative overflow-hidden">
            {/* Background decorative elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]"></div>
            </div>

            <Card className="w-full max-w-md border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl relative z-10 transition-all hover:border-white/20">
                <CardHeader className="space-y-1 text-center">
                    <div className="flex justify-center mb-4">
                        <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center shadow-[0_0_20px_rgba(var(--primary-rgb),0.5)]">
                            <LogIn className="h-6 w-6 text-primary-foreground" />
                        </div>
                    </div>
                    <CardTitle className="text-3xl font-bold tracking-tight text-white">Welcome back</CardTitle>
                    <CardDescription className="text-white/60">
                        Enter your credentials to access your SolarEPC dashboard
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-white/80">Email</Label>
                            <div className="relative group">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 group-focus-within:text-primary transition-colors" />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="name@company.com"
                                    className="pl-10 bg-white/5 border-white/10 focus:border-primary/50 text-white placeholder:text-white/20 transition-all"
                                    value={email}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password" className="text-white/80">Password</Label>
                                <Link
                                    href="/forgot-password"
                                    className="text-xs text-primary hover:text-primary/80 transition-colors"
                                >
                                    Forgot password?
                                </Link>
                            </div>
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
                    </CardContent>
                    <CardFooter className="flex flex-col space-y-4">
                        <Button
                            type="submit"
                            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-11 text-base font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)]"
                            disabled={loading}
                        >
                            {loading ? (
                                <div className="flex items-center gap-2">
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent"></div>
                                    Logging in...
                                </div>
                            ) : (
                                "Sign In"
                            )}
                        </Button>

                        <div className="relative w-full">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-white/10"></span>
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-[#020617] px-2 text-white/40">Or continue with</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 w-full">
                            <Button variant="outline" type="button" className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white transition-all">
                                <Chrome className="mr-2 h-4 w-4" />
                                Google
                            </Button>
                            <Button variant="outline" type="button" className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white transition-all">
                                <Github className="mr-2 h-4 w-4" />
                                GitHub
                            </Button>
                        </div>

                        <p className="text-center text-sm text-white/60">
                            Don't have an account?{" "}
                            <Link href="/signup" className="text-primary hover:text-primary/80 font-medium underline underline-offset-4 transition-colors">
                                Create a tenant
                            </Link>
                        </p>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
