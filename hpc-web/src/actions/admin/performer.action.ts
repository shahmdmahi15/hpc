"use server";

import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/guard";
import { Role, AuditAction, AuditStatus } from "@/generated/prisma/enums";
import {
  createPerformerSchema,
  updatePerformerSchema,
  deletePerformerSchema,
  type PerformerActionState,
} from "@/schemas/admin/performer.schema";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { resolveActingAdminPerformer } from "@/actions/admin/admin-performer-guard";

/**
 * Creates a new clinical or desk performer assigned to a designated role account.
 * Accessible only to authenticated Administrators.
 * Enforces mandatory admin performer selection if multiple admin staff exist.
 */
export async function createPerformerAction(
  prevState: PerformerActionState | undefined,
  formData: FormData,
): Promise<PerformerActionState> {
  // 1. Strict Administrator Authentication Guard
  const { user: adminUser } = await requireAuth(Role.ADMIN);

  // 2. Extract and Validate Form Data
  const rawData = {
    userId: formData.get("userId")?.toString() || "",
    adminPerformerId: formData.get("adminPerformerId")?.toString() || undefined,
    name: formData.get("name")?.toString() || "",
    email: formData.get("email")?.toString() || undefined,
    whatsapp:
      formData.get("whatsapp")?.toString() ||
      formData.get("phone")?.toString() ||
      "",
    phone:
      formData.get("phone")?.toString() ||
      formData.get("whatsapp")?.toString() ||
      "",
    pin: formData.get("pin")?.toString() || "",
  };

  const validation = createPerformerSchema.safeParse(rawData);

  if (!validation.success) {
    return {
      success: false,
      message: "Please correct the errors in the form.",
      fieldErrors: validation.error.flatten().fieldErrors,
    };
  }

  const { userId, name, email, whatsapp, phone, pin } = validation.data;

  try {
    // 3. Ensure target User account exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return {
        success: false,
        message: "The specified role station account could not be found.",
      };
    }

    // 4. Verify that target role is a desk station that supports performers
    if (targetUser.role === Role.ADMIN || targetUser.role === Role.DOCTOR) {
      return {
        success: false,
        message: "Staff performers cannot be assigned to Admin or Doctor roles. Admin and Doctor are individual user accounts.",
      };
    }

    // 5. Check for duplicate whatsapp under the same role desk
    const existingPerformerSamePhone = await prisma.performer.findFirst({
      where: {
        userId,
        OR: [
          { whatsapp },
          { phone: whatsapp },
        ],
      },
    });

    if (existingPerformerSamePhone) {
      return {
        success: false,
        message: `A staff member with WhatsApp number "${whatsapp}" is already registered under this station desk.`,
        fieldErrors: {
          whatsapp: [
            "This WhatsApp number is already registered for this role desk.",
          ],
        },
      };
    }

    // 6. Create Performer Record with 4-digit PIN
    const newPerformer = await prisma.performer.create({
      data: {
        name,
        email: email || null,
        whatsapp,
        phone: phone || whatsapp,
        pin,
        userId,
      },
    });

    // 7. Record Immutable Audit Log with Admin Attribution
    await logAudit({
      action: AuditAction.PERFORMER_CREATE,
      status: AuditStatus.SUCCESS,
      userId: adminUser.id,
      entity: "Performer",
      entityId: newPerformer.id,
      details: {
        type: "PERFORMER_CREATED",
        name: newPerformer.name,
        whatsapp: newPerformer.whatsapp,
        targetRole: targetUser.role,
        targetUserId: targetUser.id,
        pinConfigured: true,
        performedBy: {
          id: adminUser.id,
          name: adminUser.name,
          email: adminUser.email,
        },
      },
    });

    // 8. Revalidate Admin User Management, Overview & Audit Log
    revalidatePath("/admin/users");
    revalidatePath("/admin/audit");
    revalidatePath("/admin");

    return {
      success: true,
      message: `Staff performer "${name}" (PIN: ${pin}) successfully registered under ${targetUser.role} desk.`,
    };
  } catch (error) {
    console.error(
      "[Performer Action Error] Failed to create performer:",
      error,
    );

    await logAudit({
      action: AuditAction.USER_UPDATE,
      status: AuditStatus.FAILURE,
      userId: adminUser.id,
      entity: "Performer",
      details: {
        type: "PERFORMER_CREATE_FAILED",
        name,
        whatsapp,
        targetUserId: userId,
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });

    return {
      success: false,
      message:
        "An unexpected error occurred while adding the staff member. Please try again.",
    };
  }
}

/**
 * Deletes a performer from their assigned department desk.
 * Accessible only to authenticated Administrators.
 * Enforces mandatory admin performer selection if multiple admin staff exist.
 */
