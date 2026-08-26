import { requireAuth } from "@/lib/guard";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { ProfileForm } from "@/components/profile/profile-form";
import { Role } from "@/generated/prisma/enums";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Handler Profile | HPC",
  description: "Manage therapy and care handler profile settings",
};

export default async function HandlerProfilePage() {
  const session = await requireAuth([Role.HANDLER]);

  return (
    <DashboardLayout
      user={session.user}
      headerTitle="Handler Profile"
      badgeText="Care &amp; Therapy Staff"
    >
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">
            Handler Account &amp; Security
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
