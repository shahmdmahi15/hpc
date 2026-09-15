"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/guard";
import {
  Role,
  AppointmentStatus,
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
import type { TreatmentPlanRecord } from "@/actions/doctor/treatment-plan.action";
import { syncBillingForAppointment } from "@/lib/billing-sync";
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
  currentDoctor: PerformerModel | null;
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

  const [receptionistData, doctorPerformers, handlerPerformers] =
    await Promise.all([
      getReceptionistDashboardDataAction(targetDateStr),
      prisma.performer.findMany({
        where: { user: { role: Role.DOCTOR } },
        orderBy: { name: "asc" },
      }),
      prisma.performer.findMany({
        where: { user: { role: Role.HANDLER } },
        orderBy: { name: "asc" },
      }),
    ]);

  const appointments = receptionistData.appointments || [];

  // Find logged-in doctor's performer record
  const currentDoctor =
    doctorPerformers.find((doc) => doc.id === sessionData.session.userId) ||
    doctorPerformers[0] ||
    null;

  // Active in-consultation session
  const activeConsultation =
    appointments.find((a) => a.status === AppointmentStatus.IN_CONSULTATION) ||
    null;

  // Currently being called into chamber
  const callingAppointment =
    appointments.find((a) => a.status === AppointmentStatus.CALLING) || null;

  // Consultation Queue (Checked in, Calling, or In-Consultation)
  const consultationQueue = appointments.filter(
    (a) =>
      a.queueType === QueueType.CONSULTATION &&
      (a.status === AppointmentStatus.CHECKED_IN ||
        a.status === AppointmentStatus.CALLING ||
        a.status === AppointmentStatus.IN_CONSULTATION),
  );

  // Therapy Queue (Checked in, Calling, or In-Therapy)
  const therapyQueue = appointments.filter(
    (a) =>
      a.queueType === QueueType.THERAPY &&
      (a.status === AppointmentStatus.CHECKED_IN ||
        a.status === AppointmentStatus.CALLING ||
        a.status === AppointmentStatus.IN_THERAPY),
  );

  // Completed consultations today
  const completedConsultations = appointments.filter(
    (a) =>
      a.queueType === QueueType.CONSULTATION &&
      a.status === AppointmentStatus.COMPLETED,
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

  // Fetch today's treatment plans for all patients in therapy queue
  const therapyPatientIds = Array.from(
    new Set(therapyQueue.map((a) => a.patientId).filter(Boolean)),
  ) as string[];

  const activeTodayPlans =
    therapyPatientIds.length > 0
      ? await prisma.treatmentPlan.findMany({
          where: {
            patientId: { in: therapyPatientIds },
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
      let modalities: string[] = [];
      try {
        modalities =
          typeof plan.modalities === "string"
            ? JSON.parse(plan.modalities)
            : [];
      } catch {
        modalities = [];
      }
      todayPlansByPatientId[plan.patientId] = {
        id: plan.id,
        planType: plan.planType,
        patientId: plan.patientId,
        appointmentId: plan.appointmentId || null,
        doctorId: plan.doctorId || null,
        doctorName: plan.doctor?.name || null,
        modalities,
        instructions: plan.instructions || null,
        targetDate: plan.targetDate ? plan.targetDate.toISOString() : null,
        isActive: plan.isActive,
        createdAt: plan.createdAt.toISOString(),
        updatedAt: plan.updatedAt.toISOString(),
      };
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
  note?: string;
}): Promise<{
  success: boolean;
  message: string;
  appointment?: AppointmentWithRelations;
}> {
  try {
    const sessionData = await requireAuth([Role.DOCTOR, Role.ADMIN]);

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
        extraApprovedById: params.performerId || null,
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
  performerId?: string;
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
  appointment?: AppointmentWithRelations;
}> {
  try {
    const sessionData = await requireAuth([
      Role.DOCTOR,
      Role.HANDLER,
      Role.ADMIN,
    ]);

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

    const feeToSet =
      typeof params.feeAmount === "number" &&
      !isNaN(params.feeAmount) &&
      params.feeAmount >= 0
        ? params.feeAmount
        : (appointment.feeAmount ?? 500);

    let newStatus = appointment.status;
    let targetQueueType = appointment.queueType;
    let targetQueueId = appointment.queueId;
    let destinationLabel = "";

    if (params.destination === "CASHIER") {
      destinationLabel = "Cashier Counter";
      newStatus = AppointmentStatus.COMPLETED;
    } else if (params.destination === "HANDLER") {
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
      newStatus = AppointmentStatus.COMPLETED;
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
    }

    // Determine routing origin
    const routingOrigin =
      params.destination === "HANDLER"
        ? "DOCTOR"
        : params.destination === "DOCTOR"
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

    // If leaving therapy, stamp outTherapyTime
    const outTherapyTime =
      appointment.status === AppointmentStatus.IN_THERAPY ||
      appointment.queueType === QueueType.THERAPY ||
      params.destination === "DOCTOR" ||
      (routingOrigin === "THERAPY" && !appointment.outTherapyTime)
        ? routeTime
        : appointment.outTherapyTime;

    // Reset willCallTime to null whenever routing to a new queue or desk
    const updated = await prisma.appointment.update({
      where: { id: params.appointmentId },
      data: {
        status: newStatus,
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
        feeAmount: feeToSet,
        paidAmount:
          paymentStatus === "PAID" ? feeToSet : (appointment.paidAmount ?? 0),
        dueAmount:
          paymentStatus === "PAID"
            ? 0
            : Math.max(0, feeToSet - (appointment.paidAmount ?? 0)),
        paymentStatus,
        willCallTime: null,
        roomId:
          params.destination === "HANDLER" || params.destination === "DOCTOR"
            ? null
            : appointment.roomId,
        notes: params.notes !== undefined ? params.notes : appointment.notes,
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

    // Synchronize billing across Patient, Appointment, and File models
    await syncBillingForAppointment(updated.id);

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
            doctorId: params.performerId || null,
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

    // Audit Logging
    await logAudit({
      userId: sessionData.user.id,
      performerId: params.performerId || null,
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
        queueType: targetQueueType,
        routingNote: updated.routingNote,
        routedAt: updated.routedAt ? updated.routedAt.toISOString() : null,
      },
    });

    // Real-time notification broadcast
    emitRealtimeEvent("APPOINTMENT_UPDATED", {
      id: updated.id,
      status: updated.status,
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
    revalidatePath("/");

    return {
      success: true,
      message: `${updated.patient.name} has been routed to ${destinationLabel} with due amount ৳${feeToSet.toLocaleString()}.`,
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
}): Promise<{
  success: boolean;
  message: string;
  appointment?: AppointmentWithRelations;
}> {
  try {
    const sessionData = await requireAuth([
      Role.DOCTOR,
      Role.ADMIN,
      Role.CASHIER,
      Role.RECEPTIONIST,
    ]);

    const appointment = await prisma.appointment.findUnique({
      where: { id: params.appointmentId },
      include: { patient: true },
    });

    if (!appointment) {
      return { success: false, message: "Appointment record not found." };
    }

    const updated = await prisma.appointment.update({
      where: { id: params.appointmentId },
      data: {
        feeAmount: params.feeAmount,
        paymentStatus:
          appointment.paymentStatus === "PAID" &&
          params.feeAmount > (appointment.feeAmount ?? 0)
            ? "PENDING"
            : (appointment.paymentStatus || "PENDING"),
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

    return {
      success: true,
      message: `Due amount updated to ৳${params.feeAmount.toLocaleString()}.`,
      appointment: updated,
    };
  } catch (error: unknown) {
    console.error("[Update Appointment Fee Error]:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to update fee amount.",
    };
  }
}
