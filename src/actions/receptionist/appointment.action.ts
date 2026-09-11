"use server";

import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/guard";
import {
  Role,
  AuditAction,
  AuditStatus,
  Gender,
  BookingType,
  ExtraApprovalStatus,
  AppointmentStatus,
  AppointmentType,
  SlotStatus,
  QueueType,
  RoomStatus,
} from "@/generated/prisma/enums";
import {
  bookTherapyTicketSchema,
  type BookTherapyTicketInput,
  type TicketActionState,
} from "@/schemas/receptionist/ticket.schema";
import { logAudit } from "@/lib/audit";
import { emitRealtimeEvent } from "@/lib/realtime/event-bus";
import { isSlotActiveOnDay, type DayKey } from "@/lib/weekdays";
import { revalidatePath } from "next/cache";
import type {
  TherapySlotModel,
  AppointmentModel,
  PatientModel,
  RoomModel,
  PerformerModel,
} from "@/generated/prisma/models";

const DAY_MAP: Record<number, DayKey> = {
  0: "SUNDAY",
  1: "MONDAY",
  2: "TUESDAY",
  3: "WEDNESDAY",
  4: "THURSDAY",
  5: "FRIDAY",
  6: "SATURDAY",
};

/**
 * Books a therapy appointment ticket for a patient in an active therapy slot.
 * Enforces gender capacity limits, automatic standby extra assignment, and token generation.
 * Emits real-time APPOINTMENT_CREATED event to all connected receptionists.
 */
