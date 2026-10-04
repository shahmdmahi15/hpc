import { EventEmitter } from "events";

export type RealtimeEventType =
  | "APPOINTMENT_CREATED"
  | "APPOINTMENT_UPDATED"
  | "APPOINTMENT_CANCELLED"
  | "PATIENT_CREATED"
  | "PATIENT_UPDATED"
  | "SLOT_UPDATED"
  | "DOCTOR_CALLED"
  | "ROOM_UPDATED";

export interface RealtimeEventPayload<T = any> {
  type: RealtimeEventType;
  timestamp: string;
  data: T;
}

declare global {
  // eslint-disable-next-line no-var
  var __HPC_EVENT_BUS__: EventEmitter | undefined;
}

/**
 * Returns a persistent singleton Node EventEmitter instance across dev hot reloads
 * and production standalone runtime. Zero external cloud services, 100% offline.
 */
export function getRealtimeEventBus(): EventEmitter {
  if (!globalThis.__HPC_EVENT_BUS__) {
    const bus = new EventEmitter();
    // Allow ample listeners for concurrent receptionist and TV display tabs
    bus.setMaxListeners(100);
    globalThis.__HPC_EVENT_BUS__ = bus;
  }
  return globalThis.__HPC_EVENT_BUS__;
}

/**
 * Broadcasts an event to all active Server-Sent Event (SSE) listeners.
 */
export function emitRealtimeEvent<T = any>(type: RealtimeEventType, data: T) {
  try {
    const bus = getRealtimeEventBus();
    const payload: RealtimeEventPayload<T> = {
      type,
      timestamp: new Date().toISOString(),
      data,
    };
    bus.emit(type, payload);
    bus.emit("*", payload);
  } catch (error) {
    console.error("[Realtime Event Bus Error]: Failed to emit event:", error);
  }
}
