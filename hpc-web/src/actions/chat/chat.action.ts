"use server";

import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/guard";
import { Role } from "@/generated/prisma/enums";
import {
  sendChatMessageSchema,
  type SendChatMessageInput,
} from "@/schemas/chat/chat.schema";
import { emitRealtimeEvent } from "@/lib/realtime/event-bus";
import { revalidatePath } from "next/cache";

export interface SerializedChatMessage {
  id: string;
  dateStr: string;
  messageDate: string;
  channel: string;
  content: string;
  isUrgent: boolean;
  senderId: string;
  senderRole: Role;
  senderName: string;
  performerId?: string | null;
  performerName?: string | null;
  recipientId?: string | null;
  recipientName?: string | null;
  patientId?: string | null;
  patientName?: string | null;
  roomNumber?: string | null;
  createdAt: string;
  patient?: {
    id: string;
    name: string;
    phone: string;
    mrn?: string | null;
    gender: string;
  } | null;
}

export interface ChatStaffMember {
  id: string;
  name: string;
  role: Role;
  email?: string | null;
  isPerformer?: boolean;
  performerId?: string;
  deskRole?: Role;
  roomNumber?: string | null;
}

/**
 * Loads internal chat messages for a specific calendar day (dateStr: "YYYY-MM-DD").
 * Can be filtered by channel (e.g. "GENERAL", "CLINICAL", "DM:xxx:yyy") and search query.
 */
export async function getChatMessagesAction(params: {
  dateStr: string;
  channel?: string;
  search?: string;
}): Promise<{
  success: boolean;
  messages: SerializedChatMessage[];
  dateStr: string;
}> {
  try {
    await requireAuth([
      Role.ADMIN,
      Role.DOCTOR,
      Role.RECEPTIONIST,
      Role.HANDLER,
      Role.CASHIER,
    ]);

    const targetDateStr =
      params.dateStr ||
      new Date().toISOString().split("T")[0];

    const whereClause: any = {
      dateStr: targetDateStr,
    };

    if (params.channel && params.channel !== "ALL") {
      whereClause.channel = params.channel;
    }

    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      whereClause.OR = [
        { content: { contains: q } },
        { senderName: { contains: q } },
        { patientName: { contains: q } },
      ];
    }

    const rawMessages = await prisma.chatMessage.findMany({
      where: whereClause,
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            phone: true,
            mrn: true,
            gender: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 200,
    });

    const serialized: SerializedChatMessage[] = rawMessages.map((m) => ({
      id: m.id,
      dateStr: m.dateStr,
      messageDate: m.messageDate.toISOString(),
      channel: m.channel,
      content: m.content,
      isUrgent: m.isUrgent,
      senderId: m.senderId,
      senderRole: m.senderRole,
      senderName: m.senderName,
      performerId: m.performerId,
      performerName: m.performerName,
      recipientId: m.recipientId,
      recipientName: m.recipientName,
      patientId: m.patientId,
      patientName: m.patientName,
      roomNumber: m.roomNumber,
      createdAt: m.createdAt.toISOString(),
      patient: m.patient,
    }));

    return {
      success: true,
      messages: serialized,
      dateStr: targetDateStr,
    };
  } catch (error) {
    console.error("[Get Chat Messages Error]:", error);
    return {
      success: false,
      messages: [],
      dateStr: params.dateStr || new Date().toISOString().split("T")[0],
    };
  }
}

/**
 * Sends a real-time internal text chat message.
 * Emits CHAT_MESSAGE_SENT event over offline SSE bus for instant delivery.
 */