export async function bookTherapyTicketAction(
  data: BookTherapyTicketInput,
): Promise<TicketActionState> {
  try {
    const sessionData = await requireAuth([
      Role.RECEPTIONIST,
      Role.ADMIN,
      Role.DOCTOR,
      Role.HANDLER,
    ]);
    const validation = bookTherapyTicketSchema.safeParse(data);

    if (!validation.success) {
      return {
        success: false,
        message: "Invalid booking request parameters.",
        fieldErrors: validation.error.flatten().fieldErrors,
      };
    }

    const {
      patientId,
      therapySlotId,
      appointmentDate,
      extraReason,
      toldTime,
      notes,
      bookedById,
    } = validation.data;

    // 1. Date window resolution
    const [year, month, day] = appointmentDate.split("-").map(Number);
    if (!year || !month || !day) {
      return {
        success: false,
        message: "Invalid appointment date format (expected YYYY-MM-DD).",
      };
    }
    const dateObj = new Date(year, month - 1, day, 12, 0, 0); // midday reference
    const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
    const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);

    const dayKey = DAY_MAP[dateObj.getDay()];

    // 2. Fetch slot & patient concurrently
    const [slot, patient] = await Promise.all([
      prisma.therapySlot.findUnique({
        where: { id: therapySlotId },
        include: { room: true },
      }),
      prisma.patient.findUnique({
        where: { id: patientId },
      }),
    ]);

    if (!slot) {
      return { success: false, message: "Selected therapy slot not found." };
    }

    if (
      !slot.isActive ||
      slot.status === SlotStatus.BLOCKED ||
      slot.status === SlotStatus.CANCELLED
    ) {
      return {
        success: false,
        message: `Therapy slot "${slot.label}" is currently inactive or blocked.`,
      };
    }

    if (!isSlotActiveOnDay(slot.weekDays, dayKey)) {
      return {
        success: false,
        message: `Therapy slot "${slot.label}" is not scheduled to operate on ${dayKey}s.`,
      };
    }

    if (!patient) {
      return { success: false, message: "Selected patient profile not found." };
    }

    // 3. Calculate current bookings for patient's gender in this slot on this day
    const bookedCountForGender = await prisma.appointment.count({
      where: {
        therapySlotId: slot.id,
        gender: patient.gender,
        status: { not: AppointmentStatus.CANCELLED },
        appointmentDate: { gte: startOfDay, lte: endOfDay },
      },
    });

    const isMale = patient.gender === Gender.MALE;
    const regularLimit = isMale
      ? slot.regularMaleCapacity
      : slot.regularFemaleCapacity;
    const extraLimit = isMale
      ? slot.extraMaleCapacity
      : slot.extraFemaleCapacity;

    let finalBookingType: BookingType = BookingType.REGULAR;
    let extraApproval: ExtraApprovalStatus = ExtraApprovalStatus.NOT_APPLICABLE;

    if (bookedCountForGender < regularLimit) {
      // Within regular quota
      finalBookingType = BookingType.REGULAR;
      extraApproval = ExtraApprovalStatus.NOT_APPLICABLE;
    } else if (bookedCountForGender < regularLimit + extraLimit) {
      // Within standby extra quota - requires doctor approval
      finalBookingType = BookingType.EXTRA;
      extraApproval = ExtraApprovalStatus.PENDING;
    } else {
      // Quota is completely full
      return {
        success: false,
        message: `All regular (${regularLimit}) and standby (${extraLimit}) quotas for ${patient.gender.toLowerCase()} patients are filled for ${slot.label}.`,
      };
    }

    // 5. Create Appointment in atomic transaction
    const appointment = await prisma.appointment.create({
      data: {
        type: AppointmentType.THERAPY,
        therapySlotId: slot.id,
        patientId: patient.id,
        appointmentDate: dateObj,
        gender: patient.gender,
        bookingType: finalBookingType,
        extraStatus: extraApproval,
        extraReason:
          finalBookingType === BookingType.EXTRA
            ? extraReason?.trim() || null
            : null,
        status:
          finalBookingType === BookingType.EXTRA
            ? AppointmentStatus.PENDING
            : AppointmentStatus.CONFIRMED,
        bookedById: bookedById || undefined,
        toldTime: toldTime || undefined,
        notes: notes || undefined,
      },
      include: {
        patient: true,
        therapySlot: {
          include: { room: true },
        },
        bookedBy: true,
        extraApprovedBy: true,
      },
    });

    // 6. Audit Logging
    await logAudit({
      userId: sessionData.user.id,
      performerId: bookedById || undefined,
      action: AuditAction.APPOINTMENT_CREATE,
      entity: "Appointment",
      entityId: appointment.id,
      status: AuditStatus.SUCCESS,
      details: {
        slot: slot.label,
        patientName: patient.name,
        date: appointmentDate,
        toldTime: toldTime || undefined,
        bookingType: finalBookingType,
        gender: patient.gender,
      },
    });

    // 7. Realtime SSE broadcast
    emitRealtimeEvent("APPOINTMENT_CREATED", {
      id: appointment.id,
      patientId: patient.id,
      patientName: patient.name,
      patientPhone: patient.phone,
      patientGender: patient.gender,
      slotId: slot.id,
      slotLabel: slot.label,
      date: appointmentDate,
      bookingType: finalBookingType,
      extraStatus: appointment.extraStatus,
      status: appointment.status,
    });

    revalidatePath("/receptionist");
    revalidatePath("/doctor");
    revalidatePath("/handler");

    return {
      success: true,
      message:
        finalBookingType === BookingType.EXTRA
          ? `Standby extra ticket booked for ${patient.name} (${slot.label}) & submitted for Doctor approval.`
          : `Appointment booked for ${patient.name} (${slot.label}).`,
      appointment,
    };
  } catch (error: unknown) {
    console.error("[Book Therapy Ticket Error]:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to book ticket.",
    };
  }
}

/**
 * Updates an appointment's operational status (e.g. Check In, Complete, Cancel).
 * Emits real-time APPOINTMENT_UPDATED event.
 */
