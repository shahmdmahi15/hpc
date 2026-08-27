import { requireAuth } from "@/lib/guard";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { DoctorWorkspace } from "@/components/doctor/doctor-workspace";
import { getDoctorQueue } from "@/actions/serials";
import { Role } from "@/generated/prisma/enums";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Doctor Clinical Panel | Health And Pain Care Center",
  description:
    "Pain management specialist workspace, live queue, VAS scoring, and clinical assessment",
};

export default async function DoctorDashboardPage() {
  const session = await requireAuth([Role.DOCTOR, Role.ADMIN]);
  const initialQueue = await getDoctorQueue(
    session.user.role === Role.DOCTOR ? session.user.id : undefined,
  );

  return (
    <DashboardLayout
      user={session.user}
      headerTitle="Doctor Clinical Workspace"
      badgeText="Pain Care Department"
    >
      <DoctorWorkspace initialQueue={initialQueue} doctorId={session.user.id} />
    </DashboardLayout>
  );
}
