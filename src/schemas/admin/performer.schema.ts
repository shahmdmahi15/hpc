import { z } from "zod";

export const createPerformerSchema = z.object({
  userId: z.string().min(1, "Target role desk is required."),
  adminPerformerId: z.string().optional(),
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters.")
    .max(60, "Name must not exceed 60 characters."),
  phone: z
    .string()
    .trim()
    .min(6, "Phone number must be at least 6 digits.")
    .max(20, "Phone number must not exceed 20 characters.")
    .regex(
      /^(?:\+?88)?01[3-9]\d{8}$|^\+?[0-9\s-]{6,20}$/,
      "Please provide a valid phone number (e.g., 01712345678)."
    ),
});

export type CreatePerformerInput = z.infer<typeof createPerformerSchema>;

export const deletePerformerSchema = z.object({
  performerId: z.string().min(1, "Performer ID is required."),
  adminPerformerId: z.string().optional(),
});

export type DeletePerformerInput = z.infer<typeof deletePerformerSchema>;

export interface PerformerActionState {
  success: boolean;
  message: string;
  fieldErrors?: Record<string, string[] | undefined>;
}