export async function updateAppointmentStatusAction(
  appointmentId: string,
  newStatus: AppointmentStatus,
  performerId?: string,
  queueType?: QueueType,
  roomId?: string,
) {
  try {
    const sessionData = await requireAuth([
      Role.RECEPTIONIST,
      Role.ADMIN,
      Role.DOCTOR,
      Role.HANDLER,
    ]);

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { patient: true, therapySlot: true, room: true },
    });

    if (!appointment) {
      return { success: false, message: "Appointment record not found." };
    }

    const isCheckIn = newStatus === AppointmentStatus.CHECKED_IN;

    // Extra slots require doctor approval before check-in can be processed
    if (
      isCheckIn &&
      appointment.bookingType === BookingType.EXTRA &&
      appointment.extraStatus !== ExtraApprovalStatus.APPROVED
    ) {
      return {
        success: false,
        message:
          "This standby extra slot requires doctor approval before patient check-in.",
      };
    }

    // When checking in, record the check-in time synchronized to the ticket's booked date
    let checkInTime: Date | null | undefined = undefined;
    let assignedQueueType: QueueType | undefined = undefined;
    let queueId: string | null | undefined = undefined;

    if (isCheckIn) {
      const now = new Date();
      const bookedDate = new Date(appointment.appointmentDate);
      checkInTime = new Date(
        bookedDate.getFullYear(),
        bookedDate.getMonth(),
        bookedDate.getDate(),
        now.getHours(),
        now.getMinutes(),
        now.getSeconds(),
        now.getMilliseconds(),
      );

      assignedQueueType =
        queueType ||
        (appointment.type === AppointmentType.CONSULTATION
          ? QueueType.CONSULTATION
          : QueueType.THERAPY);

      // Ensure Queue master record exists
      try {
        let queueRecord = await prisma.queue.findUnique({
          where: { type: assignedQueueType },
        });
        if (!queueRecord) {
          queueRecord = await prisma.queue.create({
            data: {
              type: assignedQueueType,
              name:
                assignedQueueType === QueueType.CONSULTATION
                  ? "Consultation Queue"
                  : "Therapy Queue",
              description:
                assignedQueueType === QueueType.CONSULTATION
                  ? "Queue for consultation patients"
                  : "Queue for physical therapy patients",
            },
          });
        }
        queueId = queueRecord.id;
      } catch (err) {
        console.error("[Ensure Queue Record Error]:", err);
      }
    } else if (
      newStatus === AppointmentStatus.CANCELLED ||
      newStatus === AppointmentStatus.PENDING
    ) {
      checkInTime = null;
    }

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: newStatus,
        ...(checkInTime !== undefined ? { checkInTime } : {}),
        ...(assignedQueueType !== undefined
          ? { queueType: assignedQueueType, queueId }
          : {}),
        ...(roomId !== undefined ? { roomId: roomId || null } : {}),
      },
      include: {
        patient: true,
        therapySlot: { include: { room: true } },
        room: true,
        queue: true,
      },
    });

    const isCancelled = newStatus === AppointmentStatus.CANCELLED;
    const assignedRoomNumber =
      updated.room?.number || updated.therapySlot?.room?.number || null;

    await logAudit({
      userId: sessionData.user.id,
      performerId: performerId || null,
      action: isCancelled
        ? AuditAction.APPOINTMENT_CANCEL
        : AuditAction.APPOINTMENT_UPDATE,
      entity: "Appointment",
      entityId: updated.id,
      status: AuditStatus.SUCCESS,
      details: {
        previousStatus: appointment.status,
        newStatus,
        patientName: updated.patient.name,
        queueType: updated.queueType,
        roomNumber: assignedRoomNumber,
        checkInTime: updated.checkInTime
          ? updated.checkInTime.toISOString()
          : null,
      },
    });

    emitRealtimeEvent(
      isCancelled ? "APPOINTMENT_CANCELLED" : "APPOINTMENT_UPDATED",
      {
        id: updated.id,
        status: newStatus,
        queueType: updated.queueType,
        checkInTime: updated.checkInTime,
        willCallTime: updated.willCallTime,
        slotId: updated.therapySlotId,
        roomId: updated.roomId,
        roomNumber: assignedRoomNumber,
        date: updated.appointmentDate.toISOString().split("T")[0],
      },
    );

    // If calling doctor into consultation room, broadcast dedicated DOCTOR_CALLED chime & banner event
    if (
      newStatus === AppointmentStatus.CALLING ||
      newStatus === AppointmentStatus.IN_CONSULTATION
    ) {
      emitRealtimeEvent("DOCTOR_CALLED", {
        appointmentId: updated.id,
        patientName: updated.patient.name,
        gender: updated.gender,
        roomNumber: assignedRoomNumber || "Chamber",
        roomPurpose: updated.room?.purpose || "Doctor Consultation",
        timestamp: new Date().toISOString(),
      });
    }

    // If patient is in consultation, mark chamber room as OCCUPIED
    if (newStatus === AppointmentStatus.IN_CONSULTATION && updated.roomId) {
      await prisma.room
        .update({
          where: { id: updated.roomId },
          data: { status: RoomStatus.OCCUPIED },
        })
        .catch((err) => console.error("[Mark Room Occupied Error]:", err));

      emitRealtimeEvent("ROOM_UPDATED", {
        id: updated.roomId,
        status: RoomStatus.OCCUPIED,
        number: assignedRoomNumber,
      });
    }

    // If consultation completed or cancelled, release room back to AVAILABLE
    if (
      (newStatus === AppointmentStatus.COMPLETED ||
        newStatus === AppointmentStatus.CANCELLED) &&
      updated.roomId
    ) {
      const activeOccupying = await prisma.appointment.count({
        where: {
          roomId: updated.roomId,
          status: AppointmentStatus.IN_CONSULTATION,
          id: { not: updated.id },
        },
      });

      if (activeOccupying === 0) {
        await prisma.room
          .update({
            where: { id: updated.roomId },
            data: { status: RoomStatus.AVAILABLE },
          })
          .catch((err) =>
            console.error("[Release Room Available Error]:", err),
          );

        emitRealtimeEvent("ROOM_UPDATED", {
          id: updated.roomId,
          status: RoomStatus.AVAILABLE,
          number: assignedRoomNumber,
        });
      }
    }

    revalidatePath("/receptionist");
    revalidatePath("/doctor");
    revalidatePath("/handler");
    revalidatePath("/admin/rooms");
    revalidatePath("/");

    return {
      success: true,
      message: `Appointment for ${updated.patient.name} marked as ${newStatus.replace("_", " ")}${
        assignedRoomNumber ? ` (Room ${assignedRoomNumber})` : ""
      }${
        isCheckIn
          ? ` (${updated.queueType === QueueType.CONSULTATION ? "Consultation Queue" : "Therapy Queue"})`
          : ""
      }.`,
      appointment: updated,
    };
  } catch (error: unknown) {
    console.error("[Update Appointment Status Error]:", error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to update appointment status.",
    };
  }
}

