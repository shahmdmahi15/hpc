import "server-only";
import { getCurrentSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getRoleDashboard } from "@/proxy";
import { Role } from "@/generated/prisma/enums";

export async function requireAuth(allowedRoles?: Role | Role[]) {
  const sessionData = await getCurrentSession();

  if (!sessionData) {
    redirect("/login");
  }

  const userRole = sessionData.user.role;

  if (allowedRoles) {
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    const hasPermission = userRole === Role.ADMIN || roles.includes(userRole);
    if (!hasPermission) {
      redirect(getRoleDashboard(userRole));
    }
  }

  return sessionData;
}
