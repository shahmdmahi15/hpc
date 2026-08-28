"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth";
import { realtimeBus } from "@/lib/events";
import {
  SerialStatus,
  VisitType,
  Priority,
  Gender,
  HourlySlot,
  PaymentStatus,
  PaymentMethod,
  PunctualityStatus,
} from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { getStartAndEndOfBSTDay } from "@/lib/date";
import { getDynamicSlotAvailability } from "@/actions/slots";
import { getSlotConfig, MAX_PATIENTS_PER_SLOT } from "@/lib/slot-config";

export interface BookSerialInput {
  patientId: string; // Patient record id or 4-digit patientId
  doctorId?: string;
  handlerId?: string;
  date?: string; // ISO date or defaults to today
  timeSlot?: string; // e.g. "01:00 - 02:00 PM"
  hourlySlot?: HourlySlot;
  toldTime?: string; // Promised arrival time told by receptionist (e.g. "14:30" or ISO)
  gender?: Gender;
  type?: VisitType;
  priority?: Priority;
  roomNo?: string;
  isReport?: boolean;
  notes?: string;
  fee?: number;
  paidAmount?: number;
  isPackageCovered?: boolean;
  paymentMethod?: PaymentMethod;
}

// ----------------------------------------------------
// GET DAILY SLOT AVAILABILITY (TICKET BOOKING SYSTEM)
// ----------------------------------------------------
export async function getDailySlotAvailability(dateStr?: string) {
  return getDynamicSlotAvailability(dateStr);
}

