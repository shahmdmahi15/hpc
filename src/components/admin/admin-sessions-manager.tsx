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
  Laptop,
  Smartphone,
  Tablet as TabletIcon,
  Monitor,
  ShieldAlert,
  Search,
  RotateCw,
  Trash2,
  Loader2,
  Users,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  LogOut,
  Copy,
  Check,
  Filter,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  getAdminAllSessionsAction,
  adminRevokeSingleSessionAction,
  adminRevokeUserAllSessionsAction,
  adminRevokeAllSystemSessionsAction,
  type SessionDisplayItem,
} from "@/actions/sessions/session.action";
import { normalizeIpAddress } from "@/lib/device";
import { Role } from "@/generated/prisma/enums";
import { useRouter } from "next/navigation";

const ROLE_BADGE_STYLES: Record<Role, string> = {
  ADMIN: "border-red-500/30 text-red-500 bg-red-500/10",
  DOCTOR: "border-cyan-500/30 text-cyan-500 bg-cyan-500/10",
  RECEPTIONIST: "border-emerald-500/30 text-emerald-500 bg-emerald-500/10",
  HANDLER: "border-amber-500/30 text-amber-500 bg-amber-500/10",
};

export function AdminSessionsManager() {
  const router = useRouter();
  const [sessions, setSessions] = React.useState<SessionDisplayItem[]>([]);
  const [stats, setStats] = React.useState<{
    totalSessions: number;
    distinctUsers: number;
    desktopCount: number;
    mobileCount: number;
  }>({
    totalSessions: 0,
    distinctUsers: 0,
    desktopCount: 0,
    mobileCount: 0,
  });

  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<string>("ALL");
  const [deviceFilter, setDeviceFilter] = React.useState<string>("ALL");
  const [actionLoadingId, setActionLoadingId] = React.useState<string | null>(
    null,
  );
  const [flushingSystem, setFlushingSystem] = React.useState(false);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [notification, setNotification] = React.useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Shadcn Alert Dialog states
  const [sessionToRevoke, setSessionToRevoke] =
    React.useState<SessionDisplayItem | null>(null);
  const [userToRevoke, setUserToRevoke] = React.useState<{
    userId: string;
    userName: string;
  } | null>(null);
  const [flushDialogOpen, setFlushDialogOpen] = React.useState(false);

  const fetchSessions = React.useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    }
    try {
      const res = await getAdminAllSessionsAction();
      if (res.success && res.sessions) {
        setSessions(res.sessions);
        if (res.stats) {
          setStats(res.stats);
        }
      }
    } catch (err) {
      console.error("Failed to load admin sessions:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    let ignore = false;
    getAdminAllSessionsAction()
      .then((res) => {
        if (ignore) return;
        if (res.success && res.sessions) {
          setSessions(res.sessions);
          if (res.stats) {
            setStats(res.stats);
          }
        }
      })
      .catch((err) => console.error("Failed to load admin sessions:", err))
      .finally(() => {
        if (!ignore) {
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  const handleCopy = (text: string, id: string) => {
    if (!navigator?.clipboard) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const confirmRevokeSingle = async () => {
    if (!sessionToRevoke) return;
    const session = sessionToRevoke;
    setSessionToRevoke(null);

    setActionLoadingId(session.id);
    setNotification(null);

    try {
      const res = await adminRevokeSingleSessionAction(session.id);
      if (res.success) {
        setNotification({ type: "success", message: res.message });
        if (res.isCurrentAdminRevoked) {
          router.push("/login");
          return;
        }
        await fetchSessions();
      } else {
        setNotification({ type: "error", message: res.message });
      }
    } catch {
      setNotification({ type: "error", message: "Failed to revoke session." });
    } finally {
      setActionLoadingId(null);
    }
  };

  const confirmRevokeUserAll = async () => {
    if (!userToRevoke) return;
    const { userId } = userToRevoke;
    setUserToRevoke(null);

    setActionLoadingId(userId);
    setNotification(null);

    try {
      const res = await adminRevokeUserAllSessionsAction(userId);
      if (res.success) {
        setNotification({ type: "success", message: res.message });
        await fetchSessions();
      } else {
        setNotification({ type: "error", message: res.message });
      }
    } catch {
      setNotification({
        type: "error",
        message: "Failed to revoke user sessions.",
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const confirmEmergencyFlush = async () => {
    setFlushDialogOpen(false);
    setFlushingSystem(true);
    setNotification(null);

    try {
      const res = await adminRevokeAllSystemSessionsAction(true);
      if (res.success) {
        setNotification({ type: "success", message: res.message });
        await fetchSessions();
      } else {
        setNotification({ type: "error", message: res.message });
      }
    } catch {
      setNotification({
        type: "error",
        message: "Emergency session flush failed.",
      });
    } finally {
      setFlushingSystem(false);
    }
  };

  const getDeviceIcon = (deviceType: string | null, os: string | null) => {
    const d = (deviceType || "").toLowerCase();
    const o = (os || "").toLowerCase();
    if (d === "mobile" || o.includes("android") || o.includes("ios")) {
      return <Smartphone className="h-4 w-4 text-emerald-500" />;
    }
    if (d === "tablet" || o.includes("ipad")) {
      return <TabletIcon className="h-4 w-4 text-cyan-500" />;
    }
    if (o.includes("mac") || o.includes("windows") || o.includes("linux")) {
      return <Laptop className="h-4 w-4 text-primary" />;
    }
    return <Monitor className="h-4 w-4 text-amber-500" />;
  };

  const filteredSessions = React.useMemo(() => {
    return sessions.filter((s) => {
      // Role Filter
      if (roleFilter !== "ALL" && s.user?.role !== roleFilter) {
        return false;
      }
      // Device Filter
      if (deviceFilter !== "ALL") {
        const d = (s.device || "").toLowerCase();
        if (deviceFilter === "DESKTOP" && d !== "desktop") return false;
        if (deviceFilter === "MOBILE" && d !== "mobile") return false;
      }
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = s.user?.name.toLowerCase().includes(q) || false;
        const matchUserId = s.user?.id.toLowerCase().includes(q) || false;
        const matchSessionId = s.id.toLowerCase().includes(q);
        const matchIp = s.ipAddress?.toLowerCase().includes(q) || false;
        const matchBrowser = s.browser?.toLowerCase().includes(q) || false;
        const matchOs = s.os?.toLowerCase().includes(q) || false;
        return (
          matchName ||
          matchUserId ||
          matchSessionId ||
          matchIp ||
          matchBrowser ||
          matchOs
        );
      }
      return true;
    });
  }, [sessions, searchQuery, roleFilter, deviceFilter]);

  return (
    <div className="space-y-6">
      {/* 1. Metrics Header Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border bg-card/85 backdrop-blur-md shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-muted-foreground font-medium block">
                Total Active Sessions
              </span>
              <div className="text-2xl font-bold text-foreground mt-1 flex items-center gap-2">
                <span>{stats.totalSessions}</span>
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/30">
              <KeyRound className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/85 backdrop-blur-md shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-muted-foreground font-medium block">
                Logged-in Staff
              </span>
              <div className="text-2xl font-bold text-foreground mt-1">
                {stats.distinctUsers}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/30">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/85 backdrop-blur-md shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-muted-foreground font-medium block">
                Desktop Terminals
              </span>
              <div className="text-2xl font-bold text-foreground mt-1">
                {stats.desktopCount}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-500 border border-cyan-500/30">
              <Laptop className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/85 backdrop-blur-md shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-muted-foreground font-medium block">
                Mobile &amp; Tablets
              </span>
              <div className="text-2xl font-bold text-foreground mt-1">
                {stats.mobileCount}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/30">
              <Smartphone className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2. Search, Filters & Emergency Actions Bar */}
      <Card className="border-border bg-card/85 backdrop-blur-md shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search sessions (Staff name, User ID, Session ID, IP, or Browser)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-background/60 text-xs sm:text-sm h-9.5 rounded-lg border-border"
              />
            </div>

            {/* Filters & Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground mr-1">
                <Filter className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Filter:</span>
              </div>

              {/* Role filter */}
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="text-xs bg-background border border-border rounded-lg px-2.5 py-2 font-medium focus:ring-1 focus:ring-primary outline-none transition-colors"
              >
                <option value="ALL">All Roles</option>
                <option value={Role.DOCTOR}>Doctors Only</option>
                <option value={Role.RECEPTIONIST}>Receptionists Only</option>
                <option value={Role.HANDLER}>Handlers Only</option>
                <option value={Role.ADMIN}>Administrators Only</option>
              </select>

              {/* Device filter */}
              <select
                value={deviceFilter}
                onChange={(e) => setDeviceFilter(e.target.value)}
                className="text-xs bg-background border border-border rounded-lg px-2.5 py-2 font-medium focus:ring-1 focus:ring-primary outline-none transition-colors"
              >
                <option value="ALL">All Devices</option>
                <option value="DESKTOP">Desktop Only</option>
                <option value="MOBILE">Mobile Only</option>
              </select>

              {/* Refresh button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchSessions(true)}
                disabled={refreshing || loading}
                className="h-8 px-2.5 text-xs gap-1.5 cursor-pointer"
              >
                <RotateCw
                  className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
                />
                <span className="hidden sm:inline">Refresh</span>
              </Button>

              {/* Emergency System Flush */}
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setFlushDialogOpen(true)}
                disabled={flushingSystem || loading || sessions.length <= 1}
                className="h-8 px-3 text-xs gap-1.5 cursor-pointer font-bold shadow-xs bg-red-600 hover:bg-red-700 text-white"
              >
                {flushingSystem ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ShieldAlert className="h-3.5 w-3.5" />
                )}
                <span>Emergency System Flush</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Feedback Notification */}
      {notification && (
        <div
          className={`flex items-start gap-2.5 p-3.5 rounded-xl border text-xs ${
            notification.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
              : "bg-red-500/10 border-red-500/30 text-red-500"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          )}
          <span className="font-medium">{notification.message}</span>
        </div>
      )}

      {/* 4. Global Sessions Table */}
      <Card className="border-border bg-card/85 backdrop-blur-md shadow-sm overflow-hidden">
        <CardHeader className="p-4 sm:p-5 pb-3 border-b border-border/60">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" />
                <span>Live Active Sessions Directory</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Showing {filteredSessions.length} of {sessions.length} active
                sessions across all staff roles
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center space-y-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 mx-auto animate-spin text-primary" />
              <p className="text-xs">Loading global system sessions...</p>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <ShieldAlert className="h-10 w-10 mx-auto mb-3 opacity-40 text-amber-500" />
              <p className="text-sm font-semibold text-foreground">
                No sessions matched your criteria
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Try adjusting your search query or role filter.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border/80 bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-4">Device &amp; Platform</th>
                    <th className="py-3 px-4">IP &amp; Telemetry</th>
                    <th className="py-3 px-4">Session Timing</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredSessions.map((session) => {
                    const isSessionLoading = actionLoadingId === session.id;
                    const isUserLoading = actionLoadingId === session.user?.id;
                    const userRole = session.user?.role || Role.HANDLER;

                    return (
                      <tr
                        key={session.id}
                        className={`hover:bg-muted/30 transition-colors ${
                          session.isCurrent
                            ? "bg-emerald-500/5 font-medium"
                            : ""
                        }`}
                      >
                        {/* Staff Member */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <Avatar className="h-7 w-7 border border-border shrink-0">
                              <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">
                                {(session.user?.name || "U")
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-foreground">
                                  {session.user?.name || "Unknown Staff"}
                                </span>
                                {session.isCurrent && (
                                  <Badge className="bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 text-[9px] px-1.5 py-0 font-bold">
                                    You
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <Badge
                                  variant="outline"
                                  className={`text-[9px] uppercase font-mono px-1 py-0 ${
                                    ROLE_BADGE_STYLES[userRole]
                                  }`}
                                >
                                  {userRole}
                                </Badge>
                                {session.user?.id && (
                                  <button
                                    onClick={() =>
                                      handleCopy(
                                        session.user!.id,
                                        session.user!.id,
                                      )
                                    }
                                    className="text-[10px] font-mono text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-0.5"
                                    title="Click to copy User ID"
                                  >
                                    <span>
                                      ({session.user.id.slice(0, 6)}...)
                                    </span>
                                    {copiedId === session.user.id ? (
                                      <Check className="h-2.5 w-2.5 text-emerald-500" />
                                    ) : (
                                      <Copy className="h-2.5 w-2.5 opacity-60" />
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Device & Platform */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-lg bg-background/80 border border-border/60 shrink-0">
                              {getDeviceIcon(session.device, session.os)}
                            </div>
                            <div>
                              <div className="font-semibold text-foreground">
                                {session.browser || "Browser"}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {session.os || "OS"} (
                                {session.device || "Desktop"})
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* IP & Telemetry */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="space-y-0.5">
                            <div className="font-mono text-[11px] font-semibold text-foreground">
                              {normalizeIpAddress(session.ipAddress)}
                            </div>
                            <button
                              onClick={() => handleCopy(session.id, session.id)}
                              className="text-[10px] font-mono text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1"
                              title="Click to copy Session ID"
                            >
                              <span>Token: {session.id.slice(0, 8)}...</span>
                              {copiedId === session.id ? (
                                <Check className="h-2.5 w-2.5 text-emerald-500" />
                              ) : (
                                <Copy className="h-2.5 w-2.5 opacity-60" />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* Timing */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-muted-foreground">
                          <div className="space-y-0.5">
                            <div
                              suppressHydrationWarning
                              className="text-[11px] font-medium text-foreground"
                            >
                              Active:{" "}
                              {new Date(
                                session.lastAccessAt,
                              ).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                            <div
                              suppressHydrationWarning
                              className="text-[10px] text-muted-foreground/80"
                            >
                              Signed in:{" "}
                              {new Date(session.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Revoke All for user */}
                            {session.user && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setUserToRevoke({
                                    userId: session.user!.id,
                                    userName: session.user!.name,
                                  })
                                }
                                disabled={isUserLoading || isSessionLoading}
                                className="h-7 px-2 text-[11px] text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 cursor-pointer gap-1"
                                title={`Terminate all sessions for ${session.user.name}`}
                              >
                                {isUserLoading ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <LogOut className="h-3 w-3" />
                                )}
                                <span className="hidden xl:inline">
                                  Revoke User All
                                </span>
                              </Button>
                            )}

                            {/* Revoke Single Session */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSessionToRevoke(session)}
                              disabled={isSessionLoading || isUserLoading}
                              className="h-7 px-2.5 text-[11px] text-red-500 dark:text-red-400 border-red-500/30 bg-red-500/5 hover:bg-red-500/10 cursor-pointer gap-1 font-semibold"
                            >
                              {isSessionLoading ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Trash2 className="h-3 w-3" />
                              )}
                              <span>Terminate</span>
                            </Button>
                          </div>
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

      {/* 5. Shadcn Alert Dialogs */}
      {/* A. Single Session Revoke Dialog */}
      <AlertDialog
        open={Boolean(sessionToRevoke)}
        onOpenChange={(open) => !open && setSessionToRevoke(null)}
      >
        {sessionToRevoke && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <div className="mx-auto sm:mx-0 flex h-11 w-11 items-center justify-center rounded-2xl bg-red-500/10 text-red-500 border border-red-500/30">
                <Trash2 className="h-5 w-5" />
              </div>
              <AlertDialogTitle>Terminate Active Session?</AlertDialogTitle>
              <AlertDialogDescription>
                {sessionToRevoke.isCurrent ? (
                  <span className="text-amber-500 font-semibold block">
                    Warning: Terminating your current administrator session will
                    immediately log you out.
                  </span>
                ) : (
                  <span>
                    Are you sure you want to terminate the active session for{" "}
                    <strong className="text-foreground">
                      {sessionToRevoke.user?.name || "this user"}
                    </strong>{" "}
                    on{" "}
                    <strong className="text-foreground">
                      {sessionToRevoke.browser || "Browser"} (
                      {sessionToRevoke.os || "OS"})
                    </strong>
                    ?
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setSessionToRevoke(null)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmRevokeSingle}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Confirm Terminate
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>

      {/* B. Revoke All Sessions For User Dialog */}
      <AlertDialog
        open={Boolean(userToRevoke)}
        onOpenChange={(open) => !open && setUserToRevoke(null)}
      >
        {userToRevoke && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <div className="mx-auto sm:mx-0 flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/30">
                <LogOut className="h-5 w-5" />
              </div>
              <AlertDialogTitle>
                Revoke All Sessions for Staff Member?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This will immediately invalidate all active login sessions and
                connected devices for{" "}
                <strong className="text-foreground">
                  {userToRevoke.userName}
                </strong>
                . They will be forced to authenticate again.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setUserToRevoke(null)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmRevokeUserAll}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                Revoke All User Sessions
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>

      {/* C. Emergency System Flush Dialog */}
      <AlertDialog open={flushDialogOpen} onOpenChange={setFlushDialogOpen}>
        <AlertDialogContent className="border-red-500/40">
          <AlertDialogHeader>
            <div className="mx-auto sm:mx-0 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/15 text-red-500 border border-red-500/40 ring-8 ring-red-500/10">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <AlertDialogTitle className="text-red-500 text-lg">
              Confirm Emergency System-Wide Flush
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block text-foreground font-semibold">
                You are about to terminate all active sessions across ALL users
                in the entire system.
              </span>
              <span className="block text-muted-foreground text-xs">
                All clinicians, receptionists, and handlers will be immediately
                logged out. Your current admin session will remain active.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setFlushDialogOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmEmergencyFlush}
              className="bg-red-600 hover:bg-red-700 text-white font-bold"
            >
              Execute Emergency Flush
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
