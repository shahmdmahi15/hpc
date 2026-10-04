import { z } from "zod";
import { TreatmentPlanType } from "@/generated/prisma/enums";

export const createTreatmentPlanSchema = z.object({
  patientId: z.string().min(1, "Patient ID is required"),
  appointmentId: z.string().optional(),
  planType: z.nativeEnum(TreatmentPlanType, {
    message: "Invalid plan type. Must be TODAY or NEXT.",
  }),
  doctorId: z.string().optional(),
  modalities: z
    .array(z.string().trim().min(1))
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
    .array(z.string().trim().min(1))
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
