import { requireAuth } from "@/lib/guard";
import { Role } from "@/generated/prisma/enums";
import { RolePortalView } from "@/components/role-portal-view";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Front Desk Reception Portal | Health And Pain Care Center",
};

export default async function ReceptionistPage() {
  const { session } = await requireAuth(Role.RECEPTIONIST);
  return <RolePortalView role={Role.RECEPTIONIST} session={session} />;
}
