"use server";

import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/guard";
import {
  Role,
  AppointmentStatus,
  QueueType,
  BookingType,
  TreatmentPlanType,
  RoomStatus,
  AuditAction,
  AuditStatus,
} from "@/generated/prisma/enums";
import { verifyPerformerPin } from "@/lib/performer-auth";
import { emitRealtimeEvent } from "@/lib/realtime/event-bus";
import { revalidatePath } from "next/cache";
import type {
  AppointmentWithRelations,
  SlotWithTelemetry,
  PatientWithCount,
  ReceptionistDashboardData,
} from "@/actions/receptionist/appointment.action";
import { getReceptionistDashboardDataAction } from "@/actions/receptionist/appointment.action";
import type { RoomModel, PerformerModel } from "@/generated/prisma/models";
import type { TreatmentPlanRecord } from "@/actions/doctor/treatment-plan.action";
import { parsePlan } from "@/schemas/doctor/treatment-plan.schema";

export interface HandlerDashboardData {
  selectedDate: string;
  dayOfWeek: string;
  appointments: AppointmentWithRelations[];
  therapyQueue: AppointmentWithRelations[];
  callingTherapyAppointment: AppointmentWithRelations | null;
  activeTherapyAppointment: AppointmentWithRelations | null;
  todayPlansByPatientId: Record<string, TreatmentPlanRecord>;
  completedTherapy: AppointmentWithRelations[];
  consultationSerials: ReceptionistDashboardData["consultationSerials"];
  doctors: ReceptionistDashboardData["doctors"];
  slots: SlotWithTelemetry[];
  patients: PatientWithCount[];
  totalPatientsCount: number;
  stats: ReceptionistDashboardData["stats"];
  extraSlots: AppointmentWithRelations[];
  pendingExtraSlots: AppointmentWithRelations[];
  decidedExtraSlots: AppointmentWithRelations[];
  rooms: RoomModel[];
  handlerPerformers: PerformerModel[];
  receptionistPerformers: ReceptionistDashboardData["receptionistPerformers"];
  doctorPerformers: PerformerModel[];
  currentHandler: PerformerModel | null;
}

/**
 * Loads all clinical data for the Physical Therapy Handler Desk:
 * - Therapy Queue (waiting, calling, and currently undergoing physical therapy)
 * - Today's prescribed treatment plans mapped by patient ID
 * - Active in-therapy appointment and currently calling appointment
 * - Today's completed therapy sessions
 * - Slots Schedule Board with real-time capacity and ticket booking
 * - Standby Extra Slots monitoring & doctor approval status
 * - Patient Directory with registration & quick ticket booking
 */
