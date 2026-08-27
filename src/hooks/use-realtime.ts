"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { RealtimePayload } from "@/lib/events";

interface UseRealtimeOptions {
  onEvent?: (payload: RealtimePayload) => void;
  onRefresh?: () => void;
  enabled?: boolean;
}

export function useRealtime(options: UseRealtimeOptions = {}) {
  const { onEvent, onRefresh, enabled = true } = options;
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<RealtimePayload | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const onEventRef = useRef(onEvent);
  const onRefreshRef = useRef(onRefresh);

  onEventRef.current = onEvent;
  onRefreshRef.current = onRefresh;

  const connect = useCallback(() => {
    if (!enabled || typeof window === "undefined") return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      const eventSource = new EventSource("/api/realtime");
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setIsConnected(true);
      };

      eventSource.onmessage = (event) => {
        try {
          const payload: RealtimePayload = JSON.parse(event.data);
          setLastEvent(payload);
          if (onEventRef.current) {
            onEventRef.current(payload);
          }
          if (onRefreshRef.current) {
            onRefreshRef.current();
          }
        } catch {
          // ignore parse errors on keepalive comments
        }
      };

      eventSource.onerror = () => {
        setIsConnected(false);
        eventSource.close();
        // Retry connection after 3 seconds
        setTimeout(connect, 3000);
      };
    } catch {
      setIsConnected(false);
      setTimeout(connect, 3000);
    }
  }, [enabled]);

  useEffect(() => {
    connect();
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [connect]);

  return {
    isConnected,
    lastEvent,
    reconnect: connect,
  };
}
