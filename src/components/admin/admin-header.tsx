"use client";

import * as React from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { FullscreenToggle } from "@/components/fullscreen-toggle";
import { LanguageSwitcher } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/actions/login/login.action";
import {
  Tv,
  LogOut,
  Clock,
  Wifi,
  CalendarDays,
  Shield,
  Stethoscope,
  UserCheck,
  Activity,
  CreditCard,
} from "lucide-react";
import { useLiveClock } from "@/hooks/use-live-clock";
import type { Session, User } from "@/generated/prisma/client";

interface AdminHeaderProps {
  session?: Session;
  user?: User | { id: string; role: string };
}

export function AdminHeader({ session, user }: AdminHeaderProps) {
  const currentTime = useLiveClock();

  return (
    <header className="w-full px-3 sm:px-6 py-1.5 border-b border-border/70 bg-card/85 backdrop-blur-xl sticky top-0 z-30 flex items-center justify-between gap-2.5 shadow-xs">
      {/* 1. Left: Brand & Admin Console Identity */}
      <div className="flex items-center gap-2.5 shrink-0">
        <BrandLogo size="sm" variant="full" />
        <div className="hidden md:flex items-center gap-1.5 pl-2.5 border-l border-border/60">
          <span
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-700 dark:text-purple-300 text-[10.5px] font-bold tracking-wide uppercase"
            title={user?.role ? `Logged in as ${user.role}` : "Administrator Console"}
          >
            <Shield className="size-3 text-purple-600 dark:text-purple-400" />
            <span>{user?.role ? `${user.role} Console` : "Admin Console"}</span>
          </span>
        </div>
      </div>

      {/* 2. Center: Live Digital Clock & Online Status */}
      <div className="hidden lg:flex items-center gap-3">
        {/* Live Clock */}
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-muted/40 border border-border/60 text-xs font-mono">
          <Clock className="size-3 text-purple-500 animate-pulse" />
          <span className="font-bold text-foreground">
            {currentTime
              ? currentTime.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })
              : "--:--:--"}
          </span>
          <span className="text-muted-foreground">•</span>
          <span className="text-muted-foreground flex items-center gap-1 font-sans text-[10.5px]">
            <CalendarDays className="size-2.5 text-muted-foreground" />
            {currentTime
              ? currentTime.toLocaleDateString([], {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "---"}
          </span>
        </div>

        {/* System Online Status */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background border border-border/70 text-[11px] font-medium shadow-xs">
          <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
            <Wifi className="size-3" />
            {session?.ipAddress ? `Online` : "System Online"}
          </span>
        </div>
      </div>

      {/* 3. Right: Utility Controls & Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Quick Portal Switcher for Admin */}
        <div className="hidden xl:flex items-center gap-1 bg-muted/40 p-0.5 rounded-lg border border-border/60 text-xs mr-1">
          <Link
            href="/doctor"
            title="Doctor Console"
            className="px-2 py-0.5 rounded-md hover:bg-background text-muted-foreground hover:text-foreground text-[11px] font-semibold flex items-center gap-1 transition-all"
          >
            <Stethoscope className="size-3 text-sky-500" />
            <span>Doctor</span>
          </Link>
          <Link
            href="/receptionist"
            title="Receptionist Desk"
            className="px-2 py-0.5 rounded-md hover:bg-background text-muted-foreground hover:text-foreground text-[11px] font-semibold flex items-center gap-1 transition-all"
          >
            <UserCheck className="size-3 text-blue-500" />
            <span>Reception</span>
          </Link>
          <Link
            href="/handler"
            title="Therapy Handler Desk"
            className="px-2 py-0.5 rounded-md hover:bg-background text-muted-foreground hover:text-foreground text-[11px] font-semibold flex items-center gap-1 transition-all"
          >
            <Activity className="size-3 text-emerald-500" />
            <span>Handler</span>
          </Link>
          <Link
            href="/cashier"
            title="Cashier & Billing Desk"
            className="px-2 py-0.5 rounded-md hover:bg-background text-muted-foreground hover:text-foreground text-[11px] font-semibold flex items-center gap-1 transition-all"
          >
            <CreditCard className="size-3 text-amber-500" />
            <span>Cashier</span>
          </Link>
        </div>

        {/* Waiting Room TV Display shortcut */}
        <Link
          href="/"
          title="Open Waiting Room Display"
          className="size-8 flex items-center justify-center rounded-lg border border-border/80 bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer shadow-2xs"
        >
          <Tv className="size-3.5" />
        </Link>

        {/* Language Switcher */}
        <LanguageSwitcher className="h-7 px-1.5 rounded-lg bg-card border-border/80 text-[11px] shadow-2xs" />

        {/* Fullscreen & Theme */}
        <FullscreenToggle />
        <ThemeToggle />

        {/* Logout */}
        <form action={logoutAction}>
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
            title="Sign Out"
          >
            <LogOut className="size-3.5" />
          </Button>
        </form>
      </div>
    </header>
  );
}
