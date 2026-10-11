import { NextRequest, NextResponse } from "next/server";
import { getWaitingRoomSnapshot } from "@/lib/tv/waiting-room-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Cache-Control",
  "Access-Control-Max-Age": "86400",
};

/**
 * OPTIONS /api/v1/tv/waiting-room
 * Preflight handler ensuring zero CORS issues for Android TV and Native apps.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

/**
 * GET /api/v1/tv/waiting-room
 * High performance snapshot endpoint for Android TV Waiting Room display.
 * Returns Clinic Info, Active Calling Announcements, Doctor Consultation Queues,
 * Therapy Bed Statuses & Timers, Active Bulletin Notices, and Telemetry.
 */
export async function GET(request: NextRequest) {
  try {
    const snapshot = await getWaitingRoomSnapshot();

    return NextResponse.json(snapshot, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error: any) {
    console.error("[TV Waiting Room API Error]:", error);

    return NextResponse.json(
      {
        error: "Failed to load waiting room snapshot",
        message: error?.message || "Internal Server Error",
        serverTime: new Date().toISOString(),
      },
      {
        status: 500,
        headers: {
          ...CORS_HEADERS,
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
