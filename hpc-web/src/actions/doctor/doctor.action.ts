"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/guard";
import {
  Role,
  AppointmentStatus,
  AppointmentType,
  QueueType,
  BookingType,
  ExtraApprovalStatus,
  AuditAction,
  AuditStatus,
  RoomStatus,
  TreatmentPlanType,
} from "@/generated/prisma/enums";
import type { AppointmentWithRelations } from "@/actions/receptionist/appointment.action";
import type { RoomModel, PerformerModel } from "@/generated/prisma/models";
import { logAudit } from "@/lib/audit";
import { emitRealtimeEvent } from "@/lib/realtime/event-bus";
import {
  type ReceptionistDashboardData,
  type SlotWithTelemetry,
  type PatientWithCount,
  getReceptionistDashboardDataAction,
} from "@/actions/receptionist/appointment.action";
import { getOrCreateWaitingRoom200 } from "@/actions/receptionist/patient.action";
import { type TreatmentPlanRecord } from "@/actions/doctor/treatment-plan.action";
import { parsePlan } from "@/schemas/doctor/treatment-plan.schema";
import { syncBillingForAppointment } from "@/lib/billing-sync";
import { verifyPerformerPin } from "@/lib/performer-auth";
import { revalidatePath } from "next/cache";

export interface DoctorDashboardData {
  selectedDate: string;
  dayOfWeek: string;
  appointments: AppointmentWithRelations[];
  slots: SlotWithTelemetry[];
  patients: PatientWithCount[];
  totalPatientsCount: number;
  stats: ReceptionistDashboardData["stats"];
  consultationQueue: AppointmentWithRelations[];
  therapyQueue: AppointmentWithRelations[];
  todayPlansByPatientId?: Record<string, TreatmentPlanRecord>;
  activeConsultation: AppointmentWithRelations | null;
  callingAppointment: AppointmentWithRelations | null;
  completedConsultations: AppointmentWithRelations[];
  pendingExtraSlots: AppointmentWithRelations[];
  decidedExtraSlots: AppointmentWithRelations[];
  rooms: RoomModel[];
  doctorPerformers: PerformerModel[];
  handlerPerformers: PerformerModel[];
  receptionistPerformers: ReceptionistDashboardData["receptionistPerformers"];
  currentDoctor: (PerformerModel & { consultationRoomId?: string | null }) | null;
}

/**
 * Loads all clinical data required for the Doctor Consultation Desk:
 * - Active Consultation Queue & Therapy Queue
 * - Current patient in consultation session
 * - Today's completed consultations
 * - Pending Extra Slots requiring Doctor approval & historical decisions
 * - Doctor Chambers / Consultation Rooms
 * - Doctor performer identity
 * - Slots Schedule Board with real-time capacity and booking
 * - Patients Directory with direct booking
 */
