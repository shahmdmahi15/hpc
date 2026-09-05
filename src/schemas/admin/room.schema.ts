import { z } from "zod";
import {
  RoomAccessType,
  RoomGender,
  RoomStatus,
} from "@/generated/prisma/enums";

export const createRoomSchema = z.object({
  number: z
    .string()
    .trim()
    .min(1, "Room number is required.")
    .max(20, "Room number must not exceed 20 characters."),
  purpose: z
    .string()
    .trim()
    .min(2, "Purpose or title must be at least 2 characters.")
    .max(100, "Purpose must not exceed 100 characters."),
  accessType: z.enum(RoomAccessType),
  gender: z.enum(RoomGender),
  status: z.enum(RoomStatus).default(RoomStatus.AVAILABLE),
  performerId: z.string().optional(),
});

export const updateRoomSchema = z.object({
  id: z.string().min(1, "Room ID is required."),
  number: z
    .string()
    .trim()
    .min(1, "Room number is required.")
    .max(20, "Room number must not exceed 20 characters."),
  purpose: z
    .string()
    .trim()
    .min(2, "Purpose or title must be at least 2 characters.")
    .max(100, "Purpose must not exceed 100 characters."),
  accessType: z.enum(RoomAccessType),
  gender: z.enum(RoomGender),
  status: z.enum(RoomStatus),
  performerId: z.string().optional(),
});

export const updateRoomStatusSchema = z.object({
  id: z.string().min(1, "Room ID is required."),
  status: z.enum(RoomStatus),
  performerId: z.string().optional(),
});

export const deleteRoomSchema = z.object({
  id: z.string().min(1, "Room ID is required."),
  performerId: z.string().optional(),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
export type UpdateRoomStatusInput = z.infer<typeof updateRoomStatusSchema>;
export type DeleteRoomInput = z.infer<typeof deleteRoomSchema>;

export interface RoomActionState {
  success: boolean;
  message: string;
  fieldErrors?: Record<string, string[] | undefined>;
}