export interface SlotTelemetry {
  totalBooked: number;
  maleRegularBooked: number;
  maleExtraBooked: number;
  maleTotalBooked: number;
  femaleRegularBooked: number;
  femaleExtraBooked: number;
  femaleTotalBooked: number;
  isMaleRegularFull: boolean;
  isMaleExtraFull: boolean;
  isMaleTotalFull: boolean;
  isFemaleRegularFull: boolean;
  isFemaleExtraFull: boolean;
  isFemaleTotalFull: boolean;
  isCompletelyFull: boolean;
}

export type AppointmentWithRelations = AppointmentModel & {
  roomId?: string | null;
  willCallTime?: string | null;
  patient?: PatientModel | null;
  therapySlot?: (TherapySlotModel & { room?: RoomModel | null }) | null;
  room?: RoomModel | null;
  bookedBy?: PerformerModel | null;
  extraApprovedBy?: PerformerModel | null;
  queue?: {
    id: string;
    name: string;
    type: QueueType;
    description?: string | null;
  } | null;
};

export type SlotWithTelemetry = TherapySlotModel & {
  room: RoomModel | null;
  telemetry: SlotTelemetry;
  appointments: AppointmentWithRelations[];
};

export type PatientWithCount = PatientModel & {
  _count?: { appointments: number };
};

export interface ReceptionistDashboardData {
  selectedDate: string;
  dayOfWeek: DayKey;
  slots: SlotWithTelemetry[];
  appointments: AppointmentWithRelations[];
  rooms: RoomModel[];
  stats: {
    totalBooked: number;
    checkedInCount: number;
    maleBooked: number;
    femaleBooked: number;
    extraBooked: number;
    totalActiveSlots: number;
    totalRegularCapacity: number;
    totalExtraCapacity: number;
  };
  receptionistPerformers: {
    id: string;
    name: string;
    phone: string;
    role: Role;
  }[];
  patients: PatientWithCount[];
  totalPatientsCount: number;
}

