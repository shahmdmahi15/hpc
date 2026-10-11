"use server";

import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/guard";
import { Role } from "@/generated/prisma/enums";
import { revalidatePath } from "next/cache";
import { emitRealtimeEvent } from "@/lib/realtime/event-bus";

export interface BulletinNoticeData {
  id: string;
  title: string | null;
  message: string;
  priority: string;
  targetAudience: string;
  isActive: boolean;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdById: string | null;
  createdBy?: {
    id: string;
    name: string | null;
    role: string;
  } | null;
}

export interface CreateBulletinNoticeInput {
  title?: string;
  message: string;
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT" | string;
  targetAudience?: "ALL" | "WAITING_ROOM" | "STAFF" | string;
  isActive?: boolean;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
}

export interface UpdateBulletinNoticeInput {
  title?: string;
  message?: string;
  priority?: string;
  targetAudience?: string;
  isActive?: boolean;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
}

/**
 * Retrieves all bulletin notices for administration.
 */
export async function getBulletinNoticesAction() {
  try {
    await requireAuth([Role.ADMIN]);

    const notices = await (prisma as any).bulletinNotice.findMany({
      orderBy: [{ createdAt: "desc" }],
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    });

    return {
      success: true,
      data: notices as BulletinNoticeData[],
    };
  } catch (error: any) {
    console.error("[getBulletinNoticesAction Error]:", error);
    return {
      success: false,
      data: [] as BulletinNoticeData[],
      message: error?.message || "Failed to fetch bulletin notices.",
    };
  }
}

/**
 * Retrieves active notices for TV displays, waiting rooms, or staff kiosks.
 */
export async function getActiveBulletinNoticesAction(targetAudience?: string) {
  try {
    const now = new Date();
    const where: any = {
      isActive: true,
      AND: [
        {
          OR: [{ startDate: null }, { startDate: { lte: now } }],
        },
        {
          OR: [{ endDate: null }, { endDate: { gte: now } }],
        },
      ],
    };

    if (targetAudience && targetAudience !== "ALL") {
      where.targetAudience = { in: [targetAudience, "ALL"] };
    }

    const notices = await (prisma as any).bulletinNotice.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    });

    return {
      success: true,
      data: notices as BulletinNoticeData[],
    };
  } catch (error: any) {
    console.error("[getActiveBulletinNoticesAction Error]:", error);
    return {
      success: false,
      data: [] as BulletinNoticeData[],
      message: error?.message || "Failed to load active notices.",
    };
  }
}

/**
 * Creates a new clinic notice.
 */
export async function createBulletinNoticeAction(data: CreateBulletinNoticeInput) {
  try {
    const sessionData = await requireAuth([Role.ADMIN]);
    const trimmedMessage = data.message?.trim();

    if (!trimmedMessage) {
      return {
        success: false,
        message: "Notice message is required.",
      };
    }

    const notice = await (prisma as any).bulletinNotice.create({
      data: {
        title: data.title?.trim() || null,
        message: trimmedMessage,
        priority: data.priority || "NORMAL",
        targetAudience: data.targetAudience || "ALL",
        isActive: typeof data.isActive === "boolean" ? data.isActive : true,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        createdById: sessionData.user.id,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    });

    emitRealtimeEvent("BULLETIN_NOTICE_CREATED", notice);

    revalidatePath("/admin/notices");
    revalidatePath("/tv");
    revalidatePath("/");

    return {
      success: true,
      data: notice as BulletinNoticeData,
      message: "Notice broadcast successfully!",
    };
  } catch (error: any) {
    console.error("[createBulletinNoticeAction Error]:", error);
    return {
      success: false,
      message: error?.message || "Failed to create bulletin notice.",
    };
  }
}

/**
 * Updates an existing bulletin notice.
 */
export async function updateBulletinNoticeAction(
  id: string,
  data: UpdateBulletinNoticeInput
) {
  try {
    await requireAuth([Role.ADMIN]);

    const existing = await (prisma as any).bulletinNotice.findUnique({
      where: { id },
    });

    if (!existing) {
      return {
        success: false,
        message: "Bulletin notice not found.",
      };
    }

    const updatePayload: any = {};
    if (data.title !== undefined) updatePayload.title = data.title?.trim() || null;
    if (data.message !== undefined) updatePayload.message = data.message.trim();
    if (data.priority !== undefined) updatePayload.priority = data.priority;
    if (data.targetAudience !== undefined) updatePayload.targetAudience = data.targetAudience;
    if (typeof data.isActive === "boolean") updatePayload.isActive = data.isActive;
    if (data.startDate !== undefined)
      updatePayload.startDate = data.startDate ? new Date(data.startDate) : null;
    if (data.endDate !== undefined)
      updatePayload.endDate = data.endDate ? new Date(data.endDate) : null;

    const updated = await (prisma as any).bulletinNotice.update({
      where: { id },
      data: updatePayload,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    });

    emitRealtimeEvent("BULLETIN_NOTICE_UPDATED", updated);

    revalidatePath("/admin/notices");
    revalidatePath("/tv");
    revalidatePath("/");

    return {
      success: true,
      data: updated as BulletinNoticeData,
      message: "Notice updated successfully!",
    };
  } catch (error: any) {
    console.error("[updateBulletinNoticeAction Error]:", error);
    return {
      success: false,
      message: error?.message || "Failed to update bulletin notice.",
    };
  }
}

/**
 * Deletes a bulletin notice.
 */
export async function deleteBulletinNoticeAction(id: string) {
  try {
    await requireAuth([Role.ADMIN]);

    const existing = await (prisma as any).bulletinNotice.findUnique({
      where: { id },
    });

    if (!existing) {
      return {
        success: false,
        message: "Notice not found.",
      };
    }

    await (prisma as any).bulletinNotice.delete({
      where: { id },
    });

    emitRealtimeEvent("BULLETIN_NOTICE_DELETED", { id });

    revalidatePath("/admin/notices");
    revalidatePath("/tv");
    revalidatePath("/");

    return {
      success: true,
      message: "Notice deleted successfully.",
    };
  } catch (error: any) {
    console.error("[deleteBulletinNoticeAction Error]:", error);
    return {
      success: false,
      message: error?.message || "Failed to delete notice.",
    };
  }
}

/**
 * Quick toggle for active state of a notice.
 */
export async function toggleBulletinNoticeAction(id: string, isActive: boolean) {
  try {
    await requireAuth([Role.ADMIN]);

    const updated = await (prisma as any).bulletinNotice.update({
      where: { id },
      data: { isActive },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    });

    emitRealtimeEvent("BULLETIN_NOTICE_UPDATED", updated);

    revalidatePath("/admin/notices");
    revalidatePath("/tv");
    revalidatePath("/");

    return {
      success: true,
      data: updated as BulletinNoticeData,
      message: `Notice ${isActive ? "activated" : "deactivated"} successfully.`,
    };
  } catch (error: any) {
    console.error("[toggleBulletinNoticeAction Error]:", error);
    return {
      success: false,
      message: error?.message || "Failed to toggle notice state.",
    };
  }
}
