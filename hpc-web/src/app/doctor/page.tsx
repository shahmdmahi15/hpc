import { verifyPortalAccessAction } from "@/actions/portal/portal-auth.action";
import { Role } from "@/generated/prisma/enums";
import { getDoctorDashboardDataAction } from "@/actions/doctor/doctor.action";
import { DoctorDashboardView } from "@/components/doctor/doctor-dashboard-view";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Doctor Consultation Desk | Health And Pain Care Center",
  description:
    "Doctor Consultation Queue, Chamber Callouts, and Patient Care Desk.",
};

export default async function DoctorPage() {
  const { user } = await verifyPortalAccessAction(Role.DOCTOR);
  const initialData = await getDoctorDashboardDataAction();

  return (
    <DoctorDashboardView
      initialData={initialData}
      currentUserRole={user.role}
    />
  );
}
