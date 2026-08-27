"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth";
import { realtimeBus } from "@/lib/events";
import { revalidatePath } from "next/cache";

export interface SaveTreatmentSessionInput {
  patientId: string;
  handlerId?: string;
  sessionNumber?: number;
  bloodPressure?: string;
  complaint?: string;
  treatmentPlan?: string;
  treatmentPerformed: string; // e.g. "IFT(20), UST(10), SWD(20), PMF"
  notes?: string;
}

export async function getPatientTreatmentSessions(patientId: string) {
  return prisma.treatmentSession.findMany({
    where: {
      OR: [{ patientId }, { patient: { patientId } }],
    },
    orderBy: { date: "desc" },
    include: {
      handler: { select: { id: true, name: true } },
    },
  });
}

export async function saveTreatmentSession(data: SaveTreatmentSessionInput) {
  const session = await getCurrentSession();

  const patient = await prisma.patient.findFirst({
    where: {
      OR: [{ id: data.patientId }, { patientId: data.patientId }],
    },
  });

  if (!patient) {
    return { error: "Patient record not found." };
  }

  // Determine sequential session number if not provided
  let sessionNumber = data.sessionNumber;
  if (!sessionNumber) {
    const prevCount = await prisma.treatmentSession.count({
      where: { patientId: patient.id },
    });
    sessionNumber = prevCount + 1;
  }

  const treatmentSession = await prisma.treatmentSession.create({
    data: {
      patientId: patient.id,
      handlerId: data.handlerId || session?.user?.id || null,
      sessionNumber,
      bloodPressure: data.bloodPressure || null,
      complaint: data.complaint || null,
      treatmentPlan: data.treatmentPlan || null,
      treatmentPerformed: data.treatmentPerformed,
      notes: data.notes || null,
    },
    include: {
      patient: true,
      handler: true,
    },
  });

  realtimeBus.notify("SESSION_LOGGED", { treatmentSession });
  revalidatePath("/handler");
  revalidatePath("/doctor");

  return { success: true, treatmentSession };
}
