import { verifyAdminLayoutAccessAction } from "@/actions/admin/admin-auth.action";
import { getBulletinNoticesAction } from "@/actions/admin/bulletin-notice.action";
import { BulletinNoticesView } from "@/components/admin/notices/bulletin-notices-view";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bulletin & Notice Board | Admin Portal | HPC",
  description:
    "Manage real-time announcements, ticker banners, and waiting room notices across clinic displays and staff stations.",
};

export default async function AdminNoticesPage() {
  await verifyAdminLayoutAccessAction();
  const res = await getBulletinNoticesAction();

  return (
    <div className="w-full space-y-4">
      <BulletinNoticesView initialNotices={res.data || []} />
    </div>
  );
}
