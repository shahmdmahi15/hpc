"use server";

import { requireAuth } from "@/lib/guard";
import { Role } from "@/generated/prisma/enums";
import prisma from "@/lib/prisma";
import {
  getBSTDateString,
  getStartAndEndOfBSTDay,
} from "@/lib/date";

export type PerformanceFilter =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "this_month"
  | "all"
  | "custom";

export interface PerformanceFilterParams {
  filter: PerformanceFilter;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
}

export interface DoctorPerformanceMetric {
  doctorId: string;
  name: string;
  email: string | null;
  whatsapp: string | null;
  consultationFee: number;
  totalConsultations: number;
  completedConsultations: number;
  totalTimeSpentMinutes: number;
  avgConsultationMinutes: number;
  totalEarningsBDT: number;
  prescriptionsWritten: number;
  treatmentPlansCreated: number;
  uniquePatientsCount: number;
  mostUsedMedicines: {
    name: string;
    count: number;
    mealTiming?: string;
  }[];
  topDiagnoses: {
    diagnosis: string;
    count: number;
  }[];
  topModalities: {
    modality: string;
    count: number;
  }[];
}

export interface ReceptionistPerformanceMetric {
  performerId: string;
  name: string;
  phone: string;
  whatsapp: string;
  role: string;
  totalCheckIns: number;
  regularBookingsCount: number;
  extraBookingsCount: number;
  consultationSerialsIssued: number;
  totalBookings: number;
  uniquePatientsHandled: number;
  stepLogsCount: number;
}

export interface CashierPerformanceMetric {
  performerId: string;
  name: string;
  phone: string;
  whatsapp: string;
  role: string;
  invoicesCleared: number;
  invoicesPartial: number;
  invoicesDue: number;
  totalInvoicesHandled: number;
  totalCollectedBDT: number;
  totalDueMarkedBDT: number;
  cashBDT: number;
  cardBDT: number;
  mfsBDT: number;
  cashTransactionsCount: number;
  cardTransactionsCount: number;
  mfsTransactionsCount: number;
  totalTransactionsCount: number;
  uniquePatientsBilled: number;
  avgTransactionBDT: number;
}

export interface HandlerPerformanceMetric {
  performerId: string;
  name: string;
  phone: string;
  whatsapp: string;
  role: string;
  therapySessionsCompleted: number;
  inTherapyActive: number;
  totalBedMinutes: number;
  avgSessionMinutes: number;
  modalitiesHandled: {
    name: string;
    count: number;
    totalMinutes: number;
  }[];
  uniquePatientsTreated: number;
  roomsCovered: string[];
}

export interface ClinicWidePerformanceSummary {
  dateRangeLabel: string;
  filter: PerformanceFilter;
  startDateStr: string;
  endDateStr: string;
  totalDoctorsActive: number;
  totalDoctorEarningsBDT: number;
  totalDoctorConsultations: number;
  totalPrescriptions: number;
  totalReceptionCheckIns: number;
  totalReceptionBookings: number;
  totalCashierCollectedBDT: number;
  totalCashierInvoicesCleared: number;
  totalCashierDueMarkedBDT: number;
  totalHandlerTherapySessions: number;
  totalHandlerBedMinutes: number;
  topMedicinesClinicWide: {
    name: string;
    count: number;
  }[];
  topModalitiesClinicWide: {
    name: string;
    count: number;
  }[];
}

export interface StaffPerformanceReportData {
  summary: ClinicWidePerformanceSummary;
  doctors: DoctorPerformanceMetric[];
  receptionists: ReceptionistPerformanceMetric[];
  cashiers: CashierPerformanceMetric[];
  handlers: HandlerPerformanceMetric[];
}

/**
 * Calculates start and end timestamps in UTC corresponding to BST (UTC+6) date filter.
 */
