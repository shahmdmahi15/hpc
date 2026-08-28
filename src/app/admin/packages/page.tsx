import { requireAuth } from "@/lib/guard";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { AdminPackagesView } from "@/components/admin/admin-packages-view";
import { getAllPackages } from "@/actions/billing";
import { Role } from "@/generated/prisma/enums";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "21–30 Days Rehabilitation Packages | Admin Panel",
  description:
    "Manage long-term therapy packages, advance payments, and installment records",
};

export default async function AdminPackagesPage() {
  const session = await requireAuth([Role.ADMIN]);
  const initialPackages = await getAllPackages();

  return (
    <DashboardLayout
      user={session.user}
      headerTitle="21–30 Days Package Management"
      badgeText="Rehab Packages &amp; Installments"
    >
      <div className="space-y-6">
        <AdminPackagesView initialPackages={initialPackages} />
      </div>
    </DashboardLayout>
  );
}
