import { verifyAdminLayoutAccessAction } from "@/actions/admin/admin-auth.action";
import { ClinicChatView } from "@/components/chat/clinic-chat-view";
import { Role } from "@/generated/prisma/enums";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Clinic Chat | Admin Portal | HPC",
  description: "Real-time clinic messaging system across all staff and doctors.",
};

export default async function AdminChatPage() {
  const { user } = await verifyAdminLayoutAccessAction();

  return (
    <div className="w-full">
      <ClinicChatView
        currentUserRole={Role.ADMIN}
        currentUserId={user.id}
      />
    </div>
  );
}
