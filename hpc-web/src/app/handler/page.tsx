import { verifyPortalAccessAction } from "@/actions/portal/portal-auth.action";
import { Role } from "@/generated/prisma/enums";
import { getHandlerDashboardDataAction } from "@/actions/handler/handler.action";
import { HandlerDashboardView } from "@/components/handler/handler-dashboard-view";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Physical Therapy Desk | Health And Pain Care Center",
  description:
    "Real-time physical therapy queue, therapy slot booking, extra slots monitoring, and patient management.",
};

export default async function HandlerPage() {
  const { user } = await verifyPortalAccessAction(Role.HANDLER);
  const initialData = await getHandlerDashboardDataAction();

  return (
    <HandlerDashboardView
      initialData={initialData}
      currentUserRole={user.role}
    />
  );
}
