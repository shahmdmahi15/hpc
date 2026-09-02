import { requireAuth } from "@/lib/guard";
import { Role } from "@/generated/prisma/enums";
import { RolePortalView } from "@/components/role-portal-view";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Therapy & Care Handler Portal | Health And Pain Care Center",
};

export default async function HandlerPage() {
  const { session } = await requireAuth(Role.HANDLER);
  return <RolePortalView role={Role.HANDLER} session={session} />;
}
