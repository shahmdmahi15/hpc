"use server";

import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/guard";
import {
  Role,
  AuditAction,
  AuditStatus,
  AppointmentType,
  QueueType,
  AppointmentStatus,
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
import { DEFAULT_FEE } from "@/lib/billing";
import { generateNextInvoiceNumber } from "@/lib/invoice-utils";

export interface CashierDashboardData {
  selectedDate: string;
  dayOfWeek: string;
  appointments: AppointmentWithRelations[];
  pendingAppointments: AppointmentWithRelations[];
  paidAppointments: AppointmentWithRelations[];
  consultationSerials: any[];
  pendingConsultationSerials: any[];
  paidConsultationSerials: any[];
  therapyAwaitingDueClearance: AppointmentWithRelations[];
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

  const [year, month, day] = targetDateStr.split("-").map(Number);
  const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
  const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);

  const [
    receptionistData,
    cashierPerformers,
    doctorUsers,
    consultationSerials,
    previousDuePayments,
  ] = await Promise.all([
    getReceptionistDashboardDataAction(targetDateStr),
    prisma.performer.findMany({
      where: { user: { role: Role.CASHIER } },
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
    prisma.consultationSerial.findMany({
      where: {
        appointmentDate: { gte: startOfDay, lte: endOfDay },
        status: { not: "CANCELLED" },
      },
      include: {
        doctor: { select: { id: true, name: true, consultationFee: true } },
        patient: true,
        invoice: {
          include: { payments: true },
        },
      },
      orderBy: { serialNumber: "asc" },
    }),
    prisma.patientPayment.findMany({
      where: {
        createdAt: { gte: startOfDay, lte: endOfDay },
        serviceType: "PREVIOUS_DUE",
        isDue: false,
      },
      include: {
        patient: true,
        invoice: {
          include: { payments: true },
        },
      },
      orderBy: { createdAt: "desc" },
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

  // Logged in cashier performer identity
  const currentCashier =
    cashierPerformers.find((c) => c.userId === sessionData.session.userId) ||
    cashierPerformers[0] ||
    null;

  // Scenario 7: Therapy arrivals awaiting previous due clearance before entering therapy queue
  const therapyAwaitingDueClearance = appointments.filter(
    (a) =>
      a.status !== AppointmentStatus.CANCELLED &&
      (a.type === AppointmentType.THERAPY || Boolean(a.therapySlotId)) &&
      a.status === AppointmentStatus.CHECKED_IN &&
      a.queueType === null &&
      !a.outTherapyTime &&
      !a.inTherapyTime &&
      a.routingOrigin !== "THERAPY" &&
      a.currentStation !== "CASHIER_REGISTER" &&
      (a.patient?.totalDue ?? 0) > 0,
  );

  // Consultation serials forwarded from reception awaiting cashier payment or mark DUE
  const pendingConsultationSerials = consultationSerials.filter(
    (s) => s.status === "FORWARDED_TO_CASHIER",
  );
  // Settled / queued consultation serials
  const paidConsultationSerials = consultationSerials.filter(
    (s) => s.status !== "FORWARDED_TO_CASHIER" && s.status !== "CANCELLED",
  );

  const pendingSerialPatientIds = new Set(
    pendingConsultationSerials.map((s) => s.patientId),
  );
  const awaitingDueAptIds = new Set(
    therapyAwaitingDueClearance.map((a) => a.id),
  );

  // Filter physical therapy appointments + any appointment explicitly forwarded to Cashier (e.g. from Doctor/Handler)
  const therapyAppointments = appointments.filter(
    (a) =>
      a.status !== AppointmentStatus.CANCELLED &&
      (((a.type === AppointmentType.THERAPY || Boolean(a.therapySlotId)) &&
        (Boolean(a.therapySlotId) ||
          Boolean(a.invoiceId) ||
          (a.feeAmount ?? 0) > 0 ||
          (a.paidAmount ?? 0) > 0 ||
          a.paymentStatus === "PENDING")) ||
      (a.currentStation === "CASHIER_REGISTER" &&
        !pendingSerialPatientIds.has(a.patientId) &&
        !awaitingDueAptIds.has(a.id))),
  );

  // Split therapy/routed appointments by billing status
  const paidAppointments = therapyAppointments.filter(
    (a) =>
      a.status !== AppointmentStatus.CANCELLED &&
      (a.paymentStatus === "PAID" ||
        (Boolean(a.invoiceId) && (a.paidAmount ?? 0) > 0)) &&
      a.currentStation !== "CASHIER_REGISTER" &&
      Boolean(a.invoiceId || (a.paidAmount ?? 0) > 0),
  );
  const pendingAppointments = therapyAppointments.filter(
    (a) => {
      if (a.status === AppointmentStatus.CANCELLED) return false;
      if (a.paymentStatus === "PAID" && a.currentStation !== "CASHIER_REGISTER") return false;

      const fee = a.feeAmount ?? 0;
      const due = a.dueAmount ?? 0;
      const patientDue = a.patient?.totalDue ?? 0;
      const isAtCashier = a.currentStation === "CASHIER_REGISTER";

      // If fee is 0, due is 0, patient has no previous due, and not at Cashier, do not show 0 taka bill!
      if (fee === 0 && due === 0 && patientDue === 0 && !isAtCashier) {
        return false;
      }

      return (
        a.paymentStatus !== "PAID" ||
        isAtCashier ||
        (!a.invoiceId && (a.paidAmount ?? 0) === 0)
      );
    },
  );

  let totalCollected = 0;
  let cashCollected = 0;
  let cardCollected = 0;
  let mfsCollected = 0;
  let pendingCollection = 0;

  for (const a of therapyAppointments) {
    if (a.status === "CANCELLED") continue;
    const isPaid = a.paymentStatus === "PAID";
    const paid =
      a.paidAmount !== null && a.paidAmount !== undefined && (a.paidAmount > 0 || !isPaid)
        ? a.paidAmount
        : (isPaid ? (a.feeAmount ?? DEFAULT_FEE) : (a.paidAmount ?? 0));
    totalCollected += paid;
    if (a.paymentMethod === "CARD") cardCollected += paid;
    else if (a.paymentMethod === "MFS") mfsCollected += paid;
    else cashCollected += paid;

    const due =
      isPaid
        ? 0
        : (a.dueAmount !== null && a.dueAmount !== undefined
            ? a.dueAmount
            : Math.max(0, (a.feeAmount ?? DEFAULT_FEE) - paid));
    pendingCollection += due;
  }

  for (const s of consultationSerials) {
    const paid = s.paidAmount || 0;
    totalCollected += paid;
    const method = s.invoice?.paymentMethod || "CASH";
    if (method === "CARD") cardCollected += paid;
    else if (method === "MFS") mfsCollected += paid;
    else cashCollected += paid;
    const due = s.dueAmount || (s.paymentStatus === "DUE" ? s.feeAmount : Math.max(0, s.feeAmount - paid));
    pendingCollection += due;
  }

  for (const p of previousDuePayments) {
    const paid = p.amount || 0;
    totalCollected += paid;
    if (p.paymentMethod === "CARD") cardCollected += paid;
    else if (p.paymentMethod === "MFS") mfsCollected += paid;
    else cashCollected += paid;
  }

  return {
    selectedDate: targetDateStr,
    dayOfWeek: receptionistData.dayOfWeek,
    appointments,
    pendingAppointments,
    paidAppointments,
    consultationSerials,
    pendingConsultationSerials,
    paidConsultationSerials,
    therapyAwaitingDueClearance,
    slots: receptionistData.slots,
    patients: receptionistData.patients,
    totalPatientsCount: receptionistData.totalPatientsCount,
    stats: receptionistData.stats,
    billingStats: {
      totalCollected,
      pendingCollection,
      paidCount: paidAppointments.length + paidConsultationSerials.length,
      pendingCount: pendingAppointments.length + pendingConsultationSerials.length,
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
 * Collects payment for a therapy session and issues an invoice receipt.
 * Ensures the therapy appointment is tagged with invoiceId so checkout clearance is satisfied.
 */
export async function collectPaymentAction(params: {
  appointmentId: string;
  amount: number;
  paymentMethod: "CASH" | "CARD" | "MFS" | "DUE";
  isDue?: boolean;
  performerId?: string;
  pin?: string;
  notes?: string;
  previousDueCollected?: number;
  includeConsultationSerialId?: string;
  consultationAmount?: number;
}) {
  try {
    const sessionData = await requireAuth([
      Role.CASHIER,
      Role.ADMIN,
      Role.RECEPTIONIST,
    ]);

    const isExemptRole = sessionData.user.role === Role.ADMIN;
    if (!isExemptRole && params.performerId) {
      const { verifyPerformerPin } = await import("@/lib/performer-auth");
      const pinRes = await verifyPerformerPin(params.performerId, params.pin);
      if (!pinRes.valid) {
        return {
          success: false,
          message: pinRes.error || "Invalid 4-digit PIN for cashier.",
        };
      }
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: params.appointmentId },
      include: { patient: true, therapySlot: true },
    });

    if (!appointment) {
      return { success: false, message: "Appointment record not found." };
    }

    const feeAmount = appointment.feeAmount ?? DEFAULT_FEE;
    const isDue = params.isDue || params.paymentMethod === "DUE";
    const currentPaid = appointment.paidAmount ?? 0;
    const sessionPaid = isDue ? 0 : params.amount;
    const newPaid = isDue ? currentPaid : currentPaid + sessionPaid;
    const dueAmount = isDue ? Math.max(0, feeAmount - currentPaid) : Math.max(0, feeAmount - newPaid);
    const paymentStatus = isDue ? "DUE" : (dueAmount === 0 ? "PAID" : "PARTIAL");
    const previousDueCollected = !isDue && params.previousDueCollected ? params.previousDueCollected : 0;

    // Check if consultation serial is also bundled into this payment
    let extraConsultationAmount = 0;
    let includedSerial: any = null;
    if (params.includeConsultationSerialId) {
      includedSerial = await prisma.consultationSerial.findUnique({
        where: { id: params.includeConsultationSerialId },
        include: { doctor: true, patient: true },
      });
      if (includedSerial && includedSerial.paymentStatus !== "PAID") {
        extraConsultationAmount = !isDue
          ? (params.consultationAmount ?? includedSerial.feeAmount)
          : 0;
      }
    }

    // Session invoice line amounts (never mutate existing invoices; create clean fresh invoice)
    const therapyInvoiceAmount = isDue ? dueAmount : (currentPaid > 0 ? sessionPaid : feeAmount);
    const totalInvoiceAmount =
      therapyInvoiceAmount +
      (includedSerial ? includedSerial.feeAmount : 0) +
      previousDueCollected;
    const totalInvoicePaid = sessionPaid + extraConsultationAmount + previousDueCollected;
    const invoiceDueAmount = isDue
      ? (therapyInvoiceAmount + (includedSerial ? includedSerial.feeAmount : 0))
      : Math.max(0, totalInvoiceAmount - totalInvoicePaid);

    // Guaranteed sequential invoice number (e.g. INV-2026-0003)
    const invoiceNumber = await generateNextInvoiceNumber();

    const invoice = await prisma.patientInvoice.create({
      data: {
        invoiceNumber,
        patientId: appointment.patientId,
        visitId: appointment.visitId || undefined,
        totalAmount: totalInvoiceAmount,
        paidAmount: totalInvoicePaid,
        dueAmount: invoiceDueAmount,
        status: isDue ? "DUE" : (invoiceDueAmount === 0 ? "PAID" : "PARTIAL"),
        paymentMethod: params.paymentMethod,
        cashierPerformerId: params.performerId || undefined,
        notes: params.notes || undefined,
      },
    });

    // 1. Separate Physical Therapy and Doctor Consultation line item payment records
    const aptConsultFee = appointment.consultationFee ?? 0;
    const aptTherapyFee =
      appointment.therapyFee ??
      (aptConsultFee > 0 ? Math.max(0, feeAmount - aptConsultFee) : (appointment.type === AppointmentType.THERAPY ? feeAmount : 0));

    if (aptConsultFee > 0 && aptTherapyFee > 0) {
      // Split payment into Physical Therapy and Doctor Consultation itemized payments
      const therapyShare = Math.min(sessionPaid, aptTherapyFee);
      const consultShare = Math.max(0, sessionPaid - therapyShare);

      await prisma.patientPayment.create({
        data: {
          patientId: appointment.patientId,
          visitId: appointment.visitId || undefined,
          invoiceId: invoice.id,
          serviceType: "THERAPY",
          amount: therapyShare,
          paymentMethod: params.paymentMethod,
          isDue,
          cashierPerformerId: params.performerId || undefined,
          notes: params.notes || "Physical Therapy Fee",
        },
      });

      await prisma.patientPayment.create({
        data: {
          patientId: appointment.patientId,
          visitId: appointment.visitId || undefined,
          invoiceId: invoice.id,
          serviceType: "CONSULTATION",
          amount: consultShare,
          paymentMethod: params.paymentMethod,
          isDue,
          cashierPerformerId: params.performerId || undefined,
          notes: params.notes || "Doctor Consultation Fee",
        },
      });
    } else {
      await prisma.patientPayment.create({
        data: {
          patientId: appointment.patientId,
          visitId: appointment.visitId || undefined,
          invoiceId: invoice.id,
          serviceType:
            appointment.type === AppointmentType.CONSULTATION || aptConsultFee > 0
              ? "CONSULTATION"
              : "THERAPY",
          amount: sessionPaid,
          paymentMethod: params.paymentMethod,
          isDue,
          cashierPerformerId: params.performerId || undefined,
          notes: params.notes || undefined,
        },
      });
    }

    // 2. Separate Doctor Consultation line item payment record (if bundled)
    if (includedSerial) {
      await prisma.patientPayment.create({
        data: {
          patientId: appointment.patientId,
          visitId: appointment.visitId || undefined,
          invoiceId: invoice.id,
          serviceType: "CONSULTATION",
          amount: extraConsultationAmount,
          paymentMethod: params.paymentMethod,
          isDue,
          cashierPerformerId: params.performerId || undefined,
          notes: `Doctor Consultation Serial #${includedSerial.serialNumber}`,
        },
      });

      await prisma.consultationSerial.update({
        where: { id: includedSerial.id },
        data: {
          paidAmount: extraConsultationAmount,
          dueAmount: Math.max(0, includedSerial.feeAmount - extraConsultationAmount),
          paymentStatus: isDue ? "DUE" : (extraConsultationAmount >= includedSerial.feeAmount ? "PAID" : "PARTIAL"),
          status: "QUEUED",
          invoiceId: invoice.id,
          cashierPerformerId: params.performerId || undefined,
        },
      });

      emitRealtimeEvent("CONSULTATION_QUEUED", {
        serialId: includedSerial.id,
        serialNumber: includedSerial.serialNumber,
        patientId: includedSerial.patientId,
        patientName: appointment.patient.name,
        invoiceNumber,
      });
    }

    // 3. Separate Previous Due line item payment record
    if (previousDueCollected > 0 && !isDue) {
      await prisma.patientPayment.create({
        data: {
          patientId: appointment.patientId,
          visitId: appointment.visitId || undefined,
          invoiceId: invoice.id,
          serviceType: "PREVIOUS_DUE",
          amount: previousDueCollected,
          paymentMethod: params.paymentMethod,
          isDue: false,
          cashierPerformerId: params.performerId || undefined,
          notes: `Previous outstanding balance clearance (${params.notes || ""})`.trim(),
        },
      });
    }

    const shouldMoveToReception =
      (appointment.currentStation === "CASHIER_REGISTER" ||
        Boolean(appointment.outTherapyTime) ||
        appointment.routingOrigin === "THERAPY") &&
      appointment.status === AppointmentStatus.CHECKED_IN;

    const updated = await prisma.appointment.update({
      where: { id: params.appointmentId },
      data: {
        feeAmount,
        paidAmount: newPaid,
        dueAmount,
        paymentStatus,
        paidAt: isDue ? appointment.paidAt : new Date(),
        paymentMethod: params.paymentMethod,
        invoiceId: invoice.id,
        notes: params.notes || appointment.notes,
        ...(shouldMoveToReception
          ? { currentStation: "RECEPTIONIST_DESK", queueType: null }
          : {}),
      },
      include: {
        patient: true,
        therapySlot: { include: { room: true } },
        room: true,
        invoice: {
          include: { payments: true },
        },
      },
    });

    // Synchronize billing
    const { syncBillingForAppointment, syncBillingForPatient } = await import("@/lib/billing-sync");
    await syncBillingForAppointment(updated.id);
    await syncBillingForPatient(appointment.patientId);

    // Fetch complete invoice with relation
    const fullInvoice = await prisma.patientInvoice.findUnique({
      where: { id: invoice.id },
      include: { payments: true },
    });

    // Step Log
    if (appointment.visitId) {
      await prisma.patientStepLog.create({
        data: {
          patientId: appointment.patientId,
          visitId: appointment.visitId,
          step: isDue ? "BILL_MARKED_DUE" : "BILL_COLLECTED",
          station: updated.currentStation || "CASHIER_REGISTER",
          performerId: params.performerId || null,
          details: `Invoice ${invoiceNumber} issued (${isDue ? "MARKED AS DUE" : `PAID ৳${totalInvoicePaid}`})${shouldMoveToReception ? " • Returned to Receptionist Desk" : ""}`,
        },
      });
    }

    await logAudit({
      userId: sessionData.user.id,
      performerId: params.performerId || null,
      action: AuditAction.APPOINTMENT_UPDATE,
      entity: "Appointment",
      entityId: updated.id,
      status: AuditStatus.SUCCESS,
      details: {
        action: isDue ? "THERAPY_MARKED_DUE" : "PAYMENT_COLLECTED",
        patientName: updated.patient.name,
        amount: isDue ? 0 : totalInvoicePaid,
        method: params.paymentMethod,
        invoiceNumber,
      },
    });

    emitRealtimeEvent("APPOINTMENT_UPDATED", {
      id: updated.id,
      status: updated.status,
      currentStation: updated.currentStation,
      paymentStatus: updated.paymentStatus,
      feeAmount: updated.feeAmount,
      date: updated.appointmentDate.toISOString().split("T")[0],
    });

    emitRealtimeEvent("PAYMENT_COLLECTED", {
      appointmentId: updated.id,
      patientId: updated.patientId,
      patientName: updated.patient.name,
      invoiceNumber,
      amount: totalInvoicePaid,
      paymentStatus: updated.paymentStatus,
    });

    emitRealtimeEvent("INVOICE_UPDATED", {
      invoiceId: invoice.id,
      invoiceNumber,
      patientId: updated.patientId,
    });

    if (shouldMoveToReception) {
      emitRealtimeEvent("STATION_CHANGED", {
        appointmentId: updated.id,
        patientId: updated.patientId,
        patientName: updated.patient.name,
        fromStation: "CASHIER_REGISTER",
        toStation: "RECEPTIONIST_DESK",
        status: updated.status,
      });
    }

    revalidatePath("/cashier");
    revalidatePath("/receptionist");
    revalidatePath("/doctor");
    revalidatePath("/handler");
    revalidatePath("/admin/tracking");

    return {
      success: true,
      message: isDue
        ? `Therapy fee marked as DUE for ${updated.patient.name}. Invoice ${invoiceNumber} issued.`
        : `Payment of ৳${totalInvoicePaid} collected via ${params.paymentMethod} for ${updated.patient.name}${previousDueCollected > 0 ? ` (including ৳${previousDueCollected} previous due)` : ""}. Invoice ${invoiceNumber} issued.`,
      appointment: updated,
      invoice: fullInvoice,
    };
  } catch (err) {
    console.error("[Collect Payment Error]:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Failed to collect payment.",
    };
  }
}

/**
 * Collects payment or marks as DUE for a Doctor Consultation Serial.
 * Prints thermal receipt invoice and AUTOMATICALLY PLACES THE PATIENT
 * INTO THE DOCTOR CONSULTATION QUEUE in the Designated Public Waiting Room.
 */
export async function processConsultationBillingAction(params: {
  consultationSerialId: string;
  amount: number;
  paymentMethod: "CASH" | "CARD" | "MFS" | "DUE";
  isDue?: boolean;
  performerId?: string;
  pin?: string;
  notes?: string;
  previousDueCollected?: number;
  includeTherapyAppointmentId?: string;
  therapyAmount?: number;
}) {
  try {
    const sessionData = await requireAuth([
      Role.CASHIER,
      Role.ADMIN,
      Role.RECEPTIONIST,
    ]);

    const isExemptRole = sessionData.user.role === Role.ADMIN;
    if (!isExemptRole && params.performerId) {
      const { verifyPerformerPin } = await import("@/lib/performer-auth");
      const pinRes = await verifyPerformerPin(params.performerId, params.pin);
      if (!pinRes.valid) {
        return {
          success: false,
          message: pinRes.error || "Invalid 4-digit PIN for cashier.",
        };
      }
    }

    const serial = await prisma.consultationSerial.findUnique({
      where: { id: params.consultationSerialId },
      include: { patient: true, doctor: true, visit: true },
    });

    if (!serial) {
      return { success: false, message: "Consultation serial record not found." };
    }

    const feeAmount = serial.feeAmount;
    const isDue = params.isDue || params.paymentMethod === "DUE";
    const currentPaid = serial.paidAmount ?? 0;
    const paidAmount = isDue ? 0 : Math.min(feeAmount, params.amount);
    const newPaid = isDue ? currentPaid : currentPaid + paidAmount;
    const dueAmount = isDue ? feeAmount : Math.max(0, feeAmount - newPaid);
    const paymentStatus = isDue ? "DUE" : (dueAmount === 0 ? "PAID" : "PARTIAL");
    const previousDueCollected = !isDue && params.previousDueCollected ? params.previousDueCollected : 0;

    // Check if therapy appointment is bundled into this payment
    let extraTherapyAmount = 0;
    let includedTherapyApt: any = null;
    if (params.includeTherapyAppointmentId) {
      includedTherapyApt = await prisma.appointment.findUnique({
        where: { id: params.includeTherapyAppointmentId },
        include: { therapySlot: true },
      });
      if (includedTherapyApt && includedTherapyApt.paymentStatus !== "PAID") {
        extraTherapyAmount = !isDue
          ? (params.therapyAmount ?? includedTherapyApt.feeAmount ?? DEFAULT_FEE)
          : 0;
      }
    }

    // Clean session amounts: never mutate existing invoices; create clean fresh invoice
    const consultInvoiceAmount = isDue ? dueAmount : (currentPaid > 0 ? paidAmount : feeAmount);
    const totalInvoiceAmount =
      consultInvoiceAmount +
      (includedTherapyApt ? (includedTherapyApt.feeAmount ?? DEFAULT_FEE) : 0) +
      previousDueCollected;
    const totalInvoicePaid = paidAmount + extraTherapyAmount + previousDueCollected;
    const invoiceDueAmount = isDue
      ? (consultInvoiceAmount + (includedTherapyApt ? (includedTherapyApt.feeAmount ?? DEFAULT_FEE) : 0))
      : Math.max(0, totalInvoiceAmount - totalInvoicePaid);

    // Guaranteed sequential invoice number (e.g. INV-2026-0003)
    const invoiceNumber = await generateNextInvoiceNumber();

    const invoice = await prisma.patientInvoice.create({
      data: {
        invoiceNumber,
        patientId: serial.patientId,
        visitId: serial.visitId || undefined,
        totalAmount: totalInvoiceAmount,
        paidAmount: totalInvoicePaid,
        dueAmount: invoiceDueAmount,
        status: isDue ? "DUE" : (invoiceDueAmount === 0 ? "PAID" : "PARTIAL"),
        paymentMethod: params.paymentMethod,
        cashierPerformerId: params.performerId || undefined,
        notes: params.notes || undefined,
      },
    });

    // 1. Separate Doctor Consultation line item payment record
    await prisma.patientPayment.create({
      data: {
        patientId: serial.patientId,
        visitId: serial.visitId || undefined,
        invoiceId: invoice.id,
        serviceType: "CONSULTATION",
        amount: paidAmount,
        paymentMethod: params.paymentMethod,
        isDue,
        cashierPerformerId: params.performerId || undefined,
        notes: params.notes || undefined,
      },
    });

    // 2. Separate Physical Therapy line item payment record (if bundled)
    if (includedTherapyApt) {
      await prisma.patientPayment.create({
        data: {
          patientId: serial.patientId,
          visitId: serial.visitId || undefined,
          invoiceId: invoice.id,
          serviceType: "THERAPY",
          amount: extraTherapyAmount,
          paymentMethod: params.paymentMethod,
          isDue,
          cashierPerformerId: params.performerId || undefined,
          notes: `Physical Therapy Session (${includedTherapyApt.therapySlot?.label || "Floor"})`,
        },
      });

      await prisma.appointment.update({
        where: { id: includedTherapyApt.id },
        data: {
          paidAmount: extraTherapyAmount,
          dueAmount: Math.max(0, (includedTherapyApt.feeAmount ?? DEFAULT_FEE) - extraTherapyAmount),
          paymentStatus: isDue ? "DUE" : (extraTherapyAmount >= (includedTherapyApt.feeAmount ?? DEFAULT_FEE) ? "PAID" : "PARTIAL"),
          status: AppointmentStatus.CHECKED_IN,
          currentStation: "THERAPY_ROOM",
          invoiceId: invoice.id,
        },
      });

      emitRealtimeEvent("APPOINTMENT_UPDATED", {
        id: includedTherapyApt.id,
        status: AppointmentStatus.CHECKED_IN,
        paymentStatus: isDue ? "DUE" : "PAID",
      });
    }

    // 3. Separate Previous Due line item payment record
    if (previousDueCollected > 0 && !isDue) {
      await prisma.patientPayment.create({
        data: {
          patientId: serial.patientId,
          visitId: serial.visitId || undefined,
          invoiceId: invoice.id,
          serviceType: "PREVIOUS_DUE",
          amount: previousDueCollected,
          paymentMethod: params.paymentMethod,
          isDue: false,
          cashierPerformerId: params.performerId || undefined,
          notes: `Previous outstanding balance clearance (${params.notes || ""})`.trim(),
        },
      });
    }

    // Check if the consultation serial is scheduled for the SAME DAY (today)
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0,
    );
    const endOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999,
    );
    const isSameDay =
      serial.appointmentDate >= startOfToday &&
      serial.appointmentDate <= endOfToday;

    // Strict Guard: ONLY place into QUEUED if scheduled for TODAY
    const targetStatus = isSameDay ? "QUEUED" : "CONFIRMED";

    // Update ConsultationSerial
    const updatedSerial = await prisma.consultationSerial.update({
      where: { id: serial.id },
      data: {
        paidAmount,
        dueAmount,
        paymentStatus,
        status: targetStatus,
        invoiceId: invoice.id,
        cashierPerformerId: params.performerId || undefined,
      },
      include: {
        doctor: true,
        patient: true,
        invoice: {
          include: { payments: true },
        },
      },
    });

    let returnMessage = "";

    if (isSameDay) {
      // Ensure corresponding consultation Appointment in Waiting Room
      const { getPublicWaitingRoom } = await import(
        "@/actions/receptionist/patient.action"
      );
      const waitingRoom = await getPublicWaitingRoom();

      const existingApt = await prisma.appointment.findFirst({
        where: {
          patientId: serial.patientId,
          appointmentDate: {
            gte: startOfToday,
            lte: endOfToday,
          },
          type: AppointmentType.CONSULTATION,
          status: {
            notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.COMPLETED],
          },
        },
        orderBy: { createdAt: "desc" },
      });

      if (existingApt) {
        await prisma.appointment.update({
          where: { id: existingApt.id },
          data: {
            queueType: QueueType.CONSULTATION,
            status: AppointmentStatus.CHECKED_IN,
            currentStation: "CONSULTATION_ROOM",
            roomId: waitingRoom.id,
            visitId: serial.visitId || existingApt.visitId || undefined,
            checkInTime: existingApt.checkInTime || now,
            checkOutTime: null,
            doctorId: serial.doctorId,
            invoiceId: invoice.id,
            feeAmount: 0, // Consultation fee is exclusively on ConsultationSerial
            paidAmount: 0,
            dueAmount: 0,
            paymentStatus: "PAID",
            notes: serial.notes || existingApt.notes || undefined,
          },
        });
      } else {
        await prisma.appointment.create({
          data: {
            type: AppointmentType.CONSULTATION,
            queueType: QueueType.CONSULTATION,
            status: AppointmentStatus.CHECKED_IN,
            currentStation: "CONSULTATION_ROOM",
            roomId: waitingRoom.id,
            patientId: serial.patientId,
            visitId: serial.visitId || undefined,
            checkInTime: now,
            checkOutTime: null,
            doctorId: serial.doctorId,
            gender: serial.patient.gender,
            invoiceId: invoice.id,
            feeAmount: 0,
            paidAmount: 0,
            dueAmount: 0,
            paymentStatus: "PAID",
            notes: serial.notes || undefined,
          },
        });
      }

      // Step Log
      if (serial.visitId) {
        await prisma.patientStepLog.create({
          data: {
            patientId: serial.patientId,
            visitId: serial.visitId,
            step: isDue ? "BILL_MARKED_DUE" : "BILL_COLLECTED",
            station: "CASHIER_REGISTER",
            roomNumber: waitingRoom.number,
            performerId: params.performerId || null,
            details: `Invoice ${invoiceNumber} issued (${isDue ? "MARKED AS DUE" : `PAID ৳${paidAmount}`})`,
          },
        });
        await prisma.patientStepLog.create({
          data: {
            patientId: serial.patientId,
            visitId: serial.visitId,
            step: "QUEUED_FOR_DOCTOR",
            station: "CONSULTATION_ROOM",
            roomNumber: waitingRoom.number,
            doctorId: serial.doctorId,
            details: `Placed into Doctor Consultation Queue (Serial #${serial.serialNumber}) for Dr. ${serial.doctor?.name || "Doctor"} in Waiting Room (${waitingRoom.number})`,
          },
        });
      }

      // Sync lifetime billing totals on patient
      const { syncBillingForPatient } = await import("@/lib/billing-sync");
      await syncBillingForPatient(serial.patientId);

      // Realtime events
      emitRealtimeEvent("CONSULTATION_QUEUED", {
        serialId: serial.id,
        serialNumber: serial.serialNumber,
        patientId: serial.patientId,
        patientName: serial.patient.name,
        doctorId: serial.doctorId,
        doctorName: serial.doctor?.name,
        invoiceNumber,
        paymentStatus,
        roomNumber: waitingRoom.number,
        notes: serial.notes,
      });
      emitRealtimeEvent("APPOINTMENT_UPDATED", {
        patientId: serial.patientId,
        patientName: serial.patient.name,
        status: AppointmentStatus.CHECKED_IN,
        currentStation: "CONSULTATION_ROOM",
        roomNumber: waitingRoom.number,
      });

      returnMessage = `Invoice ${invoiceNumber} printed for ${serial.patient.name}. Consultation Serial #${serial.serialNumber} placed into Doctor Consultation Queue for Dr. ${serial.doctor?.name || "Doctor"}.`;
    } else {
      // Future or different date: Billed, but NOT queued for today!
      const formattedDate = new Date(serial.appointmentDate).toLocaleDateString(
        "en-US",
        { month: "short", day: "numeric", year: "numeric" },
      );

      if (serial.visitId) {
        await prisma.patientStepLog.create({
          data: {
            patientId: serial.patientId,
            visitId: serial.visitId,
            step: isDue ? "BILL_MARKED_DUE" : "BILL_COLLECTED",
            station: "CASHIER_REGISTER",
            performerId: params.performerId || null,
            details: `Advance invoice ${invoiceNumber} issued (${isDue ? "MARKED AS DUE" : `PAID ৳${paidAmount}`}) for Consultation Serial #${serial.serialNumber} scheduled on ${formattedDate}`,
          },
        });
      }

      const { syncBillingForPatient } = await import("@/lib/billing-sync");
      await syncBillingForPatient(serial.patientId);

      emitRealtimeEvent("APPOINTMENT_UPDATED", {
        patientId: serial.patientId,
        patientName: serial.patient.name,
        status: AppointmentStatus.CONFIRMED,
        paymentStatus,
      });

      returnMessage = `Invoice ${invoiceNumber} printed for ${serial.patient.name}. Consultation Serial #${serial.serialNumber} is scheduled for ${formattedDate} (patient will enter queue on appointment date upon arrival).`;
    }

    revalidatePath("/cashier");
    revalidatePath("/receptionist");
    revalidatePath("/doctor");
    revalidatePath("/admin/tracking");

    const fullInvoice = await prisma.patientInvoice.findUnique({
      where: { id: invoice.id },
      include: { payments: true },
    });

    return {
      success: true,
      message: returnMessage,
      invoice: fullInvoice,
      serial: updatedSerial,
    };
  } catch (err) {
    console.error("[Process Consultation Billing Error]:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Failed to process consultation billing.",
    };
  }
}

/**
 * Clears or marks DUE previous outstanding balance for a patient,
 * and if an appointmentId is provided (e.g. Scenario 7 therapy arrival awaiting due clearance),
 * auto-places the patient into the Therapy Queue.
 */
export async function clearPreviousDueAction(params: {
  patientId: string;
  appointmentId?: string;
  amount: number;
  paymentMethod: "CASH" | "CARD" | "MFS" | "DUE";
  isDue?: boolean;
  performerId?: string;
  pin?: string;
  notes?: string;
}) {
  try {
    const sessionData = await requireAuth([
      Role.CASHIER,
      Role.ADMIN,
      Role.RECEPTIONIST,
    ]);

    const isExemptRole = sessionData.user.role === Role.ADMIN;
    if (!isExemptRole && params.performerId) {
      const { verifyPerformerPin } = await import("@/lib/performer-auth");
      const pinRes = await verifyPerformerPin(params.performerId, params.pin);
      if (!pinRes.valid) {
        return {
          success: false,
          message: pinRes.error || "Invalid 4-digit PIN for cashier.",
        };
      }
    }

    const patient = await prisma.patient.findUnique({
      where: { id: params.patientId },
    });
    if (!patient) {
      return { success: false, message: "Patient record not found." };
    }

    const isDue = params.isDue || params.paymentMethod === "DUE";
    const amountToPay = isDue ? 0 : Math.max(0, params.amount);

    let invoice = null;

    if (!isDue && amountToPay > 0) {
      const invoiceNumber = await generateNextInvoiceNumber();

      invoice = await prisma.patientInvoice.create({
        data: {
          invoiceNumber,
          patientId: patient.id,
          totalAmount: amountToPay,
          paidAmount: amountToPay,
          dueAmount: 0,
          status: "PAID",
          paymentMethod: params.paymentMethod,
          cashierPerformerId: params.performerId || undefined,
          notes: params.notes || "Previous outstanding balance clearance",
        },
      });

      await prisma.patientPayment.create({
        data: {
          patientId: patient.id,
          invoiceId: invoice.id,
          serviceType: "PREVIOUS_DUE",
          amount: amountToPay,
          paymentMethod: params.paymentMethod,
          isDue: false,
          cashierPerformerId: params.performerId || undefined,
          notes: params.notes || "Previous outstanding balance payment",
        },
      });
    }

    // Recalculate lifetime totalBill, totalPaid, totalDue
    const { syncBillingForPatient } = await import("@/lib/billing-sync");
    await syncBillingForPatient(patient.id);

    // If an appointment was linked (e.g. Scenario 7 therapy arrival waiting for due clearance)
    if (params.appointmentId) {
      const apt = await prisma.appointment.findUnique({
        where: { id: params.appointmentId },
        include: { therapySlot: true, room: true },
      });

      if (apt) {
        const alreadyDoneTherapy =
          Boolean(apt.outTherapyTime) ||
          apt.routingOrigin === "THERAPY" ||
          apt.currentStation === "CASHIER_REGISTER";

        if (alreadyDoneTherapy) {
          await prisma.appointment.update({
            where: { id: apt.id },
            data: {
              queueType: null,
              currentStation: "RECEPTIONIST_DESK",
              status: AppointmentStatus.CHECKED_IN,
            },
          });

          if (apt.visitId) {
            await prisma.patientStepLog.create({
              data: {
                patientId: patient.id,
                visitId: apt.visitId,
                step: isDue ? "DUE_ACKNOWLEDGED" : "DUE_COLLECTED",
                station: "RECEPTIONIST_DESK",
                performerId: params.performerId || null,
                details: isDue
                  ? `Previous due acknowledged as DUE -> Forwarded to Receptionist Desk`
                  : `Previous due of ৳${amountToPay} settled -> Forwarded to Receptionist Desk`,
              },
            });
          }

          emitRealtimeEvent("STATION_CHANGED", {
            appointmentId: apt.id,
            patientId: patient.id,
            patientName: patient.name,
            fromStation: "CASHIER_REGISTER",
            toStation: "RECEPTIONIST_DESK",
            status: AppointmentStatus.CHECKED_IN,
          });
          emitRealtimeEvent("APPOINTMENT_UPDATED", {
            id: apt.id,
            status: AppointmentStatus.CHECKED_IN,
            currentStation: "RECEPTIONIST_DESK",
            queueType: null,
          });
        } else {
          await prisma.appointment.update({
            where: { id: apt.id },
            data: {
              queueType: QueueType.THERAPY,
              currentStation: "THERAPY_ROOM",
              status: AppointmentStatus.CHECKED_IN,
              checkOutTime: null,
            },
          });

          // Step log
          if (apt.visitId) {
            await prisma.patientStepLog.create({
              data: {
                patientId: patient.id,
                visitId: apt.visitId,
                step: isDue ? "DUE_ACKNOWLEDGED_QUEUED" : "DUE_COLLECTED_QUEUED",
                station: "THERAPY_ROOM",
                performerId: params.performerId || null,
                details: isDue
                  ? `Previous due acknowledged as DUE -> Placed into Therapy Queue (${apt.therapySlot?.label || "Session"})`
                  : `Previous due of ৳${amountToPay} collected -> Placed into Therapy Queue (${apt.therapySlot?.label || "Session"})`,
              },
            });
          }

          // Realtime events
          emitRealtimeEvent("PATIENT_QUEUED_FOR_THERAPY", {
            appointmentId: apt.id,
            patientId: patient.id,
            patientName: patient.name,
            slotLabel: apt.therapySlot?.label,
          });
          emitRealtimeEvent("APPOINTMENT_UPDATED", {
            id: apt.id,
            status: AppointmentStatus.CHECKED_IN,
            currentStation: "THERAPY_ROOM",
            queueType: QueueType.THERAPY,
          });
        }
      }
    }

    // Always broadcast PAYMENT_COLLECTED & PATIENT_UPDATED so all dashboards update due balances immediately
    emitRealtimeEvent("PAYMENT_COLLECTED", {
      patientId: patient.id,
      patientName: patient.name,
      appointmentId: params.appointmentId || null,
      amountPaid: amountToPay,
      isDue,
      serviceType: "PREVIOUS_DUE",
      invoiceNumber: invoice?.invoiceNumber || null,
    });
    emitRealtimeEvent("PATIENT_UPDATED", {
      id: patient.id,
      name: patient.name,
    });

    const fullInvoice = invoice
      ? await prisma.patientInvoice.findUnique({
          where: { id: invoice.id },
          include: { payments: true },
        })
      : null;

    revalidatePath("/cashier");
    revalidatePath("/receptionist");
    revalidatePath("/handler");
    revalidatePath("/admin/tracking");

    return {
      success: true,
      message: isDue
        ? `Previous balance of ${patient.name} acknowledged as DUE. Patient placed into Therapy Queue.`
        : `Payment of ৳${amountToPay} collected for ${patient.name}. Patient placed into Therapy Queue.`,
      invoice: fullInvoice,
    };
  } catch (err) {
    console.error("[Clear Previous Due Error]:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Failed to clear previous due.",
    };
  }
}

