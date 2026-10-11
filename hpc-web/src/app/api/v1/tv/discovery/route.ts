import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Cache-Control",
};

/**
 * OPTIONS /api/v1/tv/discovery
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

/**
 * GET /api/v1/tv/discovery
 * Network auto-discovery manifest endpoint for Android TV and client devices.
 */
export async function GET(request: NextRequest) {
  const port = parseInt(process.env.PORT || "3000", 10);
  const certDir = path.resolve(process.cwd(), "certificates");
  const serverKeyPath = path.join(certDir, "server.key");
  const serverCrtPath = path.join(certDir, "server.crt");
  const hasSsl = fs.existsSync(serverKeyPath) && fs.existsSync(serverCrtPath);

  return NextResponse.json(
    {
      service: "hpc-clinic-server",
      version: "1.0",
      name: "Health Peak Center",
      port,
      ssl: hasSsl,
      endpoints: {
        snapshot: "/api/v1/tv/waiting-room",
        stream: "/api/v1/tv/waiting-room/stream",
        heartbeat: "/api/network/heartbeat",
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
}
