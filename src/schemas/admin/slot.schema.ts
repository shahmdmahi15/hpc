import { z } from "zod";
import { SlotStatus } from "@/generated/prisma/enums";

/**
 * Time format regex: "HH:mm" (24-hour, e.g. "10:00", "19:30")
 */
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface SlotActionState {
  success: boolean;
  message: string;
  fieldErrors?: Record<string, string[] | undefined>;
}

// --------------------------------------------------------
// PREDEFINED THERAPY SLOT SCHEMAS (Master Configuration)
// --------------------------------------------------------

export const createTherapySlotSchema = z
  .object({
    label: z
      .string()
      .trim()
      .min(3, "Slot label must be at least 3 characters.")
      .max(60, "Slot label cannot exceed 60 characters."),
    startTime: z
      .string()
      .regex(TIME_REGEX, "Start time must be in HH:mm format (e.g. 10:00)."),
    endTime: z
      .string()
      .regex(TIME_REGEX, "End time must be in HH:mm format (e.g. 11:00)."),
    order: z.coerce.number().int().min(0).default(0),
    regularMaleCapacity: z.coerce
      .number()
      .int()
      .min(0, "Regular male capacity cannot be negative.")
      .max(100, "Regular male capacity cannot exceed 100.")
      .default(3),
    regularFemaleCapacity: z.coerce
      .number()
      .int()
      .min(0, "Regular female capacity cannot be negative.")
      .max(100, "Regular female capacity cannot exceed 100.")
      .default(3),
    extraMaleCapacity: z.coerce
      .number()
      .int()
      .min(0, "Extra male capacity cannot be negative.")
      .max(50, "Extra male capacity cannot exceed 50.")
      .default(1),
    extraFemaleCapacity: z.coerce
      .number()
      .int()
      .min(0, "Extra female capacity cannot be negative.")
      .max(50, "Extra female capacity cannot exceed 50.")
      .default(1),
    roomId: z.string().optional().nullable(),
    status: z.nativeEnum(SlotStatus).default(SlotStatus.OPEN),
    isActive: z.boolean().default(true),
    weekDays: z.string().default("ALL"),
    adminPerformerId: z.string().optional(),
  })
  .refine((data) => data.startTime < data.endTime, {
    message: "End time must be after start time.",
    path: ["endTime"],
  });

export type CreateTherapySlotInput = z.infer<typeof createTherapySlotSchema>;

export const updateTherapySlotSchema = z
  .object({
    slotId: z.string().min(1, "Slot ID is required."),
    label: z
      .string()
      .trim()
      .min(3, "Slot label must be at least 3 characters.")
      .max(60, "Slot label cannot exceed 60 characters."),
    startTime: z
      .string()
      .regex(TIME_REGEX, "Start time must be in HH:mm format (e.g. 10:00)."),
    endTime: z
      .string()
      .regex(TIME_REGEX, "End time must be in HH:mm format (e.g. 11:00)."),
    order: z.coerce.number().int().min(0).default(0),
    regularMaleCapacity: z.coerce
      .number()
      .int()
      .min(0, "Regular male capacity cannot be negative.")
      .max(100, "Regular male capacity cannot exceed 100."),
    regularFemaleCapacity: z.coerce
      .number()
      .int()
      .min(0, "Regular female capacity cannot be negative.")
      .max(100, "Regular female capacity cannot exceed 100."),
    extraMaleCapacity: z.coerce
      .number()
      .int()
      .min(0, "Extra male capacity cannot be negative.")
      .max(50, "Extra male capacity cannot exceed 50."),
    extraFemaleCapacity: z.coerce
      .number()
      .int()
      .min(0, "Extra female capacity cannot be negative.")
      .max(50, "Extra female capacity cannot exceed 50."),
    roomId: z.string().optional().nullable(),
    status: z.nativeEnum(SlotStatus).default(SlotStatus.OPEN),
    isActive: z.boolean().default(true),
    weekDays: z.string().default("ALL"),
    adminPerformerId: z.string().optional(),
  })
  .refine((data) => data.startTime < data.endTime, {
    message: "End time must be after start time.",
    path: ["endTime"],
  });

export type UpdateTherapySlotInput = z.infer<typeof updateTherapySlotSchema>;

export const toggleTherapySlotActiveSchema = z.object({
  slotId: z.string().min(1, "Slot ID is required."),
  isActive: z.boolean(),
  adminPerformerId: z.string().optional(),
});

export type ToggleTherapySlotActiveInput = z.infer<
  typeof toggleTherapySlotActiveSchema
>;

export const updateTherapySlotStatusSchema = z.object({
  slotId: z.string().min(1, "Slot ID is required."),
  status: z.nativeEnum(SlotStatus),
  adminPerformerId: z.string().optional(),
});

export type UpdateTherapySlotStatusInput = z.infer<
  typeof updateTherapySlotStatusSchema
>;

export const deleteTherapySlotSchema = z.object({
  slotId: z.string().min(1, "Slot ID is required."),
  adminPerformerId: z.string().optional(),
});

export type DeleteTherapySlotInput = z.infer<typeof deleteTherapySlotSchema>;
