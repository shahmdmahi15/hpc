import { NextRequest, NextResponse } from "next/server";
import {
  getRealtimeEventBus,
  getLatestRealtimeSeq,
  getRealtimeEventsSince,
  type RealtimeEventPayload,
} from "@/lib/realtime/event-bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-Sent Events (SSE) + Catch-Up Poll Endpoint for 100% offline real-time synchronization.
 * Runs on Node.js standalone runtime with native ReadableStream and EventSource.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode");
  const sinceParam = Number(searchParams.get("since") || "0");

  // Fast JSON catch-up poll mode for zero-miss synchronization
  if (mode === "poll") {
    const latestSeq = getLatestRealtimeSeq();
    const events =
      sinceParam > 0 && sinceParam < latestSeq
        ? getRealtimeEventsSince(sinceParam)
        : [];
    return NextResponse.json(
      {
        connected: true,
        seq: latestSeq,
        events,
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  }

  const bus = getRealtimeEventBus();
  const encoder = new TextEncoder();

  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // 1. Initial connection handshake with current sequence number
      const currentSeq = getLatestRealtimeSeq();
      const initialPayload = JSON.stringify({
        connected: true,
        seq: currentSeq,
        timestamp: new Date().toISOString(),
      });
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${initialPayload}\n\n`),
      );

      // Replay any missed events if client reconnected with ?since=
      if (sinceParam > 0 && sinceParam < currentSeq) {
        const missed = getRealtimeEventsSince(sinceParam);
        for (const item of missed) {
          try {
            const data = JSON.stringify(item);
            controller.enqueue(
              encoder.encode(`id: ${item.seq ?? ""}\ndata: ${data}\n\n`),
            );
          } catch {
            // Stream closed
          }
        }
      }

      // 2. Event listener for real-time broadcast
      const onEvent = (payload: RealtimeEventPayload) => {
        try {
          const data = JSON.stringify(payload);
          controller.enqueue(
            encoder.encode(`id: ${payload.seq ?? ""}\ndata: ${data}\n\n`),
          );
        } catch {
          // Stream might be closed
        }
      };

      bus.on("*", onEvent);

      // 3. Heartbeat keep-alive with latest seq every 8 seconds
      const pingInterval = setInterval(() => {
        try {
          const heartbeatPayload = JSON.stringify({
            seq: getLatestRealtimeSeq(),
            ts: Date.now(),
          });
          controller.enqueue(
            encoder.encode(`event: heartbeat\ndata: ${heartbeatPayload}\n\n`),
          );
        } catch {
          if (cleanup) cleanup();
        }
      }, 8000);

      cleanup = () => {
        clearInterval(pingInterval);
        bus.off("*", onEvent);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      };

      // 4. Cleanup on client disconnect
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
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

