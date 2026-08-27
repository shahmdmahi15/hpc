"use server";

import prisma from "@/lib/prisma";
import { getCurrentSession, deleteSessionTokenCookie } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { AuditAction, AuditStatus, Role } from "@/generated/prisma/enums";
import { revalidatePath } from "next/cache";

export interface SessionDisplayItem {
  id: string;
  isCurrent: boolean;
  ipAddress: string | null;
  userAgent: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  createdAt: string;
  lastAccessAt: string;
  expiresAt: string;
  user?: {
    id: string;
    name: string;
    role: Role;
  };
}

/**
 * Retrieves all active sessions for the currently authenticated user.
 */
export async function getUserSessionsAction(): Promise<{
  success: boolean;
  sessions?: SessionDisplayItem[];
  message?: string;
}> {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return { success: false, message: "Unauthorized. Please sign in." };
    }

    const sessions = await prisma.session.findMany({
      where: {
        userId: current.user.id,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastAccessAt: "desc" },
    });

    const displaySessions: SessionDisplayItem[] = sessions.map((s) => ({
      id: s.id,
      isCurrent: s.id === current.session.id,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      device: s.device,
      browser: s.browser,
      os: s.os,
      createdAt: s.createdAt.toISOString(),
      lastAccessAt: s.lastAccessAt
        ? s.lastAccessAt.toISOString()
        : s.createdAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
    }));

    return { success: true, sessions: displaySessions };
  } catch (error) {
    console.error("Failed to retrieve user sessions:", error);
    return { success: false, message: "Failed to load active sessions." };
  }
}

/**
 * Revokes a specific session belonging to the authenticated user.
 */
export async function revokeSessionAction(sessionId: string): Promise<{
  success: boolean;
  message: string;
  isCurrentRevoked?: boolean;
}> {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return { success: false, message: "Unauthorized. Please sign in." };
    }

    const target = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!target) {
      return {
        success: false,
        message: "Session not found or already expired.",
      };
    }

    // Must belong to user or user is admin
    if (target.userId !== current.user.id && current.user.role !== Role.ADMIN) {
      return {
        success: false,
        message: "Forbidden. Cannot revoke another user's session.",
      };
    }

    const isCurrent = target.id === current.session.id;

    await prisma.session.delete({
      where: { id: sessionId },
    });

    // Log audit trail
    await logAudit({
      userId: current.user.id,
      action: AuditAction.USER_SESSIONS_REVOKED,
      status: AuditStatus.SUCCESS,
      entity: "Session",
      entityId: sessionId,
      details: {
        revokedSessionId: sessionId,
        targetUserId: target.userId,
        isCurrentSession: isCurrent,
        device: target.device,
        ipAddress: target.ipAddress,
      },
    });

    if (isCurrent) {
      await deleteSessionTokenCookie();
    }

    revalidatePath("/admin/profile");
    revalidatePath("/doctor/profile");
    revalidatePath("/receptionist/profile");
    revalidatePath("/handler/profile");
    revalidatePath("/admin/sessions");
    revalidatePath("/admin");

    return {
      success: true,
      message: isCurrent
        ? "Current session terminated. You have been signed out."
        : "Session revoked successfully.",
      isCurrentRevoked: isCurrent,
    };
  } catch (error) {
    console.error("Failed to revoke session:", error);
    return { success: false, message: "Failed to revoke session." };
  }
}

/**
 * Revokes all other active sessions for the current user except their current session.
 */
