import { requireAuth } from "@/lib/guard";
import { Role } from "@/generated/prisma/enums";
import { RolePortalView } from "@/components/role-portal-view";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pain Care Specialist Portal | Health And Pain Care Center",
};

export default async function DoctorPage() {
  const { session } = await requireAuth(Role.DOCTOR);
  return <RolePortalView role={Role.DOCTOR} session={session} />;
}
