import { z } from "zod";

export const UpdateProfileInfoSchema = z.object({
  name: z
    .string()
    .min(2, "Display name must be at least 2 characters")
    .max(64, "Display name must not exceed 64 characters")
    .trim(),
});

export const UpdatePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current security password is required"),
    newPassword: z
      .string()
      .min(6, "New password must be at least 6 characters")
      .max(72, "New password must not exceed 72 characters"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "New passwords do not match",
    path: ["confirmPassword"],
  });

export type UpdateProfileInfoInput = z.infer<typeof UpdateProfileInfoSchema>;
export type UpdatePasswordInput = z.infer<typeof UpdatePasswordSchema>;
