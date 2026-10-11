import { verifyAdminLayoutAccessAction } from "@/actions/admin/admin-auth.action";
import { getAdminMedicinesListAction } from "@/actions/admin/medicine.action";
import { MedicineManagementView } from "@/components/admin/medicines/medicine-management-view";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Medicine Directory | Admin Portal | HPC",
  description:
    "Comprehensive master directory of clinical medicines for doctor prescription validation, standard clinical dosage presets, and doctor performance analytics.",
};

export default async function AdminMedicinesPage() {
  await verifyAdminLayoutAccessAction();
  const res = await getAdminMedicinesListAction({ limit: 100 });

  return (
    <div className="w-full space-y-4">
      <MedicineManagementView
        initialMedicines={res.medicines || []}
        totalCount={res.totalCount || 0}
        activeCount={res.activeCount || 0}
        inactiveCount={res.inactiveCount || 0}
        initialPage={res.page || 1}
        initialTotalPages={res.totalPages || 1}
      />
    </div>
  );
}
