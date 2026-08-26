import { requireAuth } from "@/lib/guard";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { ProfileForm } from "@/components/profile/profile-form";
import { Role } from "@/generated/prisma/enums";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Profile | HPC",
  description: "Manage administrator profile settings",
};

export default async function AdminProfilePage() {
  const session = await requireAuth([Role.ADMIN]);

  return (
    <DashboardLayout
      user={session.user}
      headerTitle="Administrator Profile"
      badgeText="Security Settings"
    >
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">
            Profile &amp; Credentials
          </h2>
          <p className="text-xs text-muted-foreground">
            Manage your administrative credentials and security settings for
            Health And Pain Care Center
          </p>
        </div>
        <ProfileForm user={session.user} />
      </div>
    </DashboardLayout>
  );
}
