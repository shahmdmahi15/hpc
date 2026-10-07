import { z } from "zod";
import { Role } from "@/generated/prisma/enums";

export const createAccountSchema = z.object({
  role: z.enum([Role.ADMIN, Role.DOCTOR]),
  name: z.string().trim().min(2, "Full name must be at least 2 characters."),
  email: z.string().trim().email("Please provide a valid email address."),
  whatsapp: z
    .string()
    .trim()
    .min(6, "WhatsApp number must be at least 6 characters.")
    .regex(
      /^(?:\+?88)?01[3-9]\d{8}$|^\+?[0-9\s-]{6,20}$/,
      "Please provide a valid WhatsApp number.",
    ),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters.")
    .max(100, "Password must not exceed 100 characters."),
  consultationFee: z.coerce
    .number()
    .min(0, "Fee must be a valid non-negative number.")
    .optional(),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;

export const deleteUserAccountSchema = z.object({
  userId: z.string().min(1, "User ID is required."),
});

export type DeleteUserAccountInput = z.infer<typeof deleteUserAccountSchema>;

export const resetPasswordSchema = z
  .object({
    userId: z.string().min(1, "User identifier is required."),
    performerId: z.string().optional(),
    newPassword: z
      .string()
      .min(6, "Password must be at least 6 characters long.")
      .max(100, "Password must not exceed 100 characters."),
    confirmPassword: z.string().min(1, "Please confirm your new password."),
    revokeSessions: z.boolean().default(true),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export interface UserActionState {
  success: boolean;
  message: string;
  fieldErrors?: Record<string, string[] | undefined>;
  generatedPassword?: string;
}
