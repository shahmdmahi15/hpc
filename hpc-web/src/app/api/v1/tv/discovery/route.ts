import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

import crypto from "crypto";

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
 * Includes CA SHA-256 fingerprint for self-healing certificate rotation.
 */
export async function GET(request: NextRequest) {
  const port = parseInt(process.env.PORT || "3000", 10);
  const certDir = path.resolve(process.cwd(), "certificates");
  const serverKeyPath = path.join(certDir, "server.key");
  const serverCrtPath = path.join(certDir, "server.crt");
  const rootCrtPath = path.join(certDir, "rootCA.crt");
  const hasSsl = fs.existsSync(serverKeyPath) && fs.existsSync(serverCrtPath);

  let caFingerprint = "";
  if (fs.existsSync(rootCrtPath)) {
    try {
      const buf = fs.readFileSync(rootCrtPath);
      caFingerprint = crypto.createHash("sha256").update(buf).digest("hex");
    } catch {}
  }

  return NextResponse.json(
    {
      service: "hpc-clinic-server",
      version: "1.0",
      name: "Health & Pain Care Center",
      port,
      ssl: hasSsl,
      caFingerprint,
      caUrl: "/rootCA.crt",
      endpoints: {
        snapshot: "/api/v1/tv/waiting-room",
        stream: "/api/v1/tv/waiting-room/stream",
        heartbeat: "/api/network/heartbeat",
        certificate: "/rootCA.crt",
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
