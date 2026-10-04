"use server";

import { requireAuth } from "@/lib/guard";
import type { Role } from "@/generated/prisma/enums";
import type { Session, User } from "@/generated/prisma/client";

export interface PortalAuthResult {
  session: Session;
  user: User;
}

/**
 * Authenticates and authorizes access for a designated departmental desk portal.
 * Invoked by portal page components.
 */
export async function verifyPortalAccessAction(
  role: Role,
): Promise<PortalAuthResult> {
  const { session, user } = await requireAuth(role);
  return { session, user };
}
