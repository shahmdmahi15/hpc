import { requireAuth } from "@/lib/guard";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { ProfileForm } from "@/components/profile/profile-form";
import { Role } from "@/generated/prisma/enums";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Doctor Profile | HPC",
  description: "Manage clinical doctor profile settings",
};

export default async function DoctorProfilePage() {
  const session = await requireAuth([Role.DOCTOR]);

  return (
    <DashboardLayout
      user={session.user}
      headerTitle="Doctor Profile"
      badgeText="Clinical Specialist"
    >
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">
            Doctor Account &amp; Credentials
          </h2>
          <p className="text-xs text-muted-foreground">
            Manage your personal clinical profile and authentication password
          </p>
        </div>
        <ProfileForm user={session.user} />
      </div>
    </DashboardLayout>
  );
}
