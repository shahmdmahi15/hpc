import { requireAuth } from "@/lib/guard";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { getDailyCashLedger } from "@/actions/billing";
import { getAdminRooms } from "@/actions/rooms";
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
  ShieldCheck,
  KeyRound,
  ArrowRight,
  DoorOpen,
  DollarSign,
  Package,
  Clock,
  ChevronRight,
} from "lucide-react";
import prisma from "@/lib/prisma";
import { Role } from "@/generated/prisma/enums";
import { normalizeIpAddress } from "@/lib/device";
import { formatBSTTime } from "@/lib/date";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Administrator Command Center | Health And Pain Care Center",
  description:
    "Executive clinic operations, chambers, CEO daily audit ledger, packages, and security command center",
};

export default async function AdminDashboardPage() {
  const session = await requireAuth([Role.ADMIN]);

  const [
    initialLedger,
    rooms,
    totalUsers,
    totalSessions,
    totalPackages,
    recentAuditLogs,
    activeSessions,
  ] = await Promise.all([
    getDailyCashLedger(),
    getAdminRooms(),
    prisma.user.count(),
    prisma.session.count({
      where: {
        expiresAt: { gt: new Date() },
        revokedAt: null,
      },
    }),
    prisma.patientPackage.count(),
    prisma.auditLog.findMany({
      take: 6,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            name: true,
            role: true,
          },
        },
      },
    }),
    prisma.session.findMany({
      take: 4,
      where: {
        expiresAt: { gt: new Date() },
        revokedAt: null,
      },
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            name: true,
            role: true,
          },
        },
      },
    }),
  ]);

  const totalCollected = initialLedger.reduce(
    (acc, curr) => acc + (curr.paidAmount || 0),
    0,
  );
  const totalBeds = rooms.reduce((acc, r) => acc + (r.capacity || 0), 0);
  const activeRooms = rooms.filter((r) => r.isActive).length;
  const staffOnlyRooms = rooms.filter((r) => r.isStaffOnly).length;

  const ROLE_BADGE_STYLES: Record<Role, string> = {
    [Role.ADMIN]: "border-red-500/30 bg-red-500/10 text-red-500",
    [Role.DOCTOR]: "border-cyan-500/30 bg-cyan-500/10 text-cyan-500",
    [Role.RECEPTIONIST]:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
    [Role.HANDLER]: "border-amber-500/30 bg-amber-500/10 text-amber-500",
  };

  return (
    <DashboardLayout
      user={session.user}
      headerTitle="System Command Center"
      badgeText="Superuser &amp; CEO Operations"
    >
      <div className="space-y-3.5 w-full max-w-full min-w-0">
        {/* Executive Quick Launch Grid */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-foreground">
                Management Modules
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Dedicated management control centers for clinic operations.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {/* 1. Booking Slots & Serials */}
            <Link href="/admin/slots" className="group block">
              <Card className="p-3 border-border bg-card hover:border-amber-500/50 transition-all shadow-xs hover:shadow-sm h-full flex flex-col justify-between rounded-xl">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      <Clock className="h-4 w-4" />
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[9px] font-bold text-amber-600 dark:text-amber-400 px-1.5 py-0"
                    >
                      Dynamic Slots &amp; Capacity
                    </Badge>
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold text-foreground mt-2 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors flex items-center gap-1">
                    <span>Booking Slots &amp; Serials</span>
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Hourly slot scheduling, 6-patient max ticket capacity, and
                    interval configuration.
                  </p>
                </div>
                <div className="mt-2.5 pt-2 border-t border-border/60 flex items-center justify-between text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                  <span>Manage Booking Slots</span>
                  <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
                </div>
              </Card>
            </Link>

            {/* 2. Chambers & Rooms */}
            <Link href="/admin/rooms" className="group block">
              <Card className="p-3 border-border bg-card hover:border-primary/50 transition-all shadow-xs hover:shadow-sm h-full flex flex-col justify-between rounded-xl">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                      <DoorOpen className="h-4 w-4" />
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[9px] font-bold px-1.5 py-0"
                    >
                      {rooms.length} Chambers
                    </Badge>
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold text-foreground mt-2 group-hover:text-primary transition-colors flex items-center gap-1">
                    <span>Chambers &amp; Rooms Management</span>
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Chambers 201–220, flexible bed count (0–50), gender
                    preference, and staff-only access.
                  </p>
                </div>
                <div className="mt-2.5 pt-2 border-t border-border/60 flex items-center justify-between text-[11px] font-semibold text-primary">
                  <span>Open Room Manager</span>
                  <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
                </div>
              </Card>
            </Link>

            {/* 3. Daily Cash Ledger */}
            <Link href="/admin/ledger" className="group block">
              <Card className="p-3 border-border bg-card hover:border-emerald-500/50 transition-all shadow-xs hover:shadow-sm h-full flex flex-col justify-between rounded-xl">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <DollarSign className="h-4 w-4" />
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[9px] font-mono font-bold text-emerald-600 dark:text-emerald-400 px-1.5 py-0"
                    >
                      ৳{totalCollected.toLocaleString()} Today
                    </Badge>
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold text-foreground mt-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors flex items-center gap-1">
                    <span>CEO Daily Cash Ledger</span>
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Audit cashier receipts, verify non-payment (N.P) visits, and
                    grant CEO ledger sign-off.
                  </p>
                </div>
                <div className="mt-2.5 pt-2 border-t border-border/60 flex items-center justify-between text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <span>Audit Cash Ledger</span>
                  <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
                </div>
              </Card>
            </Link>

            {/* 4. 21-30 Day Packages */}
            <Link href="/admin/packages" className="group block">
              <Card className="p-3 border-border bg-card hover:border-purple-500/50 transition-all shadow-xs hover:shadow-sm h-full flex flex-col justify-between rounded-xl">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                      <Package className="h-4 w-4" />
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[9px] font-bold text-purple-600 dark:text-purple-400 px-1.5 py-0"
                    >
                      {totalPackages} Packages
                    </Badge>
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold text-foreground mt-2 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors flex items-center gap-1">
                    <span>21–30 Day Packages</span>
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Long-term rehabilitation packages, installment tracking, and
                    daily credit logs.
                  </p>
                </div>
                <div className="mt-2.5 pt-2 border-t border-border/60 flex items-center justify-between text-[11px] font-semibold text-purple-600 dark:text-purple-400">
                  <span>Manage Packages</span>
                  <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
                </div>
              </Card>
            </Link>

            {/* 5. Staff & Role Access */}
            <Link href="/admin/users" className="group block">
              <Card className="p-3 border-border bg-card hover:border-cyan-500/50 transition-all shadow-xs hover:shadow-sm h-full flex flex-col justify-between rounded-xl">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                      <Users className="h-4 w-4" />
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[9px] font-bold text-cyan-600 dark:text-cyan-400 px-1.5 py-0"
                    >
                      {totalUsers} Staff
                    </Badge>
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold text-foreground mt-2 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors flex items-center gap-1">
                    <span>Staff &amp; Role Management</span>
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Doctor, Receptionist, and Care Handler accounts,
                    credentials, and access permissions.
                  </p>
                </div>
                <div className="mt-2.5 pt-2 border-t border-border/60 flex items-center justify-between text-[11px] font-semibold text-cyan-600 dark:text-cyan-400">
                  <span>Manage Accounts</span>
                  <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
                </div>
              </Card>
            </Link>

            {/* 6. Active Sessions */}
            <Link href="/admin/sessions" className="group block">
              <Card className="p-3 border-border bg-card hover:border-amber-500/50 transition-all shadow-xs hover:shadow-sm h-full flex flex-col justify-between rounded-xl">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      <KeyRound className="h-4 w-4" />
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[9px] font-bold text-amber-600 dark:text-amber-400 px-1.5 py-0"
                    >
                      {totalSessions} Active
                    </Badge>
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold text-foreground mt-2 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors flex items-center gap-1">
                    <span>Active Login Sessions</span>
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Live device tracking, IP address telemetry, and remote
                    session revocation.
                  </p>
                </div>
                <div className="mt-2.5 pt-2 border-t border-border/60 flex items-center justify-between text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                  <span>Inspect Sessions</span>
                  <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
                </div>
              </Card>
            </Link>
          </div>
        </div>

        {/* Realtime KPI Overview (Compact) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Card className="p-2 sm:p-2.5 border-border bg-card shadow-xs">
            <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase">
              Total Chambers
            </span>
            <p className="text-lg sm:text-xl font-black mt-0.5 font-mono text-foreground">
              {rooms.length} Rooms
            </p>
            <span className="text-[9px] sm:text-[10px] text-muted-foreground block">
              {activeRooms} Active &bull; {staffOnlyRooms} Staff
            </span>
          </Card>

          <Card className="p-2 sm:p-2.5 border-border bg-card shadow-xs">
            <span className="text-[10px] sm:text-[11px] font-semibold text-primary uppercase">
              Clinic Beds
            </span>
            <p className="text-lg sm:text-xl font-black mt-0.5 font-mono text-primary">
              {totalBeds} Beds
            </p>
            <span className="text-[9px] sm:text-[10px] text-muted-foreground block">
              Concurrent treatment capacity
            </span>
          </Card>

          <Card className="p-2 sm:p-2.5 border-border bg-card shadow-xs">
            <span className="text-[10px] sm:text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase">
              Today&apos;s Desk Cash
            </span>
            <p className="text-lg sm:text-xl font-black mt-0.5 font-mono text-emerald-600 dark:text-emerald-400">
              ৳{totalCollected.toLocaleString()}
            </p>
            <span className="text-[9px] sm:text-[10px] text-muted-foreground block">
              Verified cashier receipts
            </span>
          </Card>

          <Card className="p-2 sm:p-2.5 border-border bg-card shadow-xs">
            <span className="text-[10px] sm:text-[11px] font-semibold text-cyan-600 dark:text-cyan-400 uppercase">
              Active Staff Logins
            </span>
            <p className="text-lg sm:text-xl font-black mt-0.5 font-mono text-cyan-600 dark:text-cyan-400">
              {totalSessions} Online
            </p>
            <span className="text-[9px] sm:text-[10px] text-muted-foreground block">
              Across {totalUsers} staff accounts
            </span>
          </Card>
        </div>

        {/* Security & Audit Trail Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Audit Logs */}
          <Card className="shadow-xs border-border bg-card">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <span>Recent Security &amp; Clinical Actions</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Latest system activities recorded
                </CardDescription>
              </div>
              <Link href="/admin/logs">
                <Button variant="ghost" size="sm" className="text-xs h-7 gap-1">
                  <span>View All</span>
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/60">
                {recentAuditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 text-xs flex items-center justify-between hover:bg-muted/30"
                  >
                    <div>
                      <div className="font-semibold text-foreground">
                        {log.details || log.action}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                        {log.user?.name || "System"} &bull;{" "}
                        {formatBSTTime(log.createdAt)}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[9px] font-mono">
                      {log.action}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Active Sessions Telemetry */}
          <Card className="shadow-xs border-border bg-card">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-emerald-500" />
                  <span>Active Login Sessions</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Currently connected staff devices
                </CardDescription>
              </div>
              <Link href="/admin/sessions">
                <Button variant="ghost" size="sm" className="text-xs h-7 gap-1">
                  <span>View All</span>
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/60">
                {activeSessions.map((s) => (
                  <div
                    key={s.id}
                    className="p-3 text-xs flex items-center justify-between hover:bg-muted/30"
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-7 w-7 border border-border">
                        <AvatarFallback className="text-[10px] font-bold">
                          {s.user.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-bold text-foreground flex items-center gap-1.5">
                          <span>{s.user.name}</span>
                          <Badge
                            variant="outline"
                            className={`text-[9px] px-1 py-0 h-3.5 ${ROLE_BADGE_STYLES[s.user.role]}`}
                          >
                            {s.user.role}
                          </Badge>
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                          {s.device || "Browser"} &bull;{" "}
                          {normalizeIpAddress(s.ipAddress)}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {s.lastAccessAt
                        ? formatBSTTime(s.lastAccessAt)
                        : "Active"}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
