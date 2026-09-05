import { getAdminUsersPageDataAction } from "@/actions/admin/user.action";
import { UserManagementView } from "@/components/admin/users/user-management-view";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Users & Staff Management | HPC Administrator",
  description:
    "Manage unique station role accounts, staff performers, reset passwords, and revoke active sessions.",
};

export default async function AdminUsersPage() {
  const formattedUsers = await getAdminUsersPageDataAction();
  return <UserManagementView users={formattedUsers} />;
}
