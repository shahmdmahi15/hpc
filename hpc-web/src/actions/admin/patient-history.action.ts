"use server";

import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/guard";
import { Role } from "@/generated/prisma/enums";

export interface PatientListItem {
  id: string;
  mrn: string | null;
  name: string;
  phone: string;
  gender: string;
  dateOfBirth: string | null;
  bloodGroup: string | null;
  address: string | null;
  emergencyContact: string | null;
  totalBill: number;
  totalPaid: number;
  totalDue: number;
  createdAt: string;
  updatedAt: string;
  totalVisits: number;
  lastVisitDate: string | null;
  hasActiveVisitToday: boolean;
  appointmentCount: number;
  consultationCount: number;
  prescriptionCount: number;
  invoiceCount: number;
}

export interface PatientListResult {
  patients: PatientListItem[];
  totalCount: number;
  kpis: {
    totalPatients: number;
    patientsWithDue: number;
    totalDueAmount: number;
    activeTodayCount: number;
    totalLifetimeRevenue: number;
  };
}

/**
 * Fetches list of patients for the admin directory with KPI telemetry and search
 */
export async function getAdminPatientsListAction(params: {
  search?: string;
  filter?: "ALL" | "DUE" | "TODAY" | "FEMALE" | "MALE";
  sortBy?: "recent" | "due" | "bill" | "name";
  limit?: number;
  offset?: number;
} = {}): Promise<PatientListResult> {
  await requireAuth([Role.ADMIN]);

  const search = params.search?.trim().toLowerCase();
  const filter = params.filter || "ALL";
  const sortBy = params.sortBy || "recent";
  const limit = Math.min(params.limit || 100, 200);
  const offset = params.offset || 0;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  // Base where query
  const where: any = {};

  if (search) {
    where.OR = [
      { name: { contains: search } },
      { phone: { contains: search } },
      { mrn: { contains: search } },
      { address: { contains: search } },
    ];
  }

  if (filter === "DUE") {
    where.totalDue = { gt: 0 };
  } else if (filter === "FEMALE") {
    where.gender = "FEMALE";
  } else if (filter === "MALE") {
    where.gender = "MALE";
  } else if (filter === "TODAY") {
    where.appointments = {
      some: {
        appointmentDate: { gte: startOfToday, lte: endOfToday },
        status: { not: "CANCELLED" },
      },
    };
  }

  // Order by
  let orderBy: any = { updatedAt: "desc" };
  if (sortBy === "due") {
    orderBy = { totalDue: "desc" };
  } else if (sortBy === "bill") {
    orderBy = { totalBill: "desc" };
  } else if (sortBy === "name") {
    orderBy = { name: "asc" };
  } else if (sortBy === "recent") {
    orderBy = { updatedAt: "desc" };
  }

  const [patients, totalCount, allPatientsKPI] = await Promise.all([
    prisma.patient.findMany({
      where,
      orderBy,
      take: limit,
      skip: offset,
      include: {
        _count: {
          select: {
            appointments: true,
            consultationSerials: true,
            prescriptions: true,
            invoices: true,
            visits: true,
          },
        },
        appointments: {
          select: {
            id: true,
            appointmentDate: true,
            status: true,
            checkInTime: true,
          },
          orderBy: { appointmentDate: "desc" },
          take: 5,
        },
        visits: {
          select: {
            id: true,
            visitDate: true,
          },
          orderBy: { visitDate: "desc" },
          take: 1,
        },
      },
    }),
    prisma.patient.count({ where }),
    prisma.patient.findMany({
      select: {
        totalDue: true,
        totalPaid: true,
        appointments: {
          where: {
            appointmentDate: { gte: startOfToday, lte: endOfToday },
            status: { not: "CANCELLED" },
          },
          select: { id: true },
          take: 1,
        },
      },
    }),
  ]);

  let totalDueAmount = 0;
  let patientsWithDue = 0;
  let activeTodayCount = 0;
  let totalLifetimeRevenue = 0;

  for (const p of allPatientsKPI) {
    if ((p.totalDue ?? 0) > 0) {
      patientsWithDue++;
      totalDueAmount += p.totalDue ?? 0;
    }
    totalLifetimeRevenue += p.totalPaid ?? 0;
    if (p.appointments.length > 0) {
      activeTodayCount++;
    }
  }

  const formattedPatients: PatientListItem[] = patients.map((p) => {
    const lastApt = p.appointments[0];
    const lastVisit = p.visits[0];
    const lastDate = lastApt?.appointmentDate || lastVisit?.visitDate || p.updatedAt;

    const hasActiveToday = p.appointments.some((a) => {
      const d = new Date(a.appointmentDate);
      return d >= startOfToday && d <= endOfToday && a.status !== "CANCELLED";
    });

    return {
      id: p.id,
      mrn: p.mrn,
      name: p.name,
      phone: p.phone,
      gender: p.gender,
      dateOfBirth: p.dateOfBirth?.toISOString().split("T")[0] || null,
      bloodGroup: p.bloodGroup || null,
      address: p.address || null,
      emergencyContact: p.emergencyPhone || null,
      totalBill: p.totalBill ?? 0,
      totalPaid: p.totalPaid ?? 0,
      totalDue: p.totalDue ?? 0,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      totalVisits: Math.max(p._count.visits, p._count.appointments),
      lastVisitDate: lastDate ? new Date(lastDate).toISOString() : null,
      hasActiveVisitToday: hasActiveToday,
      appointmentCount: p._count.appointments,
      consultationCount: p._count.consultationSerials,
      prescriptionCount: p._count.prescriptions,
      invoiceCount: p._count.invoices,
    };
  });

  return {
    patients: formattedPatients,
    totalCount,
    kpis: {
      totalPatients: allPatientsKPI.length,
      patientsWithDue,
      totalDueAmount,
      activeTodayCount,
      totalLifetimeRevenue,
    },
  };
}

