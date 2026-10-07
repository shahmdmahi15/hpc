import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const certDir = path.resolve(process.cwd(), "certificates");
const serverKeyPath = path.join(certDir, "server.key");
const serverCrtPath = path.join(certDir, "server.crt");

/**
 * Health check endpoint for LAN auto-discovery by Android Jetpack Compose
 * (TV, Phone, Tablet) and Windows Tauri applications.
 * Responds in < 5ms without database load.
 */
export async function GET() {
  const hasSsl = fs.existsSync(serverKeyPath) && fs.existsSync(serverCrtPath);

  return NextResponse.json(
    {
      status: "ok",
      app: "hpc",
      ssl: hasSsl,
      timestamp: new Date().toISOString(),
      name: "Health And Pain Care Center",
      role: "server",
      defaultPort: 3000,
      pid: process.pid,
      uptime: process.uptime(),
      env: process.env.NODE_ENV,
      capabilities: {
        sse: true,
        speechSynthesis: true,
        offlineMode: true,
        localPrinting: true,
      },
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
      },
    },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}
