"use server";

import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/guard";
import { Role, AuditAction, AuditStatus } from "@/generated/prisma/enums";
import {
  createAccountSchema,
  deleteUserAccountSchema,
  resetPasswordSchema,
  type UserActionState,
} from "@/schemas/admin/user.schema";
import { hashPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

/**
 * Creates a new independent Administrator or Doctor user account.
 * (Receptionist, Handler, and Cashier use shared desk accounts managed with performers).
 */
export async function createUserAccountAction(
  prevState: UserActionState | undefined,
  formData: FormData,
): Promise<UserActionState> {
  const { user: adminUser } = await requireAuth(Role.ADMIN);

  const rawData = {
    role: formData.get("role") as Role,
    name: formData.get("name")?.toString() || "",
    email: formData.get("email")?.toString() || "",
    whatsapp: formData.get("whatsapp")?.toString() || "",
    password: formData.get("password")?.toString() || "",
  };

  const validation = createAccountSchema.safeParse(rawData);
  if (!validation.success) {
    return {
      success: false,
      message: "Please fix the validation errors below.",
      fieldErrors: validation.error.flatten().fieldErrors,
    };
  }

  const { role, name, email, whatsapp, password } = validation.data;

  try {
    // Check if email already in use
    const existingEmail = await prisma.user.findFirst({
      where: { email },
    });
    if (existingEmail) {
      return {
        success: false,
        message: `An account with email "${email}" already exists.`,
        fieldErrors: {
          email: ["Email is already registered in the system."],
        },
      };
    }

    const hashedPassword = await hashPassword(password);

    const newUser = await prisma.user.create({
      data: {
        role,
        name,
        email,
        whatsapp,
        password: hashedPassword,
      },
    });

    await logAudit({
      action: AuditAction.USER_CREATE,
      status: AuditStatus.SUCCESS,
      userId: adminUser.id,
      entity: "User",
      entityId: newUser.id,
      details: {
        createdRole: role,
        name,
        email,
        whatsapp,
        performedBy: {
          id: adminUser.id,
          name: adminUser.name,
          email: adminUser.email,
        },
      },
    });

    revalidatePath("/admin/users");
    revalidatePath("/admin/audit");
    revalidatePath("/admin");

    return {
      success: true,
      message: `Successfully created ${role} account for ${name} (${email}).`,
    };
  } catch (error) {
    console.error("[User Action Error] Failed to create user account:", error);
    return {
      success: false,
      message: "An unexpected error occurred while creating the user account.",
    };
  }
}

/**
 * Deletes an independent Admin or Doctor user account.
 * (Shared desk accounts cannot be deleted to maintain system integrity).
 */
export async function deleteUserAccountAction(
  userId: string,
): Promise<UserActionState> {
  const { user: adminUser } = await requireAuth(Role.ADMIN);

  const validation = deleteUserAccountSchema.safeParse({ userId });
  if (!validation.success) {
    return {
      success: false,
      message: "Invalid user account identifier.",
    };
  }

  if (userId === adminUser.id) {
    return {
      success: false,
      message: "You cannot delete your own active administrator account.",
    };
  }

  try {
    const target = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!target) {
      return {
        success: false,
        message: "User account not found or already deleted.",
      };
    }

    if (
      target.role === Role.RECEPTIONIST ||
      target.role === Role.HANDLER ||
      target.role === Role.CASHIER
    ) {
      return {
        success: false,
        message: `The ${target.role} desk station account cannot be deleted. Manage individual desk staff performers instead.`,
      };
    }

    // If target is ADMIN, check that at least one other admin account remains
    if (target.role === Role.ADMIN) {
      const adminCount = await prisma.user.count({
        where: { role: Role.ADMIN },
      });
      if (adminCount <= 1) {
        return {
          success: false,
          message: "Cannot delete the last remaining Administrator account.",
        };
      }
    }

    await prisma.user.delete({
      where: { id: userId },
    });

    await logAudit({
      action: AuditAction.USER_DELETE,
      status: AuditStatus.SUCCESS,
      userId: adminUser.id,
      entity: "User",
      entityId: userId,
      details: {
        deletedRole: target.role,
        name: target.name,
        email: target.email,
        performedBy: {
          id: adminUser.id,
          name: adminUser.name,
          email: adminUser.email,
        },
      },
    });

    revalidatePath("/admin/users");
    revalidatePath("/admin/audit");
    revalidatePath("/admin");

    return {
      success: true,
      message: `Account for ${target.name || target.role} was successfully removed.`,
    };
  } catch (error) {
    console.error("[User Action Error] Failed to delete user account:", error);
    return {
      success: false,
      message: "An error occurred while deleting the user account.",
    };
  }
}