export async function sendChatMessageAction(
  data: SendChatMessageInput,
): Promise<{
  success: boolean;
  message?: SerializedChatMessage;
  error?: string;
}> {
  try {
    const sessionData = await requireAuth([
      Role.ADMIN,
      Role.DOCTOR,
      Role.RECEPTIONIST,
      Role.HANDLER,
      Role.CASHIER,
    ]);

    const validation = sendChatMessageSchema.safeParse(data);
    if (!validation.success) {
      const errs = Object.values(validation.error.flatten().fieldErrors).flat();
      return { success: false, error: errs[0] || "Invalid message format." };
    }

    const {
      content,
      channel,
      dateStr,
      isUrgent,
      performerId,
      recipientId,
      patientId,
      roomNumber,
    } = validation.data;

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const effectiveDateStr = dateStr || todayStr;

    // Resolve Sender Name and Performer Details
    let senderName = sessionData.user.name || "Clinic Staff";
    let performerName: string | null = null;

    if (performerId) {
      const perf = await prisma.performer.findUnique({
        where: { id: performerId },
        include: { user: true },
      });
      if (perf) {
        performerName = perf.name;
        senderName = `${perf.name} (${perf.user.role.toLowerCase()})`;
      }
    } else if (sessionData.user.role === Role.DOCTOR) {
      senderName = sessionData.user.name?.startsWith("Dr.")
        ? sessionData.user.name
        : `Dr. ${sessionData.user.name || "Doctor"}`;
    } else if (sessionData.user.role === Role.ADMIN) {
      senderName = `${sessionData.user.name || "Administrator"} (Admin)`;
    }

    // Resolve Recipient Name (if direct message)
    let recipientName: string | null = null;
    if (recipientId) {
      const recipientUser = await prisma.user.findUnique({
        where: { id: recipientId },
        select: { name: true, role: true },
      });
      if (recipientUser) {
        recipientName = recipientUser.name || recipientUser.role;
      }
    }

    // Resolve Patient Name (if patient tagged)
    let patientName: string | null = null;
    let patientInfo: any = null;
    if (patientId) {
      const patientRec = await prisma.patient.findUnique({
        where: { id: patientId },
        select: {
          id: true,
          name: true,
          phone: true,
          mrn: true,
          gender: true,
        },
      });
      if (patientRec) {
        patientName = patientRec.name;
        patientInfo = patientRec;
      }
    }

    // Save message in DB
    const saved = await prisma.chatMessage.create({
      data: {
        dateStr: effectiveDateStr,
        messageDate: now,
        channel: channel || "GENERAL",
        content,
        isUrgent: Boolean(isUrgent),
        senderId: sessionData.user.id,
        senderRole: sessionData.user.role,
        senderName,
        performerId: performerId || null,
        performerName,
        recipientId: recipientId || null,
        recipientName,
        patientId: patientId || null,
        patientName,
        roomNumber: roomNumber || null,
      },
    });

    const serialized: SerializedChatMessage = {
      id: saved.id,
      dateStr: saved.dateStr,
      messageDate: saved.messageDate.toISOString(),
      channel: saved.channel,
      content: saved.content,
      isUrgent: saved.isUrgent,
      senderId: saved.senderId,
      senderRole: saved.senderRole,
      senderName: saved.senderName,
      performerId: saved.performerId,
      performerName: saved.performerName,
      recipientId: saved.recipientId,
      recipientName: saved.recipientName,
      patientId: saved.patientId,
      patientName: saved.patientName,
      roomNumber: saved.roomNumber,
      createdAt: saved.createdAt.toISOString(),
      patient: patientInfo,
    };

    // Broadcast instant real-time SSE event to all connected dashboard clients
    emitRealtimeEvent("CHAT_MESSAGE_SENT", serialized);

    return {
      success: true,
      message: serialized,
    };
  } catch (error) {
    console.error("[Send Chat Message Error]:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to send chat message.",
    };
  }
}

/**
 * Deletes a chat message (Allowed for author or ADMIN).
 */
export async function deleteChatMessageAction(
  messageId: string,
): Promise<{ success: boolean; message?: string }> {
  try {
    const sessionData = await requireAuth([
      Role.ADMIN,
      Role.DOCTOR,
      Role.RECEPTIONIST,
      Role.HANDLER,
      Role.CASHIER,
    ]);

    const msg = await prisma.chatMessage.findUnique({
      where: { id: messageId },
    });

    if (!msg) {
      return { success: false, message: "Message not found." };
    }

    const isAuthor = msg.senderId === sessionData.user.id;
    const isAdmin = sessionData.user.role === Role.ADMIN;

    if (!isAuthor && !isAdmin) {
      return { success: false, message: "Unauthorized to delete this message." };
    }

    await prisma.chatMessage.delete({
      where: { id: messageId },
    });

    emitRealtimeEvent("CHAT_MESSAGE_DELETED", {
      messageId,
      channel: msg.channel,
      dateStr: msg.dateStr,
    });

    return { success: true, message: "Message deleted successfully." };
  } catch (error) {
    console.error("[Delete Chat Message Error]:", error);
    return { success: false, message: "Failed to delete message." };
  }
}

