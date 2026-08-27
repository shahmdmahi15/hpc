"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  ShieldAlert,
  Stethoscope,
  Headphones,
  UserCheck,
  Tv,
} from "lucide-react";

export function AdminOmniNav() {
  const pathname = usePathname();

  const panels = [
    {
      title: "Admin Command Center",
      href: "/admin",
      icon: ShieldAlert,
    },
    {
      title: "Doctor Clinical Panel",
      href: "/doctor",
      icon: Stethoscope,
    },
    {
      title: "Reception Intake Panel",
      href: "/receptionist",
      icon: Headphones,
    },
    {
      title: "Care Handler Panel",
      href: "/handler",
      icon: UserCheck,
    },
    {
      title: "Live Waiting Room Kiosk",
      href: "/",
      icon: Tv,
    },
  ];

  return (
    <SidebarGroup className="mt-2">
      <SidebarGroupLabel>All Department Panels</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {panels.map((panel) => {
            const Icon = panel.icon;
            const isActive =
              panel.href === "/"
                ? pathname === "/"
                : pathname === panel.href ||
                  pathname.startsWith(`${panel.href}/`);
            return (
              <SidebarMenuItem key={panel.href}>
                <SidebarMenuButton
                  render={<Link href={panel.href} />}
                  isActive={isActive}
                  tooltip={panel.title}
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-xs">{panel.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
