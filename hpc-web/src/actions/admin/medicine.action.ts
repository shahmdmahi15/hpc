"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/guard";
import { Role, AuditAction, AuditStatus } from "@/generated/prisma/enums";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { emitRealtimeEvent } from "@/lib/realtime/event-bus";
import { seedDgdaMedicines, type MedicineSeedResult } from "@/lib/medicine-seeder";

export interface CreateMedicineInput {
  name: string; // Mandatory
  genericName?: string;
  strength?: string;
  form?: string;
  company?: string;
  defaultMealTiming?: "BEFORE" | "AFTER";
  defaultTimes?: string[]; // e.g. ["MORNING", "NIGHT"]
  defaultDuration?: string;
  instructions?: string;
}

export interface UpdateMedicineInput extends CreateMedicineInput {
  id: string;
  isActive?: boolean;
}

export interface GetMedicinesParams {
  query?: string;
  form?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

/**
 * Retrieves the medicine catalog with optional search, form filtering, and pagination.
 */
export async function getAdminMedicinesListAction(params: GetMedicinesParams = {}) {
  try {
    await requireAuth([Role.ADMIN, Role.DOCTOR]);

    const { query = "", form, isActive, page = 1, limit = 100 } = params;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.trim()) {
      const q = query.trim();
      where.OR = [
        { name: { contains: q } },
        { genericName: { contains: q } },
        { company: { contains: q } },
        { strength: { contains: q } },
      ];
    }

    if (form && form !== "ALL") {
      where.form = form;
    }

    if (typeof isActive === "boolean") {
      where.isActive = isActive;
    }

    const [medicines, totalCount, activeCount, inactiveCount] = await Promise.all([
      prisma.medicine.findMany({
        where,
        orderBy: [{ order: "asc" }, { name: "asc" }],
        skip,
        take: limit,
      }),
      prisma.medicine.count({ where }),
      prisma.medicine.count({ where: { isActive: true } }),
      prisma.medicine.count({ where: { isActive: false } }),
    ]);

    return {
      success: true,
      medicines,
      totalCount,
      activeCount,
      inactiveCount,
      page,
      totalPages: Math.ceil(totalCount / limit),
    };
  } catch (error: any) {
    console.error("[Get Admin Medicines Error]:", error);
    return {
      success: false,
      medicines: [],
      totalCount: 0,
      activeCount: 0,
      inactiveCount: 0,
      page: 1,
      totalPages: 1,
      message: error?.message || "Failed to load medicine directory.",
    };
  }
}

/**
 * Creates a new medicine entry in the clinic master directory.
 * Name is mandatory; other fields are optional.
 */
export async function createMedicineAction(input: CreateMedicineInput) {
  try {
    const { session, user } = await requireAuth([Role.ADMIN]);

    const trimmedName = input.name?.trim();
    if (!trimmedName) {
      return {
        success: false,
        message: "Medicine Name is mandatory.",
      };
    }

    // Check duplicate name
    const existing = await prisma.medicine.findFirst({
      where: {
        name: { equals: trimmedName },
      },
    });

    if (existing) {
      return {
        success: false,
        message: `Medicine with name "${trimmedName}" already exists in directory.`,
      };
    }

    const created = await prisma.medicine.create({
      data: {
        name: trimmedName,
        genericName: input.genericName?.trim() || null,
        strength: input.strength?.trim() || null,
        form: input.form?.trim() || "Tablet",
        company: input.company?.trim() || null,
        defaultMealTiming: input.defaultMealTiming || "AFTER",
        defaultTimes: JSON.stringify(input.defaultTimes || ["MORNING", "NIGHT"]),
        defaultDuration: input.defaultDuration?.trim() || "7 days",
        instructions: input.instructions?.trim() || null,
        isActive: true,
      },
    });

    await logAudit({
      userId: user.id,
      action: AuditAction.MEDICINE_CREATE,
      status: AuditStatus.SUCCESS,
      entity: "Medicine",
      entityId: created.id,
      details: `Created medicine: ${created.name} (${created.form || "Medicine"})`,
      ipAddress: session.ipAddress || undefined,
      userAgent: session.userAgent || undefined,
    });

    emitRealtimeEvent("MEDICINE_CREATED", {
      id: created.id,
      name: created.name,
    });

    revalidatePath("/admin/medicines");
    revalidatePath("/doctor");

    return {
      success: true,
      data: created,
      message: `Medicine "${created.name}" added to directory successfully!`,
    };
  } catch (error: any) {
    console.error("[Create Medicine Error]:", error);
    return {
      success: false,
      message: error?.message || "Failed to create medicine.",
    };
  }
}