/**
 * Retrieves the full roster of staff and active performers across the clinic
 * for Direct Messaging (1-on-1 chats) and mentions.
 */
export async function getChatStaffRosterAction(): Promise<{
  success: boolean;
  staff: ChatStaffMember[];
  currentUserId: string;
  currentUserRole: Role;
}> {
  try {
    const sessionData = await requireAuth([
      Role.ADMIN,
      Role.DOCTOR,
      Role.RECEPTIONIST,
      Role.HANDLER,
      Role.CASHIER,
    ]);

    const [users, performers] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          consultationRoom: { select: { number: true } },
        },
        orderBy: [{ role: "asc" }, { name: "asc" }],
      }),
      prisma.performer.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          userId: true,
          user: { select: { role: true } },
        },
        orderBy: { name: "asc" },
      }),
    ]);

    const staffList: ChatStaffMember[] = [];

    // Add user accounts
    users.forEach((u) => {
      let displayName = u.name || `${u.role} Account`;
      if (u.role === Role.DOCTOR && !displayName.startsWith("Dr.")) {
        displayName = `Dr. ${displayName}`;
      }
      staffList.push({
        id: u.id,
        name: displayName,
        role: u.role,
        email: u.email,
        isPerformer: false,
        roomNumber: u.consultationRoom?.number || null,
      });
    });

    // Add desk performers
    performers.forEach((p) => {
      staffList.push({
        id: p.userId, // Map to their desk User ID so DMs route to the desk/account
        performerId: p.id,
        name: `${p.name} (${p.user.role.toLowerCase()})`,
        role: p.user.role,
        email: p.email,
        isPerformer: true,
        deskRole: p.user.role,
      });
    });

    return {
      success: true,
      staff: staffList,
      currentUserId: sessionData.user.id,
      currentUserRole: sessionData.user.role,
    };
  } catch (error) {
    console.error("[Get Chat Staff Roster Error]:", error);
    return {
      success: false,
      staff: [],
      currentUserId: "",
      currentUserRole: Role.RECEPTIONIST,
    };
  }
}

/**
 * Returns current authenticated user and role identity for chat client views.
 */
export async function getChatSessionAction(): Promise<{
  success: boolean;
  currentUserId: string;
  currentUserRole: Role;
  currentUserName: string;
}> {
  try {
    const sessionData = await requireAuth([
      Role.ADMIN,
      Role.DOCTOR,
      Role.RECEPTIONIST,
      Role.HANDLER,
      Role.CASHIER,
    ]);
    return {
      success: true,
      currentUserId: sessionData.user.id,
      currentUserRole: sessionData.user.role,
      currentUserName: sessionData.user.name || "",
    };
  } catch {
    return {
      success: false,
      currentUserId: "",
      currentUserRole: Role.RECEPTIONIST,
      currentUserName: "",
    };
  }
}

export interface ChatClinicRoom {
  id: string;
  number: string;
  purpose: string | null;
  accessType: string;
  status: string;
}

/**
 * Returns all clinic chambers and rooms for staff to tag in chat messages.
 */
export async function getClinicRoomsAction(): Promise<{
  success: boolean;
  rooms: ChatClinicRoom[];
}> {
  try {
    await requireAuth([
      Role.ADMIN,
      Role.DOCTOR,
      Role.RECEPTIONIST,
      Role.HANDLER,
      Role.CASHIER,
    ]);

    const rooms = await prisma.room.findMany({
      orderBy: { number: "asc" },
      select: {
        id: true,
        number: true,
        purpose: true,
        accessType: true,
        status: true,
      },
    });

    return {
      success: true,
      rooms: rooms.sort((a, b) => {
        const numA = parseInt(a.number, 10);
        const numB = parseInt(b.number, 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.number.localeCompare(b.number);
      }),
    };
  } catch (error) {
    console.error("[Get Clinic Rooms Error]:", error);
    return {
      success: false,
      rooms: [],
    };
  }
}
