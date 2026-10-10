"use server";

import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/guard";
import {
  Role,
  AuditAction,
  AuditStatus,
  RoomAccessType,
  RoomStatus,
} from "@/generated/prisma/enums";
import {
  createAccountSchema,
  updateAccountSchema,
  deleteUserAccountSchema,
  resetPasswordSchema,
  type UserActionState,
} from "@/schemas/admin/user.schema";
import { hashPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { emitRealtimeEvent } from "@/lib/realtime/event-bus";

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
    consultationFee: formData.get("consultationFee")
      ? Number(formData.get("consultationFee"))
      : undefined,
    consultationRoomId:
      formData.get("consultationRoomId")?.toString() || undefined,
  };

  const validation = createAccountSchema.safeParse(rawData);
  if (!validation.success) {
    return {
      success: false,
      message: "Please fix the validation errors below.",
      fieldErrors: validation.error.flatten().fieldErrors,
    };
  }

  const {
    role,
    name,
    email,
    whatsapp,
    password,
    consultationFee,
    consultationRoomId,
  } = validation.data;

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

    if (role === Role.DOCTOR && consultationRoomId) {
      const assignedRoom = await prisma.room.findUnique({
        where: { id: consultationRoomId },
        select: { id: true, number: true, accessType: true },
      });
      if (!assignedRoom) {
        return {
          success: false,
          message: "The selected chamber room does not exist.",
          fieldErrors: {
            consultationRoomId: ["The selected chamber room does not exist."],
          },
        };
      }
      if (assignedRoom.accessType !== RoomAccessType.DOCTOR) {
        return {
          success: false,
          message:
            "Only rooms with DOCTOR access type can be assigned as a doctor consultation chamber.",
          fieldErrors: {
            consultationRoomId: [
              "Only DOCTOR type rooms can be assigned as a consultation chamber.",
            ],
          },
        };
      }
    }

    const hashedPassword = await hashPassword(password);

    const newUser = await prisma.user.create({
      data: {
        role,
        name,
        email,
        whatsapp,
        password: hashedPassword,
        consultationFee:
          role === Role.DOCTOR
            ? consultationFee !== undefined && !isNaN(consultationFee)
              ? consultationFee
              : 1000
            : 0,
        consultationRoomId:
          role === Role.DOCTOR && consultationRoomId ? consultationRoomId : null,
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
        consultationRoomId:
          role === Role.DOCTOR ? consultationRoomId || null : null,
        performedBy: {
          id: adminUser.id,
          name: adminUser.name,
          email: adminUser.email,
        },
      },
    });

    emitRealtimeEvent("ADMIN_CONFIG_UPDATED", {
      entity: "User",
      action: "CREATE",
      userId: newUser.id,
      role,
    });

    revalidatePath("/admin/users");
    revalidatePath("/admin/audit");
    revalidatePath("/admin");
    revalidatePath("/receptionist");

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

    emitRealtimeEvent("ADMIN_CONFIG_UPDATED", {
      entity: "User",
      action: "DELETE",
      userId,
      role: target.role,
    });

    revalidatePath("/admin/users");
    revalidatePath("/admin/audit");
    revalidatePath("/admin");
    revalidatePath("/receptionist");

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

    emitRealtimeEvent("ADMIN_CONFIG_UPDATED", {
      entity: "User",
      action: "PASSWORD_RESET",
      userId: targetUser.id,
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

    emitRealtimeEvent("ADMIN_CONFIG_UPDATED", {
      entity: "User",
      action: "REVOKE_SESSIONS",
      userId: targetUser.id,
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
  consultationFee?: number | null;
  consultationRoomId?: string | null;
  consultationRoom?: {
    id: string;
    number: string;
    purpose: string | null;
    accessType: RoomAccessType;
    status: RoomStatus;
  } | null;
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

export interface AdminUsersPageData {
  users: FormattedUserAccountData[];
  rooms: {
    id: string;
    number: string;
    purpose: string | null;
    accessType: RoomAccessType;
    status: RoomStatus;
  }[];
}

/**
 * Fetches and aggregates all user accounts, active sessions, desk performers, and clinic rooms for Admin User Management.
 */
export async function getAdminUsersPageDataAction(): Promise<AdminUsersPageData> {
  await requireAuth(Role.ADMIN);

  const [users, rooms] = await Promise.all([
    prisma.user.findMany({
      include: {
        consultationRoom: {
          select: {
            id: true,
            number: true,
            purpose: true,
            accessType: true,
            status: true,
          },
        },
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
    }),
    prisma.room.findMany({
      select: {
        id: true,
        number: true,
        purpose: true,
        accessType: true,
        status: true,
      },
      orderBy: { number: "asc" },
    }),
  ]);

  const roleOrder: Record<Role, number> = {
    [Role.ADMIN]: 1,
    [Role.DOCTOR]: 2,
    [Role.RECEPTIONIST]: 3,
    [Role.HANDLER]: 4,
    [Role.CASHIER]: 5,
  };

  const formattedUsers: FormattedUserAccountData[] = users
    .map((u) => ({
      id: u.id,
      role: u.role,
      name: u.name,
      email: u.email,
      whatsapp: u.whatsapp,
      consultationFee: u.consultationFee ?? 0,
      consultationRoomId: u.consultationRoomId,
      consultationRoom: u.consultationRoom,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      activeSessionCount: u.sessions.length,
      totalSessionCount: u._count.sessions,
      lastAccessAt: u.sessions[0]?.lastAccessAt || null,
      performers: u.performers,
    }))
    .sort((a, b) => (roleOrder[a.role] || 99) - (roleOrder[b.role] || 99));

  return {
    users: formattedUsers,
    rooms,
  };
}

/**
 * Updates a doctor's preset consultation fee.
 */
export async function updateDoctorConsultationFeeAction(
  doctorId: string,
  fee: number,
): Promise<{ success: boolean; message: string }> {
  const { user: adminUser } = await requireAuth(Role.ADMIN);

  if (fee < 0 || isNaN(fee)) {
    return { success: false, message: "Fee must be a valid non-negative number." };
  }

  try {
    const doctor = await prisma.user.findUnique({
      where: { id: doctorId },
    });

    if (!doctor || doctor.role !== Role.DOCTOR) {
      return { success: false, message: "Doctor not found." };
    }

    await prisma.user.update({
      where: { id: doctorId },
      data: { consultationFee: fee },
    });

    await logAudit({
      action: AuditAction.USER_UPDATE,
      status: AuditStatus.SUCCESS,
      userId: adminUser.id,
      entity: "User",
      entityId: doctorId,
      details: {
        action: "UPDATE_DOCTOR_CONSULTATION_FEE",
        doctorName: doctor.name,
        previousFee: doctor.consultationFee,
        newFee: fee,
      },
    });

    emitRealtimeEvent("ADMIN_CONFIG_UPDATED", {
      entity: "User",
      action: "UPDATE_DOCTOR_FEE",
      doctorId,
      fee,
    });

    revalidatePath("/admin/users");
    revalidatePath("/receptionist");
    revalidatePath("/admin/tracking");
    revalidatePath("/admin");

    return {
      success: true,
      message: `Updated consultation fee for ${doctor.name || "Doctor"} to ৳${fee}.`,
    };
  } catch (error) {
    console.error("[Update Doctor Fee Error]:", error);
    return { success: false, message: "Failed to update consultation fee." };
  }
}

/**
 * Assigns or clears a doctor's default consultation chamber / room.
 */
export async function updateDoctorConsultationRoomAction(
  doctorId: string,
  roomId: string | null,
): Promise<{ success: boolean; message: string }> {
  const { user: adminUser } = await requireAuth(Role.ADMIN);

  try {
    const doctor = await prisma.user.findUnique({
      where: { id: doctorId },
      include: {
        consultationRoom: true,
      },
    });

    if (!doctor || doctor.role !== Role.DOCTOR) {
      return { success: false, message: "Doctor account not found." };
    }

    let targetRoom: {
      id: string;
      number: string;
      purpose: string | null;
      accessType: RoomAccessType;
    } | null = null;
    const cleanRoomId = roomId && roomId !== "none" ? roomId : null;

    if (cleanRoomId) {
      targetRoom = await prisma.room.findUnique({
        where: { id: cleanRoomId },
        select: { id: true, number: true, purpose: true, accessType: true },
      });
      if (!targetRoom) {
        return { success: false, message: "The selected chamber room was not found." };
      }
      if (targetRoom.accessType !== RoomAccessType.DOCTOR) {
        return {
          success: false,
          message:
            "Only rooms with DOCTOR access type can be assigned as a doctor consultation chamber.",
        };
      }
    }

    await prisma.user.update({
      where: { id: doctorId },
      data: {
        consultationRoomId: cleanRoomId,
      },
    });

    await logAudit({
      action: AuditAction.USER_UPDATE,
      status: AuditStatus.SUCCESS,
      userId: adminUser.id,
      entity: "User",
      entityId: doctorId,
      details: {
        action: "UPDATE_DOCTOR_CONSULTATION_ROOM",
        doctorName: doctor.name,
        previousRoomId: doctor.consultationRoomId,
        previousRoomNumber: doctor.consultationRoom?.number ?? null,
        newRoomId: cleanRoomId,
        newRoomNumber: targetRoom ? targetRoom.number : null,
        performedBy: {
          id: adminUser.id,
          name: adminUser.name,
          email: adminUser.email,
        },
      },
    });

    emitRealtimeEvent("ADMIN_CONFIG_UPDATED", {
      entity: "User",
      action: "UPDATE_DOCTOR_ROOM",
      doctorId,
      roomId: cleanRoomId,
    });

    revalidatePath("/admin/users");
    revalidatePath("/admin/rooms");
    revalidatePath("/admin/tracking");
    revalidatePath("/admin");
    revalidatePath("/doctor");
    revalidatePath("/receptionist");

    const message = cleanRoomId && targetRoom
      ? `Assigned Room ${targetRoom.number}${targetRoom.purpose ? ` (${targetRoom.purpose})` : ""} to ${doctor.name || "Doctor"}.`
      : `Cleared assigned consultation chamber for ${doctor.name || "Doctor"}.`;

    return {
      success: true,
      message,
    };
  } catch (error) {
    console.error("[Update Doctor Room Error]:", error);
    return { success: false, message: "Failed to update doctor consultation room." };
  }
}

/**
 * Updates an existing user account's profile details (Admin or Doctor).
 * Handles password rotation, email uniqueness check, and doctor-specific chamber/fee attributes.
 */
export async function updateUserAccountAction(
  prevState: UserActionState | undefined,
  formData: FormData,
): Promise<UserActionState> {
  const { user: adminUser } = await requireAuth(Role.ADMIN);

  const rawData = {
    userId: formData.get("userId")?.toString() || "",
    name: formData.get("name")?.toString() || "",
    email: formData.get("email")?.toString() || "",
    whatsapp: formData.get("whatsapp")?.toString() || "",
    newPassword: formData.get("newPassword")?.toString() || undefined,
    consultationFee: formData.get("consultationFee")
      ? Number(formData.get("consultationFee"))
      : undefined,
    consultationRoomId:
      formData.get("consultationRoomId")?.toString() || undefined,
  };

  const validation = updateAccountSchema.safeParse(rawData);
  if (!validation.success) {
    return {
      success: false,
      message: "Please fix the validation errors below.",
      fieldErrors: validation.error.flatten().fieldErrors,
    };
  }

  const {
    userId,
    name,
    email,
    whatsapp,
    newPassword,
    consultationFee,
    consultationRoomId,
  } = validation.data;

  try {
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return {
        success: false,
        message: "The specified user account does not exist.",
      };
    }

    // Check if another user already has the updated email
    const existingEmail = await prisma.user.findFirst({
      where: {
        email,
        NOT: { id: userId },
      },
    });

    if (existingEmail) {
      return {
        success: false,
        message: `An account with email "${email}" already exists.`,
        fieldErrors: {
          email: ["Email is already registered by another account."],
        },
      };
    }

    // If newPassword provided and non-empty, hash it
    let hashedPassword: string | undefined;
    if (newPassword && newPassword.trim().length > 0) {
      hashedPassword = await hashPassword(newPassword.trim());
    }

    // Prepare update data
    const updateData: {
      name: string;
      email: string;
      whatsapp: string;
      password?: string;
      consultationFee?: number;
      consultationRoomId?: string | null;
    } = {
      name,
      email,
      whatsapp,
    };

    if (hashedPassword) {
      updateData.password = hashedPassword;
    }

    if (targetUser.role === Role.DOCTOR) {
      if (consultationFee !== undefined && !isNaN(consultationFee)) {
        updateData.consultationFee = consultationFee;
      }
      if (consultationRoomId) {
        const assignedRoom = await prisma.room.findUnique({
          where: { id: consultationRoomId },
          select: { id: true, number: true, accessType: true },
        });
        if (!assignedRoom) {
          return {
            success: false,
            message: "The selected chamber room does not exist.",
            fieldErrors: {
              consultationRoomId: ["The selected chamber room does not exist."],
            },
          };
        }
        if (assignedRoom.accessType !== RoomAccessType.DOCTOR) {
          return {
            success: false,
            message:
              "Only rooms with DOCTOR access type can be assigned as a doctor consultation chamber.",
            fieldErrors: {
              consultationRoomId: [
                "Only DOCTOR type rooms can be assigned as a consultation chamber.",
              ],
            },
          };
        }
        updateData.consultationRoomId = consultationRoomId;
      } else {
        updateData.consultationRoomId = null;
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    await logAudit({
      action: AuditAction.USER_UPDATE,
      status: AuditStatus.SUCCESS,
      userId: adminUser.id,
      entity: "User",
      entityId: userId,
      details: {
        userId,
        role: targetUser.role,
        changes: {
          name,
          email,
          whatsapp,
          passwordUpdated: !!hashedPassword,
          ...(targetUser.role === Role.DOCTOR && {
            consultationFee: updateData.consultationFee,
            consultationRoomId: updateData.consultationRoomId,
          }),
        },
        performedBy: {
          id: adminUser.id,
          name: adminUser.name,
          email: adminUser.email,
        },
      },
    });

    emitRealtimeEvent("ADMIN_CONFIG_UPDATED", {
      entity: "User",
      action: "UPDATE",
      userId,
      role: targetUser.role,
    });

    revalidatePath("/admin/users");
    revalidatePath("/admin/audit");
    revalidatePath("/admin");
    if (targetUser.role === Role.DOCTOR) {
      revalidatePath("/doctor");
      revalidatePath("/receptionist");
    }

    return {
      success: true,
      message: "Account updated successfully.",
    };
  } catch (error) {
    console.error("[User Action Error] Failed to update user account:", error);
    return {
      success: false,
      message: "An unexpected error occurred while updating the account.",
    };
  }
}


