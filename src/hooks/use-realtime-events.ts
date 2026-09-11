"use client";

import * as React from "react";
import type { RealtimeEventPayload } from "@/lib/realtime/event-bus";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

interface UseRealtimeEventsOptions {
  onEvent?: (event: RealtimeEventPayload) => void;
  enabled?: boolean;
}

export function useRealtimeEvents(options: UseRealtimeEventsOptions = {}) {
  const { onEvent, enabled = true } = options;
  const [connectionStatus, setConnectionStatus] =
    React.useState<ConnectionStatus>(() =>
      enabled ? "connecting" : "disconnected",
    );
  const [lastEvent, setLastEvent] = React.useState<RealtimeEventPayload | null>(
    null,
  );

  // Preserve callback reference without resetting effect
  const onEventRef = React.useRef(onEvent);
  React.useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  React.useEffect(() => {
    if (!enabled) {
      return;
    }

    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let isCleanedUp = false;

    const connect = () => {
      if (isCleanedUp) return;

      setConnectionStatus("connecting");
      eventSource = new EventSource("/api/realtime/sse");

      eventSource.addEventListener("connected", () => {
        if (!isCleanedUp) {
          setConnectionStatus("connected");
        }
      });

      // Handle general message
      eventSource.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data) as RealtimeEventPayload;
          if (!isCleanedUp) {
            setLastEvent(payload);
            onEventRef.current?.(payload);
          }
        } catch {
          // Non-JSON message, ignore
        }
      };

      // Handle specific event types
      const eventTypes = [
        "appointment_created",
        "appointment_updated",
        "appointment_cancelled",
        "patient_created",
        "slot_updated",
        "doctor_called",
      ];

      eventTypes.forEach((evtType) => {
        eventSource?.addEventListener(evtType, (e: MessageEvent) => {
          try {
            const payload = JSON.parse(e.data) as RealtimeEventPayload;
            if (!isCleanedUp) {
              setLastEvent(payload);
              onEventRef.current?.(payload);
            }
          } catch {
            // Ignore
          }
        });
      });

      eventSource.onerror = () => {
        if (!isCleanedUp) {
          setConnectionStatus("disconnected");
          eventSource?.close();
          // Auto-reconnect after 3 seconds
          reconnectTimeout = setTimeout(connect, 3000);
        }
      };
    };

    connect();

    return () => {
      isCleanedUp = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [enabled]);

  return {
    connectionStatus,
    lastEvent,
  };
}
