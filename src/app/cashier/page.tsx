import { requireAuth } from "@/lib/guard";
import { Role } from "@/generated/prisma/enums";
import { RolePortalView } from "@/components/role-portal-view";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cashier & Accounts Portal | Health And Pain Care Center",
};

export default async function CashierPage() {
  const { session } = await requireAuth(Role.CASHIER);
  return <RolePortalView role={Role.CASHIER} session={session} />;
}
