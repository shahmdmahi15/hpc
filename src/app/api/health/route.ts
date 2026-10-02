import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Health check endpoint for LAN auto-discovery by Android Jetpack Compose
 * (TV, Phone, Tablet) and Windows Tauri applications.
 * Responds in < 5ms without database load.
 */
export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      app: "HPC",
      name: "Health And Pain Care Center",
      role: "server",
      defaultPort: 3000,
      timestamp: new Date().toISOString(),
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
