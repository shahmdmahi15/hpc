"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth";
import { realtimeBus } from "@/lib/events";
import { revalidatePath } from "next/cache";
import { getStartAndEndOfBSTDay } from "@/lib/date";
import { Role, AuditAction, SerialStatus } from "@/generated/prisma/enums";

export interface CreateSlotInput {
  slotCode?: string;
  startTime: string; // e.g. "10:00 AM" or "10:00"
  endTime: string; // e.g. "11:00 AM" or "11:00"
  label: string; // e.g. "10:00 AM - 11:00 AM"
  maxCapacity?: number; // e.g. 6
  intervalMinutes?: number; // e.g. 10
  isActive?: boolean;
  isVipOnly?: boolean;
  notes?: string;
}

export interface UpdateSlotInput {
  slotCode?: string;
  startTime?: string;
  endTime?: string;
  label?: string;
  maxCapacity?: number;
  intervalMinutes?: number;
  isActive?: boolean;
  isVipOnly?: boolean;
  notes?: string;
}

// ----------------------------------------------------
// DEFAULT INITIAL SLOTS (SEEDED ONLY ONCE IF DB HAS 0 SLOTS)
// ----------------------------------------------------
const INITIAL_DEFAULT_SLOTS = [
  {
    slotCode: "SLOT_10_11",
    startTime: "10:00 AM",
    endTime: "11:00 AM",
    label: "10:00 AM - 11:00 AM",
    maxCapacity: 6,
    intervalMinutes: 10,
    notes: "Morning Session 1",
  },
  {
    slotCode: "SLOT_11_12",
    startTime: "11:00 AM",
    endTime: "12:00 PM",
    label: "11:00 AM - 12:00 PM",
    maxCapacity: 6,
    intervalMinutes: 10,
    notes: "Morning Session 2",
  },
  {
    slotCode: "SLOT_12_01",
    startTime: "12:00 PM",
    endTime: "01:00 PM",
    label: "12:00 PM - 01:00 PM",
    maxCapacity: 6,
    intervalMinutes: 10,
    notes: "Midday Consultation",
  },
  {
    slotCode: "SLOT_01_02",
    startTime: "01:00 PM",
    endTime: "02:00 PM",
    label: "01:00 PM - 02:00 PM",
    maxCapacity: 6,
    intervalMinutes: 10,
    notes: "Early Afternoon Session",
  },
  {
    slotCode: "SLOT_02_03",
    startTime: "02:00 PM",
    endTime: "03:00 PM",
    label: "02:00 PM - 03:00 PM",
    maxCapacity: 6,
    intervalMinutes: 10,
    notes: "Afternoon Session",
  },
  {
    slotCode: "SLOT_03_04",
    startTime: "03:00 PM",
    endTime: "04:00 PM",
    label: "03:00 PM - 04:00 PM",
    maxCapacity: 6,
    intervalMinutes: 10,
    notes: "Post-Lunch Therapy",
  },
  {
    slotCode: "SLOT_04_05",
    startTime: "04:00 PM",
    endTime: "05:00 PM",
    label: "04:00 PM - 05:00 PM",
    maxCapacity: 6,
    intervalMinutes: 10,
    notes: "Late Afternoon Session",
  },
  {
    slotCode: "SLOT_05_06",
    startTime: "05:00 PM",
    endTime: "06:00 PM",
    label: "05:00 PM - 06:00 PM",
    maxCapacity: 6,
    intervalMinutes: 10,
    notes: "Evening Peak Session 1",
  },
  {
    slotCode: "SLOT_06_07",
    startTime: "06:00 PM",
    endTime: "07:00 PM",
    label: "06:00 PM - 07:00 PM",
    maxCapacity: 6,
    intervalMinutes: 10,
    notes: "Evening Peak Session 2",
  },
  {
    slotCode: "SLOT_07_08",
    startTime: "07:00 PM",
    endTime: "08:00 PM",
    label: "07:00 PM - 08:00 PM",
    maxCapacity: 6,
    intervalMinutes: 10,
    notes: "Final Evening Session",
  },
];

export async function ensureDefaultSlotsSeeded() {
  const count = await prisma.bookingSlot.count();
  if (count === 0) {
    for (let i = 0; i < INITIAL_DEFAULT_SLOTS.length; i++) {
      const s = INITIAL_DEFAULT_SLOTS[i];
      await prisma.bookingSlot.create({
        data: {
          slotCode: s.slotCode,
          startTime: s.startTime,
          endTime: s.endTime,
          label: s.label,
          maxCapacity: s.maxCapacity,
          intervalMinutes: s.intervalMinutes,
          isActive: true,
          sortOrder: i + 1,
          notes: s.notes,
        },
      });
    }
  }
}