/**
 * Updates an existing medicine entry.
 */
export async function updateMedicineAction(input: UpdateMedicineInput) {
  try {
    const { session, user } = await requireAuth([Role.ADMIN]);

    const trimmedName = input.name?.trim();
    if (!trimmedName) {
      return {
        success: false,
        message: "Medicine Name is mandatory.",
      };
    }

    // Check existing
    const existing = await prisma.medicine.findUnique({
      where: { id: input.id },
    });

    if (!existing) {
      return {
        success: false,
        message: "Medicine not found.",
      };
    }

    // Check duplicate name on another record
    const duplicate = await prisma.medicine.findFirst({
      where: {
        id: { not: input.id },
        name: { equals: trimmedName },
      },
    });

    if (duplicate) {
      return {
        success: false,
        message: `Another medicine already exists with name "${trimmedName}".`,
      };
    }

    const updated = await prisma.medicine.update({
      where: { id: input.id },
      data: {
        name: trimmedName,
        genericName: input.genericName?.trim() || null,
        strength: input.strength?.trim() || null,
        form: input.form?.trim() || "Tablet",
        company: input.company?.trim() || null,
        defaultMealTiming: input.defaultMealTiming || "AFTER",
        defaultTimes: input.defaultTimes
          ? JSON.stringify(input.defaultTimes)
          : existing.defaultTimes,
        defaultDuration: input.defaultDuration?.trim() || "7 days",
        instructions: input.instructions?.trim() || null,
        isActive: typeof input.isActive === "boolean" ? input.isActive : existing.isActive,
      },
    });

    await logAudit({
      userId: user.id,
      action: AuditAction.MEDICINE_UPDATE,
      status: AuditStatus.SUCCESS,
      entity: "Medicine",
      entityId: updated.id,
      details: `Updated medicine: ${updated.name}`,
      ipAddress: session.ipAddress || undefined,
      userAgent: session.userAgent || undefined,
    });

    emitRealtimeEvent("MEDICINE_UPDATED", {
      id: updated.id,
      name: updated.name,
    });

    revalidatePath("/admin/medicines");
    revalidatePath("/doctor");

    return {
      success: true,
      data: updated,
      message: `Medicine "${updated.name}" updated successfully!`,
    };
  } catch (error: any) {
    console.error("[Update Medicine Error]:", error);
    return {
      success: false,
      message: error?.message || "Failed to update medicine.",
    };
  }
}

/**
 * Toggles a medicine's active status.
 */
export async function toggleMedicineStatusAction(id: string, isActive: boolean) {
  try {
    const { session, user } = await requireAuth([Role.ADMIN]);

    const updated = await prisma.medicine.update({
      where: { id },
      data: { isActive },
    });

    await logAudit({
      userId: user.id,
      action: AuditAction.MEDICINE_UPDATE,
      status: AuditStatus.SUCCESS,
      entity: "Medicine",
      entityId: updated.id,
      details: `${isActive ? "Activated" : "Deactivated"} medicine: ${updated.name}`,
      ipAddress: session.ipAddress || undefined,
      userAgent: session.userAgent || undefined,
    });

    emitRealtimeEvent("MEDICINE_UPDATED", {
      id: updated.id,
      name: updated.name,
      isActive,
    });

    revalidatePath("/admin/medicines");
    revalidatePath("/doctor");

    return {
      success: true,
      message: `Medicine "${updated.name}" is now ${isActive ? "Active" : "Inactive"}.`,
    };
  } catch (error: any) {
    console.error("[Toggle Medicine Status Error]:", error);
    return {
      success: false,
      message: error?.message || "Failed to update medicine status.",
    };
  }
}

/**
 * Deletes a medicine from the directory.
 */
