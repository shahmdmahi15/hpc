import { z } from "zod";
import { Gender } from "@/generated/prisma/enums";

export const createPatientSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Patient full name must be at least 2 characters."),
  phone: z
    .string()
    .trim()
    .min(6, "Valid contact telephone number is required."),
  gender: z.enum([Gender.MALE, Gender.FEMALE], {
    message: "Please specify patient gender.",
  }),
  age: z
    .union([z.number(), z.string()])
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      const parsed = typeof val === "number" ? val : parseInt(val, 10);
      return isNaN(parsed) ? undefined : parsed;
    }),
  dateOfBirth: z.string().optional(),
  address: z.string().trim().optional(),
  emergencyPhone: z.string().trim().optional(),
  performerId: z.string().trim().optional(),
});

export type CreatePatientInput = z.infer<typeof createPatientSchema>;

export const updatePatientSchema = z.object({
  id: z.string().trim().min(1, "Patient ID is required."),
  name: z
    .string()
    .trim()
    .min(2, "Patient full name must be at least 2 characters."),
  phone: z
    .string()
    .trim()
    .min(6, "Valid contact telephone number is required."),
  gender: z.enum([Gender.MALE, Gender.FEMALE], {
    message: "Please specify patient gender.",
  }),
  age: z
    .union([z.number(), z.string()])
    .optional()
    .transform((val) => {
      if (!val && val !== 0) return undefined;
      const parsed = typeof val === "number" ? val : parseInt(String(val), 10);
      return isNaN(parsed) ? undefined : parsed;
    }),
  dateOfBirth: z.string().optional(),
  address: z.string().trim().optional(),
  emergencyPhone: z.string().trim().optional(),
  performerId: z.string().trim().optional(),
});

export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;

export interface PatientActionState {
  success: boolean;
  message: string;
  patient?: any;
  fieldErrors?: Record<string, string[]>;
}