function getDateBoundaries(params: PerformanceFilterParams): {
  start: Date | null;
  end: Date | null;
  startDateStr: string;
  endDateStr: string;
  label: string;
} {
  const todayStr = getBSTDateString();

  if (params.filter === "all") {
    return {
      start: null,
      end: null,
      startDateStr: "All Time",
      endDateStr: todayStr,
      label: "All Time (Complete Clinic History)",
    };
  }

  if (params.filter === "today") {
    const { startOfDay, endOfDay } = getStartAndEndOfBSTDay(todayStr);
    return {
      start: startOfDay,
      end: endOfDay,
      startDateStr: todayStr,
      endDateStr: todayStr,
      label: `Today (${todayStr})`,
    };
  }

  if (params.filter === "yesterday") {
    const [y, m, d] = todayStr.split("-").map(Number);
    const prev = new Date(Date.UTC(y, m - 1, d - 1, 12 - 6));
    const yesterdayStr = getBSTDateString(prev);
    const { startOfDay, endOfDay } = getStartAndEndOfBSTDay(yesterdayStr);
    return {
      start: startOfDay,
      end: endOfDay,
      startDateStr: yesterdayStr,
      endDateStr: yesterdayStr,
      label: `Yesterday (${yesterdayStr})`,
    };
  }

  if (params.filter === "7d") {
    const [y, m, d] = todayStr.split("-").map(Number);
    const past7 = new Date(Date.UTC(y, m - 1, d - 6, 12 - 6));
    const startStr = getBSTDateString(past7);
    const { startOfDay } = getStartAndEndOfBSTDay(startStr);
    const { endOfDay } = getStartAndEndOfBSTDay(todayStr);
    return {
      start: startOfDay,
      end: endOfDay,
      startDateStr: startStr,
      endDateStr: todayStr,
      label: `Last 7 Days (${startStr} to ${todayStr})`,
    };
  }

  if (params.filter === "30d") {
    const [y, m, d] = todayStr.split("-").map(Number);
    const past30 = new Date(Date.UTC(y, m - 1, d - 29, 12 - 6));
    const startStr = getBSTDateString(past30);
    const { startOfDay } = getStartAndEndOfBSTDay(startStr);
    const { endOfDay } = getStartAndEndOfBSTDay(todayStr);
    return {
      start: startOfDay,
      end: endOfDay,
      startDateStr: startStr,
      endDateStr: todayStr,
      label: `Last 30 Days (${startStr} to ${todayStr})`,
    };
  }

  if (params.filter === "this_month") {
    const [y, m] = todayStr.split("-").map(Number);
    const monthStartStr = `${y}-${String(m).padStart(2, "0")}-01`;
    const { startOfDay } = getStartAndEndOfBSTDay(monthStartStr);
    const { endOfDay } = getStartAndEndOfBSTDay(todayStr);
    return {
      start: startOfDay,
      end: endOfDay,
      startDateStr: monthStartStr,
      endDateStr: todayStr,
      label: `This Month (${monthStartStr} to ${todayStr})`,
    };
  }

  // Custom
  const startStr = params.startDate || todayStr;
  const endStr = params.endDate || todayStr;
  const { startOfDay } = getStartAndEndOfBSTDay(startStr);
  const { endOfDay } = getStartAndEndOfBSTDay(endStr);
  return {
    start: startOfDay,
    end: endOfDay,
    startDateStr: startStr,
    endDateStr: endStr,
    label: `Custom Range (${startStr} to ${endStr})`,
  };
}

/**
 * Generates comprehensive clinical staff and performer performance telemetry.
 */
