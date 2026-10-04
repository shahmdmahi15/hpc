import { verifyPortalAccessAction } from "@/actions/portal/portal-auth.action";
import { Role } from "@/generated/prisma/enums";
import { getReceptionistDashboardDataAction } from "@/actions/receptionist/appointment.action";
import { ReceptionistDashboardView } from "@/components/receptionist/receptionist-dashboard-view";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Receptionist Desk & Ticket Booking | Health And Pain Care Center",
  description:
    "Offline real-time patient queue, ticket booking, and therapy slot management.",
};

export default async function ReceptionistPage() {
  const { user } = await verifyPortalAccessAction(Role.RECEPTIONIST);
  const initialData = await getReceptionistDashboardDataAction();

  return (
    <ReceptionistDashboardView
      initialData={initialData}
      currentUserRole={user.role}
    />
  );
}
