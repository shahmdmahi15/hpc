import { z } from "zod";
import { Role } from "@/generated/prisma/enums";

export const RoleEnum = z.enum([
  Role.ADMIN,
  Role.DOCTOR,
  Role.RECEPTIONIST,
  Role.HANDLER,
  Role.CASHIER,
]);

export type RoleType = z.infer<typeof RoleEnum>;

export const loginSchema = z
  .object({
    role: z.enum([
      Role.ADMIN,
      Role.DOCTOR,
      Role.RECEPTIONIST,
      Role.HANDLER,
      Role.CASHIER,
    ]),
    identifier: z.string().optional(),
    password: z
      .string()
      .min(1, "Password is required")
      .min(6, "Password must be at least 6 characters"),
  })
  .superRefine((data, ctx) => {
    if (data.role === Role.ADMIN || data.role === Role.DOCTOR) {
      if (!data.identifier || data.identifier.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Email or WhatsApp number is required for Admin and Doctor accounts.",
          path: ["identifier"],
        });
      }
    }
  });

export type LoginInput = z.infer<typeof loginSchema>;

export type ActionState = {
  success?: boolean;
  message?: string;
  fieldErrors?: {
    role?: string[];
    identifier?: string[];
    password?: string[];
  };
};

