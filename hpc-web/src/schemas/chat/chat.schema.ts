import { z } from "zod";

export const sendChatMessageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Message content cannot be empty.")
    .max(2000, "Message cannot exceed 2000 characters."),
  channel: z.string().trim().default("GENERAL"),
  dateStr: z.string().trim().optional(),
  isUrgent: z.boolean().default(false),
  performerId: z.string().trim().optional().nullable(),
  recipientId: z.string().trim().optional().nullable(),
  patientId: z.string().trim().optional().nullable(),
  roomNumber: z.string().trim().optional().nullable(),
});

export type SendChatMessageInput = z.infer<typeof sendChatMessageSchema>;

export const getChatMessagesSchema = z.object({
  dateStr: z.string().min(10, "Valid date is required."),
  channel: z.string().optional(),
  search: z.string().optional(),
});

export type GetChatMessagesInput = z.infer<typeof getChatMessagesSchema>;
