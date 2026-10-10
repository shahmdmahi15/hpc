import { EventEmitter } from "events";

export type RealtimeEventType =
  | "APPOINTMENT_CREATED"
  | "APPOINTMENT_UPDATED"
  | "APPOINTMENT_CANCELLED"
  | "PATIENT_CREATED"
  | "PATIENT_UPDATED"
  | "SLOT_UPDATED"
  | "DOCTOR_CALLED"
  | "ROOM_UPDATED"
  | "STATION_CHANGED"
  | "CONSULTATION_SERIAL_BOOKED"
  | "CONSULTATION_SERIAL_CANCELLED"
  | "CONSULTATION_QUEUED"
  | "THERAPY_FORWARDED_FOR_DUE"
  | "PATIENT_QUEUED_FOR_THERAPY"
  | "PATIENT_CHECKED_IN"
  | "PATIENT_CHECKED_OUT"
  | "TREATMENT_PLAN_UPDATED"
  | "MEDICAL_RECORD_CREATED"
  | "INVOICE_UPDATED"
  | "PAYMENT_COLLECTED"
  | "ADMIN_CONFIG_UPDATED"
  | "PATIENT_FORWARDED"
  | "CHAT_MESSAGE_SENT"
  | "CHAT_MESSAGE_DELETED"
  | "THERAPY_TIMER_UPDATED"
  | "PRESCRIPTION_CREATED"
  | "PRESCRIPTION_DELETED";

export interface RealtimeEventPayload<T = any> {
  seq?: number;
  type: RealtimeEventType;
  timestamp: string;
  data: T;
}

declare global {
  // eslint-disable-next-line no-var
  var __HPC_EVENT_BUS__: EventEmitter | undefined;
  // eslint-disable-next-line no-var
  var __HPC_EVENT_SEQ__: number | undefined;
  // eslint-disable-next-line no-var
  var __HPC_EVENT_HISTORY__: RealtimeEventPayload[] | undefined;
}

const MAX_EVENT_HISTORY = 250;

/**
 * Returns a persistent singleton Node EventEmitter instance across dev hot reloads
 * and production standalone runtime. Zero external cloud services, 100% offline.
 */
export function getRealtimeEventBus(): EventEmitter {
  if (!globalThis.__HPC_EVENT_BUS__) {
    const bus = new EventEmitter();
    // Allow ample listeners for concurrent clinic stations and TV displays
    bus.setMaxListeners(500);
    globalThis.__HPC_EVENT_BUS__ = bus;
  }
  return globalThis.__HPC_EVENT_BUS__;
}

export function getLatestRealtimeSeq(): number {
  return globalThis.__HPC_EVENT_SEQ__ ?? 0;
}

export function getRealtimeEventsSince(sinceSeq: number): RealtimeEventPayload[] {
  const history = globalThis.__HPC_EVENT_HISTORY__ ?? [];
  if (sinceSeq <= 0) return [];
  return history.filter((evt) => (evt.seq ?? 0) > sinceSeq);
}

/**
 * Broadcasts an event to all active Server-Sent Event (SSE) listeners
 * and records it in the in-memory ring buffer for instant catch-up.
 */
export function emitRealtimeEvent<T = any>(type: RealtimeEventType, data: T) {
  try {
    const bus = getRealtimeEventBus();
    const nextSeq = (globalThis.__HPC_EVENT_SEQ__ ?? 0) + 1;
    globalThis.__HPC_EVENT_SEQ__ = nextSeq;

    const payload: RealtimeEventPayload<T> = {
      seq: nextSeq,
      type,
      timestamp: new Date().toISOString(),
      data,
    };

    if (!globalThis.__HPC_EVENT_HISTORY__) {
      globalThis.__HPC_EVENT_HISTORY__ = [];
    }
    globalThis.__HPC_EVENT_HISTORY__.push(payload);
    if (globalThis.__HPC_EVENT_HISTORY__.length > MAX_EVENT_HISTORY) {
      globalThis.__HPC_EVENT_HISTORY__.splice(
        0,
        globalThis.__HPC_EVENT_HISTORY__.length - MAX_EVENT_HISTORY,
      );
    }

    bus.emit(type, payload);
    bus.emit("*", payload);
  } catch (error) {
    console.error("[Realtime Event Bus Error]: Failed to emit event:", error);
  }
}

