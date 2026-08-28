"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth";
import { realtimeBus } from "@/lib/events";
import {
  PaymentMethod,
  PaymentStatus,
  AuditAction,
} from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { getStartAndEndOfBSTDay } from "@/lib/date";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";

export interface CreatePatientFileInput {
  patientId: string;
  fileNumber?: string;
  primaryDoctorId?: string;
  diagnosis?: string;
  chiefComplaints?: string;
  medicalHistory?: string;
  treatmentPlan?: string;
  prescribedModalities?: string;
  totalPrescribedSessions?: number;
  packageType?: string;
  notes?: string;
}

export interface AssignTreatmentSlotInput {
  fileId?: string;
  patientId: string;
  date?: string | Date; // Day of treatment
  slotTime: string; // e.g. "10:00 AM - 11:00 AM", "04:30 PM"
  slotSequence?: number; // 1st slot of the day, 2nd slot of the day, etc.
  roomNumber?: string; // Room 201 to 220
  assignedDoctorId?: string;
  assignedHandlerId?: string;
  modalitiesPrescribed?: string;
  notes?: string;
  // Optional initial payment or N.P info
  payment?: {
    amount?: number;
    paidAmount?: number;
    dueAmount?: number;
    isNP?: boolean;
    paymentMethod?: PaymentMethod;
    notes?: string;
  };
}

export interface RecordFilePaymentInput {
  fileId?: string;
  patientId: string;
  treatmentSlotId?: string;
  date?: string | Date;
  amount: number;
  paidAmount: number;
  advanceAdjusted?: number;
  isNP?: boolean;
  paymentMethod?: PaymentMethod;
  notes?: string;
}

// ----------------------------------------------------
// 1. PATIENT FILE MANAGEMENT
// ----------------------------------------------------

