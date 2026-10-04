"use server";

import { requireAuth } from "@/lib/guard";
import { Role } from "@/generated/prisma/enums";
import type { Session, User } from "@/generated/prisma/client";

export interface AdminAuthResult {
  session: Session;
  user: User;
}

/**
 * Verifies that the current request has an active, authenticated Administrator session.
 * Used exclusively by Admin layouts and root server components.
 */
export async function verifyAdminLayoutAccessAction(): Promise<AdminAuthResult> {
  const { session, user } = await requireAuth(Role.ADMIN);
  return { session, user };
}
