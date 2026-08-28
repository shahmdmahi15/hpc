import { requireAuth } from "@/lib/guard";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { RoomManagementPanel } from "@/components/admin/room-management-panel";
import { getAdminRooms } from "@/actions/rooms";
import { Role } from "@/generated/prisma/enums";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Chambers & Rooms Management | Admin Panel",
  description:
    "Create and configure clinic rooms, beds, purpose, and staff permissions",
};

export default async function AdminRoomsPage() {
  const session = await requireAuth([Role.ADMIN]);
  const initialRooms = await getAdminRooms();

  return (
    <DashboardLayout
      user={session.user}
      headerTitle="Chambers & Rooms Management"
      badgeText="Chamber Operations"
    >
      <div className="space-y-6">
        <RoomManagementPanel initialRooms={initialRooms} />
      </div>
    </DashboardLayout>
  );
}
