import { getCurrentSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login/login-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandLogo } from "@/components/brand/logo";
import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";

import { getRoleDashboard } from "@/proxy";

export const metadata: Metadata = {
  title: "Staff Login | Health And Pain Care Center",
  description:
    "Secure role-based staff authentication portal for Health And Pain Care Center (HPC)",
};

export default async function LoginPage() {
  const current = await getCurrentSession();

  if (current) {
    redirect(getRoleDashboard(current.user.role));
  }

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 bg-gradient-to-br from-background via-muted/30 to-background overflow-hidden">
      {/* Background Glow Decorations */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 -translate-x-1/2 translate-y-1/2 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Navigation / Theme Toggle */}
      <header className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-3 z-10">
        <ThemeToggle />
      </header>

      {/* Brand Header */}
      <div className="mb-6 flex flex-col items-center gap-3 z-10 text-center">
        <BrandLogo size="lg" variant="full" />
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-card/80 backdrop-blur-md shadow-xs text-xs font-medium text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          <span>Clinical &amp; Staff Access Portal</span>
        </div>
      </div>

      {/* Login Form Card */}
      <main className="w-full max-w-lg z-10">
        <LoginForm />
      </main>

      {/* Footer Branding */}
      <footer className="mt-8 text-center text-xs text-muted-foreground z-10">
        &copy; {new Date().getFullYear()} Health And Pain Care Center (HPC). All
        rights reserved.
      </footer>
    </div>
  );
}
