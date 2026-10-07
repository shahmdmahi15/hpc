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

  // Event deduplication cache: avoids double firing when both named event and onmessage arrive
  const processedEventsRef = React.useRef<Map<string, number>>(new Map());

  const dispatchEvent = React.useCallback(
    (payload: RealtimeEventPayload) => {
      if (!payload || !payload.type) return;

      const entityId =
        payload.data?.id ??
        payload.data?.appointmentId ??
        payload.data?.patientId ??
        payload.data?.slotId ??
        payload.data?.roomId ??
        "";
      const eventKey = `${payload.type}:${payload.timestamp}:${typeof entityId === "object" ? JSON.stringify(entityId) : entityId}`;
      const now = Date.now();
      const lastProcessed = processedEventsRef.current.get(eventKey) || 0;

      // Ignore if dispatched within the last 500ms
      if (now - lastProcessed < 500) {
        return;
      }

      processedEventsRef.current.set(eventKey, now);

      // Clean up cache periodically
      if (processedEventsRef.current.size > 100) {
        for (const [k, time] of processedEventsRef.current.entries()) {
          if (now - time > 10000) {
            processedEventsRef.current.delete(k);
          }
        }
      }

      setLastEvent(payload);
      onEventRef.current?.(payload);
    },
    [],
  );

  const eventSourceRef = React.useRef<EventSource | null>(null);
  const reconnectTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptRef = React.useRef(0);

  const connect = React.useCallback(() => {
    if (!enabled) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    setConnectionStatus("connecting");
    const es = new EventSource("/api/realtime/sse");
    eventSourceRef.current = es;

    es.addEventListener("connected", () => {
      setConnectionStatus("connected");
      reconnectAttemptRef.current = 0;
    });

    es.onopen = () => {
      setConnectionStatus("connected");
      reconnectAttemptRef.current = 0;
    };

    // Generic broadcast handler
    es.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data) as RealtimeEventPayload;
        dispatchEvent(payload);
      } catch {
        // Ping or non-JSON
      }
    };

    // Specific event listeners for all clinical entities
    const eventTypes = [
      "appointment_created",
      "appointment_updated",
      "appointment_cancelled",
      "patient_created",
      "patient_updated",
      "slot_updated",
      "doctor_called",
      "room_updated",
    ];

    eventTypes.forEach((evtType) => {
      es.addEventListener(evtType, (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data) as RealtimeEventPayload;
          dispatchEvent(payload);
        } catch {
          // Ignore
        }
      });
    });

    es.onerror = () => {
      setConnectionStatus("disconnected");
      es.close();
      eventSourceRef.current = null;

      // Smart reconnect with exponential backoff: 1s, 2s, 4s, capped at 8s
      reconnectAttemptRef.current += 1;
      const delay = Math.min(1000 * Math.pow(1.5, reconnectAttemptRef.current), 8000);
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, delay);
    };
  }, [enabled, dispatchEvent]);

  React.useEffect(() => {
    if (!enabled) {
      setConnectionStatus("disconnected");
      return;
    }

    connect();

    // Auto-reconnect when device comes back online or browser tab resumes
    const handleOnline = () => {
      connect();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (!eventSourceRef.current || eventSourceRef.current.readyState === EventSource.CLOSED) {
          connect();
        }
      }
    };

    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [enabled, connect]);

  return {
    connectionStatus,
    lastEvent,
    reconnect: connect,
  };
}
