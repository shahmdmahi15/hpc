"use client";

import * as React from "react";
import { useNetworkTelemetry } from "@/hooks/use-network-telemetry";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  Wifi,
  WifiOff,
  RotateCw,
  Server,
  Activity,
  HardDrive,
  Eye,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";

export interface NetworkStatusBadgeProps {
  role?: string;
  station?: string;
  variant?: "badge" | "minimal";
  className?: string;
  showPing?: boolean;
}

export function NetworkStatusBadge({
  role = "STAFF",
  station = "Clinic Station",
  variant = "badge",
  className,
  showPing = true,
}: NetworkStatusBadgeProps) {
  const {
    deviceId,
    latencyMs,
    connectionState,
    isOnline,
    ipAddress,
    isTabVisible,
    lastCheckedAt,
    isChecking,
    refresh,
  } = useNetworkTelemetry({ role, station });

  const [isOpen, setIsOpen] = React.useState(false);

  // Configuration for visual statuses
  const config = React.useMemo(() => {
    switch (connectionState) {
      case "ONLINE":
        return {
          dotColor: "bg-emerald-500",
          pingColor: "bg-emerald-400",
          textColor: "text-emerald-700 dark:text-emerald-400",
          badgeBg:
            "bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/15",
          label: latencyMs !== null && showPing ? `Online • ${latencyMs}ms` : "Online",
          minimalLabel: latencyMs !== null && showPing ? `${latencyMs}ms` : "Fast",
          statusName: "Fast (<100ms)",
          icon: Wifi,
          iconColor: "text-emerald-500",
        };
      case "FAIR":
        return {
          dotColor: "bg-amber-500",
          pingColor: "bg-amber-400",
          textColor: "text-amber-700 dark:text-amber-400",
          badgeBg:
            "bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/15",
          label: latencyMs !== null && showPing ? `Slow • ${latencyMs}ms` : "Slow",
          minimalLabel: latencyMs !== null && showPing ? `${latencyMs}ms` : "Fair",
          statusName: "Moderate (100–300ms)",
          icon: Wifi,
          iconColor: "text-amber-500",
        };
      case "POOR":
        return {
          dotColor: "bg-orange-500",
          pingColor: "bg-orange-400",
          textColor: "text-orange-700 dark:text-orange-400",
          badgeBg:
            "bg-orange-500/10 border-orange-500/20 hover:bg-orange-500/15",
          label: latencyMs !== null && showPing ? `Lag • ${latencyMs}ms` : "Poor",
          minimalLabel: latencyMs !== null && showPing ? `${latencyMs}ms` : "Lag",
          statusName: "High Latency (>300ms)",
          icon: AlertTriangle,
          iconColor: "text-orange-500",
        };
      case "OFFLINE":
      default:
        return {
          dotColor: "bg-rose-500",
          pingColor: "bg-rose-400",
          textColor: "text-rose-700 dark:text-rose-400",
          badgeBg:
            "bg-rose-500/10 border-rose-500/20 hover:bg-rose-500/15",
          label: "Offline / Reconnecting",
          minimalLabel: "Offline",
          statusName: "Disconnected",
          icon: WifiOff,
          iconColor: "text-rose-500",
        };
    }
  }, [connectionState, latencyMs, showPing]);

  const StatusIcon = config.icon;

  const tooltipHoverText = `Connection: Local Clinic Network | Latency: ${
    latencyMs !== null ? `${latencyMs}ms` : "N/A"
  } | IP: ${ipAddress || "Detecting..."} | Sync: ${isOnline ? "Realtime Active" : "Offline"}`;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger
        className={cn(
          "inline-flex items-center gap-1.5 transition-all select-none cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/50",
          variant === "badge"
            ? cn(
                "px-2.5 py-0.5 sm:py-1 rounded-full border text-[11px] font-semibold shadow-2xs",
                config.badgeBg,
                config.textColor,
              )
            : cn(
                "px-1.5 py-0.5 rounded-md border text-[10.5px] font-mono font-medium shadow-2xs",
                config.badgeBg,
                config.textColor,
              ),
          className,
        )}
        title={tooltipHoverText}
      >
        <span className="relative flex size-2 shrink-0">
          {connectionState !== "OFFLINE" ? (
            <span
              className={cn(
                "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                config.pingColor,
              )}
            />
          ) : null}
          <span
            className={cn(
              "relative inline-flex rounded-full size-2",
              config.dotColor,
            )}
          />
        </span>

        <span className="leading-none whitespace-nowrap">
          {variant === "badge" ? config.label : config.minimalLabel}
        </span>
      </PopoverTrigger>

      <PopoverContent
        align="center"
        side="bottom"
        sideOffset={6}
        className="w-76 p-3 bg-popover/95 backdrop-blur-xl border border-border/80 shadow-xl rounded-xl text-xs space-y-2.5 z-50 animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-border/60">
          <div className="flex items-center gap-2">
            <div className={cn("p-1 rounded-md bg-muted/60", config.iconColor)}>
              <StatusIcon className="size-3.5" />
            </div>
            <div>
              <div className="font-bold text-foreground text-[12px] leading-tight">
                Clinic Network Health
              </div>
              <div className="text-[10px] text-muted-foreground leading-tight">
                {station}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void refresh();
            }}
            disabled={isChecking}
            title="Ping Server Now"
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RotateCw
              className={cn("size-3.5", isChecking && "animate-spin text-sky-500")}
            />
          </button>
        </div>

        {/* Telemetry Metrics Grid */}
        <div className="space-y-1.5 font-sans">
          <div className="flex items-center justify-between py-0.5">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Server className="size-3 text-muted-foreground" />
              <span>Connection</span>
            </span>
            <span className="font-semibold text-foreground">
              Local Clinic Network
            </span>
          </div>

          <div className="flex items-center justify-between py-0.5">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Activity className="size-3 text-muted-foreground" />
              <span>Latency</span>
            </span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-bold text-foreground">
                {latencyMs !== null ? `${latencyMs} ms` : "---"}
              </span>
              <span
                className={cn(
                  "text-[9.5px] font-semibold px-1 py-0.5 rounded border",
                  config.badgeBg,
                  config.textColor,
                )}
              >
                {config.statusName}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between py-0.5">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <HardDrive className="size-3 text-muted-foreground" />
              <span>Client IP</span>
            </span>
            <span className="font-mono font-semibold text-foreground">
              {ipAddress || "127.0.0.1"}
            </span>
          </div>

          <div className="flex items-center justify-between py-0.5">
            <span className="text-muted-foreground flex items-center gap-1.5">
              {isOnline ? (
                <CheckCircle2 className="size-3 text-emerald-500" />
              ) : (
                <XCircle className="size-3 text-rose-500" />
              )}
              <span>Sync</span>
            </span>
            <span
              className={cn(
                "font-semibold",
                isOnline
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400",
              )}
            >
              {isOnline ? "Realtime Active" : "Reconnecting..."}
            </span>
          </div>

          <div className="flex items-center justify-between py-0.5">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Eye className="size-3 text-muted-foreground" />
              <span>Tab Visibility</span>
            </span>
            <span className="text-muted-foreground font-medium">
              {isTabVisible ? "Active Focus" : "Background"}
            </span>
          </div>
        </div>

        {/* Device ID & Last Ping Footer */}
        <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
          <span title={`Device UUID: ${deviceId}`}>
            ID: {deviceId ? deviceId.slice(0, 8) : "---"}
          </span>
          <span>
            {lastCheckedAt
              ? `Checked ${lastCheckedAt.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}`
              : "Pending ping"}
          </span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