/**
 * Internal query function to load a patient's complete dossier
 */
export async function getPatientCompleteHistoryData(patientId: string) {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: {
      // 1. All Visits
      visits: {
        orderBy: { visitDate: "desc" },
        include: {
          stepLogs: {
            orderBy: { timestamp: "asc" },
          },
          visitNotes: {
            orderBy: { createdAt: "asc" },
          },
        },
      },
      // 2. All Appointments
      appointments: {
        orderBy: { appointmentDate: "desc" },
        include: {
          doctor: { select: { id: true, name: true, email: true } },
          performer: { select: { id: true, name: true, phone: true } },
          bookedBy: { select: { id: true, name: true } },
          therapySlot: { include: { room: true } },
          room: true,
          invoice: { include: { payments: true } },
          treatmentPlans: {
            orderBy: { createdAt: "desc" },
            include: { doctor: { select: { id: true, name: true } } },
          },
          prescriptions: {
            orderBy: { createdAt: "desc" },
            include: { doctor: { select: { id: true, name: true } } },
          },
          medicalRecords: {
            orderBy: { assessmentDate: "desc" },
            include: { doctor: { select: { id: true, name: true } } },
          },
          visitNotes: {
            orderBy: { createdAt: "asc" },
          },
        },
      },
      // 3. All Consultation Serials
      consultationSerials: {
        orderBy: { appointmentDate: "desc" },
        include: {
          doctor: { select: { id: true, name: true, email: true } },
          invoice: { include: { payments: true } },
        },
      },
      // 4. All Prescriptions
      prescriptions: {
        orderBy: { createdAt: "desc" },
        include: {
          doctor: { select: { id: true, name: true, email: true } },
          appointment: { select: { id: true, appointmentDate: true, type: true } },
        },
      },
      // 5. All Treatment Plans
      treatmentPlans: {
        orderBy: { createdAt: "desc" },
        include: {
          doctor: { select: { id: true, name: true, email: true } },
          appointment: { select: { id: true, appointmentDate: true } },
        },
      },
      // 6. All Invoices
      invoices: {
        orderBy: { createdAt: "desc" },
        include: {
          payments: { orderBy: { createdAt: "asc" } },
          consultationSerials: true,
          appointments: true,
        },
      },
      // 7. All Payments
      payments: {
        orderBy: { createdAt: "desc" },
        include: {
          invoice: true,
        },
      },
      // 8. All Step Logs (Chronological Journey)
      stepLogs: {
        orderBy: { timestamp: "desc" },
      },
      // 9. All Department Visit Notes
      visitNotes: {
        orderBy: { createdAt: "desc" },
      },
      // 10. Medical Records / Care Files
      medicalRecords: {
        orderBy: { assessmentDate: "desc" },
        include: {
          doctor: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!patient) {
    throw new Error("Patient not found.");
  }

  // Parse JSON fields safely
  const parsedPrescriptions = patient.prescriptions.map((pr) => {
    let medicines: any[] = [];
    try {
      if (typeof pr.medicines === "string") {
        medicines = JSON.parse(pr.medicines);
      } else if (Array.isArray(pr.medicines)) {
        medicines = pr.medicines;
      }
    } catch {
      medicines = [];
    }
    return {
      ...pr,
      medicines,
    };
  });

  const parsedTreatmentPlans = patient.treatmentPlans.map((tp) => {
    let modalities: any[] = [];
    try {
      if (typeof tp.modalities === "string") {
        modalities = JSON.parse(tp.modalities);
      } else if (Array.isArray(tp.modalities)) {
        modalities = tp.modalities;
      }
    } catch {
      modalities = [];
    }
    return {
      ...tp,
      modalities,
    };
  });

  // Fetch any TherapySessionTimers linked to patient appointments
  const appointmentIds = patient.appointments.map((a) => a.id);
  const timers = await prisma.therapySessionTimer.findMany({
    where: {
      OR: [
        { patientId: patient.id },
        { appointmentId: { in: appointmentIds } },
      ],
    },
    orderBy: { createdAt: "desc" },
  });

  const parsedTimers = timers.map((t) => {
    let modalities: any[] = [];
    try {
      if (typeof t.modalities === "string") {
        modalities = JSON.parse(t.modalities);
      } else if (Array.isArray(t.modalities)) {
        modalities = t.modalities;
      }
    } catch {
      modalities = [];
    }
    return {
      ...t,
      modalities,
    };
  });

  return {
    patient: {
      ...patient,
      prescriptions: parsedPrescriptions,
      treatmentPlans: parsedTreatmentPlans,
      timers: parsedTimers,
    },
  };
}

/**
 * Server action to fetch a patient's complete dossier for admin inspection
 */
export async function getPatientCompleteHistoryAction(patientId: string) {
  await requireAuth([Role.ADMIN]);
  return getPatientCompleteHistoryData(patientId);
}
