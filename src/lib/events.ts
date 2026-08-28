import { EventEmitter } from "events";

export type RealtimeEventType =
  | "SERIAL_CREATED"
  | "SERIAL_UPDATED"
  | "SERIAL_CALLED"
  | "SERIAL_STATUS_CHANGED"
  | "PATIENT_CREATED"
  | "PATIENT_UPDATED"
  | "ASSESSMENT_SAVED"
  | "SESSION_LOGGED"
  | "BILLING_RECORDED"
  | "LEDGER_AUDITED"
  | "FILE_CREATED"
  | "FILE_UPDATED"
  | "SLOT_ASSIGNED"
  | "SLOT_UPDATED"
  | "PAYMENT_RECORDED"
  | "ROOM_OCCUPIED"
  | "ROOM_VACATED"
  | "ROOM_UPDATED"
  | "ROOM_CREATED"
  | "ROOM_DELETED";

export interface RealtimePayload {
  type: RealtimeEventType;
  timestamp: string;
  data?: unknown;
}

class RealtimeEventBus extends EventEmitter {
  constructor() {
    super();
    // Allow up to 1000 concurrent listeners for active kiosks and client panels
    this.setMaxListeners(1000);
  }

  notify(type: RealtimeEventType, data?: unknown) {
    const payload: RealtimePayload = {
      type,
      timestamp: new Date().toISOString(),
      data,
    };
    this.emit("realtime", payload);
  }
}

declare global {
  var globalRealtimeBus: RealtimeEventBus | undefined;
}

export const realtimeBus =
  globalThis.globalRealtimeBus ?? new RealtimeEventBus();

if (process.env.NODE_ENV !== "production") {
  globalThis.globalRealtimeBus = realtimeBus;
}
