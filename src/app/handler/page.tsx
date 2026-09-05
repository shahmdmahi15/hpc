import { verifyPortalAccessAction } from "@/actions/portal/portal-auth.action";
import { Role } from "@/generated/prisma/enums";
import { RolePortalView } from "@/components/role-portal-view";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Handler Portal | Health And Pain Care Center",
};

export default async function HandlerPage() {
  const { session } = await verifyPortalAccessAction(Role.HANDLER);
  return <RolePortalView role={Role.HANDLER} session={session} />;
}
