import Link from "next/link";
import { BrandLogo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/lib/i18n";
import { FullscreenToggle } from "@/components/fullscreen-toggle";
import { logoutAction } from "@/actions/login/login.action";
import { Button } from "@/components/ui/button";
import { ROLES, type RoleConfig } from "@/components/login/role-config";
import type { Role } from "@/generated/prisma/enums";
import type { Session } from "@/generated/prisma/client";
import {
  ShieldCheck,
  LogOut,
  Tv,
  Globe,
  Monitor,
  KeyRound,
  Calendar,
  CheckCircle2,
} from "lucide-react";

interface RolePortalViewProps {
  role: Role;
  session: Session;
}

export function RolePortalView({ role, session }: RolePortalViewProps) {
  const roleConfig: RoleConfig =
    ROLES.find((r) => r.value === role) || ROLES[0];
  const RoleIcon = roleConfig.icon;

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between bg-gradient-to-br from-background via-muted/15 to-background text-foreground selection:bg-primary/20">
      {/* Background Animated Glow Meshes */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden -z-10">
        <div
          className={`absolute -top-24 -left-24 w-96 h-96 rounded-full blur-3xl transition-all duration-700 animate-pulse ${roleConfig.glowTop}`}
        />
        <div
          className={`absolute top-1/2 -right-24 w-96 h-96 rounded-full blur-3xl transition-all duration-700 ${roleConfig.glowRight}`}
        />
        <div
          className={`absolute -bottom-24 left-1/3 w-96 h-96 rounded-full blur-3xl transition-all duration-700 ${roleConfig.glowBottom}`}
        />
      </div>

      {/* Top Navbar */}
      <header className="w-full px-4 sm:px-6 md:px-8 lg:px-12 py-3 flex items-center justify-between gap-4 border-b border-border/60 bg-card/75 backdrop-blur-xl z-20 shrink-0">
        <div className="flex items-center gap-3">
          <BrandLogo size="md" variant="full" />
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/"
            title="Waiting Room TV Display"
            className="group flex h-9 w-9 items-center justify-center rounded-xl border border-border/80 bg-card/80 hover:bg-muted hover:border-primary/40 text-muted-foreground hover:text-foreground shadow-xs backdrop-blur-md transition-all duration-200 cursor-pointer active:scale-95"
          >
            <Tv className="h-4 w-4 transition-transform group-hover:scale-110" />
            <span className="sr-only">Waiting Room TV</span>
          </Link>

          <FullscreenToggle className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/80 bg-card/80 hover:bg-muted hover:border-primary/40 text-muted-foreground hover:text-foreground shadow-xs backdrop-blur-md transition-all duration-200 cursor-pointer active:scale-95" />
          <LanguageSwitcher className="h-9 px-1 rounded-xl bg-card/80 border-border/80 shadow-xs backdrop-blur-md" />
          <ThemeToggle />

          <form action={logoutAction}>
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="h-9 px-3 rounded-xl gap-1.5 text-xs font-semibold cursor-pointer hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </form>
        </div>
      </header>

      {/* Main Role Portal Content */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col items-center justify-center z-10">
        <div className="w-full rounded-3xl border border-border/80 bg-card/85 dark:bg-card/70 backdrop-blur-2xl shadow-2xl p-6 sm:p-8 lg:p-10 space-y-6">
          {/* Header & Role Badge */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/60">
            <div className="flex items-center gap-3.5">
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-2xl border shadow-md ${roleConfig.color}`}
              >
                <RoleIcon className="h-7 w-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                    {roleConfig.defaultLabel}
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10.5px] font-bold">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Active Session
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {roleConfig.defaultDesc}
                </p>
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-primary/20 bg-primary/10 text-primary text-xs font-bold w-fit">
              <ShieldCheck className="h-4 w-4" />
              <span>Role Authenticated Portal</span>
            </div>
          </div>

          {/* Session Security Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs">
            <div className="p-3.5 rounded-2xl border border-border/60 bg-background/50 space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground font-semibold text-[11px]">
                <Globe className="h-3.5 w-3.5 text-primary" />
                <span>Client IP Address</span>
              </div>
              <p className="font-mono font-bold text-foreground text-sm">
                {session.ipAddress || "127.0.0.1"}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl border border-border/60 bg-background/50 space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground font-semibold text-[11px]">
                <Monitor className="h-3.5 w-3.5 text-primary" />
                <span>Device & Operating System</span>
              </div>
              <p className="font-semibold text-foreground truncate">
                {session.device || "Desktop"} • {session.os || "Windows"} (
                {session.browser || "Browser"})
              </p>
            </div>

            <div className="p-3.5 rounded-2xl border border-border/60 bg-background/50 space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground font-semibold text-[11px]">
                <KeyRound className="h-3.5 w-3.5 text-primary" />
                <span>Session Hash (SHA-256)</span>
              </div>
              <p className="font-mono text-xs text-muted-foreground truncate">
                {session.token.slice(0, 24)}...
              </p>
            </div>

            <div className="p-3.5 rounded-2xl border border-border/60 bg-background/50 space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground font-semibold text-[11px]">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                <span>Session Expiry</span>
              </div>
              <p className="font-semibold text-foreground">
                {new Date(session.expiresAt).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>

          {/* Quick Actions & Navigation */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <span>Zero-Trust Security</span>
              </div>
              <div className="flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <span>Argon2id Memory-Hard</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <Link
                href="/"
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-border/80 bg-muted hover:bg-muted/80 text-foreground text-xs font-bold transition-all shadow-xs"
              >
                <Tv className="h-3.5 w-3.5 text-primary" />
                <span>Waiting Room TV</span>
              </Link>

              <form action={logoutAction} className="flex-1 sm:flex-none">
                <Button
                  type="submit"
                  size="sm"
                  className="w-full sm:w-auto rounded-xl text-xs font-bold shadow-md cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5 mr-1" />
                  <span>Sign Out</span>
                </Button>
              </form>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full px-4 sm:px-6 md:px-8 lg:px-12 py-3 text-center text-[10.5px] text-muted-foreground z-10 border-t border-border/40 max-w-[1700px] mx-auto shrink-0 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-1">
          <p>
            &copy; {new Date().getFullYear()} Health And Pain Care Center (HPC).
            All rights reserved.
          </p>
          <div className="flex items-center gap-2.5 text-[10px]">
            <span>Encrypted Session Engine</span>
            <span>&bull;</span>
            <span>ISO/IEC Compliant Protocol</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
