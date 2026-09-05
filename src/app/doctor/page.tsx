import { verifyPortalAccessAction } from "@/actions/portal/portal-auth.action";
import { Role } from "@/generated/prisma/enums";
import { RolePortalView } from "@/components/role-portal-view";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Doctor Portal | Health And Pain Care Center",
};

export default async function DoctorPage() {
  const { session } = await verifyPortalAccessAction(Role.DOCTOR);
  return <RolePortalView role={Role.DOCTOR} session={session} />;
}