export async function deleteMedicineAction(id: string) {
  try {
    const { session, user } = await requireAuth([Role.ADMIN]);

    const existing = await prisma.medicine.findUnique({
      where: { id },
    });

    if (!existing) {
      return {
        success: false,
        message: "Medicine not found.",
      };
    }

    await prisma.medicine.delete({
      where: { id },
    });

    await logAudit({
      userId: user.id,
      action: AuditAction.MEDICINE_DELETE,
      status: AuditStatus.SUCCESS,
      entity: "Medicine",
      entityId: id,
      details: `Deleted medicine: ${existing.name}`,
      ipAddress: session.ipAddress || undefined,
      userAgent: session.userAgent || undefined,
    });

    emitRealtimeEvent("MEDICINE_DELETED", {
      id,
      name: existing.name,
    });

    revalidatePath("/admin/medicines");
    revalidatePath("/doctor");

    return {
      success: true,
      message: `Medicine "${existing.name}" deleted successfully.`,
    };
  } catch (error: any) {
    console.error("[Delete Medicine Error]:", error);
    return {
      success: false,
      message: error?.message || "Failed to delete medicine.",
    };
  }
}

/**
 * Seeds a standard library of pain management, physical therapy, and orthopaedic medicines.
 */
export async function seedDefaultMedicinesAction() {
  try {
    const { session, user } = await requireAuth([Role.ADMIN]);

    const DEFAULT_CATALOG = [
      {
        name: "Tab. Aceclofenac 100mg",
        genericName: "Aceclofenac",
        strength: "100mg",
        form: "Tablet",
        company: "Square Pharmaceuticals",
        defaultMealTiming: "AFTER",
        defaultTimes: ["MORNING", "NIGHT"],
        defaultDuration: "7 days",
        instructions: "Take after full meal with water.",
      },
      {
        name: "Tab. Ace Plus 500mg/65mg",
        genericName: "Paracetamol + Caffeine",
        strength: "500mg/65mg",
        form: "Tablet",
        company: "Square Pharmaceuticals",
        defaultMealTiming: "AFTER",
        defaultTimes: ["MORNING", "AFTERNOON", "NIGHT"],
        defaultDuration: "5 days",
        instructions: "Take for pain/fever after meal.",
      },
      {
        name: "Tab. Napa Extend 665mg",
        genericName: "Paracetamol XR",
        strength: "665mg",
        form: "Tablet",
        company: "Beximco Pharma",
        defaultMealTiming: "AFTER",
        defaultTimes: ["MORNING", "NIGHT"],
        defaultDuration: "7 days",
        instructions: "Swallow whole, do not crush.",
      },
      {
        name: "Tab. Tolperisone 50mg",
        genericName: "Tolperisone Hydrochloride",
        strength: "50mg",
        form: "Tablet",
        company: "Incepta Pharmaceuticals",
        defaultMealTiming: "AFTER",
        defaultTimes: ["MORNING", "NIGHT"],
        defaultDuration: "7 days",
        instructions: "Muscle relaxant, take after meal.",
      },
      {
        name: "Tab. Tolperisone 150mg",
        genericName: "Tolperisone Hydrochloride",
        strength: "150mg",
        form: "Tablet",
        company: "Incepta Pharmaceuticals",
        defaultMealTiming: "AFTER",
        defaultTimes: ["MORNING", "NIGHT"],
        defaultDuration: "10 days",
        instructions: "Muscle relaxant, take after food.",
      },
      {
        name: "Tab. Baclofen 10mg",
        genericName: "Baclofen",
        strength: "10mg",
        form: "Tablet",
        company: "Square Pharmaceuticals",
        defaultMealTiming: "AFTER",
        defaultTimes: ["MORNING", "NIGHT"],
        defaultDuration: "14 days",
        instructions: "For skeletal muscle spasm and spinal stiffness.",
      },
      {
        name: "Cap. Pregabalin 50mg",
        genericName: "Pregabalin",
        strength: "50mg",
        form: "Capsule",
        company: "Beximco Pharma",
        defaultMealTiming: "AFTER",
        defaultTimes: ["NIGHT"],
        defaultDuration: "14 days",
        instructions: "For neuropathic radiating pain, take at bedtime.",
      },
      {
        name: "Cap. Pregabalin 75mg",
        genericName: "Pregabalin",
        strength: "75mg",
        form: "Capsule",
        company: "Beximco Pharma",
        defaultMealTiming: "AFTER",
        defaultTimes: ["NIGHT"],
        defaultDuration: "14 days",
        instructions: "Neuropathic pain, take at night.",
      },
      {
        name: "Cap. Gabapentin 300mg",
        genericName: "Gabapentin",
        strength: "300mg",
        form: "Capsule",
        company: "Renata Limited",
        defaultMealTiming: "AFTER",
        defaultTimes: ["NIGHT"],
        defaultDuration: "14 days",
        instructions: "Radiculopathy and nerve compression.",
      },
      {
        name: "Tab. Naproxen 500mg + Esomeprazole 20mg",
        genericName: "Naproxen + Esomeprazole",
        strength: "500mg+20mg",
        form: "Tablet",
        company: "Incepta Pharmaceuticals",
        defaultMealTiming: "AFTER",
        defaultTimes: ["MORNING", "NIGHT"],
        defaultDuration: "7 days",
        instructions: "Take 30 minutes after meal.",
      },
      {
        name: "Cap. Maxpro 20mg",
        genericName: "Esomeprazole",
        strength: "20mg",
        form: "Capsule",
        company: "Renata Limited",
        defaultMealTiming: "BEFORE",
        defaultTimes: ["MORNING", "NIGHT"],
        defaultDuration: "14 days",
        instructions: "Take 20-30 minutes before meal.",
      },
      {
        name: "Tab. Pantoprazole 20mg",
        genericName: "Pantoprazole",
        strength: "20mg",
        form: "Tablet",
        company: "Square Pharmaceuticals",
        defaultMealTiming: "BEFORE",
        defaultTimes: ["MORNING"],
        defaultDuration: "14 days",
        instructions: "Take 30 mins before breakfast.",
      },
      {
        name: "Tab. Etoricoxib 60mg",
        genericName: "Etoricoxib",
        strength: "60mg",
        form: "Tablet",
        company: "Square Pharmaceuticals",
        defaultMealTiming: "AFTER",
        defaultTimes: ["MORNING"],
        defaultDuration: "7 days",
        instructions: "Selective COX-2 inhibitor, take once daily.",
      },
      {
        name: "Tab. Etoricoxib 90mg",
        genericName: "Etoricoxib",
        strength: "90mg",
        form: "Tablet",
        company: "Square Pharmaceuticals",
        defaultMealTiming: "AFTER",
        defaultTimes: ["MORNING"],
        defaultDuration: "7 days",
        instructions: "Severe inflammatory arthritis and acute back pain.",
      },
      {
        name: "Tab. Calcium Carbonate 500mg + Vit D3",
        genericName: "Calcium + Vitamin D3",
        strength: "500mg+200IU",
        form: "Tablet",
        company: "Radiant Pharma",
        defaultMealTiming: "AFTER",
        defaultTimes: ["MORNING"],
        defaultDuration: "30 days",
        instructions: "Bone mineral support, take after breakfast.",
      },
      {
        name: "Tab. Neuro-B (B1+B6+B12)",
        genericName: "Vitamin B1+B6+B12",
        strength: "Standard",
        form: "Tablet",
        company: "Square Pharmaceuticals",
        defaultMealTiming: "AFTER",
        defaultTimes: ["MORNING", "NIGHT"],
        defaultDuration: "30 days",
        instructions: "Nerve regeneration and neuropathy support.",
      },
      {
        name: "Tab. Methylcobalamin 500mcg",
        genericName: "Methylcobalamin",
        strength: "500mcg",
        form: "Tablet",
        company: "Incepta Pharmaceuticals",
        defaultMealTiming: "AFTER",
        defaultTimes: ["MORNING"],
        defaultDuration: "30 days",
        instructions: "Peripheral nerve health.",
      },
      {
        name: "Gel Diclofenac Sodium 1%",
        genericName: "Diclofenac Sodium Gel",
        strength: "1%",
        form: "Gel",
        company: "Square Pharmaceuticals",
        defaultMealTiming: "AFTER",
        defaultTimes: ["MORNING", "NIGHT"],
        defaultDuration: "10 days",
        instructions: "Gently apply on affected painful area 2-3 times daily.",
      },
      {
        name: "Spray Fast Relief Pain Spray",
        genericName: "Pain Relief Spray",
        strength: "50g",
        form: "Spray",
        company: "Emami / HPC",
        defaultMealTiming: "AFTER",
        defaultTimes: ["MORNING", "NIGHT"],
        defaultDuration: "7 days",
        instructions: "Spray from 5cm distance on affected joint/muscle.",
      },
      {
        name: "Tab. Deflazacort 6mg",
        genericName: "Deflazacort",
        strength: "6mg",
        form: "Tablet",
        company: "Square Pharmaceuticals",
        defaultMealTiming: "AFTER",
        defaultTimes: ["MORNING"],
        defaultDuration: "5 days",
        instructions: "Anti-inflammatory steroid, take after breakfast.",
      },
      {
        name: "Tab. Tramadol 37.5mg + Paracetamol 325mg",
        genericName: "Tramadol + Paracetamol",
        strength: "37.5mg+325mg",
        form: "Tablet",
        company: "Beximco Pharma",
        defaultMealTiming: "AFTER",
        defaultTimes: ["NIGHT"],
        defaultDuration: "3 days",
        instructions: "For severe acute refractory breakthrough pain only.",
      },
      {
        name: "Tab. Glucosamine 250mg + Chondroitin 200mg",
        genericName: "Glucosamine + Chondroitin",
        strength: "250mg+200mg",
        form: "Tablet",
        company: "ACI Pharmaceuticals",
        defaultMealTiming: "AFTER",
        defaultTimes: ["MORNING", "NIGHT"],
        defaultDuration: "30 days",
        instructions: "Cartilage protection for osteoarthritis.",
      },
    ];

    let inserted = 0;
    for (const item of DEFAULT_CATALOG) {
      const exists = await prisma.medicine.findFirst({
        where: { name: { equals: item.name } },
      });
      if (!exists) {
        await prisma.medicine.create({
          data: {
            name: item.name,
            genericName: item.genericName,
            strength: item.strength,
            form: item.form,
            company: item.company,
            defaultMealTiming: item.defaultMealTiming,
            defaultTimes: JSON.stringify(item.defaultTimes),
            defaultDuration: item.defaultDuration,
            instructions: item.instructions,
            isActive: true,
          },
        });
        inserted++;
      }
    }

    await logAudit({
      userId: user.id,
      action: AuditAction.MEDICINE_SEED,
      status: AuditStatus.SUCCESS,
      entity: "Medicine",
      details: `Seeded ${inserted} default clinical medicines into directory`,
      ipAddress: session.ipAddress || undefined,
      userAgent: session.userAgent || undefined,
    });

    emitRealtimeEvent("MEDICINE_CREATED", {
      count: inserted,
    });

    revalidatePath("/admin/medicines");
    revalidatePath("/doctor");

    return {
      success: true,
      message: `Successfully seeded ${inserted} clinical medicines into the directory!`,
    };
  } catch (error: any) {
    console.error("[Seed Default Medicines Error]:", error);
    return {
      success: false,
      message: error?.message || "Failed to seed medicines.",
    };
  }
}

