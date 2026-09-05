"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/actions/login/login.action";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Session, User } from "@/generated/prisma/client";
import {
  LayoutDashboard,
  Users,
  Tv,
  Stethoscope,
  UserCheck,
  Receipt,
  Activity,
  LogOut,
  ExternalLink,
  ChevronsUpDown,
  ScrollText,
  DoorOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminSidebarProps extends React.ComponentProps<typeof Sidebar> {
  session: Session;
  user?: User | { id: string; role: string };
}

export function AdminSidebar({
  session,
  user,
  className,
  ...props
}: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <Sidebar
      collapsible="icon"
      variant="sidebar"
      className={cn(
        "border-r border-sidebar-border bg-sidebar transition-all duration-300",
        className,
      )}
      {...props}
    >
      {/* ---------------------------------------------------- */}
      {/* 1. Header: Brand Logo & Title                        */}
      {/* ---------------------------------------------------- */}
      <SidebarHeader className="h-14 border-b border-sidebar-border/80 px-2 flex items-center justify-center">
        <Link
          href="/admin"
          className="flex w-full items-center gap-2.5 transition-opacity hover:opacity-90 group-data-[collapsible=icon]:justify-center"
          title="HPC Admin Portal"
        >
          {/* Logo container: strictly size-8 (32px), perfectly centered */}
          <div className="size-8 rounded-lg overflow-hidden shrink-0 border border-border/80 shadow-xs bg-white flex items-center justify-center">
            <Image
              src="/logo.jpg"
              alt="HPC Logo"
              width={32}
              height={32}
              className="size-full object-cover"
              priority
            />
          </div>

          <div className="flex flex-col truncate leading-tight group-data-[collapsible=icon]:hidden min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold tracking-tight text-sidebar-foreground truncate">
                HPC Admin
              </span>
              <span className="rounded-md bg-primary/10 border border-primary/20 px-1 py-0.2 text-[9px] font-bold text-primary shrink-0">
                v1.0
              </span>
            </div>
            <span className="text-[10.5px] font-medium text-sidebar-foreground/60 truncate">
              Health &amp; Pain Care Center
            </span>
          </div>
        </Link>
      </SidebarHeader>

      {/* ---------------------------------------------------- */}
      {/* 2. Content: Organized Groups & Direct Access Menus   */}
      {/* ---------------------------------------------------- */}
      <SidebarContent className="overflow-y-auto overflow-x-hidden no-scrollbar">
        {/* GROUP 1: Administration */}
        <SidebarGroup className="p-2 group-data-[collapsible=icon]:p-1.5">
          <SidebarGroupLabel className="text-[10.5px] font-bold uppercase tracking-wider text-sidebar-foreground/50 px-2 h-7">
            Administration
          </SidebarGroupLabel>
          <SidebarMenu className="gap-1 group-data-[collapsible=icon]:items-center">
            {/* Dashboard Overview */}
            <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
              <SidebarMenuButton
                render={<Link href="/admin" />}
                isActive={pathname === "/admin"}
                tooltip="Dashboard Overview"
              >
                <LayoutDashboard className="size-4 text-primary" />
                <span className="font-semibold">Dashboard</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Users & Staff Management */}
            <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
              <SidebarMenuButton
                render={<Link href="/admin/users" />}
                isActive={pathname.startsWith("/admin/users")}
                tooltip="User Accounts & Staff Performers"
              >
                <Users className="size-4 text-sky-500" />
                <span className="font-semibold">Users &amp; Staff</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Room & Station Management */}
            <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
              <SidebarMenuButton
                render={<Link href="/admin/rooms" />}
                isActive={pathname.startsWith("/admin/rooms")}
                tooltip="Room & Station Inventory"
              >
                <DoorOpen className="size-4 text-violet-500" />
                <span className="font-semibold">Rooms</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Audit & Compliance Logs */}
            <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
              <SidebarMenuButton
                render={<Link href="/admin/audit" />}
                isActive={pathname.startsWith("/admin/audit")}
                tooltip="Security & Compliance Audit Trail"
              >
                <ScrollText className="size-4 text-emerald-500" />
                <span className="font-semibold">Audit Logs</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        <SidebarSeparator className="my-1 opacity-50" />

        {/* GROUP 2: Department Station Desks */}
        <SidebarGroup className="p-2 group-data-[collapsible=icon]:p-1.5">
          <SidebarGroupLabel className="text-[10.5px] font-bold uppercase tracking-wider text-sidebar-foreground/50 px-2 h-7">
            Department Desks
          </SidebarGroupLabel>
          <SidebarMenu className="gap-1 group-data-[collapsible=icon]:items-center">
            {/* Doctor Desk */}
            <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
              <SidebarMenuButton
                render={<Link href="/doctor" />}
                isActive={pathname.startsWith("/doctor")}
                tooltip="Doctor Console Desk"
              >
                <Stethoscope className="size-4 text-blue-500" />
                <span>Doctor Console</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Reception Desk */}
            <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
              <SidebarMenuButton
                render={<Link href="/receptionist" />}
                isActive={pathname.startsWith("/receptionist")}
                tooltip="Reception & Check-in Desk"
              >
                <UserCheck className="size-4 text-teal-500" />
                <span>Reception Desk</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Cashier Counter */}
            <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
              <SidebarMenuButton
                render={<Link href="/cashier" />}
                isActive={pathname.startsWith("/cashier")}
                tooltip="Cashier Billing Counter"
              >
                <Receipt className="size-4 text-amber-500" />
                <span>Cashier Counter</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Handler Desk */}
            <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
              <SidebarMenuButton
                render={<Link href="/handler" />}
                isActive={pathname.startsWith("/handler")}
                tooltip="Handler & Clinical Prep Desk"
              >
                <Activity className="size-4 text-purple-500" />
                <span>Handler Desk</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        <SidebarSeparator className="my-1 opacity-50" />

        {/* GROUP 3: Public Display */}
        <SidebarGroup className="p-2 group-data-[collapsible=icon]:p-1.5">
          <SidebarGroupLabel className="text-[10.5px] font-bold uppercase tracking-wider text-sidebar-foreground/50 px-2 h-7">
            Public Display
          </SidebarGroupLabel>
          <SidebarMenu className="gap-1 group-data-[collapsible=icon]:items-center">
            {/* Waiting Room TV */}
            <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
              <SidebarMenuButton
                render={<Link href="/" />}
                isActive={pathname === "/"}
                tooltip="Live Waiting Room TV Display"
              >
                <Tv className="size-4 text-emerald-500" />
                <span>Waiting Room TV</span>
                <SidebarMenuBadge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 group-data-[collapsible=icon]:hidden">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse mr-1" />
                  Live
                </SidebarMenuBadge>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      {/* ---------------------------------------------------- */}
      {/* 3. Footer: User Session Card with Centered Avatar    */}
      {/* ---------------------------------------------------- */}
      <SidebarFooter className="border-t border-sidebar-border/80 p-2 flex items-center justify-center">
        <SidebarMenu className="w-full group-data-[collapsible=icon]:items-center">
          <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    tooltip="Administrator (Active Session)"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:justify-center cursor-pointer"
                  />
                }
              >
                <div className="size-8 rounded-lg bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                  {user?.role ? user.role.slice(0, 2).toUpperCase() : "AD"}
                </div>
                <div className="grid flex-1 text-left text-xs leading-tight group-data-[collapsible=icon]:hidden min-w-0">
                  <span className="truncate font-semibold text-sidebar-foreground">
                    {user?.role === "ADMIN"
                      ? "Administrator"
                      : user?.role || "Administrator"}
                  </span>
                  <span className="truncate text-[10.5px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Active Session
                  </span>
                </div>
                <ChevronsUpDown className="ml-auto size-4 text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden" />
              </DropdownMenuTrigger>

              <DropdownMenuContent
                className="w-64 rounded-xl p-2 shadow-xl border-border/80"
                side="top"
                align="start"
                sideOffset={8}
              >
                <DropdownMenuLabel className="p-2 font-normal">
                  <div className="flex items-center gap-2.5">
                    <div className="size-9 rounded-xl bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                      {user?.role ? user.role.slice(0, 2).toUpperCase() : "AD"}
                    </div>
                    <div className="flex flex-col space-y-0.5 min-w-0">
                      <p className="text-xs font-bold leading-none">
                        {user?.role === "ADMIN"
                          ? "Administrator Desk"
                          : `${user?.role || "Administrator"} Desk`}
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-none truncate font-mono">
                        {session.ipAddress || "127.0.0.1"}
                      </p>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                <DropdownMenuItem
                  render={<Link href="/admin/users" />}
                  className="cursor-pointer text-xs"
                >
                  <Users className="mr-2 size-3.5 text-sky-500" />
                  <span>Users &amp; Staff Control</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  render={<Link href="/" />}
                  className="cursor-pointer text-xs"
                >
                  <Tv className="mr-2 size-3.5 text-emerald-500" />
                  <span>Waiting Room TV</span>
                  <ExternalLink className="ml-auto size-3 text-muted-foreground" />
                </DropdownMenuItem>

                <DropdownMenuItem
                  render={<Link href="/doctor" />}
                  className="cursor-pointer text-xs"
                >
                  <Stethoscope className="mr-2 size-3.5 text-blue-500" />
                  <span>Doctor Console</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  render={<Link href="/receptionist" />}
                  className="cursor-pointer text-xs"
                >
                  <UserCheck className="mr-2 size-3.5 text-teal-500" />
                  <span>Reception Desk</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <form action={logoutAction} className="w-full">
                  <button
                    type="submit"
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer"
                  >
                    <LogOut className="size-3.5" />
                    <span>Sign Out</span>
                  </button>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      {/* ---------------------------------------------------- */}
      {/* 4. Rail: Drag/Click toggle handle                    */}
      {/* ---------------------------------------------------- */}
      <SidebarRail />
    </Sidebar>
  );
}
