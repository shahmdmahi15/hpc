import { z } from "zod";
import { TreatmentPlanType } from "@/generated/prisma/enums";

export const modalityItemSchema = z.union([
  z.string().trim().min(1),
  z.object({
    name: z.string().trim().min(1),
    durationMinutes: z.number().int().min(1).max(180).default(15),
    order: z.number().int().default(0),
  }),
]);

export interface ModalityConfigItem {
  name: string;
  durationMinutes: number;
  order: number;
}

export const createTreatmentPlanSchema = z.object({
  patientId: z.string().min(1, "Patient ID is required"),
  appointmentId: z.string().optional(),
  planType: z.nativeEnum(TreatmentPlanType, {
    message: "Invalid plan type. Must be TODAY or NEXT.",
  }),
  doctorId: z.string().optional(),
  modalities: z
    .array(modalityItemSchema)
    .min(1, "Please select or add at least one treatment modality"),
  instructions: z.string().trim().max(2000).optional(),
  targetDate: z.string().optional(),
});

export type CreateTreatmentPlanInput = z.infer<
  typeof createTreatmentPlanSchema
>;

export const updateTreatmentPlanSchema = z.object({
  id: z.string().min(1, "Treatment plan ID is required"),
  modalities: z
    .array(modalityItemSchema)
    .min(1, "Please select or add at least one treatment modality"),
  instructions: z.string().trim().max(2000).optional(),
  targetDate: z.string().optional(),
  doctorId: z.string().optional(),
});

export type UpdateTreatmentPlanInput = z.infer<
  typeof updateTreatmentPlanSchema
>;

export interface TreatmentPlanActionState {
  success: boolean;
  message: string;
  plan?: unknown;
  fieldErrors?: Record<string, string[]>;
}

export interface TreatmentPlanRecord {
  id: string;
  planType: TreatmentPlanType;
  patientId: string;
  appointmentId: string | null;
  doctorId: string | null;
  doctorName?: string | null;
  modalities: string[];
  modalityItems: ModalityConfigItem[];
  instructions: string | null;
  targetDate: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TodayTherapySlotInfo {
  appointmentId: string;
  slotId: string;
  label: string;
  startTime: string;
  endTime: string;
  roomNumber: string | null;
  isCompleted?: boolean;
}

export interface PatientPlansResult {
  todayPlan: TreatmentPlanRecord | null;
  nextPlan: TreatmentPlanRecord | null;
  historyPlans: TreatmentPlanRecord[];
  todayTherapySlot?: TodayTherapySlotInfo | null;
  hasUnservedTherapySlotToday?: boolean;
  isTherapySlotCompletedToday?: boolean;
}

export interface RawTreatmentPlan {
  id: string;
  planType: TreatmentPlanType;
  patientId: string;
  appointmentId?: string | null;
  doctorId?: string | null;
  doctor?: { id: string; name: string | null } | null;
  modalities: string;
  instructions?: string | null;
  targetDate?: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function parsePlan(plan: RawTreatmentPlan): TreatmentPlanRecord {
  let rawList: any[] = [];
  try {
    rawList = typeof plan.modalities === "string" ? JSON.parse(plan.modalities) : [];
    if (!Array.isArray(rawList)) rawList = [];
  } catch {
    rawList = [];
  }

  const modalityItems: ModalityConfigItem[] = rawList.map((item, idx) => {
    if (typeof item === "string") {
      return {
        name: item,
        durationMinutes: 15,
        order: idx + 1,
      };
    }
    return {
      name: item.name || `Modality #${idx + 1}`,
      durationMinutes: typeof item.durationMinutes === "number" && item.durationMinutes > 0 ? item.durationMinutes : 15,
      order: typeof item.order === "number" ? item.order : idx + 1,
    };
  }).sort((a, b) => a.order - b.order);

  const modalities: string[] = modalityItems.map((m) => m.name);

  return {
    id: plan.id,
    planType: plan.planType,
    patientId: plan.patientId,
    appointmentId: plan.appointmentId || null,
    doctorId: plan.doctorId || null,
    doctorName: plan.doctor?.name || null,
    modalities,
    modalityItems,
    instructions: plan.instructions || null,
    targetDate: plan.targetDate ? plan.targetDate.toISOString() : null,
    isActive: plan.isActive,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
}