/**
 * Loads all clinical slots, booked tickets, quotas, and on-duty performers for the selected date.
 */
export async function getReceptionistDashboardDataAction(
  dateStr?: string,
): Promise<ReceptionistDashboardData> {
  await requireAuth([Role.RECEPTIONIST, Role.ADMIN, Role.DOCTOR, Role.HANDLER]);

  // Date parsing (local calendar date)
  const now = new Date();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const targetDateStr = dateStr || todayIso;

  const [year, month, day] = targetDateStr.split("-").map(Number);
  const dateObj = new Date(year, month - 1, day, 12, 0, 0);
  const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
  const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);

  const dayOfWeek = DAY_MAP[dateObj.getDay()];

  // Concurrent queries for max speed
  const [
    allSlots,
    appointments,
    performers,
    patients,
    totalPatientsCount,
    rooms,
  ] = await Promise.all([
    prisma.therapySlot.findMany({
      where: { isActive: true },
      include: { room: true },
      orderBy: { order: "asc" },
    }),
    prisma.appointment.findMany({
      where: {
        appointmentDate: { gte: startOfDay, lte: endOfDay },
      },
      include: {
        patient: true,
        therapySlot: { include: { room: true } },
        room: true,
        bookedBy: true,
        extraApprovedBy: true,
      },
      orderBy: [{ therapySlot: { order: "asc" } }, { createdAt: "asc" }],
    }),
    prisma.performer.findMany({
      where: {
        user: { role: Role.RECEPTIONIST },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        user: { select: { role: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.patient.findMany({
      take: 50,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { appointments: true } },
      },
    }),
    prisma.patient.count(),
    prisma.room.findMany({
      orderBy: { number: "asc" },
    }),
  ]);

  // Filter slots operating on this specific day
  const activeSlots = allSlots.filter((slot) =>
    isSlotActiveOnDay(slot.weekDays, dayOfWeek),
  );

  // Group appointments by slot and compute slot statistics
  const slotsWithTelemetry = activeSlots.map((slot) => {
    const slotAppointments = appointments.filter(
      (a) =>
        a.therapySlotId === slot.id && a.status !== AppointmentStatus.CANCELLED,
    );

    const maleAppointments = slotAppointments.filter(
      (a) => a.gender === Gender.MALE,
    );
    const femaleAppointments = slotAppointments.filter(
      (a) => a.gender === Gender.FEMALE,
    );

    const maleRegularBooked = maleAppointments.filter(
      (a) => a.bookingType === BookingType.REGULAR,
    ).length;
    const maleExtraBooked = maleAppointments.filter(
      (a) => a.bookingType === BookingType.EXTRA,
    ).length;

    const femaleRegularBooked = femaleAppointments.filter(
      (a) => a.bookingType === BookingType.REGULAR,
    ).length;
    const femaleExtraBooked = femaleAppointments.filter(
      (a) => a.bookingType === BookingType.EXTRA,
    ).length;

    const isMaleRegularFull = maleRegularBooked >= slot.regularMaleCapacity;
    const isMaleExtraFull = maleExtraBooked >= slot.extraMaleCapacity;
    const isMaleTotalFull = isMaleRegularFull && isMaleExtraFull;

    const isFemaleRegularFull =
      femaleRegularBooked >= slot.regularFemaleCapacity;
    const isFemaleExtraFull = femaleExtraBooked >= slot.extraFemaleCapacity;
    const isFemaleTotalFull = isFemaleRegularFull && isFemaleExtraFull;

    const isCompletelyFull = isMaleTotalFull && isFemaleTotalFull;

    return {
      ...slot,
      telemetry: {
        totalBooked: slotAppointments.length,
        maleRegularBooked,
        maleExtraBooked,
        maleTotalBooked: maleAppointments.length,
        femaleRegularBooked,
        femaleExtraBooked,
        femaleTotalBooked: femaleAppointments.length,
        isMaleRegularFull,
        isMaleExtraFull,
        isMaleTotalFull,
        isFemaleRegularFull,
        isFemaleExtraFull,
        isFemaleTotalFull,
        isCompletelyFull,
      },
      appointments: slotAppointments,
    };
  });

  // Overall day stats
  const nonCancelled = appointments.filter(
    (a) => a.status !== AppointmentStatus.CANCELLED,
  );
  const checkedInCount = nonCancelled.filter(
    (a) =>
      a.status === AppointmentStatus.CHECKED_IN ||
      a.status === AppointmentStatus.CALLING ||
      a.status === AppointmentStatus.IN_THERAPY ||
      a.status === AppointmentStatus.IN_CONSULTATION,
  ).length;
  const maleBooked = nonCancelled.filter(
    (a) => a.gender === Gender.MALE,
  ).length;
  const femaleBooked = nonCancelled.filter(
    (a) => a.gender === Gender.FEMALE,
  ).length;
  const extraBooked = nonCancelled.filter(
    (a) => a.bookingType === BookingType.EXTRA,
  ).length;

  const totalRegularCapacity = activeSlots.reduce(
    (acc, s) => acc + s.regularMaleCapacity + s.regularFemaleCapacity,
    0,
  );
  const totalExtraCapacity = activeSlots.reduce(
    (acc, s) => acc + s.extraMaleCapacity + s.extraFemaleCapacity,
    0,
  );

  return {
    selectedDate: targetDateStr,
    dayOfWeek,
    slots: slotsWithTelemetry,
    appointments,
    rooms,
    stats: {
      totalBooked: nonCancelled.length,
      checkedInCount,
      maleBooked,
      femaleBooked,
      extraBooked,
      totalActiveSlots: activeSlots.length,
      totalRegularCapacity,
      totalExtraCapacity,
    },
    receptionistPerformers: performers.map((p) => ({
      id: p.id,
      name: p.name,
      phone: p.phone,
      role: p.user.role,
    })),
    patients,
    totalPatientsCount,
  };
}

/**
 * Loads all currently checked-in appointments for today's live waiting room queue display.
 * Publicly accessible so wall displays / waiting hall monitors can display live queue without authentication.
 */
export async function getLiveQueueAction() {
  try {
    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0,
    );
    const endOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999,
    );

    const checkedInAppointments = await prisma.appointment.findMany({
      where: {
        appointmentDate: { gte: startOfDay, lte: endOfDay },
        status: {
          in: [
            AppointmentStatus.CHECKED_IN,
            AppointmentStatus.CALLING,
            AppointmentStatus.IN_THERAPY,
            AppointmentStatus.IN_CONSULTATION,
          ],
        },
      },
      include: {
        patient: true,
        therapySlot: {
          include: { room: true },
        },
        room: true,
        bookedBy: true,
        queue: true,
      },
      orderBy: [{ checkInTime: "asc" }, { createdAt: "asc" }],
    });

    const todayDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    return {
      success: true,
      queue: checkedInAppointments,
      date: todayDateStr,
    };
  } catch (error: unknown) {
    console.error("[Get Live Queue Action Error]:", error);
    return {
      success: false,
      queue: [],
      date: new Date().toISOString().split("T")[0],
    };
  }
}

