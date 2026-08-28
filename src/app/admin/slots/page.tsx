import { requireAuth } from "@/lib/guard";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { SlotManagementPanel } from "@/components/admin/slot-management-panel";
import { getDynamicSlotAvailability } from "@/actions/slots";
import { Role } from "@/generated/prisma/enums";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Serial Booking Slots & Capacity Management | Admin Panel",
  description:
    "Dynamically configure clinic time slots, hourly max patient capacity, and ticket meters",
};

export default async function AdminSlotsPage() {
  const session = await requireAuth([Role.ADMIN]);
  const initialAvailability = await getDynamicSlotAvailability();

  return (
    <DashboardLayout
      user={session.user}
      headerTitle="Booking Slots & Serial Management"
      badgeText="Dynamic Slots &amp; Capacity"
    >
      <div className="space-y-6">
        <SlotManagementPanel initialAvailability={initialAvailability} />
      </div>
    </DashboardLayout>
  );
}
