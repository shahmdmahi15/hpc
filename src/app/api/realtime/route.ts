import { NextRequest } from "next/server";
import { realtimeBus, RealtimePayload } from "@/lib/events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      const initialPayload: RealtimePayload = {
        type: "SERIAL_UPDATED",
        timestamp: new Date().toISOString(),
        data: { message: "Connected to HPC Realtime Event Stream" },
      };
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify(initialPayload)}\n\n`),
      );

      // Event listener for all system changes
      const onRealtimeEvent = (payload: RealtimePayload) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(payload)}\n\n`),
          );
        } catch {
          // Controller might be closed
        }
      };

      realtimeBus.on("realtime", onRealtimeEvent);

      // Keep-alive heartbeat ping every 15s
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(heartbeatInterval);
        }
      }, 15000);

      // Cleanup when client disconnects
      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeatInterval);
        realtimeBus.off("realtime", onRealtimeEvent);
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
