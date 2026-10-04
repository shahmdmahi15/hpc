import { getAdminRoomsPageDataAction } from "@/actions/admin/room.action";
import { RoomManagementView } from "@/components/admin/rooms/room-management-view";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Room & Station Management | HPC Admin",
  description:
    "Manage clinic rooms, consultation chambers, diagnostic labs, and operational facilities.",
};

export default async function AdminRoomsPage() {
  const data = await getAdminRoomsPageDataAction();
  return <RoomManagementView initialData={data} />;
}
