"use server";

import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/guard";
import {
  Role,
  AuditAction,
  AuditStatus,
  RoomAccessType,
  RoomGender,
  RoomStatus,
} from "@/generated/prisma/enums";
import type { Room } from "@/generated/prisma/client";
import {
  createRoomSchema,
  updateRoomSchema,
  updateRoomStatusSchema,
  deleteRoomSchema,
  type RoomActionState,
} from "@/schemas/admin/room.schema";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { resolveActingAdminPerformer } from "@/actions/admin/admin-performer-guard";

export interface RoomStats {
  total: number;
  available: number;
  occupied: number;
  maintenance: number;
  publicCount: number;
  staffCount: number;
  doctorCount: number;
  therapyCount?: number;
  privateCount?: number;
}

export interface AdminRoomsPageData {
  rooms: Room[];
  adminPerformers: { id: string; name: string; phone: string }[];
  stats: RoomStats;
}

/**
 * Fetches all hospital rooms, administrator staff performers, and telemetry metrics.
 * Strictly restricted to authenticated Administrators.
 */
export async function getAdminRoomsPageDataAction(): Promise<AdminRoomsPageData> {
  const { user: adminUser } = await requireAuth(Role.ADMIN);

  const [rooms, adminPerformers] = await Promise.all([
    prisma.room.findMany({
      orderBy: { number: "asc" },
    }),
    prisma.performer.findMany({
      where: { userId: adminUser.id },
      select: { id: true, name: true, phone: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const stats: RoomStats = {
    total: rooms.length,
    available: rooms.filter((r) => r.status === RoomStatus.AVAILABLE).length,
    occupied: rooms.filter((r) => r.status === RoomStatus.OCCUPIED).length,
    maintenance: rooms.filter((r) => r.status === RoomStatus.MAINTENANCE)
      .length,
    publicCount: rooms.filter((r) => r.accessType === RoomAccessType.PUBLIC)
      .length,
    staffCount: rooms.filter((r) => r.accessType === RoomAccessType.STAFF)
      .length,
    doctorCount: rooms.filter((r) => r.accessType === RoomAccessType.DOCTOR)
      .length,
    therapyCount: rooms.filter((r) => r.accessType === RoomAccessType.THERAPY)
      .length,
    privateCount: rooms.filter((r) => r.accessType === RoomAccessType.PRIVATE)
      .length,
  };

  return {
    rooms,
    adminPerformers,
    stats,
  };
}

/**
 * Creates a new physical hospital room or facility space.
 */
export async function createRoomAction(
  prevState: RoomActionState | undefined,
  formData: FormData,
): Promise<RoomActionState> {
  const { user: adminUser } = await requireAuth(Role.ADMIN);

  const rawData = {
    number: formData.get("number")?.toString() || "",
    purpose: formData.get("purpose")?.toString() || "",
    accessType: formData.get("accessType")?.toString() as RoomAccessType,
    gender: formData.get("gender")?.toString() as RoomGender,
    status:
      (formData.get("status")?.toString() as RoomStatus) ||
      RoomStatus.AVAILABLE,
    performerId: formData.get("performerId")?.toString() || undefined,
  };

  const validation = createRoomSchema.safeParse(rawData);

  if (!validation.success) {
    return {
      success: false,
      message: "Please correct the form validation errors.",
      fieldErrors: validation.error.flatten().fieldErrors,
    };
  }

  const { number, purpose, accessType, gender, status, performerId } =
    validation.data;

  // Resolve acting admin performer
  const adminPerformerRes = await resolveActingAdminPerformer(
    adminUser.id,
    performerId,
  );
  if (adminPerformerRes.error) {
    return {
      success: false,
      message: adminPerformerRes.error,
      fieldErrors: { performerId: [adminPerformerRes.error] },
    };
  }
  const actingAdmin = adminPerformerRes.performer;

  try {
    // Check if room number is unique
    const existing = await prisma.room.findUnique({
      where: { number },
    });

    if (existing) {
      return {
        success: false,
        message: `Room number "${number}" is already registered in the facility.`,
        fieldErrors: {
          number: [`Room number "${number}" already exists.`],
        },
      };
    }

    const createdRoom = await prisma.room.create({
      data: {
        number,
        purpose,
        accessType,
        gender,
        status,
      },
    });

    await logAudit({
      action: AuditAction.ROOM_CREATE,
      status: AuditStatus.SUCCESS,
      userId: adminUser.id,
      performerId: actingAdmin?.id,
      entity: "Room",
      entityId: createdRoom.id,
      details: {
        number: createdRoom.number,
        purpose: createdRoom.purpose,
        accessType: createdRoom.accessType,
        gender: createdRoom.gender,
        status: createdRoom.status,
        authorizer: actingAdmin
          ? `${actingAdmin.name} (${actingAdmin.phone})`
          : "System Root Admin",
      },
    });

    revalidatePath("/admin/rooms");
    revalidatePath("/admin");
    revalidatePath("/admin/audit");

    return {
      success: true,
      message: `Room "${createdRoom.number}" created successfully.`,
    };
  } catch (error) {
    console.error("[Create Room Error]:", error);
    return {
      success: false,
      message: "Failed to create room. Please try again.",
    };
  }
}

/**
 * Updates an existing room's configuration.
 */
export async function updateRoomAction(
  prevState: RoomActionState | undefined,
  formData: FormData,
): Promise<RoomActionState> {
  const { user: adminUser } = await requireAuth(Role.ADMIN);

  const rawData = {
    id: formData.get("id")?.toString() || "",
    number: formData.get("number")?.toString() || "",
    purpose: formData.get("purpose")?.toString() || "",
    accessType: formData.get("accessType")?.toString() as RoomAccessType,
    gender: formData.get("gender")?.toString() as RoomGender,
    status: formData.get("status")?.toString() as RoomStatus,
    performerId: formData.get("performerId")?.toString() || undefined,
  };

  const validation = updateRoomSchema.safeParse(rawData);

  if (!validation.success) {
    return {
      success: false,
      message: "Please correct the form validation errors.",
      fieldErrors: validation.error.flatten().fieldErrors,
    };
  }

  const { id, number, purpose, accessType, gender, status, performerId } =
    validation.data;

  // Resolve acting admin performer
  const adminPerformerRes = await resolveActingAdminPerformer(
    adminUser.id,
    performerId,
  );
  if (adminPerformerRes.error) {
    return {
      success: false,
      message: adminPerformerRes.error,
      fieldErrors: { performerId: [adminPerformerRes.error] },
    };
  }
  const actingAdmin = adminPerformerRes.performer;

  try {
    const existingRoom = await prisma.room.findUnique({
      where: { id },
    });

    if (!existingRoom) {
      return {
        success: false,
        message: "Room record was not found.",
      };
    }

    // Check if new number conflicts with another room
    if (number !== existingRoom.number) {
      const duplicate = await prisma.room.findUnique({
        where: { number },
      });
      if (duplicate) {
        return {
          success: false,
          message: `Room number "${number}" is already assigned to another room.`,
          fieldErrors: {
            number: [`Room number "${number}" is already in use.`],
          },
        };
      }
    }

    const updatedRoom = await prisma.room.update({
      where: { id },
      data: {
        number,
        purpose,
        accessType,
        gender,
        status,
      },
    });

    await logAudit({
      action: AuditAction.ROOM_UPDATE,
      status: AuditStatus.SUCCESS,
      userId: adminUser.id,
      performerId: actingAdmin?.id,
      entity: "Room",
      entityId: updatedRoom.id,
      details: {
        previous: {
          number: existingRoom.number,
          purpose: existingRoom.purpose,
          accessType: existingRoom.accessType,
          gender: existingRoom.gender,
          status: existingRoom.status,
        },
        current: {
          number: updatedRoom.number,
          purpose: updatedRoom.purpose,
          accessType: updatedRoom.accessType,
          gender: updatedRoom.gender,
          status: updatedRoom.status,
        },
        authorizer: actingAdmin
          ? `${actingAdmin.name} (${actingAdmin.phone})`
          : "System Root Admin",
      },
    });

    revalidatePath("/admin/rooms");
    revalidatePath("/admin");
    revalidatePath("/admin/audit");

    return {
      success: true,
      message: `Room "${updatedRoom.number}" updated successfully.`,
    };
  } catch (error) {
    console.error("[Update Room Error]:", error);
    return {
      success: false,
      message: "Failed to update room. Please try again.",
    };
  }
}

/**
 * Quick status switcher for room operational readiness.
 */
export async function updateRoomStatusAction(
  prevState: RoomActionState | undefined,
  formData: FormData,
): Promise<RoomActionState> {
  const { user: adminUser } = await requireAuth(Role.ADMIN);

  const rawData = {
    id: formData.get("id")?.toString() || "",
    status: formData.get("status")?.toString() as RoomStatus,
    performerId: formData.get("performerId")?.toString() || undefined,
  };

  const validation = updateRoomStatusSchema.safeParse(rawData);

  if (!validation.success) {
    return {
      success: false,
      message: "Invalid status update payload.",
      fieldErrors: validation.error.flatten().fieldErrors,
    };
  }

  const { id, status, performerId } = validation.data;

  // Resolve acting admin performer
  const adminPerformerRes = await resolveActingAdminPerformer(
    adminUser.id,
    performerId,
  );
  if (adminPerformerRes.error) {
    return {
      success: false,
      message: adminPerformerRes.error,
      fieldErrors: { performerId: [adminPerformerRes.error] },
    };
  }
  const actingAdmin = adminPerformerRes.performer;

  try {
    const existingRoom = await prisma.room.findUnique({
      where: { id },
    });

    if (!existingRoom) {
      return {
        success: false,
        message: "Room not found.",
      };
    }

    const updatedRoom = await prisma.room.update({
      where: { id },
      data: { status },
    });

    await logAudit({
      action: AuditAction.ROOM_STATUS_CHANGE,
      status: AuditStatus.SUCCESS,
      userId: adminUser.id,
      performerId: actingAdmin?.id,
      entity: "Room",
      entityId: updatedRoom.id,
      details: {
        number: updatedRoom.number,
        previousStatus: existingRoom.status,
        newStatus: updatedRoom.status,
        authorizer: actingAdmin
          ? `${actingAdmin.name} (${actingAdmin.phone})`
          : "System Root Admin",
      },
    });

    revalidatePath("/admin/rooms");
    revalidatePath("/admin");
    revalidatePath("/admin/audit");

    return {
      success: true,
      message: `Room "${updatedRoom.number}" status changed to ${updatedRoom.status}.`,
    };
  } catch (error) {
    console.error("[Room Status Update Error]:", error);
    return {
      success: false,
      message: "Failed to update room status.",
    };
  }
}

/**
 * Permanently removes a room record from the facility registry.
 */
export async function deleteRoomAction(
  prevState: RoomActionState | undefined,
  formData: FormData,
): Promise<RoomActionState> {
  const { user: adminUser } = await requireAuth(Role.ADMIN);

  const rawData = {
    id: formData.get("id")?.toString() || "",
    performerId: formData.get("performerId")?.toString() || undefined,
  };

  const validation = deleteRoomSchema.safeParse(rawData);

  if (!validation.success) {
    return {
      success: false,
      message: "Invalid room deletion request.",
    };
  }

  const { id, performerId } = validation.data;

  // Resolve acting admin performer
  const adminPerformerRes = await resolveActingAdminPerformer(
    adminUser.id,
    performerId,
  );
  if (adminPerformerRes.error) {
    return {
      success: false,
      message: adminPerformerRes.error,
      fieldErrors: { performerId: [adminPerformerRes.error] },
    };
  }
  const actingAdmin = adminPerformerRes.performer;

  try {
    const existingRoom = await prisma.room.findUnique({
      where: { id },
    });

    if (!existingRoom) {
      return {
        success: false,
        message: "Room not found or already deleted.",
      };
    }

    await prisma.room.delete({
      where: { id },
    });

    await logAudit({
      action: AuditAction.ROOM_DELETE,
      status: AuditStatus.SUCCESS,
      userId: adminUser.id,
      performerId: actingAdmin?.id,
      entity: "Room",
      entityId: id,
      details: {
        number: existingRoom.number,
        purpose: existingRoom.purpose,
        accessType: existingRoom.accessType,
        gender: existingRoom.gender,
        authorizer: actingAdmin
          ? `${actingAdmin.name} (${actingAdmin.phone})`
          : "System Root Admin",
      },
    });

    revalidatePath("/admin/rooms");
    revalidatePath("/admin");
    revalidatePath("/admin/audit");

    return {
      success: true,
      message: `Room "${existingRoom.number}" deleted successfully.`,
    };
  } catch (error) {
    console.error("[Delete Room Error]:", error);
    return {
      success: false,
      message: "Failed to delete room record.",
    };
  }
}