/**
 * Resets the password for any user account (Admin, Doctor, or Desk).
 */
export async function resetUserPasswordAction(
  prevState: UserActionState | undefined,
  formData: FormData,
): Promise<UserActionState> {
  const { user: adminUser } = await requireAuth(Role.ADMIN);

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

  const { userId, newPassword, revokeSessions } = validation.data;

  try {
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return {
        success: false,
        message: "The specified user account does not exist in the database.",
      };
    }

    const hashedPassword = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
      },
    });

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

    await logAudit({
      action: AuditAction.USER_PASSWORD_RESET,
      status: AuditStatus.SUCCESS,
      userId: adminUser.id,
      entity: "User",
      entityId: targetUser.id,
      details: {
        targetRole: targetUser.role,
        targetEmail: targetUser.email,
        sessionsRevoked: revokedCount,
        performedBy: {
          id: adminUser.id,
          name: adminUser.name,
          email: adminUser.email,
        },
      },
    });

    revalidatePath("/admin/users");
    revalidatePath("/admin/audit");
    revalidatePath("/admin");

    return {
      success: true,
      message: `Password for ${targetUser.name || targetUser.role} was reset successfully. ${
        revokeSessions
          ? `(${revokedCount} active session${revokedCount === 1 ? "" : "s"} terminated)`
          : ""
      }`,
    };
  } catch (error) {
    console.error("[User Action Error] Failed to reset user password:", error);
    return {
      success: false,
      message: "An unexpected error occurred while resetting the password.",
    };
  }
}

/**
 * Revokes all active sessions for a target user account.
 */
export async function revokeAllUserSessionsAction(
  userId: string,
): Promise<UserActionState> {
  const { user: adminUser } = await requireAuth(Role.ADMIN);

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
      entity: "User",
      entityId: targetUser.id,
      details: {
        targetRole: targetUser.role,
        revokedCount: result.count,
        performedBy: {
          id: adminUser.id,
          name: adminUser.name,
          email: adminUser.email,
        },
      },
    });

    revalidatePath("/admin/users");
    revalidatePath("/admin/audit");
    revalidatePath("/admin");

    return {
      success: true,
      message: `Successfully terminated ${result.count} active session${result.count === 1 ? "" : "s"} for ${targetUser.name || targetUser.role}.`,
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
  name: string | null;
  email: string | null;
  whatsapp: string | null;
  createdAt: Date;
  updatedAt: Date;
  activeSessionCount: number;
  totalSessionCount: number;
  lastAccessAt: Date | null;
  performers: {
    id: string;
    name: string;
    email: string | null;
    whatsapp: string;
    phone: string;
    pin: string;
  }[];
}

/**
 * Fetches and aggregates all user accounts, active sessions, and desk performers for Admin User Management.
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
          email: true,
          whatsapp: true,
          phone: true,
          pin: true,
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
      name: u.name,
      email: u.email,
      whatsapp: u.whatsapp,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      activeSessionCount: u.sessions.length,
      totalSessionCount: u._count.sessions,
      lastAccessAt: u.sessions[0]?.lastAccessAt || null,
      performers: u.performers,
    }))
    .sort((a, b) => (roleOrder[a.role] || 99) - (roleOrder[b.role] || 99));
}

