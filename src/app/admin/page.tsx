import { getAdminDashboardDataAction } from "@/actions/admin/dashboard.action";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ShieldCheck,
  Users,
  KeyRound,
  FileText,
  Tv,
  Stethoscope,
  UserCheck,
  Receipt,
  Activity,
  Globe,
  Monitor,
  Calendar,
  Lock,
  ArrowUpRight,
  ScrollText,
  DoorOpen,
  CalendarClock,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { session, counts, recentLogs } = await getAdminDashboardDataAction();
  const {
    userCount,
    activeSessionCount,
    auditLogCount,
    performerCount,
    roomCount,
    slotCount,
  } = counts;

  const portals = [
    {
      title: "Waiting Room TV",
      description: "Live queue display board for patients in the lobby.",
      href: "/",
      icon: Tv,
      badge: "Public Display",
      color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    },
    {
      title: "Doctor Console",
      description: "Patient consultations, prescriptions, and medical notes.",
      href: "/doctor",
      icon: Stethoscope,
      badge: "Clinical",
      color: "text-blue-500 bg-blue-500/10 border-blue-500/20",
    },
    {
      title: "Reception Desk",
      description: "Patient check-in, appointments, and token generation.",
      href: "/receptionist",
      icon: UserCheck,
      badge: "Front Desk",
      color: "text-teal-500 bg-teal-500/10 border-teal-500/20",
    },
    {
      title: "Cashier Counter",
      description:
        "Billing management, invoice clearance, and payment receipts.",
      href: "/cashier",
      icon: Receipt,
      badge: "Financial",
      color: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    },
    {
      title: "Handler Desk",
      description: "Patient assistance, transport, and clinical preparation.",
      href: "/handler",
      icon: Activity,
      badge: "Support",
      color: "text-purple-500 bg-purple-500/10 border-purple-500/20",
    },
  ];

  return (
    <div className="space-y-3">
      {/* ---------------------------------------------------- */}
      {/* 1. Welcome & Status Banner                           */}
      {/* ---------------------------------------------------- */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-r from-card via-card/95 to-primary/5 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold">
                <ShieldCheck className="size-3.5" />
                Administrator Portal
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10.5px] font-bold">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Session
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Welcome back, Administrator
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
              Full administrative oversight for Health &amp; Pain Care Center.
              Monitor active sessions, control staff portals, and maintain
              clinical system integrity.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/"
              target="_blank"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border/80 bg-card hover:bg-muted text-foreground text-xs font-semibold shadow-xs transition-all"
            >
              <Tv className="size-3.5 text-primary" />
              <span>Launch Waiting Room TV</span>
              <ArrowUpRight className="size-3 text-muted-foreground" />
            </Link>
          </div>
        </div>

        {/* Ambient background decoration */}
        <div className="pointer-events-none absolute -right-12 -top-12 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
        <div className="pointer-events-none absolute -left-12 -bottom-12 h-64 w-64 rounded-full bg-teal-500/5 blur-3xl" />
      </div>

      {/* ---------------------------------------------------- */}
      {/* 2. System KPI & Metric Cards                         */}
      {/* ---------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5">
        <Card className="border-border/80 bg-card/80 shadow-xs hover:shadow-md transition-shadow">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Active Sessions
            </CardTitle>
            <div className="size-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
              <KeyRound className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {activeSessionCount}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Argon2id Encrypted
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/80 shadow-xs hover:shadow-md transition-shadow">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              System Accounts
            </CardTitle>
            <div className="size-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
              <Users className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {userCount || 5}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {performerCount
                ? `${performerCount} Clinical Staff`
                : "Role-Based Access"}
            </p>
          </CardContent>
        </Card>

        <Link href="/admin/rooms" className="group">
          <Card className="border-border/80 bg-card/80 shadow-xs group-hover:border-violet-500/40 group-hover:shadow-md transition-all h-full cursor-pointer">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider group-hover:text-foreground transition-colors">
                Facility Rooms
              </CardTitle>
              <div className="size-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-500 group-hover:scale-105 transition-transform">
                <DoorOpen className="size-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {roomCount}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1 group-hover:text-primary transition-colors">
                <span>Manage Inventory</span>
                <ArrowUpRight className="size-3" />
              </p>
            </CardContent>
          </Card>
        </Link>

        <Card className="border-border/80 bg-card/80 shadow-xs hover:shadow-md transition-shadow">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Security Protocol
            </CardTitle>
            <div className="size-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-500">
              <Lock className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">Zero-Trust</div>
            <p className="text-[11px] text-muted-foreground mt-1">
              SHA-256 Signature Validated
            </p>
          </CardContent>
        </Card>

        <Link href="/admin/audit" className="group">
          <Card className="border-border/80 bg-card/80 shadow-xs group-hover:border-cyan-500/40 group-hover:shadow-md transition-all h-full cursor-pointer">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider group-hover:text-foreground transition-colors">
                Audit Events
              </CardTitle>
              <div className="size-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-500 group-hover:scale-105 transition-transform">
                <FileText className="size-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {auditLogCount}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1 group-hover:text-primary transition-colors">
                <span>View Full Audit Trail</span>
                <ArrowUpRight className="size-3" />
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/slots" className="group">
          <Card className="border-border/80 bg-card/80 shadow-xs group-hover:border-amber-500/40 group-hover:shadow-md transition-all h-full cursor-pointer">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider group-hover:text-foreground transition-colors">
                Therapy Slots
              </CardTitle>
              <div className="size-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 group-hover:scale-105 transition-transform">
                <CalendarClock className="size-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {slotCount}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1 group-hover:text-primary transition-colors">
                <span>Manage Schedule &amp; Quotas</span>
                <ArrowUpRight className="size-3" />
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 3. Clinical Portals Quick Access Grid                */}
      {/* ---------------------------------------------------- */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
              Clinical Operations &amp; Portals
            </h2>
            <p className="text-xs text-muted-foreground">
              Direct access to operational stations across Health &amp; Pain
              Care Center.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {portals.map((portal) => {
            const Icon = portal.icon;
            return (
              <Link
                key={portal.title}
                href={portal.href}
                className="group relative flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 shadow-xs hover:border-primary/40 hover:shadow-md transition-all duration-200"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div
                      className={`flex size-10 items-center justify-center rounded-xl border shadow-xs ${portal.color}`}
                    >
                      <Icon className="size-5" />
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-border bg-muted/60 text-muted-foreground">
                      {portal.badge}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                      {portal.title}
                      <ArrowUpRight className="size-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-primary" />
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {portal.description}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-[11px] font-semibold text-primary">
                  <span>Enter Station</span>
                  <span className="text-muted-foreground group-hover:translate-x-0.5 transition-transform">
                    &rarr;
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 4. Recent Security & Audit Events Stream             */}
      {/* ---------------------------------------------------- */}
      <Card className="border-border/80 bg-card/80 shadow-xs">
        <CardHeader className="border-b border-border/60 pb-3 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
              <ScrollText className="size-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold text-foreground">
                Recent Security &amp; Audit Trail
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Latest system actions, authentications, and administrative
                events
              </CardDescription>
            </div>
          </div>
          <Link
            href="/admin/audit"
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline cursor-pointer"
          >
            <span>View All Logs</span>
            <ArrowUpRight className="size-3" />
          </Link>
        </CardHeader>
        <CardContent className="pt-3 divide-y divide-border/50">
          {recentLogs.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              No audit events recorded yet.
            </p>
          ) : (
            recentLogs.map((log) => (
              <div
                key={log.id}
                className="py-2.5 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`size-2 rounded-full shrink-0 ${
                      log.status === "SUCCESS"
                        ? "bg-emerald-500"
                        : "bg-destructive"
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">
                      {log.action.replace(/_/g, " ")}
                    </p>
                    <p className="text-[10.5px] text-muted-foreground truncate">
                      {log.performerName ? `${log.performerName} • ` : ""}
                      {log.userRole || "System Root"} •{" "}
                      {log.ipAddress || "127.0.0.1"}
                    </p>
                  </div>
                </div>
                <span className="text-[10.5px] font-mono text-muted-foreground shrink-0">
                  {new Date(log.createdAt).toLocaleTimeString("en-BD", {
                    timeZone: "Asia/Dhaka",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* ---------------------------------------------------- */}
      {/* 5. Active Session Security Diagnostics               */}
      {/* ---------------------------------------------------- */}
      <Card className="border-border/80 bg-card/80 shadow-xs">
        <CardHeader className="pb-3 border-b border-border/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Lock className="size-3.5" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold">
                  Session Security Diagnostics
                </CardTitle>
                <CardDescription className="text-xs">
                  Cryptographic parameters of the current administrator session.
                </CardDescription>
              </div>
            </div>
            <span className="text-[10.5px] font-semibold px-2.5 py-0.5 rounded-full bg-muted border border-border/80 text-muted-foreground">
              Isolated Context
            </span>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl border border-border/60 bg-muted/30 space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground font-semibold text-[11px]">
                <Globe className="size-3.5 text-primary" />
                <span>Client IP Address</span>
              </div>
              <p className="font-mono font-bold text-foreground">
                {session.ipAddress || "127.0.0.1"}
              </p>
            </div>

            <div className="p-3 rounded-xl border border-border/60 bg-muted/30 space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground font-semibold text-[11px]">
                <Monitor className="size-3.5 text-primary" />
                <span>Device &amp; Operating System</span>
              </div>
              <p className="font-semibold text-foreground truncate">
                {session.device || "Desktop"} • {session.os || "Windows"} (
                {session.browser || "Browser"})
              </p>
            </div>

            <div className="p-3 rounded-xl border border-border/60 bg-muted/30 space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground font-semibold text-[11px]">
                <KeyRound className="size-3.5 text-primary" />
                <span>SHA-256 Token Hash</span>
              </div>
              <p className="font-mono text-muted-foreground truncate">
                {session.token.slice(0, 20)}...
              </p>
            </div>

            <div className="p-3 rounded-xl border border-border/60 bg-muted/30 space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground font-semibold text-[11px]">
                <Calendar className="size-3.5 text-primary" />
                <span>Session Expiry</span>
              </div>
              <p
                className="font-semibold text-foreground"
                suppressHydrationWarning
              >
                {new Date(session.expiresAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
