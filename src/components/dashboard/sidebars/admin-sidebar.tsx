"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { SidebarBrandHeader } from "./sidebar-brand-header";
import { SidebarUserFooter } from "./sidebar-user-footer";
import { AdminOmniNav } from "./admin-omni-nav";
import {
  LayoutDashboard,
  DoorOpen,
  DollarSign,
  Package,
  Clock,
  Users,
  KeyRound,
  ShieldCheck,
  User,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { Role } from "@/generated/prisma/enums";

interface AdminSidebarProps {
  user: {
    id: string;
    name: string;
    role: Role;
  };
}

export function AdminSidebar({ user }: AdminSidebarProps) {
  const pathname = usePathname();
  const { t } = useI18n();

  const operationsNav = [
    {
      title: t("nav.dashboard", "System Overview"),
      href: "/admin",
      icon: LayoutDashboard,
    },
    {
      title: t("nav.slots", "Booking Slots & Serials"),
      href: "/admin/slots",
      icon: Clock,
    },
    {
      title: t("nav.chambers", "Chambers & Rooms"),
      href: "/admin/rooms",
      icon: DoorOpen,
    },
    {
      title: t("nav.ledger", "Daily Cash Ledger"),
      href: "/admin/ledger",
      icon: DollarSign,
    },
    {
      title: t("nav.packages", "21-30 Day Packages"),
      href: "/admin/packages",
      icon: Package,
    },
  ];

  const securityNav = [
    {
      title: t("nav.users", "Staff & User Access"),
      href: "/admin/users",
      icon: Users,
    },
    {
      title: t("nav.sessions", "Active Sessions"),
      href: "/admin/sessions",
      icon: KeyRound,
    },
    {
      title: t("nav.logs", "Audit & Security Logs"),
      href: "/admin/logs",
      icon: ShieldCheck,
    },
    {
      title: t("nav.profile", "My Profile"),
      href: "/admin/profile",
      icon: User,
    },
  ];

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-border bg-card/95 backdrop-blur-md"
    >
      <SidebarBrandHeader href="/admin" />

      <SidebarContent>
        {/* Clinic Operations Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Clinic Operations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {operationsNav.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={isActive}
                      tooltip={item.title}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-red-500" />
                      <span className="truncate">{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Security & Access Management Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>
            Security &amp; IT Administration
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {securityNav.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={isActive}
                      tooltip={item.title}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-red-500" />
                      <span className="truncate">{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* All Department Panels for Admin */}
        <AdminOmniNav />
      </SidebarContent>

      <SidebarUserFooter user={user} />
    </Sidebar>
  );
}
