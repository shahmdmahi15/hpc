import { NextRequest, NextResponse } from "next/server";
import { recordDeviceHeartbeatAction } from "@/actions/admin/device-fleet.action";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Cache-Control",
};

/**
 * OPTIONS /api/network/heartbeat
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

/**
 * Helper to extract and normalize client IP address
 */
function extractClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  const clientIpHeader = request.headers.get("x-client-ip");

  let rawIp =
    forwardedFor?.split(",")[0]?.trim() ||
    realIp?.trim() ||
    cfConnectingIp?.trim() ||
    clientIpHeader?.trim() ||
    "127.0.0.1";

  if (rawIp.startsWith("::ffff:")) {
    rawIp = rawIp.replace("::ffff:", "");
  }
  if (rawIp === "::1" || rawIp === "0:0:0:0:0:0:0:1") {
    rawIp = "127.0.0.1";
  }

  return rawIp;
}

/**
 * POST /api/network/heartbeat
 * Records client terminal / Android TV telemetry in ConnectedDevice.
 * Returns serverTimestamp, receivedIp, and status: "ok".
 */
export async function POST(request: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Body may be empty
    }

    const clientIp = extractClientIp(request);
    const userAgent = body.userAgent || request.headers.get("user-agent") || undefined;
    const nowMs = Date.now();

    // Calculate latency if clientTimestamp is provided and latencyMs was not explicit
    let latencyMs = typeof body.latencyMs === "number" ? body.latencyMs : 0;
    if (!latencyMs && body.clientTimestamp && typeof body.clientTimestamp === "number") {
      latencyMs = Math.max(0, nowMs - body.clientTimestamp);
    }

    if (body.deviceId) {
      try {
        await recordDeviceHeartbeatAction({
          deviceId: String(body.deviceId),
          deviceName: body.deviceName ? String(body.deviceName) : undefined,
          role: body.role ? String(body.role) : undefined,
          station: body.station ? String(body.station) : undefined,
          deviceType: body.deviceType ? String(body.deviceType) : "ANDROID_TV",
          browser: body.browser ? String(body.browser) : undefined,
          userAgent,
          latencyMs,
          metadata: {
            clientTimestamp: body.clientTimestamp ?? body.timestamp,
            tabVisible: body.tabVisible,
            receivedIp: clientIp,
          },
        });
      } catch (err) {
        console.warn("[Device heartbeat action warning]:", err);
      }
    }

    return NextResponse.json(
      {
        status: "ok",
        serverTimestamp: nowMs,
        receivedIp: clientIp,
        // Backwards compatibility fields
        ok: true,
        ipAddress: clientIp,
        serverTime: nowMs,
        received: {
          deviceId: body.deviceId ?? null,
          role: body.role ?? "STAFF",
          station: body.station ?? "Main Console",
        },
      },
      {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "Content-Type": "application/json; charset=utf-8",
        },
      },
    );
  } catch (error: any) {
    console.error("[Heartbeat API Error]:", error);
    return NextResponse.json(
      {
        status: "error",
        error: "Internal telemetry heartbeat error",
        serverTimestamp: Date.now(),
      },
      {
        status: 500,
        headers: CORS_HEADERS,
      },
    );
  }
}

/**
 * GET /api/network/heartbeat
 * Lightweight ping check for clients.
 */
export async function GET(request: NextRequest) {
  const clientIp = extractClientIp(request);
  const nowMs = Date.now();

  return NextResponse.json(
    {
      status: "ok",
      serverTimestamp: nowMs,
      receivedIp: clientIp,
      ok: true,
      ipAddress: clientIp,
      serverTime: nowMs,
    },
    {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Content-Type": "application/json; charset=utf-8",
      },
    },
  );
}
