import { getClinicalOptionsAction } from "@/actions/admin/clinical.action";
import { ClinicalOptionsManagementView } from "@/components/admin/clinical/clinical-options-management-view";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Clinical Options & Treatments | Admin",
  description: "Configure dynamic pain areas, physical symptoms, and physiotherapy treatment plans.",
};

export default async function AdminClinicalPage() {
  const data = await getClinicalOptionsAction();

  return <ClinicalOptionsManagementView initialOptions={data.options || []} />;
}
