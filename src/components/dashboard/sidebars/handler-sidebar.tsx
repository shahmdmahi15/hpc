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
  Activity,
  Users,
  ClipboardList,
  User,
} from "lucide-react";
import { Role } from "@/generated/prisma/enums";

interface HandlerSidebarProps {
  user: {
    id: string;
    name: string;
    role: Role;
  };
}

export function HandlerSidebar({ user }: HandlerSidebarProps) {
  const pathname = usePathname();

  const navItems = [
    { title: "Care & Handler Hub", href: "/handler", icon: LayoutDashboard },
    { title: "Rehab Sessions", href: "/handler#sessions", icon: Activity },
    { title: "Patient Transport", href: "/handler#transport", icon: Users },
    {
      title: "Triage Assistance",
      href: "/handler#triage",
      icon: ClipboardList,
    },
    { title: "My Profile", href: "/handler/profile", icon: User },
  ];

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-border bg-card/95 backdrop-blur-md"
    >
      <SidebarBrandHeader href="/handler" />

      <SidebarContent>
        {/* Handler Hub Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Therapy & Care Handler</SidebarGroupLabel>
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
                      <Icon className="h-4 w-4 shrink-0 text-amber-500" />
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