export async function getOrCreatePatientFile(patientId: string) {
  const patient = await prisma.patient.findFirst({
    where: {
      OR: [{ id: patientId }, { patientId }],
    },
    include: {
      files: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!patient) {
    return { error: "Patient record not found." };
  }

  if (patient.files && patient.files.length > 0) {
    return { success: true, file: patient.files[0] };
  }

  // Create default file if none exists
  const autoFileNumber = `FILE-${patient.patientId}`;
  const file = await prisma.file.create({
    data: {
      patientId: patient.id,
      fileNumber: autoFileNumber,
      diagnosis: patient.primaryCondition || null,
      medicalHistory: patient.medicalHistory || null,
      notes: patient.notes || null,
    },
  });

  return { success: true, file };
}

export async function createPatientFile(data: CreatePatientFileInput) {
  const session = await getCurrentSession();

  const patient = await prisma.patient.findFirst({
    where: {
      OR: [{ id: data.patientId }, { patientId: data.patientId }],
    },
  });

  if (!patient) {
    return { error: "Patient record not found." };
  }

  const fileNumber =
    data.fileNumber?.trim() ||
    `FILE-${patient.patientId}-${Date.now().toString().slice(-4)}`;

  const existing = await prisma.file.findUnique({
    where: { fileNumber },
  });

  if (existing) {
    return { error: `File number ${fileNumber} already exists.` };
  }

  const file = await prisma.file.create({
    data: {
      fileNumber,
      patientId: patient.id,
      primaryDoctorId: data.primaryDoctorId || session?.user?.id || null,
      diagnosis: data.diagnosis?.trim() || patient.primaryCondition || null,
      chiefComplaints: data.chiefComplaints?.trim() || null,
      medicalHistory:
        data.medicalHistory?.trim() || patient.medicalHistory || null,
      treatmentPlan: data.treatmentPlan?.trim() || null,
      prescribedModalities: data.prescribedModalities?.trim() || null,
      totalPrescribedSessions: data.totalPrescribedSessions || 10,
      packageType: data.packageType?.trim() || null,
      notes: data.notes?.trim() || null,
    },
    include: {
      patient: true,
      primaryDoctor: { select: { id: true, name: true } },
    },
  });

  await logAudit({
    action: AuditAction.FILE_CREATE,
    userId: session?.user?.id,
    entity: "File",
    entityId: file.id,
    details: {
      fileNumber: file.fileNumber,
      patientId: patient.patientId,
      patientName: patient.name,
    },
  });

  realtimeBus.notify("FILE_CREATED", { file });
  revalidatePath("/doctor");
  revalidatePath("/receptionist");
  revalidatePath("/handler");
  revalidatePath("/admin");

  return { success: true, file };
}

export async function getPatientFileDetails(patientIdOrFileNumber: string) {
  return prisma.file.findFirst({
    where: {
      OR: [
        { id: patientIdOrFileNumber },
        { fileNumber: patientIdOrFileNumber },
        { patientId: patientIdOrFileNumber },
        { patient: { patientId: patientIdOrFileNumber } },
      ],
    },
    include: {
      patient: {
        include: {
          assessments: {
            orderBy: { date: "desc" },
            include: { doctor: { select: { id: true, name: true } } },
          },
          packages: {
            orderBy: { startDate: "desc" },
          },
          serials: {
            take: 5,
            orderBy: { date: "desc" },
          },
        },
      },
      primaryDoctor: { select: { id: true, name: true, role: true } },
      treatmentSlots: {
        orderBy: [{ date: "desc" }, { slotSequence: "asc" }],
        include: {
          assignedDoctor: { select: { id: true, name: true } },
          assignedHandler: { select: { id: true, name: true } },
          payment: true,
        },
      },
      payments: {
        orderBy: { date: "desc" },
        include: {
          collectedBy: { select: { id: true, name: true, role: true } },
          treatmentSlot: true,
        },
      },
    },
  });
}

export async function getAllPatientFiles(search?: string) {
  const trimmed = search?.trim();
  const where: Prisma.FileWhereInput = {};

  if (trimmed) {
    where.OR = [
      { fileNumber: { contains: trimmed } },
      { diagnosis: { contains: trimmed } },
      { patient: { name: { contains: trimmed } } },
      { patient: { patientId: { contains: trimmed } } },
      { patient: { phone: { contains: trimmed } } },
    ];
  }

  return prisma.file.findMany({
    where,
    take: 50,
    orderBy: { updatedAt: "desc" },
    include: {
      patient: true,
      primaryDoctor: { select: { id: true, name: true } },
      _count: {
        select: {
          treatmentSlots: true,
          payments: true,
        },
      },
    },
  });
}

// ----------------------------------------------------
// 2. MULTI-SLOT TREATMENT MANAGEMENT (Multiple times per day)
// ----------------------------------------------------

export async function assignTreatmentSlot(data: AssignTreatmentSlotInput) {
  const session = await getCurrentSession();

  const patient = await prisma.patient.findFirst({
    where: {
      OR: [{ id: data.patientId }, { patientId: data.patientId }],
    },
  });

  if (!patient) {
    return { error: "Patient not found." };
  }

  // Get or auto-create patient file
  let fileId = data.fileId;
  if (!fileId) {
    const fileRes = await getOrCreatePatientFile(patient.id);
    if ("file" in fileRes && fileRes.file) {
      fileId = fileRes.file.id;
    }
  }

  if (!fileId) {
    return { error: "Could not associate treatment slot with a patient file." };
  }

  const slotDate = data.date ? new Date(data.date) : new Date();

  // If slot sequence not provided, count existing slots for this patient on this date
  let sequence = data.slotSequence;
  if (!sequence) {
    const { startOfDay, endOfDay } = getStartAndEndOfBSTDay(
      slotDate.toISOString(),
    );
    const existingCount = await prisma.fileTreatmentSlot.count({
      where: {
        patientId: patient.id,
        date: { gte: startOfDay, lte: endOfDay },
      },
    });
    sequence = existingCount + 1;
  }

  const slot = await prisma.fileTreatmentSlot.create({
    data: {
      fileId,
      patientId: patient.id,
      date: slotDate,
      slotTime: data.slotTime,
      slotSequence: sequence,
      roomNumber: data.roomNumber || null,
      assignedDoctorId: data.assignedDoctorId || session?.user?.id || null,
      assignedHandlerId: data.assignedHandlerId || null,
      modalitiesPrescribed: data.modalitiesPrescribed || null,
      notes: data.notes || null,
      status: "SCHEDULED",
    },
    include: {
      patient: true,
      assignedDoctor: true,
      assignedHandler: true,
    },
  });

  // If initial payment information is provided with the slot
  if (data.payment) {
    const isNP = Boolean(data.payment.isNP);
    const amount = Number(data.payment.amount || 0);
    const paidAmount = isNP ? 0 : Number(data.payment.paidAmount || amount);
    const dueAmount = isNP ? 0 : Math.max(0, amount - paidAmount);

    await prisma.filePayment.create({
      data: {
        fileId,
        patientId: patient.id,
        treatmentSlotId: slot.id,
        date: slotDate,
        amount: isNP ? 0 : amount,
        paidAmount,
        dueAmount,
        isNP,
        paymentMethod: data.payment.paymentMethod || PaymentMethod.CASH,
        paymentStatus: isNP
          ? PaymentStatus.PAID
          : dueAmount === 0
            ? PaymentStatus.PAID
            : PaymentStatus.PARTIALLY_PAID,
        collectedById: session?.user?.id || null,
        notes: data.payment.notes || (isNP ? "N.P (No Payment)" : "Slot fee"),
      },
    });
  }

  // Update room occupancy if room number is assigned and therapy is starting
  if (data.roomNumber) {
    const cleanRoom = data.roomNumber.replace(/[^0-9]/g, "");
    if (cleanRoom) {
      await prisma.room
        .upsert({
          where: { roomNumber: cleanRoom },
          update: {
            isOccupied: true,
            currentPatientId: patient.id,
            currentDoctorId: data.assignedDoctorId || session?.user?.id || null,
            currentHandlerId: data.assignedHandlerId || null,
            currentSlotId: slot.id,
            occupiedSince: new Date(),
          },
          create: {
            roomNumber: cleanRoom,
            name: `Room ${cleanRoom}`,
            isOccupied: true,
            currentPatientId: patient.id,
            currentDoctorId: data.assignedDoctorId || session?.user?.id || null,
            currentHandlerId: data.assignedHandlerId || null,
            currentSlotId: slot.id,
            occupiedSince: new Date(),
          },
        })
        .catch(() => {});
    }
  }

  await logAudit({
    action: AuditAction.TREATMENT_SLOT_CREATE,
    userId: session?.user?.id,
    entity: "FileTreatmentSlot",
    entityId: slot.id,
    details: {
      patientId: patient.patientId,
      slotTime: data.slotTime,
      slotSequence: sequence,
      roomNumber: data.roomNumber,
    },
  });

  realtimeBus.notify("SLOT_ASSIGNED", { slot });
  revalidatePath("/doctor");
  revalidatePath("/handler");
  revalidatePath("/receptionist");
  revalidatePath("/admin");

  return { success: true, slot };
}

export async function updateTreatmentSlotStatus(
  slotId: string,
  data: {
    status:
      | "SCHEDULED"
      | "WAITING"
      | "IN_PROGRESS"
      | "COMPLETED"
      | "CANCELLED"
      | "NO_SHOW";
    modalitiesPerformed?: string;
    startTime?: Date;
    endTime?: Date;
    notes?: string;
  },
) {
  const slot = await prisma.fileTreatmentSlot.update({
    where: { id: slotId },
    data: {
      status: data.status,
      modalitiesPerformed: data.modalitiesPerformed,
      startTime: data.startTime,
      endTime:
        data.endTime || (data.status === "COMPLETED" ? new Date() : undefined),
      notes: data.notes,
    },
    include: {
      patient: true,
      file: true,
    },
  });

  // If completed, increment completedSessions count on file
  if (data.status === "COMPLETED" && slot.fileId) {
    await prisma.file
      .update({
        where: { id: slot.fileId },
        data: {
          completedSessions: { increment: 1 },
        },
      })
      .catch(() => {});

    // Also free room if occupied
    if (slot.roomNumber) {
      const cleanRoom = slot.roomNumber.replace(/[^0-9]/g, "");
      if (cleanRoom) {
        await prisma.room
          .updateMany({
            where: { roomNumber: cleanRoom, currentSlotId: slot.id },
            data: {
              isOccupied: false,
              currentPatientId: null,
              currentDoctorId: null,
              currentHandlerId: null,
              currentSlotId: null,
              occupiedSince: null,
            },
          })
          .catch(() => {});
      }
    }
  }

  realtimeBus.notify("SLOT_UPDATED", { slot });
  revalidatePath("/doctor");
  revalidatePath("/handler");
  revalidatePath("/receptionist");

  return { success: true, slot };
}

// ----------------------------------------------------
// 3. FLEXIBLE MULTI-VISIT / MULTI-TREATMENT PAYMENTS (Paid or N.P)
// ----------------------------------------------------

export async function recordFilePayment(data: RecordFilePaymentInput) {
  const session = await getCurrentSession();

  const patient = await prisma.patient.findFirst({
    where: {
      OR: [{ id: data.patientId }, { patientId: data.patientId }],
    },
  });

  if (!patient) {
    return { error: "Patient record not found." };
  }

  let fileId = data.fileId;
  if (!fileId) {
    const fileRes = await getOrCreatePatientFile(patient.id);
    if ("file" in fileRes && fileRes.file) {
      fileId = fileRes.file.id;
    }
  }

  if (!fileId) {
    return { error: "Could not link payment with patient file." };
  }

  const isNP = Boolean(data.isNP);
  const amount = isNP ? 0 : Number(data.amount || 0);
  const paidAmount = isNP ? 0 : Number(data.paidAmount || 0);
  const advanceAdjusted = isNP ? 0 : Number(data.advanceAdjusted || 0);
  const dueAmount = isNP
    ? 0
    : Math.max(0, amount - paidAmount - advanceAdjusted);

  const payment = await prisma.filePayment.create({
    data: {
      fileId,
      patientId: patient.id,
      treatmentSlotId: data.treatmentSlotId || null,
      date: data.date ? new Date(data.date) : new Date(),
      amount,
      paidAmount,
      advanceAdjusted,
      dueAmount,
      isNP,
      paymentMethod: data.paymentMethod || PaymentMethod.CASH,
      paymentStatus: isNP
        ? PaymentStatus.PAID
        : dueAmount === 0
          ? PaymentStatus.PAID
          : PaymentStatus.PARTIALLY_PAID,
      collectedById: session?.user?.id || null,
      notes:
        data.notes ||
        (isNP ? "N.P (No Payment / Covered)" : "Treatment session payment"),
    },
    include: {
      patient: true,
      collectedBy: true,
      treatmentSlot: true,
    },
  });

  await logAudit({
    action: AuditAction.PAYMENT_CREATE,
    userId: session?.user?.id,
    entity: "FilePayment",
    entityId: payment.id,
    details: {
      patientId: patient.patientId,
      amount,
      paidAmount,
      isNP,
      method: payment.paymentMethod,
    },
  });

  realtimeBus.notify("PAYMENT_RECORDED", { payment });
  revalidatePath("/admin");
  revalidatePath("/receptionist");
  revalidatePath("/doctor");

  return { success: true, payment };
}

export async function getDailyFilePayments(dateStr?: string) {
  const { startOfDay, endOfDay } = getStartAndEndOfBSTDay(dateStr);

  return prisma.filePayment.findMany({
    where: {
      date: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
    orderBy: { createdAt: "desc" },
    include: {
      patient: true,
      collectedBy: { select: { id: true, name: true, role: true } },
      treatmentSlot: true,
      file: { select: { fileNumber: true } },
    },
  });
}
