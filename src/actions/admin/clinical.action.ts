"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/guard";
import { Role, AuditAction, AuditStatus, ClinicalOptionCategory } from "@/generated/prisma/enums";
import { logAudit } from "@/lib/audit";
import {
  createClinicalOptionSchema,
  updateClinicalOptionSchema,
  type CreateClinicalOptionInput,
  type UpdateClinicalOptionInput,
  type ClinicalActionState,
} from "@/schemas/admin/clinical.schema";
import { revalidatePath } from "next/cache";

export async function getClinicalOptionsAction() {
  try {
    await requireAuth([Role.ADMIN, Role.DOCTOR]);

    const options = await prisma.clinicalOption.findMany({
      orderBy: [{ category: "asc" }, { order: "asc" }, { name: "asc" }],
    });

    return {
      success: true,
      options,
    };
  } catch (error) {
    console.error("[Get Clinical Options Error]:", error);
    return {
      success: false,
      options: [],
      message: "Failed to load clinical options.",
    };
  }
}

export async function createClinicalOptionAction(
  data: CreateClinicalOptionInput,
): Promise<ClinicalActionState> {
  try {
    const sessionData = await requireAuth([Role.ADMIN]);

    const parsed = createClinicalOptionSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false,
        message: "Invalid input data.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const { category, name, description, order } = parsed.data;

    // Check duplicate
    const existing = await prisma.clinicalOption.findFirst({
      where: { category, name: { equals: name.trim() } },
    });
    if (existing) {
      return {
        success: false,
        message: `An option named "${name}" already exists under this category.`,
      };
    }

    const created = await prisma.clinicalOption.create({
      data: {
        category,
        name: name.trim(),
        description: description?.trim() || null,
        order,
        isActive: true,
      },
    });

    await logAudit({
      userId: sessionData.user.id,
      action: AuditAction.ROOM_CREATE, // Use closest audit or generic
      entity: "ClinicalOption",
      entityId: created.id,
      status: AuditStatus.SUCCESS,
      details: {
        category: created.category,
        name: created.name,
      },
    });

    revalidatePath("/admin/clinical");
    revalidatePath("/doctor");

    return {
      success: true,
      message: `"${created.name}" created successfully.`,
    };
  } catch (error) {
    console.error("[Create Clinical Option Error]:", error);
    return {
      success: false,
      message: "Failed to create clinical option.",
    };
  }
}

export async function updateClinicalOptionAction(
  data: UpdateClinicalOptionInput,
): Promise<ClinicalActionState> {
  try {
    const sessionData = await requireAuth([Role.ADMIN]);

    const parsed = updateClinicalOptionSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false,
        message: "Invalid input data.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const { id, category, name, description, order, isActive } = parsed.data;

    const existing = await prisma.clinicalOption.findUnique({
      where: { id },
    });
    if (!existing) {
      return {
        success: false,
        message: "Clinical option not found.",
      };
    }

    const updated = await prisma.clinicalOption.update({
      where: { id },
      data: {
        category,
        name: name.trim(),
        description: description !== undefined ? (description?.trim() || null) : existing.description,
        order,
        ...(isActive !== undefined ? { isActive } : {}),
      },
    });

    await logAudit({
      userId: sessionData.user.id,
      action: AuditAction.ROOM_UPDATE,
      entity: "ClinicalOption",
      entityId: updated.id,
      status: AuditStatus.SUCCESS,
      details: {
        category: updated.category,
        name: updated.name,
        isActive: updated.isActive,
      },
    });

    revalidatePath("/admin/clinical");
    revalidatePath("/doctor");

    return {
      success: true,
      message: `"${updated.name}" updated successfully.`,
    };
  } catch (error) {
    console.error("[Update Clinical Option Error]:", error);
    return {
      success: false,
      message: "Failed to update clinical option.",
    };
  }
}

export async function toggleClinicalOptionStatusAction(
  id: string,
): Promise<ClinicalActionState> {
  try {
    const sessionData = await requireAuth([Role.ADMIN]);

    const existing = await prisma.clinicalOption.findUnique({
      where: { id },
    });
    if (!existing) {
      return {
        success: false,
        message: "Clinical option not found.",
      };
    }

    const newActiveState = !existing.isActive;
    const updated = await prisma.clinicalOption.update({
      where: { id },
      data: { isActive: newActiveState },
    });

    await logAudit({
      userId: sessionData.user.id,
      action: AuditAction.ROOM_STATUS_CHANGE,
      entity: "ClinicalOption",
      entityId: updated.id,
      status: AuditStatus.SUCCESS,
      details: {
        name: updated.name,
        isActive: updated.isActive,
      },
    });

    revalidatePath("/admin/clinical");
    revalidatePath("/doctor");

    return {
      success: true,
      message: `"${updated.name}" is now ${updated.isActive ? "Active" : "Disabled"}.`,
    };
  } catch (error) {
    console.error("[Toggle Clinical Option Error]:", error);
    return {
      success: false,
      message: "Failed to change option status.",
    };
  }
}

export async function deleteClinicalOptionAction(
  id: string,
): Promise<ClinicalActionState> {
  try {
    const sessionData = await requireAuth([Role.ADMIN]);

    const existing = await prisma.clinicalOption.findUnique({
      where: { id },
    });
    if (!existing) {
      return {
        success: false,
        message: "Clinical option not found.",
      };
    }

    await prisma.clinicalOption.delete({
      where: { id },
    });

    await logAudit({
      userId: sessionData.user.id,
      action: AuditAction.ROOM_DELETE,
      entity: "ClinicalOption",
      entityId: id,
      status: AuditStatus.SUCCESS,
      details: {
        name: existing.name,
        category: existing.category,
      },
    });

    revalidatePath("/admin/clinical");
    revalidatePath("/doctor");

    return {
      success: true,
      message: `"${existing.name}" deleted successfully.`,
    };
  } catch (error) {
    console.error("[Delete Clinical Option Error]:", error);
    return {
      success: false,
      message: "Failed to delete clinical option.",
    };
  }
}
