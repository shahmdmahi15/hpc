"use server";

import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/guard";
import {
  Role,
  AppointmentStatus,
  QueueType,
  BookingType,
  TreatmentPlanType,
} from "@/generated/prisma/enums";
import type {
  AppointmentWithRelations,
  SlotWithTelemetry,
  PatientWithCount,
  ReceptionistDashboardData,
} from "@/actions/receptionist/appointment.action";
import { getReceptionistDashboardDataAction } from "@/actions/receptionist/appointment.action";
import type { RoomModel, PerformerModel } from "@/generated/prisma/models";
import type { TreatmentPlanRecord } from "@/actions/doctor/treatment-plan.action";

export interface HandlerDashboardData {
  selectedDate: string;
  dayOfWeek: string;
  appointments: AppointmentWithRelations[];
  therapyQueue: AppointmentWithRelations[];
  callingTherapyAppointment: AppointmentWithRelations | null;
  activeTherapyAppointment: AppointmentWithRelations | null;
  todayPlansByPatientId: Record<string, TreatmentPlanRecord>;
  completedTherapy: AppointmentWithRelations[];
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

  const [receptionistData, handlerPerformers, doctorPerformers] =
    await Promise.all([
      getReceptionistDashboardDataAction(targetDateStr),
      prisma.performer.findMany({
        where: { user: { role: Role.HANDLER } },
        orderBy: { name: "asc" },
      }),
      prisma.performer.findMany({
        where: { user: { role: Role.DOCTOR } },
        orderBy: { name: "asc" },
      }),
    ]);

  const appointments = receptionistData.appointments || [];

  // Current logged-in Handler identity
  const currentHandler =
    handlerPerformers.find((h) => h.id === sessionData.session.userId) ||
    handlerPerformers[0] ||
    null;

  // Therapy Queue (Checked In, Calling, or currently in Therapy session)
  const therapyQueue = appointments.filter(
    (a) =>
      a.queueType === QueueType.THERAPY &&
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

  // Completed Therapy Sessions today
  const completedTherapy = appointments.filter(
    (a) =>
      a.queueType === QueueType.THERAPY &&
      a.status === AppointmentStatus.COMPLETED,
  );

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
    slots: receptionistData.slots,
    patients: receptionistData.patients,
    totalPatientsCount: receptionistData.totalPatientsCount,
    stats: receptionistData.stats,
    extraSlots,
    pendingExtraSlots,
    decidedExtraSlots,
    rooms: receptionistData.rooms,
    handlerPerformers,
    receptionistPerformers: receptionistData.receptionistPerformers,
    doctorPerformers,
    currentHandler,
  };
}
