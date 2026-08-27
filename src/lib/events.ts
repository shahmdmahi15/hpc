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
  | "LEDGER_AUDITED";

export interface RealtimePayload {
  type: RealtimeEventType;
  timestamp: string;
  data?: any;
}

class RealtimeEventBus extends EventEmitter {
  constructor() {
    super();
    // Allow up to 1000 concurrent listeners for active kiosks and client panels
    this.setMaxListeners(1000);
  }

  notify(type: RealtimeEventType, data?: any) {
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
