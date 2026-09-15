"use server";

import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/guard";
import {
  Role,
  AuditAction,
  AuditStatus,
} from "@/generated/prisma/enums";
import type {
  AppointmentWithRelations,
  SlotWithTelemetry,
  PatientWithCount,
  ReceptionistDashboardData,
} from "@/actions/receptionist/appointment.action";
import { getReceptionistDashboardDataAction } from "@/actions/receptionist/appointment.action";
import type { RoomModel, PerformerModel } from "@/generated/prisma/models";
import { logAudit } from "@/lib/audit";
import { emitRealtimeEvent } from "@/lib/realtime/event-bus";
import { revalidatePath } from "next/cache";

export interface CashierDashboardData {
  selectedDate: string;
  dayOfWeek: string;
  appointments: AppointmentWithRelations[];
  pendingAppointments: AppointmentWithRelations[];
  paidAppointments: AppointmentWithRelations[];
  slots: SlotWithTelemetry[];
  patients: PatientWithCount[];
  totalPatientsCount: number;
  stats: ReceptionistDashboardData["stats"];
  billingStats: {
    totalCollected: number;
    pendingCollection: number;
    paidCount: number;
    pendingCount: number;
    cashCollected: number;
    cardCollected: number;
    mfsCollected: number;
  };
  rooms: RoomModel[];
  cashierPerformers: PerformerModel[];
  receptionistPerformers: ReceptionistDashboardData["receptionistPerformers"];
  doctorPerformers: PerformerModel[];
  currentCashier: PerformerModel | null;
}

import { DEFAULT_FEE } from "@/lib/billing";

/**
 * Loads all billing and queue data for the Cashier & Billing Desk.
 */
export async function getCashierDashboardDataAction(
  dateStr?: string,
): Promise<CashierDashboardData> {
  const sessionData = await requireAuth([Role.CASHIER, Role.ADMIN]);

  const now = new Date();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const targetDateStr = dateStr || todayIso;

  const [receptionistData, cashierPerformers, doctorPerformers] =
    await Promise.all([
      getReceptionistDashboardDataAction(targetDateStr),
      prisma.performer.findMany({
        where: { user: { role: Role.CASHIER } },
        orderBy: { name: "asc" },
      }),
      prisma.performer.findMany({
        where: { user: { role: Role.DOCTOR } },
        orderBy: { name: "asc" },
      }),
    ]);

  const appointments = receptionistData.appointments || [];

  // Logged in cashier performer identity
  const currentCashier =
    cashierPerformers.find((c) => c.id === sessionData.session.userId) ||
    cashierPerformers[0] ||
    null;

  // Split appointments by billing status
  const paidAppointments = appointments.filter(
    (a) => a.paymentStatus === "PAID",
  );
  const pendingAppointments = appointments.filter(
    (a) => a.paymentStatus !== "PAID" && a.status !== "CANCELLED",
  );

  let totalCollected = 0;
  let cashCollected = 0;
  let cardCollected = 0;
  let mfsCollected = 0;

  for (const a of paidAppointments) {
    const fee = a.feeAmount ?? DEFAULT_FEE;
    totalCollected += fee;
    if (a.paymentMethod === "CASH") cashCollected += fee;
    else if (a.paymentMethod === "CARD") cardCollected += fee;
    else if (a.paymentMethod === "MFS") mfsCollected += fee;
    else cashCollected += fee; // default
  }

  let pendingCollection = 0;
  for (const a of pendingAppointments) {
    const fee = a.feeAmount ?? DEFAULT_FEE;
    pendingCollection += fee;
  }

  return {
    selectedDate: targetDateStr,
    dayOfWeek: receptionistData.dayOfWeek,
    appointments,
    pendingAppointments,
    paidAppointments,
    slots: receptionistData.slots,
    patients: receptionistData.patients,
    totalPatientsCount: receptionistData.totalPatientsCount,
    stats: receptionistData.stats,
    billingStats: {
      totalCollected,
      pendingCollection,
      paidCount: paidAppointments.length,
      pendingCount: pendingAppointments.length,
      cashCollected,
      cardCollected,
      mfsCollected,
    },
    rooms: receptionistData.rooms,
    cashierPerformers,
    receptionistPerformers: receptionistData.receptionistPerformers,
    doctorPerformers,
    currentCashier,
  };
}

/**
 * Collects patient payment and issues invoice receipt.
 */
export async function collectPaymentAction(params: {
  appointmentId: string;
  amount: number;
  paymentMethod: "CASH" | "CARD" | "MFS";
  performerId?: string;
  notes?: string;
}) {
  try {
    const sessionData = await requireAuth([
      Role.CASHIER,
      Role.ADMIN,
      Role.RECEPTIONIST,
    ]);

    const appointment = await prisma.appointment.findUnique({
      where: { id: params.appointmentId },
      include: { patient: true, therapySlot: true },
    });

    if (!appointment) {
      return { success: false, message: "Appointment record not found." };
    }

    const feeAmount = appointment.feeAmount ?? params.amount;
    const paidAmount = params.amount;
    const dueAmount = Math.max(0, feeAmount - paidAmount);
    const paymentStatus = dueAmount === 0 ? "PAID" : "PARTIAL";

    const updated = await prisma.appointment.update({
      where: { id: params.appointmentId },
      data: {
        feeAmount,
        paidAmount,
        dueAmount,
        paymentStatus,
        paidAt: new Date(),
        paymentMethod: params.paymentMethod,
        notes: params.notes || appointment.notes,
      },
      include: {
        patient: true,
        therapySlot: { include: { room: true } },
        room: true,
      },
    });

    // Synchronize billing across Patient, Appointment, and File models
    const { syncBillingForAppointment } = await import("@/lib/billing-sync");
    await syncBillingForAppointment(updated.id);

    await logAudit({
      userId: sessionData.user.id,
      performerId: params.performerId || null,
      action: AuditAction.APPOINTMENT_UPDATE,
      entity: "Appointment",
      entityId: updated.id,
      status: AuditStatus.SUCCESS,
      details: {
        action: "PAYMENT_COLLECTED",
        patientName: updated.patient.name,
        amount: params.amount,
        method: params.paymentMethod,
      },
    });

    emitRealtimeEvent("APPOINTMENT_UPDATED", {
      id: updated.id,
      status: updated.status,
      paymentStatus: updated.paymentStatus,
      feeAmount: updated.feeAmount,
      date: updated.appointmentDate.toISOString().split("T")[0],
    });

    revalidatePath("/cashier");
    revalidatePath("/receptionist");
    revalidatePath("/doctor");
    revalidatePath("/handler");

    return {
      success: true,
      message: `Payment of ৳${params.amount} collected via ${params.paymentMethod} for ${updated.patient.name}.`,
      appointment: updated,
    };
  } catch (err) {
    console.error("[Collect Payment Error]:", err);
    return {
      success: false,
      message:
        err instanceof Error ? err.message : "Failed to collect payment.",
    };
  }
}
