"use server";

import prisma from "@/lib/prisma";
import { getCurrentSession, hashPassword } from "@/lib/auth";
import { Role } from "@/generated/prisma/enums";
import {
  CreateUserSchema,
  UpdateUserSchema,
  ResetUserPasswordSchema,
  DeleteUserSchema,
  RevokeSessionsSchema,
} from "@/schemas/admin/user.schema";
import { revalidatePath } from "next/cache";

export interface AdminActionState {
  success?: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

// 1. Create User Action
export async function createUserAction(
  _prevState: AdminActionState | undefined,
  formData: FormData,
): Promise<AdminActionState> {
  const currentSession = await getCurrentSession();
  if (!currentSession || currentSession.user.role !== Role.ADMIN) {
    return {
      success: false,
      message: "Unauthorized: Administrator privileges required.",
    };
  }

  const rawData = {
    name: formData.get("name"),
    role: formData.get("role"),
    password: formData.get("password"),
  };

  const validated = CreateUserSchema.safeParse(rawData);
  if (!validated.success) {
    return {
      success: false,
      message: "Please correct the errors in the form.",
      fieldErrors: validated.error.flatten().fieldErrors,
    };
  }

  try {
    const hashedPassword = await hashPassword(validated.data.password);

    await prisma.user.create({
      data: {
        name: validated.data.name,
        role: validated.data.role,
        password: hashedPassword,
      },
    });

    revalidatePath("/admin");
    return {
      success: true,
      message: `Staff member "${validated.data.name}" created successfully as ${validated.data.role}.`,
    };
  } catch (error) {
    console.error("createUserAction error:", error);
    return {
      success: false,
      message: "A database error occurred while creating the staff user.",
    };
  }
}

// 2. Update User Action
export async function updateUserAction(
  _prevState: AdminActionState | undefined,
  formData: FormData,
): Promise<AdminActionState> {
  const currentSession = await getCurrentSession();
  if (!currentSession || currentSession.user.role !== Role.ADMIN) {
    return {
      success: false,
      message: "Unauthorized: Administrator privileges required.",
    };
  }

  const rawData = {
    userId: formData.get("userId"),
    name: formData.get("name"),
    role: formData.get("role"),
  };

  const validated = UpdateUserSchema.safeParse(rawData);
  if (!validated.success) {
    return {
      success: false,
      message: "Please correct the errors in the form.",
      fieldErrors: validated.error.flatten().fieldErrors,
    };
  }

  try {
    const targetUser = await prisma.user.findUnique({
      where: { id: validated.data.userId },
    });

    if (!targetUser) {
      return { success: false, message: "Staff user not found." };
    }

    // Safety check: If changing an ADMIN to another role, ensure another ADMIN remains
    if (targetUser.role === Role.ADMIN && validated.data.role !== Role.ADMIN) {
      const adminCount = await prisma.user.count({
        where: { role: Role.ADMIN },
      });
      if (adminCount <= 1) {
        return {
          success: false,
          message:
            "Cannot demote the only administrator. Assign another administrator first.",
        };
      }
    }

    await prisma.user.update({
      where: { id: validated.data.userId },
      data: {
        name: validated.data.name,
        role: validated.data.role,
      },
    });

    revalidatePath("/admin");
    return {
      success: true,
      message: `Staff account "${validated.data.name}" updated successfully.`,
    };
  } catch (error) {
    console.error("updateUserAction error:", error);
    return {
      success: false,
      message: "Failed to update staff account.",
    };
  }
}

// 3. Reset User Password Action
export async function resetUserPasswordAction(
  _prevState: AdminActionState | undefined,
  formData: FormData,
): Promise<AdminActionState> {
  const currentSession = await getCurrentSession();
  if (!currentSession || currentSession.user.role !== Role.ADMIN) {
    return {
      success: false,
      message: "Unauthorized: Administrator privileges required.",
    };
  }

  const rawData = {
    userId: formData.get("userId"),
    password: formData.get("password"),
  };

  const validated = ResetUserPasswordSchema.safeParse(rawData);
  if (!validated.success) {
    return {
      success: false,
      message: "Please enter a valid password.",
      fieldErrors: validated.error.flatten().fieldErrors,
    };
  }

  try {
    const targetUser = await prisma.user.findUnique({
      where: { id: validated.data.userId },
    });

    if (!targetUser) {
      return { success: false, message: "Staff user not found." };
    }

    const hashedPassword = await hashPassword(validated.data.password);

    // Update password and revoke other sessions so the user re-authenticates
    await prisma.$transaction([
      prisma.user.update({
        where: { id: validated.data.userId },
        data: { password: hashedPassword },
      }),
      prisma.session.deleteMany({
        where: { userId: validated.data.userId },
      }),
    ]);

    revalidatePath("/admin");
    return {
      success: true,
      message: `Password reset successfully for "${targetUser.name}". Active sessions terminated.`,
    };
  } catch (error) {
    console.error("resetUserPasswordAction error:", error);
    return {
      success: false,
      message: "Failed to reset password.",
    };
  }
}

// 4. Delete User Action
export async function deleteUserAction(
  _prevState: AdminActionState | undefined,
  formData: FormData,
): Promise<AdminActionState> {
  const currentSession = await getCurrentSession();
  if (!currentSession || currentSession.user.role !== Role.ADMIN) {
    return {
      success: false,
      message: "Unauthorized: Administrator privileges required.",
    };
  }

  const rawData = {
    userId: formData.get("userId"),
  };

  const validated = DeleteUserSchema.safeParse(rawData);
  if (!validated.success) {
    return { success: false, message: "Invalid user ID." };
  }

  // Safety 1: Cannot delete self
  if (currentSession.user.id === validated.data.userId) {
    return {
      success: false,
      message:
        "Safety Violation: You cannot delete your own active administrator account.",
    };
  }

  try {
    const targetUser = await prisma.user.findUnique({
      where: { id: validated.data.userId },
    });

    if (!targetUser) {
      return { success: false, message: "Staff user not found." };
    }

    // Safety 2: If deleting an ADMIN, ensure at least one other ADMIN remains
    if (targetUser.role === Role.ADMIN) {
      const adminCount = await prisma.user.count({
        where: { role: Role.ADMIN },
      });
      if (adminCount <= 1) {
        return {
          success: false,
          message:
            "Safety Violation: Cannot delete the last active administrator.",
        };
      }
    }

    await prisma.user.delete({
      where: { id: validated.data.userId },
    });

    revalidatePath("/admin");
    return {
      success: true,
      message: `Staff account "${targetUser.name}" has been permanently removed.`,
    };
  } catch (error) {
    console.error("deleteUserAction error:", error);
    return {
      success: false,
      message: "Failed to delete staff account.",
    };
  }
}

// 5. Revoke Active Sessions Action
export async function revokeUserSessionsAction(
  _prevState: AdminActionState | undefined,
  formData: FormData,
): Promise<AdminActionState> {
  const currentSession = await getCurrentSession();
  if (!currentSession || currentSession.user.role !== Role.ADMIN) {
    return {
      success: false,
      message: "Unauthorized: Administrator privileges required.",
    };
  }

  const rawData = {
    userId: formData.get("userId"),
  };

  const validated = RevokeSessionsSchema.safeParse(rawData);
  if (!validated.success) {
    return { success: false, message: "Invalid user ID." };
  }

  try {
    const deleted = await prisma.session.deleteMany({
      where: { userId: validated.data.userId },
    });

    revalidatePath("/admin");
    return {
      success: true,
      message: `Revoked ${deleted.count} active session(s). The user will be required to log in again.`,
    };
  } catch (error) {
    console.error("revokeUserSessionsAction error:", error);
    return {
      success: false,
      message: "Failed to revoke sessions.",
    };
  }
}
