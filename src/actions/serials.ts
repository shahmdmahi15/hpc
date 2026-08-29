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
  AuditAction,
} from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { getStartAndEndOfBSTDay, parseBSTTime } from "@/lib/date";
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
  const effectiveToldTime =
    data.toldTime ||
    slotConf.seatTimes[currentSlotBookingsCount] ||
    `${slotConf.startHour}:00`;

  let parsedToldTime = parseBSTTime(effectiveToldTime, data.date);
  if (!parsedToldTime) {
    parsedToldTime =
      parseBSTTime(`${slotConf.startHour}:00`, data.date) || target;
  }

  // Validate room is not staff-only
  let validatedRoomNo: string | null = null;
  if (data.roomNo) {
    const cleanRoom = data.roomNo.replace(/[^0-9A-Za-z]/g, "");
    if (cleanRoom) {
      const room = await prisma.room.findUnique({
        where: { roomNumber: cleanRoom },
      });
      if (room && room.isStaffOnly) {
        return {
          error: `Room ${cleanRoom} (${room.name}) is a Staff-Only room and cannot be assigned to patients.`,
        };
      }
      validatedRoomNo = cleanRoom;
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
      roomNo: validatedRoomNo,
      isReport: !!data.isReport,
      notes: data.notes || null,
      fee: 500,
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

  let arrivalTime = new Date();
  if (data.customArrivalTime) {
    const custom =
      parseBSTTime(data.customArrivalTime) || new Date(data.customArrivalTime);
    if (!isNaN(custom.getTime())) {
      arrivalTime = custom;
    }
  }

  let latenessMinutes = 0;
  let punctualityStatus: PunctualityStatus = PunctualityStatus.ON_TIME;
  let queuePriorityScore = 0;

  if (existing.toldTime) {
    const told = new Date(existing.toldTime);
    if (!isNaN(told.getTime())) {
      const diffMs = arrivalTime.getTime() - told.getTime();
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
  }

  let validatedRoomNo = existing.roomNo || "207";
  if (data.roomNo) {
    const cleanRoom = data.roomNo.replace(/[^0-9A-Za-z]/g, "");
    if (cleanRoom) {
      const room = await prisma.room.findUnique({
        where: { roomNumber: cleanRoom },
      });
      if (room && room.isStaffOnly) {
        return {
          error: `Room ${cleanRoom} (${room.name}) is a Staff-Only room and cannot be assigned to patients.`,
        };
      }
      validatedRoomNo = cleanRoom;
    }
  }

  const updatedSerial = await prisma.serial.update({
    where: { id: data.serialId },
    data: {
      inTime: arrivalTime,
      latenessMinutes,
      punctualityStatus,
      queuePriorityScore,
      status: SerialStatus.WAITING,
      roomNo: validatedRoomNo,
    },
    include: {
      patient: true,
      doctor: true,
      handler: true,
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

export async function updateSerialPayment(data: {
  serialId: string;
  fee?: number;
  paidAmount: number;
  discount?: number;
  isNoPayment?: boolean;
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
  notes?: string;
}) {
  const session = await getCurrentSession();
  const existing = await prisma.serial.findUnique({
    where: { id: data.serialId },
    include: {
      patient: true,
      billingRecords: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!existing) {
    return { error: "Serial record not found." };
  }

  const fee =
    data.fee !== undefined && !isNaN(Number(data.fee))
      ? Math.max(0, Number(data.fee))
      : (existing.fee ?? 500);
  const isNP = Boolean(data.isNoPayment);
  const discount = Math.max(0, Number(data.discount) || 0);
  const netPayable = Math.max(0, fee - discount);
  const paidAmount = isNP ? 0 : Math.max(0, Number(data.paidAmount) || 0);
  const dueAmount = isNP ? 0 : Math.max(0, netPayable - paidAmount);

  let finalPaymentStatus: PaymentStatus =
    data.paymentStatus || PaymentStatus.UNPAID;
  if (isNP) {
    finalPaymentStatus = PaymentStatus.PAID;
  } else if (!data.paymentStatus) {
    if (paidAmount >= netPayable && netPayable >= 0) {
      finalPaymentStatus = PaymentStatus.PAID;
    } else if (paidAmount > 0) {
      finalPaymentStatus = PaymentStatus.PARTIALLY_PAID;
    } else {
      finalPaymentStatus = PaymentStatus.UNPAID;
    }
  }

  const paymentMethod =
    data.paymentMethod || existing.paymentMethod || PaymentMethod.CASH;

  // Find existing billing record for this serial if any
  const existingBilling = existing.billingRecords?.[0];

  const operations: any[] = [
    prisma.serial.update({
      where: { id: data.serialId },
      data: {
        fee,
        paidAmount,
        isPackageCovered: isNP,
        paymentStatus: finalPaymentStatus,
        paymentMethod,
      },
      include: {
        patient: true,
        doctor: true,
        handler: true,
        billingRecords: true,
      },
    }),
  ];

  if (existingBilling) {
    operations.push(
      prisma.billingRecord.update({
        where: { id: existingBilling.id },
        data: {
          actualBill: fee,
          paidAmount,
          advanceAmount: discount,
          dueAmount,
          isPackageCovered: isNP,
          paymentMethod,
          cashierId: session?.user?.id || existingBilling.cashierId || null,
          notes:
            data.notes?.trim() ||
            (isNP
              ? "N.P (No Payment Made / Package Covered)"
              : `Serial #${existing.serialNumber} Desk Payment Updated`),
        },
        include: {
          patient: true,
          cashier: true,
        },
      }),
    );
  } else {
    operations.push(
      prisma.billingRecord.create({
        data: {
          patientId: existing.patient.id,
          serialId: existing.id,
          date: existing.date || new Date(),
          actualBill: fee,
          paidAmount,
          advanceAmount: discount,
          dueAmount,
          isPackageCovered: isNP,
          paymentMethod,
          cashierId: session?.user?.id || null,
          notes:
            data.notes?.trim() ||
            (isNP
              ? "N.P (No Payment Made / Package Covered)"
              : `Serial #${existing.serialNumber} Desk Collection`),
        },
        include: {
          patient: true,
          cashier: true,
        },
      }),
    );
  }

  const [updatedSerial, billingRecord] = await prisma.$transaction(operations);

  await prisma.auditLog.create({
    data: {
      action: AuditAction.SERIAL_UPDATE,
      entity: "Serial",
      entityId: existing.id,
      userId: session?.user?.id || null,
      details: `Receptionist updated payment for Serial #${existing.serialNumber} (${existing.patient.name}): Fee ৳${fee}, Paid ৳${paidAmount}, Due ৳${dueAmount}, Status: ${finalPaymentStatus}`,
    },
  });

  realtimeBus.notify("BILLING_RECORDED", { billingRecord });
  realtimeBus.notify("SERIAL_UPDATED", { serial: updatedSerial });

  revalidatePath("/");
  revalidatePath("/receptionist");
  revalidatePath("/admin");
  revalidatePath("/admin/ledger");

  return { success: true, serial: updatedSerial, billingRecord };
}

export async function collectSerialPayment(data: {
  serialId: string;
  paidAmount: number;
  discount?: number;
  isNoPayment?: boolean;
  paymentMethod?: PaymentMethod;
  notes?: string;
}) {
  return updateSerialPayment(data);
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

  if (chamberRoom) {
    const cleanRoom = chamberRoom.replace(/[^0-9A-Za-z]/g, "");
    if (cleanRoom) {
      const room = await prisma.room.findUnique({
        where: { roomNumber: cleanRoom },
      });
      if (room && room.isStaffOnly) {
        return {
          error: `Room ${chamberRoom} (${room.name}) is a Staff-Only room and cannot be assigned to patients.`,
        };
      }
    }
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
    const cleanRoom = chamberRoom.replace(/[^0-9A-Za-z]/g, "");
    if (cleanRoom) {
      const room = await prisma.room.findUnique({
        where: { roomNumber: cleanRoom },
      });
      if (room && room.isStaffOnly) {
        return {
          error: `Room ${chamberRoom} (${room.name}) is a Staff-Only room and cannot be assigned to patients.`,
        };
      }
    }
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
  const safeDate = (val?: string | Date | null) => {
    if (!val) return null;
    if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
    const parsed = parseBSTTime(val) || new Date(val);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  const data: Prisma.SerialUpdateInput = {};
  if (timings.scheduledTime !== undefined) {
    data.scheduledTime = safeDate(timings.scheduledTime);
  }
  if (timings.inTime !== undefined) {
    data.inTime = safeDate(timings.inTime);
  }
  if (timings.therapyStartTime !== undefined) {
    data.therapyStartTime = safeDate(timings.therapyStartTime);
  }
  if (timings.outTime !== undefined) {
    data.outTime = safeDate(timings.outTime);
  }
  if (timings.restTime !== undefined) {
    data.restTime = safeDate(timings.restTime);
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

export interface UpdateSerialDetailsInput {
  serialId: string;
  date?: string;
  hourlySlot?: HourlySlot;
  timeSlot?: string;
  toldTime?: string;
  roomNo?: string;
  type?: VisitType;
  priority?: Priority;
  status?: SerialStatus;
  isReport?: boolean;
  notes?: string;
}

export async function updateSerialDetails(data: UpdateSerialDetailsInput) {
  const existing = await prisma.serial.findUnique({
    where: { id: data.serialId },
    include: { patient: true },
  });

  if (!existing) {
    return { error: "Serial record not found." };
  }

  let validatedRoomNo =
    data.roomNo !== undefined
      ? data.roomNo
        ? data.roomNo.replace(/[^0-9A-Za-z]/g, "")
        : null
      : existing.roomNo;
  if (validatedRoomNo) {
    const room = await prisma.room.findUnique({
      where: { roomNumber: validatedRoomNo },
    });
    if (room && room.isStaffOnly) {
      return {
        error: `Room ${validatedRoomNo} (${room.name}) is a Staff-Only room and cannot be assigned to patients.`,
      };
    }
  }

  // Parse appointment date if changing
  let targetDate = existing.date;
  if (data.date) {
    const { startOfDay } = getStartAndEndOfBSTDay(data.date);
    targetDate = startOfDay;
  }

  // Parse told time if changing
  let parsedToldTime = existing.toldTime;
  if (data.toldTime) {
    const custom = parseBSTTime(data.toldTime) || new Date(data.toldTime);
    if (!isNaN(custom.getTime())) {
      parsedToldTime = custom;
    } else {
      const match = data.toldTime.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
      if (match) {
        let hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const modifier = match[3]?.toUpperCase();
        if (modifier === "PM" && hours < 12) hours += 12;
        if (modifier === "AM" && hours === 12) hours = 0;
        parsedToldTime = new Date(targetDate);
        parsedToldTime.setHours(hours, minutes, 0, 0);
      }
    }
  }

  const updateData: Prisma.SerialUpdateInput = {
    date: targetDate,
    roomNo: validatedRoomNo,
    notes:
      data.notes !== undefined ? data.notes.trim() || null : existing.notes,
    isReport: data.isReport !== undefined ? data.isReport : existing.isReport,
  };

  if (data.hourlySlot !== undefined) {
    updateData.hourlySlot = data.hourlySlot;
    if (data.timeSlot) {
      updateData.timeSlot = data.timeSlot;
    }
  }

  if (parsedToldTime) {
    updateData.toldTime = parsedToldTime;
    updateData.scheduledTime = parsedToldTime;
  }

  if (data.type !== undefined) {
    updateData.type = data.type;
  }

  if (data.priority !== undefined) {
    updateData.priority = data.priority;
  }

  if (data.status !== undefined) {
    updateData.status = data.status;
  }

  const updatedSerial = await prisma.serial.update({
    where: { id: data.serialId },
    data: updateData,
    include: {
      patient: true,
      doctor: true,
      handler: true,
    },
  });

  realtimeBus.notify("SERIAL_UPDATED", { serial: updatedSerial });
  if (data.status && data.status !== existing.status) {
    realtimeBus.notify("SERIAL_STATUS_CHANGED", {
      serial: updatedSerial,
      status: data.status,
    });
  }

  revalidatePath("/");
  revalidatePath("/receptionist");
  revalidatePath("/doctor");
  revalidatePath("/handler");

  return { success: true, serial: updatedSerial };
}
