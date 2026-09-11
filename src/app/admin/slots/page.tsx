import { getAdminTherapySlotsPageDataAction } from "@/actions/admin/slot.action";
import { SlotManagementView } from "@/components/admin/slots/slot-management-view";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Therapy Slot Management | HPC Admin",
  description:
    "Manage hourly therapy slots, quotas (3 Male, 3 Female), and emergency approvals (Doctor & Admin).",
};

export default async function AdminSlotsPage() {
  const data = await getAdminTherapySlotsPageDataAction();

  return <SlotManagementView initialData={data} />;
}
