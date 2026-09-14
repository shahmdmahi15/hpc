"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/guard";
import {
  Role,
  AuditAction,
  AuditStatus,
  ClinicalOptionCategory,
} from "@/generated/prisma/enums";
import { logAudit } from "@/lib/audit";
import {
  createMedicalRecordSchema,
  type CreateMedicalRecordInput,
  type MedicalRecordActionState,
} from "@/schemas/doctor/medical-record.schema";
import { revalidatePath } from "next/cache";

export interface ActiveClinicalConfig {
  painAreas: string[];
  painTypes: string[];
  aggravatingFactors: string[];
  relievingFactors: string[];
  functionalLimitations: string[];
  treatmentPlans: { name: string; description?: string | null }[];
}

export async function getActiveClinicalConfigAction(): Promise<{
  success: boolean;
  config: ActiveClinicalConfig;
}> {
  try {
    const options = await prisma.clinicalOption.findMany({
      where: { isActive: true },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    });

    const config: ActiveClinicalConfig = {
      painAreas: [],
      painTypes: [],
      aggravatingFactors: [],
      relievingFactors: [],
      functionalLimitations: [],
      treatmentPlans: [],
    };

    for (const opt of options) {
      switch (opt.category) {
        case ClinicalOptionCategory.PAIN_AREA:
          config.painAreas.push(opt.name);
          break;
        case ClinicalOptionCategory.PAIN_TYPE:
          config.painTypes.push(opt.name);
          break;
        case ClinicalOptionCategory.AGGRAVATING_FACTOR:
          config.aggravatingFactors.push(opt.name);
          break;
        case ClinicalOptionCategory.RELIEVING_FACTOR:
          config.relievingFactors.push(opt.name);
          break;
        case ClinicalOptionCategory.FUNCTIONAL_LIMITATION:
          config.functionalLimitations.push(opt.name);
          break;
        case ClinicalOptionCategory.TREATMENT_PLAN:
          config.treatmentPlans.push({
            name: opt.name,
            description: opt.description,
          });
          break;
      }
    }

    return {
      success: true,
      config,
    };
  } catch (error) {
    console.error("[Get Active Clinical Config Error]:", error);
    return {
      success: false,
      config: {
        painAreas: ["Neck", "Shoulder", "Back", "Knee", "Heel"],
        painTypes: ["Sharp", "Dull", "Burning", "Radiating"],
        aggravatingFactors: ["Movement", "Sitting", "Standing", "Walking"],
        relievingFactors: ["Rest", "Medicine", "Heat"],
        functionalLimitations: [
          "Bending",
          "Sitting",
          "Standing",
          "Walking",
          "Lifting",
        ],
        treatmentPlans: [
          { name: "Hot pack" },
          { name: "IFT / TENS" },
          { name: "Ultrasound" },
          { name: "Stretching" },
          { name: "Strengthening" },
          { name: "Posture correction" },
        ],
      },
    };
  }
}

