"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher, useI18n } from "@/lib/i18n";
import { FullscreenToggle } from "@/components/fullscreen-toggle";
import { LoginForm } from "@/components/login/login-form";
import { ShortcutsModal } from "@/components/login/shortcuts-modal";
import { ROLES, type RoleConfig } from "@/components/login/role-config";
import { Role } from "@/generated/prisma/enums";
import {
  ShieldCheck,
  KeyRound,
  Shield,
  Activity,
  CheckCircle2,
  Cpu,
  Tv,
  Clock,
  CalendarDays,
  Keyboard,
} from "lucide-react";
import { useLiveClock } from "@/hooks/use-live-clock";

export function LoginView() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const currentTime = useLiveClock();
  const [selectedRole, setSelectedRole] = React.useState<Role>(Role.ADMIN);
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false);

  const currentRoleObj: RoleConfig =
    ROLES.find((r) => r.value === selectedRole) || ROLES[0];

  // Global Keyboard Navigation & Power-User Shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e || typeof e.key !== "string") return;

      const activeEl = document.activeElement;
      const isInput =
        activeEl?.tagName === "INPUT" || activeEl?.tagName === "TEXTAREA";

      // 1. Role Quick Selection: Keys 1-5 (direct when outside input, or Alt/Ctrl+1-5)
      if (
        ["1", "2", "3", "4", "5"].includes(e.key) &&
        (!isInput || e.altKey || e.ctrlKey)
      ) {
        e.preventDefault();
        const roleMatch = ROLES.find((r) => r.shortcut === e.key);
        if (roleMatch) {
          setSelectedRole(roleMatch.value);
          const pwd = document.getElementById("password") as HTMLInputElement;
          pwd?.focus();
        }
        return;
      }

      // 2. Open Shortcuts Help Dialog with '?'
      if (e.key === "?" && !isInput) {
        e.preventDefault();
        setShortcutsOpen((prev) => !prev);
        return;
      }

      // 3. Focus password input with '/' or 'p'
      if ((e.key === "/" || e.key.toLowerCase() === "p") && !isInput) {
        e.preventDefault();
        const pwd = document.getElementById("password") as HTMLInputElement;
        pwd?.focus();
        return;
      }

      // 4. Navigate to Waiting Room with 'w'
      if (e.key.toLowerCase() === "w" && !isInput) {
        e.preventDefault();
        router.push("/");
        return;
      }

      // 5. Toggle Fullscreen with 'f'
      if (e.key.toLowerCase() === "f" && !isInput) {
        e.preventDefault();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen?.().catch(() => {});
        } else {
          document.exitFullscreen?.().catch(() => {});
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  const formattedTime = currentTime
    ? currentTime.toLocaleTimeString(lang === "bn" ? "bn-BD" : "en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      })
    : null;

  const formattedDay = currentTime
    ? currentTime.toLocaleDateString(lang === "bn" ? "bn-BD" : "en-US", {
        weekday: "long",
      })
    : null;

  const formattedDate = currentTime
    ? currentTime.toLocaleDateString(lang === "bn" ? "bn-BD" : "en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const features = [
    {
      icon: Cpu,
      title: t(
        "login.feature_argon",
        "Argon2id Memory-Hard Cryptographic Hashing",
      ),
      color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    },
    {
      icon: KeyRound,
      title: t(
        "login.feature_session",
        "Database-backed SHA-256 Session Tokens",
      ),
      color: "text-cyan-500 bg-cyan-500/10 border-cyan-500/20",
    },
    {
      icon: Shield,
      title: t(
        "login.feature_rbac",
        "Role-Based Access Control (5 Departments)",
      ),
      color: "text-purple-500 bg-purple-500/10 border-purple-500/20",
    },
    {
      icon: Activity,
      title: t("login.feature_audit", "Real-Time Immutable Audit Logging"),
      color: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    },
  ];

  return (
    <div className="relative flex-1 min-h-screen w-full flex flex-col justify-between bg-gradient-to-br from-background via-muted/15 to-background text-foreground selection:bg-primary/20 transition-colors duration-700">
      {/* Dynamic Ambient Glow Meshes (Smoothly adapt to the active role theme) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden -z-10">
        <div
          className={`absolute -top-24 -left-24 w-80 h-80 sm:w-[460px] sm:h-[460px] rounded-full blur-3xl transition-all duration-700 animate-pulse ${currentRoleObj.glowTop}`}
        />
        <div
          className={`absolute top-1/3 -right-24 w-72 h-72 sm:w-[400px] sm:h-[400px] rounded-full blur-3xl transition-all duration-700 ${currentRoleObj.glowRight}`}
        />
        <div
          className={`absolute -bottom-24 left-1/3 w-80 h-80 sm:w-[460px] sm:h-[460px] rounded-full blur-3xl transition-all duration-700 ${currentRoleObj.glowBottom}`}
        />
      </div>

      {/* Top Navbar */}
      <header className="w-full px-4 sm:px-6 md:px-8 lg:px-12 py-2.5 sm:py-3.5 flex items-center justify-between gap-3 sm:gap-4 z-20 max-w-[1700px] mx-auto shrink-0">
        <div className="flex items-center gap-3">
          <BrandLogo size="md" variant="full" />
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {/* Live Date, Day & Time Badge */}
          {currentTime && (
            <div className="hidden md:flex items-center gap-2 sm:gap-2.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl border border-border/80 bg-card/75 backdrop-blur-md shadow-xs text-left">
              <div className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                <Clock className="h-3.5 w-3.5" />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-[11px] sm:text-xs font-bold font-mono tracking-tight text-foreground">
                  {formattedTime}
                </span>
                <span className="text-[9.5px] sm:text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                  <CalendarDays className="h-2.5 w-2.5 text-primary/70 shrink-0" />
                  <span className="font-semibold text-foreground/90">
                    {formattedDay}
                  </span>
                  <span>&bull;</span>
                  <span className="truncate">{formattedDate}</span>
                </span>
              </div>
            </div>
          )}

          {/* Operational Status Pill */}
          <div className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold shadow-xs backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="tracking-tight">
              {t("header.operational", "Operational")}
            </span>
          </div>

          {/* Waiting Room Display Icon Button */}
          <Link
            href="/"
            title={t("header.waiting_room", "Waiting Room Display")}
            aria-label={t("header.waiting_room", "Waiting Room Display")}
            className="group relative flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl border border-border/80 bg-card/75 hover:bg-muted hover:border-primary/40 text-muted-foreground hover:text-foreground shadow-xs backdrop-blur-md transition-all duration-200 cursor-pointer active:scale-95"
          >
            <Tv className="h-4 w-4 transition-transform duration-200 group-hover:scale-110 text-muted-foreground group-hover:text-primary" />
            <span className="sr-only">
              {t("header.waiting_room", "Waiting Room Display")}
            </span>
          </Link>

          {/* Fullscreen Toggle Icon Button */}
          <FullscreenToggle className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl border border-border/80 bg-card/75 hover:bg-muted hover:border-primary/40 text-muted-foreground hover:text-foreground shadow-xs backdrop-blur-md transition-all duration-200 cursor-pointer active:scale-95" />

          {/* Keyboard Shortcuts Icon Button */}
          <button
            type="button"
            onClick={() => setShortcutsOpen(true)}
            title="Keyboard Shortcuts (?)"
            aria-label="Keyboard Shortcuts"
            className="hidden sm:flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl border border-border/80 bg-card/75 hover:bg-muted hover:border-primary/40 text-muted-foreground hover:text-foreground shadow-xs backdrop-blur-md transition-all duration-200 cursor-pointer active:scale-95"
          >
            <Keyboard className="h-4 w-4" />
          </button>

          {/* Language Switcher */}
          <LanguageSwitcher className="h-8 sm:h-9 px-1 rounded-xl bg-card/75 border-border/80 shadow-xs backdrop-blur-md" />

          {/* Theme Toggle */}
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-[1500px] mx-auto px-4 sm:px-6 md:px-8 lg:px-12 py-2 sm:py-4 flex flex-col items-center justify-center z-10">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 xl:gap-12 items-center">
          {/* Left Hero Showcase */}
          <div className="hidden lg:flex lg:col-span-5 flex-col justify-center space-y-3.5 xl:space-y-4 pr-2">
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10.5px] font-bold tracking-wide uppercase w-fit shadow-xs backdrop-blur-md transition-all duration-500 ${currentRoleObj.badgeColor}`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>
                {currentRoleObj.defaultLabel} •{" "}
                {t("login.badge", "Encrypted Access")}
              </span>
            </div>

            <div className="space-y-1.5">
              <h1 className="text-2xl xl:text-3xl font-black tracking-tight text-foreground leading-tight">
                {t("login.hero_title", "Enterprise Clinical & Staff Access")}
              </h1>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t(
                  "login.hero_subtitle",
                  "High-performance clinic operations, authenticated device sessions, and role-based access security.",
                )}
              </p>
            </div>

            {/* Feature Security Pills */}
            <div className="space-y-2 pt-0.5">
              {features.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div
                    key={idx}
                    className="group flex items-center gap-2.5 p-2 rounded-xl border border-border/70 bg-card/60 dark:bg-card/40 backdrop-blur-md transition-all duration-200 hover:border-primary/40 hover:bg-card/90 shadow-xs hover:shadow-sm"
                  >
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-transform duration-200 group-hover:scale-105 ${item.color}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-xs font-semibold text-foreground leading-snug">
                      {item.title}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Trust Footer */}
            <div className="pt-1.5 flex items-center gap-3 text-[10.5px] text-muted-foreground border-t border-border/60">
              <div className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                <span>Zero-Trust RBAC</span>
              </div>
              <div className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                <span>HTTP-Only Cookies</span>
              </div>
              <div className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                <span>Immutable Logs</span>
              </div>
            </div>
          </div>

          {/* Right Form Card */}
          <div className="w-full lg:col-span-7 max-w-lg mx-auto">
            <LoginForm
              selectedRole={selectedRole}
              onSelectRole={(role) => setSelectedRole(role)}
              onOpenShortcuts={() => setShortcutsOpen(true)}
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full px-4 sm:px-6 md:px-8 lg:px-12 py-2 sm:py-2.5 text-center text-[10.5px] text-muted-foreground z-10 border-t border-border/40 max-w-[1700px] mx-auto shrink-0 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-1">
          <p>
            &copy; {new Date().getFullYear()} Health And Pain Care Center (HPC).
            All rights reserved.
          </p>
          <div className="flex items-center gap-2.5 text-[10px]">
            <span className="hover:text-foreground transition-colors cursor-default">
              Encrypted Session Engine
            </span>
            <span>&bull;</span>
            <span className="hover:text-foreground transition-colors cursor-default">
              ISO/IEC Compliant Protocol
            </span>
          </div>
        </div>
      </footer>

      {/* Power-User Keyboard Shortcuts Modal */}
      <ShortcutsModal open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </div>
  );
}
