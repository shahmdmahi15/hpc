import { requireAuth } from "@/lib/guard";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import {
  UserManagementClient,
  type StaffUserItem,
} from "@/components/admin/user-management-client";
import prisma from "@/lib/prisma";
import { Role } from "@/generated/prisma/enums";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Staff & Role Management | HPC Administrator",
  description:
    "Manage staff accounts, assign roles, reset passwords, and control access permissions.",
};

export default async function AdminUsersPage() {
  const session = await requireAuth([Role.ADMIN]);

  const rawUsers = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      role: true,
      createdAt: true,
      _count: {
        select: {
          sessions: {
            where: {
              expiresAt: { gt: new Date() },
              revokedAt: null,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const users: StaffUserItem[] = rawUsers.map((u) => ({
    id: u.id,
    name: u.name,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
    activeSessionsCount: u._count.sessions,
  }));

  return (
    <DashboardLayout
      user={session.user}
      headerTitle="Staff Directory & Role Control"
      badgeText="Superuser Operations"
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            User & Role Access Management
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Provision staff accounts, manage role permissions, reset
            credentials, and monitor active sessions across all 4 clinic
            departments.
          </p>
        </div>

        <UserManagementClient
          initialUsers={users}
          currentUserId={session.user.id}
        />
      </div>
    </DashboardLayout>
  );
}
