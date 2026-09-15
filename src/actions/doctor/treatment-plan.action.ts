"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/guard";
import {
  Role,
  AuditAction,
  AuditStatus,
  TreatmentPlanType,
} from "@/generated/prisma/enums";
import { logAudit } from "@/lib/audit";
import {
  createTreatmentPlanSchema,
  updateTreatmentPlanSchema,
  type CreateTreatmentPlanInput,
  type UpdateTreatmentPlanInput,
  type TreatmentPlanActionState,
} from "@/schemas/doctor/treatment-plan.schema";
import { revalidatePath } from "next/cache";

export interface TreatmentPlanRecord {
  id: string;
  planType: TreatmentPlanType;
  patientId: string;
  appointmentId: string | null;
  doctorId: string | null;
  doctorName?: string | null;
  modalities: string[];
  instructions: string | null;
  targetDate: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PatientPlansResult {
  todayPlan: TreatmentPlanRecord | null;
  nextPlan: TreatmentPlanRecord | null;
  historyPlans: TreatmentPlanRecord[];
}

interface RawTreatmentPlan {
  id: string;
  planType: TreatmentPlanType;
  patientId: string;
  appointmentId?: string | null;
  doctorId?: string | null;
  doctor?: { id: string; name: string } | null;
  modalities: string;
  instructions?: string | null;
  targetDate?: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function parsePlan(plan: RawTreatmentPlan): TreatmentPlanRecord {
  let modalities: string[] = [];
  try {
    modalities =
      typeof plan.modalities === "string" ? JSON.parse(plan.modalities) : [];
  } catch {
    modalities = [];
  }

  return {
    id: plan.id,
    planType: plan.planType,
    patientId: plan.patientId,
    appointmentId: plan.appointmentId || null,
    doctorId: plan.doctorId || null,
    doctorName: plan.doctor?.name || null,
    modalities,
    instructions: plan.instructions || null,
    targetDate: plan.targetDate ? plan.targetDate.toISOString() : null,
    isActive: plan.isActive,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
}

/**
 * Fetch existing active and historical treatment plans for a patient
 */
export async function getPatientTreatmentPlansAction(
  patientId: string,
  appointmentId?: string,
): Promise<PatientPlansResult> {
  try {
    if (!patientId) {
      return { todayPlan: null, nextPlan: null, historyPlans: [] };
    }

    const plans = await prisma.treatmentPlan.findMany({
      where: {
        patientId,
        isActive: true,
      },
      include: {
        doctor: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const parsed = plans.map(parsePlan);

    // Prioritize plan matching current appointment or most recent
    const todayPlan =
      (appointmentId
        ? parsed.find(
            (p) =>
              p.planType === TreatmentPlanType.TODAY &&
              p.appointmentId === appointmentId,
          )
        : null) ||
      parsed.find((p) => p.planType === TreatmentPlanType.TODAY) ||
      null;

    const nextPlan =
      (appointmentId
        ? parsed.find(
            (p) =>
              p.planType === TreatmentPlanType.NEXT &&
              p.appointmentId === appointmentId,
          )
        : null) ||
      parsed.find((p) => p.planType === TreatmentPlanType.NEXT) ||
      null;

    const historyPlans = parsed.filter(
      (p) => p.id !== todayPlan?.id && p.id !== nextPlan?.id,
    );

    return {
      todayPlan,
      nextPlan,
      historyPlans,
    };
  } catch (error) {
    console.error("[getPatientTreatmentPlansAction Error]:", error);
    return { todayPlan: null, nextPlan: null, historyPlans: [] };
  }
}

/**
 * Create a new treatment plan (Today's or Next Session)
 */
export async function createTreatmentPlanAction(
  rawInput: CreateTreatmentPlanInput,
): Promise<TreatmentPlanActionState> {
  const session = await requireAuth([Role.DOCTOR, Role.HANDLER, Role.ADMIN]);

  const parsed = createTreatmentPlanSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      message: "Validation failed. Please verify required fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const {
    patientId,
    appointmentId,
    planType,
    doctorId,
    modalities,
    instructions,
    targetDate,
  } = parsed.data;

  try {
    // Resolve doctor performer attribution
    let resolvedDoctorId = doctorId;
    if (!resolvedDoctorId) {
      const perf = await prisma.performer.findFirst({
        where: { userId: session.user.id },
      });
      resolvedDoctorId = perf?.id;
    }

    // Supersede older active plans of same type for this patient/appointment
    await prisma.treatmentPlan.updateMany({
      where: {
        patientId,
        planType,
        isActive: true,
        ...(appointmentId ? { appointmentId } : {}),
      },
      data: {
        isActive: false,
      },
    });

    const plan = await prisma.treatmentPlan.create({
      data: {
        patientId,
        appointmentId: appointmentId || null,
        planType,
        doctorId: resolvedDoctorId || null,
        modalities: JSON.stringify(modalities),
        instructions: instructions || null,
        targetDate: targetDate ? new Date(targetDate) : null,
        isActive: true,
      },
      include: {
        doctor: {
          select: { id: true, name: true },
        },
      },
    });

    await logAudit({
      userId: session.user.id,
      performerId: resolvedDoctorId,
      action: AuditAction.TREATMENT_PLAN_CREATE,
      status: AuditStatus.SUCCESS,
      entity: "TreatmentPlan",
      entityId: plan.id,
      details: `Created ${planType} treatment plan for patient ${patientId} with ${modalities.length} modalities: ${modalities.join(", ")}.`,
    });

    revalidatePath("/doctor");
    revalidatePath("/handler");
    return {
      success: true,
      message: `${planType === TreatmentPlanType.TODAY ? "Today's" : "Next"} Treatment Plan created successfully.`,
      plan: parsePlan(plan),
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("[createTreatmentPlanAction Error]:", error);
    await logAudit({
      userId: session.user.id,
      action: AuditAction.TREATMENT_PLAN_CREATE,
      status: AuditStatus.FAILURE,
      entity: "TreatmentPlan",
      details: `Failed to create ${planType} plan: ${errorMsg}`,
    });

    return {
      success: false,
      message: errorMsg || "Failed to create treatment plan.",
    };
  }
}

/**
 * Update an existing treatment plan
 */
export async function updateTreatmentPlanAction(
  rawInput: UpdateTreatmentPlanInput,
): Promise<TreatmentPlanActionState> {
  const session = await requireAuth([Role.DOCTOR, Role.HANDLER, Role.ADMIN]);

  const parsed = updateTreatmentPlanSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      message: "Validation failed. Please verify required fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { id, modalities, instructions, targetDate, doctorId } = parsed.data;

  try {
    const existing = await prisma.treatmentPlan.findUnique({
      where: { id },
    });

    if (!existing) {
      return {
        success: false,
        message: "Treatment plan not found.",
      };
    }

    let resolvedDoctorId: string | null | undefined =
      doctorId || existing.doctorId;
    if (!resolvedDoctorId) {
      const perf = await prisma.performer.findFirst({
        where: { userId: session.user.id },
      });
      resolvedDoctorId = perf?.id ?? null;
    }

    const updated = await prisma.treatmentPlan.update({
      where: { id },
      data: {
        modalities: JSON.stringify(modalities),
        instructions: instructions || null,
        targetDate: targetDate ? new Date(targetDate) : null,
        doctorId: resolvedDoctorId || null,
      },
      include: {
        doctor: {
          select: { id: true, name: true },
        },
      },
    });

    await logAudit({
      userId: session.user.id,
      performerId: resolvedDoctorId || undefined,
      action: AuditAction.TREATMENT_PLAN_UPDATE,
      status: AuditStatus.SUCCESS,
      entity: "TreatmentPlan",
      entityId: id,
      details: `Updated ${existing.planType} treatment plan: ${modalities.join(", ")}.`,
    });

    revalidatePath("/doctor");
    revalidatePath("/handler");
    return {
      success: true,
      message: `${existing.planType === TreatmentPlanType.TODAY ? "Today's" : "Next"} Treatment Plan updated successfully.`,
      plan: parsePlan(updated),
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("[updateTreatmentPlanAction Error]:", error);
    await logAudit({
      userId: session.user.id,
      action: AuditAction.TREATMENT_PLAN_UPDATE,
      status: AuditStatus.FAILURE,
      entity: "TreatmentPlan",
      entityId: id,
      details: `Failed to update plan: ${errorMsg}`,
    });

    return {
      success: false,
      message: errorMsg || "Failed to update treatment plan.",
    };
  }
}

/**
 * Deactivate / Delete a treatment plan
 */
export async function deleteTreatmentPlanAction(
  id: string,
  performerId?: string,
): Promise<{ success: boolean; message: string }> {
  const session = await requireAuth([Role.DOCTOR, Role.ADMIN]);

  try {
    const existing = await prisma.treatmentPlan.findUnique({
      where: { id },
    });

    if (!existing) {
      return { success: false, message: "Treatment plan not found." };
    }

    await prisma.treatmentPlan.update({
      where: { id },
      data: { isActive: false },
    });

    await logAudit({
      userId: session.user.id,
      performerId,
      action: AuditAction.TREATMENT_PLAN_DELETE,
      status: AuditStatus.SUCCESS,
      entity: "TreatmentPlan",
      entityId: id,
      details: `Deactivated ${existing.planType} treatment plan.`,
    });

    revalidatePath("/doctor");
    return { success: true, message: "Treatment plan removed." };
  } catch (error) {
    const errorMsg =
      error instanceof Error
        ? error.message
        : "Failed to delete treatment plan.";
    return {
      success: false,
      message: errorMsg,
    };
  }
}
