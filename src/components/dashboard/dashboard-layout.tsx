"use client";

import * as React from "react";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { FullscreenToggle } from "@/components/fullscreen-toggle";
import { LanguageSwitcher, useI18n } from "@/lib/i18n";
import { Separator } from "@/components/ui/separator";
import type { Role } from "@/generated/prisma/enums";

interface DashboardLayoutProps {
  user: {
    id: string;
    name: string;
    role: Role;
  };
  children: React.ReactNode;
  headerTitle?: string;
  badgeText?: string;
}

export function DashboardLayout({
  user,
  children,
  headerTitle = "Dashboard",
  badgeText,
}: DashboardLayoutProps) {
  const { t } = useI18n();

  // Map known titles to i18n keys
  const displayTitle = React.useMemo(() => {
    if (headerTitle === "Front Desk & Reception")
      return t("nav.front_desk", headerTitle);
    if (headerTitle === "Doctor Clinical Workstation")
      return t("nav.doctor_hub", headerTitle);
    if (headerTitle === "Care Handler Execution Hub")
      return t("nav.handler_hub", headerTitle);
    if (headerTitle === "System Command Center")
      return t("nav.system_command", headerTitle);
    if (headerTitle === "Chambers & Rooms Management")
      return t("nav.chambers", headerTitle);
    if (headerTitle === "Daily Slot & Serial Control")
      return t("nav.slots", headerTitle);
    if (headerTitle === "Executive Cashier & Audit Ledger")
      return t("nav.ledger", headerTitle);
    if (headerTitle === "21-30 Day Rehabilitation Packages")
      return t("nav.packages", headerTitle);
    if (headerTitle === "Staff Directory & Role Control")
      return t("nav.users", headerTitle);
    if (headerTitle === "Security & Compliance Audit Logs")
      return t("nav.logs", headerTitle);
    if (headerTitle === "Active Session Security Management")
      return t("nav.sessions", headerTitle);
    return headerTitle;
  }, [headerTitle, t]);

  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar user={user} />
      <SidebarInset className="bg-background min-h-screen min-w-0 max-w-full overflow-x-hidden">
        {/* Top Navbar */}
        <header className="sticky top-0 z-20 flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border bg-card/80 px-3 sm:px-4 backdrop-blur-md transition-all min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <SidebarTrigger className="h-7 w-7" />
            <Separator orientation="vertical" className="h-3.5" />
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-xs sm:text-sm font-bold tracking-tight text-foreground truncate">
                {displayTitle}
              </h1>
              {badgeText && (
                <span className="hidden sm:inline-flex items-center rounded-full border border-border bg-muted/60 px-2 py-0.2 text-[10px] font-medium text-muted-foreground shrink-0">
                  {badgeText}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <LanguageSwitcher />
            <FullscreenToggle />
            <ThemeToggle />
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-2.5 sm:p-3.5 md:p-4 space-y-3.5 max-w-[1600px] w-full mx-auto min-w-0 overflow-x-hidden">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
