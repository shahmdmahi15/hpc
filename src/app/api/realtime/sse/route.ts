import { NextRequest } from "next/server";
import {
  getRealtimeEventBus,
  type RealtimeEventPayload,
} from "@/lib/realtime/event-bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-Sent Events (SSE) Endpoint for 100% offline real-time synchronization.
 * Runs on Node.js standalone runtime with native ReadableStream and EventSource.
 */
export async function GET(request: NextRequest) {
  const bus = getRealtimeEventBus();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // 1. Initial connection handshake
      const initialPayload = JSON.stringify({
        connected: true,
        timestamp: new Date().toISOString(),
      });
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${initialPayload}\n\n`),
      );

      // 2. Event listener for real-time broadcast
      const onEvent = (payload: RealtimeEventPayload) => {
        try {
          const eventName = payload.type.toLowerCase();
          const data = JSON.stringify(payload);
          controller.enqueue(
            encoder.encode(`event: ${eventName}\ndata: ${data}\n\n`),
          );
        } catch {
          // Stream might be closed
        }
      };

      bus.on("*", onEvent);

      // 3. Heartbeat keep-alive ping every 15 seconds
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(pingInterval);
        }
      }, 15000);

      // 4. Cleanup on client disconnect
      request.signal.addEventListener("abort", () => {
        clearInterval(pingInterval);
        bus.off("*", onEvent);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
