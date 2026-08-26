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
  Calendar,
  ClipboardList,
  Stethoscope,
  User,
} from "lucide-react";
import { Role } from "@/generated/prisma/enums";

interface ReceptionistSidebarProps {
  user: {
    id: string;
    name: string;
    role: Role;
  };
}

export function ReceptionistSidebar({ user }: ReceptionistSidebarProps) {
  const pathname = usePathname();

  const navItems = [
    { title: "Reception Desk", href: "/receptionist", icon: LayoutDashboard },
    {
      title: "Patient Appointments",
      href: "/receptionist#appointments",
      icon: Calendar,
    },
    {
      title: "Intake & Check-In",
      href: "/receptionist#checkin",
      icon: ClipboardList,
    },
    {
      title: "Doctors On Duty",
      href: "/receptionist#duty",
      icon: Stethoscope,
    },
    { title: "My Profile", href: "/receptionist/profile", icon: User },
  ];

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-border bg-card/95 backdrop-blur-md"
    >
      <SidebarBrandHeader href="/receptionist" />

      <SidebarContent>
        {/* Reception Desk Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Front Desk Reception</SidebarGroupLabel>
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
                      <Icon className="h-4 w-4 shrink-0 text-emerald-500" />
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
