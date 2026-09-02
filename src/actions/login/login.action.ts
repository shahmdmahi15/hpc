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
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getRoleDashboard } from "@/proxy";

import { logAudit } from "@/lib/audit";
import { AuditAction, AuditStatus } from "@/generated/prisma/enums";

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
    await logAudit({
      action: AuditAction.LOGIN_FAILURE,
      status: AuditStatus.FAILURE,
      details: {
        reason: "Validation Error",
        role: rawData.role,
        errors: validation.error.flatten().fieldErrors,
      },
    });

    return {
      success: false,
      message: "Please correct the errors in the form.",
      fieldErrors: validation.error.flatten().fieldErrors,
    };
  }

  const { role, password } = validation.data;

  // Find unique account by role
  const user = await prisma.user.findUnique({
    where: { role },
  });

  if (!user) {
    await logAudit({
      action: AuditAction.LOGIN_FAILURE,
      status: AuditStatus.FAILURE,
      details: {
        reason: "Account not found for role",
        attemptedRole: role,
      },
    });

    return {
      success: false,
      message:
        "No account found with the selected role. Please check system setup.",
    };
  }

  const isValidPassword = await verifyPassword(user.password, password);

  if (!isValidPassword) {
    await logAudit({
      action: AuditAction.LOGIN_FAILURE,
      status: AuditStatus.FAILURE,
      userId: user.id,
      entity: "User",
      entityId: user.id,
      details: {
        reason: "Invalid password",
        role: user.role,
      },
    });

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

  await logAudit({
    action: AuditAction.LOGIN_SUCCESS,
    status: AuditStatus.SUCCESS,
    userId: user.id,
    entity: "Session",
    entityId: session.id,
    details: {
      role: user.role,
      sessionId: session.id,
    },
  });

  revalidatePath("/", "layout");
  redirect(getRoleDashboard(user.role));
}

export async function logoutAction(): Promise<void> {
  const current = await getCurrentSession();
  if (current) {
    await logAudit({
      action: AuditAction.LOGOUT,
      status: AuditStatus.SUCCESS,
      userId: current.user.id,
      entity: "Session",
      entityId: current.session.id,
      details: {
        role: current.user.role,
      },
    });
    await invalidateSession(current.session.id);
  }
  await deleteSessionTokenCookie();
  revalidatePath("/", "layout");
  redirect("/login");
}
