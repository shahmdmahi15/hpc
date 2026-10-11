import { verifyAdminLayoutAccessAction } from "@/actions/admin/admin-auth.action";
import { getAdminPatientsListAction } from "@/actions/admin/patient-history.action";
import { PatientDirectoryView } from "@/components/admin/patients/patient-directory-view";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Patients & Clinical History Hub | Admin Portal | HPC",
  description:
    "Comprehensive patient directory, whole medical history dossiers, clinical records, journey tracking, and export/print hub for HPC.",
};

export default async function AdminPatientsPage() {
  await verifyAdminLayoutAccessAction();
  const initialData = await getAdminPatientsListAction({
    filter: "ALL",
    sortBy: "recent",
    limit: 100,
  });

  return (
    <div className="w-full space-y-4">
      <PatientDirectoryView initialData={initialData} />
    </div>
  );
}
