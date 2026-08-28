"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth";
import { realtimeBus } from "@/lib/events";
import { revalidatePath } from "next/cache";
import { getStartAndEndOfBSTDay } from "@/lib/date";
import { SerialStatus, Role, AuditAction } from "@/generated/prisma/enums";

export interface CreateRoomInput {
  roomNumber: string;
  name: string;
  purpose: string;
  type?: string;
  capacity?: number;
  genderPreference?: "MALE" | "FEMALE" | "ALL";
  floor?: string;
  notes?: string;
  isStaffOnly?: boolean;
}

export interface UpdateRoomInput {
  roomNumber?: string;
  name?: string;
  purpose?: string;
  type?: string;
  capacity?: number;
  genderPreference?: "MALE" | "FEMALE" | "ALL";
  floor?: string;
  notes?: string;
  isActive?: boolean;
  isStaffOnly?: boolean;
}

import { compareRoomNumbers } from "@/lib/rooms";

export interface OccupyRoomInput {
  roomNumber: string;
  patientId: string;
  slotId?: string;
  handlerId?: string;
  doctorId?: string;
  expectedDurationMinutes?: number;
  notes?: string;
}

// ----------------------------------------------------
// DEFAULT SEED (ONLY EXECUTED ONCE IF DATABASE HAS 0 ROOMS)
// ----------------------------------------------------
const INITIAL_DEFAULT_ROOMS = [
  {
    roomNumber: "201",
    name: "Room 201 (Doctor Chamber 1)",
    purpose: "Doctor Consultation",
    type: "CONSULTATION",
    capacity: 1,
    genderPreference: "ALL",
    floor: "2nd Floor",
  },
  {
    roomNumber: "202",
    name: "Room 202 (Doctor Chamber 2)",
    purpose: "Doctor Consultation",
    type: "CONSULTATION",
    capacity: 1,
    genderPreference: "ALL",
    floor: "2nd Floor",
  },
  {
    roomNumber: "203",
    name: "Room 203 (Male Electrotherapy Bay 1)",
    purpose: "Male Electrotherapy",
    type: "MALE_BAY",
    capacity: 2,
    genderPreference: "MALE",
    floor: "2nd Floor",
  },
  {
    roomNumber: "204",
    name: "Room 204 (Male Electrotherapy Bay 2)",
    purpose: "Male Electrotherapy",
    type: "MALE_BAY",
    capacity: 2,
    genderPreference: "MALE",
    floor: "2nd Floor",
  },
  {
    roomNumber: "205",
    name: "Room 205 (Male Electrotherapy Bay 3)",
    purpose: "Male Electrotherapy",
    type: "MALE_BAY",
    capacity: 2,
    genderPreference: "MALE",
    floor: "2nd Floor",
  },
  {
    roomNumber: "206",
    name: "Room 206 (Male Electrotherapy Bay 4)",
    purpose: "Male Electrotherapy",
    type: "MALE_BAY",
    capacity: 2,
    genderPreference: "MALE",
    floor: "2nd Floor",
  },
  {
    roomNumber: "207",
    name: "Room 207 (Male Electrotherapy Bay 5 • Multi-Bed)",
    purpose: "Male Electrotherapy & Modalities",
    type: "MALE_BAY",
    capacity: 2,
    genderPreference: "MALE",
    floor: "2nd Floor",
  },
  {
    roomNumber: "208",
    name: "Room 208 (Male Electrotherapy Bay 6)",
    purpose: "Male Electrotherapy",
    type: "MALE_BAY",
    capacity: 2,
    genderPreference: "MALE",
    floor: "2nd Floor",
  },
  {
    roomNumber: "209",
    name: "Room 209 (Female Electrotherapy Bay 1)",
    purpose: "Female Electrotherapy",
    type: "FEMALE_BAY",
    capacity: 2,
    genderPreference: "FEMALE",
    floor: "2nd Floor",
  },
  {
    roomNumber: "210",
    name: "Room 210 (Female Electrotherapy Bay 2)",
    purpose: "Female Electrotherapy",
    type: "FEMALE_BAY",
    capacity: 2,
    genderPreference: "FEMALE",
    floor: "2nd Floor",
  },
  {
    roomNumber: "211",
    name: "Room 211 (Female Electrotherapy Bay 3)",
    purpose: "Female Electrotherapy",
    type: "FEMALE_BAY",
    capacity: 2,
    genderPreference: "FEMALE",
    floor: "2nd Floor",
  },
  {
    roomNumber: "212",
    name: "Room 212 (Female Electrotherapy Bay 4)",
    purpose: "Female Electrotherapy",
    type: "FEMALE_BAY",
    capacity: 2,
    genderPreference: "FEMALE",
    floor: "2nd Floor",
  },
  {
    roomNumber: "213",
    name: "Room 213 (Female Electrotherapy Bay 5)",
    purpose: "Female Electrotherapy",
    type: "FEMALE_BAY",
    capacity: 2,
    genderPreference: "FEMALE",
    floor: "2nd Floor",
  },
  {
    roomNumber: "214",
    name: "Room 214 (Female Electrotherapy Bay 6)",
    purpose: "Female Electrotherapy",
    type: "FEMALE_BAY",
    capacity: 2,
    genderPreference: "FEMALE",
    floor: "2nd Floor",
  },
  {
    roomNumber: "215",
    name: "Room 215 (Active Rehab Studio 1)",
    purpose: "Rehabilitation & Exercise",
    type: "REHAB_STUDIO",
    capacity: 3,
    genderPreference: "ALL",
    floor: "2nd Floor",
  },
  {
    roomNumber: "216",
    name: "Room 216 (Active Rehab Studio 2)",
    purpose: "Rehabilitation & Exercise",
    type: "REHAB_STUDIO",
    capacity: 3,
    genderPreference: "ALL",
    floor: "2nd Floor",
  },
  {
    roomNumber: "217",
    name: "Room 217 (Spinal Traction & SWD 1)",
    purpose: "Specialized Spinal Traction",
    type: "PROCEDURE",
    capacity: 2,
    genderPreference: "ALL",
    floor: "2nd Floor",
  },
  {
    roomNumber: "218",
    name: "Room 218 (Spinal Traction & SWD 2)",
    purpose: "Specialized Spinal Traction",
    type: "PROCEDURE",
    capacity: 2,
    genderPreference: "ALL",
    floor: "2nd Floor",
  },
  {
    roomNumber: "219",
    name: "Room 219 (High Intensity Laser & PMF)",
    purpose: "Laser & PMF Therapy",
    type: "PROCEDURE",
    capacity: 2,
    genderPreference: "ALL",
    floor: "2nd Floor",
  },
  {
    roomNumber: "220",
    name: "Room 220 (Specialized VIP Suite)",
    purpose: "VIP Neuromuscular Therapy",
    type: "PROCEDURE",
    capacity: 2,
    genderPreference: "ALL",
    floor: "2nd Floor",
  },
];

