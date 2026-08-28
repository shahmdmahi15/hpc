"use client";

import { useEffect, useState, useRef } from "react";
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
  const onEventRef = useRef(onEvent);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onEventRef.current = onEvent;
    onRefreshRef.current = onRefresh;
  }, [onEvent, onRefresh]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let isCancelled = false;

    const createConnection = () => {
      if (isCancelled) return;
      try {
        eventSource = new EventSource("/api/realtime");

        eventSource.onopen = () => {
          if (!isCancelled) setIsConnected(true);
        };

        eventSource.onmessage = (event) => {
          if (isCancelled) return;
          try {
            const payload: RealtimePayload = JSON.parse(event.data);
            setLastEvent(payload);
            onEventRef.current?.(payload);
            onRefreshRef.current?.();
          } catch {
            // ignore parse errors on keepalive comments
          }
        };

        eventSource.onerror = () => {
          if (isCancelled) return;
          setIsConnected(false);
          eventSource?.close();
          reconnectTimeout = setTimeout(createConnection, 3000);
        };
      } catch {
        if (!isCancelled) {
          reconnectTimeout = setTimeout(createConnection, 3000);
        }
      }
    };

    createConnection();

    return () => {
      isCancelled = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [enabled]);

  return {
    isConnected,
    lastEvent,
  };
}
