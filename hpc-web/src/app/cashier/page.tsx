import { verifyPortalAccessAction } from "@/actions/portal/portal-auth.action";
import { getCashierDashboardDataAction } from "@/actions/cashier/cashier.action";
import { CashierDashboardView } from "@/components/cashier/cashier-dashboard-view";
import { Role } from "@/generated/prisma/enums";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cashier & Billing Desk | Health And Pain Care Center",
};

export default async function CashierPage() {
  const { user } = await verifyPortalAccessAction(Role.CASHIER);
  const data = await getCashierDashboardDataAction();

  return (
    <CashierDashboardView initialData={data} currentUserRole={user.role} />
  );
}
