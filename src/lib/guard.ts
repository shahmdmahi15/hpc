import "server-only";
import { getCurrentSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getRoleDashboard } from "@/proxy";
import { Role } from "@/generated/prisma/enums";

export async function requireAuth(allowedRoles?: Role[]) {
  const sessionData = await getCurrentSession();

  if (!sessionData) {
    redirect("/login");
  }

  const userRole = sessionData.user.role;

  // If specific roles are specified and the user is neither in that list nor an ADMIN
  if (allowedRoles && allowedRoles.length > 0) {
    const hasPermission =
      userRole === Role.ADMIN || allowedRoles.includes(userRole);
    if (!hasPermission) {
      redirect(getRoleDashboard(userRole));
    }
  }

  return sessionData;
}
