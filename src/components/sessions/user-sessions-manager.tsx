"use client";

import * as React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Laptop,
  Smartphone,
  Tablet as TabletIcon,
  Monitor,
  Shield,
  Clock,
  Globe,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  LogOut,
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
  getUserSessionsAction,
  revokeSessionAction,
  revokeAllOtherSessionsAction,
  type SessionDisplayItem,
} from "@/actions/sessions/session.action";
import { normalizeIpAddress } from "@/lib/device";
import { useRouter } from "next/navigation";

export function UserSessionsManager() {
  const router = useRouter();
  const [sessions, setSessions] = React.useState<SessionDisplayItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [actionLoadingId, setActionLoadingId] = React.useState<string | null>(
    null,
  );
  const [revokingAll, setRevokingAll] = React.useState(false);
  const [notification, setNotification] = React.useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Dialog States
  const [sessionToRevoke, setSessionToRevoke] = React.useState<{
    id: string;
    isCurrent: boolean;
    browser: string;
    os: string;
  } | null>(null);
  const [revokeAllOthersOpen, setRevokeAllOthersOpen] = React.useState(false);

  const fetchSessions = React.useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    }
    try {
      const res = await getUserSessionsAction();
      if (res.success && res.sessions) {
        setSessions(res.sessions);
      }
    } catch (err) {
      console.error("Failed to load user sessions:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    let ignore = false;
    getUserSessionsAction()
      .then((res) => {
        if (ignore) return;
        if (res.success && res.sessions) {
          setSessions(res.sessions);
        }
      })
      .catch((err) => console.error("Failed to load user sessions:", err))
      .finally(() => {
        if (!ignore) {
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  const confirmRevokeSingle = async () => {
    if (!sessionToRevoke) return;
    const { id: sessionId, isCurrent } = sessionToRevoke;
    setSessionToRevoke(null);

    setActionLoadingId(sessionId);
    setNotification(null);

    try {
      const res = await revokeSessionAction(sessionId);
      if (res.success) {
        setNotification({ type: "success", message: res.message });
        if (res.isCurrentRevoked || isCurrent) {
          router.push("/login");
          return;
        }
        await fetchSessions();
      } else {
        setNotification({ type: "error", message: res.message });
      }
    } catch {
      setNotification({
        type: "error",
        message: "Network error. Failed to revoke session.",
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const confirmRevokeAllOthers = async () => {
    setRevokeAllOthersOpen(false);
    setRevokingAll(true);
    setNotification(null);

    try {
      const res = await revokeAllOtherSessionsAction();
      if (res.success) {
        setNotification({ type: "success", message: res.message });
        await fetchSessions();
      } else {
        setNotification({ type: "error", message: res.message });
      }
    } catch {
      setNotification({
        type: "error",
        message: "Failed to sign out of other devices.",
      });
    } finally {
      setRevokingAll(false);
    }
  };

  const getDeviceIcon = (deviceType: string | null, os: string | null) => {
    const d = (deviceType || "").toLowerCase();
    const o = (os || "").toLowerCase();
    if (d === "mobile" || o.includes("android") || o.includes("ios")) {
      return <Smartphone className="h-4 w-4" />;
    }
    if (d === "tablet" || o.includes("ipad")) {
      return <TabletIcon className="h-4 w-4" />;
    }
    if (o.includes("mac") || o.includes("windows") || o.includes("linux")) {
      return <Laptop className="h-4 w-4" />;
    }
    return <Monitor className="h-4 w-4" />;
  };

  const otherSessionsCount = sessions.filter((s) => !s.isCurrent).length;

  return (
    <Card className="shadow-lg border-border bg-card/85 backdrop-blur-xl">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-primary font-semibold text-sm mb-1">
              <Shield className="h-4 w-4 text-emerald-500" />
              <span>Active Sessions &amp; Connected Devices</span>
            </div>
            <CardTitle className="text-xl font-bold">
              Account Security &amp; Active Logins
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Manage and terminate unauthorized or old devices currently logged
              into your account
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 shrink-0">
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

            {otherSessionsCount > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setRevokeAllOthersOpen(true)}
                disabled={revokingAll || loading}
                className="h-8 px-3 text-xs gap-1.5 cursor-pointer font-semibold shadow-xs"
              >
                {revokingAll ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <LogOut className="h-3.5 w-3.5" />
                )}
                <span>Sign Out All Other Devices ({otherSessionsCount})</span>
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Alerts / Feedback message */}
        {notification && (
          <div
            className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs ${
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

        {loading ? (
          <div className="p-8 text-center space-y-2 text-muted-foreground">
            <Loader2 className="h-6 w-6 mx-auto animate-spin text-primary" />
            <p className="text-xs">Loading active login sessions...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
            No active sessions found.
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => {
              const isLoading = actionLoadingId === session.id;
              return (
                <div
                  key={session.id}
                  className={`p-4 rounded-xl border transition-all duration-200 ${
                    session.isCurrent
                      ? "bg-emerald-500/5 border-emerald-500/30 shadow-xs ring-1 ring-emerald-500/20"
                      : "bg-muted/20 border-border/70 hover:border-border hover:bg-muted/30"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Device & Client Info */}
                    <div className="flex items-start sm:items-center gap-3.5">
                      <div
                        className={`p-2.5 rounded-xl border shrink-0 ${
                          session.isCurrent
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                            : "bg-background/80 border-border text-muted-foreground"
                        }`}
                      >
                        {getDeviceIcon(session.device, session.os)}
                      </div>

                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-foreground text-sm">
                            {session.browser || "Web Browser"} on{" "}
                            {session.os || "Unknown OS"}
                          </span>
                          {session.isCurrent && (
                            <Badge className="bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-bold gap-1 px-2 py-0.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              This Device (Current Session)
                            </Badge>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground font-medium">
                          <span className="flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            <span className="font-mono">
                              {normalizeIpAddress(session.ipAddress)}
                            </span>
                          </span>

                          <span className="text-border">•</span>

                          <span
                            suppressHydrationWarning
                            className="flex items-center gap-1 text-[11px]"
                          >
                            <Clock className="h-3 w-3" />
                            <span>
                              Last active:{" "}
                              {new Date(
                                session.lastAccessAt,
                              ).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </span>

                          <span className="text-border">•</span>

                          <span
                            suppressHydrationWarning
                            className="text-[11px] text-muted-foreground/80"
                          >
                            Signed in:{" "}
                            {new Date(session.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end shrink-0 pt-2 sm:pt-0">
                      {session.isCurrent ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setSessionToRevoke({
                              id: session.id,
                              isCurrent: true,
                              browser: session.browser || "Browser",
                              os: session.os || "OS",
                            })
                          }
                          disabled={isLoading}
                          className="h-8 px-3 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer gap-1.5"
                        >
                          {isLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <LogOut className="h-3.5 w-3.5" />
                          )}
                          <span>Sign Out</span>
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setSessionToRevoke({
                              id: session.id,
                              isCurrent: false,
                              browser: session.browser || "Browser",
                              os: session.os || "OS",
                            })
                          }
                          disabled={isLoading}
                          className="h-8 px-3 text-xs text-red-500 dark:text-red-400 border-red-500/30 bg-red-500/5 hover:bg-red-500/10 cursor-pointer gap-1.5 font-semibold"
                        >
                          {isLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                          <span>Revoke Access</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* 1. Single Session Revoke Alert Dialog */}
      <AlertDialog
        open={Boolean(sessionToRevoke)}
        onOpenChange={(open) => !open && setSessionToRevoke(null)}
      >
        {sessionToRevoke && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <div className="mx-auto sm:mx-0 flex h-11 w-11 items-center justify-center rounded-2xl bg-red-500/10 text-red-500 border border-red-500/30">
                <LogOut className="h-5 w-5" />
              </div>
              <AlertDialogTitle>
                {sessionToRevoke.isCurrent
                  ? "Sign Out of Current Session?"
                  : "Revoke Device Access?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {sessionToRevoke.isCurrent ? (
                  "Are you sure you want to sign out of this device? You will need to enter your security password again to access your account."
                ) : (
                  <span>
                    Are you sure you want to terminate login access on{" "}
                    <strong className="text-foreground">
                      {sessionToRevoke.browser} ({sessionToRevoke.os})
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
                {sessionToRevoke.isCurrent ? "Sign Out Now" : "Confirm Revoke"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>

      {/* 2. Revoke All Other Devices Alert Dialog */}
      <AlertDialog
        open={revokeAllOthersOpen}
        onOpenChange={setRevokeAllOthersOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mx-auto sm:mx-0 flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/30">
              <LogOut className="h-5 w-5" />
            </div>
            <AlertDialogTitle>Sign Out All Other Devices?</AlertDialogTitle>
            <AlertDialogDescription>
              This will instantly terminate all other active login sessions (
              {otherSessionsCount} device(s)) on your account. Your current
              session will remain securely active.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRevokeAllOthersOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRevokeAllOthers}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold"
            >
              Sign Out Other Devices
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
