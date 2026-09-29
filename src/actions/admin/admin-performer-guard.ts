import prisma from "@/lib/prisma";

export interface ResolvedAdminUser {
  user: { id: string; name: string | null; email: string | null; whatsapp: string | null } | null;
  error?: string;
}

/**
 * Resolves the authenticated Administrator user authorizing an administrative operation.
 * In the new system, Admins have direct user accounts with Name, Email, WhatsApp (no performers).
 */
export async function resolveActingAdminUser(
  adminUserId: string,
): Promise<ResolvedAdminUser> {
  const user = await prisma.user.findUnique({
    where: { id: adminUserId },
    select: { id: true, name: true, email: true, whatsapp: true },
  });

  if (!user) {
    return { user: null, error: "Administrator account not found." };
  }

  return { user };
}

export interface ResolvedAdminPerformer {
  performer: { id: string; name: string; phone: string } | null;
  error?: string;
}

/**
 * Backward compatibility stub for legacy calls expecting resolveActingAdminPerformer.
 */
export async function resolveActingAdminPerformer(
  _adminUserId: string,
  _providedPerformerId?: string | null,
): Promise<ResolvedAdminPerformer> {
  return { performer: null };
}

