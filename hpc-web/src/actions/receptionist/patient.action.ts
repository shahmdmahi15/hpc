"use server";

import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { PatientModel } from "@/generated/prisma/models";
import { requireAuth } from "@/lib/guard";
import {
  Role,
  AuditAction,
  AuditStatus,
  Gender,
  AppointmentStatus,
  AppointmentType,
  QueueType,
  BookingType,
  RoomAccessType,
  RoomGender,
  RoomStatus,
} from "@/generated/prisma/enums";
import {
  createPatientSchema,
  updatePatientSchema,
  checkInArrivingPatientSchema,
  type CreatePatientInput,
  type UpdatePatientInput,
  type CheckInArrivingPatientInput,
  type PatientActionState,
} from "@/schemas/receptionist/patient.schema";
import { logAudit } from "@/lib/audit";
import { verifyPerformerPin } from "@/lib/performer-auth";
import { emitRealtimeEvent } from "@/lib/realtime/event-bus";
import { syncBillingForAppointment } from "@/lib/billing-sync";
import { revalidatePath } from "next/cache";

/**
 * Ensures Room 200 (Designated Public Waiting Room) exists in the database
 */
export async function getOrCreateWaitingRoom200() {
  let room200 = await prisma.room.findFirst({
    where: { number: "200" },
  });
  if (!room200) {
    room200 = await prisma.room.create({
      data: {
        number: "200",
        purpose: "Waiting Room",
        accessType: RoomAccessType.PUBLIC,
        gender: RoomGender.COMMON,
        status: RoomStatus.AVAILABLE,
      },
    });
  }
  return room200;
}

/**
 * Registers a new patient with automated Medical Record Number (MRN) generation.
 * Supports immediate Arrival Check-In if checkInNow is requested (placed into Waiting Room 200).
 */