export interface AddPatientToQueueInput {
  patientId: string;
  queueType: QueueType;
  toldTime?: string;
  notes?: string;
  performerId?: string;
}

/**
 * Adds a patient directly to the live waiting queue (Therapy or Consultation).
 * Updates an existing appointment today to CHECKED_IN or creates a direct queue record.
 */
export async function addPatientToQueueAction(input: AddPatientToQueueInput) {
  try {
    const sessionData = await requireAuth([
      Role.RECEPTIONIST,
      Role.ADMIN,
      Role.DOCTOR,
      Role.HANDLER,
    ]);

    if (!input.patientId) {
      return { success: false, message: "Please select a patient." };
    }

    const patient = await prisma.patient.findUnique({
      where: { id: input.patientId },
    });

    if (!patient) {
      return { success: false, message: "Patient record not found." };
    }

    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0,
    );
    const endOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999,
    );

    // Ensure corresponding Queue master record exists
    let queueRecord = await prisma.queue.findUnique({
      where: { type: input.queueType },
    });
    if (!queueRecord) {
      queueRecord = await prisma.queue.create({
        data: {
          type: input.queueType,
          name:
            input.queueType === QueueType.CONSULTATION
              ? "Consultation Queue"
              : "Therapy Queue",
          description:
            input.queueType === QueueType.CONSULTATION
              ? "Queue for consultation patients"
              : "Queue for physical therapy patients",
        },
      });
    }

    // Check if patient already has an active appointment for today
    const existingAppointment = await prisma.appointment.findFirst({
      where: {
        patientId: patient.id,
        appointmentDate: { gte: startOfDay, lte: endOfDay },
        status: {
          notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.COMPLETED],
        },
      },
    });

    let updatedAppointment;

    if (existingAppointment) {
      // Update existing appointment: assign queue & mark checked in
      updatedAppointment = await prisma.appointment.update({
        where: { id: existingAppointment.id },
        data: {
          status: AppointmentStatus.CHECKED_IN,
          checkInTime: now,
          queueId: queueRecord.id,
          queueType: input.queueType,
          ...(input.toldTime ? { toldTime: input.toldTime } : {}),
          ...(input.notes ? { notes: input.notes } : {}),
        },
        include: { patient: true, therapySlot: true, queue: true },
      });
    } else {
      // Create new walk-in / direct queue appointment record
      const middayToday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        12,
        0,
        0,
      );

      updatedAppointment = await prisma.appointment.create({
        data: {
          type:
            input.queueType === QueueType.CONSULTATION
              ? AppointmentType.CONSULTATION
              : AppointmentType.THERAPY,
          patientId: patient.id,
          appointmentDate: middayToday,
          gender: patient.gender,
          bookingType: BookingType.REGULAR,
          status: AppointmentStatus.CHECKED_IN,
          checkInTime: now,
          queueId: queueRecord.id,
          queueType: input.queueType,
          toldTime: input.toldTime || undefined,
          notes: input.notes || undefined,
          bookedById: input.performerId || undefined,
        },
        include: { patient: true, therapySlot: true, queue: true },
      });
    }

    // Audit log
    await logAudit({
      userId: sessionData.user.id,
      performerId: input.performerId || null,
      action: AuditAction.APPOINTMENT_UPDATE,
      entity: "Appointment",
      entityId: updatedAppointment.id,
      status: AuditStatus.SUCCESS,
      details: {
        patientName: patient.name,
        queueType: input.queueType,
        checkInTime: now.toISOString(),
        action: "ADD_TO_QUEUE",
      },
    });

    // Realtime SSE broadcast
    emitRealtimeEvent("APPOINTMENT_UPDATED", {
      id: updatedAppointment.id,
      status: AppointmentStatus.CHECKED_IN,
      queueType: input.queueType,
      checkInTime: now,
      date: updatedAppointment.appointmentDate.toISOString().split("T")[0],
    });

    revalidatePath("/receptionist");
    revalidatePath("/");

    return {
      success: true,
      message: `${patient.name} added to ${input.queueType === QueueType.CONSULTATION ? "Consultation Queue" : "Therapy Queue"}.`,
      appointment: updatedAppointment,
    };
  } catch (error: unknown) {
    console.error("[Add Patient To Queue Error]:", error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to add patient to queue.",
    };
  }
}

