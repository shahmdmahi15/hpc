"use server";

import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/guard";
import {
  Role,
  AuditAction,
  AuditStatus,
  SlotStatus,
} from "@/generated/prisma/enums";
import type { TherapySlot, Room } from "@/generated/prisma/client";
import {
  createTherapySlotSchema,
  updateTherapySlotSchema,
  deleteTherapySlotSchema,
  toggleTherapySlotActiveSchema,
  updateTherapySlotStatusSchema,
  type CreateTherapySlotInput,
  type UpdateTherapySlotInput,
  type DeleteTherapySlotInput,
  type ToggleTherapySlotActiveInput,
  type UpdateTherapySlotStatusInput,
  type SlotActionState,
} from "@/schemas/admin/slot.schema";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { resolveActingAdminPerformer } from "@/actions/admin/admin-performer-guard";

// --------------------------------------------------------
// TYPES
// --------------------------------------------------------

export interface TherapySlotWithDetails extends TherapySlot {
  room: Room | null;
  _count?: {
    appointments: number;
  };
}

export interface SlotMasterStats {
  totalSlots: number;
  activeSlots: number;
  totalRegularCapacity: number;
  totalRegularMale: number;
  totalRegularFemale: number;
  totalExtraCapacity: number;
  totalExtraMale: number;
  totalExtraFemale: number;
}

export interface AdminTherapySlotsPageData {
  slots: TherapySlotWithDetails[];
  rooms: Room[];
  adminPerformers: { id: string; name: string; phone: string }[];
  stats: SlotMasterStats;
}

// --------------------------------------------------------
// DATA FETCHING ACTION
// --------------------------------------------------------

export async function getAdminTherapySlotsPageDataAction(): Promise<AdminTherapySlotsPageData> {
  await requireAuth(Role.ADMIN);

  const [rawSlots, rooms, adminPerformers] = await Promise.all([
    prisma.therapySlot.findMany({
      orderBy: [{ order: "asc" }, { startTime: "asc" }],
      include: {
        room: true,
        _count: {
          select: { appointments: true },
        },
      },
    }),
    prisma.room.findMany({
      orderBy: { number: "asc" },
    }),
    prisma.performer.findMany({
      where: {
        user: { role: Role.ADMIN },
      },
      select: { id: true, name: true, phone: true },
      orderBy: { name: "asc" },
    }),
  ]);

  let totalRegularMale = 0;
  let totalRegularFemale = 0;
  let totalExtraMale = 0;
  let totalExtraFemale = 0;
  let activeSlots = 0;

  for (const s of rawSlots) {
    if (s.isActive) activeSlots++;
    totalRegularMale += s.regularMaleCapacity;
    totalRegularFemale += s.regularFemaleCapacity;
    totalExtraMale += s.extraMaleCapacity;
    totalExtraFemale += s.extraFemaleCapacity;
  }

  const stats: SlotMasterStats = {
    totalSlots: rawSlots.length,
    activeSlots,
    totalRegularCapacity: totalRegularMale + totalRegularFemale,
    totalRegularMale,
    totalRegularFemale,
    totalExtraCapacity: totalExtraMale + totalExtraFemale,
    totalExtraMale,
    totalExtraFemale,
  };

  return {
    slots: rawSlots,
    rooms,
    adminPerformers,
    stats,
  };
}

// --------------------------------------------------------
// CREATE PREDEFINED THERAPY SLOT
// --------------------------------------------------------

