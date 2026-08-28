import { requireAuth } from "@/lib/guard";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { AdminLedgerView } from "@/components/admin/admin-ledger-view";
import { getDailyCashLedger } from "@/actions/billing";
import { Role } from "@/generated/prisma/enums";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "CEO Daily Cash Ledger & Audit | Admin Panel",
  description:
    "Executive daily cashier ledger audit, N.P entries, and cash collections",
};

export default async function AdminLedgerPage() {
  const session = await requireAuth([Role.ADMIN]);
  const initialLedger = await getDailyCashLedger();

  return (
    <DashboardLayout
      user={session.user}
      headerTitle="CEO Daily Cash Ledger & Audit"
      badgeText="Executive Cash Audit"
    >
      <div className="space-y-6">
        <AdminLedgerView initialLedger={initialLedger} />
      </div>
    </DashboardLayout>
  );
}