export async function ensureDefaultRoomsSeeded() {
  const count = await prisma.room.count();
  if (count === 0) {
    for (let i = 0; i < INITIAL_DEFAULT_ROOMS.length; i++) {
      const r = INITIAL_DEFAULT_ROOMS[i];
      const parsedNum = parseInt(r.roomNumber.replace(/[^0-9]/g, ""), 10);
      await prisma.room.create({
        data: {
          roomNumber: r.roomNumber,
          name: r.name,
          purpose: r.purpose,
          type: r.type,
          capacity: r.capacity,
          genderPreference: r.genderPreference,
          floor: r.floor,
          isActive: true,
          sortOrder: !isNaN(parsedNum) ? parsedNum : i + 1,
        },
      });
    }
  }
}

// ----------------------------------------------------
// ADMIN-ONLY: CREATE NEW ROOM
// ----------------------------------------------------
export async function createRoom(data: CreateRoomInput) {
  const session = await getCurrentSession();
  if (
    !session ||
    (session.user.role !== Role.ADMIN &&
      (session.user.role as string) !== "SUPER_ADMIN")
  ) {
    return {
      error: "Permission Denied: Only Admin can create new chambers or rooms.",
    };
  }

  const cleanNumber = data.roomNumber.trim();
  if (!cleanNumber) {
    return { error: "Room Number is required (e.g. 201, 207, 305)." };
  }

  if (!data.name || !data.name.trim()) {
    return { error: "Room Name is required." };
  }

  const existing = await prisma.room.findUnique({
    where: { roomNumber: cleanNumber },
  });

  if (existing) {
    return { error: `Room "${cleanNumber}" already exists in the system.` };
  }

  const capacity = Math.max(0, Number(data.capacity) || 0);
  const parsedNum = parseInt(cleanNumber.replace(/[^0-9]/g, ""), 10);
  const sortOrder = !isNaN(parsedNum) ? parsedNum : 999;

  const room = await prisma.room.create({
    data: {
      roomNumber: cleanNumber,
      name: data.name.trim(),
      purpose: data.purpose?.trim() || "Physiotherapy & Modalities",
      type: data.type?.trim() || "THERAPY_BAY",
      capacity,
      genderPreference: data.genderPreference || "ALL",
      floor: data.floor?.trim() || "2nd Floor",
      notes: data.notes?.trim() || null,
      isActive: true,
      isStaffOnly: Boolean(data.isStaffOnly),
      sortOrder,
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      action: AuditAction.ROOM_CREATE,
      entity: "Room",
      entityId: room.id,
      userId: session.user.id,
      details: `Created new room: ${room.roomNumber} (${room.name}) - Capacity: ${capacity} beds`,
    },
  });

  realtimeBus.notify("ROOM_OCCUPIED", { roomNumber: cleanNumber });
  realtimeBus.notify("ROOM_UPDATED", { roomNumber: cleanNumber });
  revalidatePath("/admin");
  revalidatePath("/admin/rooms");
  revalidatePath("/receptionist");
  revalidatePath("/doctor");
  revalidatePath("/handler");
  revalidatePath("/");

  return { success: true, room };
}