// ----------------------------------------------------
// ADMIN-ONLY: CREATE NEW BOOKING SLOT
// ----------------------------------------------------
export async function createBookingSlot(data: CreateSlotInput) {
  const session = await getCurrentSession();
  if (
    !session ||
    (session.user.role !== Role.ADMIN &&
      (session.user.role as string) !== "SUPER_ADMIN")
  ) {
    return {
      error: "Permission Denied: Only Admin can create new booking slots.",
    };
  }

  if (!data.startTime || !data.endTime) {
    return { error: "Start time and End time are required." };
  }

  const label = data.label?.trim() || `${data.startTime} - ${data.endTime}`;
  const code =
    data.slotCode?.trim() ||
    `SLOT_${data.startTime.replace(/[^0-9A-Za-z]/g, "")}_${data.endTime.replace(/[^0-9A-Za-z]/g, "")}`.toUpperCase();

  const existing = await prisma.bookingSlot.findUnique({
    where: { slotCode: code },
  });

  if (existing) {
    return { error: `Slot with code "${code}" already exists.` };
  }

  const maxCapacity = Math.max(1, Number(data.maxCapacity) || 6);
  const intervalMinutes = Math.max(1, Number(data.intervalMinutes) || 10);
  const highestSort = await prisma.bookingSlot.findFirst({
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const slot = await prisma.bookingSlot.create({
    data: {
      slotCode: code,
      startTime: data.startTime.trim(),
      endTime: data.endTime.trim(),
      label,
      maxCapacity,
      intervalMinutes,
      isActive: data.isActive !== undefined ? data.isActive : true,
      isVipOnly: Boolean(data.isVipOnly),
      sortOrder: (highestSort?.sortOrder || 0) + 1,
      notes: data.notes?.trim() || null,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: AuditAction.SLOT_CREATE,
      entity: "BookingSlot",
      entityId: slot.id,
      userId: session.user.id,
      details: `Created new booking slot: ${slot.label} (Max Capacity: ${maxCapacity} patients, ${intervalMinutes}m tokens)`,
    },
  });

  realtimeBus.notify("SLOT_UPDATED", { type: "SLOT_CREATED", slot });
  revalidatePath("/admin");
  revalidatePath("/admin/slots");
  revalidatePath("/receptionist");
  revalidatePath("/");

  return { success: true, slot };
}

// ----------------------------------------------------
// ADMIN-ONLY: UPDATE BOOKING SLOT
// ----------------------------------------------------
export async function updateBookingSlot(id: string, data: UpdateSlotInput) {
  const session = await getCurrentSession();
  if (
    !session ||
    (session.user.role !== Role.ADMIN &&
      (session.user.role as string) !== "SUPER_ADMIN")
  ) {
    return { error: "Permission Denied: Only Admin can edit booking slots." };
  }

  const existing = await prisma.bookingSlot.findUnique({ where: { id } });
  if (!existing) {
    return { error: "Booking slot not found." };
  }

  if (data.slotCode && data.slotCode.trim() !== existing.slotCode) {
    const duplicate = await prisma.bookingSlot.findUnique({
      where: { slotCode: data.slotCode.trim() },
    });
    if (duplicate) {
      return { error: `Slot code "${data.slotCode}" is already in use.` };
    }
  }

  const slot = await prisma.bookingSlot.update({
    where: { id },
    data: {
      slotCode: data.slotCode ? data.slotCode.trim() : undefined,
      startTime: data.startTime ? data.startTime.trim() : undefined,
      endTime: data.endTime ? data.endTime.trim() : undefined,
      label: data.label ? data.label.trim() : undefined,
      maxCapacity:
        data.maxCapacity !== undefined
          ? Math.max(1, Number(data.maxCapacity))
          : undefined,
      intervalMinutes:
        data.intervalMinutes !== undefined
          ? Math.max(1, Number(data.intervalMinutes))
          : undefined,
      isActive: data.isActive !== undefined ? data.isActive : undefined,
      isVipOnly: data.isVipOnly !== undefined ? data.isVipOnly : undefined,
      notes: data.notes !== undefined ? data.notes?.trim() || null : undefined,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: AuditAction.SLOT_UPDATE,
      entity: "BookingSlot",
      entityId: slot.id,
      userId: session.user.id,
      details: `Updated booking slot ${slot.slotCode}: ${slot.label} (Max Capacity: ${slot.maxCapacity})`,
    },
  });

  realtimeBus.notify("SLOT_UPDATED", { type: "SLOT_UPDATED", slot });
  revalidatePath("/admin");
  revalidatePath("/admin/slots");
  revalidatePath("/receptionist");
  revalidatePath("/");

  return { success: true, slot };
}

// ----------------------------------------------------
// ADMIN-ONLY: DELETE BOOKING SLOT
// ----------------------------------------------------
export async function deleteBookingSlot(id: string) {
  const session = await getCurrentSession();
  if (
    !session ||
    (session.user.role !== Role.ADMIN &&
      (session.user.role as string) !== "SUPER_ADMIN")
  ) {
    return { error: "Permission Denied: Only Admin can delete booking slots." };
  }

  const existing = await prisma.bookingSlot.findUnique({ where: { id } });
  if (!existing) {
    return { error: "Booking slot not found." };
  }

  await prisma.bookingSlot.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      action: AuditAction.SLOT_DELETE,
      entity: "BookingSlot",
      entityId: id,
      userId: session.user.id,
      details: `Deleted booking slot ${existing.slotCode} (${existing.label})`,
    },
  });

  realtimeBus.notify("SLOT_UPDATED", { type: "SLOT_DELETED", id });
  revalidatePath("/admin");
  revalidatePath("/admin/slots");
  revalidatePath("/receptionist");
  revalidatePath("/");

  return { success: true };
}

