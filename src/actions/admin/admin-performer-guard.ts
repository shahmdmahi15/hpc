import prisma from "@/lib/prisma";

export interface ResolvedAdminPerformer {
  performer: { id: string; name: string; phone: string } | null;
  error?: string;
}

/**
 * Resolves and validates the acting administrator performer for any administrative operation.
 * Rules:
 * 1. If 0 staff profiles exist under ADMIN: allows system fallback (performer: null) so initial setup is possible.
 * 2. If exactly 1 staff profile exists: auto-resolves to that staff member.
 * 3. If multiple staff profiles exist: strictly requires `providedPerformerId` matching one of the admin performers.
 */
export async function resolveActingAdminPerformer(
  adminUserId: string,
  providedPerformerId?: string | null,
): Promise<ResolvedAdminPerformer> {
  const adminPerformers = await prisma.performer.findMany({
    where: { userId: adminUserId },
    select: { id: true, name: true, phone: true },
  });

  if (adminPerformers.length === 0) {
    return { performer: null };
  }

  if (adminPerformers.length === 1) {
    if (providedPerformerId && providedPerformerId !== adminPerformers[0].id) {
      return {
        performer: null,
        error: "Specified administrator performer was not recognized.",
      };
    }
    return { performer: adminPerformers[0] };
  }

  // Multiple admin staff exist: selection is strictly mandatory
  if (!providedPerformerId) {
    return {
      performer: null,
      error:
        "Multiple administrator staff exist. You must select the acting administrator authorizing this action.",
    };
  }

  const matched = adminPerformers.find((p) => p.id === providedPerformerId);
  if (!matched) {
    return {
      performer: null,
      error:
        "The selected performer does not belong to the Administrator desk.",
    };
  }

  return { performer: matched };
}
