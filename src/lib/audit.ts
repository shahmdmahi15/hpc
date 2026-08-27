import "server-only";
import prisma from "@/lib/prisma";
import { getClientDeviceInfo } from "@/lib/device";
import { AuditAction, AuditStatus } from "@/generated/prisma/enums";

export interface LogAuditOptions {
  action: AuditAction;
  status?: AuditStatus;
  userId?: string | null;
  entity?: string;
  entityId?: string;
  details?: Record<string, unknown> | string | null;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Persists an audit log entry in the database.
 * Automatically resolves client IP and User-Agent if not explicitly provided.
 * Catches any internal errors to avoid interrupting primary user flows.
 */
export async function logAudit(options: LogAuditOptions): Promise<void> {
  try {
    let { ipAddress, userAgent } = options;

    // If client metadata was not passed explicitly, attempt auto-extraction from request headers
    if (!ipAddress || !userAgent) {
      try {
        const clientInfo = await getClientDeviceInfo();
        if (!ipAddress) ipAddress = clientInfo.ipAddress;
        if (!userAgent) userAgent = clientInfo.userAgent;
      } catch {
        // Headers may not be available in certain contexts; fallback gracefully
        ipAddress = ipAddress || "127.0.0.1";
        userAgent = userAgent || "System / Background";
      }
    }

    const serializedDetails =
      options.details === undefined || options.details === null
        ? null
        : typeof options.details === "string"
          ? options.details
          : JSON.stringify(options.details);

    await prisma.auditLog.create({
      data: {
        action: options.action,
        status: options.status || AuditStatus.SUCCESS,
        userId: options.userId || null,
        entity: options.entity || null,
        entityId: options.entityId || null,
        details: serializedDetails,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      },
    });
  } catch (error) {
    console.error("[AuditLog Error] Failed to write audit record:", error);
  }
}