/**
 * Transfers an appointment between Therapy Queue and Consultation Queue.
 */
export async function switchQueueAction(
  appointmentId: string,
  targetQueueType: QueueType,
  performerId?: string,
) {
  try {
    const sessionData = await requireAuth([
      Role.RECEPTIONIST,
      Role.ADMIN,
      Role.DOCTOR,
      Role.HANDLER,
    ]);

    let queueRecord = await prisma.queue.findUnique({
      where: { type: targetQueueType },
    });
    if (!queueRecord) {
      queueRecord = await prisma.queue.create({
        data: {
          type: targetQueueType,
          name:
            targetQueueType === QueueType.CONSULTATION
              ? "Consultation Queue"
              : "Therapy Queue",
        },
      });
    }

    const previous = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { roomId: true, status: true },
    });

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        queueId: queueRecord.id,
        queueType: targetQueueType,
      },
      include: { patient: true, queue: true, room: true },
    });

    // If appointment had occupied a chamber room and is switched away, release it back to AVAILABLE
    if (
      previous?.roomId &&
      previous.status === AppointmentStatus.IN_CONSULTATION &&
      targetQueueType !== QueueType.CONSULTATION
    ) {
      const activeCount = await prisma.appointment.count({
        where: {
          roomId: previous.roomId,
          status: AppointmentStatus.IN_CONSULTATION,
          id: { not: appointmentId },
        },
      });
      if (activeCount === 0) {
        await prisma.room
          .update({
            where: { id: previous.roomId },
            data: { status: RoomStatus.AVAILABLE },
          })
          .catch(() => {});
        emitRealtimeEvent("ROOM_UPDATED", {
          id: previous.roomId,
          status: RoomStatus.AVAILABLE,
        });
      }
    }

    await logAudit({
      userId: sessionData.user.id,
      performerId: performerId || null,
      action: AuditAction.APPOINTMENT_UPDATE,
      entity: "Appointment",
      entityId: updated.id,
      status: AuditStatus.SUCCESS,
      details: {
        patientName: updated.patient.name,
        switchedToQueue: targetQueueType,
      },
    });

    emitRealtimeEvent("APPOINTMENT_UPDATED", {
      id: updated.id,
      status: updated.status,
      queueType: targetQueueType,
      checkInTime: updated.checkInTime,
      date: updated.appointmentDate.toISOString().split("T")[0],
    });

    revalidatePath("/receptionist");
    revalidatePath("/doctor");
    revalidatePath("/handler");
    revalidatePath("/");

    return {
      success: true,
      message: `${updated.patient.name} moved to ${targetQueueType === QueueType.CONSULTATION ? "Consultation Queue" : "Therapy Queue"}.`,
      appointment: updated,
    };
  } catch (error: unknown) {
    console.error("[Switch Queue Error]:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to switch queue.",
    };
  }
}

