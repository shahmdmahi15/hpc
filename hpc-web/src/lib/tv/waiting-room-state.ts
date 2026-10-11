import "server-only";
import prisma from "@/lib/prisma";
import {
  AppointmentStatus,
  QueueType,
  Role,
  RoomStatus,
} from "@/generated/prisma/enums";
import { CLINIC_CONFIG } from "@/lib/clinic-config";
import { recalculateTimer } from "@/lib/therapy-timer-utils";

export interface WaitingRoomCallAnnouncement {
  appointmentId: string;
  serialNumber?: number;
  patientName: string;
  patientMrn?: string | null;
  gender?: string;
  roomNumber: string;
  roomPurpose: string;
  station: string;
  calledAt: string;
  sound: "chime";
  voiceBn: string;
  voiceEn: string;
}

export interface DoctorChamberQueue {
  doctorId: string;
  doctorName: string;
  roomNumber: string;
  roomPurpose: string;
  currentlyServing: {
    appointmentId?: string;
    serialNumber?: number;
    patientName: string;
    status: string;
    startedAt?: string | null;
  } | null;
  waitingCount: number;
  waitingSerials: Array<{
    appointmentId?: string;
    serialNumber?: number;
    patientName: string;
    checkInTime?: string | null;
    toldTime?: string | null;
  }>;
}

export interface TherapyRoomState {
  roomId: string;
  roomNumber: string;
  purpose: string;
  status: RoomStatus;
  currentPatient: {
    appointmentId: string;
    serialNumber?: number;
    patientName: string;
    startedAt?: string | null;
  } | null;
  timer: {
    isRunning: boolean;
    currentStepIndex: number;
    remainingSeconds: number;
    totalSeconds: number;
    modalityName: string;
    isAllCompleted: boolean;
  } | null;
}

export interface WaitingRoomSnapshot {
  clinic: {
    name: string;
    nameBangla: string;
    branch: string;
    addressBangla: string;
    phone: string;
    hotline: string;
    logoUrl: string;
    serverTime: string;
  };
  activeCalls: WaitingRoomCallAnnouncement[];
  consultationQueue: {
    doctors: DoctorChamberQueue[];
    currentlyServing: Array<{
      doctorId: string;
      doctorName: string;
      roomNumber: string;
      serialNumber?: number;
      patientName: string;
    }>;
    waitingQueue: Array<{
      appointmentId: string;
      serialNumber?: number;
      patientName: string;
      doctorName?: string | null;
      checkInTime?: string | null;
    }>;
    totalWaiting: number;
  };
  therapyQueue: {
    rooms: TherapyRoomState[];
    activeTherapyCount: number;
    waitingTherapyCount: number;
    estimatedWaitMinutes: number;
    waitingQueue: Array<{
      appointmentId: string;
      serialNumber?: number;
      patientName: string;
      checkInTime?: string | null;
      toldTime?: string | null;
    }>;
  };
  bulletinNotices: Array<{
    id: string;
    title: string | null;
    message: string;
    priority: string;
    targetAudience: string;
    createdAt: string;
  }>;
  telemetry: {
    version: string;
    mode: string;
    sseStreamUrl: string;
    serverTimestamp: number;
  };
}

export function formatNumberBn(num: number | string | null | undefined): string {
  if (num === null || num === undefined) return "";
  const bnDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return String(num).replace(/[0-9]/g, (d) => bnDigits[Number(d)]);
}

export function generateDoctorCallVoices(
  patientName: string,
  roomNumber: string,
  serialNumber?: number,
): { voiceEn: string; voiceBn: string } {
  const tokenStr = serialNumber != null ? `Token ${serialNumber}. ` : "";
  const tokenStrBn =
    serialNumber != null ? `টোকেন নম্বর ${formatNumberBn(serialNumber)}। ` : "";
  const bnRoom = formatNumberBn(roomNumber);
  const voiceEn = `Attention please. ${tokenStr}Patient ${patientName}. Please proceed to Room ${roomNumber}.`;
  const voiceBn = `দয়া করে মনোযোগ দিন। ${tokenStrBn}রোগী ${patientName}, রুম নম্বর ${bnRoom}-এ আসুন।`;
  return { voiceEn, voiceBn };
}

/**
 * Builds the full waiting room snapshot for Android TV and live queue displays.
 */
