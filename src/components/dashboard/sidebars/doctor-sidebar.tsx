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
import { Stethoscope, Tv, User } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Role } from "@/generated/prisma/enums";

interface DoctorSidebarProps {
  user: {
    id: string;
    name: string;
    role: Role;
  };
}

export function DoctorSidebar({ user }: DoctorSidebarProps) {
  const pathname = usePathname();
  const { t } = useI18n();

  const navItems = [
    {
      title: t("nav.doctor_hub", "Clinical Workspace"),
      href: "/doctor",
      icon: Stethoscope,
    },
    { title: t("nav.kiosk", "Live Waiting Kiosk"), href: "/", icon: Tv },
    {
      title: t("nav.profile", "My Profile"),
      href: "/doctor/profile",
      icon: User,
    },
  ];

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-border bg-card/95 backdrop-blur-md"
    >
      <SidebarBrandHeader href="/doctor" />

      <SidebarContent>
        {/* Doctor Clinical Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Doctor Clinical Panel</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={isActive}
                      tooltip={item.title}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-primary" />
                      <span className="truncate">{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* If the active user is an Admin, show the Omni-Nav quick switcher */}
        {user.role === Role.ADMIN && <AdminOmniNav />}
      </SidebarContent>

      <SidebarUserFooter user={user} />
    </Sidebar>
  );
}
