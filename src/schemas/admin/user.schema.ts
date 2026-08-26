import { z } from "zod";
import { Role } from "@/generated/prisma/enums";

export const CreateUserSchema = z.object({
  name: z
    .string()
    .min(2, "Full name must be at least 2 characters")
    .max(64, "Full name must not exceed 64 characters")
    .trim(),
  role: z.enum(Role, {
    error: "A valid staff role is required",
  }),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(72, "Password must not exceed 72 characters"),
});

export const UpdateUserSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  name: z
    .string()
    .min(2, "Full name must be at least 2 characters")
    .max(64, "Full name must not exceed 64 characters")
    .trim(),
  role: z.enum(Role, {
    error: "A valid staff role is required",
  }),
});

export const ResetUserPasswordSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(72, "Password must not exceed 72 characters"),
});

export const DeleteUserSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
});

export const RevokeSessionsSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type ResetUserPasswordInput = z.infer<typeof ResetUserPasswordSchema>;
export type DeleteUserInput = z.infer<typeof DeleteUserSchema>;
export type RevokeSessionsInput = z.infer<typeof RevokeSessionsSchema>;
