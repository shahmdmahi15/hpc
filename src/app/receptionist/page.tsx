import { requireAuth } from "@/lib/guard";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { ReceptionistWorkspace } from "@/components/receptionist/receptionist-workspace";
import { getDailySerials } from "@/actions/serials";
import { getDailyCashLedger } from "@/actions/billing";
import { Role } from "@/generated/prisma/enums";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Receptionist Panel | Health And Pain Care Center",
  description:
    "Front desk intake, master daily serial register, and daily cash collection ledger",
};

export default async function ReceptionistDashboardPage() {
  const session = await requireAuth([Role.RECEPTIONIST, Role.ADMIN]);

  const [initialSerials, initialLedger] = await Promise.all([
    getDailySerials(),
    getDailyCashLedger(),
  ]);

  return (
    <DashboardLayout
      user={session.user}
      headerTitle="Front Desk &amp; Reception"
      badgeText="Patient Intake &amp; Queue Hub"
    >
      <ReceptionistWorkspace
        initialSerials={initialSerials}
        initialLedger={initialLedger}
      />
    </DashboardLayout>
  );
}
