"use server";

import prisma from "@/lib/prisma";
import { loginSchema, type ActionState } from "@/schemas/login/login.schema";
import {
  verifyPassword,
  createSession,
  setSessionTokenCookie,
  deleteSessionTokenCookie,
  getCurrentSession,
  invalidateSession,
} from "@/lib/auth";
import { getRoleDashboard } from "@/proxy";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function loginAction(
  prevState: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const rawData = {
    role: formData.get("role"),
    password: formData.get("password"),
  };

  const validation = loginSchema.safeParse(rawData);

  if (!validation.success) {
    return {
      success: false,
      message: "Please correct the errors in the form.",
      fieldErrors: validation.error.flatten().fieldErrors,
    };
  }

  const { role, password } = validation.data;

  // Find user by role
  const user = await prisma.user.findFirst({
    where: { role },
  });

  if (!user) {
    return {
      success: false,
      message:
        "No user found with the selected role. Please check system setup.",
    };
  }

  const isValidPassword = await verifyPassword(user.password, password);

  if (!isValidPassword) {
    return {
      success: false,
      message: "Invalid password for the selected role.",
      fieldErrors: {
        password: ["Incorrect password provided"],
      },
    };
  }

  // Create session in database and set secure HTTP-only cookie
  const { token, session } = await createSession(user.id);
  await setSessionTokenCookie(token, session.expiresAt);

  revalidatePath("/", "layout");
  redirect(getRoleDashboard(user.role));
}

export async function logoutAction(): Promise<void> {
  const current = await getCurrentSession();
  if (current) {
    await invalidateSession(current.session.id);
  }
  await deleteSessionTokenCookie();
  revalidatePath("/", "layout");
  redirect("/login");
}