export async function revokeAllOtherSessionsAction(): Promise<{
  success: boolean;
  message: string;
  revokedCount?: number;
}> {
  try {
    const current = await getCurrentSession();
    if (!current) {
      return { success: false, message: "Unauthorized. Please sign in." };
    }

    const deleteResult = await prisma.session.deleteMany({
      where: {
        userId: current.user.id,
        id: { not: current.session.id },
      },
    });

    // Log audit trail
    await logAudit({
      userId: current.user.id,
      action: AuditAction.USER_SESSIONS_REVOKED,
      status: AuditStatus.SUCCESS,
      entity: "Session",
      entityId: current.user.id,
      details: {
        actionType: "REVOKE_ALL_OTHER_SESSIONS",
        preservedSessionId: current.session.id,
        revokedCount: deleteResult.count,
      },
    });

    revalidatePath("/admin/profile");
    revalidatePath("/doctor/profile");
    revalidatePath("/receptionist/profile");
    revalidatePath("/handler/profile");
    revalidatePath("/admin/sessions");
    revalidatePath("/admin");

    return {
      success: true,
      message: `Successfully terminated ${deleteResult.count} other active session(s).`,
      revokedCount: deleteResult.count,
    };
  } catch (error) {
    console.error("Failed to revoke all other sessions:", error);
    return { success: false, message: "Failed to revoke other sessions." };
  }
}

/**
 * (Admin Only) Fetches all active sessions across all users in the system.
 */
export async function getAdminAllSessionsAction(): Promise<{
  success: boolean;
  sessions?: SessionDisplayItem[];
  stats?: {
    totalSessions: number;
    distinctUsers: number;
    desktopCount: number;
    mobileCount: number;
  };
  message?: string;
}> {
  try {
    const current = await getCurrentSession();
    if (!current || current.user.role !== Role.ADMIN) {
      return {
        success: false,
        message: "Unauthorized. Administrator access required.",
      };
    }

    const sessions = await prisma.session.findMany({
      where: {
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
      orderBy: { lastAccessAt: "desc" },
    });

    const displaySessions: SessionDisplayItem[] = sessions.map((s) => ({
      id: s.id,
      isCurrent: s.id === current.session.id,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      device: s.device,
      browser: s.browser,
      os: s.os,
      createdAt: s.createdAt.toISOString(),
      lastAccessAt: s.lastAccessAt
        ? s.lastAccessAt.toISOString()
        : s.createdAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
      user: s.user,
    }));

    const distinctUserIds = new Set(sessions.map((s) => s.userId));
    const desktopCount = sessions.filter(
      (s) => (s.device || "").toLowerCase() === "desktop",
    ).length;
    const mobileCount = sessions.filter(
      (s) => (s.device || "").toLowerCase() === "mobile",
    ).length;

    return {
      success: true,
      sessions: displaySessions,
      stats: {
        totalSessions: sessions.length,
        distinctUsers: distinctUserIds.size,
        desktopCount,
        mobileCount,
      },
    };
  } catch (error) {
    console.error("Failed to load admin all sessions:", error);
    return { success: false, message: "Failed to load global sessions." };
  }
}

/**
 * (Admin Only) Revokes a single session anywhere in the system.
 */
export async function adminRevokeSingleSessionAction(
  sessionId: string,
): Promise<{
  success: boolean;
  message: string;
  isCurrentAdminRevoked?: boolean;
}> {
  try {
    const current = await getCurrentSession();
    if (!current || current.user.role !== Role.ADMIN) {
      return {
        success: false,
        message: "Unauthorized. Administrator access required.",
      };
    }

    const target = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: { select: { name: true, role: true, id: true } } },
    });

    if (!target) {
      return {
        success: false,
        message: "Session not found or already inactive.",
      };
    }

    const isCurrent = target.id === current.session.id;

    await prisma.session.delete({
      where: { id: sessionId },
    });

    // Log audit trail
    await logAudit({
      userId: current.user.id,
      action: AuditAction.USER_SESSIONS_REVOKED,
      status: AuditStatus.SUCCESS,
      entity: "Session",
      entityId: sessionId,
      details: {
        actionType: "ADMIN_REVOKE_SINGLE_SESSION",
        revokedSessionId: sessionId,
        targetUserId: target.userId,
        targetUserName: target.user.name,
        targetUserRole: target.user.role,
        adminId: current.user.id,
        isCurrentAdmin: isCurrent,
      },
    });

    if (isCurrent) {
      await deleteSessionTokenCookie();
    }

    revalidatePath("/admin/sessions");
    revalidatePath("/admin/users");
    revalidatePath("/admin");

    return {
      success: true,
      message: `Session for ${target.user.name} was successfully revoked.`,
      isCurrentAdminRevoked: isCurrent,
    };
  } catch (error) {
    console.error("Admin failed to revoke session:", error);
    return { success: false, message: "Failed to revoke session." };
  }
}