// ----------------------------------------------------
// ADMIN-ONLY: UPDATE ROOM
// ----------------------------------------------------
export async function updateRoom(id: string, data: UpdateRoomInput) {
  const session = await getCurrentSession();
  if (
    !session ||
    (session.user.role !== Role.ADMIN &&
      (session.user.role as string) !== "SUPER_ADMIN")
  ) {
    return {
      error: "Permission Denied: Only Admin can edit room configurations.",
    };
  }

  const existing = await prisma.room.findUnique({ where: { id } });
  if (!existing) {
    return { error: "Room not found." };
  }

  if (data.roomNumber && data.roomNumber.trim() !== existing.roomNumber) {
    const duplicate = await prisma.room.findUnique({
      where: { roomNumber: data.roomNumber.trim() },
    });
    if (duplicate) {
      return {
        error: `Room Number "${data.roomNumber}" is already in use by another room.`,
      };
    }
  }

  const parsedNum = data.roomNumber
    ? parseInt(data.roomNumber.replace(/[^0-9]/g, ""), 10)
    : undefined;

  const room = await prisma.room.update({
    where: { id },
    data: {
      roomNumber: data.roomNumber ? data.roomNumber.trim() : undefined,
      name: data.name ? data.name.trim() : undefined,
      purpose: data.purpose ? data.purpose.trim() : undefined,
      type: data.type ? data.type.trim() : undefined,
      capacity:
        data.capacity !== undefined
          ? Math.max(0, Number(data.capacity))
          : undefined,
      genderPreference: data.genderPreference,
      floor: data.floor ? data.floor.trim() : undefined,
      notes: data.notes !== undefined ? data.notes?.trim() || null : undefined,
      isActive: data.isActive !== undefined ? data.isActive : undefined,
      isStaffOnly:
        data.isStaffOnly !== undefined ? data.isStaffOnly : undefined,
      sortOrder:
        parsedNum !== undefined && !isNaN(parsedNum) ? parsedNum : undefined,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: AuditAction.ROOM_UPDATE,
      entity: "Room",
      entityId: room.id,
      userId: session.user.id,
      details: `Updated room ${room.roomNumber}: ${room.name} (Capacity: ${room.capacity})`,
    },
  });

  realtimeBus.notify("ROOM_OCCUPIED", { roomNumber: room.roomNumber });
  realtimeBus.notify("ROOM_UPDATED", { roomNumber: room.roomNumber });
  revalidatePath("/admin");
  revalidatePath("/admin/rooms");
  revalidatePath("/receptionist");
  revalidatePath("/doctor");
  revalidatePath("/handler");
  revalidatePath("/");

  return { success: true, room };
}

