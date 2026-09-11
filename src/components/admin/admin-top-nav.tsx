"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CalendarClock,
  DoorOpen,
  ScrollText,
  Stethoscope,
  UserCheck,
  Activity,
  CreditCard,
  Tv,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    href: "/admin",
    label: "Overview",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    href: "/admin/users",
    label: "Users & Staff",
    icon: Users,
    exact: false,
  },
  {
    href: "/admin/slots",
    label: "Therapy Slots",
    icon: CalendarClock,
    exact: false,
  },
  {
    href: "/admin/rooms",
    label: "Rooms",
    icon: DoorOpen,
    exact: false,
  },
  {
    href: "/admin/clinical",
    label: "Clinical Config",
    icon: Stethoscope,
    exact: false,
  },
  {
    href: "/admin/audit",
    label: "Audit Logs",
    icon: ScrollText,
    exact: false,
  },
];

export function AdminTopNav() {
  const pathname = usePathname();

  return (
    <nav className="w-full bg-card/60 backdrop-blur-md border-b border-border/70 sticky top-[45px] z-20">
      <div className="max-w-[1700px] mx-auto px-3 sm:px-5 flex items-center justify-between gap-3 overflow-x-auto no-scrollbar py-1">
        {/* Main Admin Navigation Links */}
        <div className="flex items-center gap-1 shrink-0">
          {NAV_ITEMS.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0",
                  isActive
                    ? "bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-transparent",
                )}
              >
                <Icon
                  className={cn(
                    "size-3.5",
                    isActive
                      ? "text-purple-600 dark:text-purple-400"
                      : "text-muted-foreground",
                  )}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Quick Portal Switcher Pills (Visible on smaller screens or right side) */}
        <div className="flex xl:hidden items-center gap-1 shrink-0 pl-2 border-l border-border/60">
          <Link
            href="/doctor"
            title="Doctor Console"
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <Stethoscope className="size-3.5 text-sky-500" />
          </Link>
          <Link
            href="/receptionist"
            title="Receptionist Desk"
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <UserCheck className="size-3.5 text-blue-500" />
          </Link>
          <Link
            href="/handler"
            title="Handler Desk"
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <Activity className="size-3.5 text-emerald-500" />
          </Link>
          <Link
            href="/cashier"
            title="Cashier Desk"
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <CreditCard className="size-3.5 text-amber-500" />
          </Link>
          <Link
            href="/"
            title="Waiting Room TV"
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <Tv className="size-3.5 text-purple-500" />
          </Link>
        </div>
      </div>
    </nav>
  );
}
