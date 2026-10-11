import { z } from "zod";

export const noticePriorityEnum = z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]);
export type NoticePriority = z.infer<typeof noticePriorityEnum>;

export const targetAudienceEnum = z.enum(["ALL", "WAITING_ROOM", "STAFF"]);
export type TargetAudience = z.infer<typeof targetAudienceEnum>;

export const createNoticeSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(120, "Title must be under 120 characters"),
  message: z
    .string()
    .min(5, "Message must be at least 5 characters")
    .max(500, "Message must be under 500 characters"),
  priority: noticePriorityEnum.default("NORMAL"),
  targetAudience: targetAudienceEnum.default("ALL"),
  isActive: z.boolean().default(true),
});

export type CreateNoticeInput = z.infer<typeof createNoticeSchema>;

export const updateNoticeSchema = createNoticeSchema.extend({
  id: z.string().min(1, "Notice ID is required"),
});

export type UpdateNoticeInput = z.infer<typeof updateNoticeSchema>;

export const toggleNoticeStatusSchema = z.object({
  id: z.string().min(1, "Notice ID is required"),
  isActive: z.boolean(),
});

export const deleteNoticeSchema = z.object({
  id: z.string().min(1, "Notice ID is required"),
});

export interface BulletinNoticeItem {
  id: string;
  title: string | null;
  message: string;
  priority: NoticePriority;
  targetAudience: TargetAudience;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NoticeActionState {
  success: boolean;
  message: string;
  notice?: BulletinNoticeItem;
  fieldErrors?: Record<string, string[] | undefined>;
}
