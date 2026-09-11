"use server";

import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/guard";
import { Role } from "@/generated/prisma/enums";
import type { Session, User } from "@/generated/prisma/client";

export interface RecentAuditLogItem {
  id: string;
  action: string;
  status: string;
  createdAt: Date;
  ipAddress: string | null;
  userRole: string | null;
  performerName: string | null;
  performerPhone: string | null;
}

export interface AdminDashboardData {
  session: Session;
  user: User;
  counts: {
    userCount: number;
    activeSessionCount: number;
    auditLogCount: number;
    performerCount: number;
    roomCount: number;
    slotCount: number;
  };
  recentLogs: RecentAuditLogItem[];
}

/**
 * Fetches all telemetry, metric counts, and recent audit activity for the Admin Dashboard.
 * Strictly restricted to authenticated Administrators.
 */
export async function getAdminDashboardDataAction(): Promise<AdminDashboardData> {
  const { session, user } = await requireAuth(Role.ADMIN);

  let userCount = 0;
  let activeSessionCount = 1;
  let auditLogCount = 0;
  let performerCount = 0;
  let roomCount = 0;
  let slotCount = 0;
  let rawLogs: Array<{
    id: string;
    action: string;
    status: string;
    createdAt: Date;
    ipAddress: string | null;
    user: { role: string } | null;
    performer: { name: string; phone: string } | null;
  }> = [];

  try {
    const [uCount, sCount, aCount, pCount, rmCount, slCount, rLogs] =
      await Promise.all([
        prisma.user.count(),
        prisma.session.count({
          where: {
            expiresAt: { gt: new Date() },
            revokedAt: null,
          },
        }),
        prisma.auditLog.count(),
        prisma.performer.count(),
        prisma.room.count(),
        prisma.therapySlot.count(),
        prisma.auditLog.findMany({
          take: 5,
          orderBy: { createdAt: "desc" },
          include: {
            user: { select: { role: true } },
            performer: { select: { name: true, phone: true } },
          },
        }),
      ]);

    userCount = uCount;
    activeSessionCount = sCount;
    auditLogCount = aCount;
    performerCount = pCount;
    roomCount = rmCount;
    slotCount = slCount;
    rawLogs = rLogs;
  } catch (error) {
    console.error("[Dashboard Action Error] Failed to query telemetry:", error);
  }

  const recentLogs: RecentAuditLogItem[] = rawLogs.map((log) => ({
    id: log.id,
    action: log.action,
    status: log.status,
    createdAt: log.createdAt,
    ipAddress: log.ipAddress,
    userRole: log.user?.role || null,
    performerName: log.performer?.name || null,
    performerPhone: log.performer?.phone || null,
  }));

  return {
    session,
    user,
    counts: {
      userCount,
      activeSessionCount,
      auditLogCount,
      performerCount,
      roomCount,
      slotCount,
    },
    recentLogs,
  };
}