export async function createTherapySlotAction(
  rawInput: CreateTherapySlotInput,
): Promise<SlotActionState> {
  try {
    const { user: adminUser } = await requireAuth(Role.ADMIN);

    const parsed = createTherapySlotSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        message: "Invalid slot input parameters.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const {
      label,
      startTime,
      endTime,
      order,
      regularMaleCapacity,
      regularFemaleCapacity,
      extraMaleCapacity,
      extraFemaleCapacity,
      roomId,
      status,
      isActive,
      weekDays,
      adminPerformerId,
    } = parsed.data;

    const resolved = await resolveActingAdminPerformer(
      adminUser.id,
      adminPerformerId,
    );

    if (resolved.error) {
      return {
        success: false,
        message: resolved.error,
      };
    }

    const actingPerformer = resolved.performer;

    // Check conflict by time and room overlap
    const existingOverlaps = await prisma.therapySlot.findFirst({
      where: {
        startTime,
        endTime,
        roomId: roomId || null,
        weekDays: weekDays || "ALL",
      },
    });

    if (existingOverlaps) {
      return {
        success: false,
        message: `A slot from ${startTime} to ${endTime} already exists for this schedule${
          roomId ? " and room" : ""
        }.`,
      };
    }

    const createdSlot = await prisma.therapySlot.create({
      data: {
        label,
        startTime,
        endTime,
        order,
        regularMaleCapacity,
        regularFemaleCapacity,
        extraMaleCapacity,
        extraFemaleCapacity,
        roomId: roomId || null,
        status,
        isActive,
        weekDays: weekDays || "ALL",
      },
      include: { room: true },
    });

    await logAudit({
      userId: adminUser.id,
      performerId: actingPerformer?.id,
      action: AuditAction.THERAPY_SLOT_CREATE,
      entity: "TherapySlot",
      entityId: createdSlot.id,
      status: AuditStatus.SUCCESS,
      details: {
        label: createdSlot.label,
        startTime: createdSlot.startTime,
        endTime: createdSlot.endTime,
        weekDays: createdSlot.weekDays,
        regularCapacity: `${regularMaleCapacity}M / ${regularFemaleCapacity}F`,
        extraCapacity: `${extraMaleCapacity}M / ${extraFemaleCapacity}F`,
        room: createdSlot.room
          ? `Room ${createdSlot.room.number} (${createdSlot.room.purpose})`
          : "Unassigned",
        actingAdminPerformer: actingPerformer
          ? `${actingPerformer.name} (${actingPerformer.phone})`
          : "System Admin",
      },
    });

    revalidatePath("/admin/slots");
    revalidatePath("/admin");

    return {
      success: true,
      message: `Therapy slot "${label}" (${startTime} - ${endTime}) created successfully.`,
    };
  } catch (error: any) {
    console.error("[Create Slot Action Error]:", error);
    return {
      success: false,
      message: error?.message || "Failed to create therapy slot.",
    };
  }
}

// --------------------------------------------------------
// UPDATE PREDEFINED THERAPY SLOT
// --------------------------------------------------------

export async function updateTherapySlotAction(
  rawInput: UpdateTherapySlotInput,
): Promise<SlotActionState> {
  try {
    const { user: adminUser } = await requireAuth(Role.ADMIN);

    const parsed = updateTherapySlotSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        message: "Invalid update parameters.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const {
      slotId,
      label,
      startTime,
      endTime,
      order,
      regularMaleCapacity,
      regularFemaleCapacity,
      extraMaleCapacity,
      extraFemaleCapacity,
      roomId,
      status,
      isActive,
      weekDays,
      adminPerformerId,
    } = parsed.data;

    const existingSlot = await prisma.therapySlot.findUnique({
      where: { id: slotId },
      include: { room: true },
    });

    if (!existingSlot) {
      return {
        success: false,
        message: "Therapy slot not found.",
      };
    }

    const resolved = await resolveActingAdminPerformer(
      adminUser.id,
      adminPerformerId,
    );

    if (resolved.error) {
      return {
        success: false,
        message: resolved.error,
      };
    }

    const actingPerformer = resolved.performer;

    const updated = await prisma.therapySlot.update({
      where: { id: slotId },
      data: {
        label,
        startTime,
        endTime,
        order,
        regularMaleCapacity,
        regularFemaleCapacity,
        extraMaleCapacity,
        extraFemaleCapacity,
        roomId: roomId || null,
        status,
        isActive,
        weekDays: weekDays || "ALL",
      },
      include: { room: true },
    });

    await logAudit({
      userId: adminUser.id,
      performerId: actingPerformer?.id,
      action: AuditAction.THERAPY_SLOT_UPDATE,
      entity: "TherapySlot",
      entityId: updated.id,
      status: AuditStatus.SUCCESS,
      details: {
        label: updated.label,
        startTime: updated.startTime,
        endTime: updated.endTime,
        status: updated.status,
        isActive: updated.isActive,
        weekDays: updated.weekDays,
        previous: {
          label: existingSlot.label,
          startTime: existingSlot.startTime,
          endTime: existingSlot.endTime,
          weekDays: existingSlot.weekDays,
          regularCapacity: `${existingSlot.regularMaleCapacity}M/${existingSlot.regularFemaleCapacity}F`,
        },
        actingAdminPerformer: actingPerformer
          ? `${actingPerformer.name} (${actingPerformer.phone})`
          : "System Admin",
      },
    });

    revalidatePath("/admin/slots");
    revalidatePath("/admin");

    return {
      success: true,
      message: `Therapy slot "${updated.label}" updated successfully.`,
    };
  } catch (error: any) {
    console.error("[Update Slot Action Error]:", error);
    return {
      success: false,
      message: error?.message || "Failed to update therapy slot.",
    };
  }
}

// --------------------------------------------------------
// TOGGLE ACTIVE STATE
// --------------------------------------------------------

