"use client";

import * as React from "react";

export type NetworkConnectionState = "ONLINE" | "FAIR" | "POOR" | "OFFLINE";

export interface NetworkTelemetryState {
  deviceId: string;
  latencyMs: number | null;
  connectionState: NetworkConnectionState;
  isOnline: boolean;
  ipAddress: string | null;
  isTabVisible: boolean;
  lastCheckedAt: Date | null;
  isChecking: boolean;
  refresh: () => Promise<void>;
}

export interface UseNetworkTelemetryOptions {
  role?: string;
  station?: string;
  enabled?: boolean;
  intervalMs?: number;
}

// Module-level persistent singleton so multiple components on the dashboard share 1 heartbeat cycle
let sharedDeviceId = "";
let sharedLatency: number | null = null;
let sharedConnectionState: NetworkConnectionState = "ONLINE";
let sharedIsOnline = true;
let sharedIpAddress: string | null = null;
let sharedTabVisible = true;
let sharedLastCheckedAt: Date | null = null;
let sharedIsChecking = false;
let sharedTimer: ReturnType<typeof setInterval> | null = null;
let activeRole = "STAFF";
let activeStation = "Main Console";
const subscribers = new Set<() => void>();

function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "server-stub";
  if (sharedDeviceId) return sharedDeviceId;

  try {
    const existing = localStorage.getItem("hpc_device_id");
    if (existing && existing.trim().length > 0) {
      sharedDeviceId = existing;
      return existing;
    }

    const generated =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

    localStorage.setItem("hpc_device_id", generated);
    sharedDeviceId = generated;
    return generated;
  } catch {
    const fallback = `temp-${Math.random().toString(36).slice(2, 9)}`;
    sharedDeviceId = fallback;
    return fallback;
  }
}

function notifySubscribers() {
  subscribers.forEach((sub) => {
    try {
      sub();
    } catch (err) {
      console.error("[NetworkTelemetry notify error]:", err);
    }
  });
}

async function performHeartbeatPing(): Promise<void> {
  if (typeof window === "undefined" || sharedIsChecking) return;

  sharedIsChecking = true;
  notifySubscribers();

  const devId = getOrCreateDeviceId();
  const startTime = performance.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4500);

  const isVisible =
    typeof document !== "undefined"
      ? document.visibilityState === "visible"
      : true;
  sharedTabVisible = isVisible;

  try {
    const res = await fetch("/api/network/heartbeat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        deviceId: devId,
        role: activeRole,
        station: activeStation,
        tabVisible: isVisible,
        timestamp: Date.now(),
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const latency = Math.round(performance.now() - startTime);

      sharedLatency = latency;
      sharedIsOnline = true;
      sharedLastCheckedAt = new Date();

      if (data?.ipAddress || data?.clientIp || data?.ip) {
        sharedIpAddress = String(
          data.ipAddress || data.clientIp || data.ip,
        );
      }

      if (latency < 100) {
        sharedConnectionState = "ONLINE";
      } else if (latency <= 300) {
        sharedConnectionState = "FAIR";
      } else {
        sharedConnectionState = "POOR";
      }
    } else {
      sharedIsOnline = false;
      sharedConnectionState = "OFFLINE";
      sharedLatency = null;
    }
  } catch {
    clearTimeout(timeoutId);
    sharedIsOnline = false;
    sharedConnectionState = "OFFLINE";
    sharedLatency = null;
  } finally {
    sharedIsChecking = false;
    notifySubscribers();
  }
}

function ensureHeartbeatScheduler(intervalMs = 10000) {
  if (typeof window === "undefined") return;

  if (!sharedTimer) {
    sharedTimer = setInterval(() => {
      void performHeartbeatPing();
    }, intervalMs);
  }
}

export function useNetworkTelemetry({
  role = "STAFF",
  station = "Clinic Station",
  enabled = true,
  intervalMs = 10000,
}: UseNetworkTelemetryOptions = {}): NetworkTelemetryState {
  const [, forceUpdate] = React.useReducer((x: number) => x + 1, 0);

  React.useEffect(() => {
    if (!enabled) return;

    if (role) activeRole = role;
    if (station) activeStation = station;

    const listener = () => forceUpdate();
    subscribers.add(listener);

    getOrCreateDeviceId();
    ensureHeartbeatScheduler(intervalMs);

    // Initial check on mount if never checked
    if (!sharedLastCheckedAt && !sharedIsChecking) {
      void performHeartbeatPing();
    }

    const handleOnline = () => {
      sharedIsOnline = true;
      void performHeartbeatPing();
    };

    const handleOffline = () => {
      sharedIsOnline = false;
      sharedConnectionState = "OFFLINE";
      sharedLatency = null;
      notifySubscribers();
    };

    const handleVisibilityChange = () => {
      const visible = document.visibilityState === "visible";
      sharedTabVisible = visible;
      notifySubscribers();
      if (visible) {
        void performHeartbeatPing();
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      subscribers.delete(listener);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );

      if (subscribers.size === 0 && sharedTimer) {
        clearInterval(sharedTimer);
        sharedTimer = null;
      }
    };
  }, [enabled, role, station, intervalMs]);

  const refresh = React.useCallback(async () => {
    await performHeartbeatPing();
  }, []);

  return {
    deviceId: sharedDeviceId || getOrCreateDeviceId(),
    latencyMs: sharedLatency,
    connectionState: sharedConnectionState,
    isOnline: sharedIsOnline,
    ipAddress: sharedIpAddress,
    isTabVisible: sharedTabVisible,
    lastCheckedAt: sharedLastCheckedAt,
    isChecking: sharedIsChecking,
    refresh,
  };
}