export async function createMedicalRecordAction(
  data: CreateMedicalRecordInput,
): Promise<MedicalRecordActionState> {
  try {
    const sessionData = await requireAuth([
      Role.DOCTOR,
      Role.ADMIN,
      Role.RECEPTIONIST,
    ]);

    const parsed = createMedicalRecordSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false,
        message: "Invalid assessment data provided.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const val = parsed.data;

    const patient = await prisma.patient.findUnique({
      where: { id: val.patientId },
    });
    if (!patient) {
      return {
        success: false,
        message: "Patient not found.",
      };
    }

    const created = await prisma.medicalRecord.create({
      data: {
        patientId: val.patientId,
        appointmentId: val.appointmentId || null,
        doctorId: val.doctorId || null,
        age: val.age !== undefined ? val.age : patient.age || null,
        occupation: val.occupation || null,

        // Section 2: Pain Details
        painAreas: JSON.stringify(val.painAreas || []),
        painSide: val.painSide || null,
        duration: val.duration || null,
        painTypes: JSON.stringify(val.painTypes || []),

        // Section 3: Pain Scale & Triggers
        vasScore: val.vasScore ?? 0,
        aggravatingFactors: JSON.stringify(val.aggravatingFactors || []),
        relievingFactors: JSON.stringify(val.relievingFactors || []),

        // Section 4: History
        injuryAccident: val.injuryAccident,
        injuryDetails: val.injuryDetails || null,
        postureAdviceGiven: val.postureAdviceGiven,
        surgeryHistory: val.surgeryHistory,
        surgeryDetails: val.surgeryDetails || null,
        previousTreatment: val.previousTreatment || null,

        // Section 5: Functional Limitation
        functionalLimitations: JSON.stringify(val.functionalLimitations || []),

        // Section 6: Physical Examination
        rom: val.rom || null,
        muscleSpasm: val.muscleSpasm,
        tenderness: val.tenderness,
        swelling: val.swelling,
        physicalExamNotes: val.physicalExamNotes || null,

        // Section 7: Diagnosis
        diagnosis: val.diagnosis || null,

        // Section 8: Treatment Plan
        treatmentPlans: JSON.stringify(val.treatmentPlans || []),
        treatmentNotes: val.treatmentNotes || null,

        // Section 9: Home Advice
        exerciseExplained: val.exerciseExplained,
        homePostureAdvice: val.homePostureAdvice,

        // Follow-up & Progress
        followUpVasScore:
          val.followUpVasScore !== undefined ? val.followUpVasScore : null,
        improvement: val.improvement || null,
        doctorSignature: val.doctorSignature || null,
      },
      include: {
        patient: true,
        doctor: true,
      },
    });

    await logAudit({
      userId: sessionData.user.id,
      performerId: val.doctorId || null,
      action: AuditAction.APPOINTMENT_UPDATE,
      entity: "MedicalRecord",
      entityId: created.id,
      status: AuditStatus.SUCCESS,
      details: {
        patientName: patient.name,
        diagnosis: created.diagnosis,
        vasScore: created.vasScore,
      },
    });

    revalidatePath("/doctor");
    revalidatePath("/receptionist");

    return {
      success: true,
      message: `Medical assessment saved for ${patient.name}.`,
      recordId: created.id,
    };
  } catch (error) {
    console.error("[Create Medical Record Error]:", error);
    return {
      success: false,
      message: "Failed to save medical assessment.",
    };
  }
}

export async function getPatientMedicalHistoryAction(patientId: string) {
  try {
    await requireAuth([
      Role.DOCTOR,
      Role.ADMIN,
      Role.RECEPTIONIST,
      Role.HANDLER,
    ]);

    const records = await prisma.medicalRecord.findMany({
      where: { patientId },
      include: {
        doctor: true,
        appointment: {
          include: { room: true },
        },
      },
      orderBy: { assessmentDate: "desc" },
    });

    return {
      success: true,
      records: records.map((rec) => ({
        ...rec,
        painAreasList: safeJsonParse<string[]>(rec.painAreas, []),
        painTypesList: safeJsonParse<string[]>(rec.painTypes, []),
        aggravatingFactorsList: safeJsonParse<string[]>(
          rec.aggravatingFactors,
          [],
        ),
        relievingFactorsList: safeJsonParse<string[]>(rec.relievingFactors, []),
        functionalLimitationsList: safeJsonParse<string[]>(
          rec.functionalLimitations,
          [],
        ),
        treatmentPlansList: safeJsonParse<string[]>(rec.treatmentPlans, []),
      })),
    };
  } catch (error) {
    console.error("[Get Patient Medical History Error]:", error);
    return {
      success: false,
      records: [],
      message: "Failed to load medical history.",
    };
  }
}

function safeJsonParse<T>(jsonStr: string, fallback: T): T {
  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    return fallback;
  }
}
