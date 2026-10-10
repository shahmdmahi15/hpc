"use server";

import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/guard";
import {
  Role,
  AppointmentStatus,
  QueueType,
  AppointmentType,
  BookingType,
  Gender,
  AuditAction,
  AuditStatus,
} from "@/generated/prisma/enums";
import { emitRealtimeEvent } from "@/lib/realtime/event-bus";
import { logAudit } from "@/lib/audit";
import { syncBillingForAppointment } from "@/lib/billing-sync";
import { revalidatePath } from "next/cache";
import { getOrCreateWaitingRoom200 } from "@/actions/receptionist/patient.action";
import { verifyPerformerPin } from "@/lib/performer-auth";

export type PatientStation =
  | "RECEPTIONIST_DESK"
  | "CONSULTATION_ROOM"
  | "CASHIER_REGISTER"
  | "THERAPY_ROOM"
  | "CHECKED_OUT";

export interface LiveTrackedPatient {
  id: string;
  patientId: string;
  name: string;
  phone: string;
  mrn: string | null;
  gender: Gender;
  appointmentDate: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  inConsultationTime: string | null;
  outConsultationTime: string | null;
  inTherapyTime: string | null;
  outTherapyTime: string | null;
  status: AppointmentStatus;
  queueType: QueueType | null;
  currentStation: PatientStation;
  roomId: string | null;
  roomNumber: string | null;
  doctorId: string | null;
  doctorName: string | null;
  doctorFee: number | null;
  slotLabel: string | null;
  feeAmount: number;
  paidAmount: number;
  dueAmount: number;
  paymentStatus: string;
  notes: string | null;
  toldTime: string | null;
  elapsedMinutesSinceCheckIn: number | null;
  serialId?: string | null;
  serialNumber?: number | null;
  serialStatus?: string | null;
  statusMarker?: string | null;
}

export interface PatientTrackingStats {
  totalPatients: number;
  atReception: number;
  inConsultation: number;
  atCashier: number;
  inTherapy: number;
  checkedOut: number;
}

export interface PatientTrackingData {
  selectedDate: string;
  patients: LiveTrackedPatient[];
  stats: PatientTrackingStats;
  rooms: {
    id: string;
    number: string;
    purpose: string;
    accessType?: string;
  }[];
  doctors: {
    id: string;
    name: string | null;
    email: string | null;
    consultationFee: number;
  }[];
  performers: {
    id: string;
    name: string;
    role: Role;
  }[];
}

/**
 * Normalizes station from appointment data
 */
function deriveStation(apt: {
  currentStation?: string | null;
  status: AppointmentStatus;
  inConsultationTime?: Date | null;
  inTherapyTime?: Date | null;
  checkOutTime?: Date | null;
}): PatientStation {
  if (apt.status === AppointmentStatus.COMPLETED || apt.checkOutTime) {
    return "CHECKED_OUT";
  }
  if (apt.currentStation) {
    return apt.currentStation as PatientStation;
  }
  if (apt.status === AppointmentStatus.IN_CONSULTATION) {
    return "CONSULTATION_ROOM";
  }
  if (apt.status === AppointmentStatus.IN_THERAPY) {
    return "THERAPY_ROOM";
  }
  return "RECEPTIONIST_DESK";
}

/**
 * Loads real-time patient journey tracking data for all patients checked-in today,
 * regardless of whether they have an assigned therapy slot or are a walk-in/consultation patient.
 */
