import { NextRequest, NextResponse } from "next/server";
import {
  getRealtimeEventBus,
  getLatestRealtimeSeq,
  getRealtimeEventsSince,
  type RealtimeEventPayload,
} from "@/lib/realtime/event-bus";
import {
  getWaitingRoomSnapshot,
  generateDoctorCallVoices,
} from "@/lib/tv/waiting-room-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Cache-Control, Last-Event-ID",
};

/**
 * OPTIONS /api/v1/tv/waiting-room/stream
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

/**
 * GET /api/v1/tv/waiting-room/stream
 * High performance Server-Sent Events (SSE) stream dedicated for Android TV.
 * Sends immediate INITIAL_STATE snapshot upon handshake.
 * Broadcasts DOCTOR_CALLED, APPOINTMENT_UPDATED, BULLETIN_NOTICE_*, and SYSTEM_BROADCAST_ALERT.
 * Keeps connection alive every 15s with heartbeat comments & PING event.
 * Syncs multi-process SQLite WAL events every 1000ms.
 */
export async function GET(request: NextRequest) {
  const bus = getRealtimeEventBus();
  const encoder = new TextEncoder();

  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      let isStreamClosed = false;

      const safeEnqueue = (chunk: Uint8Array) => {
        if (isStreamClosed) return;
        try {
          controller.enqueue(chunk);
        } catch {
          isStreamClosed = true;
        }
      };

      const sendSseMessage = (event: string, data: any, seq?: number) => {
        if (isStreamClosed) return;
        try {
          const payload = typeof data === "string" ? data : JSON.stringify(data);
          const idPrefix = seq ? `id: ${seq}\n` : "";
          const sseBlock = `${idPrefix}event: ${event}\ndata: ${payload}\n\n`;
          safeEnqueue(encoder.encode(sseBlock));
        } catch {
          isStreamClosed = true;
        }
      };

      const currentSeq = getLatestRealtimeSeq();
      let lastStreamedSeq = currentSeq;

      // 1. Send immediate INITIAL_STATE snapshot on connect
      try {
        const initialState = await getWaitingRoomSnapshot();
        sendSseMessage("INITIAL_STATE", initialState, currentSeq);
      } catch (err) {
        console.warn("[TV Stream initial state error]:", err);
        sendSseMessage("INITIAL_STATE", { error: "Failed to initialize state", serverTime: new Date().toISOString() });
      }

      // 2. Real-time event listener
      const handleRealtimeEvent = (payload: RealtimeEventPayload) => {
        if (isStreamClosed) return;
        if (payload.seq && payload.seq > lastStreamedSeq) {
          lastStreamedSeq = payload.seq;
        }
        const type = payload.type;
        const data = payload.data || {};

        switch (type) {
          case "DOCTOR_CALLED": {
            const raw = data;
            const voices = generateDoctorCallVoices(
              raw.patientName || "Patient",
              raw.roomNumber || "Chamber",
              raw.serialNumber,
            );
            const callEventData = {
              appointmentId: raw.appointmentId || "",
              serialNumber: raw.serialNumber,
              patientName: raw.patientName || "Patient",
              gender: raw.gender ?? null,
              roomNumber: raw.roomNumber || "Room",
              station: raw.station || raw.roomPurpose || "Chamber",
              sound: "chime",
              voiceBn: raw.voiceBn || voices.voiceBn,
              voiceEn: raw.voiceEn || voices.voiceEn,
              calledAt: raw.calledAt || payload.timestamp || new Date().toISOString(),
              timestamp: payload.timestamp || new Date().toISOString(),
            };
            sendSseMessage("DOCTOR_CALLED", callEventData, payload.seq);
            break;
          }

          case "APPOINTMENT_UPDATED":
          case "APPOINTMENT_CREATED":
          case "APPOINTMENT_CANCELLED":
          case "PATIENT_CREATED":
          case "PATIENT_UPDATED":
          case "PATIENT_CHECKED_IN":
          case "PATIENT_CHECKED_OUT":
          case "PATIENT_FORWARDED":
          case "PATIENT_QUEUED_FOR_THERAPY":
          case "CONSULTATION_SERIAL_BOOKED":
          case "CONSULTATION_SERIAL_CANCELLED":
          case "CONSULTATION_QUEUED":
          case "STATION_CHANGED":
          case "ROOM_UPDATED":
          case "SLOT_UPDATED":
          case "ROOM_SWITCHED":
          case "THERAPY_TIMER_UPDATED": {
            sendSseMessage("APPOINTMENT_UPDATED", {
              eventType: type,
              data,
              timestamp: payload.timestamp,
            }, payload.seq);
            break;
          }

          case "BULLETIN_NOTICE_CREATED":
          case "BULLETIN_NOTICE_UPDATED":
          case "BULLETIN_NOTICE_DELETED": {
            sendSseMessage(type, data, payload.seq);
            break;
          }

          case "SYSTEM_BROADCAST_ALERT": {
            sendSseMessage("SYSTEM_BROADCAST_ALERT", data, payload.seq);
            break;
          }

          default:
            // Other events do not trigger full TV updates
            break;
        }
      };

      bus.on("*", handleRealtimeEvent);

      // 3. Multi-process SQLite WAL synchronization ticker every 1000ms
      // Catches and streams any events committed to SQLite WAL by other server worker processes
      const crossProcessSyncInterval = setInterval(() => {
        if (isStreamClosed) {
          clearInterval(crossProcessSyncInterval);
          return;
        }
        try {
          const currentMaxSeq = getLatestRealtimeSeq();
          if (currentMaxSeq > lastStreamedSeq) {
            const newEvents = getRealtimeEventsSince(lastStreamedSeq, 50);
            for (const item of newEvents) {
              handleRealtimeEvent(item);
              if (item.seq && item.seq > lastStreamedSeq) {
                lastStreamedSeq = item.seq;
              }
            }
          }
        } catch {
          if (cleanup) cleanup();
        }
      }, 1000);

      // 4. Keep-alive heartbeat comment & PING event every 15 seconds
      const pingInterval = setInterval(() => {
        if (isStreamClosed) {
          clearInterval(pingInterval);
          return;
        }
        try {
          safeEnqueue(encoder.encode(": heartbeat\n\n"));
          sendSseMessage("PING", { ts: Date.now() });
        } catch {
          isStreamClosed = true;
          clearInterval(pingInterval);
        }
      }, 15000);

      cleanup = () => {
        if (isStreamClosed) return;
        isStreamClosed = true;
        clearInterval(crossProcessSyncInterval);
        clearInterval(pingInterval);
        bus.off("*", handleRealtimeEvent);
        try {
          controller.close();
        } catch {
          // Controller might already be closed
        }
      };

      // 4. Clean up listener on client disconnect
      request.signal.addEventListener("abort", () => {
        if (cleanup) cleanup();
      });
    },
    cancel() {
      if (cleanup) cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
