import { requireAuth } from "@/lib/guard";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { ProfileForm } from "@/components/profile/profile-form";
import { Role } from "@/generated/prisma/enums";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Receptionist Profile | HPC",
  description: "Manage front desk receptionist profile settings",
};

export default async function ReceptionistProfilePage() {
  const session = await requireAuth([Role.RECEPTIONIST]);

  return (
    <DashboardLayout
      user={session.user}
      headerTitle="Receptionist Profile"
      badgeText="Front Desk Staff"
    >
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">
            Receptionist Account &amp; Security
          </h2>
          <p className="text-xs text-muted-foreground">
            Manage your personal profile and account credentials
          </p>
        </div>
        <ProfileForm user={session.user} />
      </div>
    </DashboardLayout>
  );
}
