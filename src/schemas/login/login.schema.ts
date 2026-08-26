import { z } from "zod";
import { Role } from "@/generated/prisma/client";

export const RoleEnum = z.enum(Role);

export type RoleType = z.infer<typeof RoleEnum>;

export const loginSchema = z.object({
  role: z.enum(Role),
  password: z
    .string()
    .min(1, "Password is required")
    .min(6, "Password must be at least 6 characters"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export type ActionState = {
  success?: boolean;
  message?: string;
  fieldErrors?: {
    role?: string[];
    password?: string[];
  };
};