export async function createPatientAction(
  data: CreatePatientInput,
): Promise<PatientActionState> {
  try {
    const sessionData = await requireAuth([
      Role.RECEPTIONIST,
      Role.ADMIN,
      Role.DOCTOR,
      Role.HANDLER,
      Role.CASHIER,
    ]);
    const validation = createPatientSchema.safeParse(data);

    if (!validation.success) {
      return {
        success: false,
        message: "Please correct the invalid patient information.",
        fieldErrors: validation.error.flatten().fieldErrors,
      };
    }

    // Doctors and Admins are independent user accounts with zero PIN requirements.
    const isExemptRole =
      sessionData.user.role === Role.DOCTOR ||
      sessionData.user.role === Role.ADMIN;

    if (!isExemptRole && validation.data.performerId) {
      const pinRes = await verifyPerformerPin(
        validation.data.performerId,
        validation.data.pin,
      );
      if (!pinRes.valid) {
        return {
          success: false,
          message: pinRes.error || "Invalid 4-digit staff PIN.",
        };
      }
    }

    const {
      name,
      phone,
      gender,
      age,
      email,
      dateOfBirth,
      address,
      emergencyPhone,
      profession,
      bloodGroup,
      checkInNow,
      queueType,
      doctorId,
      checkInTime,
      toldTime,
      notes,
      feeAmount,
    } = validation.data;

    // Check if duplicate patient phone exists
    const existing = await prisma.patient.findFirst({
      where: { phone },
    });

    let targetPatient = existing;

    if (!targetPatient) {
      // Generate unique MRN (e.g. HPC-2026-0042)
      const currentYear = new Date().getFullYear();
      const count = await prisma.patient.count();
      const mrn = `HPC-${currentYear}-${String(count + 1).padStart(4, "0")}`;

      targetPatient = await prisma.patient.create({
        data: {
          mrn,
          name,
          phone,
          gender: gender as Gender,
          age: age || undefined,
          email: email || undefined,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
          address: address || undefined,
          emergencyPhone: emergencyPhone || undefined,
          profession: profession || undefined,
          bloodGroup: bloodGroup || undefined,
        },
      });

      // Audit log for Patient creation
      await logAudit({
        userId: sessionData.user.id,
        performerId: validation.data.performerId || null,
        action: AuditAction.PATIENT_CREATE,
        entity: "Patient",
        entityId: targetPatient.id,
        status: AuditStatus.SUCCESS,
        details: {
          name: targetPatient.name,
          phone: targetPatient.phone,
          mrn: targetPatient.mrn,
          gender: targetPatient.gender,
          email: targetPatient.email,
          profession: targetPatient.profession,
          bloodGroup: targetPatient.bloodGroup,
        },
      });

      // Realtime broadcast of new patient
      emitRealtimeEvent("PATIENT_CREATED", {
        id: targetPatient.id,
        mrn: targetPatient.mrn,
        name: targetPatient.name,
        phone: targetPatient.phone,
        gender: targetPatient.gender,
      });
    }

    let createdAppointment = null;

    // If checkInNow is requested, mark patient as checked in today in Waiting Room 200
    if (checkInNow) {
      const now = new Date();
      const checkInDateObj = checkInTime ? new Date(checkInTime) : now;
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

      // Ensure Room 200 (Designated Public Waiting Room) exists
      const room200 = await getOrCreateWaitingRoom200();

      // Check if patient already has an active appointment for today
      const existingAppointment = await prisma.appointment.findFirst({
        where: {
          patientId: targetPatient.id,
          appointmentDate: { gte: startOfDay, lte: endOfDay },
          status: {
            notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.COMPLETED],
          },
        },
      });

      // Automatic assignment to Waiting Room 200 (no queue or doctor assigned yet)
      const stationToSet = "RECEPTIONIST_DESK";

      if (existingAppointment) {
        createdAppointment = await prisma.appointment.update({
          where: { id: existingAppointment.id },
          data: {
            status: AppointmentStatus.CHECKED_IN,
            currentStation: stationToSet,
            roomId: room200.id,
            checkInTime: checkInDateObj,
            toldTime: toldTime || existingAppointment.toldTime || undefined,
            notes: notes || existingAppointment.notes || undefined,
            performerId: validation.data.performerId || existingAppointment.performerId || undefined,
          },
          include: { patient: true, doctor: true, therapySlot: true, room: true },
        });
      } else {
        const middayToday = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          12,
          0,
          0,
          0,
        );

        createdAppointment = await prisma.appointment.create({
          data: {
            type: AppointmentType.CONSULTATION,
            patientId: targetPatient.id,
            appointmentDate: middayToday,
            gender: targetPatient.gender,
            bookingType: BookingType.REGULAR,
            status: AppointmentStatus.CHECKED_IN,
            currentStation: stationToSet,
            roomId: room200.id,
            checkInTime: checkInDateObj,
            queueId: null,
            queueType: null,
            doctorId: null,
            toldTime: toldTime || undefined,
            notes: notes || undefined,
            bookedById: validation.data.performerId || undefined,
            performerId: validation.data.performerId || undefined,
            feeAmount: 0,
            paidAmount: 0,
            dueAmount: 0,
            paymentStatus: "PENDING",
          },
          include: { patient: true, doctor: true, therapySlot: true, room: true },
        });
      }

      await syncBillingForAppointment(createdAppointment.id);

      // Log appointment audit
      await logAudit({
        userId: sessionData.user.id,
        performerId: validation.data.performerId || null,
        action: AuditAction.APPOINTMENT_CREATE,
        entity: "Appointment",
        entityId: createdAppointment.id,
        status: AuditStatus.SUCCESS,
        details: {
          action: "PATIENT_ARRIVAL_CHECKIN_ROOM_200",
          patientName: targetPatient.name,
          mrn: targetPatient.mrn,
          roomNumber: "200",
          station: "RECEPTIONIST_DESK",
          checkInTime: checkInDateObj.toISOString(),
          performerId: validation.data.performerId,
        },
      });

      // Broadcast appointment update & station changed
      emitRealtimeEvent("APPOINTMENT_CREATED", {
        id: createdAppointment.id,
        patientName: targetPatient.name,
        gender: targetPatient.gender,
        status: AppointmentStatus.CHECKED_IN,
        roomNumber: "200",
        currentStation: "RECEPTIONIST_DESK",
        checkInTime: checkInDateObj.toISOString(),
      });
      emitRealtimeEvent("STATION_CHANGED", {
        appointmentId: createdAppointment.id,
        patientId: targetPatient.id,
        patientName: targetPatient.name,
        toStation: "RECEPTIONIST_DESK",
        status: AppointmentStatus.CHECKED_IN,
        roomNumber: "200",
      });
    }

    revalidatePath("/receptionist");
    revalidatePath("/doctor");
    revalidatePath("/handler");
    revalidatePath("/admin/tracking");

    const timeStr = (checkInTime ? new Date(checkInTime) : new Date()).toLocaleTimeString(
      "en-US",
      { hour: "2-digit", minute: "2-digit", hour12: true },
    );

    const successMsg = checkInNow
      ? `Patient "${targetPatient.name}" (${targetPatient.mrn}) registered & placed in Waiting Room 200 at ${timeStr}.`
      : `Patient "${targetPatient.name}" registered successfully with MRN ${targetPatient.mrn}.`;

    return {
      success: true,
      message: successMsg,
      patient: targetPatient,
      appointment: createdAppointment,
    };
  } catch (error) {
    console.error("[Create Patient Error]:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to register patient.",
    };
  }
}

