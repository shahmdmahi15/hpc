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
import { AuditAction, AuditStatus, Role } from "@/generated/prisma/enums";

export async function loginAction(
  prevState: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const rawData = {
    role: formData.get("role"),
    identifier: formData.get("identifier")?.toString().trim() || undefined,
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
        identifier: rawData.identifier,
        errors: validation.error.flatten().fieldErrors,
      },
    });

    return {
      success: false,
      message: "Please correct the errors in the form.",
      fieldErrors: validation.error.flatten().fieldErrors,
    };
  }

  const { role, identifier, password } = validation.data;

  // Find user account:
  // For ADMIN & DOCTOR: query by role AND (email OR whatsapp)
  // For RECEPTIONIST, HANDLER, CASHIER: query single shared desk account by role
  let user = null;
  if (role === Role.ADMIN || role === Role.DOCTOR) {
    user = await prisma.user.findFirst({
      where: {
        role,
        OR: [
          { email: identifier },
          { whatsapp: identifier },
        ],
      },
    });

    if (!user) {
      await logAudit({
        action: AuditAction.LOGIN_FAILURE,
        status: AuditStatus.FAILURE,
        details: {
          reason: "Account not found by identifier",
          attemptedRole: role,
          identifier,
        },
      });

      return {
        success: false,
        message: `No ${role.toLowerCase()} account found with email or WhatsApp "${identifier}".`,
        fieldErrors: {
          identifier: ["Account not found with this Email or WhatsApp number."],
        },
      };
    }
  } else {
    user = await prisma.user.findFirst({
      where: { role },
    });

    if (!user) {
      await logAudit({
        action: AuditAction.LOGIN_FAILURE,
        status: AuditStatus.FAILURE,
        details: {
          reason: "Desk account not found for role",
          attemptedRole: role,
        },
      });

      return {
        success: false,
        message: `No desk account found for role ${role}. Please contact an administrator.`,
      };
    }
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

export async function checkLoginSessionAction(): Promise<{
  role: Role;
} | null> {
  const current = await getCurrentSession();
  if (!current) return null;
  return { role: current.user.role };
}
