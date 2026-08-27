import { requireAuth } from "@/lib/guard";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { AdminWorkspace } from "@/components/admin/admin-workspace";
import { getDailyCashLedger } from "@/actions/billing";
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

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Administrator Command Center | Health And Pain Care Center",
  description:
    "CEO daily audit ledger, 21-30 day package cards, security metrics, and clinic command center",
};

export default async function AdminDashboardPage() {
  const session = await requireAuth([Role.ADMIN]);

  const [
    initialLedger,
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
    getDailyCashLedger(),
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
    BILLING_CREATE: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
    BILLING_AUDIT: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
    SERIAL_CREATE: "border-cyan-500/30 bg-cyan-500/10 text-cyan-500",
    SERIAL_STATUS_CHANGE: "border-amber-500/30 bg-amber-500/10 text-amber-500",
  };

  return (
    <DashboardLayout
      user={session.user}
      headerTitle="System Command Center"
      badgeText="Superuser &amp; CEO Operations"
    >
      <div className="space-y-8">
        {/* Real-time CEO Financial Ledger & Package Administration */}
        <AdminWorkspace initialLedger={initialLedger} />

        {/* System Administration & Telemetry */}
        <div className="space-y-6 pt-4 border-t border-border/80">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                IT Security &amp; Clinical Telemetry
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Staff accounts, zero-trust session tokens, and immutable audit
                logs.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/admin/logs">
                <Button
                  variant="outline"
                  className="cursor-pointer gap-2 font-semibold text-xs h-8"
                >
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <span>Audit Trail</span>
                </Button>
              </Link>
              <Link href="/admin/users">
                <Button className="cursor-pointer gap-2 font-semibold shadow-md shadow-primary/20 text-xs h-8">
                  <Users className="h-4 w-4" />
                  <span>Manage Staff</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 shadow-sm border-border bg-card/85">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase">
                  Active Staff
                </span>
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Users className="h-4 w-4" />
                </div>
              </div>
              <p className="text-2xl font-bold mt-2 text-foreground font-mono">
                {totalUsers}
              </p>
              <span className="text-[11px] text-muted-foreground mt-1 block">
                Across 4 departments
              </span>
            </Card>

            <Card className="p-4 shadow-sm border-border bg-card/85">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-500 uppercase">
                  Active Sessions
                </span>
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                  <KeyRound className="h-4 w-4" />
                </div>
              </div>
              <p className="text-2xl font-bold mt-2 text-foreground font-mono">
                {totalSessions}
              </p>
              <span className="text-[11px] text-muted-foreground mt-1 block">
                With device &amp; IP telemetry
              </span>
            </Card>

            <Card className="p-4 shadow-sm border-border bg-card/85">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-cyan-500 uppercase">
                  Realtime Bus
                </span>
                <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-500">
                  <Activity className="h-4 w-4" />
                </div>
              </div>
              <p className="text-2xl font-bold mt-2 text-foreground font-mono">
                SSE Stream
              </p>
              <span className="text-[11px] text-muted-foreground mt-1 block">
                Node EventEmitter Bus
              </span>
            </Card>

            <Card className="p-4 shadow-sm border-border bg-card/85">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-500 uppercase">
                  Security Engine
                </span>
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
                  <ShieldAlert className="h-4 w-4" />
                </div>
              </div>
              <p className="text-2xl font-bold mt-2 text-foreground font-mono">
                Argon2id
              </p>
              <span className="text-[11px] text-emerald-500 font-medium mt-1 block">
                Memory-hard encryption
              </span>
            </Card>
          </div>

          {/* Department Staff & Omni Panels */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 shadow-sm border-border bg-card/85">
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
                    <div className="text-xl font-bold text-foreground font-mono">
                      {doctorCount}
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      Clinical Specialists
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                    <div className="flex items-center gap-2 text-emerald-500 mb-1.5">
                      <Headphones className="h-4 w-4" />
                      <span className="text-xs font-semibold">Reception</span>
                    </div>
                    <div className="text-xl font-bold text-foreground font-mono">
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
                    <div className="text-xl font-bold text-foreground font-mono">
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
                    <div className="text-xl font-bold text-foreground font-mono">
                      {adminCount}
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      Superusers
                    </span>
                  </div>
                </div>

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

            <Card className="shadow-sm border-border bg-card/85">
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
                    title: "Live Waiting Room Kiosk",
                    href: "/",
                    desc: "Public patient display & caller",
                    icon: Users,
                    color:
                      "text-purple-500 bg-purple-500/10 border-purple-500/20",
                  },
                  {
                    title: "Doctor Clinical Panel",
                    href: "/doctor",
                    desc: "Clinical queues & VAS assessment",
                    icon: Stethoscope,
                    color: "text-cyan-500 bg-cyan-500/10 border-cyan-500/20",
                  },
                  {
                    title: "Front Desk Reception",
                    href: "/receptionist",
                    desc: "Patient intake & cash ledger",
                    icon: Headphones,
                    color:
                      "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
                  },
                  {
                    title: "Therapy & Handler Hub",
                    href: "/handler",
                    desc: "Session logs & bay timing",
                    icon: UserCheck,
                    color: "text-amber-500 bg-amber-500/10 border-amber-500/20",
                  },
                ].map((panel) => {
                  const Icon = panel.icon;
                  return (
                    <Link key={panel.href} href={panel.href} className="block">
                      <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-background/50 hover:bg-muted/40 hover:border-primary/30 transition-all cursor-pointer">
                        <div className="flex items-center gap-3">
                          <div
                            className={`p-2 rounded-lg border ${panel.color}`}
                          >
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
        </div>
      </div>
    </DashboardLayout>
  );
}
