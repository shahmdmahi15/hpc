import { requireAuth } from "@/lib/guard";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import {
  AuditLogTable,
  type AuditLogItem,
} from "@/components/admin/audit-log-table";
import prisma from "@/lib/prisma";
import { Role } from "@/generated/prisma/enums";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Audit & Security Logs | HPC Administrator",
  description:
    "Review immutable system audit logs, authentication events, staff account changes, and security telemetry.",
};

export default async function AdminLogsPage() {
  const session = await requireAuth([Role.ADMIN]);

  const rawLogs = await prisma.auditLog.findMany({
    take: 200,
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
    },
  });

  const logs: AuditLogItem[] = rawLogs.map((log) => ({
    id: log.id,
    action: log.action,
    status: log.status,
    userId: log.userId,
    userName: log.user?.name || null,
    userRole: log.user?.role || null,
    entity: log.entity,
    entityId: log.entityId,
    details: log.details,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
    createdAt: log.createdAt.toISOString(),
  }));

  return (
    <DashboardLayout
      user={session.user}
      headerTitle="Audit Trail & Security Logs"
      badgeText="Superuser Operations"
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            System Audit & Security Logs
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Real-time immutable audit trail capturing authentication events,
            profile updates, staff provisioning, session revocations, and
            security anomalies.
          </p>
        </div>

        <AuditLogTable initialLogs={logs} />
      </div>
    </DashboardLayout>
  );
}