/**
 * Marks an existing patient in the directory as CHECKED IN upon arrival at the center.
 * Strictly verifies the receptionist's performer selection and 4-digit PIN.
 */
export async function checkInArrivingPatientAction(
  data: CheckInArrivingPatientInput,
): Promise<{ success: boolean; message: string; appointment?: any }> {
  try {
    const sessionData = await requireAuth([
      Role.RECEPTIONIST,
      Role.ADMIN,
      Role.DOCTOR,
      Role.HANDLER,
      Role.CASHIER,
    ]);

    const validation = checkInArrivingPatientSchema.safeParse(data);
    if (!validation.success) {
      const errMessages = Object.values(
        validation.error.flatten().fieldErrors,
      ).flat();
      return {
        success: false,
        message: errMessages[0] || "Invalid check-in details provided.",
      };
    }

    const {
      patientId,
      performerId,
      pin,
      queueType,
      doctorId,
      checkInTime,
      toldTime,
      notes,
      feeAmount,
    } = validation.data;

    // Verify receptionist performer and 4-digit PIN
    const isExemptRole =
      sessionData.user.role === Role.DOCTOR ||
      sessionData.user.role === Role.ADMIN;

    if (!isExemptRole) {
      const pinRes = await verifyPerformerPin(performerId, pin);
      if (!pinRes.valid) {
        return {
          success: false,
          message: pinRes.error || "Invalid 4-digit staff PIN.",
        };
      }
    }

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
    });

    if (!patient) {
      return { success: false, message: "Patient not found in directory." };
    }

    const now = new Date();
    const checkInDateObj = checkInTime ? new Date(checkInTime) : now;
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

    // Ensure Room 200 (Designated Public Waiting Room) exists
    const room200 = await getOrCreateWaitingRoom200();

    const stationToSet = "RECEPTIONIST_DESK";

    // Check for existing appointment today
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
      updatedAppointment = await prisma.appointment.update({
        where: { id: existingAppointment.id },
        data: {
          status: AppointmentStatus.CHECKED_IN,
          currentStation: stationToSet,
          roomId: room200.id,
          checkInTime: checkInDateObj,
          performerId,
          ...(toldTime ? { toldTime } : {}),
          ...(notes ? { notes } : {}),
        },
        include: { patient: true, doctor: true, therapySlot: true, room: true },
      });
    } else {
      const middayToday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        12,
        0,
        0,
        0,
      );

      updatedAppointment = await prisma.appointment.create({
        data: {
          type: AppointmentType.CONSULTATION,
          patientId: patient.id,
          appointmentDate: middayToday,
          gender: patient.gender,
          bookingType: BookingType.REGULAR,
          status: AppointmentStatus.CHECKED_IN,
          currentStation: stationToSet,
          roomId: room200.id,
          checkInTime: checkInDateObj,
          queueId: null,
          queueType: null,
          doctorId: null,
          toldTime: toldTime || undefined,
          notes: notes || undefined,
          bookedById: performerId,
          performerId: performerId,
          feeAmount: 0,
          paidAmount: 0,
          dueAmount: 0,
          paymentStatus: "PENDING",
        },
        include: { patient: true, doctor: true, therapySlot: true, room: true },
      });
    }

    await syncBillingForAppointment(updatedAppointment.id);

    // Audit Log
    await logAudit({
      userId: sessionData.user.id,
      performerId: performerId || null,
      action: AuditAction.APPOINTMENT_UPDATE,
      entity: "Appointment",
      entityId: updatedAppointment.id,
      status: AuditStatus.SUCCESS,
      details: {
        action: "ARRIVAL_CHECK_IN_ROOM_200",
        patientName: patient.name,
        mrn: patient.mrn,
        roomNumber: "200",
        station: stationToSet,
        checkInTime: checkInDateObj.toISOString(),
      },
    });

    // Realtime SSE broadcast
    emitRealtimeEvent("APPOINTMENT_UPDATED", {
      id: updatedAppointment.id,
      patientName: patient.name,
      status: AppointmentStatus.CHECKED_IN,
      roomNumber: "200",
      checkInTime: checkInDateObj.toISOString(),
      currentStation: stationToSet,
    });
    emitRealtimeEvent("STATION_CHANGED", {
      appointmentId: updatedAppointment.id,
      patientId: patient.id,
      patientName: patient.name,
      toStation: stationToSet,
      status: AppointmentStatus.CHECKED_IN,
      roomNumber: "200",
    });

    revalidatePath("/receptionist");
    revalidatePath("/doctor");
    revalidatePath("/handler");
    revalidatePath("/admin/tracking");

    const timeStr = checkInDateObj.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    return {
      success: true,
      message: `Patient "${patient.name}" (${patient.mrn || "No MRN"}) checked in to Waiting Room 200 at ${timeStr}.`,
      appointment: updatedAppointment,
    };
  } catch (error) {
    console.error("[Check In Arriving Patient Error]:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to check in patient.",
    };
  }
}