export async function getWaitingRoomSnapshot(): Promise<WaitingRoomSnapshot> {
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

  // 1. Fetch checked-in and active appointments for today
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
      },
    },
    include: {
      patient: {
        select: {
          id: true,
          name: true,
          mrn: true,
          gender: true,
        },
      },
      room: true,
      therapySlot: {
        include: {
          room: true,
        },
      },
      doctor: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: [{ checkInTime: "asc" }, { createdAt: "asc" }],
  });

  // Calculate serial numbers based on today's arrival order
  const serialMap = new Map<string, number>();
  let serialCounter = 1;
  for (const apt of appointments) {
    serialMap.set(apt.id, serialCounter++);
  }

  // 2. Fetch today's ConsultationSerial entries
  const consultationSerials = await prisma.consultationSerial.findMany({
    where: {
      appointmentDate: { gte: startOfDay, lte: endOfDay },
      status: {
        in: ["QUEUED", "CALLING", "IN_CONSULTATION"],
      },
    },
    include: {
      patient: {
        select: {
          id: true,
          name: true,
          mrn: true,
          gender: true,
        },
      },
      doctor: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { serialNumber: "asc" },
  });

  // 3. Fetch Doctors and their designated rooms
  const doctors = await prisma.user.findMany({
    where: { role: Role.DOCTOR },
    select: {
      id: true,
      name: true,
      email: true,
      consultationRoomId: true,
      consultationRoom: {
        select: {
          id: true,
          number: true,
          purpose: true,
          status: true,
        },
      },
    },
  });

  // 4. Fetch Therapy Rooms and active Bed Timers
  const therapyRooms = await prisma.room.findMany({
    where: {
      OR: [
        { accessType: "THERAPY" },
        {
          number: {
            in: [
              "201",
              "202",
              "203",
              "204",
              "205",
              "206",
              "207",
              "208",
              "209",
              "210",
              "211",
              "212",
              "213",
              "214",
              "215",
            ],
          },
        },
      ],
    },
    orderBy: { number: "asc" },
  });

  const sessionTimers = await prisma.therapySessionTimer.findMany();
  const timerByAppointmentId = new Map<string, any>();
  const timerByRoomNumber = new Map<string, any>();
  for (const t of sessionTimers) {
    if (t.appointmentId) {
      timerByAppointmentId.set(t.appointmentId, t);
    }
    if (t.roomNumber) {
      timerByRoomNumber.set(t.roomNumber, t);
    }
  }

  // 5. Fetch Active Bulletin Notices for Waiting Room
  const bulletinNotices = await prisma.bulletinNotice.findMany({
    where: {
      isActive: true,
      targetAudience: { in: ["ALL", "WAITING_ROOM"] },
      OR: [{ startDate: null }, { startDate: { lte: now } }],
      AND: [
        {
          OR: [{ endDate: null }, { endDate: { gte: now } }],
        },
      ],
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    take: 15,
  });

  // --------------------------------------------------------------------------
  // Process Active Calling list (CALLING appointments & serials)
  // --------------------------------------------------------------------------
  const activeCalls: WaitingRoomCallAnnouncement[] = [];

  for (const apt of appointments) {
    if (apt.status === AppointmentStatus.CALLING) {
      const serialNum = serialMap.get(apt.id);
      const roomNum =
        apt.room?.number || apt.therapySlot?.room?.number || "Chamber";
      const roomPurp =
        apt.room?.purpose ||
        (apt.queueType === QueueType.THERAPY
          ? "Physical Therapy"
          : "Doctor Consultation");
      const station =
        apt.currentStation ||
        (apt.queueType === QueueType.THERAPY
          ? "THERAPY_ROOM"
          : "CONSULTATION_ROOM");
      const voices = generateDoctorCallVoices(
        apt.patient.name,
        roomNum,
        serialNum,
      );

      activeCalls.push({
        appointmentId: apt.id,
        serialNumber: serialNum,
        patientName: apt.patient.name,
        patientMrn: apt.patient.mrn,
        gender: apt.patient.gender,
        roomNumber: roomNum,
        roomPurpose: roomPurp,
        station,
        calledAt: apt.updatedAt.toISOString(),
        sound: "chime",
        voiceBn: voices.voiceBn,
        voiceEn: voices.voiceEn,
      });
    }
  }

  // Add any active calling consultation serials not already in list
  for (const cs of consultationSerials) {
    if (cs.status === "CALLING") {
      const alreadyAdded = activeCalls.some(
        (c) => c.serialNumber === cs.serialNumber,
      );
      if (!alreadyAdded) {
        const docObj = doctors.find((d) => d.id === cs.doctorId);
        const roomNum = docObj?.consultationRoom?.number || "Chamber";
        const voices = generateDoctorCallVoices(
          cs.patient.name,
          roomNum,
          cs.serialNumber,
        );
        activeCalls.push({
          appointmentId: cs.id,
          serialNumber: cs.serialNumber,
          patientName: cs.patient.name,
          patientMrn: cs.patient.mrn,
          gender: cs.patient.gender,
          roomNumber: roomNum,
          roomPurpose: docObj?.consultationRoom?.purpose || "Doctor Consultation",
          station: "CONSULTATION_ROOM",
          calledAt: cs.updatedAt.toISOString(),
          sound: "chime",
          voiceBn: voices.voiceBn,
          voiceEn: voices.voiceEn,
        });
      }
    }
  }

  // --------------------------------------------------------------------------
  // Process Consultation Queue per Doctor
  // --------------------------------------------------------------------------
  const doctorQueues: DoctorChamberQueue[] = [];
  const currentlyServingConsultation: Array<{
    doctorId: string;
    doctorName: string;
    roomNumber: string;
    serialNumber?: number;
    patientName: string;
  }> = [];

  const waitingConsultationQueue: Array<{
    appointmentId: string;
    serialNumber?: number;
    patientName: string;
    doctorName?: string | null;
    checkInTime?: string | null;
  }> = [];

  for (const doc of doctors) {
    const docRoomNumber = doc.consultationRoom?.number || "Chamber";
    const docRoomPurpose =
      doc.consultationRoom?.purpose || "Doctor Consultation";

    // 1. Currently Serving patient for this doctor
    let servingPatient: DoctorChamberQueue["currentlyServing"] = null;

    // Check appointment
    const servingApt = appointments.find(
      (a) =>
        a.doctorId === doc.id &&
        (a.status === AppointmentStatus.IN_CONSULTATION ||
          a.status === AppointmentStatus.CALLING),
    );

    if (servingApt) {
      servingPatient = {
        appointmentId: servingApt.id,
        serialNumber: serialMap.get(servingApt.id),
        patientName: servingApt.patient.name,
        status: servingApt.status,
        startedAt:
          servingApt.inConsultationTime?.toISOString() ||
          servingApt.updatedAt.toISOString(),
      };
    } else {
      // Check ConsultationSerial
      const servingCs = consultationSerials.find(
        (cs) =>
          cs.doctorId === doc.id &&
          (cs.status === "IN_CONSULTATION" || cs.status === "CALLING"),
      );
      if (servingCs) {
        servingPatient = {
          appointmentId: servingCs.id,
          serialNumber: servingCs.serialNumber,
          patientName: servingCs.patient.name,
          status: servingCs.status,
          startedAt:
            servingCs.inConsultationTime?.toISOString() ||
            servingCs.updatedAt.toISOString(),
        };
      }
    }

    if (servingPatient) {
      currentlyServingConsultation.push({
        doctorId: doc.id,
        doctorName: doc.name || "Doctor",
        roomNumber: docRoomNumber,
        serialNumber: servingPatient.serialNumber,
        patientName: servingPatient.patientName,
      });
    }

    // 2. Waiting patients for this doctor
    const waitingForDoc: DoctorChamberQueue["waitingSerials"] = [];

    // Checked-in appointments
    for (const apt of appointments) {
      if (
        apt.doctorId === doc.id &&
        apt.queueType === QueueType.CONSULTATION &&
        apt.status === AppointmentStatus.CHECKED_IN
      ) {
        const item = {
          appointmentId: apt.id,
          serialNumber: serialMap.get(apt.id),
          patientName: apt.patient.name,
          checkInTime: apt.checkInTime?.toISOString() || null,
          toldTime: apt.toldTime || null,
        };
        waitingForDoc.push(item);
        waitingConsultationQueue.push({
          appointmentId: apt.id,
          serialNumber: item.serialNumber,
          patientName: apt.patient.name,
          doctorName: doc.name,
          checkInTime: item.checkInTime,
        });
      }
    }

    // Unmatched queued consultation serials
    for (const cs of consultationSerials) {
      if (cs.doctorId === doc.id && cs.status === "QUEUED") {
        const alreadyListed = waitingForDoc.some(
          (w) => w.serialNumber === cs.serialNumber,
        );
        if (!alreadyListed) {
          const item = {
            appointmentId: cs.id,
            serialNumber: cs.serialNumber,
            patientName: cs.patient.name,
            checkInTime: cs.createdAt.toISOString(),
            toldTime: cs.toldTime || null,
          };
          waitingForDoc.push(item);
          waitingConsultationQueue.push({
            appointmentId: cs.id,
            serialNumber: cs.serialNumber,
            patientName: cs.patient.name,
            doctorName: doc.name,
            checkInTime: item.checkInTime,
          });
        }
      }
    }

    doctorQueues.push({
      doctorId: doc.id,
      doctorName: doc.name || "Doctor",
      roomNumber: docRoomNumber,
      roomPurpose: docRoomPurpose,
      currentlyServing: servingPatient,
      waitingCount: waitingForDoc.length,
      waitingSerials: waitingForDoc,
    });
  }

  // --------------------------------------------------------------------------
  // Process Therapy Queue & Bed Statuses (Rooms 201-207/215)
  // --------------------------------------------------------------------------
  const therapyRoomStates: TherapyRoomState[] = [];
  let activeTherapyCount = 0;

  for (const room of therapyRooms) {
    // Find active patient in therapy or calling in this room
    const activeApt = appointments.find(
      (a) =>
        (a.roomId === room.id || a.room?.number === room.number) &&
        (a.status === AppointmentStatus.IN_THERAPY ||
          a.status === AppointmentStatus.CALLING),
    );

    let currentPatient: TherapyRoomState["currentPatient"] = null;
    let timerState: TherapyRoomState["timer"] = null;

    if (activeApt) {
      activeTherapyCount++;
      currentPatient = {
        appointmentId: activeApt.id,
        serialNumber: serialMap.get(activeApt.id),
        patientName: activeApt.patient.name,
        startedAt:
          activeApt.inTherapyTime?.toISOString() ||
          activeApt.updatedAt.toISOString(),
      };
    }

    // Resolve timer
    const rawTimer =
      (activeApt ? timerByAppointmentId.get(activeApt.id) : null) ||
      timerByRoomNumber.get(room.number);

    if (rawTimer) {
      const rec = recalculateTimer(rawTimer);
      const curModality = rec.modalities[rec.currentStepIndex];
      timerState = {
        isRunning: rec.isRunning,
        currentStepIndex: rec.currentStepIndex,
        remainingSeconds: curModality?.remainingSeconds ?? 0,
        totalSeconds: curModality?.totalSeconds ?? 900,
        modalityName: curModality?.name || "Physical Therapy",
        isAllCompleted: rec.isAllCompleted,
      };
    }

    therapyRoomStates.push({
      roomId: room.id,
      roomNumber: room.number,
      purpose: room.purpose,
      status: activeApt ? RoomStatus.OCCUPIED : room.status,
      currentPatient,
      timer: timerState,
    });
  }

  // Waiting patients for therapy
  const waitingTherapyQueue: Array<{
    appointmentId: string;
    serialNumber?: number;
    patientName: string;
    checkInTime?: string | null;
    toldTime?: string | null;
  }> = [];

  for (const apt of appointments) {
    if (
      apt.queueType === QueueType.THERAPY &&
      apt.status === AppointmentStatus.CHECKED_IN
    ) {
      waitingTherapyQueue.push({
        appointmentId: apt.id,
        serialNumber: serialMap.get(apt.id),
        patientName: apt.patient.name,
        checkInTime: apt.checkInTime?.toISOString() || null,
        toldTime: apt.toldTime || null,
      });
    }
  }

  // Calculate estimated waiting time for therapy
  const availableTherapyRooms = Math.max(
    1,
    therapyRooms.filter((r) => r.accessType === "THERAPY").length,
  );
  const waitingTherapyCount = waitingTherapyQueue.length;
  // Average therapy session ~15 minutes per batch
  const estimatedWaitMinutes = Math.ceil(
    (waitingTherapyCount / availableTherapyRooms) * 15,
  );

  return {
    clinic: {
      name: CLINIC_CONFIG.name,
      nameBangla: CLINIC_CONFIG.nameBangla,
      branch: CLINIC_CONFIG.addressEnglish,
      addressBangla: CLINIC_CONFIG.addressBangla,
      phone: CLINIC_CONFIG.phone,
      hotline: CLINIC_CONFIG.hotline,
      logoUrl: "/icon.png",
      serverTime: now.toISOString(),
    },
    activeCalls,
    consultationQueue: {
      doctors: doctorQueues,
      currentlyServing: currentlyServingConsultation,
      waitingQueue: waitingConsultationQueue,
      totalWaiting: waitingConsultationQueue.length,
    },
    therapyQueue: {
      rooms: therapyRoomStates,
      activeTherapyCount,
      waitingTherapyCount,
      estimatedWaitMinutes,
      waitingQueue: waitingTherapyQueue,
    },
    bulletinNotices: bulletinNotices.map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      priority: n.priority,
      targetAudience: n.targetAudience,
      createdAt: n.createdAt.toISOString(),
    })),
    telemetry: {
      version: "1.0",
      mode: process.env.NODE_ENV || "production",
      sseStreamUrl: "/api/v1/tv/waiting-room/stream",
      serverTimestamp: now.getTime(),
    },
  };
}
