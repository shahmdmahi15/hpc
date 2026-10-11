import { verifyAdminLayoutAccessAction } from "@/actions/admin/admin-auth.action";
import { getStaffPerformanceReportAction } from "@/actions/admin/performance.action";
import { StaffPerformanceView } from "@/components/admin/performance/staff-performance-view";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Staff & Performer Performance | Admin Portal | HPC",
  description:
    "Comprehensive staff and performer performance telemetry: doctor earnings, consultation durations, top prescribed medicines, front desk bookings, cashier collections, and handler bed utilization.",
};

export default async function AdminPerformancePage() {
  await verifyAdminLayoutAccessAction();
  const res = await getStaffPerformanceReportAction({ filter: "today" });

  if (!res.success || !res.data) {
    return (
      <div className="p-6 text-center text-sm text-destructive">
        Failed to load staff performance telemetry: {res.error || "Unknown error"}
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <StaffPerformanceView initialData={res.data} />
    </div>
  );
}