// ----------------------------------------------------
// ADMIN-ONLY: DELETE ROOM
// ----------------------------------------------------
export async function deleteRoom(id: string) {
  const session = await getCurrentSession();
  if (
    !session ||
    (session.user.role !== Role.ADMIN &&
      (session.user.role as string) !== "SUPER_ADMIN")
  ) {
    return { error: "Permission Denied: Only Admin can delete rooms." };
  }

  const existing = await prisma.room.findUnique({ where: { id } });
  if (!existing) {
    return { error: "Room not found." };
  }

  await prisma.room.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      action: AuditAction.ROOM_DELETE,
      entity: "Room",
      entityId: id,
      userId: session.user.id,
      details: `Deleted room ${existing.roomNumber} (${existing.name})`,
    },
  });

  realtimeBus.notify("ROOM_VACATED", { roomNumber: existing.roomNumber });
  realtimeBus.notify("ROOM_UPDATED", { roomNumber: existing.roomNumber });
  revalidatePath("/admin");
  revalidatePath("/admin/rooms");
  revalidatePath("/receptionist");
  revalidatePath("/doctor");
  revalidatePath("/handler");
  revalidatePath("/");

  return { success: true };
}

// ----------------------------------------------------
// ADMIN-ONLY: TOGGLE ACTIVE / INACTIVE
// ----------------------------------------------------
export async function toggleRoomStatus(id: string, isActive: boolean) {
  return updateRoom(id, { isActive });
}

// ----------------------------------------------------
// ADMIN-ONLY: TOGGLE STAFF ONLY ACCESS
// ----------------------------------------------------
export async function toggleRoomStaffOnly(id: string, isStaffOnly: boolean) {
  return updateRoom(id, { isStaffOnly });
}

// ----------------------------------------------------
// GET ALL DYNAMIC ACTIVE ROOMS (FOR USER SELECTION)
// ----------------------------------------------------
export async function getActiveRooms() {
  await ensureDefaultRoomsSeeded();
  const rooms = await prisma.room.findMany({
    where: { isActive: true },
  });
  return rooms.sort((a, b) => compareRoomNumbers(a.roomNumber, b.roomNumber));
}

// ----------------------------------------------------
// GET ALL ROOMS (ADMIN DASHBOARD MANAGEMENT)
// ----------------------------------------------------
export async function getAdminRooms() {
  await ensureDefaultRoomsSeeded();
  const rooms = await prisma.room.findMany({
    include: {
      currentPatient: {
        select: { id: true, patientId: true, name: true, phone: true },
      },
      currentDoctor: { select: { id: true, name: true } },
      currentHandler: { select: { id: true, name: true } },
    },
  });
  return rooms.sort((a, b) => compareRoomNumbers(a.roomNumber, b.roomNumber));
}

