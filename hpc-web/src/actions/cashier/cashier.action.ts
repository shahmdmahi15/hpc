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

  const [receptionistData, cashierPerformers, doctorUsers, consultationSerials] =
    await Promise.all([
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
          invoice: true,
        },
        orderBy: { serialNumber: "asc" },
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

  // Filter strictly physical therapy appointments (consultation appointments are tracked via consultationSerials)
  const therapyAppointments = appointments.filter(
    (a) =>
      (a.type === AppointmentType.THERAPY || Boolean(a.therapySlotId)) &&
      (Boolean(a.therapySlotId) ||
        Boolean(a.invoiceId) ||
        (a.feeAmount ?? 0) > 0 ||
        (a.paidAmount ?? 0) > 0),
  );

  // Split therapy appointments by billing status
  const paidAppointments = therapyAppointments.filter(
    (a) => a.paymentStatus === "PAID",
  );
  const pendingAppointments = therapyAppointments.filter(
    (a) => a.paymentStatus !== "PAID" && a.status !== "CANCELLED",
  );

  // Scenario 7: Therapy arrivals awaiting previous due clearance before entering therapy queue
  const therapyAwaitingDueClearance = appointments.filter(
    (a) =>
      (a.type === AppointmentType.THERAPY || Boolean(a.therapySlotId)) &&
      a.status === AppointmentStatus.CHECKED_IN &&
      a.queueType === null &&
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
    cashCollected += paid;
    const due = s.dueAmount || (s.paymentStatus === "DUE" ? s.feeAmount : Math.max(0, s.feeAmount - paid));
    pendingCollection += due;
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
    const newPaid = isDue ? currentPaid : currentPaid + params.amount;
    const dueAmount = isDue ? Math.max(0, feeAmount - currentPaid) : Math.max(0, feeAmount - newPaid);
    const paymentStatus = isDue ? "DUE" : (dueAmount === 0 ? "PAID" : "PARTIAL");

    // Generate Invoice Number
    const currentYear = new Date().getFullYear();
    const invoiceCount = await prisma.patientInvoice.count();
    const invoiceNumber = `INV-${currentYear}-${String(invoiceCount + 1).padStart(4, "0")}`;

    const invoice = await prisma.patientInvoice.create({
      data: {
        invoiceNumber,
        patientId: appointment.patientId,
        visitId: appointment.visitId || undefined,
        totalAmount: feeAmount,
        paidAmount: isDue ? 0 : params.amount,
        dueAmount,
        status: isDue ? "DUE" : (dueAmount === 0 ? "PAID" : "PARTIAL"),
        paymentMethod: params.paymentMethod,
        cashierPerformerId: params.performerId || undefined,
        notes: params.notes || undefined,
      },
    });

    await prisma.patientPayment.create({
      data: {
        patientId: appointment.patientId,
        visitId: appointment.visitId || undefined,
        invoiceId: invoice.id,
        serviceType: "THERAPY",
        amount: isDue ? 0 : params.amount,
        paymentMethod: params.paymentMethod,
        isDue,
        cashierPerformerId: params.performerId || undefined,
        notes: params.notes || undefined,
      },
    });

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
      },
      include: {
        patient: true,
        therapySlot: { include: { room: true } },
        room: true,
      },
    });

    // Synchronize billing
    const { syncBillingForAppointment } = await import("@/lib/billing-sync");
    await syncBillingForAppointment(updated.id);

    // Step Log
    if (appointment.visitId) {
      await prisma.patientStepLog.create({
        data: {
          patientId: appointment.patientId,
          visitId: appointment.visitId,
          step: isDue ? "BILL_MARKED_DUE" : "BILL_COLLECTED",
          station: "CASHIER_REGISTER",
          performerId: params.performerId || null,
          details: `Therapy session invoice ${invoiceNumber} issued (${isDue ? "MARKED AS DUE" : `PAID ৳${params.amount}`})`,
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
        amount: isDue ? 0 : params.amount,
        method: params.paymentMethod,
        invoiceNumber,
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
      message: isDue
        ? `Therapy fee marked as DUE for ${updated.patient.name}. Invoice ${invoiceNumber} issued.`
        : `Payment of ৳${params.amount} collected via ${params.paymentMethod} for ${updated.patient.name}. Invoice ${invoiceNumber} issued.`,
      appointment: updated,
      invoice,
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
    const paidAmount = isDue ? 0 : Math.min(feeAmount, params.amount);
    const dueAmount = isDue ? feeAmount : Math.max(0, feeAmount - paidAmount);
    const paymentStatus = isDue ? "DUE" : (dueAmount === 0 ? "PAID" : "PARTIAL");

    // Generate Invoice Number (e.g. INV-2026-0042)
    const currentYear = new Date().getFullYear();
    const invoiceCount = await prisma.patientInvoice.count();
    const invoiceNumber = `INV-${currentYear}-${String(invoiceCount + 1).padStart(4, "0")}`;

    const invoice = await prisma.patientInvoice.create({
      data: {
        invoiceNumber,
        patientId: serial.patientId,
        visitId: serial.visitId || undefined,
        totalAmount: feeAmount,
        paidAmount,
        dueAmount,
        status: isDue ? "DUE" : (dueAmount === 0 ? "PAID" : "PARTIAL"),
        paymentMethod: params.paymentMethod,
        cashierPerformerId: params.performerId || undefined,
        notes: params.notes || undefined,
      },
    });

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

    // If previous due was also collected concurrently
    if (params.previousDueCollected && params.previousDueCollected > 0 && !isDue) {
      await prisma.patientPayment.create({
        data: {
          patientId: serial.patientId,
          visitId: serial.visitId || undefined,
          invoiceId: invoice.id,
          serviceType: "PREVIOUS_DUE",
          amount: params.previousDueCollected,
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
      include: { doctor: true, patient: true, invoice: true },
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
        },
      });

      if (existingApt) {
        await prisma.appointment.update({
          where: { id: existingApt.id },
          data: {
            queueType: QueueType.CONSULTATION,
            status: AppointmentStatus.CHECKED_IN,
            currentStation: "CONSULTATION_ROOM",
            roomId: waitingRoom.id,
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

    return {
      success: true,
      message: returnMessage,
      invoice,
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
      const currentYear = new Date().getFullYear();
      const invoiceCount = await prisma.patientInvoice.count();
      const invoiceNumber = `INV-${currentYear}-${String(invoiceCount + 1).padStart(4, "0")}`;

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
        await prisma.appointment.update({
          where: { id: apt.id },
          data: {
            queueType: QueueType.THERAPY,
            currentStation: "THERAPY_ROOM",
            status: AppointmentStatus.CHECKED_IN,
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

    revalidatePath("/cashier");
    revalidatePath("/receptionist");
    revalidatePath("/handler");
    revalidatePath("/admin/tracking");

    return {
      success: true,
      message: isDue
        ? `Previous balance of ${patient.name} acknowledged as DUE. Patient placed into Therapy Queue.`
        : `Payment of ৳${amountToPay} collected for ${patient.name}. Patient placed into Therapy Queue.`,
      invoice,
    };
  } catch (err) {
    console.error("[Clear Previous Due Error]:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Failed to clear previous due.",
    };
  }
}

