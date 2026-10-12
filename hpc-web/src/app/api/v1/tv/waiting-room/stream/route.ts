import { NextRequest, NextResponse } from "next/server";
import {
  getRealtimeEventBus,
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

      const sendSseMessage = (event: string, data: any) => {
        if (isStreamClosed) return;
        try {
          const payload = typeof data === "string" ? data : JSON.stringify(data);
          const sseBlock = `event: ${event}\ndata: ${payload}\n\n`;
          safeEnqueue(encoder.encode(sseBlock));
        } catch {
          isStreamClosed = true;
        }
      };

      // 1. Send immediate INITIAL_STATE snapshot on connect
      try {
        const initialState = await getWaitingRoomSnapshot();
        sendSseMessage("INITIAL_STATE", initialState);
      } catch (err) {
        console.warn("[TV Stream initial state error]:", err);
        sendSseMessage("INITIAL_STATE", { error: "Failed to initialize state", serverTime: new Date().toISOString() });
      }

      // 2. Real-time event listener
      const handleRealtimeEvent = (payload: RealtimeEventPayload) => {
        if (isStreamClosed) return;
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
              roomNumber: raw.roomNumber || "Room",
              station: raw.station || raw.roomPurpose || "Chamber",
              sound: "chime",
              voiceBn: raw.voiceBn || voices.voiceBn,
              voiceEn: raw.voiceEn || voices.voiceEn,
              timestamp: payload.timestamp || new Date().toISOString(),
            };
            sendSseMessage("DOCTOR_CALLED", callEventData);
            break;
          }

          case "APPOINTMENT_UPDATED":
          case "APPOINTMENT_CREATED":
          case "APPOINTMENT_CANCELLED":
          case "PATIENT_CHECKED_IN":
          case "PATIENT_CHECKED_OUT":
          case "PATIENT_FORWARDED":
          case "CONSULTATION_SERIAL_BOOKED":
          case "CONSULTATION_SERIAL_CANCELLED":
          case "CONSULTATION_QUEUED":
          case "STATION_CHANGED":
          case "THERAPY_TIMER_UPDATED": {
            sendSseMessage("APPOINTMENT_UPDATED", {
              eventType: type,
              data,
              timestamp: payload.timestamp,
            });
            break;
          }

          case "BULLETIN_NOTICE_CREATED":
          case "BULLETIN_NOTICE_UPDATED":
          case "BULLETIN_NOTICE_DELETED": {
            sendSseMessage(type, data);
            break;
          }

          case "SYSTEM_BROADCAST_ALERT": {
            sendSseMessage("SYSTEM_BROADCAST_ALERT", data);
            break;
          }

          default:
            // Other events do not trigger full TV updates
            break;
        }
      };

      bus.on("*", handleRealtimeEvent);

      // 3. Keep-alive heartbeat comment & PING event every 15 seconds
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
