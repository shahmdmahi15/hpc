"use client";

import * as React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Search,
  ShieldAlert,
  ShieldCheck,
  Filter,
  Eye,
  Clock,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Code2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { parseUserAgentString, normalizeIpAddress } from "@/lib/device";

export interface AuditLogItem {
  id: string;
  action: string;
  status: "SUCCESS" | "FAILURE";
  userId: string | null;
  userName: string | null;
  userRole: string | null;
  entity: string | null;
  entityId: string | null;
  details: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface AuditLogTableProps {
  initialLogs: AuditLogItem[];
}

export function AuditLogTable({ initialLogs }: AuditLogTableProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [actionFilter, setActionFilter] = React.useState<string>("ALL");
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");
  const [selectedLog, setSelectedLog] = React.useState<AuditLogItem | null>(
    null,
  );
  const [copiedField, setCopiedField] = React.useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = React.useState(1);
  const pageSize = 15;

  const handleCopy = (text: string, fieldName: string) => {
    if (!navigator?.clipboard) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

  const handleActionFilterChange = (val: string) => {
    setActionFilter(val);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (val: string) => {
    setStatusFilter(val);
    setCurrentPage(1);
  };

  const handleReset = () => {
    setSearchQuery("");
    setActionFilter("ALL");
    setStatusFilter("ALL");
    setCurrentPage(1);
  };

  const filteredLogs = React.useMemo(() => {
    return initialLogs.filter((log) => {
      // Action Filter
      if (actionFilter !== "ALL" && log.action !== actionFilter) {
        return false;
      }
      // Status Filter
      if (statusFilter !== "ALL" && log.status !== statusFilter) {
        return false;
      }
      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchAction = log.action.toLowerCase().includes(q);
        const matchUser = log.userName?.toLowerCase().includes(q) || false;
        const matchRole = log.userRole?.toLowerCase().includes(q) || false;
        const matchIp = log.ipAddress?.toLowerCase().includes(q) || false;
        const matchEntity = log.entity?.toLowerCase().includes(q) || false;
        const matchEntityId = log.entityId?.toLowerCase().includes(q) || false;
        const matchId = log.id.toLowerCase().includes(q);
        const matchDetails = log.details?.toLowerCase().includes(q) || false;
        return (
          matchAction ||
          matchUser ||
          matchRole ||
          matchIp ||
          matchEntity ||
          matchEntityId ||
          matchId ||
          matchDetails
        );
      }
      return true;
    });
  }, [initialLogs, searchQuery, actionFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedLogs = React.useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, safeCurrentPage, pageSize]);

  const ACTION_CONFIGS: Record<
    string,
    { label: string; bg: string; text: string; border: string }
  > = {
    LOGIN_SUCCESS: {
      label: "Login Successful",
      bg: "bg-emerald-500/10",
      text: "text-emerald-500 dark:text-emerald-400",
      border: "border-emerald-500/30",
    },
    LOGIN_FAILURE: {
      label: "Login Failed",
      bg: "bg-red-500/10",
      text: "text-red-500 dark:text-red-400",
      border: "border-red-500/30",
    },
    LOGOUT: {
      label: "User Logout",
      bg: "bg-slate-500/10",
      text: "text-slate-500 dark:text-slate-400",
      border: "border-slate-500/30",
    },
    USER_CREATE: {
      label: "Staff Created",
      bg: "bg-cyan-500/10",
      text: "text-cyan-500 dark:text-cyan-400",
      border: "border-cyan-500/30",
    },
    USER_UPDATE: {
      label: "Staff Updated",
      bg: "bg-blue-500/10",
      text: "text-blue-500 dark:text-blue-400",
      border: "border-blue-500/30",
    },
    USER_PASSWORD_RESET: {
      label: "Password Reset",
      bg: "bg-amber-500/10",
      text: "text-amber-500 dark:text-amber-400",
      border: "border-amber-500/30",
    },
    USER_DELETE: {
      label: "Staff Removed",
      bg: "bg-rose-500/10",
      text: "text-rose-500 dark:text-rose-400",
      border: "border-rose-500/30",
    },
    USER_SESSIONS_REVOKED: {
      label: "Sessions Revoked",
      bg: "bg-purple-500/10",
      text: "text-purple-500 dark:text-purple-400",
      border: "border-purple-500/30",
    },
    PROFILE_UPDATE: {
      label: "Profile Updated",
      bg: "bg-teal-500/10",
      text: "text-teal-500 dark:text-teal-400",
      border: "border-teal-500/30",
    },
    PASSWORD_UPDATE: {
      label: "Password Changed",
      bg: "bg-amber-500/10",
      text: "text-amber-500 dark:text-amber-400",
      border: "border-amber-500/30",
    },
  };

  const actionTypes = Array.from(new Set(initialLogs.map((l) => l.action)));

  // Parse current modal client device
  const parsedSelectedDevice = selectedLog?.userAgent
    ? parseUserAgentString(selectedLog.userAgent)
    : null;

  return (
    <div className="space-y-4">
      {/* Search & Filters Toolbar */}
      <Card className="border-border bg-card/90 backdrop-blur-md shadow-sm">
        <CardContent className="p-3.5 sm:p-4">
          <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search audit records (actor, action, IP, entity ID, or details)..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9 bg-background/60 text-xs sm:text-sm h-9.5 rounded-lg border-border"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground mr-1">
                <Filter className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Filters:</span>
              </div>

              {/* Action Filter */}
              <select
                value={actionFilter}
                onChange={(e) => handleActionFilterChange(e.target.value)}
                className="text-xs bg-background border border-border rounded-lg px-2.5 py-2 font-medium focus:ring-1 focus:ring-primary outline-none transition-colors"
              >
                <option value="ALL">All Actions ({initialLogs.length})</option>
                {actionTypes.map((action) => (
                  <option key={action} value={action}>
                    {ACTION_CONFIGS[action]?.label || action}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => handleStatusFilterChange(e.target.value)}
                className="text-xs bg-background border border-border rounded-lg px-2.5 py-2 font-medium focus:ring-1 focus:ring-primary outline-none transition-colors"
              >
                <option value="ALL">All Statuses</option>
                <option value="SUCCESS">Success Only</option>
                <option value="FAILURE">Failure Only</option>
              </select>

              {(searchQuery ||
                actionFilter !== "ALL" ||
                statusFilter !== "ALL") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                  className="text-xs text-muted-foreground hover:text-foreground h-8 px-2.5"
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                  Reset
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table Card */}
      <Card className="border-border bg-card/90 backdrop-blur-md shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-sm sm:text-base font-bold">
                  Immutable Security Audit Trail
                </CardTitle>
                <CardDescription className="text-xs">
                  Showing {paginatedLogs.length} of {filteredLogs.length} events
                  (Page {currentPage} of {totalPages})
                </CardDescription>
              </div>
            </div>

            {/* Pagination buttons */}
            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="h-8 w-8 p-0 cursor-pointer disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs font-medium px-2 text-muted-foreground">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                className="h-8 w-8 p-0 cursor-pointer disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredLogs.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <ShieldAlert className="h-10 w-10 mx-auto mb-3 opacity-40 text-amber-500" />
              <p className="text-sm font-semibold text-foreground">
                No audit events matched your search
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Try clearing filters or searching with a different term.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border/80 bg-muted/40 text-muted-foreground font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Status & Action</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4">Target Entity</th>
                    <th className="py-3 px-4">IP Address</th>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {paginatedLogs.map((log) => {
                    const actionCfg = ACTION_CONFIGS[log.action] || {
                      label: log.action,
                      bg: "bg-muted/30",
                      text: "text-muted-foreground",
                      border: "border-border",
                    };

                    const displayIp = normalizeIpAddress(log.ipAddress);

                    return (
                      <tr
                        key={log.id}
                        className="hover:bg-muted/40 transition-colors group"
                      >
                        {/* Status & Action */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            {log.status === "SUCCESS" ? (
                              <div className="flex items-center justify-center h-5 w-5 rounded-full bg-emerald-500/10 text-emerald-500 shrink-0">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              </div>
                            ) : (
                              <div className="flex items-center justify-center h-5 w-5 rounded-full bg-red-500/10 text-red-500 shrink-0">
                                <XCircle className="h-3.5 w-3.5" />
                              </div>
                            )}
                            <div>
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${actionCfg.bg} ${actionCfg.text} ${actionCfg.border}`}
                              >
                                {actionCfg.label}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Actor */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {log.userName ? (
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6 border border-border">
                                <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">
                                  {log.userName.slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-semibold text-foreground">
                                  {log.userName}
                                </div>
                                {log.userRole && (
                                  <span className="text-[10px] text-muted-foreground font-mono uppercase">
                                    {log.userRole}
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic text-[11px]">
                              System / Anonymous
                            </span>
                          )}
                        </td>

                        {/* Target Entity */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {log.entity ? (
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-foreground">
                                {log.entity}
                              </span>
                              {log.entityId && (
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground">
                                  {log.entityId.slice(0, 8)}...
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>

                        {/* IP Address */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-mono text-muted-foreground text-[11px]">
                            {displayIp}
                          </span>
                        </td>

                        {/* Timestamp */}
                        <td className="py-3 px-4 whitespace-nowrap text-muted-foreground">
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span suppressHydrationWarning>
                              {new Date(log.createdAt).toLocaleString()}
                            </span>
                          </div>
                        </td>

                        {/* Inspect Details Button */}
                        <td className="py-3 px-4 whitespace-nowrap text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedLog(log)}
                            className="h-7 px-2.5 text-[11px] gap-1.5 cursor-pointer font-semibold shadow-xs hover:border-primary/40 hover:text-primary transition-all"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>Details</span>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Robust, High-End Wide Details Dialog */}
      <Dialog
        open={Boolean(selectedLog)}
        onOpenChange={(open) => !open && setSelectedLog(null)}
      >
        {selectedLog && (
          <DialogContent className="w-full sm:max-w-4xl max-w-4xl max-h-[90vh] overflow-y-auto p-5 sm:p-6 rounded-2xl border-border bg-card shadow-2xl">
            <DialogHeader className="space-y-2 pb-3 border-b border-border/60">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2.5 rounded-xl border ${
                      selectedLog.status === "SUCCESS"
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                        : "bg-red-500/10 border-red-500/30 text-red-500"
                    }`}
                  >
                    {selectedLog.status === "SUCCESS" ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <XCircle className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
                      {ACTION_CONFIGS[selectedLog.action]?.label ||
                        selectedLog.action}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                      <span>Event Log Record</span>
                      <span>•</span>
                      <span suppressHydrationWarning className="font-mono">
                        {new Date(selectedLog.createdAt).toLocaleString()}
                      </span>
                    </DialogDescription>
                  </div>
                </div>

                <Badge
                  variant="outline"
                  className={
                    selectedLog.status === "SUCCESS"
                      ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/10 font-bold"
                      : "text-red-500 border-red-500/30 bg-red-500/10 font-bold"
                  }
                >
                  {selectedLog.status}
                </Badge>
              </div>

              {/* Event ID with copy button */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40 border border-border/50 text-xs">
                <div className="flex items-center gap-2 truncate">
                  <span className="text-muted-foreground font-medium">
                    Event ID:
                  </span>
                  <span className="font-mono text-foreground font-semibold truncate">
                    {selectedLog.id}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(selectedLog.id, "id")}
                  className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer gap-1 shrink-0"
                >
                  {copiedField === "id" ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-500" />
                      <span className="text-emerald-500 font-semibold">
                        Copied
                      </span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy</span>
                    </>
                  )}
                </Button>
              </div>
            </DialogHeader>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-2 text-xs">
              {/* Left Column (5/12): Actor, Entity & Client Telemetry */}
              <div className="lg:col-span-5 space-y-3">
                {/* Actor Card */}
                <div className="p-3.5 rounded-xl border border-border/60 bg-muted/25 space-y-2">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    Executing Actor
                  </span>
                  {selectedLog.userName ? (
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-8 w-8 border border-border/80 shrink-0">
                        <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                          {selectedLog.userName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="font-bold text-foreground text-sm truncate">
                          {selectedLog.userName}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge
                            variant="outline"
                            className="text-[10px] uppercase font-mono px-1.5 py-0"
                          >
                            {selectedLog.userRole || "USER"}
                          </Badge>
                          {selectedLog.userId && (
                            <span className="text-[10px] font-mono text-muted-foreground truncate">
                              ({selectedLog.userId})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-muted-foreground italic py-1">
                      System Initiated / Anonymous Client
                    </div>
                  )}
                </div>

                {/* Target Entity Card */}
                <div className="p-3.5 rounded-xl border border-border/60 bg-muted/25 space-y-2">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    Target Resource / Entity
                  </span>
                  {selectedLog.entity ? (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground text-sm">
                          {selectedLog.entity}
                        </span>
                        {selectedLog.entityId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleCopy(selectedLog.entityId!, "entityId")
                            }
                            className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            {copiedField === "entityId" ? (
                              <Check className="h-3 w-3 text-emerald-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        )}
                      </div>
                      {selectedLog.entityId && (
                        <div className="text-[11px] font-mono text-muted-foreground truncate bg-background/50 p-1.5 rounded-md border border-border/40">
                          ID: {selectedLog.entityId}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-muted-foreground italic py-1">
                      No specific entity targeted
                    </div>
                  )}
                </div>

                {/* Client Environment & Telemetry */}
                <div className="p-3.5 rounded-xl border border-border/60 bg-muted/25 space-y-2.5">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    Network & Device
                  </span>

                  <div className="space-y-2">
                    {/* IP */}
                    <div className="flex items-center justify-between p-2 rounded-lg bg-background/60 border border-border/50">
                      <span className="text-[10px] text-muted-foreground font-medium">
                        IP Address
                      </span>
                      <span className="font-mono font-bold text-foreground text-xs">
                        {normalizeIpAddress(selectedLog.ipAddress)}
                      </span>
                    </div>

                    {/* Browser */}
                    <div className="flex items-center justify-between p-2 rounded-lg bg-background/60 border border-border/50">
                      <span className="text-[10px] text-muted-foreground font-medium">
                        Browser
                      </span>
                      <span className="font-semibold text-foreground text-xs">
                        {parsedSelectedDevice?.browser || "Chrome / Standard"}
                      </span>
                    </div>

                    {/* OS & Device */}
                    <div className="flex items-center justify-between p-2 rounded-lg bg-background/60 border border-border/50">
                      <span className="text-[10px] text-muted-foreground font-medium">
                        OS & Platform
                      </span>
                      <span className="font-semibold text-foreground text-xs">
                        {parsedSelectedDevice?.os || "Windows"} (
                        {parsedSelectedDevice?.device || "Desktop"})
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column (7/12): Payload & Operational Metadata */}
              <div className="lg:col-span-7 space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Code2 className="h-3.5 w-3.5 text-primary" />
                      <span>Payload & Operational Metadata</span>
                    </span>
                    {selectedLog.details && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleCopy(selectedLog.details!, "payload")
                        }
                        className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer gap-1"
                      >
                        {copiedField === "payload" ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-500" />
                            <span className="text-emerald-500 font-semibold">
                              Copied JSON
                            </span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>Copy JSON</span>
                          </>
                        )}
                      </Button>
                    )}
                  </div>

                  <pre className="p-3.5 rounded-xl bg-muted/50 border border-border/70 font-mono text-[11px] leading-relaxed overflow-x-auto min-h-[160px] max-h-[260px] text-foreground/95 shadow-inner">
                    {selectedLog.details
                      ? (() => {
                          try {
                            return JSON.stringify(
                              JSON.parse(selectedLog.details),
                              null,
                              2,
                            );
                          } catch {
                            return selectedLog.details;
                          }
                        })()
                      : "// No metadata attached for this event"}
                  </pre>
                </div>

                {/* User Agent Header */}
                {selectedLog.userAgent && (
                  <div className="p-3 rounded-xl border border-border/50 bg-muted/20">
                    <span className="text-[10px] text-muted-foreground font-medium block mb-1">
                      Raw User Agent Header:
                    </span>
                    <div className="font-mono text-[10px] text-muted-foreground break-all leading-relaxed">
                      {selectedLog.userAgent}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
