"use server";

import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/guard";
import {
  Role,
  AuditAction,
  AuditStatus,
  type Prisma,
} from "@/generated/prisma/client";

export interface AuditLogFilterParams {
  search?: string;
  action?: AuditAction;
  status?: AuditStatus;
  role?: Role;
  performerId?: string;
  dateRange?: "today" | "24h" | "7d" | "30d" | "all";
  page?: number;
  pageSize?: number;
}

export interface EnrichedAuditLog {
  id: string;
  action: AuditAction;
  status: AuditStatus;
  userId: string | null;
  userRole: Role | null;
  performerId: string | null;
  performerName: string | null;
  performerPhone: string | null;
  entity: string | null;
  entityId: string | null;
  details: string | null;
  parsedDetails: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface AuditLogsResult {
  success: boolean;
  logs: EnrichedAuditLog[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  metrics: {
    totalEvents: number;
    successCount: number;
    failureCount: number;
    todayCount: number;
  };
  error?: string;
}

function computeDateFilter(range?: string): Date | undefined {
  if (!range || range === "all") return undefined;

  const now = new Date();
  switch (range) {
    case "today": {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return start;
    }
    case "24h":
      return new Date(Date.now() - 24 * 60 * 60 * 1000);
    case "7d":
      return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    case "30d":
      return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    default:
      return undefined;
  }
}

/**
 * Fetches filtered and paginated audit logs with actor and desk attribution.
 * Strictly restricted to authenticated Administrators.
 */
export async function getAuditLogsAction(
  params: AuditLogFilterParams = {},
): Promise<AuditLogsResult> {
  // Security Guard: Admin only
  await requireAuth(Role.ADMIN);

  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(10, params.pageSize || 25));
  const skip = (page - 1) * pageSize;

  try {
    // Construct Prisma where clause
    const where: Prisma.AuditLogWhereInput = {};

    if (params.action) {
      where.action = params.action;
    }

    if (params.status) {
      where.status = params.status;
    }

    if (params.role) {
      where.user = { role: params.role };
    }

    if (params.performerId) {
      where.performerId = params.performerId;
    }

    const startDate = computeDateFilter(params.dateRange);
    if (startDate) {
      where.createdAt = { gte: startDate };
    }

    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      where.OR = [
        { details: { contains: q } },
        { entityId: { contains: q } },
        { entity: { contains: q } },
        { ipAddress: { contains: q } },
        { userAgent: { contains: q } },
        { performer: { name: { contains: q } } },
        { performer: { phone: { contains: q } } },
      ];
    }

    // Run queries concurrently
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      logs,
      totalCount,
      totalEvents,
      successCount,
      failureCount,
      todayCount,
    ] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, role: true } },
          performer: { select: { id: true, name: true, phone: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
      prisma.auditLog.count(),
      prisma.auditLog.count({ where: { status: AuditStatus.SUCCESS } }),
      prisma.auditLog.count({ where: { status: AuditStatus.FAILURE } }),
      prisma.auditLog.count({ where: { createdAt: { gte: todayStart } } }),
    ]);

    const enrichedLogs: EnrichedAuditLog[] = logs.map((log) => {
      let parsedDetails: Record<string, unknown> | null = null;
      if (log.details) {
        try {
          parsedDetails = JSON.parse(log.details);
        } catch {
          parsedDetails = { raw: log.details };
        }
      }

      return {
        id: log.id,
        action: log.action,
        status: log.status,
        userId: log.userId,
        userRole: log.user?.role || null,
        performerId: log.performerId,
        performerName: log.performer?.name || null,
        performerPhone: log.performer?.phone || null,
        entity: log.entity,
        entityId: log.entityId,
        details: log.details,
        parsedDetails,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        createdAt: log.createdAt,
      };
    });

    return {
      success: true,
      logs: enrichedLogs,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize) || 1,
      currentPage: page,
      metrics: {
        totalEvents,
        successCount,
        failureCount,
        todayCount,
      },
    };
  } catch (error) {
    console.error("[Audit Action Error] Failed to retrieve logs:", error);
    return {
      success: false,
      logs: [],
      totalCount: 0,
      totalPages: 1,
      currentPage: 1,
      metrics: {
        totalEvents: 0,
        successCount: 0,
        failureCount: 0,
        todayCount: 0,
      },
      error: "Failed to retrieve audit log records.",
    };
  }
}

/**
 * Exports filtered audit logs as either CSV or formatted JSON.
 */
export async function exportAuditLogsAction(
  params: AuditLogFilterParams,
  format: "csv" | "json" = "csv",
): Promise<{
  success: boolean;
  data?: string;
  filename?: string;
  error?: string;
}> {
  await requireAuth(Role.ADMIN);

  try {
    const where: Prisma.AuditLogWhereInput = {};
    if (params.action) where.action = params.action;
    if (params.status) where.status = params.status;
    if (params.role) where.user = { role: params.role };
    if (params.performerId) where.performerId = params.performerId;

    const startDate = computeDateFilter(params.dateRange);
    if (startDate) where.createdAt = { gte: startDate };

    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      where.OR = [
        { details: { contains: q } },
        { entityId: { contains: q } },
        { entity: { contains: q } },
        { ipAddress: { contains: q } },
        { performer: { name: { contains: q } } },
      ];
    }

    // Limit export to max 2,000 recent matching rows for performance
    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { role: true } },
        performer: { select: { name: true, phone: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 2000,
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    if (format === "json") {
      return {
        success: true,
        data: JSON.stringify(logs, null, 2),
        filename: `hpc-audit-logs-${timestamp}.json`,
      };
    }

    // CSV format
    const headers = [
      "ID",
      "Timestamp (UTC)",
      "Action",
      "Status",
      "Desk Role",
      "Acting Performer Name",
      "Acting Performer Phone",
      "Entity",
      "Entity ID",
      "IP Address",
      "Details",
    ];

    const rows = logs.map((l) => [
      l.id,
      l.createdAt.toISOString(),
      l.action,
      l.status,
      l.user?.role || "SYSTEM",
      `"${(l.performer?.name || "").replace(/"/g, '""')}"`,
      l.performer?.phone || "",
      l.entity || "",
      l.entityId || "",
      l.ipAddress || "",
      `"${(l.details || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((r) => r.join(",")),
    ].join("\n");

    return {
      success: true,
      data: csvContent,
      filename: `hpc-audit-logs-${timestamp}.csv`,
    };
  } catch (error) {
    console.error("[Audit Export Error]:", error);
    return {
      success: false,
      error: "Failed to generate audit export file.",
    };
  }
}

export interface AdminAuditPageData {
  initialResult: AuditLogsResult;
  performers: { id: string; name: string; phone: string }[];
}

/**
 * Fetches initial audit data and performer registry for the Audit Log Page.
 * Strictly restricted to authenticated Administrators.
 */
export async function getAdminAuditPageDataAction(): Promise<AdminAuditPageData> {
  await requireAuth(Role.ADMIN);

  const [initialResult, performers] = await Promise.all([
    getAuditLogsAction({ page: 1, pageSize: 25, dateRange: "all" }),
    prisma.performer.findMany({
      select: { id: true, name: true, phone: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return { initialResult, performers };
}
