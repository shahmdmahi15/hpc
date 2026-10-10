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
  bookConsultationSerialSchema,
  checkoutPatientVisitSchema,
  type CreatePatientInput,
  type UpdatePatientInput,
  type CheckInArrivingPatientInput,
  type BookConsultationSerialInput,
  type CheckoutPatientVisitInput,
  type PatientActionState,
} from "@/schemas/receptionist/patient.schema";
import { logAudit } from "@/lib/audit";
import { verifyPerformerPin } from "@/lib/performer-auth";
import { emitRealtimeEvent } from "@/lib/realtime/event-bus";
import { syncBillingForAppointment, syncBillingForPatient } from "@/lib/billing-sync";
import { revalidatePath } from "next/cache";

/**
 * Dynamically resolves the clinic's Designated Public Waiting Room (first room with RoomAccessType.PUBLIC)
 */
export async function getPublicWaitingRoom() {
  let waitingRoom = await prisma.room.findFirst({
    where: { accessType: RoomAccessType.PUBLIC },
    orderBy: { number: "asc" },
  });
  if (!waitingRoom) {
    waitingRoom = await prisma.room.create({
      data: {
        number: "200",
        purpose: "Waiting Room",
        accessType: RoomAccessType.PUBLIC,
        gender: RoomGender.COMMON,
        status: RoomStatus.AVAILABLE,
      },
    });
  }
  return waitingRoom;
}

/**
 * Backwards compatibility alias for getPublicWaitingRoom
 */