/**
 * Updates the estimated / will call time for an appointment in the waiting queue.
 * Emits real-time APPOINTMENT_UPDATED event to update waiting hall display instantly.
 */
export async function updateAppointmentWillCallTimeAction(
  appointmentId: string,
  willCallTime: string,
  performerId?: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const sessionData = await requireAuth([
      Role.RECEPTIONIST,
      Role.ADMIN,
      Role.DOCTOR,
      Role.HANDLER,
    ]);

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: true,
        room: true,
        therapySlot: { include: { room: true } },
      },
    });

    if (!appointment) {
      return { success: false, message: "Appointment not found." };
    }

    const trimmedTime = willCallTime.trim() || null;

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { willCallTime: trimmedTime },
      include: {
        patient: true,
        therapySlot: { include: { room: true } },
        room: true,
        queue: true,
      },
    });

    await logAudit({
      userId: sessionData.user.id,
      performerId: performerId || null,
      action: AuditAction.APPOINTMENT_UPDATE,
      entity: "Appointment",
      entityId: updated.id,
      status: AuditStatus.SUCCESS,
      details: {
        previousWillCallTime: appointment.willCallTime,
        willCallTime: updated.willCallTime,
        patientName: updated.patient.name,
      },
    });

    emitRealtimeEvent("APPOINTMENT_UPDATED", {
      id: updated.id,
      status: updated.status,
      queueType: updated.queueType,
      checkInTime: updated.checkInTime,
      willCallTime: updated.willCallTime,
      slotId: updated.therapySlotId,
      roomId: updated.roomId,
      roomNumber:
        updated.room?.number || updated.therapySlot?.room?.number || null,
      date: updated.appointmentDate.toISOString().split("T")[0],
    });

    revalidatePath("/receptionist");
    revalidatePath("/doctor");
    revalidatePath("/handler");
    revalidatePath("/");

    return {
      success: true,
      message: trimmedTime
        ? `Will call time set to ${trimmedTime}`
        : "Will call time cleared",
    };
  } catch (error: unknown) {
    console.error("[Update Will Call Time Error]:", error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to update will call time.",
    };
  }
}
