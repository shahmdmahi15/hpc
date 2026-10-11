import "server-only";
import { EventEmitter } from "events";
import Database from "better-sqlite3";
import { getDatabaseFilePath } from "@/lib/prisma";

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
  | "PRESCRIPTION_DELETED"
  | "PATIENT_NOTE_ADDED"
  | "MEDICINE_CREATED"
  | "MEDICINE_UPDATED"
  | "MEDICINE_DELETED"
  | "BULLETIN_NOTICE_CREATED"
  | "BULLETIN_NOTICE_UPDATED"
  | "BULLETIN_NOTICE_DELETED"
  | "DEVICE_CONNECTED"
  | "DEVICE_HEARTBEAT"
  | "DEVICE_DISCONNECTED"
  | "SYSTEM_BROADCAST_ALERT";

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
  var __HPC_REALTIME_DB__: InstanceType<typeof Database> | undefined;
}

const MAX_EVENT_ROWS_RETAINED = 2000;

/**
 * Returns the persistent SQLite WAL database handle for the real-time event journal.
 * Enables zero-external-cloud multi-process real-time event synchronization and replay.
 */
function getRealtimeDb(): InstanceType<typeof Database> | null {
  if (globalThis.__HPC_REALTIME_DB__) {
    return globalThis.__HPC_REALTIME_DB__;
  }
  try {
    const dbPath = getDatabaseFilePath();
    const db = new Database(dbPath, { timeout: 5000 });
    db.pragma("journal_mode = WAL");
    db.pragma("synchronous = NORMAL");
    db.pragma("busy_timeout = 5000");

    db.exec(`
      CREATE TABLE IF NOT EXISTS realtime_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        data TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_realtime_events_id ON realtime_events(id);
    `);

    globalThis.__HPC_REALTIME_DB__ = db;
    return db;
  } catch (err) {
    console.error("[Realtime SQLite WAL init error]:", err);
    return null;
  }
}

/**
 * Returns a persistent singleton Node EventEmitter instance for the current process.
 */
export function getRealtimeEventBus(): EventEmitter {
  if (!globalThis.__HPC_EVENT_BUS__) {
    const bus = new EventEmitter();
    // Allow ample listeners for concurrent clinic stations and TV displays
    bus.setMaxListeners(1000);
    globalThis.__HPC_EVENT_BUS__ = bus;
  }
  return globalThis.__HPC_EVENT_BUS__;
}

/**
 * Fetches the highest committed real-time sequence ID directly from the SQLite WAL journal.
 */
export function getLatestRealtimeSeq(): number {
  try {
    const db = getRealtimeDb();
    if (!db) return 0;
    const row = db
      .prepare("SELECT COALESCE(MAX(id), 0) AS maxId FROM realtime_events")
      .get() as { maxId: number } | undefined;
    return row?.maxId ?? 0;
  } catch (err) {
    console.warn("[getLatestRealtimeSeq error]:", err);
    return 0;
  }
}

/**
 * Replays missed events from SQLite WAL journal strictly in chronological order.
 */
export function getRealtimeEventsSince(
  sinceSeq: number,
  limit = 200,
): RealtimeEventPayload[] {
  if (sinceSeq < 0) sinceSeq = 0;
  try {
    const db = getRealtimeDb();
    if (!db) return [];
    const rows = db
      .prepare(
        "SELECT id, type, data, timestamp FROM realtime_events WHERE id > ? ORDER BY id ASC LIMIT ?",
      )
      .all(sinceSeq, limit) as Array<{
      id: number;
      type: string;
      data: string;
      timestamp: string;
    }>;

    return rows.map((r) => {
      let parsedData: any = {};
      try {
        parsedData = JSON.parse(r.data);
      } catch {
        parsedData = r.data;
      }
      return {
        seq: r.id,
        type: r.type as RealtimeEventType,
        timestamp: r.timestamp,
        data: parsedData,
      };
    });
  } catch (err) {
    console.warn("[getRealtimeEventsSince error]:", err);
    return [];
  }
}

/**
 * Broadcasts an event to all active Server-Sent Event (SSE) listeners
 * and atomically persists it to the SQLite WAL journal for multi-process sync and replay.
 */
export function emitRealtimeEvent<T = any>(type: RealtimeEventType, data: T) {
  try {
    const db = getRealtimeDb();
    const timestamp = new Date().toISOString();
    let nextSeq = 0;

    if (db) {
      const dataStr =
        typeof data === "string" ? data : JSON.stringify(data ?? {});
      const info = db
        .prepare(
          "INSERT INTO realtime_events (type, data, timestamp) VALUES (?, ?, ?)",
        )
        .run(type, dataStr, timestamp);
      nextSeq = Number(info.lastInsertRowid);

      // Periodically prune historical events so database remains lean
      if (nextSeq % 100 === 0 && nextSeq > MAX_EVENT_ROWS_RETAINED) {
        try {
          db.prepare("DELETE FROM realtime_events WHERE id < ?").run(
            nextSeq - MAX_EVENT_ROWS_RETAINED,
          );
        } catch {
          // Ignore pruning error
        }
      }
    }

    const payload: RealtimeEventPayload<T> = {
      seq: nextSeq,
      type,
      timestamp,
      data,
    };

    const bus = getRealtimeEventBus();
    bus.emit(type, payload);
    bus.emit("*", payload);
  } catch (error) {
    console.error("[Realtime Event Bus Error]: Failed to emit event:", error);
  }
}
