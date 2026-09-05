"use server";

import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/guard";
import { Role, AuditAction, AuditStatus } from "@/generated/prisma/enums";
import {
  resetPasswordSchema,
  type UserActionState,
} from "@/schemas/admin/user.schema";
import { hashPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { resolveActingAdminPerformer } from "@/actions/admin/admin-performer-guard";

/**
 * Resets the password for a designated role user account.
 * Accessible only to verified Administrator sessions.
 * Enforces mandatory admin performer selection if multiple admin staff exist.
 */
export async function resetUserPasswordAction(
  prevState: UserActionState | undefined,
  formData: FormData,
): Promise<UserActionState> {
  // 1. Strict Administrator Authentication Guard
  const { user: adminUser } = await requireAuth(Role.ADMIN);

  // 2. Form Data Extraction & Schema Validation
  const rawData = {
    userId: formData.get("userId")?.toString() || "",
    performerId: formData.get("performerId")?.toString() || undefined,
    newPassword: formData.get("newPassword")?.toString() || "",
    confirmPassword: formData.get("confirmPassword")?.toString() || "",
    revokeSessions:
      formData.get("revokeSessions") === "true" ||
      formData.get("revokeSessions") === "on",
  };

  const validation = resetPasswordSchema.safeParse(rawData);

  if (!validation.success) {
    return {
      success: false,
      message: "Please fix the validation errors below.",
      fieldErrors: validation.error.flatten().fieldErrors,
    };
  }

  const { userId, performerId, newPassword, revokeSessions } = validation.data;

  // 3. Resolve & Verify Acting Admin Performer
  const adminPerformerRes = await resolveActingAdminPerformer(
    adminUser.id,
    performerId,
  );
  if (adminPerformerRes.error) {
    return {
      success: false,
      message: adminPerformerRes.error,
      fieldErrors: {
        performerId: [adminPerformerRes.error],
      },
    };
  }
  const actingAdmin = adminPerformerRes.performer;

  try {
    // 4. Locate Target User Account
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return {
        success: false,
        message: "The specified user account does not exist in the database.",
      };
    }

    // 5. Memory-Hard Argon2id Hash Generation
    const hashedPassword = await hashPassword(newPassword);

    // 6. Update Password in Database
    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
      },
    });

    // 7. Optionally Revoke All Active Sessions (Zero-Trust)
    let revokedCount = 0;
    if (revokeSessions) {
      const revokeResult = await prisma.session.updateMany({
        where: {
          userId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
      revokedCount = revokeResult.count;
    }

    // 8. Record Immutable Audit Log with Performer Attribution
    await logAudit({
      action: AuditAction.USER_PASSWORD_RESET,
      status: AuditStatus.SUCCESS,
      userId: adminUser.id,
      performerId: actingAdmin?.id || null,
      entity: "User",
      entityId: targetUser.id,
      details: {
        targetRole: targetUser.role,
        sessionsRevoked: revokedCount,
        resetByAdmin: true,
        performedBy: actingAdmin
          ? {
              id: actingAdmin.id,
              name: actingAdmin.name,
              phone: actingAdmin.phone,
            }
          : { rootAdmin: true },
      },
    });

    // 9. Revalidate Relevant App Paths
    revalidatePath("/admin/users");
    revalidatePath("/admin/audit");
    revalidatePath("/admin");

    return {
      success: true,
      message: `Password for ${targetUser.role} account was reset successfully by ${
        actingAdmin ? actingAdmin.name : "Administrator"
      }. ${
        revokeSessions
          ? `(${revokedCount} active session${revokedCount === 1 ? "" : "s"} terminated)`
          : ""
      }`,
    };
  } catch (error) {
    console.error("[User Action Error] Failed to reset user password:", error);

    await logAudit({
      action: AuditAction.USER_PASSWORD_RESET,
      status: AuditStatus.FAILURE,
      userId: adminUser.id,
      performerId: actingAdmin?.id || null,
      entity: "User",
      entityId: userId,
      details: {
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });

    return {
      success: false,
      message:
        "An unexpected error occurred while resetting the password. Please try again.",
    };
  }
}

/**
 * Revokes all active sessions for a target user account.
 * Enforces mandatory admin performer selection if multiple admin staff exist.
 */
export async function revokeAllUserSessionsAction(
  userId: string,
  performerId?: string,
): Promise<UserActionState> {
  const { user: adminUser } = await requireAuth(Role.ADMIN);

  // Resolve & Verify Acting Admin Performer
  const adminPerformerRes = await resolveActingAdminPerformer(
    adminUser.id,
    performerId,
  );
  if (adminPerformerRes.error) {
    return {
      success: false,
      message: adminPerformerRes.error,
    };
  }
  const actingAdmin = adminPerformerRes.performer;

  try {
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return {
        success: false,
        message: "User account not found.",
      };
    }

    const result = await prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    await logAudit({
      action: AuditAction.USER_SESSIONS_REVOKED,
      status: AuditStatus.SUCCESS,
      userId: adminUser.id,
      performerId: actingAdmin?.id || null,
      entity: "User",
      entityId: targetUser.id,
      details: {
        targetRole: targetUser.role,
        revokedCount: result.count,
        performedBy: actingAdmin
          ? {
              id: actingAdmin.id,
              name: actingAdmin.name,
              phone: actingAdmin.phone,
            }
          : { rootAdmin: true },
      },
    });

    revalidatePath("/admin/users");
    revalidatePath("/admin/audit");
    revalidatePath("/admin");

    return {
      success: true,
      message: `Successfully terminated ${result.count} active session${result.count === 1 ? "" : "s"} for ${targetUser.role}.`,
    };
  } catch (error) {
    console.error("[User Action Error] Failed to revoke sessions:", error);
    return {
      success: false,
      message: "Failed to revoke sessions. Please try again.",
    };
  }
}

export interface FormattedUserAccountData {
  id: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
  activeSessionCount: number;
  totalSessionCount: number;
  lastAccessAt: Date | null;
  performers: { id: string; name: string; phone: string }[];
}

/**
 * Fetches and aggregates all user accounts, active sessions, and performers for User Management.
 * Strictly restricted to authenticated Administrators.
 */
export async function getAdminUsersPageDataAction(): Promise<
  FormattedUserAccountData[]
> {
  await requireAuth(Role.ADMIN);

  const users = await prisma.user.findMany({
    include: {
      performers: {
        select: {
          id: true,
          name: true,
          phone: true,
        },
        orderBy: {
          name: "asc",
        },
      },
      sessions: {
        where: {
          expiresAt: { gt: new Date() },
          revokedAt: null,
        },
        select: {
          id: true,
          lastAccessAt: true,
        },
      },
      _count: {
        select: {
          sessions: true,
        },
      },
    },
    orderBy: {
      role: "asc",
    },
  });

  const roleOrder: Record<Role, number> = {
    [Role.ADMIN]: 1,
    [Role.DOCTOR]: 2,
    [Role.RECEPTIONIST]: 3,
    [Role.HANDLER]: 4,
    [Role.CASHIER]: 5,
  };

  return users
    .map((u) => ({
      id: u.id,
      role: u.role,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      activeSessionCount: u.sessions.length,
      totalSessionCount: u._count.sessions,
      lastAccessAt: u.sessions[0]?.lastAccessAt || null,
      performers: u.performers,
    }))
    .sort((a, b) => (roleOrder[a.role] || 99) - (roleOrder[b.role] || 99));
}
