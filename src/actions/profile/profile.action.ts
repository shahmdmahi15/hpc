"use server";

import prisma from "@/lib/prisma";
import { getCurrentSession, hashPassword, verifyPassword } from "@/lib/auth";
import {
  UpdateProfileInfoSchema,
  UpdatePasswordSchema,
} from "@/schemas/profile/profile.schema";
import { revalidatePath } from "next/cache";

export type ProfileActionState = {
  success?: boolean;
  message?: string;
  fieldErrors?: {
    name?: string[];
    currentPassword?: string[];
    newPassword?: string[];
    confirmPassword?: string[];
  };
};

export async function updateProfileInfoAction(
  _prevState: ProfileActionState | undefined,
  formData: FormData,
): Promise<ProfileActionState> {
  const current = await getCurrentSession();
  if (!current) {
    return { success: false, message: "Unauthorized. Please log in again." };
  }

  const rawData = {
    name: formData.get("name"),
  };

  const validated = UpdateProfileInfoSchema.safeParse(rawData);
  if (!validated.success) {
    return {
      success: false,
      message: "Please correct the errors in the form.",
      fieldErrors: validated.error.flatten().fieldErrors,
    };
  }

  try {
    await prisma.user.update({
      where: { id: current.user.id },
      data: { name: validated.data.name },
    });

    revalidatePath("/", "layout");
    return {
      success: true,
      message: "Profile display name updated successfully.",
    };
  } catch (error) {
    console.error("updateProfileInfoAction error:", error);
    return {
      success: false,
      message: "Failed to update profile information.",
    };
  }
}

export async function updatePasswordAction(
  _prevState: ProfileActionState | undefined,
  formData: FormData,
): Promise<ProfileActionState> {
  const current = await getCurrentSession();
  if (!current) {
    return { success: false, message: "Unauthorized. Please log in again." };
  }

  const rawData = {
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  };

  const validated = UpdatePasswordSchema.safeParse(rawData);
  if (!validated.success) {
    return {
      success: false,
      message: "Please correct the password requirements.",
      fieldErrors: validated.error.flatten().fieldErrors,
    };
  }

  try {
    // Verify current password
    const isMatch = await verifyPassword(
      current.user.password,
      validated.data.currentPassword,
    );
    if (!isMatch) {
      return {
        success: false,
        message: "Current password is incorrect.",
        fieldErrors: { currentPassword: ["Incorrect password provided"] },
      };
    }

    // Hash new password and update in database
    const hashed = await hashPassword(validated.data.newPassword);
    await prisma.user.update({
      where: { id: current.user.id },
      data: { password: hashed },
    });

    revalidatePath("/", "layout");
    return { success: true, message: "Password has been updated securely." };
  } catch (error) {
    console.error("updatePasswordAction error:", error);
    return {
      success: false,
      message: "Failed to update password.",
    };
  }
}
