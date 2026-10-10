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
    patientCount: number;
    todayAppointmentsCount: number;
    todayConsultationCount: number;
    todayTherapyCount: number;
    todayCollected: number;
    todayDue: number;
    totalLifetimeRevenue: number;
    todayCash?: number;
    todayCard?: number;
    todayMfs?: number;
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
  let patientCount = 0;
  let todayAppointmentsCount = 0;
  let todayConsultationCount = 0;
  let todayTherapyCount = 0;
  let todayCollected = 0;
  let todayDue = 0;
  let totalLifetimeRevenue = 0;
  let todayCash = 0;
  let todayCard = 0;
  let todayMfs = 0;

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

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
    const [
      uCount,
      sCount,
      aCount,
      pCount,
      rmCount,
      slCount,
      ptCount,
      todayApts,
      todaySerials,
      todayPrevDuePayments,
      rLogs,
      allPatients,
    ] = await Promise.all([
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
      prisma.patient.count(),
      prisma.appointment.findMany({
        where: {
          appointmentDate: { gte: startOfDay, lte: endOfDay },
          status: { not: "CANCELLED" },
        },
        select: {
          type: true,
          feeAmount: true,
          paidAmount: true,
          dueAmount: true,
          paymentStatus: true,
          paymentMethod: true,
        },
      }),
      prisma.consultationSerial.findMany({
        where: {
          appointmentDate: { gte: startOfDay, lte: endOfDay },
          status: { not: "CANCELLED" },
        },
        select: {
          feeAmount: true,
          paidAmount: true,
          dueAmount: true,
          paymentStatus: true,
          invoice: {
            select: {
              paymentMethod: true,
            },
          },
        },
      }),
      prisma.patientPayment.findMany({
        where: {
          createdAt: { gte: startOfDay, lte: endOfDay },
          serviceType: "PREVIOUS_DUE",
          isDue: false,
        },
        select: {
          amount: true,
          paymentMethod: true,
        },
      }),
      prisma.auditLog.findMany({
        take: 8,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { role: true } },
          performer: { select: { name: true, phone: true } },
        },
      }),
      prisma.patient.aggregate({
        _sum: {
          totalPaid: true,
        },
      }),
    ]);

    userCount = uCount;
    activeSessionCount = sCount;
    auditLogCount = aCount;
    performerCount = pCount;
    roomCount = rmCount;
    slotCount = slCount;
    patientCount = ptCount;
    rawLogs = rLogs;
    totalLifetimeRevenue = allPatients._sum.totalPaid || 0;

    for (const apt of todayApts) {
      if (apt.type === "CONSULTATION") todayConsultationCount++;
      else todayTherapyCount++;

      const fee = apt.feeAmount ?? 0;
      const isPaid = apt.paymentStatus === "PAID";
      const paid = isPaid
        ? apt.paidAmount && apt.paidAmount > 0
          ? apt.paidAmount
          : fee
        : (apt.paidAmount ?? 0);
      const due = isPaid
        ? 0
        : apt.dueAmount !== null && apt.dueAmount !== undefined
          ? apt.dueAmount
          : Math.max(0, fee - paid);

      todayCollected += paid;
      todayDue += due;

      if (apt.paymentMethod === "CARD") todayCard += paid;
      else if (apt.paymentMethod === "MFS") todayMfs += paid;
      else if (paid > 0) todayCash += paid;
    }

    // Include Doctor Consultation Serials (fees/payments stored on ConsultationSerial)
    todayConsultationCount = Math.max(todayConsultationCount, todaySerials.length);
    todayAppointmentsCount = todayConsultationCount + todayTherapyCount;

    for (const s of todaySerials) {
      const fee = s.feeAmount ?? 0;
      const paid = s.paidAmount ?? 0;
      const due =
        s.dueAmount !== null && s.dueAmount !== undefined
          ? s.dueAmount
          : s.paymentStatus === "DUE"
            ? fee
            : Math.max(0, fee - paid);

      todayCollected += paid;
      todayDue += due;

      const method = s.invoice?.paymentMethod || "CASH";
      if (method === "CARD") todayCard += paid;
      else if (method === "MFS") todayMfs += paid;
      else if (paid > 0) todayCash += paid;
    }

    // Include any previous due balances cleared today
    for (const p of todayPrevDuePayments) {
      const paid = p.amount ?? 0;
      todayCollected += paid;
      if (p.paymentMethod === "CARD") todayCard += paid;
      else if (p.paymentMethod === "MFS") todayMfs += paid;
      else if (paid > 0) todayCash += paid;
    }
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
      patientCount,
      todayAppointmentsCount,
      todayConsultationCount,
      todayTherapyCount,
      todayCollected,
      todayDue,
      totalLifetimeRevenue,
      todayCash,
      todayCard,
      todayMfs,
    },
    recentLogs,
  };
}