/**
 * Searches registered patients with today's real-time arrival and check-in status.
 */
export async function searchPatientsWithArrivalStatusAction(query: string) {
  try {
    await requireAuth([
      Role.RECEPTIONIST,
      Role.ADMIN,
      Role.DOCTOR,
      Role.HANDLER,
      Role.CASHIER,
    ]);

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

    const q = query?.trim() || "";

    const patients = await prisma.patient.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q } },
              { phone: { contains: q } },
              { mrn: { contains: q } },
            ],
          }
        : undefined,
      include: {
        appointments: {
          where: {
            appointmentDate: { gte: startOfDay, lte: endOfDay },
            status: { not: AppointmentStatus.CANCELLED },
          },
          include: {
            doctor: { select: { id: true, name: true, consultationFee: true } },
            therapySlot: { select: { id: true, label: true, startTime: true, endTime: true } },
            room: true,
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      take: q ? 15 : 8,
      orderBy: { createdAt: "desc" },
    });

    return patients.map((p) => {
      const todayAppointment = p.appointments[0] || null;
      return {
        id: p.id,
        mrn: p.mrn,
        name: p.name,
        phone: p.phone,
        gender: p.gender,
        age: p.age,
        email: p.email,
        address: p.address,
        emergencyPhone: p.emergencyPhone,
        profession: p.profession,
        bloodGroup: p.bloodGroup,
        createdAt: p.createdAt,
        todayAppointment: todayAppointment
          ? {
              id: todayAppointment.id,
              status: todayAppointment.status,
              queueType: todayAppointment.queueType,
              currentStation: todayAppointment.currentStation,
              checkInTime: todayAppointment.checkInTime,
              toldTime: todayAppointment.toldTime,
              feeAmount: todayAppointment.feeAmount,
              paidAmount: todayAppointment.paidAmount,
              dueAmount: todayAppointment.dueAmount,
              paymentStatus: todayAppointment.paymentStatus,
              doctorName: todayAppointment.doctor?.name || null,
              slotLabel: todayAppointment.therapySlot?.label || null,
              roomId: todayAppointment.roomId || null,
              roomNumber: todayAppointment.room?.number || null,
              roomPurpose: todayAppointment.room?.purpose || null,
            }
          : null,
      };
    });
  } catch (error) {
    console.error("[Search Patients With Arrival Status Error]:", error);
    return [];
  }
}

