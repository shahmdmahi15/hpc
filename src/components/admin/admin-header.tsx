"use client";

import * as React from "react";
import Link from "next/link";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/lib/i18n";
import { FullscreenToggle } from "@/components/fullscreen-toggle";
import { logoutAction } from "@/actions/login/login.action";
import { Button } from "@/components/ui/button";
import type { Session, User } from "@/generated/prisma/client";
import { Tv, LogOut } from "lucide-react";

interface AdminHeaderProps {
  session?: Session;
  user?: User | { id: string; role: string };
}

export function AdminHeader({ session, user }: AdminHeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex h-14 w-full items-center justify-between gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur-md transition-all">
      {/* Left side: Sidebar Trigger & Breadcrumbs */}
      <div className="flex items-center gap-2.5">
        <SidebarTrigger className="h-8 w-8 rounded-lg border border-border/80 hover:bg-muted/80 text-foreground cursor-pointer" />
        <Separator orientation="vertical" className="h-4 bg-border/80" />

        <div className="flex items-center gap-1.5 text-xs">
          <Link
            href="/admin"
            className="font-semibold text-foreground hover:text-primary transition-colors"
          >
            HPC Admin
          </Link>
          <span className="text-muted-foreground/60">/</span>
          <span className="font-medium text-muted-foreground">
            {user?.role ? "Administrator" : "Dashboard"}
          </span>
        </div>

        <div className="hidden md:inline-flex items-center gap-1.5 ml-2 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold">
          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>
            {session?.ipAddress
              ? `Online (${session.ipAddress})`
              : "System Online"}
          </span>
        </div>
      </div>

      {/* Right side: Quick utility actions */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Waiting Room TV Display Link */}
        <Link
          href="/"
          target="_blank"
          title="Open Waiting Room TV in new tab"
          className="group flex h-8 items-center gap-1.5 rounded-lg border border-border/80 bg-card px-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground hover:border-primary/40 shadow-xs transition-all cursor-pointer"
        >
          <Tv className="size-3.5 text-primary transition-transform group-hover:scale-110" />
          <span className="hidden sm:inline">Waiting Room TV</span>
        </Link>

        <FullscreenToggle className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/80 bg-card text-muted-foreground hover:text-foreground hover:bg-muted shadow-xs transition-all cursor-pointer" />
        <LanguageSwitcher className="h-8 px-1.5 rounded-lg bg-card border-border/80 text-xs shadow-xs" />
        <ThemeToggle />

        {/* Quick Sign Out */}
        <form action={logoutAction}>
          <Button
            type="submit"
            variant="outline"
            size="sm"
            className="h-8 px-2.5 rounded-lg gap-1.5 text-xs font-semibold cursor-pointer hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
          >
            <LogOut className="size-3.5" />
            <span className="hidden md:inline">Sign Out</span>
          </Button>
        </form>
      </div>
    </header>
  );
}