export async function getDailySerials(dateStr?: string) {
  const { startOfDay, endOfDay } = getStartAndEndOfBSTDay(dateStr);

  return prisma.serial.findMany({
    where: {
      date: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
    orderBy: [{ serialNumber: "desc" }],
    include: {
      patient: true,
      doctor: { select: { id: true, name: true, role: true } },
      handler: { select: { id: true, name: true, role: true } },
      createdBy: { select: { id: true, name: true } },
      billingRecords: true,
    },
  });
}

export async function getDoctorQueue(doctorId?: string, dateStr?: string) {
  const { startOfDay, endOfDay } = getStartAndEndOfBSTDay(dateStr);

  const whereClause: Prisma.SerialWhereInput = {
    date: {
      gte: startOfDay,
      lte: endOfDay,
    },
    status: {
      in: [
        SerialStatus.PENDING,
        SerialStatus.WAITING,
        SerialStatus.CHECKED_IN,
        SerialStatus.IN_CONSULTATION,
        SerialStatus.COMPLETED,
      ],
    },
  };

  if (doctorId) {
    whereClause.OR = [{ doctorId }, { doctorId: null }];
  }

  return prisma.serial.findMany({
    where: whereClause,
    orderBy: [{ queuePriorityScore: "asc" }, { serialNumber: "asc" }],
    include: {
      patient: {
        include: {
          assessments: {
            take: 1,
            orderBy: { date: "desc" },
          },
          treatmentSessions: {
            take: 3,
            orderBy: { date: "desc" },
          },
        },
      },
      doctor: { select: { id: true, name: true } },
      handler: { select: { id: true, name: true } },
    },
  });
}

export async function getHandlerQueue(dateStr?: string) {
  const { startOfDay, endOfDay } = getStartAndEndOfBSTDay(dateStr);

  return prisma.serial.findMany({
    where: {
      date: {
        gte: startOfDay,
        lte: endOfDay,
      },
      // Handler ONLY sees patients assigned/routed to therapy by Doctor
      OR: [
        { status: SerialStatus.IN_THERAPY },
        { assignedTreatmentPlan: { not: null } },
      ],
    },
    orderBy: [{ queuePriorityScore: "asc" }, { serialNumber: "asc" }],
    include: {
      patient: {
        include: {
          assessments: {
            take: 1,
            orderBy: { date: "desc" },
          },
          treatmentSessions: {
            take: 5,
            orderBy: { date: "desc" },
          },
        },
      },
      doctor: { select: { id: true, name: true } },
      handler: { select: { id: true, name: true } },
    },
  });
}

export async function bookSerial(data: BookSerialInput) {
  const session = await getCurrentSession();
  const { startOfDay, endOfDay, target } = getStartAndEndOfBSTDay(data.date);

  // Find patient
  const patient = await prisma.patient.findFirst({
    where: {
      OR: [{ id: data.patientId }, { patientId: data.patientId }],
    },
  });

  if (!patient) {
    return { error: "Patient record not found." };
  }

  const chosenSlot = data.hourlySlot || HourlySlot.SLOT_02_03;
  const slotConf = getSlotConfig(chosenSlot);

  // TICKET BOOKING SYSTEM: DYNAMIC MAXIMUM CAPACITY CHECK FROM DATABASE
  const dbSlot = await prisma.bookingSlot.findUnique({
    where: { slotCode: chosenSlot },
  });
  const maxCapacity = dbSlot?.maxCapacity ?? MAX_PATIENTS_PER_SLOT;

  const currentSlotBookingsCount = await prisma.serial.count({
    where: {
      date: {
        gte: startOfDay,
        lte: endOfDay,
      },
      hourlySlot: chosenSlot,
      status: { not: SerialStatus.CANCELLED },
    },
  });

  if (currentSlotBookingsCount >= maxCapacity) {
    return {
      error: `Slot "${dbSlot?.label || slotConf.label}" is FULL (${currentSlotBookingsCount}/${maxCapacity} tickets booked). Please select another time slot.`,
    };
  }

  // Calculate next sequential serial number for the day
  const latestSerial = await prisma.serial.findFirst({
    where: {
      date: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
    orderBy: { serialNumber: "desc" },
  });

  const nextSerialNumber = (latestSerial?.serialNumber ?? 0) + 1;

  // Format code e.g. "HPC-26-01"
  const formattedDate = target.toISOString().slice(2, 10).replace(/-/g, "");
  const serialCode = `HPC-${formattedDate}-${String(nextSerialNumber).padStart(2, "0")}`;

  // Parse toldTime (promised arrival time) or auto-assign seat time
  let parsedToldTime: Date | null = null;
  const effectiveToldTime =
    data.toldTime ||
    slotConf.seatTimes[currentSlotBookingsCount] ||
    `${slotConf.startHour}:00`;

  if (effectiveToldTime) {
    if (effectiveToldTime.includes("T")) {
      parsedToldTime = new Date(effectiveToldTime);
    } else if (effectiveToldTime.includes(":")) {
      const [hours, minutes] = effectiveToldTime.split(":").map(Number);
      parsedToldTime = new Date(target);
      parsedToldTime.setHours(hours, minutes, 0, 0);
    }
  }

  const serial = await prisma.serial.create({
    data: {
      serialNumber: nextSerialNumber,
      serialCode,
      date: target,
      timeSlot: slotConf.label,
      hourlySlot: chosenSlot,
      toldTime: parsedToldTime,
      scheduledTime: parsedToldTime,
      gender: data.gender || patient.gender,
      status: SerialStatus.PENDING,
      type: data.type || VisitType.NEW_CONSULTATION,
      priority: data.priority || Priority.REGULAR,
      roomNo: data.roomNo ? data.roomNo.replace(/[^0-9]/g, "") || null : null,
      isReport: !!data.isReport,
      notes: data.notes || null,
      fee: data.fee ?? 500,
      paidAmount: 0,
      isPackageCovered: false,
      paymentStatus: PaymentStatus.UNPAID,
      paymentMethod: null,
      patientId: patient.id,
      doctorId: data.doctorId || null,
      handlerId: data.handlerId || null,
      createdById: session?.user?.id || null,
    },
    include: {
      patient: true,
      doctor: true,
      handler: true,
    },
  });

  realtimeBus.notify("SERIAL_CREATED", { serial });
  revalidatePath("/");
  revalidatePath("/receptionist");
  revalidatePath("/doctor");
  revalidatePath("/handler");

  return { success: true, serial };
}

export async function checkInPatient(data: {
  serialId: string;
  paidAmount?: number;
  isNoPayment?: boolean;
  paymentMethod?: PaymentMethod;
  customArrivalTime?: string;
  roomNo?: string;
}) {
  const session = await getCurrentSession();
  const existing = await prisma.serial.findUnique({
    where: { id: data.serialId },
    include: { patient: true },
  });

  if (!existing) {
    return { error: "Serial record not found." };
  }

  const arrivalTime = data.customArrivalTime
    ? new Date(data.customArrivalTime)
    : new Date();

  let latenessMinutes = 0;
  let punctualityStatus: PunctualityStatus = PunctualityStatus.ON_TIME;
  let queuePriorityScore = 0;

  if (existing.toldTime) {
    const diffMs =
      arrivalTime.getTime() - new Date(existing.toldTime).getTime();
    latenessMinutes = Math.round(diffMs / 60000);

    if (latenessMinutes <= 0) {
      // Early or on time (Green)
      punctualityStatus = PunctualityStatus.ON_TIME;
      queuePriorityScore = 0;
    } else if (latenessMinutes <= 30) {
      // Up to 30 mins late (Yellow)
      punctualityStatus = PunctualityStatus.MODERATE_LATE;
      queuePriorityScore = 0;
    } else {
      // More than 30 mins late (Red - penalty push back 5 positions)
      punctualityStatus = PunctualityStatus.SEVERE_LATE;
      queuePriorityScore = 5;
    }
  }

  const fee = existing.fee ?? 500;
  const isNP = !!data.isNoPayment;
  const collectedAmount = isNP ? 0 : (data.paidAmount ?? fee);

  const updatedSerial = await prisma.serial.update({
    where: { id: data.serialId },
    data: {
      inTime: arrivalTime,
      latenessMinutes,
      punctualityStatus,
      queuePriorityScore,
      status: SerialStatus.WAITING,
      roomNo: data.roomNo
        ? data.roomNo.replace(/[^0-9]/g, "") || data.roomNo
        : existing.roomNo,
      paidAmount: collectedAmount,
      isPackageCovered: isNP,
      paymentStatus: isNP
        ? PaymentStatus.PAID
        : collectedAmount >= fee
          ? PaymentStatus.PAID
          : PaymentStatus.UNPAID,
      paymentMethod: data.paymentMethod || PaymentMethod.CASH,
    },
    include: {
      patient: true,
      doctor: true,
      handler: true,
    },
  });

  // Create official desk cashier collection record
  await prisma.billingRecord.create({
    data: {
      patientId: existing.patient.id,
      serialId: updatedSerial.id,
      date: updatedSerial.date,
      actualBill: fee,
      paidAmount: collectedAmount,
      dueAmount: Math.max(0, fee - collectedAmount),
      isPackageCovered: isNP,
      paymentMethod: data.paymentMethod || PaymentMethod.CASH,
      cashierId: session?.user?.id || null,
      notes: isNP ? "N.P (No Payment Made)" : "Serial Desk Payment",
    },
  });

  realtimeBus.notify("SERIAL_STATUS_CHANGED", {
    serial: updatedSerial,
    status: SerialStatus.WAITING,
    punctualityStatus,
  });

  revalidatePath("/");
  revalidatePath("/receptionist");
  revalidatePath("/doctor");
  revalidatePath("/handler");

  return { success: true, serial: updatedSerial };
}

export async function assignToHandlerWithPlan(
  serialId: string,
  chamberRoom: string = "Physio Bay 1",
  treatmentPlan: string,
  handlerId?: string,
) {
  const session = await getCurrentSession();

  if (!treatmentPlan || !treatmentPlan.trim()) {
    return {
      error: "Doctor must assign a treatment plan before routing to Handler.",
    };
  }

  const serial = await prisma.serial.update({
    where: { id: serialId },
    data: {
      status: SerialStatus.IN_THERAPY,
      roomNo: chamberRoom,
      assignedTreatmentPlan: treatmentPlan.trim(),
      handlerId: handlerId || null,
      doctorId: session?.user?.id || undefined,
      therapyStartTime: new Date(),
    },
    include: {
      patient: true,
      doctor: true,
      handler: true,
    },
  });

  realtimeBus.notify("SERIAL_UPDATED", {
    serial,
    event: "ROUTED_TO_HANDLER",
    treatmentPlan: treatmentPlan.trim(),
  });
  realtimeBus.notify("SERIAL_STATUS_CHANGED", {
    serial,
    status: SerialStatus.IN_THERAPY,
  });

  revalidatePath("/");
  revalidatePath("/doctor");
  revalidatePath("/handler");
  revalidatePath("/receptionist");

  return { success: true, serial };
}

export async function updateSerialStatus(
  serialId: string,
  status: SerialStatus,
  chamberRoom?: string,
  assignedDoctorId?: string,
) {
  const existing = await prisma.serial.findUnique({
    where: { id: serialId },
    include: { patient: true },
  });

  if (!existing) {
    return { error: "Serial not found" };
  }

  const updateData: Prisma.SerialUpdateInput = { status };
  if (chamberRoom) {
    updateData.roomNo = chamberRoom;
  }
  if (assignedDoctorId) {
    updateData.doctor = { connect: { id: assignedDoctorId } };
  }

  // Auto set timestamps on status transitions
  const now = new Date();
  if (status === SerialStatus.CHECKED_IN && !existing.inTime) {
    updateData.inTime = now;
  } else if (
    (status === SerialStatus.IN_CONSULTATION ||
      status === SerialStatus.IN_THERAPY) &&
    !existing.therapyStartTime
  ) {
    updateData.therapyStartTime = now;
  } else if (status === SerialStatus.COMPLETED && !existing.outTime) {
    updateData.outTime = now;
  }

  const serial = await prisma.serial.update({
    where: { id: serialId },
    data: updateData,
    include: {
      patient: true,
      doctor: true,
      handler: true,
    },
  });

  realtimeBus.notify("SERIAL_STATUS_CHANGED", { serial, status });
  revalidatePath("/");
  revalidatePath("/receptionist");
  revalidatePath("/doctor");
  revalidatePath("/handler");

  return { success: true, serial };
}

export async function callSerial(
  serialId: string,
  chamberRoom: string = "205",
  targetStatus: SerialStatus = SerialStatus.IN_CONSULTATION,
) {
  const serial = await prisma.serial.update({
    where: { id: serialId },
    data: {
      status: targetStatus,
      roomNo: chamberRoom,
      therapyStartTime: new Date(),
    },
    include: {
      patient: true,
      doctor: true,
      handler: true,
    },
  });

  realtimeBus.notify("SERIAL_CALLED", {
    serialId: serial.id,
    serialNumber: serial.serialNumber,
    patientName: serial.patient.name,
    patientId: serial.patient.patientId,
    roomNo: chamberRoom,
    doctorName: serial.doctor?.name || "Specialist",
    status: targetStatus,
    timestamp: new Date().toISOString(),
  });

  revalidatePath("/");
  revalidatePath("/receptionist");
  revalidatePath("/doctor");
  revalidatePath("/handler");

  return { success: true, serial };
}

export async function updateSerialTimings(
  serialId: string,
  timings: {
    scheduledTime?: string;
    inTime?: string;
    therapyStartTime?: string;
    outTime?: string;
    restTime?: string;
    roomNo?: string;
    handlerId?: string;
  },
) {
  const data: Prisma.SerialUpdateInput = {};
  if (timings.scheduledTime !== undefined) {
    data.scheduledTime = timings.scheduledTime
      ? new Date(timings.scheduledTime)
      : null;
  }
  if (timings.inTime !== undefined) {
    data.inTime = timings.inTime ? new Date(timings.inTime) : null;
  }
  if (timings.therapyStartTime !== undefined) {
    data.therapyStartTime = timings.therapyStartTime
      ? new Date(timings.therapyStartTime)
      : null;
  }
  if (timings.outTime !== undefined) {
    data.outTime = timings.outTime ? new Date(timings.outTime) : null;
  }
  if (timings.restTime !== undefined) {
    data.restTime = timings.restTime ? new Date(timings.restTime) : null;
  }
  if (timings.roomNo) {
    data.roomNo = timings.roomNo;
  }
  if (timings.handlerId) {
    data.handler = { connect: { id: timings.handlerId } };
  }

  const serial = await prisma.serial.update({
    where: { id: serialId },
    data,
    include: { patient: true, handler: true, doctor: true },
  });

  realtimeBus.notify("SERIAL_UPDATED", { serial });
  revalidatePath("/");
  revalidatePath("/handler");
  revalidatePath("/receptionist");

  return { success: true, serial };
}