export async function toggleTherapySlotActiveAction(
  rawInput: ToggleTherapySlotActiveInput,
): Promise<SlotActionState> {
  try {
    const { user: adminUser } = await requireAuth(Role.ADMIN);

    const parsed = toggleTherapySlotActiveSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        message: "Invalid input parameters.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const { slotId, isActive, adminPerformerId } = parsed.data;

    const existingSlot = await prisma.therapySlot.findUnique({
      where: { id: slotId },
    });

    if (!existingSlot) {
      return {
        success: false,
        message: "Therapy slot not found.",
      };
    }

    const resolved = await resolveActingAdminPerformer(
      adminUser.id,
      adminPerformerId,
    );

    if (resolved.error) {
      return {
        success: false,
        message: resolved.error,
      };
    }

    const actingPerformer = resolved.performer;

    const updated = await prisma.therapySlot.update({
      where: { id: slotId },
      data: { isActive },
    });

    await logAudit({
      userId: adminUser.id,
      performerId: actingPerformer?.id,
      action: AuditAction.THERAPY_SLOT_STATUS_CHANGE,
      entity: "TherapySlot",
      entityId: updated.id,
      status: AuditStatus.SUCCESS,
      details: {
        label: updated.label,
        isActive,
        actingAdminPerformer: actingPerformer
          ? `${actingPerformer.name} (${actingPerformer.phone})`
          : "System Admin",
      },
    });

    revalidatePath("/admin/slots");
    revalidatePath("/admin");

    return {
      success: true,
      message: `Therapy slot "${updated.label}" is now ${isActive ? "Active" : "Inactive"}.`,
    };
  } catch (error: any) {
    console.error("[Toggle Active Action Error]:", error);
    return {
      success: false,
      message: error?.message || "Failed to toggle slot active status.",
    };
  }
}

// --------------------------------------------------------
// QUICK UPDATE STATUS (OPEN / BLOCKED / CANCELLED)
// --------------------------------------------------------

export async function updateTherapySlotStatusAction(
  rawInput: UpdateTherapySlotStatusInput,
): Promise<SlotActionState> {
  try {
    const { user: adminUser } = await requireAuth(Role.ADMIN);

    const parsed = updateTherapySlotStatusSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        message: "Invalid status parameters.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const { slotId, status, adminPerformerId } = parsed.data;

    const existingSlot = await prisma.therapySlot.findUnique({
      where: { id: slotId },
    });

    if (!existingSlot) {
      return {
        success: false,
        message: "Therapy slot not found.",
      };
    }

    const resolved = await resolveActingAdminPerformer(
      adminUser.id,
      adminPerformerId,
    );

    if (resolved.error) {
      return {
        success: false,
        message: resolved.error,
      };
    }

    const actingPerformer = resolved.performer;

    const updated = await prisma.therapySlot.update({
      where: { id: slotId },
      data: { status },
    });

    await logAudit({
      userId: adminUser.id,
      performerId: actingPerformer?.id,
      action: AuditAction.THERAPY_SLOT_STATUS_CHANGE,
      entity: "TherapySlot",
      entityId: updated.id,
      status: AuditStatus.SUCCESS,
      details: {
        label: updated.label,
        previousStatus: existingSlot.status,
        newStatus: status,
        actingAdminPerformer: actingPerformer
          ? `${actingPerformer.name} (${actingPerformer.phone})`
          : "System Admin",
      },
    });

    revalidatePath("/admin/slots");
    revalidatePath("/admin");

    return {
      success: true,
      message: `Therapy slot "${updated.label}" status changed to ${status}.`,
    };
  } catch (error: any) {
    console.error("[Update Slot Status Action Error]:", error);
    return {
      success: false,
      message: error?.message || "Failed to update slot status.",
    };
  }
}

// --------------------------------------------------------
// DELETE PREDEFINED THERAPY SLOT
// --------------------------------------------------------

export async function deleteTherapySlotAction(
  rawInput: DeleteTherapySlotInput,
): Promise<SlotActionState> {
  try {
    const { user: adminUser } = await requireAuth(Role.ADMIN);

    const parsed = deleteTherapySlotSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        message: "Invalid slot ID.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const { slotId, adminPerformerId } = parsed.data;

    const slot = await prisma.therapySlot.findUnique({
      where: { id: slotId },
      include: {
        _count: {
          select: { appointments: true },
        },
      },
    });

    if (!slot) {
      return {
        success: false,
        message: "Therapy slot not found.",
      };
    }

    if (slot._count.appointments > 0) {
      return {
        success: false,
        message: `Cannot delete this slot because it has ${slot._count.appointments} existing ticket bookings. You can deactivate it instead.`,
      };
    }

    const resolved = await resolveActingAdminPerformer(
      adminUser.id,
      adminPerformerId,
    );

    if (resolved.error) {
      return {
        success: false,
        message: resolved.error,
      };
    }

    const actingPerformer = resolved.performer;

    await prisma.therapySlot.delete({
      where: { id: slotId },
    });

    await logAudit({
      userId: adminUser.id,
      performerId: actingPerformer?.id,
      action: AuditAction.THERAPY_SLOT_DELETE,
      entity: "TherapySlot",
      entityId: slotId,
      status: AuditStatus.SUCCESS,
      details: {
        label: slot.label,
        startTime: slot.startTime,
        endTime: slot.endTime,
        actingAdminPerformer: actingPerformer
          ? `${actingPerformer.name} (${actingPerformer.phone})`
          : "System Admin",
      },
    });

    revalidatePath("/admin/slots");
    revalidatePath("/admin");

    return {
      success: true,
      message: `Therapy slot "${slot.label}" has been deleted.`,
    };
  } catch (error: any) {
    console.error("[Delete Slot Action Error]:", error);
    return {
      success: false,
      message: error?.message || "Failed to delete therapy slot.",
    };
  }
}