/**
 * Loads all patients who arrived / checked in today.
 */
export async function getTodayArrivalsDataAction() {
  try {
    await requireAuth([
      Role.RECEPTIONIST,
      Role.ADMIN,
      Role.DOCTOR,
      Role.HANDLER,
      Role.CASHIER,
    ]);

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

    const appointments = await prisma.appointment.findMany({
      where: {
        appointmentDate: { gte: startOfDay, lte: endOfDay },
        status: {
          in: [
            AppointmentStatus.CHECKED_IN,
            AppointmentStatus.CALLING,
            AppointmentStatus.IN_CONSULTATION,
            AppointmentStatus.IN_THERAPY,
            AppointmentStatus.COMPLETED,
          ],
        },
      },
      include: {
        patient: true,
        room: true,
        doctor: {
          select: {
            id: true,
            name: true,
            email: true,
            consultationFee: true,
          },
        },
        therapySlot: {
          include: {
            room: true,
          },
        },
        bookedBy: {
          select: {
            id: true,
            name: true,
          },
        },
        performer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        checkInTime: "desc",
      },
    });

    return appointments;
  } catch (error) {
    console.error("[Get Today Arrivals Error]:", error);
    return [];
  }
}

/**
 * Updates an existing patient profile with audit logging and realtime notification.
 */
export async function updatePatientAction(
  data: UpdatePatientInput,
): Promise<PatientActionState> {
  try {
    const sessionData = await requireAuth([
      Role.RECEPTIONIST,
      Role.ADMIN,
      Role.DOCTOR,
      Role.HANDLER,
      Role.CASHIER,
    ]);
    const validation = updatePatientSchema.safeParse(data);

    if (!validation.success) {
      return {
        success: false,
        message: "Please correct the invalid patient information.",
        fieldErrors: validation.error.flatten().fieldErrors,
      };
    }

    // Doctors and Admins are independent user accounts with zero PIN requirements.
    const isExemptRole =
      sessionData.user.role === Role.DOCTOR ||
      sessionData.user.role === Role.ADMIN;

    if (!isExemptRole && validation.data.performerId) {
      const pinRes = await verifyPerformerPin(
        validation.data.performerId,
        validation.data.pin,
      );
      if (!pinRes.valid) {
        return {
          success: false,
          message: pinRes.error || "Invalid 4-digit staff PIN.",
        };
      }
    }

    const {
      id,
      name,
      phone,
      gender,
      age,
      email,
      dateOfBirth,
      address,
      emergencyPhone,
      profession,
      bloodGroup,
    } = validation.data;

    // Verify patient exists
    const existing = await prisma.patient.findUnique({
      where: { id },
    });

    if (!existing) {
      return {
        success: false,
        message: "Patient record not found.",
      };
    }

    // Check if duplicate phone is already assigned to a DIFFERENT patient
    const duplicatePhone = await prisma.patient.findFirst({
      where: {
        phone,
        id: { not: id },
      },
    });

    if (duplicatePhone) {
      return {
        success: false,
        message: `Phone number ${phone} is already registered to another patient (${duplicatePhone.name}, MRN: ${duplicatePhone.mrn || "N/A"}).`,
      };
    }

    const updatedPatient = await prisma.patient.update({
      where: { id },
      data: {
        name,
        phone,
        gender: gender as Gender,
        age: age !== undefined ? age : null,
        email: email || null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        address: address !== undefined ? address : null,
        emergencyPhone: emergencyPhone !== undefined ? emergencyPhone : null,
        profession: profession || null,
        bloodGroup: bloodGroup || null,
      },
      include: {
        _count: { select: { appointments: true } },
      },
    });

    // Audit log
    await logAudit({
      userId: sessionData.user.id,
      performerId: validation.data.performerId || null,
      action: AuditAction.PATIENT_UPDATE,
      entity: "Patient",
      entityId: updatedPatient.id,
      status: AuditStatus.SUCCESS,
      details: {
        old: {
          name: existing.name,
          phone: existing.phone,
          gender: existing.gender,
          age: existing.age,
          email: existing.email,
          profession: existing.profession,
          bloodGroup: existing.bloodGroup,
        },
        new: {
          name: updatedPatient.name,
          phone: updatedPatient.phone,
          gender: updatedPatient.gender,
          age: updatedPatient.age,
          email: updatedPatient.email,
          profession: updatedPatient.profession,
          bloodGroup: updatedPatient.bloodGroup,
        },
      },
    });

    // Realtime broadcast to all local clients
    emitRealtimeEvent("PATIENT_UPDATED", {
      id: updatedPatient.id,
      mrn: updatedPatient.mrn,
      name: updatedPatient.name,
      phone: updatedPatient.phone,
      gender: updatedPatient.gender,
    });

    revalidatePath("/receptionist");
    revalidatePath("/doctor");
    revalidatePath("/handler");

    return {
      success: true,
      message: `Patient profile for "${updatedPatient.name}" updated successfully.`,
      patient: updatedPatient,
    };
  } catch (error) {
    console.error("[Update Patient Error]:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to update patient profile.",
    };
  }
}

