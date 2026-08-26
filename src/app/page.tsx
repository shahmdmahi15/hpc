import { getCurrentSession } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/logo";
import { Card } from "@/components/ui/card";
import { getRoleDashboard } from "@/proxy";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  Stethoscope,
  Headphones,
  UserCheck,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  LogIn,
  LayoutDashboard,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const sessionData = await getCurrentSession();

  const services = [
    {
      title: "Specialized Pain Therapy",
      role: "Pain Care Specialists (Doctor)",
      description:
        "Comprehensive interventional pain diagnostics, nerve blocks, chronic musculoskeletal management, and personalized care pathways.",
      icon: Stethoscope,
      color: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
    },
    {
      title: "Rehabilitation & Care Logistics",
      role: "Care & Therapy Handlers",
      description:
        "Dedicated physiotherapeutic gait assistance, electrotherapy (TENS), cryotherapy prep, and compassionate mobility handling.",
      icon: UserCheck,
      color: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    },
    {
      title: "Front Desk & Intake Operations",
      role: "Patient Receptionists",
      description:
        "Seamless patient admissions, appointment scheduling, waiting lounge queue tracking, and patient consultation coordination.",
      icon: Headphones,
      color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    },
    {
      title: "Clinical System Administration",
      role: "System Administrators",
      description:
        "Zero-trust encrypted database session security, role authorizations, audit logs, and medical IT systems management.",
      icon: ShieldAlert,
      color: "bg-red-500/10 text-red-500 border-red-500/20",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background text-foreground flex flex-col transition-colors duration-300">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/60 bg-card/80 px-4 sm:px-8 backdrop-blur-md">
        <BrandLogo size="md" variant="full" />
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {sessionData ? (
            <Link
              href={getRoleDashboard(sessionData.user.role)}
              className={cn(
                buttonVariants({ size: "sm" }),
                "font-semibold cursor-pointer flex items-center gap-2",
              )}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Go to {sessionData.user.role} Panel</span>
            </Link>
          ) : (
            <Link
              href="/login"
              className={cn(
                buttonVariants({ size: "sm" }),
                "font-semibold cursor-pointer flex items-center gap-2",
              )}
            >
              <LogIn className="h-4 w-4" />
              <span>Staff Login</span>
            </Link>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-8 py-12 sm:py-20 max-w-6xl mx-auto w-full text-center space-y-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-border bg-card/80 backdrop-blur-md shadow-xs text-xs font-semibold text-primary">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Health And Pain Care Center (HPC)</span>
        </div>

        <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-foreground max-w-3xl leading-tight">
          Modern Medical Care &amp;{" "}
          <span className="bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-500 dark:from-emerald-400 dark:via-teal-300 dark:to-cyan-400 bg-clip-text text-transparent">
            Specialized Pain Relief
          </span>
        </h1>

        <p className="text-sm sm:text-base text-muted-foreground max-w-2xl leading-relaxed">
          Integrated clinical operations uniting pain management specialists,
          therapy handlers, front desk coordinators, and medical administrators
          under one secure platform.
        </p>

        {/* CTA Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
          {sessionData ? (
            <Link
              href={getRoleDashboard(sessionData.user.role)}
              className={cn(
                buttonVariants({ size: "lg" }),
                "w-full sm:w-auto px-8 font-bold shadow-xl shadow-primary/20 cursor-pointer flex items-center gap-2",
              )}
            >
              <span>Access {sessionData.user.name}&apos;s Dashboard</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <Link
              href="/login"
              className={cn(
                buttonVariants({ size: "lg" }),
                "w-full sm:w-auto px-8 font-bold shadow-xl shadow-primary/20 cursor-pointer flex items-center gap-2",
              )}
            >
              <span>Access Staff Portal</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>

        {/* Services & Role Panels Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full pt-10 text-left">
          {services.map((s) => {
            const Icon = s.icon;
            return (
              <Card
                key={s.title}
                className="shadow-md border-border bg-card/85 hover:border-primary/40 transition-all duration-300 p-5 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl border ${s.color}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-foreground">
                      {s.title}
                    </h3>
                    <p className="text-[11px] font-semibold text-primary/80 mt-0.5">
                      {s.role}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {s.description}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/60 bg-card/50 py-6 px-4 text-center text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} Health And Pain Care Center (HPC). All
        rights reserved.
      </footer>
    </div>
  );
}
