"use server";

import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/guard";
import { Role, AuditAction, AuditStatus } from "@/generated/prisma/enums";
import {
  createPerformerSchema,
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
    phone: formData.get("phone")?.toString() || "",
  };

  const validation = createPerformerSchema.safeParse(rawData);

  if (!validation.success) {
    return {
      success: false,
      message: "Please correct the errors in the form.",
      fieldErrors: validation.error.flatten().fieldErrors,
    };
  }

  const { userId, adminPerformerId, name, phone } = validation.data;

  // 3. Resolve & Verify Acting Admin Performer
  const adminPerformerRes = await resolveActingAdminPerformer(
    adminUser.id,
    adminPerformerId,
  );
  if (adminPerformerRes.error) {
    return {
      success: false,
      message: adminPerformerRes.error,
      fieldErrors: {
        adminPerformerId: [adminPerformerRes.error],
      },
    };
  }
  const actingAdmin = adminPerformerRes.performer;

  try {
    // 4. Ensure target User account exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return {
        success: false,
        message: "The specified role station account could not be found.",
      };
    }

    // 5. Check for duplicate phone under the same role desk
    const existingPerformerSamePhone = await prisma.performer.findFirst({
      where: {
        userId,
        phone,
      },
    });

    if (existingPerformerSamePhone) {
      return {
        success: false,
        message: `A staff member with phone number "${phone}" is already registered under this station desk.`,
        fieldErrors: {
          phone: [
            "This phone number is already registered for this role desk.",
          ],
        },
      };
    }

    // 6. Create Performer Record
    const newPerformer = await prisma.performer.create({
      data: {
        name,
        phone,
        userId,
      },
    });

    // 7. Record Immutable Audit Log with Performer Attribution
    await logAudit({
      action: AuditAction.PERFORMER_CREATE,
      status: AuditStatus.SUCCESS,
      userId: adminUser.id,
      performerId: actingAdmin?.id || null,
      entity: "Performer",
      entityId: newPerformer.id,
      details: {
        type: "PERFORMER_CREATED",
        name: newPerformer.name,
        phone: newPerformer.phone,
        targetRole: targetUser.role,
        targetUserId: targetUser.id,
        performedBy: actingAdmin
          ? {
              id: actingAdmin.id,
              name: actingAdmin.name,
              phone: actingAdmin.phone,
            }
          : { rootAdmin: true },
      },
    });

    // 8. Revalidate Admin User Management, Overview & Audit Log
    revalidatePath("/admin/users");
    revalidatePath("/admin/audit");
    revalidatePath("/admin");

    return {
      success: true,
      message: `Staff member "${name}" successfully added to ${targetUser.role} desk${
        actingAdmin ? ` by ${actingAdmin.name}` : ""
      }.`,
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
      performerId: actingAdmin?.id || null,
      entity: "Performer",
      details: {
        type: "PERFORMER_CREATE_FAILED",
        name,
        phone,
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
  adminPerformerId?: string,
): Promise<PerformerActionState> {
  const { user: adminUser } = await requireAuth(Role.ADMIN);

  const validation = deletePerformerSchema.safeParse({
    performerId,
    adminPerformerId,
  });
  if (!validation.success) {
    return {
      success: false,
      message: "Invalid performer details provided.",
    };
  }

  // Resolve & Verify Acting Admin Performer
  const adminPerformerRes = await resolveActingAdminPerformer(
    adminUser.id,
    adminPerformerId,
  );
  if (adminPerformerRes.error) {
    return {
      success: false,
      message: adminPerformerRes.error,
    };
  }
  const actingAdmin = adminPerformerRes.performer;

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
      performerId: actingAdmin?.id || null,
      entity: "Performer",
      entityId: performerId,
      details: {
        type: "PERFORMER_DELETED",
        name: existingPerformer.name,
        phone: existingPerformer.phone,
        role: existingPerformer.user.role,
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
      message: `Staff member "${existingPerformer.name}" has been removed${
        actingAdmin ? ` by ${actingAdmin.name}` : ""
      }.`,
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