/**
 * Searches registered patients by name, phone, or MRN.
 */
export async function searchPatientsAction(query: string) {
  try {
    await requireAuth([
      Role.RECEPTIONIST,
      Role.ADMIN,
      Role.DOCTOR,
      Role.HANDLER,
      Role.CASHIER,
    ]);

    if (!query || query.trim().length === 0) {
      return await prisma.patient.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
      });
    }

    const q = query.trim();

    return await prisma.patient.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { phone: { contains: q } },
          { mrn: { contains: q } },
        ],
      },
      take: 15,
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    console.error("[Search Patients Error]:", error);
    return [];
  }
}

/**
 * Gets recent patients for quick reception desk selection.
 */
export async function getRecentPatientsAction(limit = 10) {
  try {
    await requireAuth([
      Role.RECEPTIONIST,
      Role.ADMIN,
      Role.DOCTOR,
      Role.HANDLER,
      Role.CASHIER,
    ]);
    return await prisma.patient.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    console.error("[Get Recent Patients Error]:", error);
    return [];
  }
}

export type PatientWithStats = PatientModel & {
  _count?: { appointments: number };
};

/**
 * Loads patients directory with optional search query and gender filtering.
 */
export async function getPatientsListAction(params?: {
  query?: string;
  gender?: Gender | "ALL";
  limit?: number;
}): Promise<PatientWithStats[]> {
  try {
    await requireAuth([
      Role.RECEPTIONIST,
      Role.ADMIN,
      Role.DOCTOR,
      Role.HANDLER,
      Role.CASHIER,
    ]);
    const query = params?.query?.trim();
    const gender =
      params?.gender && params.gender !== "ALL" ? params.gender : undefined;

    const where: Prisma.PatientWhereInput = {};
    if (query) {
      where.OR = [
        { name: { contains: query } },
        { phone: { contains: query } },
        { mrn: { contains: query } },
      ];
    }
    if (gender) {
      where.gender = gender;
    }

    return await prisma.patient.findMany({
      where,
      include: {
        _count: { select: { appointments: true } },
      },
      take: params?.limit || 50,
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    console.error("[Get Patients List Error]:", error);
    return [];
  }
}
