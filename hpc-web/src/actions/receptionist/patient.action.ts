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
 * Registers a new patient with automated Medical Record Number (MRN) generation.
 * Supports immediate Arrival Check-In if checkInNow is requested.
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

    // If checkInNow is requested, mark patient as checked in today
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

      // Ensure Queue master record exists
      const targetQueueType = queueType || QueueType.THERAPY;
      const queueRecord = await prisma.queue.upsert({
        where: { type: targetQueueType },
        update: {},
        create: {
          type: targetQueueType,
          name:
            targetQueueType === QueueType.CONSULTATION
              ? "Consultation Queue"
              : "Therapy Queue",
          description:
            targetQueueType === QueueType.CONSULTATION
              ? "Queue for doctor consultation"
              : "Queue for physical therapy",
        },
      });

      // Resolve Doctor if provided
      let resolvedDoctorId: string | undefined = undefined;
      let resolvedFee = feeAmount;
      if (doctorId) {
        const doc = await prisma.user.findFirst({
          where: { id: doctorId, role: Role.DOCTOR },
          select: { id: true, consultationFee: true },
        });
        if (doc) {
          resolvedDoctorId = doc.id;
          if (resolvedFee === undefined) {
            resolvedFee = doc.consultationFee ?? 1000;
          }
        }
      }

      if (resolvedFee === undefined) {
        resolvedFee = targetQueueType === QueueType.CONSULTATION ? 1000 : 800;
      }

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

      const stationToSet =
        targetQueueType === QueueType.CONSULTATION
          ? "CONSULTATION_ROOM"
          : "RECEPTIONIST_DESK";

      if (existingAppointment) {
        createdAppointment = await prisma.appointment.update({
          where: { id: existingAppointment.id },
          data: {
            status: AppointmentStatus.CHECKED_IN,
            currentStation: stationToSet,
            checkInTime: checkInDateObj,
            queueId: queueRecord.id,
            queueType: targetQueueType,
            toldTime: toldTime || undefined,
            notes: notes || undefined,
            doctorId: resolvedDoctorId || existingAppointment.doctorId || undefined,
          },
          include: { patient: true, doctor: true, therapySlot: true },
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
            type:
              targetQueueType === QueueType.CONSULTATION
                ? AppointmentType.CONSULTATION
                : AppointmentType.THERAPY,
            patientId: targetPatient.id,
            appointmentDate: middayToday,
            gender: targetPatient.gender,
            bookingType: BookingType.REGULAR,
            status: AppointmentStatus.CHECKED_IN,
            currentStation: stationToSet,
            checkInTime: checkInDateObj,
            queueId: queueRecord.id,
            queueType: targetQueueType,
            toldTime: toldTime || undefined,
            notes: notes || undefined,
            bookedById: validation.data.performerId || undefined,
            performerId: validation.data.performerId || undefined,
            doctorId: resolvedDoctorId || undefined,
            feeAmount: resolvedFee,
            paidAmount: 0,
            dueAmount: resolvedFee,
            paymentStatus: resolvedFee === 0 ? "PAID" : "PENDING",
          },
          include: { patient: true, doctor: true, therapySlot: true },
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
          action: "PATIENT_ARRIVAL_CHECKIN",
          patientName: targetPatient.name,
          mrn: targetPatient.mrn,
          queueType: targetQueueType,
          checkInTime: checkInDateObj.toISOString(),
          performerId: validation.data.performerId,
        },
      });

      // Broadcast appointment update
      emitRealtimeEvent("APPOINTMENT_CREATED", {
        id: createdAppointment.id,
        patientName: targetPatient.name,
        gender: targetPatient.gender,
        status: AppointmentStatus.CHECKED_IN,
        queueType: targetQueueType,
        checkInTime: checkInDateObj.toISOString(),
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
      ? `Patient "${targetPatient.name}" (${targetPatient.mrn}) registered & marked as CHECKED IN at ${timeStr}.`
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

    // Ensure queue record exists
    const queueRecord = await prisma.queue.upsert({
      where: { type: queueType },
      update: {},
      create: {
        type: queueType,
        name:
          queueType === QueueType.CONSULTATION
            ? "Consultation Queue"
            : "Therapy Queue",
        description:
          queueType === QueueType.CONSULTATION
            ? "Queue for doctor consultation"
            : "Queue for physical therapy",
      },
    });

    // Resolve doctor and fee
    let resolvedDoctorId: string | undefined = undefined;
    let resolvedFee = feeAmount;
    if (doctorId) {
      const doc = await prisma.user.findFirst({
        where: { id: doctorId, role: Role.DOCTOR },
        select: { id: true, consultationFee: true },
      });
      if (doc) {
        resolvedDoctorId = doc.id;
        if (resolvedFee === undefined) {
          resolvedFee = doc.consultationFee ?? 1000;
        }
      }
    }

    if (resolvedFee === undefined) {
      resolvedFee = queueType === QueueType.CONSULTATION ? 1000 : 800;
    }

    const stationToSet =
      queueType === QueueType.CONSULTATION
        ? "CONSULTATION_ROOM"
        : "RECEPTIONIST_DESK";

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
          checkInTime: checkInDateObj,
          queueId: queueRecord.id,
          queueType,
          ...(toldTime ? { toldTime } : {}),
          ...(notes ? { notes } : {}),
          ...(resolvedDoctorId ? { doctorId: resolvedDoctorId } : {}),
          ...(feeAmount !== undefined
            ? {
                feeAmount: resolvedFee,
                dueAmount: Math.max(
                  0,
                  resolvedFee - (existingAppointment.paidAmount ?? 0),
                ),
                paymentStatus:
                  resolvedFee <= (existingAppointment.paidAmount ?? 0)
                    ? "PAID"
                    : "PARTIAL",
              }
            : {}),
        },
        include: { patient: true, doctor: true, therapySlot: true },
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
          type:
            queueType === QueueType.CONSULTATION
              ? AppointmentType.CONSULTATION
              : AppointmentType.THERAPY,
          patientId: patient.id,
          appointmentDate: middayToday,
          gender: patient.gender,
          bookingType: BookingType.REGULAR,
          status: AppointmentStatus.CHECKED_IN,
          currentStation: stationToSet,
          checkInTime: checkInDateObj,
          queueId: queueRecord.id,
          queueType,
          toldTime: toldTime || undefined,
          notes: notes || undefined,
          bookedById: performerId || undefined,
          performerId: performerId || undefined,
          doctorId: resolvedDoctorId || undefined,
          feeAmount: resolvedFee,
          paidAmount: 0,
          dueAmount: resolvedFee,
          paymentStatus: resolvedFee === 0 ? "PAID" : "PENDING",
        },
        include: { patient: true, doctor: true, therapySlot: true },
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
        action: "ARRIVAL_CHECK_IN",
        patientName: patient.name,
        mrn: patient.mrn,
        queueType,
        checkInTime: checkInDateObj.toISOString(),
      },
    });

    // Realtime SSE broadcast
    emitRealtimeEvent("APPOINTMENT_UPDATED", {
      id: updatedAppointment.id,
      patientName: patient.name,
      status: AppointmentStatus.CHECKED_IN,
      queueType,
      checkInTime: checkInDateObj.toISOString(),
      currentStation: stationToSet,
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
      message: `Patient "${patient.name}" (${patient.mrn || "No MRN"}) marked as CHECKED IN at ${timeStr}.`,
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