// ----------------------------------------------------
// GET ALL ROOMS WITH REALTIME OCCUPANCY (NO HARDCODING)
// ----------------------------------------------------
export async function getAllRoomsWithOccupancy(dateStr?: string) {
  await ensureDefaultRoomsSeeded();

  const { startOfDay, endOfDay } = getStartAndEndOfBSTDay(dateStr);

  const [dbRoomsRaw, todaySerials, todaySlots] = await Promise.all([
    prisma.room.findMany({
      where: { isActive: true },
      include: {
        currentPatient: {
          select: {
            id: true,
            patientId: true,
            name: true,
            phone: true,
            gender: true,
            primaryCondition: true,
          },
        },
        currentDoctor: { select: { id: true, name: true } },
        currentHandler: { select: { id: true, name: true } },
      },
    }),
    prisma.serial.findMany({
      where: {
        date: { gte: startOfDay, lte: endOfDay },
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
            primaryCondition: true,
          },
        },
        doctor: { select: { id: true, name: true } },
        handler: { select: { id: true, name: true } },
      },
    }),
    prisma.fileTreatmentSlot.findMany({
      where: {
        date: { gte: startOfDay, lte: endOfDay },
      },
      orderBy: { slotTime: "asc" },
      include: {
        patient: {
          select: {
            id: true,
            patientId: true,
            name: true,
            phone: true,
            gender: true,
            primaryCondition: true,
          },
        },
        assignedHandler: { select: { id: true, name: true } },
        assignedDoctor: { select: { id: true, name: true } },
      },
    }),
  ]);

  const dbRooms = dbRoomsRaw.sort((a, b) =>
    compareRoomNumbers(a.roomNumber, b.roomNumber),
  );

  const enrichedRooms = dbRooms.map((room) => {
    const cleanNum = room.roomNumber.replace(/[^0-9A-Za-z]/g, "").toLowerCase();

    // Match today's serials assigned to this room
    const matchingSerials = todaySerials.filter((s) => {
      const cleanSerialRoom = (s.roomNo || "")
        .replace(/[^0-9A-Za-z]/g, "")
        .toLowerCase();
      return (
        cleanSerialRoom === cleanNum ||
        (s.roomNo && s.roomNo.includes(room.roomNumber))
      );
    });

    // Match today's slots assigned to this room
    const matchingSlots = todaySlots.filter((slot) => {
      const cleanSlotRoom = (slot.roomNumber || "")
        .replace(/[^0-9A-Za-z]/g, "")
        .toLowerCase();
      return (
        cleanSlotRoom === cleanNum ||
        (slot.roomNumber && slot.roomNumber.includes(room.roomNumber))
      );
    });

    // Active patients currently in session
    const activeSerials = matchingSerials.filter(
      (s) =>
        s.status === SerialStatus.IN_THERAPY ||
        s.status === SerialStatus.IN_CONSULTATION,
    );

    const activeSlots = matchingSlots.filter(
      (slot) => slot.status === "IN_PROGRESS",
    );

    interface ActivePatientInfo {
      id: string;
      patientId: string;
      name: string;
      phone: string;
      gender: string;
      serialNumber?: number;
      status: SerialStatus | string;
      statusLabel: string;
      handlerName?: string | null;
      doctorName?: string | null;
      startTime?: Date | null;
      assignedTreatmentPlan?: string | null;
      fileNumber?: string;
      modalitiesPerformed?: string | null;
      slotId?: string;
      slotTime?: string | null;
    }

    const activePatientsMap = new Map<string, ActivePatientInfo>();

    for (const s of activeSerials) {
      activePatientsMap.set(s.patient.id, {
        id: s.patient.id,
        patientId: s.patient.patientId,
        name: s.patient.name,
        phone: s.patient.phone,
        gender: s.patient.gender,
        serialNumber: s.serialNumber,
        status: s.status,
        statusLabel:
          s.status === SerialStatus.IN_THERAPY
            ? "In Therapy"
            : "In Consultation",
        handlerName: s.handler?.name,
        doctorName: s.doctor?.name,
        startTime: s.therapyStartTime || s.inTime,
        assignedTreatmentPlan: s.assignedTreatmentPlan,
      });
    }

    for (const slot of activeSlots) {
      if (!activePatientsMap.has(slot.patient.id)) {
        activePatientsMap.set(slot.patient.id, {
          id: slot.patient.id,
          patientId: slot.patient.patientId,
          name: slot.patient.name,
          phone: slot.patient.phone,
          gender: slot.patient.gender,
          slotId: slot.id,
          slotTime: slot.slotTime,
          status: slot.status,
          statusLabel: "In Therapy Session",
          handlerName: slot.assignedHandler?.name,
          doctorName: slot.assignedDoctor?.name,
          startTime: slot.startTime,
          assignedTreatmentPlan: slot.modalitiesPrescribed,
        });
      }
    }

    const activePatients = Array.from(activePatientsMap.values());
    const activeCount = activePatients.length;
    const capacity = typeof room.capacity === "number" ? room.capacity : 0;
    const isOccupied = activeCount > 0 || Boolean(room.isOccupied);
    const availableBeds = Math.max(0, capacity - activeCount);
    const isFull = capacity > 0 ? activeCount >= capacity : false;

    return {
      id: room.id,
      roomNumber: room.roomNumber,
      name: room.name,
      purpose: room.purpose,
      type: room.type,
      capacity,
      genderPreference: room.genderPreference,
      floor: room.floor,
      isActive: room.isActive,
      isStaffOnly: Boolean(room.isStaffOnly),
      isOccupied,
      isFull,
      activeCount,
      availableBeds,
      activePatients,
      todaySerials: matchingSerials,
      todaySlots: matchingSlots,
      totalScheduledToday: matchingSerials.length + matchingSlots.length,
      currentDoctor: room.currentDoctor || null,
      currentHandler: room.currentHandler || null,
      notes: room.notes || null,
    };
  });

  const totalCapacity = enrichedRooms.reduce((acc, r) => acc + r.capacity, 0);
  const totalActivePatients = enrichedRooms.reduce(
    (acc, r) => acc + r.activeCount,
    0,
  );
  const occupiedRoomsCount = enrichedRooms.filter((r) => r.isOccupied).length;
  const vacantRoomsCount = enrichedRooms.length - occupiedRoomsCount;

  return {
    rooms: enrichedRooms,
    stats: {
      totalRooms: enrichedRooms.length,
      totalCapacity,
      totalActivePatients,
      occupiedRoomsCount,
      vacantRoomsCount,
    },
  };
}