// ----------------------------------------------------
// ADMIN-ONLY: TOGGLE ACTIVE STATUS
// ----------------------------------------------------
export async function toggleBookingSlotStatus(id: string, isActive: boolean) {
  return updateBookingSlot(id, { isActive });
}

// ----------------------------------------------------
// GET ALL DYNAMIC BOOKING SLOTS (SYSTEM-WIDE)
// ----------------------------------------------------
export async function getAllBookingSlots(includeInactive = false) {
  await ensureDefaultSlotsSeeded();
  return prisma.bookingSlot.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

// ----------------------------------------------------
// GET DYNAMIC REAL-TIME DAILY SLOT AVAILABILITY (TICKET MATRIX)
// ----------------------------------------------------
export async function getDynamicSlotAvailability(dateStr?: string) {
  await ensureDefaultSlotsSeeded();
  const { startOfDay, endOfDay } = getStartAndEndOfBSTDay(dateStr);

  const [dbSlots, todaySerials] = await Promise.all([
    prisma.bookingSlot.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.serial.findMany({
      where: {
        date: { gte: startOfDay, lte: endOfDay },
        status: { not: SerialStatus.CANCELLED },
      },
      orderBy: { serialNumber: "asc" },
      include: {
        patient: {
          select: {
            id: true,
            patientId: true,
            name: true,
            phone: true,
            gender: true,
          },
        },
        doctor: { select: { id: true, name: true } },
      },
    }),
  ]);

  const availability = dbSlots.map((slot) => {
    // Match today's serials for this slot by hourlySlot or matching label/code
    const matchingSerials = todaySerials.filter((s) => {
      if (s.hourlySlot === slot.slotCode) return true;
      if (
        s.hourlySlot &&
        s.hourlySlot.replace(/[^0-9]/g, "") ===
          slot.slotCode.replace(/[^0-9]/g, "")
      )
        return true;
      if (s.timeSlot && slot.label.includes(s.timeSlot)) return true;
      return false;
    });

    const bookedCount = matchingSerials.length;
    const maxCapacity = slot.maxCapacity || 6;
    const remainingSeats = Math.max(0, maxCapacity - bookedCount);
    const isSoldOut = bookedCount >= maxCapacity;
    const isFillingFast =
      bookedCount >= Math.floor(maxCapacity * 0.6) && !isSoldOut;

    // Generate token seat times dynamically (e.g. 6 seats at 10-minute intervals)
    const seatTokens = Array.from({ length: maxCapacity }, (_, idx) => {
      const serialForSeat = matchingSerials[idx] || null;
      return {
        seatNumber: idx + 1,
        isBooked: Boolean(serialForSeat),
        serial: serialForSeat
          ? {
              id: serialForSeat.id,
              serialNumber: serialForSeat.serialNumber,
              patientName: serialForSeat.patient.name,
              patientId: serialForSeat.patient.patientId,
              status: serialForSeat.status,
              doctorName: serialForSeat.doctor?.name,
              roomNo: serialForSeat.roomNo,
              toldTime: serialForSeat.toldTime,
            }
          : null,
      };
    });

    return {
      id: slot.id,
      slotCode: slot.slotCode,
      label: slot.label,
      startTime: slot.startTime,
      endTime: slot.endTime,
      maxCapacity,
      intervalMinutes: slot.intervalMinutes,
      isActive: slot.isActive,
      isVipOnly: slot.isVipOnly,
      notes: slot.notes,
      bookedCount,
      remainingSeats,
      isSoldOut,
      isFillingFast,
      seatTokens,
      serials: matchingSerials,
    };
  });

  const totalCapacity = availability.reduce(
    (acc, s) => acc + (s.isActive ? s.maxCapacity : 0),
    0,
  );
  const totalBooked = availability.reduce((acc, s) => acc + s.bookedCount, 0);
  const totalRemaining = Math.max(0, totalCapacity - totalBooked);

  return {
    dateStr: startOfDay.toISOString(),
    slots: availability,
    stats: {
      totalSlots: availability.length,
      activeSlotsCount: availability.filter((s) => s.isActive).length,
      totalCapacity,
      totalBooked,
      totalRemaining,
      soldOutSlotsCount: availability.filter((s) => s.isActive && s.isSoldOut)
        .length,
    },
  };
}
