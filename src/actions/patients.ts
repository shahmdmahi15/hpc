"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth";
import { realtimeBus } from "@/lib/events";
import { Gender, BloodGroup } from "@/generated/prisma/enums";
import { revalidatePath } from "next/cache";

export interface CreatePatientInput {
  patientId: string; // e.g. "1800" or custom
  name: string;
  phone: string;
  email?: string;
  age?: number;
  gender: Gender;
  bloodGroup?: BloodGroup;
  occupation?: string;
  address?: string;
  city?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  primaryCondition?: string;
  allergies?: string;
  medicalHistory?: string;
  currentMedications?: string;
  notes?: string;
}

export async function searchPatients(query: string) {
  const trimmed = query.trim();
  if (!trimmed) {
    return prisma.patient.findMany({
      take: 15,
      orderBy: { createdAt: "desc" },
      include: {
        serials: {
          take: 3,
          orderBy: { date: "desc" },
        },
      },
    });
  }

  return prisma.patient.findMany({
    where: {
      OR: [
        { patientId: { contains: trimmed } },
        { name: { contains: trimmed } },
        { phone: { contains: trimmed } },
        { address: { contains: trimmed } },
      ],
    },
    take: 20,
    orderBy: { createdAt: "desc" },
    include: {
      serials: {
        take: 3,
        orderBy: { date: "desc" },
      },
      packages: {
        where: { status: "ACTIVE" },
      },
    },
  });
}

export async function getRecentRevisitingPatients() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  return prisma.patient.findMany({
    where: {
      OR: [
        {
          createdAt: { gte: sevenDaysAgo },
        },
        {
          updatedAt: { gte: sevenDaysAgo },
        },
        {
          serials: {
            some: {
              date: { gte: sevenDaysAgo },
            },
          },
        },
        {
          packages: {
            some: {
              status: "ACTIVE",
            },
          },
        },
      ],
    },
    take: 20,
    orderBy: { createdAt: "desc" },
    include: {
      serials: {
        take: 1,
        orderBy: { date: "desc" },
      },
      packages: {
        where: { status: "ACTIVE" },
      },
    },
  });
}

export async function getAllPatients(search?: string) {
  const trimmed = search?.trim();
  const where: any = {};
  if (trimmed) {
    where.OR = [
      { patientId: { contains: trimmed } },
      { name: { contains: trimmed } },
      { phone: { contains: trimmed } },
      { address: { contains: trimmed } },
    ];
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  return prisma.patient.findMany({
    where,
    take: 50,
    orderBy: { createdAt: "desc" },
    include: {
      serials: {
        where: {
          date: { gte: todayStart, lte: todayEnd },
        },
        take: 1,
      },
      packages: {
        where: { status: "ACTIVE" },
      },
    },
  });
}

export async function getPatientById(idOrPatientId: string) {
  return prisma.patient.findFirst({
    where: {
      OR: [{ id: idOrPatientId }, { patientId: idOrPatientId }],
    },
    include: {
      serials: {
        orderBy: { date: "desc" },
        include: {
          doctor: { select: { id: true, name: true } },
          handler: { select: { id: true, name: true } },
        },
      },
      assessments: {
        orderBy: { date: "desc" },
        include: {
          doctor: { select: { id: true, name: true } },
        },
      },
      treatmentSessions: {
        orderBy: { date: "desc" },
        include: {
          handler: { select: { id: true, name: true } },
        },
      },
      packages: {
        orderBy: { startDate: "desc" },
      },
      billingRecords: {
        orderBy: { date: "desc" },
        include: {
          cashier: { select: { id: true, name: true } },
          auditedBy: { select: { id: true, name: true } },
        },
      },
    },
  });
}

export async function createPatient(data: CreatePatientInput) {
  const session = await getCurrentSession();

  // Check if patientId already exists
  const existing = await prisma.patient.findUnique({
    where: { patientId: data.patientId.trim() },
  });

  if (existing) {
    return { error: `Patient ID #${data.patientId} is already registered.` };
  }

  const patient = await prisma.patient.create({
    data: {
      patientId: data.patientId.trim(),
      name: data.name.trim(),
      phone: data.phone.trim(),
      email: data.email?.trim() || null,
      age: data.age ? Number(data.age) : null,
      gender: data.gender,
      bloodGroup: data.bloodGroup || null,
      occupation: data.occupation?.trim() || null,
      address: data.address?.trim() || null,
      city: data.city?.trim() || null,
      emergencyContactName: data.emergencyContactName?.trim() || null,
      emergencyContactPhone: data.emergencyContactPhone?.trim() || null,
      emergencyContactRelation: data.emergencyContactRelation?.trim() || null,
      primaryCondition: data.primaryCondition?.trim() || null,
      allergies: data.allergies?.trim() || null,
      medicalHistory: data.medicalHistory?.trim() || null,
      currentMedications: data.currentMedications?.trim() || null,
      notes: data.notes?.trim() || null,
      registeredById: session?.user?.id || null,
    },
  });

  realtimeBus.notify("PATIENT_CREATED", { patientId: patient.patientId });
  revalidatePath("/receptionist");
  revalidatePath("/doctor");
  revalidatePath("/handler");

  return { success: true, patient };
}

export async function updatePatient(
  id: string,
  data: Partial<CreatePatientInput>,
) {
  const patient = await prisma.patient.update({
    where: { id },
    data: {
      name: data.name?.trim(),
      phone: data.phone?.trim(),
      email: data.email?.trim() || null,
      age: data.age ? Number(data.age) : undefined,
      gender: data.gender,
      bloodGroup: data.bloodGroup || null,
      occupation: data.occupation?.trim() || null,
      address: data.address?.trim() || null,
      city: data.city?.trim() || null,
      emergencyContactName: data.emergencyContactName?.trim() || null,
      emergencyContactPhone: data.emergencyContactPhone?.trim() || null,
      emergencyContactRelation: data.emergencyContactRelation?.trim() || null,
      primaryCondition: data.primaryCondition?.trim() || null,
      allergies: data.allergies?.trim() || null,
      medicalHistory: data.medicalHistory?.trim() || null,
      currentMedications: data.currentMedications?.trim() || null,
      notes: data.notes?.trim() || null,
    },
  });

  realtimeBus.notify("PATIENT_UPDATED", { patientId: patient.patientId });
  revalidatePath("/receptionist");
  revalidatePath("/doctor");
  revalidatePath("/handler");

  return { success: true, patient };
}
