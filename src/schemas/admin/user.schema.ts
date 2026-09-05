import { z } from "zod";

export const resetPasswordSchema = z
  .object({
    userId: z.string().min(1, "User identifier is required."),
    performerId: z.string().optional(),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters long.")
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
