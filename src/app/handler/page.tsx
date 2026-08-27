import { requireAuth } from "@/lib/guard";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { HandlerWorkspace } from "@/components/handler/handler-workspace";
import { getHandlerQueue } from "@/actions/serials";
import { Role } from "@/generated/prisma/enums";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Care Handler Panel | Health And Pain Care Center",
  description:
    "Rehabilitation logistics, therapy timing logs, SD/In/T/Out time tracking, and modality execution",
};

export default async function HandlerDashboardPage() {
  const session = await requireAuth([Role.HANDLER, Role.ADMIN]);
  const initialQueue = await getHandlerQueue();

  return (
    <DashboardLayout
      user={session.user}
      headerTitle="Therapy &amp; Care Handler Hub"
      badgeText="Rehabilitation &amp; Logistics"
    >
      <HandlerWorkspace
        initialQueue={initialQueue}
        handlerId={session.user.id}
      />
    </DashboardLayout>
  );
}