// --------------------------------------------------------
// SEED DEFAULT HOURLY SLOTS (10:00 AM to 08:00 PM)
// --------------------------------------------------------

export async function seedDefaultHourlySlotsAction(
  adminPerformerId?: string,
): Promise<SlotActionState> {
  try {
    const { user: adminUser } = await requireAuth(Role.ADMIN);

    const resolved = await resolveActingAdminPerformer(
      adminUser.id,
      adminPerformerId,
    );

    if (resolved.error) {
      return {
        success: false,
        message: resolved.error,
      };
    }

    const actingPerformer = resolved.performer;

    const defaultSlots = [
      {
        startTime: "10:00",
        endTime: "11:00",
        label: "10:00 AM - 11:00 AM",
        order: 1,
      },
      {
        startTime: "11:00",
        endTime: "12:00",
        label: "11:00 AM - 12:00 PM",
        order: 2,
      },
      {
        startTime: "12:00",
        endTime: "13:00",
        label: "12:00 PM - 01:00 PM",
        order: 3,
      },
      {
        startTime: "13:00",
        endTime: "14:00",
        label: "01:00 PM - 02:00 PM",
        order: 4,
      },
      {
        startTime: "14:00",
        endTime: "15:00",
        label: "02:00 PM - 03:00 PM",
        order: 5,
      },
      {
        startTime: "15:00",
        endTime: "16:00",
        label: "03:00 PM - 04:00 PM",
        order: 6,
      },
      {
        startTime: "16:00",
        endTime: "17:00",
        label: "04:00 PM - 05:00 PM",
        order: 7,
      },
      {
        startTime: "17:00",
        endTime: "18:00",
        label: "05:00 PM - 06:00 PM",
        order: 8,
      },
      {
        startTime: "18:00",
        endTime: "19:00",
        label: "06:00 PM - 07:00 PM",
        order: 9,
      },
      {
        startTime: "19:00",
        endTime: "20:00",
        label: "07:00 PM - 08:00 PM",
        order: 10,
      },
    ];

    let createdCount = 0;

    for (const item of defaultSlots) {
      const exists = await prisma.therapySlot.findFirst({
        where: {
          startTime: item.startTime,
          endTime: item.endTime,
        },
      });

      if (!exists) {
        await prisma.therapySlot.create({
          data: {
            label: item.label,
            startTime: item.startTime,
            endTime: item.endTime,
            order: item.order,
            regularMaleCapacity: 3,
            regularFemaleCapacity: 3,
            extraMaleCapacity: 1,
            extraFemaleCapacity: 1,
            status: SlotStatus.OPEN,
            isActive: true,
            weekDays: "ALL",
          },
        });
        createdCount++;
      }
    }

    await logAudit({
      userId: adminUser.id,
      performerId: actingPerformer?.id,
      action: AuditAction.THERAPY_SLOT_SEED,
      entity: "TherapySlot",
      status: AuditStatus.SUCCESS,
      details: {
        createdCount,
        totalDefaultBatched: defaultSlots.length,
        actingAdminPerformer: actingPerformer
          ? `${actingPerformer.name} (${actingPerformer.phone})`
          : "System Admin",
      },
    });

    revalidatePath("/admin/slots");
    revalidatePath("/admin");

    return {
      success: true,
      message:
        createdCount > 0
          ? `Standard hourly therapy slots seeded successfully (${createdCount} new slots created, 10:00 AM - 08:00 PM).`
          : "All 10 standard hourly therapy slots (10:00 AM - 08:00 PM) already exist in your schedule.",
    };
  } catch (error: any) {
    console.error("[Seed Default Slots Error]:", error);
    return {
      success: false,
      message: error?.message || "Failed to seed default hourly slots.",
    };
  }
}