/**
 * Seeds the comprehensive DGDA Bangladesh national drug catalog (dgda.csv and medicine_information_export.csv).
 */
export async function seedDgdaMedicinesAction(
  mode: "all" | "generics" | "brands" = "all"
): Promise<MedicineSeedResult> {
  try {
    const { session, user } = await requireAuth([Role.ADMIN]);

    const result = seedDgdaMedicines(undefined, mode);

    await logAudit({
      userId: user.id,
      action: AuditAction.MEDICINE_SEED,
      status: AuditStatus.SUCCESS,
      entity: "Medicine",
      details: `DGDA Bangladesh Seeding (${mode}): ${result.message}`,
      ipAddress: session.ipAddress || undefined,
      userAgent: session.userAgent || undefined,
    });

    emitRealtimeEvent("MEDICINE_CREATED", {
      count: result.totalInserted,
      mode,
    });

    revalidatePath("/admin/medicines");
    revalidatePath("/doctor");

    return result;
  } catch (error: any) {
    console.error("[DGDA Medicine Seed Error]:", error);
    return {
      success: false,
      insertedGenerics: 0,
      insertedBrands: 0,
      totalInserted: 0,
      totalInDatabase: 0,
      durationMs: 0,
      message: error?.message || "Failed to seed DGDA medicines.",
    };
  }
}
