import { z } from "zod";
import { ClinicalOptionCategory } from "@/generated/prisma/enums";

export const clinicalOptionCategorySchema = z.enum(ClinicalOptionCategory);

export const createClinicalOptionSchema = z.object({
  category: clinicalOptionCategorySchema,
  name: z
    .string()
    .trim()
    .min(1, "Name is required.")
    .max(100, "Name must not exceed 100 characters."),
  description: z.string().trim().max(250).optional(),
  order: z.coerce.number().int().min(0).default(0),
});

export const updateClinicalOptionSchema = z.object({
  id: z.string().min(1, "ID is required."),
  category: clinicalOptionCategorySchema,
  name: z
    .string()
    .trim()
    .min(1, "Name is required.")
    .max(100, "Name must not exceed 100 characters."),
  description: z.string().trim().max(250).optional(),
  order: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().optional(),
});

export type CreateClinicalOptionInput = z.infer<typeof createClinicalOptionSchema>;
export type UpdateClinicalOptionInput = z.infer<typeof updateClinicalOptionSchema>;

export interface ClinicalActionState {
  success: boolean;
  message: string;
  fieldErrors?: Record<string, string[] | undefined>;
}
