"use client";

import * as React from "react";
import type { RealtimeEventPayload } from "@/lib/realtime/event-bus";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

interface UseRealtimeEventsOptions {
  onEvent?: (event: RealtimeEventPayload) => void;
  onReconnect?: () => void;
  enabled?: boolean;
}

interface SharedSubscriber {
  onEvent: (event: RealtimeEventPayload) => void;
  onStatusChange: (status: ConnectionStatus) => void;
  onReconnect: () => void;
}

// Module-level singleton state per browser tab so multiple hooks share 1 EventSource connection
let sharedEventSource: EventSource | null = null;
let sharedStatus: ConnectionStatus = "connecting";
let sharedReconnectTimer: ReturnType<typeof setTimeout> | null = null;
let sharedPollInterval: ReturnType<typeof setInterval> | null = null;
let sharedReconnectAttempts = 0;
let sharedLatestSeq = 0;
let sharedBroadcastChannel: BroadcastChannel | null = null;
const sharedSubscribers = new Set<SharedSubscriber>();
const sharedProcessedEvents = new Map<string, number>();

function getEventDedupKey(payload: RealtimeEventPayload): string {
  if (payload.seq !== undefined) {
    return `seq:${payload.seq}`;
  }
  const entityId =
    payload.data?.id ??
    payload.data?.appointmentId ??
    payload.data?.patientId ??
    payload.data?.slotId ??
    payload.data?.roomId ??
    payload.data?.messageId ??
    "";
  return `${payload.type}:${payload.timestamp}:${typeof entityId === "object" ? JSON.stringify(entityId) : entityId}`;
}

function notifyAllSubscribers(
  payload: RealtimeEventPayload,
  fromBroadcast = false,
) {
  if (!payload || !payload.type) return;

  if (typeof payload.seq === "number" && payload.seq > sharedLatestSeq) {
    sharedLatestSeq = payload.seq;
  }

  const key = getEventDedupKey(payload);
  const now = Date.now();
  const lastTime = sharedProcessedEvents.get(key) || 0;
  if (now - lastTime < 2000) {
    return;
  }
  sharedProcessedEvents.set(key, now);

  if (sharedProcessedEvents.size > 300) {
    for (const [k, t] of sharedProcessedEvents.entries()) {
      if (now - t > 30000) {
        sharedProcessedEvents.delete(k);
      }
    }
  }

  // Forward to other tabs in the same browser via BroadcastChannel
  if (!fromBroadcast && sharedBroadcastChannel) {
    try {
      sharedBroadcastChannel.postMessage(payload);
    } catch {
      // Ignore BroadcastChannel errors
    }
  }

  sharedSubscribers.forEach((sub) => {
    try {
      sub.onEvent(payload);
    } catch (err) {
      console.error("[Realtime Subscriber Error]:", err);
    }
  });
}

function updateSharedStatus(newStatus: ConnectionStatus) {
  sharedStatus = newStatus;
  sharedSubscribers.forEach((sub) => {
    try {
      sub.onStatusChange(newStatus);
    } catch {}
  });
}

async function pollCatchUpEvents() {
  if (typeof window === "undefined" || sharedSubscribers.size === 0) return;
  try {
    const res = await fetch(
      `/api/realtime/sse?mode=poll&since=${sharedLatestSeq}`,
      { cache: "no-store" },
    );
    if (!res.ok) return;
    const data = await res.json();
    if (Array.isArray(data.events) && data.events.length > 0) {
      for (const evt of data.events) {
        notifyAllSubscribers(evt, false);
      }
    }
    if (typeof data.seq === "number" && data.seq > sharedLatestSeq) {
      sharedLatestSeq = data.seq;
    }
    if (sharedStatus !== "connected") {
      updateSharedStatus("connected");
    }
  } catch {
    // Offline or server restarting
  }
}

