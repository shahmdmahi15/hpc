import { verifyAdminLayoutAccessAction } from "@/actions/admin/admin-auth.action";
import { getLivePatientTrackingDataAction } from "@/actions/tracking/tracking.action";
import { PatientJourneyTrackerView } from "@/components/tracking/patient-journey-tracker-view";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Patient Journey Tracking | Admin Portal | HPC",
  description:
    "Live real-time multi-counter patient station tracking across HPC clinic.",
};

export default async function AdminPatientTrackingPage() {
  await verifyAdminLayoutAccessAction();
  const initialData = await getLivePatientTrackingDataAction();

  return (
    <div className="w-full space-y-3">
      <PatientJourneyTrackerView initialData={initialData} />
    </div>
  );
}