/**
 * (Admin Only) Revokes all sessions for a specific target user.
 */
export async function adminRevokeUserAllSessionsAction(
  targetUserId: string,
): Promise<{
  success: boolean;
  message: string;
  revokedCount?: number;
}> {
  try {
    const current = await getCurrentSession();
    if (!current || current.user.role !== Role.ADMIN) {
      return {
        success: false,
        message: "Unauthorized. Administrator access required.",
      };
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, name: true, role: true },
    });

    if (!targetUser) {
      return { success: false, message: "Target user not found." };
    }

    const deleteResult = await prisma.session.deleteMany({
      where: { userId: targetUserId },
    });

    // Log audit trail
    await logAudit({
      userId: current.user.id,
      action: AuditAction.USER_SESSIONS_REVOKED,
      status: AuditStatus.SUCCESS,
      entity: "User",
      entityId: targetUserId,
      details: {
        actionType: "ADMIN_REVOKE_ALL_USER_SESSIONS",
        targetUserId,
        targetUserName: targetUser.name,
        targetUserRole: targetUser.role,
        revokedCount: deleteResult.count,
        adminId: current.user.id,
      },
    });

    // If admin revoked themselves
    if (targetUserId === current.user.id) {
      await deleteSessionTokenCookie();
    }

    revalidatePath("/admin/sessions");
    revalidatePath("/admin/users");
    revalidatePath("/admin");

    return {
      success: true,
      message: `Revoked ${deleteResult.count} session(s) for ${targetUser.name}.`,
      revokedCount: deleteResult.count,
    };
  } catch (error) {
    console.error("Admin failed to revoke user sessions:", error);
    return { success: false, message: "Failed to revoke user sessions." };
  }
}

/**
 * (Admin Only) Emergency System Flush: Revokes all sessions across the whole system.
 */
export async function adminRevokeAllSystemSessionsAction(
  preserveCurrentAdmin: boolean = true,
): Promise<{
  success: boolean;
  message: string;
  revokedCount?: number;
}> {
  try {
    const current = await getCurrentSession();
    if (!current || current.user.role !== Role.ADMIN) {
      return {
        success: false,
        message: "Unauthorized. Administrator access required.",
      };
    }

    const deleteResult = await prisma.session.deleteMany({
      where: preserveCurrentAdmin ? { id: { not: current.session.id } } : {},
    });

    // Log audit trail
    await logAudit({
      userId: current.user.id,
      action: AuditAction.USER_SESSIONS_REVOKED,
      status: AuditStatus.SUCCESS,
      entity: "System",
      entityId: "ALL_SESSIONS",
      details: {
        actionType: "ADMIN_EMERGENCY_SYSTEM_PURGE",
        preservedAdminSession: preserveCurrentAdmin,
        revokedCount: deleteResult.count,
        adminId: current.user.id,
      },
    });

    if (!preserveCurrentAdmin) {
      await deleteSessionTokenCookie();
    }

    revalidatePath("/admin/sessions");
    revalidatePath("/admin/users");
    revalidatePath("/admin");

    return {
      success: true,
      message: `Emergency flush complete: ${deleteResult.count} session(s) terminated across the system.`,
      revokedCount: deleteResult.count,
    };
  } catch (error) {
    console.error("Admin failed emergency system purge:", error);
    return {
      success: false,
      message: "Failed to perform system session purge.",
    };
  }
}