export async function getLivePatientTrackingDataAction(
  dateStr?: string,
): Promise<PatientTrackingData> {
  await requireAuth([
    Role.RECEPTIONIST,
    Role.ADMIN,
    Role.DOCTOR,
    Role.HANDLER,
    Role.CASHIER,
  ]);

  const now = new Date();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const targetDateStr = dateStr || todayIso;

  const [year, month, day] = targetDateStr.split("-").map(Number);
  const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
  const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);

  const [appointments, rooms, doctors, performers] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        appointmentDate: { gte: startOfDay, lte: endOfDay },
        status: { not: AppointmentStatus.CANCELLED },
      },
      include: {
        patient: {
          include: {
            consultationSerials: {
              where: {
                appointmentDate: { gte: startOfDay, lte: endOfDay },
                status: { not: "CANCELLED" },
              },
              include: {
                doctor: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    consultationFee: true,
                  },
                },
              },
              orderBy: { serialNumber: "desc" },
              take: 1,
            },
          },
        },
        doctor: {
          select: {
            id: true,
            name: true,
            email: true,
            consultationFee: true,
          },
        },
        room: true,
        therapySlot: {
          include: { room: true },
        },
        bookedBy: true,
        performer: true,
      },
      orderBy: [{ checkInTime: "desc" }, { createdAt: "desc" }],
    }),
    prisma.room.findMany({
      orderBy: { number: "asc" },
      select: { id: true, number: true, purpose: true, accessType: true },
    }),
    prisma.user.findMany({
      where: { role: Role.DOCTOR },
      select: {
        id: true,
        name: true,
        email: true,
        consultationFee: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.performer.findMany({
      select: {
        id: true,
        name: true,
        user: { select: { role: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const formattedPatients: LiveTrackedPatient[] = appointments.map((apt) => {
    const activeSerial = apt.patient.consultationSerials?.[0] || null;
    const isConsultationWithSerial =
      Boolean(activeSerial) && !apt.therapySlotId;

    let station = deriveStation(apt);
    if (
      apt.status === AppointmentStatus.COMPLETED ||
      apt.checkOutTime ||
      activeSerial?.status === "COMPLETED"
    ) {
      station = "CHECKED_OUT";
    } else if (activeSerial?.status === "FORWARDED_TO_CASHIER") {
      station = "CASHIER_REGISTER";
    } else if (
      apt.currentStation === "CASHIER_REGISTER" &&
      activeSerial?.status === "QUEUED"
    ) {
      station = "CONSULTATION_ROOM";
    }

    const checkInDate = apt.checkInTime ? new Date(apt.checkInTime) : null;
    const elapsedMinutes = checkInDate
      ? Math.max(0, Math.floor((now.getTime() - checkInDate.getTime()) / 60000))
      : null;

    const assignedRoom = apt.room || apt.therapySlot?.room;
    const doctorObj = apt.doctor || activeSerial?.doctor || null;

    const resolvedFee =
      isConsultationWithSerial && activeSerial
        ? (activeSerial.feeAmount ?? 0)
        : (apt.feeAmount ?? 0);
    const resolvedPaid =
      isConsultationWithSerial && activeSerial
        ? (activeSerial.paidAmount ?? 0)
        : (apt.paidAmount ?? 0);
    const resolvedDue =
      isConsultationWithSerial && activeSerial
        ? (activeSerial.dueAmount ?? Math.max(0, resolvedFee - resolvedPaid))
        : (apt.dueAmount ?? 0);
    const resolvedPaymentStatus =
      isConsultationWithSerial && activeSerial
        ? activeSerial.paymentStatus || "PENDING"
        : apt.paymentStatus || "PENDING";

    const resolvedSlotLabel = apt.therapySlot?.label
      ? apt.therapySlot.label
      : activeSerial
        ? `Serial #${activeSerial.serialNumber} • Dr. ${doctorObj?.name || "Doctor"}`
        : null;

    let statusMarker: string | null = null;
    if (activeSerial?.status === "FORWARDED_TO_CASHIER") {
      statusMarker = "Forwarded to Cashier (Awaiting Payment)";
    } else if (
      activeSerial?.status === "QUEUED" &&
      apt.status === AppointmentStatus.CHECKED_IN
    ) {
      statusMarker = "Queued for Doctor Consultation";
    } else if (
      apt.status === AppointmentStatus.IN_CONSULTATION ||
      activeSerial?.status === "IN_CONSULTATION"
    ) {
      statusMarker = "In Doctor Consultation";
    } else if (apt.status === AppointmentStatus.IN_THERAPY) {
      statusMarker = "In Physical Therapy";
    } else if (
      apt.currentStation === "CASHIER_REGISTER" &&
      apt.therapySlotId
    ) {
      statusMarker = "Forwarded to Cashier (Prior Due Clearance)";
    } else if (
      apt.queueType === QueueType.THERAPY &&
      apt.status === AppointmentStatus.CHECKED_IN
    ) {
      statusMarker = "Queued for Therapy Floor";
    }

    return {
      id: apt.id,
      patientId: apt.patient.id,
      name: apt.patient.name,
      phone: apt.patient.phone,
      mrn: apt.patient.mrn,
      gender: apt.gender,
      appointmentDate: apt.appointmentDate.toISOString(),
      checkInTime: apt.checkInTime ? apt.checkInTime.toISOString() : null,
      checkOutTime: apt.checkOutTime ? apt.checkOutTime.toISOString() : null,
      inConsultationTime: apt.inConsultationTime
        ? apt.inConsultationTime.toISOString()
        : null,
      outConsultationTime: apt.outConsultationTime
        ? apt.outConsultationTime.toISOString()
        : null,
      inTherapyTime: apt.inTherapyTime ? apt.inTherapyTime.toISOString() : null,
      outTherapyTime: apt.outTherapyTime
        ? apt.outTherapyTime.toISOString()
        : null,
      status: apt.status,
      queueType: apt.queueType,
      currentStation: station,
      roomId: apt.roomId || assignedRoom?.id || null,
      roomNumber: assignedRoom?.number || null,
      doctorId: apt.doctorId || activeSerial?.doctorId || null,
      doctorName: doctorObj?.name || null,
      doctorFee: doctorObj?.consultationFee ?? null,
      slotLabel: resolvedSlotLabel,
      feeAmount: resolvedFee,
      paidAmount: resolvedPaid,
      dueAmount: resolvedDue,
      paymentStatus: resolvedPaymentStatus,
      notes: activeSerial?.notes || apt.notes || null,
      toldTime: apt.toldTime || activeSerial?.toldTime || null,
      elapsedMinutesSinceCheckIn: elapsedMinutes,
      serialId: activeSerial?.id || null,
      serialNumber: activeSerial?.serialNumber ?? null,
      serialStatus: activeSerial?.status || null,
      statusMarker,
    };
  });

  const stats: PatientTrackingStats = {
    totalPatients: formattedPatients.length,
    atReception: formattedPatients.filter(
      (p) => p.currentStation === "RECEPTIONIST_DESK",
    ).length,
    inConsultation: formattedPatients.filter(
      (p) => p.currentStation === "CONSULTATION_ROOM",
    ).length,
    atCashier: formattedPatients.filter(
      (p) => p.currentStation === "CASHIER_REGISTER",
    ).length,
    inTherapy: formattedPatients.filter(
      (p) => p.currentStation === "THERAPY_ROOM",
    ).length,
    checkedOut: formattedPatients.filter(
      (p) => p.currentStation === "CHECKED_OUT",
    ).length,
  };

  return {
    selectedDate: targetDateStr,
    patients: formattedPatients,
    stats,
    rooms,
    doctors: doctors.map((d) => ({
      id: d.id,
      name: d.name,
      email: d.email,
      consultationFee: d.consultationFee ?? 0,
    })),
    performers: performers.map((p) => ({
      id: p.id,
      name: p.name,
      role: p.user.role,
    })),
  };
}

export interface TransferStationInput {
  appointmentId: string;
  targetStation: PatientStation;
  roomId?: string;
  doctorId?: string;
  notes?: string;
  performerId?: string;
  pin?: string;
}

/**
 * Transfers a patient seamlessly to another clinic station:
 * Receptionist Desk <-> Doctor Consultation <-> Cashier Register <-> Therapy Room <-> Checked Out
 */
export async function transferPatientStationAction(
  input: TransferStationInput,
): Promise<{ success: boolean; message: string }> {
  const sessionData = await requireAuth([
    Role.RECEPTIONIST,
    Role.ADMIN,
    Role.DOCTOR,
    Role.HANDLER,
    Role.CASHIER,
  ]);

  try {
    if (input.performerId && input.pin) {
      const pinRes = await verifyPerformerPin(input.performerId, input.pin);
      if (!pinRes.valid) {
        return {
          success: false,
          message: pinRes.error || "Invalid security PIN for authorizing staff.",
        };
      }
    }

    const apt = await prisma.appointment.findUnique({
      where: { id: input.appointmentId },
      include: { patient: true, doctor: true, room: true },
    });

    if (!apt) {
      return { success: false, message: "Appointment record not found." };
    }

    const now = new Date();
    const updateData: any = {
      currentStation: input.targetStation,
      updatedAt: now,
    };

    if (input.notes) {
      updateData.notes = apt.notes
        ? `${apt.notes} | ${input.notes}`
        : input.notes;
    }

    if (input.roomId) {
      updateData.roomId = input.roomId;
    }

    if (input.doctorId) {
      updateData.doctorId = input.doctorId;
    }

    // Record exit timestamps when transitioning out of consultation or therapy
    if (apt.status === AppointmentStatus.IN_CONSULTATION && input.targetStation !== "CONSULTATION_ROOM" && !apt.outConsultationTime) {
      updateData.outConsultationTime = now;
    }
    if (apt.status === AppointmentStatus.IN_THERAPY && input.targetStation !== "THERAPY_ROOM" && !apt.outTherapyTime) {
      updateData.outTherapyTime = now;
    }

    switch (input.targetStation) {
      case "RECEPTIONIST_DESK":
        updateData.status = AppointmentStatus.CHECKED_IN;
        if (!apt.checkInTime) updateData.checkInTime = now;
        if (!input.roomId) {
          const room200 = await getOrCreateWaitingRoom200();
          updateData.roomId = room200.id;
        }
        break;

      case "CONSULTATION_ROOM": {
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
        const todaySerial = await prisma.consultationSerial.findFirst({
          where: {
            patientId: apt.patientId,
            appointmentDate: { gte: startOfDay, lte: endOfDay },
            status: { notIn: ["COMPLETED", "CANCELLED"] },
          },
        });
        if (!todaySerial) {
          return {
            success: false,
            message:
              "Cannot transfer to Doctor Consultation: Patient must have a Consultation Serial booked for today.",
          };
        }
        if (todaySerial.paymentStatus === "PENDING" && !todaySerial.invoiceId) {
          return {
            success: false,
            message:
              "Cannot transfer to Doctor Consultation: Consultation fee must be paid or marked as DUE by the Cashier first.",
          };
        }
        updateData.status = AppointmentStatus.IN_CONSULTATION;
        updateData.inConsultationTime = now;
        if (!apt.checkInTime) updateData.checkInTime = now;
        break;
      }

      case "CASHIER_REGISTER":
        // Keep active checked-in status so queue is not lost
        if (apt.status === AppointmentStatus.PENDING) {
          updateData.status = AppointmentStatus.CHECKED_IN;
          updateData.checkInTime = now;
        }
        break;

      case "THERAPY_ROOM": {
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
        const todaySlot = await prisma.appointment.findFirst({
          where: {
            patientId: apt.patientId,
            appointmentDate: { gte: startOfDay, lte: endOfDay },
            type: AppointmentType.THERAPY,
            therapySlotId: { not: null },
            status: {
              notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.COMPLETED],
            },
          },
        });
        if (!todaySlot && !apt.therapySlotId) {
          return {
            success: false,
            message:
              "Cannot transfer to Therapy Room: Patient must have an active Therapy Slot booked for today.",
          };
        }
        updateData.status = AppointmentStatus.IN_THERAPY;
        updateData.inTherapyTime = now;
        if (!apt.checkInTime) updateData.checkInTime = now;
        break;
      }

      case "CHECKED_OUT": {
        const unbilledSerials = await prisma.consultationSerial.findMany({
          where: {
            patientId: apt.patientId,
            status: { notIn: ["COMPLETED", "CANCELLED"] },
            paymentStatus: "PENDING",
            invoiceId: null,
          },
        });
        if (unbilledSerials.length > 0) {
          return {
            success: false,
            message: `Cannot check out patient: Consultation Serial #${unbilledSerials[0].serialNumber} has not been invoiced or marked as DUE at the Cashier Register.`,
          };
        }
        if (
          (apt.type === AppointmentType.THERAPY || apt.therapySlotId) &&
          apt.paymentStatus === "PENDING" &&
          !apt.invoiceId
        ) {
          return {
            success: false,
            message:
              "Cannot check out patient: Therapy session bill has not been settled or marked as DUE at the Cashier Register.",
          };
        }
        updateData.status = AppointmentStatus.COMPLETED;
        updateData.checkOutTime = now;
        break;
      }
    }

    const updated = await prisma.appointment.update({
      where: { id: input.appointmentId },
      data: updateData,
      include: { patient: true, doctor: true, room: true },
    });

    await syncBillingForAppointment(updated.id);

    await logAudit({
      userId: sessionData.user.id,
      performerId: input.performerId || null,
      action: AuditAction.APPOINTMENT_UPDATE,
      entity: "Appointment",
      entityId: updated.id,
      status: AuditStatus.SUCCESS,
      details: {
        action: "TRANSFER_STATION",
        patientName: apt.patient.name,
        fromStation: apt.currentStation || "RECEPTIONIST_DESK",
        toStation: input.targetStation,
        roomId: input.roomId,
        doctorId: input.doctorId,
      },
    });

    emitRealtimeEvent("STATION_CHANGED", {
      appointmentId: updated.id,
      patientId: updated.patientId,
      patientName: updated.patient.name,
      toStation: input.targetStation,
      status: updated.status,
    });
    emitRealtimeEvent("APPOINTMENT_UPDATED", {
      id: updated.id,
      patientId: updated.patientId,
      status: updated.status,
    });

    revalidatePath("/receptionist");
    revalidatePath("/doctor");
    revalidatePath("/handler");
    revalidatePath("/cashier");
    revalidatePath("/admin");
    revalidatePath("/admin/tracking");

    const stationLabelMap: Record<PatientStation, string> = {
      RECEPTIONIST_DESK: "Waiting Room 200 (Arrival Desk)",
      CONSULTATION_ROOM: "Doctor Consultation Room",
      CASHIER_REGISTER: "Cashier Register",
      THERAPY_ROOM: "Therapy Room",
      CHECKED_OUT: "Checked Out (Discharged)",
    };

    return {
      success: true,
      message: `Moved ${apt.patient.name} to ${stationLabelMap[input.targetStation]}.`,
    };
  } catch (error) {
    console.error("[Transfer Station Error]:", error);
    return { success: false, message: "Failed to transfer patient station." };
  }
}

export interface QuickCheckInWithoutSlotInput {
  patientId: string;
  station?: PatientStation;
  queueType?: QueueType;
  doctorId?: string;
  feeAmount?: number;
  roomId?: string;
  toldTime?: string;
  notes?: string;
  performerId?: string;
  pin?: string;
}

/**
 * Checks in a patient directly today WITHOUT requiring an assigned therapy slot.
 * Perfect for walk-in consultations, cashier billings, or unscheduled therapies.
 */
export async function quickCheckInWithoutSlotAction(
  input: QuickCheckInWithoutSlotInput,
): Promise<{ success: boolean; message: string; appointmentId?: string }> {
  const sessionData = await requireAuth([
    Role.RECEPTIONIST,
    Role.ADMIN,
    Role.DOCTOR,
    Role.HANDLER,
    Role.CASHIER,
  ]);

  try {
    if (input.performerId && input.pin) {
      const pinRes = await verifyPerformerPin(input.performerId, input.pin);
      if (!pinRes.valid) {
        return {
          success: false,
          message: pinRes.error || "Invalid security PIN for authorizing staff.",
        };
      }
    }

    const patient = await prisma.patient.findUnique({
      where: { id: input.patientId },
    });

    if (!patient) {
      return { success: false, message: "Patient not found." };
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

    const station = input.station || "RECEPTIONIST_DESK";
    const queueType = input.queueType || QueueType.CONSULTATION;

    let targetRoomId = input.roomId;
    if (!targetRoomId && station === "RECEPTIONIST_DESK") {
      const room200 = await getOrCreateWaitingRoom200();
      targetRoomId = room200.id;
    }

    // Check if patient already has an active appointment today
    const existing = await prisma.appointment.findFirst({
      where: {
        patientId: patient.id,
        appointmentDate: { gte: startOfDay, lte: endOfDay },
        status: {
          notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.COMPLETED],
        },
      },
    });

    let appointment;

    if (existing) {
      appointment = await prisma.appointment.update({
        where: { id: existing.id },
        data: {
          status:
            station === "CONSULTATION_ROOM"
              ? AppointmentStatus.IN_CONSULTATION
              : station === "THERAPY_ROOM"
                ? AppointmentStatus.IN_THERAPY
                : AppointmentStatus.CHECKED_IN,
          currentStation: station,
          checkInTime: existing.checkInTime || now,
          queueType,
          ...(input.doctorId ? { doctorId: input.doctorId } : {}),
          ...(targetRoomId ? { roomId: targetRoomId } : {}),
          ...(input.toldTime ? { toldTime: input.toldTime } : {}),
          ...(input.notes
            ? {
                notes: existing.notes
                  ? `${existing.notes} | ${input.notes}`
                  : input.notes,
              }
            : {}),
          ...(input.feeAmount !== undefined
            ? {
                feeAmount: input.feeAmount,
                dueAmount: Math.max(
                  0,
                  input.feeAmount - (existing.paidAmount ?? 0),
                ),
                paymentStatus:
                  input.feeAmount <= (existing.paidAmount ?? 0)
                    ? "PAID"
                    : "PARTIAL",
              }
            : {}),
        },
        include: { patient: true, doctor: true, room: true },
      });
      await syncBillingForAppointment(appointment.id);
    } else {
      // Create new walk-in / slot-free appointment
      const middayToday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        12,
        0,
        0,
      );

      // Determine initial fee
      let fee = input.feeAmount;
      if (fee === undefined && input.doctorId) {
        const doc = await prisma.user.findUnique({
          where: { id: input.doctorId },
          select: { consultationFee: true },
        });
        fee = doc?.consultationFee ?? 1000;
      }
      if (fee === undefined) {
        fee = queueType === QueueType.CONSULTATION ? 1000 : 800;
      }

      appointment = await prisma.appointment.create({
        data: {
          type:
            queueType === QueueType.CONSULTATION
              ? AppointmentType.CONSULTATION
              : AppointmentType.THERAPY,
          patientId: patient.id,
          appointmentDate: middayToday,
          gender: patient.gender,
          bookingType: BookingType.REGULAR,
          status:
            station === "CONSULTATION_ROOM"
              ? AppointmentStatus.IN_CONSULTATION
              : station === "THERAPY_ROOM"
                ? AppointmentStatus.IN_THERAPY
                : AppointmentStatus.CHECKED_IN,
          currentStation: station,
          checkInTime: now,
          queueType,
          doctorId: input.doctorId || undefined,
          roomId: targetRoomId || undefined,
          toldTime: input.toldTime || undefined,
          notes: input.notes || undefined,
          feeAmount: fee,
          paidAmount: 0,
          dueAmount: fee,
          paymentStatus: fee === 0 ? "PAID" : "PENDING",
        },
        include: { patient: true, doctor: true, room: true },
      });
      await syncBillingForAppointment(appointment.id);
    }

    await logAudit({
      userId: sessionData.user.id,
      performerId: input.performerId || null,
      action: AuditAction.APPOINTMENT_CREATE,
      entity: "Appointment",
      entityId: appointment.id,
      status: AuditStatus.SUCCESS,
      details: {
        action: "QUICK_CHECK_IN_WITHOUT_SLOT",
        patientName: patient.name,
        station,
        doctorId: input.doctorId,
        feeAmount: appointment.feeAmount,
      },
    });

    emitRealtimeEvent("APPOINTMENT_CREATED", {
      id: appointment.id,
      patientId: patient.id,
      patientName: patient.name,
      station,
      status: appointment.status,
    });
    emitRealtimeEvent("STATION_CHANGED", {
      appointmentId: appointment.id,
      patientId: patient.id,
      patientName: patient.name,
      toStation: station,
      status: appointment.status,
    });

    revalidatePath("/receptionist");
    revalidatePath("/doctor");
    revalidatePath("/handler");
    revalidatePath("/cashier");
    revalidatePath("/admin");

    return {
      success: true,
      message:
        station === "RECEPTIONIST_DESK"
          ? `Checked in ${patient.name} to Waiting Room 200.`
          : `Checked in ${patient.name} to ${station.replace(/_/g, " ")}.`,
      appointmentId: appointment.id,
    };
  } catch (error) {
    console.error("[Quick Check In Error]:", error);
    return { success: false, message: "Failed to check in patient." };
  }
}

/**
 * Checks out a patient directly, recording visit completion and checkout timestamp.
 */
export async function quickCheckOutPatientAction(
  appointmentId: string,
  performerId?: string,
): Promise<{ success: boolean; message: string }> {
  return transferPatientStationAction({
    appointmentId,
    targetStation: "CHECKED_OUT",
    performerId,
  });
}