export async function getStaffPerformanceReportAction(
  params: PerformanceFilterParams,
): Promise<{ success: boolean; data?: StaffPerformanceReportData; error?: string }> {
  try {
    await requireAuth(Role.ADMIN);

    const { start, end, startDateStr, endDateStr, label } = getDateBoundaries(params);

    const dateFilter =
      start && end
        ? {
            gte: start,
            lte: end,
          }
        : undefined;

    // Run parallel queries across all relevant clinical models
    const [
      doctors,
      performers,
      appointments,
      consultationSerials,
      prescriptions,
      treatmentPlans,
      invoices,
      payments,
      timers,
      stepLogs,
    ] = await Promise.all([
      prisma.user.findMany({
        where: { role: Role.DOCTOR },
        select: {
          id: true,
          name: true,
          email: true,
          whatsapp: true,
          consultationFee: true,
        },
      }),
      prisma.performer.findMany({
        include: {
          user: {
            select: {
              id: true,
              role: true,
              name: true,
            },
          },
        },
      }),
      prisma.appointment.findMany({
        where: dateFilter ? { appointmentDate: dateFilter } : undefined,
        select: {
          id: true,
          type: true,
          bookingType: true,
          status: true,
          appointmentDate: true,
          doctorId: true,
          performerId: true,
          bookedById: true,
          feeAmount: true,
          consultationFee: true,
          therapyFee: true,
          paidAmount: true,
          dueAmount: true,
          inConsultationTime: true,
          outConsultationTime: true,
          inTherapyTime: true,
          outTherapyTime: true,
          patientId: true,
          queueType: true,
          roomId: true,
          room: {
            select: {
              number: true,
            },
          },
        },
      }),
      prisma.consultationSerial.findMany({
        where: dateFilter ? { appointmentDate: dateFilter } : undefined,
        select: {
          id: true,
          serialNumber: true,
          doctorId: true,
          bookedById: true,
          cashierPerformerId: true,
          feeAmount: true,
          paidAmount: true,
          dueAmount: true,
          status: true,
          inConsultationTime: true,
          outConsultationTime: true,
          patientId: true,
          appointmentDate: true,
        },
      }),
      prisma.prescription.findMany({
        where: dateFilter ? { createdAt: dateFilter } : undefined,
        select: {
          id: true,
          doctorId: true,
          patientId: true,
          diagnosis: true,
          medicines: true,
          createdAt: true,
        },
      }),
      prisma.treatmentPlan.findMany({
        where: dateFilter ? { createdAt: dateFilter } : undefined,
        select: {
          id: true,
          doctorId: true,
          patientId: true,
          modalities: true,
          planType: true,
          createdAt: true,
        },
      }),
      prisma.patientInvoice.findMany({
        where: dateFilter ? { createdAt: dateFilter } : undefined,
        select: {
          id: true,
          invoiceNumber: true,
          patientId: true,
          totalAmount: true,
          paidAmount: true,
          dueAmount: true,
          status: true,
          paymentMethod: true,
          cashierPerformerId: true,
          createdAt: true,
        },
      }),
      prisma.patientPayment.findMany({
        where: dateFilter ? { createdAt: dateFilter } : undefined,
        select: {
          id: true,
          patientId: true,
          serviceType: true,
          amount: true,
          paymentMethod: true,
          isDue: true,
          cashierPerformerId: true,
          createdAt: true,
        },
      }),
      prisma.therapySessionTimer.findMany({
        where: dateFilter ? { createdAt: dateFilter } : undefined,
        select: {
          id: true,
          appointmentId: true,
          patientId: true,
          roomNumber: true,
          modalities: true,
          performerId: true,
          currentStepIndex: true,
          isRunning: true,
          lastStartedAt: true,
          createdAt: true,
        },
      }),
      prisma.patientStepLog.findMany({
        where: {
          AND: [
            dateFilter ? { timestamp: dateFilter } : {},
            { performerId: { not: null } },
          ],
        },
        select: {
          id: true,
          step: true,
          station: true,
          doctorId: true,
          performerId: true,
          patientId: true,
          timestamp: true,
        },
      }),
    ]);

    // ----------------------------------------------------
    // 1. DOCTOR TELEMETRY AGGREGATION
    // ----------------------------------------------------
    const clinicWideMedicinesCount: Record<string, number> = {};
    const clinicWideModalitiesCount: Record<string, number> = {};

    const doctorMetrics: DoctorPerformanceMetric[] = doctors.map((doc) => {
      // Find consultation serials for this doctor
      const docSerials = consultationSerials.filter((s) => s.doctorId === doc.id);
      // Find consultation appointments for this doctor
      const docAppointments = appointments.filter(
        (a) => a.doctorId === doc.id && a.type === "CONSULTATION",
      );

      const totalConsultations = docSerials.length + docAppointments.length;

      // Completed consultations & duration
      let completedCount = 0;
      let totalMinutes = 0;

      for (const s of docSerials) {
        if (s.status === "COMPLETED" || (s.inConsultationTime && s.outConsultationTime)) {
          completedCount++;
          if (s.inConsultationTime && s.outConsultationTime) {
            const diff =
              (new Date(s.outConsultationTime).getTime() -
                new Date(s.inConsultationTime).getTime()) /
              60000;
            if (diff > 0 && diff < 180) {
              totalMinutes += Math.round(diff);
            } else if (diff <= 0) {
              totalMinutes += 15; // default benchmark
            }
          } else {
            totalMinutes += 15;
          }
        }
      }

      for (const a of docAppointments) {
        if (a.status === "COMPLETED" || (a.inConsultationTime && a.outConsultationTime)) {
          completedCount++;
          if (a.inConsultationTime && a.outConsultationTime) {
            const diff =
              (new Date(a.outConsultationTime).getTime() -
                new Date(a.inConsultationTime).getTime()) /
              60000;
            if (diff > 0 && diff < 180) {
              totalMinutes += Math.round(diff);
            } else if (diff <= 0) {
              totalMinutes += 15;
            }
          } else {
            totalMinutes += 15;
          }
        }
      }

      const avgConsultationMinutes =
        completedCount > 0 ? Math.round(totalMinutes / completedCount) : 0;

      // Total earnings from consultation fees
      const serialsEarnings = docSerials.reduce((sum, s) => sum + (s.feeAmount || 0), 0);
      const apptsEarnings = docAppointments.reduce(
        (sum, a) => sum + (a.consultationFee || a.feeAmount || 0),
        0,
      );
      const totalEarningsBDT = serialsEarnings + apptsEarnings;

      // Prescriptions written & medicine tally
      const docPrescriptions = prescriptions.filter((p) => p.doctorId === doc.id);
      const medicineMap: Record<string, { count: number; mealTiming?: string }> = {};
      const diagnosisMap: Record<string, number> = {};

      for (const p of docPrescriptions) {
        if (p.diagnosis && p.diagnosis.trim()) {
          const diag = p.diagnosis.trim();
          diagnosisMap[diag] = (diagnosisMap[diag] || 0) + 1;
        }

        try {
          const parsedMeds = JSON.parse(p.medicines || "[]");
          if (Array.isArray(parsedMeds)) {
            for (const m of parsedMeds) {
              if (m && typeof m.name === "string" && m.name.trim()) {
                const medName = m.name.trim();
                const key = medName.toLowerCase();
                const meal = m.mealTiming || "";

                if (!medicineMap[key]) {
                  medicineMap[key] = { count: 1, mealTiming: meal };
                } else {
                  medicineMap[key].count++;
                }

                // Clinic-wide tally
                clinicWideMedicinesCount[medName] =
                  (clinicWideMedicinesCount[medName] || 0) + 1;
              }
            }
          }
        } catch {}
      }

      const mostUsedMedicines = Object.entries(medicineMap)
        .map(([rawKey, val]) => {
          // Capitalize first letter of each word
          const formattedName = rawKey
            .split(" ")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ");
          return {
            name: formattedName,
            count: val.count,
            mealTiming: val.mealTiming,
          };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

      const topDiagnoses = Object.entries(diagnosisMap)
        .map(([diagnosis, count]) => ({ diagnosis, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Treatment plans created
      const docPlans = treatmentPlans.filter((tp) => tp.doctorId === doc.id);
      const modalityMap: Record<string, number> = {};

      for (const tp of docPlans) {
        try {
          const mods = JSON.parse(tp.modalities || "[]");
          if (Array.isArray(mods)) {
            for (const m of mods) {
              if (typeof m === "string" && m.trim()) {
                const modName = m.trim();
                modalityMap[modName] = (modalityMap[modName] || 0) + 1;
                clinicWideModalitiesCount[modName] =
                  (clinicWideModalitiesCount[modName] || 0) + 1;
              }
            }
          }
        } catch {}
      }

      const topModalities = Object.entries(modalityMap)
        .map(([modality, count]) => ({ modality, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);

      // Unique patients seen
      const patientIdSet = new Set<string>();
      docSerials.forEach((s) => s.patientId && patientIdSet.add(s.patientId));
      docAppointments.forEach((a) => a.patientId && patientIdSet.add(a.patientId));
      docPrescriptions.forEach((p) => p.patientId && patientIdSet.add(p.patientId));

      return {
        doctorId: doc.id,
        name: doc.name || "Doctor",
        email: doc.email,
        whatsapp: doc.whatsapp,
        consultationFee: doc.consultationFee || 0,
        totalConsultations,
        completedConsultations: completedCount,
        totalTimeSpentMinutes: totalMinutes,
        avgConsultationMinutes,
        totalEarningsBDT,
        prescriptionsWritten: docPrescriptions.length,
        treatmentPlansCreated: docPlans.length,
        uniquePatientsCount: patientIdSet.size,
        mostUsedMedicines,
        topDiagnoses,
        topModalities,
      };
    });

    // ----------------------------------------------------
    // 2. RECEPTIONIST TELEMETRY AGGREGATION
    // ----------------------------------------------------
    const receptionistPerformers = performers.filter(
      (p) => p.user.role === Role.RECEPTIONIST || p.user.role === Role.ADMIN,
    );

    const receptionistMetrics: ReceptionistPerformanceMetric[] = receptionistPerformers.map(
      (perf) => {
        // Check-ins from step logs or visit records
        const perfStepLogs = stepLogs.filter((l) => l.performerId === perf.id);
        const checkIns = perfStepLogs.filter((l) => l.step === "CHECK_IN").length;

        // Appointments booked by this receptionist
        const perfBookings = appointments.filter((a) => a.bookedById === perf.id);
        const regularBookings = perfBookings.filter(
          (a) => a.bookingType === "REGULAR",
        ).length;
        const extraBookings = perfBookings.filter(
          (a) => a.bookingType === "EXTRA",
        ).length;

        // Consultation serials booked by this receptionist
        const serialsBooked = consultationSerials.filter(
          (s) => s.bookedById === perf.id,
        ).length;

        const totalBookings = regularBookings + extraBookings + serialsBooked;

        // Unique patients handled
        const patientSet = new Set<string>();
        perfStepLogs.forEach((l) => l.patientId && patientSet.add(l.patientId));
        perfBookings.forEach((b) => b.patientId && patientSet.add(b.patientId));

        return {
          performerId: perf.id,
          name: perf.name,
          phone: perf.phone || perf.whatsapp,
          whatsapp: perf.whatsapp,
          role: perf.user.role,
          totalCheckIns: checkIns,
          regularBookingsCount: regularBookings,
          extraBookingsCount: extraBookings,
          consultationSerialsIssued: serialsBooked,
          totalBookings,
          uniquePatientsHandled: patientSet.size,
          stepLogsCount: perfStepLogs.length,
        };
      },
    );

    // ----------------------------------------------------
    // 3. CASHIER TELEMETRY AGGREGATION
    // ----------------------------------------------------
    const cashierPerformers = performers.filter(
      (p) => p.user.role === Role.CASHIER || p.user.role === Role.ADMIN,
    );

    const cashierMetrics: CashierPerformanceMetric[] = cashierPerformers.map((perf) => {
      // Invoices handled by this cashier
      const perfInvoices = invoices.filter((inv) => inv.cashierPerformerId === perf.id);
      const cleared = perfInvoices.filter((i) => i.status === "PAID").length;
      const partial = perfInvoices.filter((i) => i.status === "PARTIAL").length;
      const due = perfInvoices.filter((i) => i.status === "DUE").length;

      // Payments collected by this cashier
      const perfPayments = payments.filter((p) => p.cashierPerformerId === perf.id);

      let totalCollectedBDT = 0;
      let totalDueMarkedBDT = 0;
      let cashBDT = 0;
      let cardBDT = 0;
      let mfsBDT = 0;
      let cashCount = 0;
      let cardCount = 0;
      let mfsCount = 0;

      for (const pay of perfPayments) {
        if (pay.isDue) {
          totalDueMarkedBDT += pay.amount || 0;
        } else {
          totalCollectedBDT += pay.amount || 0;
          const method = (pay.paymentMethod || "").toUpperCase();
          if (method === "CASH") {
            cashBDT += pay.amount || 0;
            cashCount++;
          } else if (method === "CARD") {
            cardBDT += pay.amount || 0;
            cardCount++;
          } else {
            // MFS (bKash, Nagad, etc.)
            mfsBDT += pay.amount || 0;
            mfsCount++;
          }
        }
      }

      // If invoices recorded paidAmount and payments table was empty
      if (totalCollectedBDT === 0 && perfInvoices.length > 0) {
        for (const inv of perfInvoices) {
          totalCollectedBDT += inv.paidAmount || 0;
          totalDueMarkedBDT += inv.dueAmount || 0;
          const m = (inv.paymentMethod || "").toUpperCase();
          if (m === "CARD") {
            cardBDT += inv.paidAmount || 0;
            cardCount++;
          } else if (m === "MFS") {
            mfsBDT += inv.paidAmount || 0;
            mfsCount++;
          } else {
            cashBDT += inv.paidAmount || 0;
            cashCount++;
          }
        }
      }

      const totalTransactions = cashCount + cardCount + mfsCount;
      const avgTxBDT =
        totalTransactions > 0 ? Math.round(totalCollectedBDT / totalTransactions) : 0;

      const patientSet = new Set<string>();
      perfInvoices.forEach((i) => i.patientId && patientSet.add(i.patientId));
      perfPayments.forEach((p) => p.patientId && patientSet.add(p.patientId));

      return {
        performerId: perf.id,
        name: perf.name,
        phone: perf.phone || perf.whatsapp,
        whatsapp: perf.whatsapp,
        role: perf.user.role,
        invoicesCleared: cleared,
        invoicesPartial: partial,
        invoicesDue: due,
        totalInvoicesHandled: perfInvoices.length,
        totalCollectedBDT,
        totalDueMarkedBDT,
        cashBDT,
        cardBDT,
        mfsBDT,
        cashTransactionsCount: cashCount,
        cardTransactionsCount: cardCount,
        mfsTransactionsCount: mfsCount,
        totalTransactionsCount: totalTransactions,
        uniquePatientsBilled: patientSet.size,
        avgTransactionBDT: avgTxBDT,
      };
    });

    // ----------------------------------------------------
    // 4. HANDLER TELEMETRY AGGREGATION
    // ----------------------------------------------------
    const handlerPerformers = performers.filter(
      (p) => p.user.role === Role.HANDLER || p.user.role === Role.ADMIN,
    );

    const handlerMetrics: HandlerPerformanceMetric[] = handlerPerformers.map((perf) => {
      // Completed therapy appointments assigned to this handler
      const perfAppointments = appointments.filter(
        (a) => a.performerId === perf.id && a.queueType === "THERAPY",
      );

      const completed = perfAppointments.filter((a) => a.status === "COMPLETED").length;
      const inTherapy = perfAppointments.filter((a) => a.status === "IN_THERAPY").length;

      // Timers conducted by this handler
      const perfTimers = timers.filter((t) => t.performerId === perf.id);

      let totalBedMinutes = 0;
      const modalityTally: Record<string, { count: number; totalMinutes: number }> = {};
      const roomSet = new Set<string>();

      // Sum bed minutes from appointments with timestamps
      for (const a of perfAppointments) {
        if (a.room?.number) roomSet.add(a.room.number);
        if (a.inTherapyTime && a.outTherapyTime) {
          const diff =
            (new Date(a.outTherapyTime).getTime() -
              new Date(a.inTherapyTime).getTime()) /
            60000;
          if (diff > 0 && diff < 300) {
            totalBedMinutes += Math.round(diff);
          } else {
            totalBedMinutes += 30; // standard session
          }
        } else if (a.status === "COMPLETED") {
          totalBedMinutes += 30;
        }
      }

      // Parse modalities executed from timers
      for (const timer of perfTimers) {
        if (timer.roomNumber) roomSet.add(timer.roomNumber);
        try {
          const mods = JSON.parse(timer.modalities || "[]");
          if (Array.isArray(mods)) {
            for (const m of mods) {
              if (m && m.name) {
                const name = m.name.trim();
                const dur = m.durationMinutes || 15;
                if (!modalityTally[name]) {
                  modalityTally[name] = { count: 1, totalMinutes: dur };
                } else {
                  modalityTally[name].count++;
                  modalityTally[name].totalMinutes += dur;
                }
              }
            }
          }
        } catch {}
      }

      const modalitiesHandled = Object.entries(modalityTally)
        .map(([name, data]) => ({
          name,
          count: data.count,
          totalMinutes: data.totalMinutes,
        }))
        .sort((a, b) => b.count - a.count);

      const avgSessionMinutes =
        completed > 0 ? Math.round(totalBedMinutes / completed) : 0;

      const patientSet = new Set<string>();
      perfAppointments.forEach((a) => a.patientId && patientSet.add(a.patientId));
      perfTimers.forEach((t) => t.patientId && patientSet.add(t.patientId));

      return {
        performerId: perf.id,
        name: perf.name,
        phone: perf.phone || perf.whatsapp,
        whatsapp: perf.whatsapp,
        role: perf.user.role,
        therapySessionsCompleted: completed,
        inTherapyActive: inTherapy,
        totalBedMinutes,
        avgSessionMinutes,
        modalitiesHandled,
        uniquePatientsTreated: patientSet.size,
        roomsCovered: Array.from(roomSet),
      };
    });

    // ----------------------------------------------------
    // 5. CLINIC-WIDE METRIC SUMMARY
    // ----------------------------------------------------
    const totalDoctorEarnings = doctorMetrics.reduce(
      (sum, d) => sum + d.totalEarningsBDT,
      0,
    );
    const totalConsultations = doctorMetrics.reduce(
      (sum, d) => sum + d.totalConsultations,
      0,
    );
    const totalPrescriptions = prescriptions.length;

    const totalReceptionCheckIns = receptionistMetrics.reduce(
      (sum, r) => sum + r.totalCheckIns,
      0,
    );
    const totalReceptionBookings = receptionistMetrics.reduce(
      (sum, r) => sum + r.totalBookings,
      0,
    );

    const totalCashierCollected = cashierMetrics.reduce(
      (sum, c) => sum + c.totalCollectedBDT,
      0,
    );
    const totalCashierCleared = cashierMetrics.reduce(
      (sum, c) => sum + c.invoicesCleared,
      0,
    );
    const totalCashierDue = cashierMetrics.reduce(
      (sum, c) => sum + c.totalDueMarkedBDT,
      0,
    );

    const totalHandlerSessions = handlerMetrics.reduce(
      (sum, h) => sum + h.therapySessionsCompleted,
      0,
    );
    const totalHandlerBedMins = handlerMetrics.reduce(
      (sum, h) => sum + h.totalBedMinutes,
      0,
    );

    const topMedicinesClinicWide = Object.entries(clinicWideMedicinesCount)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topModalitiesClinicWide = Object.entries(clinicWideModalitiesCount)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const summary: ClinicWidePerformanceSummary = {
      dateRangeLabel: label,
      filter: params.filter,
      startDateStr,
      endDateStr,
      totalDoctorsActive: doctorMetrics.filter((d) => d.totalConsultations > 0).length,
      totalDoctorEarningsBDT: totalDoctorEarnings,
      totalDoctorConsultations: totalConsultations,
      totalPrescriptions,
      totalReceptionCheckIns,
      totalReceptionBookings,
      totalCashierCollectedBDT: totalCashierCollected,
      totalCashierInvoicesCleared: totalCashierCleared,
      totalCashierDueMarkedBDT: totalCashierDue,
      totalHandlerTherapySessions: totalHandlerSessions,
      totalHandlerBedMinutes: totalHandlerBedMins,
      topMedicinesClinicWide,
      topModalitiesClinicWide,
    };

    return {
      success: true,
      data: {
        summary,
        doctors: doctorMetrics,
        receptionists: receptionistMetrics,
        cashiers: cashierMetrics,
        handlers: handlerMetrics,
      },
    };
  } catch (error: any) {
    console.error("[getStaffPerformanceReportAction Error]:", error);
    return {
      success: false,
      error: error?.message || "Failed to compile staff performance report.",
    };
  }
}
