"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Role } from "@/generated/prisma/enums";
import { AdminSidebar } from "./sidebars/admin-sidebar";
import { DoctorSidebar } from "./sidebars/doctor-sidebar";
import { ReceptionistSidebar } from "./sidebars/receptionist-sidebar";
import { HandlerSidebar } from "./sidebars/handler-sidebar";

export interface AppSidebarProps {
  user: {
    id: string;
    name: string;
    role: Role;
  };
}

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();

  // Match sidebar dynamically based on active route path
  if (pathname.startsWith("/doctor")) {
    return <DoctorSidebar user={user} />;
  }
  if (pathname.startsWith("/receptionist")) {
    return <ReceptionistSidebar user={user} />;
  }
  if (pathname.startsWith("/handler")) {
    return <HandlerSidebar user={user} />;
  }
  if (pathname.startsWith("/admin")) {
    return <AdminSidebar user={user} />;
  }

  // Fallback to role-specific sidebar
  switch (user.role) {
    case Role.ADMIN:
      return <AdminSidebar user={user} />;
    case Role.DOCTOR:
      return <DoctorSidebar user={user} />;
    case Role.RECEPTIONIST:
      return <ReceptionistSidebar user={user} />;
    case Role.HANDLER:
      return <HandlerSidebar user={user} />;
    default:
      return <DoctorSidebar user={user} />;
  }
}

export { AdminSidebar, DoctorSidebar, ReceptionistSidebar, HandlerSidebar };
