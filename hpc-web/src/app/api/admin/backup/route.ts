import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { Role } from "@/generated/prisma/enums";
import { backupDatabaseToFolder } from "@/lib/prisma";
import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const sessionData = await getCurrentSession();
    if (!sessionData || sessionData.user.role !== Role.ADMIN) {
      return new NextResponse("Unauthorized: Admin privileges required", {
        status: 403,
      });
    }

    const backupPath = await backupDatabaseToFolder();
    const fileName = path.basename(backupPath);
    const fileBuffer = fs.readFileSync(backupPath);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/x-sqlite3",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": fileBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("[Database Backup Error]:", error);
    return new NextResponse(
      JSON.stringify({
        error: "Failed to generate database backup",
        details: String(error),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
