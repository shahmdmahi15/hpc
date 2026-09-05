"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AuditFilterBar } from "@/components/admin/audit/audit-filter-bar";
import { AuditEventDetailDialog } from "@/components/admin/audit/audit-event-detail-dialog";
import {
  getAuditLogsAction,
  exportAuditLogsAction,
  type AuditLogFilterParams,
  type EnrichedAuditLog,
  type AuditLogsResult,
} from "@/actions/admin/audit.action";
import { AuditStatus, AuditAction, Role } from "@/generated/prisma/enums";
import { formatBSTDate, formatBSTShortDate } from "@/lib/date";
import { toast } from "sonner";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  FileText,
  Activity,
  Calendar,
  User,
  Phone,
  Eye,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Building2,
  Clock,
  KeyRound,
  UserCheck,
  LogOut,
  UserPlus,
  UserX,
  AlertTriangle,
} from "lucide-react";

interface AuditLogsViewProps {
  initialResult: AuditLogsResult;
  performers: { id: string; name: string; phone: string }[];
}

export function AuditLogsView({
  initialResult,
  performers,
}: AuditLogsViewProps) {
  const [logs, setLogs] = React.useState<EnrichedAuditLog[]>(
    initialResult.logs,
  );
  const [totalCount, setTotalCount] = React.useState(initialResult.totalCount);
  const [totalPages, setTotalPages] = React.useState(initialResult.totalPages);
  const [currentPage, setCurrentPage] = React.useState(
    initialResult.currentPage,
  );
  const [metrics, setMetrics] = React.useState(initialResult.metrics);

  const [filters, setFilters] = React.useState<AuditLogFilterParams>({
    page: 1,
    pageSize: 25,
    dateRange: "all",
  });

  const [selectedLog, setSelectedLog] = React.useState<EnrichedAuditLog | null>(
    null,
  );
  const [isExporting, setIsExporting] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  // Fetch logs whenever filters change
  const fetchLogs = React.useCallback((newFilters: AuditLogFilterParams) => {
    startTransition(async () => {
      const res = await getAuditLogsAction(newFilters);
      if (res.success) {
        setLogs(res.logs);
        setTotalCount(res.totalCount);
        setTotalPages(res.totalPages);
        setCurrentPage(res.currentPage);
        setMetrics(res.metrics);
      } else {
        toast.error("Failed to load audit logs", { description: res.error });
      }
    });
  }, []);

  const handleFilterChange = (partial: Partial<AuditLogFilterParams>) => {
    const updated = { ...filters, ...partial };
    setFilters(updated);
    fetchLogs(updated);
  };

  const handleReset = () => {
    const resetFilters: AuditLogFilterParams = {
      page: 1,
      pageSize: 25,
      dateRange: "all",
    };
    setFilters(resetFilters);
    fetchLogs(resetFilters);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    handleFilterChange({ page: newPage });
  };

  const handleExport = async (format: "csv" | "json") => {
    setIsExporting(true);
    try {
      const res = await exportAuditLogsAction(filters, format);
      if (res.success && res.data && res.filename) {
        const mime =
          format === "json" ? "application/json" : "text/csv;charset=utf-8;";
        const blob = new Blob([res.data], { type: mime });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = res.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success(`Exported ${format.toUpperCase()} file successfully`);
      } else {
        toast.error("Export failed", { description: res.error });
      }
    } catch {
      toast.error("An error occurred during export");
    } finally {
      setIsExporting(false);
    }
  };

  // Helper for badge styling based on action
  const getActionBadge = (action: AuditAction) => {
    switch (action) {
      case AuditAction.LOGIN_SUCCESS:
        return {
          label: "Login Success",
          color:
            "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
          icon: UserCheck,
        };
      case AuditAction.LOGIN_FAILURE:
        return {
          label: "Login Failure",
          color:
            "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
          icon: AlertTriangle,
        };
      case AuditAction.LOGOUT:
        return {
          label: "User Logout",
          color: "bg-muted text-muted-foreground border-border/80",
          icon: LogOut,
        };
      case AuditAction.PERFORMER_CREATE:
        return {
          label: "Staff Created",
          color:
            "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
          icon: UserPlus,
        };
      case AuditAction.PERFORMER_DELETE:
        return {
          label: "Staff Removed",
          color:
            "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
          icon: UserX,
        };
      case AuditAction.USER_PASSWORD_RESET:
        return {
          label: "Password Reset",
          color:
            "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
          icon: KeyRound,
        };
      case AuditAction.USER_SESSIONS_REVOKED:
      case AuditAction.SESSION_REVOKE:
        return {
          label: "Sessions Terminated",
          color:
            "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
          icon: ShieldAlert,
        };
      default:
        return {
          label: action.replace(/_/g, " "),
          color: "bg-primary/10 text-primary border-primary/20",
          icon: Activity,
        };
    }
  };

  const successRate = metrics.totalEvents
    ? Math.round((metrics.successCount / metrics.totalEvents) * 100)
    : 100;

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* ---------------------------------------------------- */}
      {/* 1. Header & Quick Actions                            */}
      {/* ---------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold">
              <Shield className="size-3.5" />
              Security &amp; Regulatory Audit
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10.5px] font-bold">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Real-time Logging Active
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Audit Trail &amp; Compliance Logs
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 max-w-2xl">
            Immutable, cryptographically anchored audit trail recording every
            authentication, performer change, and credential modification.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fetchLogs(filters)}
            disabled={isPending}
            className="rounded-xl text-xs font-semibold gap-1.5 cursor-pointer h-9 px-3 border-border/80 hover:bg-muted"
          >
            <RefreshCw
              className={`size-3.5 ${isPending ? "animate-spin" : ""}`}
            />
            <span>Refresh</span>
          </Button>

          <Link
            href="/admin"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-border/80 bg-card hover:bg-muted text-xs font-semibold text-foreground transition-colors h-9"
          >
            <span>Back to Dashboard</span>
          </Link>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 2. Telemetry KPI Cards                               */}
      {/* ---------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/80 bg-card/80 shadow-xs">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Audit Events
            </CardTitle>
            <div className="size-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
              <FileText className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {metrics.totalEvents}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Historical ledger entries recorded
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/80 shadow-xs">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Events Logged Today
            </CardTitle>
            <div className="size-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-500">
              <Clock className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {metrics.todayCount}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Since 12:00 AM (BST)
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/80 shadow-xs">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Operation Health
            </CardTitle>
            <div className="size-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
              <ShieldCheck className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {successRate}%
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {metrics.successCount} successful operations
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/80 shadow-xs">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Security Alerts / Failures
            </CardTitle>
            <div
              className={`size-8 rounded-lg border flex items-center justify-center ${
                metrics.failureCount > 0
                  ? "bg-rose-500/10 border-rose-500/20 text-rose-500"
                  : "bg-muted border-border text-muted-foreground"
              }`}
            >
              <ShieldAlert className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                metrics.failureCount > 0
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-foreground"
              }`}
            >
              {metrics.failureCount}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {metrics.failureCount > 0
                ? "Requires review / attention"
                : "Zero active security failures"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 3. Filter Bar                                        */}
      {/* ---------------------------------------------------- */}
      <AuditFilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
        onExport={handleExport}
        isExporting={isExporting}
        performers={performers}
      />

      {/* ---------------------------------------------------- */}
      {/* 4. Audit Log Table / Stream                          */}
      {/* ---------------------------------------------------- */}
      <div className="rounded-2xl border border-border/80 bg-card shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border/80 bg-muted/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="py-3 px-4">Event Action &amp; Status</th>
                <th className="py-3 px-4">Acting Performer</th>
                <th className="py-3 px-4">Department Station</th>
                <th className="py-3 px-4">Entity &amp; Target</th>
                <th className="py-3 px-4">Timestamp (BST)</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {logs.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-12 text-center text-muted-foreground"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="size-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
                        <FileText className="size-5" />
                      </div>
                      <p className="text-sm font-bold text-foreground">
                        No audit logs found
                      </p>
                      <p className="text-xs max-w-sm">
                        No events match your current filter criteria. Try
                        adjusting or resetting the filters.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const badge = getActionBadge(log.action);
                  const Icon = badge.icon;
                  const isSuccess = log.status === AuditStatus.SUCCESS;

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-muted/40 transition-colors cursor-pointer"
                      onClick={() => setSelectedLog(log)}
                    >
                      {/* Action & Status */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold ${badge.color}`}
                          >
                            <Icon className="size-3" />
                            {badge.label}
                          </span>
                          {!isSuccess && (
                            <span className="px-1.5 py-0.5 rounded-md bg-destructive/15 text-destructive font-bold text-[9.5px]">
                              FAILED
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Acting Performer */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="size-6 rounded-md bg-primary/10 text-primary font-bold flex items-center justify-center text-[10px] shrink-0">
                            {log.performerName
                              ? log.performerName.slice(0, 2).toUpperCase()
                              : "SYS"}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-foreground truncate">
                              {log.performerName || "Root Administrator"}
                            </p>
                            {log.performerPhone && (
                              <p className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                                <Phone className="size-2.5" />
                                {log.performerPhone}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Department Station */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="size-3.5 text-muted-foreground shrink-0" />
                          <span className="font-semibold text-foreground">
                            {log.userRole || "SYSTEM"}
                          </span>
                        </div>
                      </td>

                      {/* Entity & Target */}
                      <td className="py-3 px-4">
                        <div>
                          <span className="font-medium text-foreground">
                            {log.entity || "System Core"}
                          </span>
                          {log.entityId && (
                            <p className="text-[10px] font-mono text-muted-foreground truncate max-w-[120px]">
                              {log.entityId}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Timestamp */}
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-semibold text-foreground">
                            {formatBSTShortDate(log.createdAt)}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            {new Date(log.createdAt).toLocaleTimeString(
                              "en-BD",
                              {
                                timeZone: "Asia/Dhaka",
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              },
                            )}
                          </p>
                        </div>
                      </td>

                      {/* Quick Action */}
                      <td className="py-3 px-4 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(log);
                          }}
                          className="size-8 p-0 rounded-lg hover:bg-muted cursor-pointer"
                          title="Inspect Event Details"
                        >
                          <Eye className="size-3.5 text-muted-foreground hover:text-foreground" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ---------------------------------------------------- */}
        {/* 5. Pagination Bar                                    */}
        {/* ---------------------------------------------------- */}
        <div className="px-4 py-3 border-t border-border/80 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="text-muted-foreground">
            Showing{" "}
            <span className="font-bold text-foreground">{logs.length}</span> of{" "}
            <span className="font-bold text-foreground">{totalCount}</span>{" "}
            events
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground mr-2">
              Page{" "}
              <span className="font-bold text-foreground">{currentPage}</span>{" "}
              of <span className="font-bold text-foreground">{totalPages}</span>
            </span>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1 || isPending}
              className="rounded-xl size-8 p-0 border-border/80 hover:bg-muted cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft className="size-4" />
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages || isPending}
              className="rounded-xl size-8 p-0 border-border/80 hover:bg-muted cursor-pointer"
              title="Next Page"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 6. Event Inspector Modal                             */}
      {/* ---------------------------------------------------- */}
      <AuditEventDetailDialog
        open={!!selectedLog}
        onOpenChange={(open) => !open && setSelectedLog(null)}
        log={selectedLog}
      />
    </div>
  );
}
