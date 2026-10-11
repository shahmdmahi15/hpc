"use client";

import * as React from "react";
import {
  Server,
  Radio,
  Tv,
  Monitor,
  Tablet,
  Smartphone,
  Wifi,
  Activity,
  AlertTriangle,
  RefreshCw,
  Search,
  Megaphone,
  Edit,
  Trash2,
  CheckCircle2,
  Clock,
  Volume2,
  Send,
  Loader2,
  Shield,
  Layers,
  HardDrive,
  RotateCw,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  getConnectedDevicesAction,
  updateDeviceAliasAction,
  deleteDeviceAction,
  broadcastSystemAlertAction,
  type ConnectedDeviceRecord,
} from "@/actions/admin/device-fleet.action";
import { useRealtimeEvents } from "@/hooks/use-realtime-events";

interface DeviceFleetViewProps {
  initialDevices: ConnectedDeviceRecord[];
  stats: {
    total: number;
    online: number;
    offline: number;
  };
}

export function DeviceFleetView({
  initialDevices = [],
  stats: initialStats,
}: DeviceFleetViewProps) {
  const [devices, setDevices] = React.useState<ConnectedDeviceRecord[]>(initialDevices);
  const [stats, setStats] = React.useState(initialStats);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"ALL" | "ONLINE" | "OFFLINE">("ALL");
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  // Dialogs
  const [isAlertModalOpen, setIsAlertModalOpen] = React.useState(false);
  const [editingDevice, setEditingDevice] = React.useState<ConnectedDeviceRecord | null>(null);
  const [deletingDevice, setDeletingDevice] = React.useState<ConnectedDeviceRecord | null>(null);

  // Rename form
  const [formDeviceName, setFormDeviceName] = React.useState("");
  const [formStation, setFormStation] = React.useState("");
  const [isSavingRename, setIsSavingRename] = React.useState(false);

  // Emergency Alert form
  const [alertMessage, setAlertMessage] = React.useState("");
  const [alertPriority, setAlertPriority] = React.useState("HIGH");
  const [isBroadcasting, setIsBroadcasting] = React.useState(false);

  const refreshFleet = React.useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await getConnectedDevicesAction();
      if (res.success) {
        setDevices(res.devices);
        setStats(res.stats);
      }
    } catch {
      toast.error("Failed to load device fleet.");
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useRealtimeEvents({
    onEvent: (event) => {
      const type = (event?.type || "").toUpperCase();
      if (
        type === "DEVICE_CONNECTED" ||
        type === "DEVICE_HEARTBEAT" ||
        type === "DEVICE_DISCONNECTED" ||
        type === "SYSTEM_BROADCAST_ALERT"
      ) {
        void refreshFleet();
      }
    },
  });

  const handleOpenEdit = (device: ConnectedDeviceRecord) => {
    setEditingDevice(device);
    setFormDeviceName(device.deviceName || "");
    setFormStation(device.station || "");
  };

  const handleSaveRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDevice) return;
    setIsSavingRename(true);
    try {
      const res = await updateDeviceAliasAction(
        editingDevice.id,
        formDeviceName,
        formStation || undefined
      );
      if (res.success) {
        toast.success(res.message);
        setEditingDevice(null);
        void refreshFleet();
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Failed to update device alias.");
    } finally {
      setIsSavingRename(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingDevice) return;
    try {
      const res = await deleteDeviceAction(deletingDevice.id);
      if (res.success) {
        toast.success(res.message);
        setDeletingDevice(null);
        void refreshFleet();
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Failed to remove device.");
    }
  };

  const handleBroadcastAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertMessage.trim()) {
      toast.error("Please enter an alert message.");
      return;
    }
    setIsBroadcasting(true);
    try {
      const res = await broadcastSystemAlertAction(alertMessage, alertPriority);
      if (res.success) {
        toast.success(res.message);
        setIsAlertModalOpen(false);
        setAlertMessage("");
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Failed to dispatch alert.");
    } finally {
      setIsBroadcasting(false);
    }
  };

  const filteredDevices = React.useMemo(() => {
    return devices.filter((d) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        (d.deviceName && d.deviceName.toLowerCase().includes(q)) ||
        (d.station && d.station.toLowerCase().includes(q)) ||
        (d.ipAddress && d.ipAddress.includes(q)) ||
        (d.role && d.role.toLowerCase().includes(q)) ||
        (d.deviceId && d.deviceId.toLowerCase().includes(q));

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ONLINE" && d.isOnline) ||
        (statusFilter === "OFFLINE" && !d.isOnline);

      return matchesSearch && matchesStatus;
    });
  }, [devices, searchQuery, statusFilter]);

  const avgLatency = React.useMemo(() => {
    const online = devices.filter((d) => d.isOnline);
    if (online.length === 0) return 0;
    const sum = online.reduce((acc, curr) => acc + (curr.latencyMs || 0), 0);
    return Math.round(sum / online.length);
  }, [devices]);

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType.toUpperCase()) {
      case "ANDROID_TV":
        return <Tv className="size-4 text-purple-600 dark:text-purple-400" />;
      case "TABLET":
        return <Tablet className="size-4 text-sky-600 dark:text-sky-400" />;
      case "MOBILE":
      case "PHONE":
        return <Smartphone className="size-4 text-emerald-600 dark:text-emerald-400" />;
      default:
        return <Monitor className="size-4 text-blue-600 dark:text-blue-400" />;
    }
  };

  const getLatencyBadge = (ms: number, isOnline: boolean) => {
    if (!isOnline) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[11px] font-bold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
          <span className="size-1.5 rounded-full bg-rose-500" />
          Offline
        </span>
      );
    }
    if (ms < 10) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[11px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          {ms} ms
        </span>
      );
    }
    if (ms < 50) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[11px] font-bold bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/25">
          <span className="size-1.5 rounded-full bg-sky-500" />
          {ms} ms
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[11px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25">
        <span className="size-1.5 rounded-full bg-amber-500" />
        {ms} ms
      </span>
    );
  };

  const getRelativeTime = (date: Date | string) => {
    try {
      const diffMs = Date.now() - new Date(date).getTime();
      const secs = Math.floor(diffMs / 1000);
      if (secs < 5) return "just now";
      if (secs < 60) return `${secs}s ago`;
      const mins = Math.floor(secs / 60);
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      return `${hours}h ago`;
    } catch {
      return "--";
    }
  };

  return (
    <div className="space-y-5">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card border border-border/70 p-4 rounded-xl shadow-xs">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
            <Radio className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-foreground tracking-tight">
              Network & Fleet Surveillance
            </h1>
            <p className="text-xs text-muted-foreground">
              Sysadmin command center: real-time telemetry, IP discovery, latency monitoring, and remote terminal actions.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshFleet}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 text-xs font-bold cursor-pointer"
          >
            <RefreshCw className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>Sync Fleet</span>
          </Button>

          <Button
            size="sm"
            onClick={() => setIsAlertModalOpen(true)}
            className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs cursor-pointer"
          >
            <Megaphone className="size-3.5" />
            <span>Broadcast Alert</span>
          </Button>
        </div>
      </div>

      {/* 2. Overview Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Card className="border-border/70 shadow-2xs">
          <CardHeader className="pb-1.5 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Connected Terminals
            </CardTitle>
            <Server className="size-4 text-purple-600 dark:text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-mono text-foreground">
              {stats.total}
            </div>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
              <span className="size-1.5 rounded-full bg-purple-500" />
              <span>Registered clinic hardware</span>
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-2xs">
          <CardHeader className="pb-1.5 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Online Now
            </CardTitle>
            <Radio className="size-4 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
              {stats.online}
            </div>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Active heartbeats (&lt;35s)</span>
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-2xs">
          <CardHeader className="pb-1.5 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Avg LAN Ping
            </CardTitle>
            <Activity className="size-4 text-sky-600 dark:text-sky-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-mono text-sky-600 dark:text-sky-400">
              {avgLatency} <span className="text-xs font-sans font-bold text-muted-foreground">ms</span>
            </div>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
              <span className="size-1.5 rounded-full bg-sky-500" />
              <span>Sub-10ms Local Network Health</span>
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-2xs">
          <CardHeader className="pb-1.5 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Sync Engine
            </CardTitle>
            <Wifi className="size-4 text-teal-600 dark:text-teal-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-mono text-teal-600 dark:text-teal-400">
              100%
            </div>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
              <span className="size-1.5 rounded-full bg-teal-500" />
              <span>Local SSE + SQLite WAL Journal</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 3. Search and Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-muted/30 p-2.5 rounded-lg border border-border/60">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by IP, device name, or station..."
            className="pl-8 h-8 text-xs bg-background"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="h-8 px-2 rounded-md border border-border bg-background text-xs font-medium cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="ONLINE">Online Only</option>
            <option value="OFFLINE">Offline</option>
          </select>
        </div>
      </div>

      {/* 4. Fleet Devices Table */}
      <div className="border border-border/70 rounded-xl overflow-hidden bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b border-border/70 text-muted-foreground font-semibold">
              <tr>
                <th className="py-2.5 px-3">Device / Terminal</th>
                <th className="py-2.5 px-3">Station / Chamber</th>
                <th className="py-2.5 px-3">Local IP</th>
                <th className="py-2.5 px-3">Role / User</th>
                <th className="py-2.5 px-3">Type & OS</th>
                <th className="py-2.5 px-3">Latency</th>
                <th className="py-2.5 px-3">Last Heartbeat</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50 font-sans">
              {filteredDevices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    <Server className="size-8 mx-auto mb-2 opacity-40" />
                    <p className="font-semibold text-foreground">No terminals registered yet</p>
                    <p className="text-[11px] mt-0.5">
                      Devices automatically register upon connecting to any clinic dashboard or TV display.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredDevices.map((dev) => (
                  <tr
                    key={dev.id}
                    className={`hover:bg-muted/30 transition-colors ${
                      !dev.isOnline ? "opacity-60 bg-muted/10" : ""
                    }`}
                  >
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-md bg-muted/60 shrink-0">
                          {getDeviceIcon(dev.deviceType)}
                        </div>
                        <div>
                          <div className="font-bold text-foreground text-xs leading-tight">
                            {dev.deviceName || `Terminal (${dev.deviceId.slice(0, 8)})`}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            UUID: {dev.deviceId.slice(0, 8)}...
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <span className="font-semibold text-foreground">
                        {dev.station || "General Console"}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <span className="font-mono font-semibold text-foreground bg-muted/50 px-1.5 py-0.5 rounded border border-border/60">
                        {dev.ipAddress || "127.0.0.1"}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <div className="space-y-0.5">
                        <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-bold uppercase bg-primary/10 text-primary border border-primary/20">
                          {dev.role || "STAFF"}
                        </span>
                        {dev.user?.name && (
                          <div className="text-[10.5px] text-muted-foreground">
                            {dev.user.name}
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="space-y-0.5 text-muted-foreground">
                        <div className="font-medium text-foreground text-[11px]">
                          {dev.deviceType}
                        </div>
                        <div className="text-[10px] truncate max-w-[140px]" title={dev.browser || dev.userAgent || ""}>
                          {dev.browser || "Browser"}
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      {getLatencyBadge(dev.latencyMs, dev.isOnline)}
                    </td>

                    <td className="py-3 px-3">
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {getRelativeTime(dev.lastSeenAt)}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(dev)}
                          title="Rename Terminal or Station"
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          <Edit className="size-3" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingDevice(dev)}
                          title="Remove from fleet"
                          className="h-7 px-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rename Dialog */}
      <Dialog
        open={Boolean(editingDevice)}
        onOpenChange={(open) => !open && setEditingDevice(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Edit className="size-4 text-primary" />
              <span>Rename Terminal & Assign Station</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveRename} className="space-y-3.5 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Human Alias / Device Name</Label>
              <Input
                value={formDeviceName}
                onChange={(e) => setFormDeviceName(e.target.value)}
                placeholder="e.g. Chamber 101 Doctor PC"
                className="text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Assigned Station / Location</Label>
              <Input
                value={formStation}
                onChange={(e) => setFormStation(e.target.value)}
                placeholder="e.g. Doctor Chamber 101, Therapy Room 207, Cashier Desk"
                className="text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditingDevice(null)}
                className="text-xs font-semibold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSavingRename}
                className="text-xs font-bold"
              >
                {isSavingRename ? "Saving..." : "Save Alias"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog
        open={Boolean(deletingDevice)}
        onOpenChange={(open) => !open && setDeletingDevice(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2 text-rose-600">
              <Trash2 className="size-4" />
              <span>Remove Terminal</span>
            </DialogTitle>
          </DialogHeader>

          <p className="text-xs text-muted-foreground py-2">
            Are you sure you want to remove this terminal from fleet surveillance? If the device reconnects, it will automatically register fresh.
          </p>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeletingDevice(null)}
              className="text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleConfirmDelete}
              className="text-xs font-bold"
            >
              Confirm Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Emergency Broadcast Dialog */}
      <Dialog open={isAlertModalOpen} onOpenChange={setIsAlertModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-rose-600">
              <Megaphone className="size-4" />
              <span>Broadcast Emergency System Alert</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleBroadcastAlert} className="space-y-3.5 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Alert Message *</Label>
              <Textarea
                value={alertMessage}
                onChange={(e) => setAlertMessage(e.target.value)}
                placeholder="Type emergency alert message to be pushed immediately to all waiting TVs and staff workstations..."
                rows={4}
                className="text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Priority</Label>
              <select
                value={alertPriority}
                onChange={(e) => setAlertPriority(e.target.value)}
                className="w-full h-8 px-2 rounded-md border border-border bg-background text-xs font-medium"
              >
                <option value="HIGH">High Priority</option>
                <option value="CRITICAL">Critical Emergency</option>
                <option value="NORMAL">Standard Notice</option>
              </select>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAlertModalOpen(false)}
                className="text-xs font-semibold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isBroadcasting}
                className="text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white"
              >
                {isBroadcasting ? "Broadcasting..." : "Send Alert Now"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
