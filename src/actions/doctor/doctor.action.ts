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
} from "@/generated/prisma/enums";
import type {
  AppointmentWithRelations,
} from "@/actions/receptionist/appointment.action";
import type { RoomModel, PerformerModel } from "@/generated/prisma/models";
import { logAudit } from "@/lib/audit";
import { emitRealtimeEvent } from "@/lib/realtime/event-bus";
import {
  type ReceptionistDashboardData,
  type SlotWithTelemetry,
  type PatientWithCount,
  getReceptionistDashboardDataAction,
} from "@/actions/receptionist/appointment.action";
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
  activeConsultation: AppointmentWithRelations | null;
  callingAppointment: AppointmentWithRelations | null;
  completedConsultations: AppointmentWithRelations[];
  pendingExtraSlots: AppointmentWithRelations[];
  decidedExtraSlots: AppointmentWithRelations[];
  rooms: RoomModel[];
  doctorPerformers: PerformerModel[];
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

  const [receptionistData, doctorPerformers] = await Promise.all([
    getReceptionistDashboardDataAction(targetDateStr),
    prisma.performer.findMany({
      where: { user: { role: Role.DOCTOR } },
      orderBy: { name: "asc" },
    }),
  ]);

  const appointments = receptionistData.appointments || [];

  // Find logged-in doctor's performer record
  const currentDoctor =
    doctorPerformers.find(
      (doc) => doc.id === sessionData.session.userId,
    ) ||
    doctorPerformers[0] ||
    null;

  // Active in-consultation session
  const activeConsultation =
    appointments.find(
      (a) => a.status === AppointmentStatus.IN_CONSULTATION,
    ) || null;

  // Currently being called into chamber
  const callingAppointment =
    appointments.find(
      (a) => a.status === AppointmentStatus.CALLING,
    ) || null;

  // Consultation Queue (Checked in, Calling, or In-Consultation)
  const consultationQueue = appointments.filter(
    (a) =>
      a.queueType === QueueType.CONSULTATION &&
      (a.status === AppointmentStatus.CHECKED_IN ||
        a.status === AppointmentStatus.CALLING ||
        a.status === AppointmentStatus.IN_CONSULTATION),
  );

  // Therapy Queue (Checked in or In-Therapy)
  const therapyQueue = appointments.filter(
    (a) =>
      a.queueType === QueueType.THERAPY &&
      (a.status === AppointmentStatus.CHECKED_IN ||
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
    activeConsultation,
    callingAppointment,
    completedConsultations,
    pendingExtraSlots,
    decidedExtraSlots,
    rooms: receptionistData.rooms,
    doctorPerformers,
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
        error instanceof Error
          ? error.message
          : "Failed to review extra slot.",
    };
  }
}
