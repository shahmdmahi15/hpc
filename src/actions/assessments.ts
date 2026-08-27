"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth";
import { realtimeBus } from "@/lib/events";
import { PainSide, PainType, RomStatus } from "@/generated/prisma/enums";
import { revalidatePath } from "next/cache";

export interface SaveAssessmentInput {
  patientId: string;
  doctorId?: string;
  painArea?: string;
  side?: PainSide;
  duration?: string;
  painType?: PainType;
  vasScore?: number;
  painIncreasesWith?: string;
  painReducesWith?: string;
  hasInjury?: boolean;
  hasSurgery?: boolean;
  postureAdviceGiven?: boolean;
  previousTreatment?: string;
  difficultyIn?: string;
  rom?: RomStatus;
  hasMuscleSpasm?: boolean;
  hasTenderness?: boolean;
  hasSwelling?: boolean;
  diagnosis?: string;
  prescribedModalities?: string;
  exerciseExplained?: boolean;
  homePostureAdvice?: boolean;
  postTreatmentVas?: number;
  improvement?: string;
  clinicalNotes?: string;
}

export async function getPatientAssessments(patientId: string) {
  return prisma.clinicalAssessment.findMany({
    where: {
      OR: [{ patientId }, { patient: { patientId } }],
    },
    orderBy: { date: "desc" },
    include: {
      doctor: { select: { id: true, name: true } },
    },
  });
}

export async function saveClinicalAssessment(data: SaveAssessmentInput) {
  const session = await getCurrentSession();

  const patient = await prisma.patient.findFirst({
    where: {
      OR: [{ id: data.patientId }, { patientId: data.patientId }],
    },
  });

  if (!patient) {
    return { error: "Patient record not found." };
  }

  const assessment = await prisma.clinicalAssessment.create({
    data: {
      patientId: patient.id,
      doctorId: data.doctorId || session?.user?.id || null,
      painArea: data.painArea || null,
      side: data.side || PainSide.BOTH,
      duration: data.duration || null,
      painType: data.painType || PainType.DULL,
      vasScore: data.vasScore !== undefined ? Number(data.vasScore) : null,
      painIncreasesWith: data.painIncreasesWith || null,
      painReducesWith: data.painReducesWith || null,
      hasInjury: !!data.hasInjury,
      hasSurgery: !!data.hasSurgery,
      postureAdviceGiven: !!data.postureAdviceGiven,
      previousTreatment: data.previousTreatment || null,
      difficultyIn: data.difficultyIn || null,
      rom: data.rom || RomStatus.NORMAL,
      hasMuscleSpasm: !!data.hasMuscleSpasm,
      hasTenderness: !!data.hasTenderness,
      hasSwelling: !!data.hasSwelling,
      diagnosis: data.diagnosis || null,
      prescribedModalities: data.prescribedModalities || null,
      exerciseExplained: data.exerciseExplained ?? true,
      homePostureAdvice: data.homePostureAdvice ?? true,
      postTreatmentVas:
        data.postTreatmentVas !== undefined
          ? Number(data.postTreatmentVas)
          : null,
      improvement: data.improvement || null,
      clinicalNotes: data.clinicalNotes || null,
    },
    include: {
      patient: true,
      doctor: true,
    },
  });

  // If diagnosis was added, update patient's primaryCondition
  if (data.diagnosis) {
    await prisma.patient.update({
      where: { id: patient.id },
      data: { primaryCondition: data.diagnosis },
    });
  }

  realtimeBus.notify("ASSESSMENT_SAVED", { assessment });
  revalidatePath("/doctor");
  revalidatePath("/handler");

  return { success: true, assessment };
}