// ----------------------------------------------------
// OCCUPY / ASSIGN ROOM
// ----------------------------------------------------
export async function occupyRoom(data: OccupyRoomInput) {
  const session = await getCurrentSession();
  const cleanRoom = data.roomNumber.replace(/[^0-9A-Za-z]/g, "");

  const patient = await prisma.patient.findFirst({
    where: {
      OR: [{ id: data.patientId }, { patientId: data.patientId }],
    },
  });

  if (!patient) {
    return { error: "Patient not found." };
  }

  const dbRoom = await prisma.room.findUnique({
    where: { roomNumber: cleanRoom },
  });

  const room = await prisma.room.upsert({
    where: { roomNumber: cleanRoom },
    update: {
      isOccupied: true,
      currentPatientId: patient.id,
      currentDoctorId: data.doctorId || session?.user?.id || null,
      currentHandlerId: data.handlerId || null,
      currentSlotId: data.slotId || null,
      occupiedSince: new Date(),
      expectedDurationMinutes: data.expectedDurationMinutes || 45,
      notes: data.notes || null,
    },
    create: {
      roomNumber: cleanRoom,
      name: dbRoom?.name || `Room ${cleanRoom}`,
      purpose: dbRoom?.purpose || "Physiotherapy & Modalities",
      type: dbRoom?.type || "THERAPY_BAY",
      capacity: dbRoom?.capacity || 2,
      floor: dbRoom?.floor || "2nd Floor",
      isOccupied: true,
      currentPatientId: patient.id,
      currentDoctorId: data.doctorId || session?.user?.id || null,
      currentHandlerId: data.handlerId || null,
      currentSlotId: data.slotId || null,
      occupiedSince: new Date(),
      expectedDurationMinutes: data.expectedDurationMinutes || 45,
      notes: data.notes || null,
    },
    include: {
      currentPatient: true,
      currentDoctor: true,
      currentHandler: true,
    },
  });

  realtimeBus.notify("ROOM_OCCUPIED", {
    roomNumber: cleanRoom,
    patientId: patient.id,
    patientName: patient.name,
  });

  revalidatePath("/handler");
  revalidatePath("/doctor");
  revalidatePath("/receptionist");
  revalidatePath("/");

  return { success: true, room };
}

// ----------------------------------------------------
// VACATE / RELEASE ROOM
// ----------------------------------------------------
export async function vacateRoom(roomNumber: string) {
  const cleanRoom = roomNumber.replace(/[^0-9A-Za-z]/g, "");

  const room = await prisma.room.update({
    where: { roomNumber: cleanRoom },
    data: {
      isOccupied: false,
      currentPatientId: null,
      currentDoctorId: null,
      currentHandlerId: null,
      currentSlotId: null,
      occupiedSince: null,
      notes: null,
    },
  });

  realtimeBus.notify("ROOM_VACATED", { roomNumber: cleanRoom });
  revalidatePath("/handler");
  revalidatePath("/doctor");
  revalidatePath("/receptionist");
  revalidatePath("/");

  return { success: true, room };
}
