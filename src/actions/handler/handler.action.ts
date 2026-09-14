"use server";

import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/guard";
import {
  Role,
  AppointmentStatus,
  QueueType,
  BookingType,
} from "@/generated/prisma/enums";
import type {
  AppointmentWithRelations,
  SlotWithTelemetry,
  PatientWithCount,
  ReceptionistDashboardData,
} from "@/actions/receptionist/appointment.action";
import { getReceptionistDashboardDataAction } from "@/actions/receptionist/appointment.action";
import type { RoomModel, PerformerModel } from "@/generated/prisma/models";

export interface HandlerDashboardData {
  selectedDate: string;
  dayOfWeek: string;
  appointments: AppointmentWithRelations[];
  therapyQueue: AppointmentWithRelations[];
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
 * - Therapy Queue (waiting and currently undergoing physical therapy)
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

  // Therapy Queue (Checked In or currently in Therapy session)
  const therapyQueue = appointments.filter(
    (a) =>
      a.queueType === QueueType.THERAPY &&
      (a.status === AppointmentStatus.CHECKED_IN ||
        a.status === AppointmentStatus.IN_THERAPY),
  );

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
