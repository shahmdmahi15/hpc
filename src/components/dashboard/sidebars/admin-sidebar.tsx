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
  Users,
  User,
  ShieldCheck,
  KeyRound,
} from "lucide-react";
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

  const navItems = [
    { title: "System Overview", href: "/admin", icon: LayoutDashboard },
    { title: "Staff & Role Access", href: "/admin/users", icon: Users },
    { title: "Active Sessions", href: "/admin/sessions", icon: KeyRound },
    { title: "Audit & Security Logs", href: "/admin/logs", icon: ShieldCheck },
    { title: "My Profile", href: "/admin/profile", icon: User },
  ];

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-border bg-card/95 backdrop-blur-md"
    >
      <SidebarBrandHeader href="/admin" />

      <SidebarContent>
        {/* Administrator Primary Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Administrator Panel</SidebarGroupLabel>
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