export async function deletePerformerAction(
  performerId: string,
  _adminPerformerId?: string,
): Promise<PerformerActionState> {
  const { user: adminUser } = await requireAuth(Role.ADMIN);

  const validation = deletePerformerSchema.safeParse({
    performerId,
    adminPerformerId: _adminPerformerId,
  });
  if (!validation.success) {
    return {
      success: false,
      message: "Invalid performer details provided.",
    };
  }

  try {
    const existingPerformer = await prisma.performer.findUnique({
      where: { id: performerId },
      include: { user: true },
    });

    if (!existingPerformer) {
      return {
        success: false,
        message: "Performer record does not exist or has already been removed.",
      };
    }

    await prisma.performer.delete({
      where: { id: performerId },
    });

    await logAudit({
      action: AuditAction.PERFORMER_DELETE,
      status: AuditStatus.SUCCESS,
      userId: adminUser.id,
      entity: "Performer",
      entityId: performerId,
      details: {
        type: "PERFORMER_DELETED",
        name: existingPerformer.name,
        whatsapp: existingPerformer.whatsapp,
        role: existingPerformer.user.role,
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
      message: `Staff member "${existingPerformer.name}" has been removed from ${existingPerformer.user.role} desk.`,
    };
  } catch (error) {
    console.error(
      "[Performer Action Error] Failed to delete performer:",
      error,
    );

    return {
      success: false,
      message:
        "An error occurred while deleting the performer. Please try again.",
    };
  }
}

/**
 * Updates an existing clinical or desk performer's details, PIN, or role station desk.
 * Accessible only to authenticated Administrators.
 */
export async function updatePerformerAction(
  prevState: PerformerActionState | undefined,
  formData: FormData,
): Promise<PerformerActionState> {
  const { user: adminUser } = await requireAuth(Role.ADMIN);

  const rawData = {
    performerId: formData.get("performerId")?.toString() || "",
    userId: formData.get("userId")?.toString() || "",
    adminPerformerId: formData.get("adminPerformerId")?.toString() || undefined,
    name: formData.get("name")?.toString() || "",
    email: formData.get("email")?.toString() || undefined,
    whatsapp:
      formData.get("whatsapp")?.toString() ||
      formData.get("phone")?.toString() ||
      "",
    phone:
      formData.get("phone")?.toString() ||
      formData.get("whatsapp")?.toString() ||
      "",
    pin: formData.get("pin")?.toString() || "",
  };

  const validation = updatePerformerSchema.safeParse(rawData);
  if (!validation.success) {
    return {
      success: false,
      message: "Please correct the errors in the form.",
      fieldErrors: validation.error.flatten().fieldErrors,
    };
  }

  const { performerId, userId, name, email, whatsapp, phone, pin } =
    validation.data;

  try {
    const existingPerformer = await prisma.performer.findUnique({
      where: { id: performerId },
      include: { user: true },
    });

    if (!existingPerformer) {
      return {
        success: false,
        message: "Performer record does not exist or has already been removed.",
      };
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return {
        success: false,
        message: "The specified role station account could not be found.",
      };
    }

    if (targetUser.role === Role.ADMIN || targetUser.role === Role.DOCTOR) {
      return {
        success: false,
        message:
          "Staff performers cannot be assigned to Admin or Doctor roles. Admin and Doctor are individual user accounts.",
      };
    }

    // Check phone uniqueness: ensures no other performer under that same desk has the same whatsapp
    const existingPerformerSamePhone = await prisma.performer.findFirst({
      where: {
        userId,
        NOT: { id: performerId },
        OR: [{ whatsapp }, { phone: whatsapp }],
      },
    });

    if (existingPerformerSamePhone) {
      return {
        success: false,
        message: `A staff member with WhatsApp number "${whatsapp}" is already registered under this station desk.`,
        fieldErrors: {
          whatsapp: [
            "This WhatsApp number is already registered for this role desk.",
          ],
        },
      };
    }

    await prisma.performer.update({
      where: { id: performerId },
      data: {
        name,
        email: email || null,
        whatsapp,
        phone: phone || whatsapp,
        pin,
        userId,
      },
    });

    await logAudit({
      action: AuditAction.PERFORMER_UPDATE,
      status: AuditStatus.SUCCESS,
      userId: adminUser.id,
      entity: "Performer",
      entityId: performerId,
      details: {
        performerId,
        name,
        deskRole: targetUser.role,
        previousDeskRole: existingPerformer.user?.role,
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
      message: "Performer updated successfully.",
    };
  } catch (error) {
    console.error(
      "[Performer Action Error] Failed to update performer:",
      error,
    );

    return {
      success: false,
      message:
        "An unexpected error occurred while updating the staff member. Please try again.",
    };
  }
}