function ensureSharedConnection() {
  if (typeof window === "undefined" || sharedSubscribers.size === 0) return;

  // Initialize BroadcastChannel for instant multi-tab sync
  if (!sharedBroadcastChannel && typeof BroadcastChannel !== "undefined") {
    try {
      sharedBroadcastChannel = new BroadcastChannel("hpc-realtime-bus-v1");
      sharedBroadcastChannel.onmessage = (e: MessageEvent) => {
        if (e.data && e.data.type) {
          notifyAllSubscribers(e.data as RealtimeEventPayload, true);
        }
      };
    } catch {
      sharedBroadcastChannel = null;
    }
  }

  // Ensure background catch-up poll interval is active
  if (!sharedPollInterval) {
    sharedPollInterval = setInterval(() => {
      void pollCatchUpEvents();
    }, 2500);
  }

  if (
    sharedEventSource &&
    (sharedEventSource.readyState === EventSource.OPEN ||
      sharedEventSource.readyState === EventSource.CONNECTING)
  ) {
    return;
  }

  if (sharedEventSource) {
    sharedEventSource.close();
    sharedEventSource = null;
  }
  if (sharedReconnectTimer) {
    clearTimeout(sharedReconnectTimer);
    sharedReconnectTimer = null;
  }

  updateSharedStatus("connecting");
  const es = new EventSource(
    `/api/realtime/sse?since=${sharedLatestSeq}`,
  );
  sharedEventSource = es;

  es.addEventListener("connected", (e: MessageEvent) => {
    try {
      const parsed = JSON.parse(e.data);
      if (typeof parsed.seq === "number" && parsed.seq > sharedLatestSeq) {
        sharedLatestSeq = parsed.seq;
      }
    } catch {}
    const wasReconnecting = sharedReconnectAttempts > 0;
    updateSharedStatus("connected");
    sharedReconnectAttempts = 0;
    if (wasReconnecting) {
      sharedSubscribers.forEach((sub) => {
        try {
          sub.onReconnect();
        } catch {}
      });
    }
  });

  es.addEventListener("heartbeat", (e: MessageEvent) => {
    try {
      const parsed = JSON.parse(e.data);
      if (
        typeof parsed.seq === "number" &&
        sharedLatestSeq > 0 &&
        parsed.seq > sharedLatestSeq
      ) {
        void pollCatchUpEvents();
      } else if (typeof parsed.seq === "number" && sharedLatestSeq === 0) {
        sharedLatestSeq = parsed.seq;
      }
    } catch {}
  });

  es.onopen = () => {
    const wasReconnecting = sharedReconnectAttempts > 0;
    updateSharedStatus("connected");
    sharedReconnectAttempts = 0;
    if (wasReconnecting) {
      sharedSubscribers.forEach((sub) => {
        try {
          sub.onReconnect();
        } catch {}
      });
    }
  };

  es.onmessage = (e: MessageEvent) => {
    try {
      const payload = JSON.parse(e.data) as RealtimeEventPayload;
      notifyAllSubscribers(payload, false);
    } catch {
      // Ignore non-JSON comments
    }
  };

  es.onerror = () => {
    updateSharedStatus("disconnected");
    es.close();
    sharedEventSource = null;

    sharedReconnectAttempts += 1;
    const delay = Math.min(
      1000 * Math.pow(1.4, sharedReconnectAttempts),
      5000,
    );
    sharedReconnectTimer = setTimeout(() => {
      ensureSharedConnection();
    }, delay);
  };
}

function teardownSharedConnectionIfIdle() {
  if (sharedSubscribers.size > 0) return;
  if (sharedReconnectTimer) {
    clearTimeout(sharedReconnectTimer);
    sharedReconnectTimer = null;
  }
  if (sharedPollInterval) {
    clearInterval(sharedPollInterval);
    sharedPollInterval = null;
  }
  if (sharedEventSource) {
    sharedEventSource.close();
    sharedEventSource = null;
  }
  if (sharedBroadcastChannel) {
    try {
      sharedBroadcastChannel.close();
    } catch {}
    sharedBroadcastChannel = null;
  }
  sharedStatus = "disconnected";
}

export function useRealtimeEvents(options: UseRealtimeEventsOptions = {}) {
  const { onEvent, onReconnect, enabled = true } = options;
  const [connectionStatus, setConnectionStatus] =
    React.useState<ConnectionStatus>(() =>
      enabled ? sharedStatus : "disconnected",
    );
  const [lastEvent, setLastEvent] = React.useState<RealtimeEventPayload | null>(
    null,
  );

  // Synchronously keep callback refs fresh on every render
  const onEventRef = React.useRef(onEvent);
  onEventRef.current = onEvent;

  const onReconnectRef = React.useRef(onReconnect);
  onReconnectRef.current = onReconnect;

  const reconnect = React.useCallback(() => {
    if (!enabled) return;
    if (sharedEventSource) {
      sharedEventSource.close();
      sharedEventSource = null;
    }
    ensureSharedConnection();
    void pollCatchUpEvents();
  }, [enabled]);

  React.useEffect(() => {
    if (!enabled) {
      setConnectionStatus("disconnected");
      return;
    }

    const subscriber: SharedSubscriber = {
      onEvent: (evt) => {
        setLastEvent(evt);
        onEventRef.current?.(evt);
      },
      onStatusChange: (status) => {
        setConnectionStatus(status);
      },
      onReconnect: () => {
        onReconnectRef.current?.();
      },
    };

    sharedSubscribers.add(subscriber);
    setConnectionStatus(sharedStatus);
    ensureSharedConnection();

    const handleOnline = () => {
      ensureSharedConnection();
      void pollCatchUpEvents();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        ensureSharedConnection();
        void pollCatchUpEvents();
      }
    };

    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      sharedSubscribers.delete(subscriber);
      teardownSharedConnectionIfIdle();
    };
  }, [enabled]);

  return {
    connectionStatus,
    lastEvent,
    reconnect,
  };
}