export async function getDoctorDashboardDataAction(
  dateStr?: string,
): Promise<DoctorDashboardData> {
  const sessionData = await requireAuth([Role.DOCTOR, Role.ADMIN]);

  const now = new Date();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const targetDateStr = dateStr || todayIso;

  const [receptionistData, doctorUsers, handlerPerformers] =
    await Promise.all([
      getReceptionistDashboardDataAction(targetDateStr),
      prisma.user.findMany({
        where: { role: Role.DOCTOR },
        select: {
          id: true,
          name: true,
          email: true,
          whatsapp: true,
          consultationFee: true,
          consultationRoomId: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { name: "asc" },
      }),
      prisma.performer.findMany({
        where: { user: { role: Role.HANDLER } },
        orderBy: { name: "asc" },
      }),
    ]);

  const appointments = receptionistData.appointments || [];

  // Map Doctor User accounts to PerformerModel structure so UI components have complete doctor details
  const doctorPerformers = doctorUsers.map((doc) => ({
    id: doc.id,
    name: doc.name || "Doctor",
    email: doc.email || null,
    whatsapp: doc.whatsapp || "",
    phone: doc.whatsapp || "",
    pin: "0000",
    userId: doc.id,
    consultationRoomId: doc.consultationRoomId,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }));

  // Find logged-in doctor's user identity
  // Doctors and Admins are independent user accounts with their own credentials.
  let currentDoctor: (PerformerModel & { consultationRoomId?: string | null }) | null = null;
  if (sessionData.user.role === Role.DOCTOR) {
    const matched = doctorPerformers.find(
      (doc) => doc.id === sessionData.user.id || doc.userId === sessionData.user.id,
    );
    if (matched) {
      currentDoctor = matched;
    } else {
      currentDoctor = {
        id: sessionData.user.id,
        name: sessionData.user.name || "Doctor",
        email: sessionData.user.email || null,
        whatsapp: sessionData.user.whatsapp || "",
        phone: sessionData.user.whatsapp || "",
        pin: "0000",
        userId: sessionData.user.id,
        consultationRoomId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
  } else {
    // Admin viewing doctor workspace: default to 1st doctor user
    currentDoctor = doctorPerformers[0] || null;
  }

  // Consultation Queue (Checked In, Calling, or In-Consultation)
  const consultationQueue = appointments.filter(
    (a) =>
      a.queueType === QueueType.CONSULTATION &&
      !a.outConsultationTime &&
      a.currentStation !== "CASHIER_REGISTER" &&
      a.currentStation !== "RECEPTIONIST_DESK" &&
      a.currentStation !== "CHECKED_OUT" &&
      (a.status === AppointmentStatus.CHECKED_IN ||
        a.status === AppointmentStatus.CALLING ||
        a.status === AppointmentStatus.IN_CONSULTATION),
  );

  // Active in-consultation session (strictly for consultation queue)
  const activeConsultation =
    consultationQueue.find(
      (a) => a.status === AppointmentStatus.IN_CONSULTATION,
    ) || null;

  // Currently being called into chamber (strictly for consultation queue)
  const callingAppointment =
    consultationQueue.find((a) => a.status === AppointmentStatus.CALLING) ||
    null;

  // Therapy Queue (Checked in, Calling, or In-Therapy)
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

  // Completed consultations today (includes patients forwarded to Receptionist, Cashier, or Therapy after consultation)
  const completedConsultations = appointments.filter(
    (a) =>
      a.status !== AppointmentStatus.IN_CONSULTATION &&
      a.status !== AppointmentStatus.CALLING &&
      a.status !== AppointmentStatus.CANCELLED &&
      (Boolean(a.outConsultationTime) ||
        (a.queueType === QueueType.CONSULTATION &&
          a.status === AppointmentStatus.COMPLETED)),
  );

  // Pending Extra Slots awaiting doctor decision
  const pendingExtraSlots = appointments.filter(
    (a) =>
      a.bookingType === BookingType.EXTRA &&
      a.extraStatus === ExtraApprovalStatus.PENDING,
  );

  // Decided Extra Slots (Approved or Rejected) for review history
  const decidedExtraSlots = appointments.filter(
    (a) =>
      a.bookingType === BookingType.EXTRA &&
      (a.extraStatus === ExtraApprovalStatus.APPROVED ||
        a.extraStatus === ExtraApprovalStatus.REJECTED),
  );

  // Fetch today's treatment plans for all active patients (consultation + therapy + completed)
  const treatmentPlanPatientIds = Array.from(
    new Set(
      [
        ...consultationQueue.map((a) => a.patientId),
        ...therapyQueue.map((a) => a.patientId),
        ...completedConsultations.map((a) => a.patientId),
      ].filter(Boolean),
    ),
  ) as string[];

  const activeTodayPlans =
    treatmentPlanPatientIds.length > 0
      ? await prisma.treatmentPlan.findMany({
          where: {
            patientId: { in: treatmentPlanPatientIds },
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
  for (const plan of activeTodayPlans) {
    if (!todayPlansByPatientId[plan.patientId]) {
      todayPlansByPatientId[plan.patientId] = parsePlan(plan as any);
    }
  }

  return {
    selectedDate: targetDateStr,
    dayOfWeek: receptionistData.dayOfWeek,
    appointments,
    slots: receptionistData.slots,
    patients: receptionistData.patients,
    totalPatientsCount: receptionistData.totalPatientsCount,
    stats: receptionistData.stats,
    consultationQueue,
    therapyQueue,
    todayPlansByPatientId,
    activeConsultation,
    callingAppointment,
    completedConsultations,
    pendingExtraSlots,
    decidedExtraSlots,
    rooms: receptionistData.rooms,
    doctorPerformers,
    handlerPerformers,
    receptionistPerformers: receptionistData.receptionistPerformers,
    currentDoctor,
  };
}

/**
 * Reviews a standby extra therapy slot request (Approve or Reject).
 * Doctor adds an optional note just as the receptionist provides an optional reason.
 * Emits real-time events to update receptionist schedule boards and waiting room displays.
 */
export async function reviewExtraSlotAction(params: {
  appointmentId: string;
  decision: "APPROVE" | "REJECT";
  performerId?: string;
  pin?: string;
  note?: string;
}): Promise<{
  success: boolean;
  message: string;
  appointment?: AppointmentWithRelations;
}> {
  try {
    const sessionData = await requireAuth([Role.DOCTOR, Role.ADMIN]);

    // Doctors and Admins are independent user accounts with zero PIN requirements.
    const isExemptRole =
      sessionData.user.role === Role.DOCTOR ||
      sessionData.user.role === Role.ADMIN;

    if (!isExemptRole && params.performerId) {
      const pinRes = await verifyPerformerPin(params.performerId, params.pin);
      if (!pinRes.valid) {
        return {
          success: false,
          message: pinRes.error || "Invalid 4-digit staff PIN.",
        };
      }
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: params.appointmentId },
      include: {
        patient: true,
        therapySlot: { include: { room: true } },
        room: true,
        bookedBy: true,
        extraApprovedBy: true,
        queue: true,
      },
    });

    if (!appointment) {
      return { success: false, message: "Appointment record not found." };
    }

    if (appointment.bookingType !== BookingType.EXTRA) {
      return {
        success: false,
        message: "This appointment is not an extra slot request.",
      };
    }

    const isApprove = params.decision === "APPROVE";
    const trimmedNote = params.note?.trim() || null;

    const updated = await prisma.appointment.update({
      where: { id: params.appointmentId },
      data: {
        extraStatus: isApprove
          ? ExtraApprovalStatus.APPROVED
          : ExtraApprovalStatus.REJECTED,
        // If approved, ticket becomes confirmed; if rejected, ticket is cancelled to free the slot
        status: isApprove
          ? AppointmentStatus.CONFIRMED
          : AppointmentStatus.CANCELLED,
        extraApprovedById: sessionData.user.id,
        extraApprovedAt: new Date(),
        extraApprovalNote: trimmedNote,
      },
      include: {
        patient: true,
        therapySlot: { include: { room: true } },
        room: true,
        bookedBy: true,
        extraApprovedBy: true,
        queue: true,
      },
    });

    // Audit Logging
    await logAudit({
      userId: sessionData.user.id,
      performerId: params.performerId || null,
      action: AuditAction.APPOINTMENT_UPDATE,
      entity: "Appointment",
      entityId: updated.id,
      status: AuditStatus.SUCCESS,
      details: {
        action: isApprove ? "EXTRA_SLOT_APPROVED" : "EXTRA_SLOT_REJECTED",
        patientName: updated.patient.name,
        slotLabel: updated.therapySlot?.label || "Slot",
        doctorNote: trimmedNote,
        receptionistReason: updated.extraReason,
      },
    });

    // Real-time broadcast to connected clients
    emitRealtimeEvent("APPOINTMENT_UPDATED", {
      id: updated.id,
      status: updated.status,
      extraStatus: updated.extraStatus,
      extraApprovalNote: updated.extraApprovalNote,
      slotId: updated.therapySlotId,
      date: updated.appointmentDate.toISOString().split("T")[0],
    });

    emitRealtimeEvent("SLOT_UPDATED", {
      slotId: updated.therapySlotId || "",
      date: updated.appointmentDate.toISOString().split("T")[0],
    });

    revalidatePath("/doctor");
    revalidatePath("/receptionist");
    revalidatePath("/");

    return {
      success: true,
      message: isApprove
        ? `Extra slot for ${updated.patient.name} approved successfully.`
        : `Extra slot for ${updated.patient.name} rejected.`,
      appointment: updated,
    };
  } catch (error: unknown) {
    console.error("[Review Extra Slot Error]:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to review extra slot.",
    };
  }
}

export interface RoutePatientParams {
  appointmentId: string;
  destination: "CASHIER" | "HANDLER" | "RECEPTIONIST" | "DOCTOR";
  feeAmount?: number;
  consultationFee?: number;
  therapyFee?: number;
  performerId?: string;
  pin?: string;
  notes?: string;
  routingNote?: string;
  nextPlan?: {
    modalities: string[];
    instructions?: string;
    targetDate?: string;
  };
}

/**
 * Routes an active consultation or therapy patient to their next clinical destination:
 * 1. CASHIER: Marks session completed, updates fee due, releases room, routes to cashier counter.
 * 2. HANDLER: Transfers patient to Physical Therapy queue (status: CHECKED_IN, willCallTime cleared), updates fee due, releases room.
 * 3. DOCTOR: Transfers patient to Doctor Consultation queue (status: CHECKED_IN, willCallTime cleared), updates fee due, releases room.
 * 4. RECEPTIONIST: Marks session completed, releases room, routes back to front desk.
 * Always resets willCallTime to null so fresh call time can be assigned.
 */
export async function routePatientAction(params: RoutePatientParams): Promise<{
  success: boolean;
  message: string;
  code?: string;
  appointment?: AppointmentWithRelations;
}> {
  try {
    const sessionData = await requireAuth([
      Role.DOCTOR,
      Role.HANDLER,
      Role.ADMIN,
    ]);

    // Doctors and Admins are independent user accounts and do not need a PIN.
    const isExemptRole =
      sessionData.user.role === Role.DOCTOR ||
      sessionData.user.role === Role.ADMIN;

    if (!isExemptRole && params.performerId) {
      const pinRes = await verifyPerformerPin(params.performerId, params.pin);
      if (!pinRes.valid) {
        return {
          success: false,
          message: pinRes.error || "Invalid 4-digit performer PIN.",
        };
      }
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: params.appointmentId },
      include: {
        patient: true,
        therapySlot: { include: { room: true } },
        room: true,
        bookedBy: true,
        extraApprovedBy: true,
        queue: true,
      },
    });

    if (!appointment) {
      return { success: false, message: "Appointment record not found." };
    }

    // Differentiate Consultation Fee vs Therapy Fee
    let newConsultationFee: number = appointment.consultationFee ?? 0;
    let newTherapyFee: number = appointment.therapyFee ?? 0;

    if (params.consultationFee !== undefined) {
      newConsultationFee = Math.max(0, params.consultationFee);
    } else if (sessionData.user.role === Role.DOCTOR && params.feeAmount !== undefined) {
      newConsultationFee = Math.max(0, params.feeAmount);
    }

    if (params.therapyFee !== undefined) {
      newTherapyFee = Math.max(0, params.therapyFee);
    } else if (sessionData.user.role === Role.HANDLER && params.feeAmount !== undefined) {
      newTherapyFee = Math.max(0, params.feeAmount);
    }

    let feeToSet = newConsultationFee + newTherapyFee;
    if (
      feeToSet === 0 &&
      (appointment.feeAmount ?? 0) > 0 &&
      params.feeAmount === undefined &&
      params.consultationFee === undefined &&
      params.therapyFee === undefined
    ) {
      feeToSet = appointment.feeAmount ?? 0;
    }

    let newStatus: AppointmentStatus = AppointmentStatus.CHECKED_IN;
    let targetQueueType: QueueType | null = appointment.queueType;
    let targetQueueId: string | null = appointment.queueId;
    let destinationLabel = "";

    // Merge fields if a separate therapy slot booking exists for today when routing to HANDLER
    let mergedTherapyFields: {
      type?: AppointmentType;
      therapySlotId?: string | null;
      bookingType?: BookingType;
      extraStatus?: ExtraApprovalStatus;
      extraReason?: string | null;
      toldTime?: string | null;
    } = {};

    if (params.destination === "CASHIER") {
      destinationLabel = "Cashier Counter";
      newStatus = AppointmentStatus.CHECKED_IN;
      targetQueueType = null;
      targetQueueId = null;
    } else if (params.destination === "HANDLER") {
      // Requirement: To send a patient to Handler (Therapy Queue), there MUST be an unserved therapy slot booked for today
      const startOfDay = new Date(appointment.appointmentDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(appointment.appointmentDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Check if this appointment's therapy was ALREADY served (outTherapyTime was stamped)
      const currentSessionAlreadyServed = Boolean(appointment.outTherapyTime);

      if (!appointment.therapySlotId || currentSessionAlreadyServed) {
        // Look for ANOTHER unserved therapy slot booking for today
        const separateTherapyApt = await prisma.appointment.findFirst({
          where: {
            patientId: appointment.patientId,
            id: { not: appointment.id },
            appointmentDate: { gte: startOfDay, lte: endOfDay },
            therapySlotId: { not: null },
            outTherapyTime: null, // Must not be already served!
            status: {
              notIn: [
                AppointmentStatus.CANCELLED,
                AppointmentStatus.COMPLETED,
                AppointmentStatus.NO_SHOW,
              ],
            },
          },
          orderBy: { createdAt: "desc" },
        });

        if (!separateTherapyApt) {
          if (currentSessionAlreadyServed) {
            return {
              success: false,
              code: "SLOT_ALREADY_COMPLETED",
              message:
                "Today's booked therapy slot has already been completed for this patient. To conduct another therapy session today, please send the patient to the Receptionist Desk to book a new slot (or Extra Slot).",
            };
          } else {
            return {
              success: false,
              code: "NO_SLOT_BOOKED",
              message:
                "Cannot send to Handler Queue: No Therapy Slot is booked for today for this patient. Please book a Therapy Slot for today or send the patient to Receptionist first.",
            };
          }
        }

        // Merge the separate unserved therapy slot booking into this active visit appointment
        mergedTherapyFields = {
          type: AppointmentType.THERAPY,
          therapySlotId: separateTherapyApt.therapySlotId,
          bookingType: separateTherapyApt.bookingType,
          extraStatus: separateTherapyApt.extraStatus,
          extraReason: separateTherapyApt.extraReason,
          toldTime: separateTherapyApt.toldTime || appointment.toldTime,
        };
        if (newTherapyFee === 0 && (separateTherapyApt.therapyFee ?? separateTherapyApt.feeAmount ?? 0) > 0) {
          newTherapyFee = separateTherapyApt.therapyFee ?? separateTherapyApt.feeAmount ?? 800;
          feeToSet = newConsultationFee + newTherapyFee;
        }

        await prisma.appointment
          .delete({ where: { id: separateTherapyApt.id } })
          .catch((err) =>
            console.error("[Merge Separate Therapy Apt Delete Error]:", err),
          );
      }

      destinationLabel = "Therapy Queue";
      newStatus = AppointmentStatus.CHECKED_IN;
      targetQueueType = QueueType.THERAPY;

      // Ensure Therapy Queue record exists
      let queueRecord = await prisma.queue.findUnique({
        where: { type: QueueType.THERAPY },
      });
      if (!queueRecord) {
        queueRecord = await prisma.queue.create({
          data: {
            type: QueueType.THERAPY,
            name: "Therapy Queue",
            description: "Queue for physical therapy patients",
          },
        });
      }
      targetQueueId = queueRecord.id;
    } else if (params.destination === "DOCTOR") {
      destinationLabel = "Doctor Consultation Queue";
      newStatus = AppointmentStatus.CHECKED_IN;
      targetQueueType = QueueType.CONSULTATION;

      // Ensure Consultation Queue record exists
      let queueRecord = await prisma.queue.findUnique({
        where: { type: QueueType.CONSULTATION },
      });
      if (!queueRecord) {
        queueRecord = await prisma.queue.create({
          data: {
            type: QueueType.CONSULTATION,
            name: "Consultation Queue",
            description: "Queue for doctor consultation patients",
          },
        });
      }
      targetQueueId = queueRecord.id;
    } else if (params.destination === "RECEPTIONIST") {
      destinationLabel = "Reception Desk";
      newStatus = AppointmentStatus.CHECKED_IN;
      targetQueueType = null;
      targetQueueId = null;
    }

    // Release chamber / therapy room if currently occupying or calling
    if (
      appointment.roomId &&
      (appointment.status === AppointmentStatus.IN_CONSULTATION ||
        appointment.status === AppointmentStatus.IN_THERAPY ||
        appointment.status === AppointmentStatus.CALLING)
    ) {
      const activeCount = await prisma.appointment.count({
        where: {
          roomId: appointment.roomId,
          status: {
            in: [
              AppointmentStatus.IN_CONSULTATION,
              AppointmentStatus.IN_THERAPY,
              AppointmentStatus.CALLING,
            ],
          },
          id: { not: appointment.id },
        },
      });

      if (activeCount === 0) {
        await prisma.room
          .update({
            where: { id: appointment.roomId },
            data: { status: RoomStatus.AVAILABLE },
          })
          .catch((err) => console.error("[Release Room Error]:", err));

        emitRealtimeEvent("ROOM_UPDATED", {
          id: appointment.roomId,
          status: RoomStatus.AVAILABLE,
          number: appointment.room?.number || null,
        });
      }
    }

    // Determine payment status
    let paymentStatus = appointment.paymentStatus || "PENDING";
    if (
      appointment.paymentStatus === "PAID" &&
      feeToSet > (appointment.feeAmount ?? 0)
    ) {
      // Fee was increased beyond what was already paid
      paymentStatus = "PENDING";
    } else if (feeToSet > 0 && (appointment.paidAmount ?? 0) < feeToSet && paymentStatus === "PAID") {
      paymentStatus = "PENDING";
    }

    // Determine routing origin based on where the patient is being routed from
    const wasInConsultation =
      appointment.status === AppointmentStatus.IN_CONSULTATION ||
      appointment.queueType === QueueType.CONSULTATION ||
      sessionData.user.role === Role.DOCTOR;
    const wasInTherapy =
      appointment.status === AppointmentStatus.IN_THERAPY ||
      appointment.queueType === QueueType.THERAPY ||
      sessionData.user.role === Role.HANDLER;

    const routingOrigin = wasInConsultation
      ? "DOCTOR"
      : wasInTherapy
        ? "THERAPY"
        : appointment.routingOrigin;

    const routeTime = new Date();
    // If leaving consultation, stamp outConsultationTime
    const outConsultationTime =
      appointment.status === AppointmentStatus.IN_CONSULTATION ||
      appointment.queueType === QueueType.CONSULTATION ||
      params.destination === "HANDLER" ||
      (routingOrigin === "DOCTOR" && !appointment.outConsultationTime)
        ? routeTime
        : appointment.outConsultationTime;

    // If leaving therapy, stamp outTherapyTime; if entering therapy queue, reset to null
    let outTherapyTime: Date | null = appointment.outTherapyTime;
    if (params.destination === "HANDLER") {
      outTherapyTime = null; // Clears exit time so patient is active in therapy queue!
    } else if (
      appointment.status === AppointmentStatus.IN_THERAPY ||
      appointment.queueType === QueueType.THERAPY ||
      params.destination === "DOCTOR" ||
      (routingOrigin === "THERAPY" && !appointment.outTherapyTime)
    ) {
      outTherapyTime = routeTime;
    }

    // Validate performerId: only assign if exists in Performer table
    let validatedPerformerId: string | null | undefined = undefined;
    if (params.performerId) {
      const perf = await prisma.performer.findUnique({
        where: { id: params.performerId },
        select: { id: true },
      });
      if (perf) validatedPerformerId = perf.id;
    }

    // Validate doctorId: only assign if exists in User table
    let validatedDoctorId: string | null | undefined = undefined;
    const targetDocId =
      appointment.doctorId ||
      (sessionData.user.role === Role.DOCTOR ? sessionData.user.id : undefined);
    if (targetDocId) {
      const docUser = await prisma.user.findFirst({
        where: { id: targetDocId },
        select: { id: true },
      });
      if (docUser) validatedDoctorId = docUser.id;
    }

    const targetStation =
      params.destination === "HANDLER"
        ? "THERAPY_ROOM"
        : params.destination === "DOCTOR"
          ? "CONSULTATION_ROOM"
          : params.destination === "CASHIER"
            ? "CASHIER_REGISTER"
            : "RECEPTIONIST_DESK";

    const waitingRoom = await getOrCreateWaitingRoom200();

    // Reset willCallTime to null whenever routing to a new queue or desk
    const updated = await prisma.appointment.update({
      where: { id: params.appointmentId },
      data: {
        ...mergedTherapyFields,
        status: newStatus,
        currentStation: targetStation,
        checkOutTime: null,
        queueType: targetQueueType,
        queueId: targetQueueId,
        routingOrigin,
        routedAt: routeTime,
        routingNote:
          params.routingNote !== undefined
            ? params.routingNote
            : appointment.routingNote,
        outConsultationTime,
        outTherapyTime,
        consultationFee: newConsultationFee,
        therapyFee: newTherapyFee,
        feeAmount: feeToSet,
        paidAmount:
          paymentStatus === "PAID" ? feeToSet : (appointment.paidAmount ?? 0),
        dueAmount:
          paymentStatus === "PAID"
            ? 0
            : Math.max(0, feeToSet - (appointment.paidAmount ?? 0)),
        paymentStatus,
        willCallTime: null,
        roomId: waitingRoom.id,
        notes: params.notes !== undefined ? params.notes : appointment.notes,
        ...(validatedPerformerId !== undefined ? { performerId: validatedPerformerId } : {}),
        ...(validatedDoctorId !== undefined ? { doctorId: validatedDoctorId } : {}),
      },
      include: {
        patient: true,
        therapySlot: { include: { room: true } },
        room: true,
        bookedBy: true,
        extraApprovedBy: true,
        queue: true,
        doctor: true,
      },
    });

    // Synchronize billing across Patient, Appointment, and File models
    await syncBillingForAppointment(updated.id);

    // If leaving consultation (routed to CASHIER, HANDLER, or RECEPTIONIST), mark today's ConsultationSerial as COMPLETED
    if (params.destination !== "DOCTOR") {
      try {
        const startOfDay = new Date(updated.appointmentDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(updated.appointmentDate);
        endOfDay.setHours(23, 59, 59, 999);

        await prisma.consultationSerial.updateMany({
          where: {
            patientId: updated.patientId,
            appointmentDate: { gte: startOfDay, lte: endOfDay },
            status: { in: ["QUEUED", "CALLING", "IN_CONSULTATION", "BOOKED"] },
          },
          data: {
            status: "COMPLETED",
            outConsultationTime: routeTime,
            ...(routingOrigin === "DOCTOR"
              ? {
                  feeAmount: feeToSet,
                  dueAmount: Math.max(0, feeToSet - (appointment.paidAmount ?? 0)),
                }
              : {}),
          },
        });
      } catch (serialErr) {
        console.error("[Complete ConsultationSerial on Route Error]:", serialErr);
      }
    }

    // Optionally assign next day treatment plan if provided
    if (
      params.nextPlan &&
      Array.isArray(params.nextPlan.modalities) &&
      params.nextPlan.modalities.length > 0
    ) {
      try {
        await prisma.treatmentPlan.updateMany({
          where: {
            patientId: appointment.patientId,
            planType: TreatmentPlanType.NEXT,
            isActive: true,
          },
          data: { isActive: false },
        });

        await prisma.treatmentPlan.create({
          data: {
            patientId: appointment.patientId,
            appointmentId: appointment.id,
            planType: TreatmentPlanType.NEXT,
            doctorId:
              sessionData.user.role === Role.DOCTOR
                ? sessionData.user.id
                : (validatedDoctorId || null),
            modalities: JSON.stringify(params.nextPlan.modalities),
            instructions: params.nextPlan.instructions || null,
            targetDate: params.nextPlan.targetDate
              ? new Date(params.nextPlan.targetDate)
              : null,
            isActive: true,
          },
        });
      } catch (tpErr) {
        console.error("[Persist Next Day Plan Error]:", tpErr);
      }
    }

    // Record step transition in PatientStepLog
    await prisma.patientStepLog
      .create({
        data: {
          patientId: updated.patientId,
          visitId: updated.visitId || undefined,
          step:
            params.destination === "CASHIER"
              ? "FORWARDED_TO_CASHIER"
              : params.destination === "HANDLER"
                ? "QUEUED_FOR_THERAPY"
                : params.destination === "DOCTOR"
                  ? "QUEUED_FOR_DOCTOR"
                  : "CONSULTATION_END",
          station: targetStation,
          doctorId: validatedDoctorId || undefined,
          performerId: validatedPerformerId || undefined,
          details:
            updated.routingNote ||
            `Patient forwarded to ${destinationLabel}${feeToSet > 0 ? ` (Fee: ৳${feeToSet})` : ""}`,
        },
      })
      .catch((stepErr) => console.error("[Route StepLog Error]:", stepErr));

    // Audit Logging
    await logAudit({
      userId: sessionData.user.id,
      performerId: validatedPerformerId || null,
      action: AuditAction.APPOINTMENT_UPDATE,
      entity: "Appointment",
      entityId: updated.id,
      status: AuditStatus.SUCCESS,
      details: {
        action: `PATIENT_ROUTED_TO_${params.destination}`,
        destination: params.destination,
        patientName: updated.patient.name,
        feeAmount: feeToSet,
        previousStatus: appointment.status,
        newStatus,
        currentStation: targetStation,
        queueType: targetQueueType,
        routingNote: updated.routingNote,
        routedAt: updated.routedAt ? updated.routedAt.toISOString() : null,
      },
    });

    // Real-time notification broadcast
    emitRealtimeEvent("APPOINTMENT_UPDATED", {
      id: updated.id,
      status: updated.status,
      currentStation: updated.currentStation,
      queueType: updated.queueType,
      feeAmount: updated.feeAmount,
      paymentStatus: updated.paymentStatus,
      checkInTime: updated.checkInTime,
      inConsultationTime: updated.inConsultationTime,
      outConsultationTime: updated.outConsultationTime,
      inTherapyTime: updated.inTherapyTime,
      outTherapyTime: updated.outTherapyTime,
      routingNote: updated.routingNote,
      routedAt: updated.routedAt,
      willCallTime: null,
      slotId: updated.therapySlotId,
      roomId: updated.roomId,
      date: updated.appointmentDate.toISOString().split("T")[0],
    });

    emitRealtimeEvent("STATION_CHANGED", {
      appointmentId: updated.id,
      patientId: updated.patientId,
      patientName: updated.patient.name,
      fromStation: appointment.currentStation,
      toStation: targetStation,
      status: updated.status,
    });

    emitRealtimeEvent("PATIENT_FORWARDED", {
      appointmentId: updated.id,
      patientId: updated.patientId,
      patientName: updated.patient.name,
      destination: params.destination,
      toStation: targetStation,
      routingNote: updated.routingNote,
    });

    if (params.destination === "HANDLER") {
      emitRealtimeEvent("SLOT_UPDATED", {
        slotId: updated.therapySlotId || "",
        date: updated.appointmentDate.toISOString().split("T")[0],
      });
    }

    revalidatePath("/doctor");
    revalidatePath("/cashier");
    revalidatePath("/handler");
    revalidatePath("/receptionist");
    revalidatePath("/admin/tracking");
    revalidatePath("/");

    return {
      success: true,
      message:
        feeToSet > 0
          ? `${updated.patient.name} has been forwarded to ${destinationLabel} (Bill: ৳${feeToSet.toLocaleString()}).`
          : `${updated.patient.name} has been forwarded to ${destinationLabel}.`,
      appointment: updated,
    };
  } catch (error: unknown) {
    console.error("[Route Patient Error]:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to route patient.",
    };
  }
}

/**
 * Quick updates the fee/due amount for an appointment.
 */
export async function updateAppointmentFeeAction(params: {
  appointmentId: string;
  feeAmount: number;
  performerId?: string;
  pin?: string;
}): Promise<{
  success: boolean;
  message: string;
  appointment?: AppointmentWithRelations;
}> {
  try {
    const sessionData = await requireAuth([
      Role.DOCTOR,
      Role.HANDLER,
      Role.ADMIN,
      Role.CASHIER,
      Role.RECEPTIONIST,
    ]);

    // Doctors and Admins are independent user accounts and do not need a PIN.
    const isExemptRole =
      sessionData.user.role === Role.DOCTOR ||
      sessionData.user.role === Role.ADMIN;

    if (!isExemptRole && params.performerId) {
      const pinRes = await verifyPerformerPin(params.performerId, params.pin);
      if (!pinRes.valid) {
        return {
          success: false,
          message: pinRes.error || "Invalid 4-digit staff PIN.",
        };
      }
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: params.appointmentId },
      include: { patient: true },
    });

    if (!appointment) {
      return { success: false, message: "Appointment record not found." };
    }

    const feeToSet = params.feeAmount;
    const currentPaid = appointment.paidAmount ?? 0;
    const dueAmount = Math.max(0, feeToSet - currentPaid);
    const paymentStatus =
      dueAmount === 0 && currentPaid > 0
        ? "PAID"
        : currentPaid > 0
          ? "PARTIAL"
          : "PENDING";

    const updated = await prisma.appointment.update({
      where: { id: params.appointmentId },
      data: {
        feeAmount: feeToSet,
        paidAmount: currentPaid,
        dueAmount,
        paymentStatus,
      },
      include: {
        patient: true,
        therapySlot: { include: { room: true } },
        room: true,
        bookedBy: true,
        extraApprovedBy: true,
        queue: true,
        doctor: true,
      },
    });

    await syncBillingForAppointment(updated.id);

    await logAudit({
      userId: sessionData.user.id,
      performerId: params.performerId || null,
      action: AuditAction.APPOINTMENT_UPDATE,
      entity: "Appointment",
      entityId: updated.id,
      status: AuditStatus.SUCCESS,
      details: {
        action: "FEE_UPDATED",
        previousFee: appointment.feeAmount,
        newFee: params.feeAmount,
        patientName: updated.patient.name,
      },
    });

    emitRealtimeEvent("APPOINTMENT_UPDATED", {
      id: updated.id,
      feeAmount: updated.feeAmount,
      paymentStatus: updated.paymentStatus,
      date: updated.appointmentDate.toISOString().split("T")[0],
    });

    revalidatePath("/doctor");
    revalidatePath("/cashier");
    revalidatePath("/receptionist");
    revalidatePath("/handler");

    return {
      success: true,
      message: `Due amount updated to ৳${params.feeAmount.toLocaleString()}.`,
      appointment: updated,
    };
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      (error.message === "NEXT_REDIRECT" ||
        (error as any).digest?.startsWith("NEXT_REDIRECT"))
    ) {
      throw error;
    }
    console.error("[Update Appointment Fee Error]:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to update fee amount.",
    };
  }
}

/**
 * Checks whether a patient had a doctor consultation today and whether it is paid or unpaid.
 * Used by handler send dialog to ensure doctor fee is only shown if consultation happened today AND is unpaid.
 */
export async function getPatientTodayConsultationDueAction(patientId: string): Promise<{
  hasConsultationToday: boolean;
  isPaid: boolean;
  doctorFee: number;
  doctorPaid: number;
  doctorDue: number;
  doctorName?: string | null;
}> {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const serial = await prisma.consultationSerial.findFirst({
      where: {
        patientId,
        appointmentDate: { gte: startOfDay, lte: endOfDay },
        status: { not: "CANCELLED" },
      },
      include: { doctor: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });

    if (!serial) {
      // Check if an appointment has consultation fee for today
      const apt = await prisma.appointment.findFirst({
        where: {
          patientId,
          appointmentDate: { gte: startOfDay, lte: endOfDay },
          OR: [
            { type: AppointmentType.CONSULTATION },
            { consultationFee: { gt: 0 } },
          ],
          status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] },
        },
        include: { doctor: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      });

      if (apt) {
        const docFee =
          apt.consultationFee ??
          (apt.type === AppointmentType.CONSULTATION ? (apt.feeAmount ?? 500) : 0);
        const isPaid =
          apt.paymentStatus === "PAID" ||
          (apt.dueAmount === 0 && (apt.paidAmount ?? 0) > 0);
        return {
          hasConsultationToday: docFee > 0 || apt.type === AppointmentType.CONSULTATION,
          isPaid,
          doctorFee: docFee,
          doctorPaid: isPaid ? docFee : (apt.paidAmount ?? 0),
          doctorDue: isPaid ? 0 : docFee,
          doctorName: apt.doctor?.name || null,
        };
      }

      return {
        hasConsultationToday: false,
        isPaid: false,
        doctorFee: 0,
        doctorPaid: 0,
        doctorDue: 0,
      };
    }

    const isPaid =
      serial.paymentStatus === "PAID" ||
      (serial.dueAmount === 0 && serial.paidAmount > 0);

    return {
      hasConsultationToday: true,
      isPaid,
      doctorFee: serial.feeAmount,
      doctorPaid: serial.paidAmount,
      doctorDue: isPaid ? 0 : serial.dueAmount,
      doctorName: serial.doctor?.name || null,
    };
  } catch (err) {
    console.error("[getPatientTodayConsultationDueAction Error]:", err);
    return {
      hasConsultationToday: false,
      isPaid: false,
      doctorFee: 0,
      doctorPaid: 0,
      doctorDue: 0,
    };
  }
}

/**
 * Checks whether a patient had a physical therapy session or booked slot today and whether it is paid or unpaid.
 * Used by Doctor Send Dialog to show therapy fee breakdown and prevent overwriting.
 */
export async function getPatientTodayTherapyDueAction(patientId: string): Promise<{
  hasTherapyToday: boolean;
  isPaid: boolean;
  therapyFee: number;
  therapyPaid: number;
  therapyDue: number;
  slotLabel?: string | null;
}> {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const apt = await prisma.appointment.findFirst({
      where: {
        patientId,
        appointmentDate: { gte: startOfDay, lte: endOfDay },
        OR: [
          { therapySlotId: { not: null } },
          { therapyFee: { gt: 0 } },
        ],
        status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] },
      },
      include: {
        therapySlot: true,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!apt) {
      return {
        hasTherapyToday: false,
        isPaid: false,
        therapyFee: 0,
        therapyPaid: 0,
        therapyDue: 0,
      };
    }

    const therapyFee =
      apt.therapyFee ??
      ((apt.consultationFee ?? 0) > 0
        ? Math.max(0, (apt.feeAmount ?? 0) - (apt.consultationFee ?? 0))
        : (apt.type === AppointmentType.THERAPY ? (apt.feeAmount ?? 0) : 0));

    const isPaid =
      apt.paymentStatus === "PAID" ||
      (apt.dueAmount === 0 && (apt.paidAmount ?? 0) > 0);
    const therapyPaid = isPaid ? therapyFee : (apt.paidAmount ?? 0);
    const therapyDue = isPaid ? 0 : therapyFee;

    return {
      hasTherapyToday: therapyFee > 0 || Boolean(apt.therapySlotId),
      isPaid,
      therapyFee,
      therapyPaid,
      therapyDue,
      slotLabel: apt.therapySlot?.label || null,
    };
  } catch (err) {
    console.error("[getPatientTodayTherapyDueAction Error]:", err);
    return {
      hasTherapyToday: false,
      isPaid: false,
      therapyFee: 0,
      therapyPaid: 0,
      therapyDue: 0,
    };
  }
}
