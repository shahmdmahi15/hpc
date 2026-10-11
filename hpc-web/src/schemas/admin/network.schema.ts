import { z } from "zod";

export const deviceTypeEnum = z.enum(["DESKTOP", "ANDROID_TV", "TABLET", "PHONE", "UNKNOWN"]);
export type DeviceType = z.infer<typeof deviceTypeEnum>;

export const deviceStatusEnum = z.enum(["ONLINE", "IDLE", "OFFLINE"]);
export type DeviceStatus = z.infer<typeof deviceStatusEnum>;

export const alertSeverityEnum = z.enum(["INFO", "WARNING", "EMERGENCY_CRITICAL"]);
export type AlertSeverity = z.infer<typeof alertSeverityEnum>;

export const updateDeviceAliasSchema = z.object({
  id: z.string().min(1, "Device ID is required"),
  alias: z.string().min(1, "Alias must not be empty").max(60, "Alias must be under 60 characters"),
  station: z.string().min(1, "Station must not be empty").max(80, "Station must be under 80 characters"),
});

export type UpdateDeviceAliasInput = z.infer<typeof updateDeviceAliasSchema>;

export const removeDeviceSchema = z.object({
  id: z.string().min(1, "Device ID is required"),
});

export const pingDeviceSchema = z.object({
  id: z.string().min(1, "Device ID is required"),
});

export const broadcastEmergencyAlertSchema = z.object({
  title: z.string().min(2, "Title is required").max(100, "Title must be under 100 characters"),
  message: z.string().min(4, "Message is required").max(400, "Message must be under 400 characters"),
  severity: alertSeverityEnum.default("WARNING"),
  targetScreens: z.enum(["ALL", "WAITING_ROOM", "STAFF"]).default("ALL"),
  autoDismissSeconds: z.number().min(5).max(300).default(30),
  playSound: z.boolean().default(true),
});

export type BroadcastEmergencyAlertInput = z.infer<typeof broadcastEmergencyAlertSchema>;

export interface FleetDeviceItem {
  id: string;
  name: string;
  alias: string | null;
  station: string;
  ipAddress: string;
  role: string;
  deviceType: DeviceType;
  browserOs: string;
  lastPingMs: number;
  status: DeviceStatus;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmergencyAlertItem {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  targetScreens: "ALL" | "WAITING_ROOM" | "STAFF";
  autoDismissSeconds: number;
  playSound: boolean;
  senderName: string;
  broadcastAt: string;
}

export interface NetworkActionState {
  success: boolean;
  message: string;
  device?: FleetDeviceItem;
  alert?: EmergencyAlertItem;
  fieldErrors?: Record<string, string[] | undefined>;
}
