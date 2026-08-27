import { requireAuth } from "@/lib/guard";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { AdminSessionsManager } from "@/components/admin/admin-sessions-manager";
import { Role } from "@/generated/prisma/enums";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Session Control & Security | HPC Administrator",
  description:
    "Monitor, inspect, and terminate active staff login sessions and connected devices across Health And Pain Care Center.",
};

export default async function AdminSessionsPage() {
  const session = await requireAuth([Role.ADMIN]);

  return (
    <DashboardLayout
      user={session.user}
      headerTitle="Session Control Center"
      badgeText="Superuser Access"
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Global Active Sessions Management
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Monitor real-time active login sessions across all clinic staff,
            inspect device &amp; IP telemetry, and terminate compromised or
            stale credentials.
          </p>
        </div>

        <AdminSessionsManager />
      </div>
    </DashboardLayout>
  );
}