export async function getHandlerDashboardDataAction(
  dateStr?: string,
): Promise<HandlerDashboardData> {
  const sessionData = await requireAuth([Role.HANDLER, Role.ADMIN]);

  const now = new Date();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const targetDateStr = dateStr || todayIso;

  const [receptionistData, handlerPerformers, doctorUsers] =
    await Promise.all([
      getReceptionistDashboardDataAction(targetDateStr),
      prisma.performer.findMany({
        where: { user: { role: Role.HANDLER } },
        orderBy: { name: "asc" },
      }),
      prisma.user.findMany({
        where: { role: Role.DOCTOR },
        select: {
          id: true,
          name: true,
          email: true,
          whatsapp: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { name: "asc" },
      }),
    ]);

  const doctorPerformers: PerformerModel[] = doctorUsers.map((doc) => ({
    id: doc.id,
    name: doc.name || "Doctor",
    email: doc.email || null,
    whatsapp: doc.whatsapp || "",
    phone: doc.whatsapp || "",
    pin: "0000",
    userId: doc.id,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }));

  const appointments = receptionistData.appointments || [];

  // Current logged-in Handler identity
  const currentHandler =
    handlerPerformers.find((h) => h.userId === sessionData.session.userId) ||
    handlerPerformers[0] ||
    null;

  // Therapy Queue (Checked In, Calling, or currently in Therapy session)
  const therapyQueue = appointments.filter(
    (a) =>
      a.queueType === QueueType.THERAPY &&
      !a.outTherapyTime &&
      a.currentStation !== "CASHIER_REGISTER" &&
      a.currentStation !== "RECEPTIONIST_DESK" &&
      a.currentStation !== "CHECKED_OUT" &&
      (a.status === AppointmentStatus.CHECKED_IN ||
        a.status === AppointmentStatus.CALLING ||
        a.status === AppointmentStatus.IN_THERAPY),
  );

  // Calling & Active In-Therapy appointments
  const callingTherapyAppointment =
    therapyQueue.find((a) => a.status === AppointmentStatus.CALLING) || null;

  const activeTherapyAppointment =
    therapyQueue.find((a) => a.status === AppointmentStatus.IN_THERAPY) || null;

  // Fetch today's treatment plans for all patients in therapy queue
  const patientIds = Array.from(
    new Set(therapyQueue.map((a) => a.patientId).filter(Boolean)),
  ) as string[];

  const activePlans =
    patientIds.length > 0
      ? await prisma.treatmentPlan.findMany({
          where: {
            patientId: { in: patientIds },
            planType: TreatmentPlanType.TODAY,
            isActive: true,
          },
          include: {
            doctor: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
        })
      : [];

  const todayPlansByPatientId: Record<string, TreatmentPlanRecord> = {};
  for (const plan of activePlans) {
    if (!todayPlansByPatientId[plan.patientId]) {
      todayPlansByPatientId[plan.patientId] = parsePlan(plan as any);
    }
  }

  // Completed Therapy Sessions today (includes patients forwarded to Receptionist, Cashier, or Doctor after therapy)
  const completedTherapyRaw = appointments.filter(
    (a) =>
      a.status !== AppointmentStatus.IN_THERAPY &&
      a.status !== AppointmentStatus.CALLING &&
      a.status !== AppointmentStatus.CANCELLED &&
      (Boolean(a.outTherapyTime) ||
        (a.queueType === QueueType.THERAPY &&
          a.status === AppointmentStatus.COMPLETED)),
  );

  // If any completed appointment has roomId = 200 (waiting room) or missing room, look up actual therapy room from TherapySessionTimer or StepLogs
  const completedApptIds = completedTherapyRaw.map((a) => a.id);
  const timers =
    completedApptIds.length > 0
      ? await prisma.therapySessionTimer.findMany({
          where: { appointmentId: { in: completedApptIds } },
          select: { appointmentId: true, roomNumber: true },
        })
      : [];

  const timerRoomByApptId: Record<string, string> = {};
  for (const t of timers) {
    if (t.appointmentId && t.roomNumber) {
      timerRoomByApptId[t.appointmentId] = t.roomNumber;
    }
  }

  // Also query step logs for any THERAPY_ROOM entries with roomNumber
  const stepLogs =
    completedApptIds.length > 0
      ? await prisma.patientStepLog.findMany({
          where: {
            step: { in: ["THERAPY_START", "QUEUED_FOR_THERAPY"] },
            roomNumber: { not: null },
            patientId: { in: completedTherapyRaw.map((a) => a.patientId) },
          },
          select: { patientId: true, roomNumber: true },
          orderBy: { timestamp: "desc" },
        })
      : [];

  const stepRoomByPatientId: Record<string, string> = {};
  for (const log of stepLogs) {
    if (
      log.roomNumber &&
      log.roomNumber !== "200" &&
      !stepRoomByPatientId[log.patientId]
    ) {
      stepRoomByPatientId[log.patientId] = log.roomNumber;
    }
  }

  const completedTherapy = completedTherapyRaw.map((a) => {
    const actualRoomNumber =
      timerRoomByApptId[a.id] ||
      (a.room?.number && a.room.number !== "200" ? a.room.number : null) ||
      stepRoomByPatientId[a.patientId] ||
      a.therapySlot?.room?.number ||
      null;

    if (actualRoomNumber && (!a.room || a.room.number === "200")) {
      return {
        ...a,
        room: {
          id: a.room?.id || "therapy-room",
          number: actualRoomNumber,
          purpose: "Therapy Room",
          accessType: a.room?.accessType || "THERAPY",
          gender: a.room?.gender || "COMMON",
          status: a.room?.status || "AVAILABLE",
          createdAt: a.room?.createdAt || new Date(),
          updatedAt: a.room?.updatedAt || new Date(),
        },
      };
    }
    return a;
  });

  // Standby Extra Slots for monitoring
  const extraSlots = appointments.filter(
    (a) => a.bookingType === BookingType.EXTRA,
  );

  const pendingExtraSlots = extraSlots.filter(
    (a) => a.extraStatus === "PENDING",
  );

  const decidedExtraSlots = extraSlots.filter(
    (a) => a.extraStatus === "APPROVED" || a.extraStatus === "REJECTED",
  );

  return {
    selectedDate: targetDateStr,
    dayOfWeek: receptionistData.dayOfWeek,
    appointments,
    therapyQueue,
    callingTherapyAppointment,
    activeTherapyAppointment,
    todayPlansByPatientId,
    completedTherapy,
    consultationSerials: receptionistData.consultationSerials || [],
    slots: receptionistData.slots,
    patients: receptionistData.patients,
    totalPatientsCount: receptionistData.totalPatientsCount,
    stats: receptionistData.stats,
    extraSlots,
    pendingExtraSlots,
    decidedExtraSlots,
    rooms: receptionistData.rooms,
    doctors: receptionistData.doctors,
    handlerPerformers,
    receptionistPerformers: receptionistData.receptionistPerformers,
    doctorPerformers,
    currentHandler,
  };
}

export interface SwitchTherapyRoomInput {
  appointmentId: string;
  targetRoomId: string;
  performerId?: string;
  pin?: string;
  reason?: string;
}

/**
 * Switches a patient's assigned therapy room (e.g. from Room 210 to Room 215)
 * while they are in therapy or being called.
 * - Validates the target room is an available/empty therapy room
 * - Updates the appointment's roomId and currentStation
 * - Updates the associated TherapySessionTimer's roomNumber
 * - Updates room statuses (frees previous room, occupies new room)
 * - Logs patient step log & audit log
 * - Emits real-time SSE events for live board & TV screens
 */
export async function switchTherapyRoomAction(input: SwitchTherapyRoomInput): Promise<{
  success: boolean;
  message: string;
  appointment?: any;
}> {
  try {
    const sessionData = await requireAuth([
      Role.HANDLER,
      Role.ADMIN,
      Role.DOCTOR,
      Role.RECEPTIONIST,
    ]);

    const isExemptRole =
      sessionData.user.role === Role.DOCTOR ||
      sessionData.user.role === Role.ADMIN;

    if (!isExemptRole && input.performerId) {
      const pinRes = await verifyPerformerPin(input.performerId, input.pin);
      if (!pinRes.valid) {
        return {
          success: false,
          message: pinRes.error || "Invalid 4-digit performer PIN.",
        };
      }
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: input.appointmentId },
      include: {
        patient: true,
        room: true,
        therapySlot: { include: { room: true } },
      },
    });

    if (!appointment) {
      return { success: false, message: "Appointment not found." };
    }

    const targetRoom = await prisma.room.findUnique({
      where: { id: input.targetRoomId },
    });

    if (!targetRoom) {
      return { success: false, message: "Target therapy room not found." };
    }

    const previousRoomId = appointment.roomId;
    const previousRoomNumber =
      appointment.room?.number ||
      appointment.therapySlot?.room?.number ||
      null;

    if (previousRoomId === targetRoom.id) {
      return {
        success: false,
        message: `Patient ${appointment.patient.name} is already assigned to Room ${targetRoom.number}.`,
      };
    }

    // Check if target room is currently occupied by another active patient today
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const conflictingAppointment = await prisma.appointment.findFirst({
      where: {
        id: { not: input.appointmentId },
        roomId: targetRoom.id,
        appointmentDate: { gte: startOfDay, lte: endOfDay },
        status: { in: [AppointmentStatus.IN_THERAPY, AppointmentStatus.CALLING] },
      },
      include: { patient: true },
    });

    if (conflictingAppointment) {
      const statusLabel =
        conflictingAppointment.status === AppointmentStatus.IN_THERAPY
          ? "currently in therapy"
          : "currently being called";
      return {
        success: false,
        message: `Room ${targetRoom.number} is occupied by ${conflictingAppointment.patient?.name || "another patient"} (${statusLabel}). Please select an empty therapy room.`,
      };
    }

    // Update appointment
    const updated = await prisma.appointment.update({
      where: { id: input.appointmentId },
      data: {
        roomId: targetRoom.id,
        ...(appointment.status === AppointmentStatus.IN_THERAPY
          ? { currentStation: "THERAPY_ROOM" }
          : {}),
      },
      include: {
        patient: true,
        room: true,
        therapySlot: { include: { room: true } },
        doctor: true,
      },
    });

    // Update TherapySessionTimer roomNumber if exists
    await prisma.therapySessionTimer.updateMany({
      where: { appointmentId: input.appointmentId },
      data: { roomNumber: targetRoom.number },
    });

    // Update room statuses: free previous room if no other active appointment
    if (previousRoomId && previousRoomId !== targetRoom.id) {
      const remainingInOldRoom = await prisma.appointment.count({
        where: {
          id: { not: input.appointmentId },
          roomId: previousRoomId,
          appointmentDate: { gte: startOfDay, lte: endOfDay },
          status: { in: [AppointmentStatus.IN_THERAPY, AppointmentStatus.CALLING] },
        },
      });
      if (remainingInOldRoom === 0) {
        await prisma.room.update({
          where: { id: previousRoomId },
          data: { status: RoomStatus.AVAILABLE },
        }).catch(() => {});
      }
    }

    if (
      appointment.status === AppointmentStatus.IN_THERAPY ||
      appointment.status === AppointmentStatus.CALLING
    ) {
      await prisma.room.update({
        where: { id: targetRoom.id },
        data: { status: RoomStatus.OCCUPIED },
      }).catch(() => {});
    }

    // Lookup performer name for logs
    let performerName = sessionData.user.name || "Handler";
    if (input.performerId) {
      const p = await prisma.performer.findUnique({
        where: { id: input.performerId },
        select: { name: true },
      });
      if (p?.name) performerName = p.name;
    }

    // Record step log
    await prisma.patientStepLog.create({
      data: {
        patientId: appointment.patientId,
        station: "THERAPY_ROOM",
        step: "ROOM_TRANSFERRED",
        roomNumber: targetRoom.number,
        performerId: input.performerId || null,
        details: `Switched therapy room from Room ${previousRoomNumber || "--"} to Room ${targetRoom.number}${input.reason ? ` - ${input.reason}` : ""}`,
      },
    }).catch(() => {});

    // Record audit log
    await prisma.auditLog.create({
      data: {
        userId: sessionData.user.id,
        performerId: input.performerId || null,
        action: AuditAction.APPOINTMENT_UPDATE,
        entity: "Appointment",
        entityId: input.appointmentId,
        status: AuditStatus.SUCCESS,
        details: JSON.stringify({
          type: "THERAPY_ROOM_SWITCH",
          previousRoomNumber,
          newRoomNumber: targetRoom.number,
          patientName: appointment.patient.name,
          reason: input.reason || null,
        }),
      },
    }).catch(() => {});

    // Emit Real-time Events
    emitRealtimeEvent("APPOINTMENT_UPDATED", {
      id: updated.id,
      status: updated.status,
      queueType: updated.queueType,
      roomId: targetRoom.id,
      roomNumber: targetRoom.number,
      previousRoomNumber,
      patientName: updated.patient.name,
    });

    emitRealtimeEvent("ROOM_UPDATED", {
      roomId: targetRoom.id,
      roomNumber: targetRoom.number,
      status: RoomStatus.OCCUPIED,
    });

    if (previousRoomId) {
      emitRealtimeEvent("ROOM_UPDATED", {
        roomId: previousRoomId,
        roomNumber: previousRoomNumber,
        status: RoomStatus.AVAILABLE,
      });
    }

    emitRealtimeEvent("ROOM_SWITCHED", {
      appointmentId: updated.id,
      patientName: updated.patient.name,
      previousRoomNumber: previousRoomNumber || "--",
      newRoomNumber: targetRoom.number,
      station: "THERAPY_ROOM",
      reason: input.reason || null,
    });

    emitRealtimeEvent("STATION_CHANGED", {
      appointmentId: updated.id,
      station: "THERAPY_ROOM",
      roomNumber: targetRoom.number,
      patientName: updated.patient.name,
    });

    emitRealtimeEvent("THERAPY_TIMER_UPDATED", {
      appointmentId: updated.id,
      roomNumber: targetRoom.number,
    });

    revalidatePath("/handler");
    revalidatePath("/queue/waiting-room");
    revalidatePath("/receptionist");

    return {
      success: true,
      message: `Patient ${updated.patient.name} successfully switched from Room ${previousRoomNumber || "--"} to Room ${targetRoom.number}.`,
      appointment: updated,
    };
  } catch (error: any) {
    console.error("[switchTherapyRoomAction Error]:", error);
    return {
      success: false,
      message: error?.message || "Failed to switch therapy room.",
    };
  }
}