export const getOrCreateWaitingRoom200 = getPublicWaitingRoom;

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

    let waitingRoom: any = null;
    // If checkInNow is requested, mark patient as checked in today in Public Waiting Room
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

      // Dynamically resolve Public Waiting Room
      waitingRoom = await getPublicWaitingRoom();

      // Create or find active PatientVisit for today
      let visit = await prisma.patientVisit.findFirst({
        where: {
          patientId: targetPatient.id,
          visitDate: { gte: startOfDay, lte: endOfDay },
          status: { not: "CHECKED_OUT" },
        },
        orderBy: { checkInTime: "desc" },
      });

      if (!visit) {
        const visitCountToday = await prisma.patientVisit.count({
          where: {
            patientId: targetPatient.id,
            visitDate: { gte: startOfDay, lte: endOfDay },
          },
        });
        visit = await prisma.patientVisit.create({
          data: {
            patientId: targetPatient.id,
            visitNumber: visitCountToday + 1,
            visitDate: now,
            checkInTime: checkInDateObj,
            status: "CHECKED_IN",
            checkInPerformerId: validation.data.performerId || null,
            notes: notes || undefined,
          },
        });
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

      // Automatic assignment to Waiting Room (no queue or doctor assigned yet)
      const stationToSet = "RECEPTIONIST_DESK";

      if (existingAppointment) {
        createdAppointment = await prisma.appointment.update({
          where: { id: existingAppointment.id },
          data: {
            status: AppointmentStatus.CHECKED_IN,
            currentStation: stationToSet,
            roomId: waitingRoom.id,
            visitId: visit.id,
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
            visitId: visit.id,
            appointmentDate: middayToday,
            gender: targetPatient.gender,
            bookingType: BookingType.REGULAR,
            status: AppointmentStatus.CHECKED_IN,
            currentStation: stationToSet,
            roomId: waitingRoom.id,
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

      // Record in PatientStepLog
      await prisma.patientStepLog.create({
        data: {
          patientId: targetPatient.id,
          visitId: visit.id,
          step: "CHECK_IN",
          station: stationToSet,
          roomNumber: waitingRoom.number,
          performerId: validation.data.performerId || null,
          details: `Registered & checked in to Waiting Room (${waitingRoom.number})`,
        },
      });

      // Log appointment audit
      await logAudit({
        userId: sessionData.user.id,
        performerId: validation.data.performerId || null,
        action: AuditAction.APPOINTMENT_CREATE,
        entity: "Appointment",
        entityId: createdAppointment.id,
        status: AuditStatus.SUCCESS,
        details: {
          action: "PATIENT_ARRIVAL_CHECKIN_WAITING_ROOM",
          patientName: targetPatient.name,
          mrn: targetPatient.mrn,
          roomNumber: waitingRoom.number,
          station: stationToSet,
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
        roomNumber: waitingRoom.number,
        currentStation: stationToSet,
        checkInTime: checkInDateObj.toISOString(),
      });
      emitRealtimeEvent("STATION_CHANGED", {
        appointmentId: createdAppointment.id,
        patientId: targetPatient.id,
        patientName: targetPatient.name,
        toStation: stationToSet,
        status: AppointmentStatus.CHECKED_IN,
        roomNumber: waitingRoom.number,
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
      ? `Patient "${targetPatient.name}" (${targetPatient.mrn}) registered & placed in Waiting Room (${waitingRoom?.number || "Public"}) at ${timeStr}.`
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
): Promise<{
  success: boolean;
  message: string;
  appointment?: any;
  consultationSerial?: any;
  visit?: any;
}> {
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

    // Dynamically resolve Public Waiting Room
    const waitingRoom = await getPublicWaitingRoom();

    // Create or find active PatientVisit for today
    let visit = await prisma.patientVisit.findFirst({
      where: {
        patientId: patient.id,
        visitDate: { gte: startOfDay, lte: endOfDay },
        status: { not: "CHECKED_OUT" },
      },
      orderBy: { checkInTime: "desc" },
    });

    if (!visit) {
      const count = await prisma.patientVisit.count({
        where: {
          patientId: patient.id,
          visitDate: { gte: startOfDay, lte: endOfDay },
        },
      });
      visit = await prisma.patientVisit.create({
        data: {
          patientId: patient.id,
          visitNumber: count + 1,
          visitDate: now,
          checkInTime: checkInDateObj,
          status: "CHECKED_IN",
          checkInPerformerId: performerId,
          notes: notes || undefined,
        },
      });
    }

    // 1. Check if patient already has a Consultation Serial booked today
    const existingSerial = await prisma.consultationSerial.findFirst({
      where: {
        patientId: patient.id,
        appointmentDate: { gte: startOfDay, lte: endOfDay },
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      include: { doctor: true, invoice: true },
      orderBy: { serialNumber: "desc" },
    });

    // 2. Check if patient has a Therapy Slot booked today
    const existingTherapyAppointment = await prisma.appointment.findFirst({
      where: {
        patientId: patient.id,
        appointmentDate: { gte: startOfDay, lte: endOfDay },
        type: AppointmentType.THERAPY,
        therapySlotId: { not: null },
        status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.COMPLETED] },
      },
      include: { therapySlot: true },
      orderBy: { createdAt: "desc" },
    });

    let updatedAppointment = null;
    let updatedSerial = null;
    let stationToSet = "RECEPTIONIST_DESK";
    let stepLogAction = "CHECK_IN";
    let stepLogDetails = `Checked in to Waiting Room (${waitingRoom.number})`;

    if (existingSerial) {
      const isAlreadyBilled =
        existingSerial.paymentStatus === "PAID" ||
        existingSerial.paymentStatus === "DUE" ||
        Boolean(existingSerial.invoiceId);

      if (isAlreadyBilled) {
        // Scenario A1: Consultation Serial booked today AND ALREADY BILLED -> Placed in Doctor Consultation Queue
        stationToSet = "CONSULTATION_ROOM";
        stepLogAction = "QUEUED_FOR_DOCTOR";
        stepLogDetails = `Checked in with Consultation Serial #${existingSerial.serialNumber} (Dr. ${existingSerial.doctor?.name || "Doctor"}) -> Placed in Doctor Consultation Queue (Billed / Invoice #${existingSerial.invoice?.invoiceNumber || "Cleared"})`;

        updatedSerial = await prisma.consultationSerial.update({
          where: { id: existingSerial.id },
          data: {
            status: "QUEUED",
            visitId: visit.id,
            bookedById: performerId || existingSerial.bookedById,
            toldTime: toldTime || existingSerial.toldTime,
          },
          include: { doctor: true, invoice: true },
        });

        const existingApt = await prisma.appointment.findFirst({
          where: {
            patientId: patient.id,
            appointmentDate: { gte: startOfDay, lte: endOfDay },
            type: AppointmentType.CONSULTATION,
          },
        });

        if (existingApt) {
          updatedAppointment = await prisma.appointment.update({
            where: { id: existingApt.id },
            data: {
              queueType: QueueType.CONSULTATION,
              status: AppointmentStatus.CHECKED_IN,
              currentStation: stationToSet,
              roomId: waitingRoom.id,
              visitId: visit.id,
              checkInTime: checkInDateObj,
              doctorId: existingSerial.doctorId,
              invoiceId: existingSerial.invoiceId || existingApt.invoiceId,
              feeAmount: 0, // Consultation fee is tracked on ConsultationSerial
              paidAmount: 0,
              dueAmount: 0,
              paymentStatus: "PAID",
              notes: notes || existingSerial.notes || existingApt.notes,
              ...(toldTime ? { toldTime } : {}),
            },
            include: { patient: true, doctor: true, therapySlot: true, room: true },
          });
        } else {
          updatedAppointment = await prisma.appointment.create({
            data: {
              type: AppointmentType.CONSULTATION,
              queueType: QueueType.CONSULTATION,
              status: AppointmentStatus.CHECKED_IN,
              currentStation: stationToSet,
              roomId: waitingRoom.id,
              patientId: patient.id,
              visitId: visit.id,
              checkInTime: checkInDateObj,
              doctorId: existingSerial.doctorId,
              gender: patient.gender,
              invoiceId: existingSerial.invoiceId,
              feeAmount: 0,
              paidAmount: 0,
              dueAmount: 0,
              paymentStatus: "PAID",
              toldTime: toldTime || existingSerial.toldTime || undefined,
              notes: notes || existingSerial.notes || undefined,
              performerId,
            },
            include: { patient: true, doctor: true, therapySlot: true, room: true },
          });
        }
      } else {
        // Scenario 6: Consultation Serial booked today but NOT billed yet -> Placed in Waiting Room & Forward to Cashier (NO queue yet!)
        stationToSet = "CASHIER_REGISTER";
        stepLogAction = "FORWARDED_TO_CASHIER";
        stepLogDetails = `Checked in with Consultation Serial #${existingSerial.serialNumber} (Dr. ${existingSerial.doctor?.name || "Doctor"}) -> Forwarded to Cashier Desk for payment (NOT queued yet)`;

        updatedSerial = await prisma.consultationSerial.update({
          where: { id: existingSerial.id },
          data: {
            status: "FORWARDED_TO_CASHIER",
            visitId: visit.id,
            bookedById: performerId || existingSerial.bookedById,
            toldTime: toldTime || existingSerial.toldTime,
            ...(notes ? { notes } : {}),
          },
          include: { doctor: true, invoice: true },
        });

        // Ensure patient is in Waiting Room (Room 200) with queueType: null
        const existingApt = await prisma.appointment.findFirst({
          where: {
            patientId: patient.id,
            appointmentDate: { gte: startOfDay, lte: endOfDay },
            type: AppointmentType.CONSULTATION,
          },
        });

        if (existingApt) {
          updatedAppointment = await prisma.appointment.update({
            where: { id: existingApt.id },
            data: {
              status: AppointmentStatus.CHECKED_IN,
              currentStation: stationToSet,
              roomId: waitingRoom.id,
              visitId: visit.id,
              doctorId: existingSerial.doctorId,
              checkInTime: checkInDateObj,
              queueType: null,
              feeAmount: 0,
              paidAmount: 0,
              dueAmount: 0,
              paymentStatus: "PENDING",
              notes: notes || existingSerial.notes || existingApt.notes,
              performerId,
            },
            include: { patient: true, doctor: true, therapySlot: true, room: true },
          });
        } else {
          updatedAppointment = await prisma.appointment.create({
            data: {
              type: AppointmentType.CONSULTATION,
              queueType: null,
              status: AppointmentStatus.CHECKED_IN,
              currentStation: stationToSet,
              roomId: waitingRoom.id,
              patientId: patient.id,
              visitId: visit.id,
              doctorId: existingSerial.doctorId,
              checkInTime: checkInDateObj,
              gender: patient.gender,
              feeAmount: 0,
              paidAmount: 0,
              dueAmount: 0,
              paymentStatus: "PENDING",
              notes: notes || existingSerial.notes || undefined,
              performerId,
            },
            include: { patient: true, doctor: true, therapySlot: true, room: true },
          });
        }

        emitRealtimeEvent("CONSULTATION_SERIAL_BOOKED", {
          serialId: updatedSerial.id,
          serialNumber: updatedSerial.serialNumber,
          patientId: patient.id,
          patientName: patient.name,
          doctorId: updatedSerial.doctorId,
          doctorName: updatedSerial.doctor?.name,
          feeAmount: updatedSerial.feeAmount,
          status: "FORWARDED_TO_CASHIER",
          roomNumber: waitingRoom.number,
          notes: updatedSerial.notes,
        });
      }
    } else if (existingTherapyAppointment) {
      // Scenario 7: Therapy Slot booked today
      const hasPreviousDue = (patient.totalDue ?? 0) > 0;
      if (hasPreviousDue) {
        // Has outstanding previous due -> Placed in Waiting Room and forwarded to Cashier to clear due!
        stationToSet = "CASHIER_REGISTER";
        stepLogAction = "FORWARDED_TO_CASHIER";
        stepLogDetails = `Checked in for Therapy Slot ${existingTherapyAppointment.therapySlot?.label || "Session"} with previous due of ৳${patient.totalDue} -> Forwarded to Cashier Desk for due clearance (NOT in Therapy Queue yet)`;

        updatedAppointment = await prisma.appointment.update({
          where: { id: existingTherapyAppointment.id },
          data: {
            status: AppointmentStatus.CHECKED_IN,
            currentStation: stationToSet,
            roomId: waitingRoom.id,
            visitId: visit.id,
            checkInTime: checkInDateObj,
            queueType: null, // Awaiting due clearance before entering queue!
            performerId,
            ...(toldTime ? { toldTime } : {}),
            ...(notes ? { notes } : {}),
          },
          include: { patient: true, doctor: true, therapySlot: true, room: true },
        });

        emitRealtimeEvent("THERAPY_FORWARDED_FOR_DUE", {
          appointmentId: existingTherapyAppointment.id,
          patientId: patient.id,
          patientName: patient.name,
          slotLabel: existingTherapyAppointment.therapySlot?.label,
          totalDue: patient.totalDue,
        });
      } else {
        // No previous due -> Directly placed in Therapy Queue!
        stationToSet = "THERAPY_ROOM";
        stepLogAction = "QUEUED_FOR_THERAPY";
        stepLogDetails = `Checked in for Therapy Slot ${existingTherapyAppointment.therapySlot?.label || "Session"} -> Placed in Therapy Queue`;

        updatedAppointment = await prisma.appointment.update({
          where: { id: existingTherapyAppointment.id },
          data: {
            status: AppointmentStatus.CHECKED_IN,
            currentStation: stationToSet,
            roomId: waitingRoom.id,
            queueType: QueueType.THERAPY,
            visitId: visit.id,
            checkInTime: checkInDateObj,
            performerId,
            ...(toldTime ? { toldTime } : {}),
            ...(notes ? { notes } : {}),
          },
          include: { patient: true, doctor: true, therapySlot: true, room: true },
        });

        emitRealtimeEvent("PATIENT_QUEUED_FOR_THERAPY", {
          appointmentId: existingTherapyAppointment.id,
          patientId: patient.id,
          patientName: patient.name,
          slotLabel: existingTherapyAppointment.therapySlot?.label,
        });
      }
      await syncBillingForAppointment(updatedAppointment.id);
    } else {
      // Scenario C: Walk-In / No Booking -> Placed in Waiting Room (NO queue assigned!)
      stationToSet = "RECEPTIONIST_DESK";
      stepLogAction = "CHECK_IN";
      stepLogDetails = `Walk-in arrival checked in to Waiting Room (${waitingRoom.number}) without queue assignment`;

      const existingWalkIn = await prisma.appointment.findFirst({
        where: {
          patientId: patient.id,
          appointmentDate: { gte: startOfDay, lte: endOfDay },
          status: {
            notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.COMPLETED],
          },
        },
      });

      if (existingWalkIn) {
        updatedAppointment = await prisma.appointment.update({
          where: { id: existingWalkIn.id },
          data: {
            status: AppointmentStatus.CHECKED_IN,
            currentStation: stationToSet,
            roomId: waitingRoom.id,
            visitId: visit.id,
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
            visitId: visit.id,
            appointmentDate: middayToday,
            gender: patient.gender,
            bookingType: BookingType.REGULAR,
            status: AppointmentStatus.CHECKED_IN,
            currentStation: stationToSet,
            roomId: waitingRoom.id,
            checkInTime: checkInDateObj,
            queueId: null,
            queueType: null,
            doctorId: null,
            toldTime: toldTime || undefined,
            notes: notes || undefined,
            bookedById: performerId,
            performerId,
            feeAmount: 0,
            paidAmount: 0,
            dueAmount: 0,
            paymentStatus: "PENDING",
          },
          include: { patient: true, doctor: true, therapySlot: true, room: true },
        });
      }
      await syncBillingForAppointment(updatedAppointment.id);
    }

    // Record step in PatientStepLog
    await prisma.patientStepLog.create({
      data: {
        patientId: patient.id,
        visitId: visit.id,
        step: stepLogAction,
        station: stationToSet,
        roomNumber: waitingRoom.number,
        performerId,
        details: stepLogDetails,
      },
    });

    // Audit Log
    await logAudit({
      userId: sessionData.user.id,
      performerId: performerId || null,
      action: AuditAction.APPOINTMENT_UPDATE,
      entity: "PatientVisit",
      entityId: visit.id,
      status: AuditStatus.SUCCESS,
      details: {
        action: "ARRIVAL_CHECK_IN",
        patientName: patient.name,
        mrn: patient.mrn,
        roomNumber: waitingRoom.number,
        station: stationToSet,
        checkInTime: checkInDateObj.toISOString(),
      },
    });

    // Realtime SSE broadcasts
    emitRealtimeEvent("PATIENT_CHECKED_IN", {
      patientId: patient.id,
      patientName: patient.name,
      roomNumber: waitingRoom.number,
      station: stationToSet,
      checkInTime: checkInDateObj.toISOString(),
    });
    emitRealtimeEvent("STATION_CHANGED", {
      patientId: patient.id,
      patientName: patient.name,
      toStation: stationToSet,
      roomNumber: waitingRoom.number,
    });

    revalidatePath("/receptionist");
    revalidatePath("/cashier");
    revalidatePath("/doctor");
    revalidatePath("/handler");
    revalidatePath("/admin/tracking");

    const timeStr = checkInDateObj.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    const msg = existingSerial
      ? existingSerial.paymentStatus === "PAID" ||
        existingSerial.paymentStatus === "DUE" ||
        Boolean(existingSerial.invoiceId)
        ? `Patient "${patient.name}" (${patient.mrn || "No MRN"}) checked in at ${timeStr}. Consultation Serial #${existingSerial.serialNumber} is billed and placed in Doctor Consultation Queue.`
        : `Patient "${patient.name}" (${patient.mrn || "No MRN"}) checked in at ${timeStr}. Consultation Serial #${existingSerial.serialNumber} forwarded to Cashier Desk for payment.`
      : existingTherapyAppointment
        ? `Patient "${patient.name}" (${patient.mrn || "No MRN"}) checked in at ${timeStr} and placed in Therapy Queue.`
        : `Patient "${patient.name}" (${patient.mrn || "No MRN"}) checked in to Waiting Room (${waitingRoom.number}) at ${timeStr} without queue assignment.`;

    return {
      success: true,
      message: msg,
      appointment: updatedAppointment,
      consultationSerial: updatedSerial,
      visit,
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
 * Books a Consultation Serial for a patient with a selected doctor.
 * The receptionist can freely edit or override the doctor's default fee.
 * Forwards the patient to the Cashier Desk to issue an invoice before doctor queue placement.
 */
export async function bookConsultationSerialAction(
  data: BookConsultationSerialInput,
): Promise<{ success: boolean; message: string; serial?: any }> {
  try {
    const sessionData = await requireAuth([
      Role.RECEPTIONIST,
      Role.ADMIN,
      Role.DOCTOR,
      Role.CASHIER,
    ]);

    const validation = bookConsultationSerialSchema.safeParse(data);
    if (!validation.success) {
      const errs = Object.values(validation.error.flatten().fieldErrors).flat();
      return { success: false, message: String(errs[0] || "Invalid booking data.") };
    }

    const {
      patientId,
      visitId,
      doctorId,
      feeAmount,
      toldTime,
      performerId,
      pin,
      notes,
    } = validation.data;

    // Verify receptionist performer & PIN
    const isExemptRole =
      sessionData.user.role === Role.ADMIN ||
      sessionData.user.role === Role.DOCTOR;

    if (!isExemptRole) {
      const pinRes = await verifyPerformerPin(performerId, pin);
      if (!pinRes.valid) {
        return { success: false, message: pinRes.error || "Invalid 4-digit staff PIN." };
      }
    }

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
    });
    if (!patient) {
      return { success: false, message: "Patient not found." };
    }

    const doctor = await prisma.user.findFirst({
      where: { id: doctorId, role: Role.DOCTOR },
    });
    if (!doctor) {
      return { success: false, message: "Selected doctor was not found." };
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

    // Get current serial count for this doctor today
    const existingCount = await prisma.consultationSerial.count({
      where: {
        doctorId,
        appointmentDate: { gte: startOfDay, lte: endOfDay },
      },
    });
    const serialNumber = existingCount + 1;

    // Find or link active PatientVisit
    let activeVisitId = visitId;
    if (!activeVisitId) {
      const activeVisit = await prisma.patientVisit.findFirst({
        where: {
          patientId,
          visitDate: { gte: startOfDay, lte: endOfDay },
          status: { not: "CHECKED_OUT" },
        },
        orderBy: { checkInTime: "desc" },
      });
      activeVisitId = activeVisit?.id || null;
    }

    const waitingRoom = await getPublicWaitingRoom();

    // Create ConsultationSerial (status: FORWARDED_TO_CASHIER)
    const serial = await prisma.consultationSerial.create({
      data: {
        serialNumber,
        appointmentDate: now,
        doctorId,
        patientId,
        visitId: activeVisitId || undefined,
        feeAmount: Math.max(0, feeAmount),
        paidAmount: 0,
        dueAmount: Math.max(0, feeAmount),
        paymentStatus: "PENDING",
        status: "FORWARDED_TO_CASHIER",
        toldTime: toldTime || undefined,
        bookedById: performerId,
        notes: notes || undefined,
      },
      include: {
        doctor: { select: { id: true, name: true, consultationFee: true } },
        patient: true,
      },
    });

    // Sync the patient's active today Appointment (if checked in) so station, doctorId, toldTime, and notes reflect the consultation serial booking
    const existingApt = await prisma.appointment.findFirst({
      where: {
        patientId,
        appointmentDate: { gte: startOfDay, lte: endOfDay },
        status: {
          notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.COMPLETED],
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (existingApt) {
      await prisma.appointment.update({
        where: { id: existingApt.id },
        data: {
          currentStation: "CASHIER_REGISTER",
          doctorId: existingApt.doctorId || doctorId,
          toldTime: toldTime || existingApt.toldTime || undefined,
          notes: notes
            ? existingApt.notes && existingApt.notes !== notes
              ? `${existingApt.notes} | ${notes}`
              : notes
            : existingApt.notes,
        },
      });
    }

    // Record step in PatientStepLog
    if (activeVisitId) {
      await prisma.patientStepLog.create({
        data: {
          patientId,
          visitId: activeVisitId,
          step: "FORWARDED_TO_CASHIER",
          station: "CASHIER_REGISTER",
          roomNumber: waitingRoom.number,
          doctorId,
          performerId,
          details: `Booked Consultation Serial #${serialNumber} with Dr. ${doctor.name || "Doctor"} (Fee: ৳${feeAmount}) -> Forwarded to Cashier Desk`,
        },
      });
    }

    // Broadcast realtime event
    emitRealtimeEvent("CONSULTATION_SERIAL_BOOKED", {
      serialId: serial.id,
      serialNumber: serial.serialNumber,
      patientId: patient.id,
      patientName: patient.name,
      doctorId: doctor.id,
      doctorName: doctor.name,
      feeAmount: serial.feeAmount,
      status: "FORWARDED_TO_CASHIER",
      roomNumber: waitingRoom.number,
    });
    emitRealtimeEvent("STATION_CHANGED", {
      patientId: patient.id,
      patientName: patient.name,
      toStation: "CASHIER_REGISTER",
      roomNumber: waitingRoom.number,
    });

    revalidatePath("/receptionist");
    revalidatePath("/cashier");
    revalidatePath("/doctor");
    revalidatePath("/admin/tracking");

    return {
      success: true,
      message: `Consultation Serial #${serialNumber} booked with Dr. ${doctor.name || "Doctor"} (৳${feeAmount}). Forwarded to Cashier Desk.`,
      serial,
    };
  } catch (error) {
    console.error("[Book Consultation Serial Error]:", error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to book consultation serial.",
    };
  }
}

/**
 * Checks out a patient from their active visit episode.
 * ENFORCES STRICT BILLING CLEARANCE:
 * Blocks checkout if the patient has any unbilled therapy session or consultation serial.
 */
export async function checkoutPatientVisitAction(
  data: CheckoutPatientVisitInput,
): Promise<{ success: boolean; message: string }> {
  try {
    const sessionData = await requireAuth([
      Role.RECEPTIONIST,
      Role.ADMIN,
      Role.CASHIER,
    ]);

    const validation = checkoutPatientVisitSchema.safeParse(data);
    if (!validation.success) {
      const errs = Object.values(validation.error.flatten().fieldErrors).flat();
      return { success: false, message: String(errs[0] || "Invalid checkout data.") };
    }

    const { patientId, visitId, performerId, pin, notes } = validation.data;

    const isExemptRole = sessionData.user.role === Role.ADMIN;
    if (!isExemptRole) {
      const pinRes = await verifyPerformerPin(performerId, pin);
      if (!pinRes.valid) {
        return { success: false, message: pinRes.error || "Invalid 4-digit staff PIN." };
      }
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

    // 1. BILLING CLEARANCE GUARD: Check for unbilled therapy sessions today
    const unbilledTherapy = await prisma.appointment.findFirst({
      where: {
        patientId,
        appointmentDate: { gte: startOfDay, lte: endOfDay },
        type: AppointmentType.THERAPY,
        therapySlotId: { not: null },
        status: { notIn: [AppointmentStatus.CANCELLED] },
        paymentStatus: { notIn: ["PAID", "DUE"] },
      },
      include: { therapySlot: true },
    });

    if (unbilledTherapy) {
      return {
        success: false,
        message: `Cannot Checkout: Patient has an unbilled therapy session (${unbilledTherapy.therapySlot?.label || "Session"}). Please forward patient to Cashier to collect fee or mark as Due first.`,
      };
    }

    // 2. BILLING CLEARANCE GUARD: Check for unbilled consultation serials today
    const unbilledConsultation = await prisma.consultationSerial.findFirst({
      where: {
        patientId,
        appointmentDate: { gte: startOfDay, lte: endOfDay },
        status: { notIn: ["CANCELLED"] },
        paymentStatus: { notIn: ["PAID", "DUE"] },
      },
      include: { doctor: true },
    });

    if (unbilledConsultation) {
      return {
        success: false,
        message: `Cannot Checkout: Patient has an unbilled consultation serial (#${unbilledConsultation.serialNumber} with Dr. ${unbilledConsultation.doctor?.name || "Doctor"}). Please forward to Cashier first.`,
      };
    }

    // 3. Find active PatientVisit
    let visit = null;
    if (visitId) {
      visit = await prisma.patientVisit.findUnique({ where: { id: visitId } });
    }
    if (!visit) {
      visit = await prisma.patientVisit.findFirst({
        where: {
          patientId,
          visitDate: { gte: startOfDay, lte: endOfDay },
          status: { not: "CHECKED_OUT" },
        },
        orderBy: { checkInTime: "desc" },
      });
    }

    if (visit) {
      await prisma.patientVisit.update({
        where: { id: visit.id },
        data: {
          status: "CHECKED_OUT",
          checkOutTime: now,
          checkOutPerformerId: performerId,
          notes: notes ? (visit.notes ? `${visit.notes} | ${notes}` : notes) : visit.notes,
        },
      });

      // Record step in PatientStepLog
      await prisma.patientStepLog.create({
        data: {
          patientId,
          visitId: visit.id,
          step: "CHECK_OUT",
          station: "CHECKED_OUT",
          performerId,
          details: `Completed Visit #${visit.visitNumber} and checked out`,
        },
      });
    }

    // Ensure all remaining active visits for today are cleanly marked CHECKED_OUT
    await prisma.patientVisit.updateMany({
      where: {
        patientId,
        visitDate: { gte: startOfDay, lte: endOfDay },
        status: { not: "CHECKED_OUT" },
      },
      data: {
        status: "CHECKED_OUT",
        checkOutTime: now,
        checkOutPerformerId: performerId,
        notes: notes || undefined,
      },
    });

    // Update today's active appointments to COMPLETED / CHECKED_OUT
    await prisma.appointment.updateMany({
      where: {
        patientId,
        appointmentDate: { gte: startOfDay, lte: endOfDay },
        status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.COMPLETED] },
      },
      data: {
        status: AppointmentStatus.COMPLETED,
        currentStation: "CHECKED_OUT",
        checkOutTime: now,
      },
    });

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { name: true, mrn: true },
    });

    emitRealtimeEvent("PATIENT_CHECKED_OUT", {
      patientId,
      patientName: patient?.name || "Patient",
      checkOutTime: now.toISOString(),
      station: "CHECKED_OUT",
    });
    emitRealtimeEvent("STATION_CHANGED", {
      patientId,
      patientName: patient?.name || "Patient",
      toStation: "CHECKED_OUT",
    });

    revalidatePath("/receptionist");
    revalidatePath("/cashier");
    revalidatePath("/doctor");
    revalidatePath("/handler");
    revalidatePath("/admin/tracking");

    return {
      success: true,
      message: `Patient "${patient?.name || "Patient"}" checked out successfully at ${now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}.`,
    };
  } catch (error) {
    console.error("[Checkout Patient Visit Error]:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to checkout patient.",
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
              { email: { contains: q } },
              { emergencyPhone: { contains: q } },
            ],
          }
        : undefined,
      include: {
        visits: {
          where: {
            visitDate: { gte: startOfDay, lte: endOfDay },
          },
          orderBy: { checkInTime: "desc" },
          take: 1,
        },
        consultationSerials: {
          where: {
            appointmentDate: { gte: startOfDay, lte: endOfDay },
            status: { not: "CANCELLED" },
          },
          include: {
            doctor: { select: { id: true, name: true, consultationFee: true } },
            invoice: true,
          },
          orderBy: { serialNumber: "desc" },
          take: 1,
        },
        appointments: {
          where: {
            appointmentDate: { gte: startOfDay, lte: endOfDay },
            status: { not: AppointmentStatus.CANCELLED },
          },
          include: {
            doctor: { select: { id: true, name: true, consultationFee: true } },
            therapySlot: { select: { id: true, label: true, startTime: true, endTime: true } },
            room: true,
            invoice: true,
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
      const todaySerial = p.consultationSerials[0] || null;
      const activeVisit = p.visits[0] || null;

      // Evaluate Therapy checkout clearance
      const hasUnbilledTherapy = todayAppointment &&
        todayAppointment.type === AppointmentType.THERAPY &&
        todayAppointment.therapySlotId &&
        todayAppointment.paymentStatus !== "PAID" &&
        todayAppointment.paymentStatus !== "DUE";

      // Evaluate Consultation checkout clearance
      const hasUnbilledConsultation = todaySerial &&
        todaySerial.paymentStatus !== "PAID" &&
        todaySerial.paymentStatus !== "DUE";

      const canCheckout = !hasUnbilledTherapy && !hasUnbilledConsultation;
      const unbilledReason = hasUnbilledTherapy
        ? "Pending Therapy Billing at Cashier"
        : hasUnbilledConsultation
          ? "Pending Consultation Billing at Cashier"
          : null;

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
        activeVisit: activeVisit
          ? {
              id: activeVisit.id,
              visitNumber: activeVisit.visitNumber,
              checkInTime: activeVisit.checkInTime,
              checkOutTime: activeVisit.checkOutTime,
              status: activeVisit.status,
            }
          : null,
        canCheckout,
        unbilledReason,
        consultationSerial: todaySerial
          ? {
              id: todaySerial.id,
              serialNumber: todaySerial.serialNumber,
              doctorName: todaySerial.doctor?.name || null,
              doctorId: todaySerial.doctorId,
              feeAmount: todaySerial.feeAmount,
              paidAmount: todaySerial.paidAmount,
              dueAmount: todaySerial.dueAmount,
              paymentStatus: todaySerial.paymentStatus,
              status: todaySerial.status,
              toldTime: todaySerial.toldTime,
              invoiceNumber: todaySerial.invoice?.invoiceNumber || null,
            }
          : null,
        todayAppointment: todayAppointment
          ? {
              id: todayAppointment.id,
              status: todayAppointment.status,
              queueType: todayAppointment.queueType,
              currentStation: todayAppointment.currentStation,
              checkInTime: todayAppointment.checkInTime,
              checkOutTime: todayAppointment.checkOutTime,
              toldTime: todayAppointment.toldTime || todaySerial?.toldTime || null,
              feeAmount:
                !todayAppointment.therapySlotId && todaySerial
                  ? todaySerial.feeAmount
                  : todayAppointment.feeAmount,
              paidAmount:
                !todayAppointment.therapySlotId && todaySerial
                  ? todaySerial.paidAmount
                  : todayAppointment.paidAmount,
              dueAmount:
                !todayAppointment.therapySlotId && todaySerial
                  ? todaySerial.dueAmount
                  : todayAppointment.dueAmount,
              paymentStatus:
                !todayAppointment.therapySlotId && todaySerial
                  ? todaySerial.paymentStatus
                  : todayAppointment.paymentStatus,
              doctorName:
                todayAppointment.doctor?.name || todaySerial?.doctor?.name || null,
              slotLabel: todayAppointment.therapySlot?.label || null,
              roomId: todayAppointment.roomId || null,
              roomNumber: todayAppointment.room?.number || null,
              roomPurpose: todayAppointment.room?.purpose || null,
              invoiceNumber:
                todayAppointment.invoice?.invoiceNumber ||
                todaySerial?.invoice?.invoiceNumber ||
                null,
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
 * Loads all patients who arrived / checked in today and are currently active (not checked out).
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
          ],
          notIn: [AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED],
        },
        currentStation: { not: "CHECKED_OUT" },
      },
      include: {
        patient: {
          include: {
            visits: {
              where: {
                visitDate: { gte: startOfDay, lte: endOfDay },
                status: { not: "CHECKED_OUT" },
              },
              orderBy: { checkInTime: "desc" },
              take: 1,
            },
            consultationSerials: {
              where: {
                appointmentDate: { gte: startOfDay, lte: endOfDay },
                status: { not: "CANCELLED" },
              },
              include: {
                doctor: { select: { id: true, name: true, consultationFee: true } },
                invoice: true,
              },
              orderBy: { serialNumber: "desc" },
              take: 1,
            },
          },
        },
        room: true,
        invoice: true,
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

/**
 * Cancels a Doctor Consultation Serial with 4-digit PIN verification and audit logging.
 */
export async function cancelConsultationSerialAction(params: {
  serialId: string;
  performerId?: string;
  pin?: string;
  reason?: string;
}): Promise<{ success: boolean; message: string }> {
  try {
    const sessionData = await requireAuth([
      Role.RECEPTIONIST,
      Role.ADMIN,
      Role.DOCTOR,
      Role.CASHIER,
    ]);

    const isExemptRole =
      sessionData.user.role === Role.DOCTOR ||
      sessionData.user.role === Role.ADMIN;

    if (!isExemptRole && params.performerId) {
      const pinRes = await verifyPerformerPin(params.performerId, params.pin);
      if (!pinRes.valid) {
        return {
          success: false,
          message: pinRes.error || "Invalid 4-digit receptionist security PIN.",
        };
      }
    }

    const serial = await prisma.consultationSerial.findUnique({
      where: { id: params.serialId },
      include: { patient: true, doctor: true },
    });

    if (!serial) {
      return { success: false, message: "Consultation serial record not found." };
    }

    if (serial.status === "COMPLETED") {
      return {
        success: false,
        message: "Cannot cancel a consultation serial that has already been completed.",
      };
    }

    await prisma.consultationSerial.update({
      where: { id: params.serialId },
      data: {
        status: "CANCELLED",
        notes: params.reason
          ? `${serial.notes || ""} | Cancelled: ${params.reason}`.trim()
          : serial.notes,
      },
    });

    // If an unpaid/due invoice was generated for this serial, void it so patient.totalDue does not retain the fee
    if (serial.invoiceId) {
      const inv = await prisma.patientInvoice.findUnique({
        where: { id: serial.invoiceId },
      });
      if (inv && inv.paidAmount === 0) {
        await prisma.patientInvoice.update({
          where: { id: inv.id },
          data: {
            status: "CANCELLED",
            totalAmount: 0,
            dueAmount: 0,
            notes: params.reason
              ? `Cancelled: ${params.reason}`
              : "Cancelled along with Consultation Serial",
          },
        });
      }
    }

    // Re-sync patient totalDue
    await syncBillingForPatient(serial.patientId);

    await logAudit({
      userId: sessionData.user.id,
      performerId: params.performerId || null,
      action: AuditAction.APPOINTMENT_CANCEL,
      entity: "ConsultationSerial",
      entityId: serial.id,
      status: AuditStatus.SUCCESS,
      details: {
        serialNumber: serial.serialNumber,
        patientName: serial.patient.name,
        doctorName: serial.doctor?.name,
        reason: params.reason || "Cancelled by receptionist",
      },
    });

    emitRealtimeEvent("CONSULTATION_SERIAL_CANCELLED", {
      serialId: serial.id,
      serialNumber: serial.serialNumber,
      patientId: serial.patientId,
    });

    revalidatePath("/receptionist");
    revalidatePath("/cashier");
    revalidatePath("/doctor");
    revalidatePath("/admin/tracking");

    return {
      success: true,
      message: `Consultation Serial #${serial.serialNumber} for ${serial.patient.name} has been cancelled.`,
    };
  } catch (error) {
    console.error("[Cancel Consultation Serial Error]:", error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to cancel consultation serial.",
    };
  }
}

