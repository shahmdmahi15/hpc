import { z } from "zod";
import { Gender, QueueType } from "@/generated/prisma/enums";

/**
 * Standard Bangladeshi blood group options.
 */
export const BLOOD_GROUPS = [
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
] as const;

export type BloodGroup = (typeof BLOOD_GROUPS)[number];

/**
 * Bangladeshi 11-digit mobile phone schema.
 * Automatically strips accidental '+88', '880', dashes, or whitespace,
 * then validates 11 digits starting with 01[3-9].
 */
export const bdMobilePhoneSchema = z
  .string()
  .trim()
  .transform((val) => val.replace(/^(\+880|880)/, "0").replace(/[\s-]/g, ""))
  .pipe(
    z
      .string()
      .regex(
        /^01[3-9]\d{8}$/,
        "Please enter a valid 11-digit Bangladeshi mobile number without +88 (e.g. 01712345678).",
      ),
  );

export const createPatientSchema = z.object({
  // Mandatory fields per clinic arrival protocol
  name: z
    .string()
    .trim()
    .min(2, "Patient full name must be at least 2 characters."),
  phone: bdMobilePhoneSchema,
  gender: z.enum([Gender.MALE, Gender.FEMALE], {
    message: "Please specify patient sex / gender (Male or Female).",
  }),

  // Optional demographic & clinical profile fields
  age: z
    .union([z.number(), z.string()])
    .optional()
    .transform((val) => {
      if (!val && val !== 0) return undefined;
      const parsed = typeof val === "number" ? val : parseInt(String(val), 10);
      return isNaN(parsed) ? undefined : parsed;
    }),
  email: z
    .string()
    .trim()
    .email("Please provide a valid email address.")
    .optional()
    .or(z.literal(""))
    .transform((val) => val || undefined),
  dateOfBirth: z.string().optional(),
  address: z.string().trim().optional(),
  emergencyPhone: z.string().trim().optional(),
  profession: z.string().trim().optional(),
  bloodGroup: z.string().trim().optional(),

  // Staff accountability (Receptionist Performer & PIN)
  performerId: z.string().trim().optional(),
  pin: z.string().trim().optional(),

  // Immediate Arrival Check-In options (places into Waiting Room 200)
  checkInNow: z.boolean().optional().default(true),
  queueType: z
    .enum([QueueType.THERAPY, QueueType.CONSULTATION])
    .optional()
    .nullable(),
  doctorId: z.string().optional().nullable(),
  checkInTime: z.string().optional(),
  toldTime: z.string().optional(),
  notes: z.string().trim().optional(),
  feeAmount: z.number().optional(),
});

export type CreatePatientInput = z.input<typeof createPatientSchema>;

export const checkInArrivingPatientSchema = z.object({
  patientId: z.string().trim().min(1, "Patient ID is required."),
  performerId: z
    .string()
    .trim()
    .min(1, "Please select an authorizing receptionist staff member."),
  pin: z
    .string()
    .trim()
    .min(4, "Staff PIN must be 4 digits.")
    .max(4, "Staff PIN must be 4 digits."),
  queueType: z
    .enum([QueueType.THERAPY, QueueType.CONSULTATION])
    .optional()
    .nullable(),
  doctorId: z.string().optional().nullable(),
  checkInTime: z.string().optional(),
  toldTime: z.string().optional(),
  notes: z.string().trim().optional(),
  feeAmount: z.number().optional(),
});

export type CheckInArrivingPatientInput = z.input<
  typeof checkInArrivingPatientSchema
>;

export const updatePatientSchema = z.object({
  id: z.string().trim().min(1, "Patient ID is required."),
  name: z
    .string()
    .trim()
    .min(2, "Patient full name must be at least 2 characters."),
  phone: bdMobilePhoneSchema,
  gender: z.enum([Gender.MALE, Gender.FEMALE], {
    message: "Please specify patient sex / gender (Male or Female).",
  }),
  age: z
    .union([z.number(), z.string()])
    .optional()
    .transform((val) => {
      if (!val && val !== 0) return undefined;
      const parsed = typeof val === "number" ? val : parseInt(String(val), 10);
      return isNaN(parsed) ? undefined : parsed;
    }),
  email: z
    .string()
    .trim()
    .email("Please provide a valid email address.")
    .optional()
    .or(z.literal(""))
    .transform((val) => val || undefined),
  dateOfBirth: z.string().optional(),
  address: z.string().trim().optional(),
  emergencyPhone: z.string().trim().optional(),
  profession: z.string().trim().optional(),
  bloodGroup: z.string().trim().optional(),
  performerId: z.string().trim().optional(),
  pin: z.string().trim().optional(),
});

export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;

export interface PatientActionState {
  success: boolean;
  message: string;
  patient?: any;
  appointment?: any;
  fieldErrors?: Record<string, string[]>;
}
