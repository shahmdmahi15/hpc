import { requireAuth } from "@/lib/guard";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import {
  Users,
  ShieldAlert,
  ShieldCheck,
  KeyRound,
  Database,
  ArrowRight,
  Stethoscope,
  Headphones,
  UserCheck,
  Activity,
  Laptop,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
} from "lucide-react";
import prisma from "@/lib/prisma";
import { Role } from "@/generated/prisma/enums";
import { normalizeIpAddress } from "@/lib/device";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Administrator Overview | Health And Pain Care Center",
  description:
    "System administration, security metrics, and clinic command center",
};

export default async function AdminDashboardPage() {
  const session = await requireAuth([Role.ADMIN]);

  const [
    totalUsers,
    totalSessions,
    doctorCount,
    receptionistCount,
    handlerCount,
    adminCount,
    recentUsers,
    recentAuditLogs,
    activeSessions,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.session.count({
      where: {
        expiresAt: { gt: new Date() },
        revokedAt: null,
      },
    }),
    prisma.user.count({ where: { role: Role.DOCTOR } }),
    prisma.user.count({ where: { role: Role.RECEPTIONIST } }),
    prisma.user.count({ where: { role: Role.HANDLER } }),
    prisma.user.count({ where: { role: Role.ADMIN } }),
    prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        role: true,
        createdAt: true,
      },
    }),
    prisma.auditLog.findMany({
      take: 6,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    }),
    prisma.session.findMany({
      where: {
        expiresAt: { gt: new Date() },
        revokedAt: null,
      },
      take: 4,
      orderBy: { lastAccessAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    }),
  ]);

  const ROLE_BADGE_STYLES: Record<Role, string> = {
    [Role.ADMIN]: "border-red-500/30 bg-red-500/10 text-red-500",
    [Role.DOCTOR]: "border-cyan-500/30 bg-cyan-500/10 text-cyan-500",
    [Role.RECEPTIONIST]:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
    [Role.HANDLER]: "border-amber-500/30 bg-amber-500/10 text-amber-500",
  };

  const AUDIT_ACTION_STYLES: Record<string, string> = {
    LOGIN_SUCCESS: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
    LOGIN_FAILURE: "border-red-500/30 bg-red-500/10 text-red-500",
    LOGOUT: "border-slate-500/30 bg-slate-500/10 text-slate-400",
    USER_CREATE: "border-cyan-500/30 bg-cyan-500/10 text-cyan-500",
    USER_UPDATE: "border-blue-500/30 bg-blue-500/10 text-blue-500",
    USER_PASSWORD_RESET: "border-amber-500/30 bg-amber-500/10 text-amber-500",
    USER_DELETE: "border-rose-500/30 bg-rose-500/10 text-rose-500",
    USER_SESSIONS_REVOKED:
      "border-purple-500/30 bg-purple-500/10 text-purple-500",
    PROFILE_UPDATE: "border-teal-500/30 bg-teal-500/10 text-teal-500",
    PASSWORD_UPDATE: "border-amber-500/30 bg-amber-500/10 text-amber-500",
  };

  return (
    <DashboardLayout
      user={session.user}
      headerTitle="System Command Center"
      badgeText="Superuser Operations"
    >
      <div className="space-y-6">
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Administrator Overview
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Clinic operational telemetry, system security status, and staff
              access controls.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/logs">
              <Button
                variant="outline"
                className="cursor-pointer gap-2 font-semibold text-xs h-9"
              >
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span>Audit Trail</span>
              </Button>
            </Link>
            <Link href="/admin/users">
              <Button className="cursor-pointer gap-2 font-semibold shadow-md shadow-primary/20 text-xs h-9">
                <Users className="h-4 w-4" />
                <span>Manage Staff</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        {/* 1. Metric Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 shadow-sm border-border bg-card/85 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                Active Staff
              </span>
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-2 text-foreground">
              {totalUsers}
            </p>
            <span className="text-[11px] text-muted-foreground mt-1 block">
              Across 4 clinical departments
            </span>
          </Card>

          <Card className="p-4 shadow-sm border-border bg-card/85 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-500 uppercase">
                Active Sessions
              </span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                <KeyRound className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-2 text-foreground">
              {totalSessions}
            </p>
            <span className="text-[11px] text-muted-foreground mt-1 block">
              With device & IP telemetry
            </span>
          </Card>

          <Card className="p-4 shadow-sm border-border bg-card/85 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-cyan-500 uppercase">
                Database Engine
              </span>
              <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-500">
                <Database className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-2 text-foreground">SQLite 3</p>
            <span className="text-[11px] text-muted-foreground mt-1 block">
              Prisma 8 Pure TypeScript Client
            </span>
          </Card>

          <Card className="p-4 shadow-sm border-border bg-card/85 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-500 uppercase">
                Security Engine
              </span>
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
                <ShieldAlert className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-2 text-foreground">Argon2id</p>
            <span className="text-[11px] text-emerald-500 font-medium mt-1 block">
              64MB Memory / 3 Iterations
            </span>
          </Card>
        </div>

        {/* 2. Department Breakdown & Quick Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Department Staff Allocation */}
          <Card className="lg:col-span-2 shadow-sm border-border bg-card/85 backdrop-blur-md">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-bold">
                  Department Staff Distribution
                </CardTitle>
                <CardDescription className="text-xs">
                  Active authorized accounts per operational unit
                </CardDescription>
              </div>
              <Link href="/admin/users">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1.5 cursor-pointer"
                >
                  <span>View All</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl border border-cyan-500/20 bg-cyan-500/5">
                  <div className="flex items-center gap-2 text-cyan-500 mb-1.5">
                    <Stethoscope className="h-4 w-4" />
                    <span className="text-xs font-semibold">Doctors</span>
                  </div>
                  <div className="text-xl font-bold text-foreground">
                    {doctorCount}
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    Clinical Staff
                  </span>
                </div>

                <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                  <div className="flex items-center gap-2 text-emerald-500 mb-1.5">
                    <Headphones className="h-4 w-4" />
                    <span className="text-xs font-semibold">Reception</span>
                  </div>
                  <div className="text-xl font-bold text-foreground">
                    {receptionistCount}
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    Intake Staff
                  </span>
                </div>

                <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5">
                  <div className="flex items-center gap-2 text-amber-500 mb-1.5">
                    <UserCheck className="h-4 w-4" />
                    <span className="text-xs font-semibold">Handlers</span>
                  </div>
                  <div className="text-xl font-bold text-foreground">
                    {handlerCount}
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    Therapy Staff
                  </span>
                </div>

                <div className="p-3.5 rounded-xl border border-red-500/20 bg-red-500/5">
                  <div className="flex items-center gap-2 text-red-500 mb-1.5">
                    <ShieldAlert className="h-4 w-4" />
                    <span className="text-xs font-semibold">Admins</span>
                  </div>
                  <div className="text-xl font-bold text-foreground">
                    {adminCount}
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    Superusers
                  </span>
                </div>
              </div>

              {/* Recent Accounts List */}
              <div className="mt-5 space-y-2">
                <span className="text-xs font-semibold text-muted-foreground block mb-2">
                  Recently Onboarded Team Members
                </span>
                {recentUsers.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-border/60 bg-muted/20 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">
                          {u.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-semibold text-foreground">
                        {u.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="outline"
                        className={ROLE_BADGE_STYLES[u.role]}
                      >
                        {u.role}
                      </Badge>
                      <span
                        suppressHydrationWarning
                        className="text-[11px] text-muted-foreground"
                      >
                        {new Date(u.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Omni-Access Quick Jump */}
          <Card className="shadow-sm border-border bg-card/85 backdrop-blur-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <span>Omni-Access Panels</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Jump directly into any operational dashboard
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {[
                {
                  title: "Doctor Clinical Panel",
                  href: "/doctor",
                  desc: "Clinical queues & treatment plans",
                  icon: Stethoscope,
                  color: "text-cyan-500 bg-cyan-500/10 border-cyan-500/20",
                },
                {
                  title: "Front Desk Reception",
                  href: "/receptionist",
                  desc: "Patient appointments & intake",
                  icon: Headphones,
                  color:
                    "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
                },
                {
                  title: "Therapy & Handler Hub",
                  href: "/handler",
                  desc: "Rehab sessions & logistics",
                  icon: UserCheck,
                  color: "text-amber-500 bg-amber-500/10 border-amber-500/20",
                },
              ].map((panel) => {
                const Icon = panel.icon;
                return (
                  <Link key={panel.href} href={panel.href} className="block">
                    <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-background/50 hover:bg-muted/40 hover:border-primary/30 transition-all cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg border ${panel.color}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-foreground">
                            {panel.title}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {panel.desc}
                          </div>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* 3. Live Security Audit Trail & Enriched Sessions Telemetry */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Security Audit Feed */}
          <Card className="lg:col-span-2 shadow-sm border-border bg-card/85 backdrop-blur-md">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <span>Recent Security & Audit Events</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Real-time immutable activity log across authentication and
                  data operations
                </CardDescription>
              </div>
              <Link href="/admin/logs">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1.5 cursor-pointer"
                >
                  <span>Full Audit Trail</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {recentAuditLogs.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  No security events recorded yet. Perform a login or profile
                  action to initiate audit telemetry.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {recentAuditLogs.map((log) => {
                    const badgeStyle =
                      AUDIT_ACTION_STYLES[log.action] ||
                      "border-muted bg-muted/20 text-muted-foreground";

                    return (
                      <div
                        key={log.id}
                        className="flex items-center justify-between p-2.5 rounded-xl border border-border/60 bg-muted/20 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {log.status === "SUCCESS" ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                          )}
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-mono font-semibold shrink-0 ${badgeStyle}`}
                          >
                            {log.action}
                          </Badge>
                          <span className="font-semibold text-foreground truncate">
                            {log.user?.name || "System"}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-[11px] font-mono text-muted-foreground">
                            {normalizeIpAddress(log.ipAddress)}
                          </span>
                          <span
                            suppressHydrationWarning
                            className="text-[11px] text-muted-foreground flex items-center gap-1"
                          >
                            <Clock className="h-3 w-3" />
                            {new Date(log.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Enriched Active Sessions Telemetry */}
          <Card className="shadow-sm border-border bg-card/85 backdrop-blur-md">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Laptop className="h-4 w-4 text-emerald-500" />
                  <span>Active Session Telemetry</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Enriched client device, OS, and IP metadata
                </CardDescription>
              </div>
              <Link
                href="/admin/sessions"
                className="text-xs text-primary hover:underline font-semibold flex items-center gap-1"
              >
                <span>Control Center</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {activeSessions.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  No active sessions found.
                </div>
              ) : (
                activeSessions.map((s) => (
                  <div
                    key={s.id}
                    className="p-2.5 rounded-xl border border-border/60 bg-muted/20 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">
                        {s.user.name}
                      </span>
                      <Badge
                        variant="outline"
                        className={ROLE_BADGE_STYLES[s.user.role]}
                      >
                        {s.user.role}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Laptop className="h-3 w-3" />
                        {s.os || "Windows"} • {s.browser || "Chrome"}
                      </span>
                      <span className="font-mono">
                        {normalizeIpAddress(s.ipAddress)}
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground/80 flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      <span suppressHydrationWarning>
                        Last active:{" "}
                        {s.lastAccessAt
                          ? new Date(s.lastAccessAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Just now"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
