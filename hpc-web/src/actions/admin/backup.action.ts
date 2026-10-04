"use server";

import { requireAuth } from "@/lib/guard";
import { Role } from "@/generated/prisma/enums";
import { createDatabaseSnapshot, type DatabaseBackupResult } from "@/lib/backup";
import { logAudit } from "@/lib/audit";
import { AuditAction, AuditStatus } from "@/generated/prisma/enums";

export async function triggerDatabaseSnapshotAction(
  pushToGit: boolean = false,
): Promise<DatabaseBackupResult> {
  const sessionData = await requireAuth([Role.ADMIN]);

  const result = await createDatabaseSnapshot({ pushToGit });

  await logAudit({
    action: AuditAction.USER_UPDATE,
    status: result.success ? AuditStatus.SUCCESS : AuditStatus.FAILURE,
    userId: sessionData.session.userId,
    entity: "DATABASE_BACKUP",
    details: `Database snapshot triggered via Admin Portal (pushToGit: ${pushToGit}). Result: ${result.message}`,
  });

  return result;
}
