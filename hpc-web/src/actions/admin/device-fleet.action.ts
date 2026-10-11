"use server";

import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/guard";
import { getCurrentSession } from "@/lib/auth";
import { getClientDeviceInfo } from "@/lib/device";
import { Role } from "@/generated/prisma/enums";
import { revalidatePath } from "next/cache";
import { emitRealtimeEvent } from "@/lib/realtime/event-bus";
import { headers } from "next/headers";

export interface ConnectedDeviceRecord {
  id: string;
  deviceId: string;
  deviceName: string | null;
  ipAddress: string | null;
  role: string | null;
  station: string | null;
  deviceType: string;
  browser: string | null;
  userAgent: string | null;
  latencyMs: number;
  isOnline: boolean;
  lastSeenAt: Date;
  firstSeenAt: Date;
  userId: string | null;
  metadata: string | null;
  user?: {
    id: string;
    name: string | null;
    role: string;
  } | null;
}

export interface RecordHeartbeatInput {
  deviceId: string;
  deviceName?: string;
  role?: string;
  station?: string;
  deviceType?: string;
  browser?: string;
  userAgent?: string;
  latencyMs: number;
  metadata?: any;
}

const OFFLINE_THRESHOLD_MS = 35000; // 35 seconds

/**
 * Records or updates a client terminal heartbeat.
 * Automatically resolves IP and headers, tracks latency, and notifies the real-time event bus.
 */
export async function recordDeviceHeartbeatAction(data: RecordHeartbeatInput) {
  try {
    if (!data.deviceId) {
      return {
        success: false,
        message: "deviceId is required.",
      };
    }

    // Auto-detect client device info and IP
    let clientIp = "127.0.0.1";
    let detectedBrowser = data.browser;
    let detectedUserAgent = data.userAgent;
    let detectedDeviceType = data.deviceType || "DESKTOP";

    try {
      const clientInfo = await getClientDeviceInfo();
      clientIp = clientInfo.ipAddress;
      if (!detectedBrowser || detectedBrowser === "Unknown") {
        detectedBrowser = clientInfo.browser;
      }
      if (!detectedUserAgent) {
        detectedUserAgent = clientInfo.userAgent;
      }
      if (!data.deviceType) {
        detectedDeviceType = clientInfo.device?.toUpperCase() || "DESKTOP";
      }
    } catch {
      // Fallback if headers context is unavailable
    }

    // Associate current authenticated user if one is logged in
    const session = await getCurrentSession();
    const currentUserId = session?.user?.id || null;
    const currentUserRole = session?.user?.role || data.role || null;

    const serializedMetadata =
      data.metadata !== undefined && data.metadata !== null
        ? typeof data.metadata === "string"
          ? data.metadata
          : JSON.stringify(data.metadata)
        : null;

    const now = new Date();

    const existing = await (prisma as any).connectedDevice.findUnique({
      where: { deviceId: data.deviceId },
    });

    let device: ConnectedDeviceRecord;
    let isFirstConnect = false;

    if (!existing) {
      isFirstConnect = true;
      device = await (prisma as any).connectedDevice.create({
        data: {
          deviceId: data.deviceId,
          deviceName: data.deviceName || null,
          ipAddress: clientIp,
          role: currentUserRole,
          station: data.station || null,
          deviceType: detectedDeviceType,
          browser: detectedBrowser || null,
          userAgent: detectedUserAgent || null,
          latencyMs: Math.max(0, Math.round(data.latencyMs || 0)),
          isOnline: true,
          lastSeenAt: now,
          firstSeenAt: now,
          userId: currentUserId,
          metadata: serializedMetadata,
        },
        include: {
          user: {
            select: { id: true, name: true, role: true },
          },
        },
      });

      emitRealtimeEvent("DEVICE_CONNECTED", device);
    } else {
      device = await (prisma as any).connectedDevice.update({
        where: { deviceId: data.deviceId },
        data: {
          deviceName: data.deviceName !== undefined ? data.deviceName : existing.deviceName,
          ipAddress: clientIp || existing.ipAddress,
          role: currentUserRole || existing.role,
          station: data.station !== undefined ? data.station : existing.station,
          deviceType: detectedDeviceType || existing.deviceType,
          browser: detectedBrowser || existing.browser,
          userAgent: detectedUserAgent || existing.userAgent,
          latencyMs: Math.max(0, Math.round(data.latencyMs || 0)),
          isOnline: true,
          lastSeenAt: now,
          userId: currentUserId || existing.userId,
          metadata: serializedMetadata !== null ? serializedMetadata : existing.metadata,
        },
        include: {
          user: {
            select: { id: true, name: true, role: true },
          },
        },
      });

      emitRealtimeEvent("DEVICE_HEARTBEAT", device);
    }

    return {
      success: true,
      isFirstConnect,
      data: device,
    };
  } catch (error: any) {
    console.error("[recordDeviceHeartbeatAction Error]:", error);
    return {
      success: false,
      message: error?.message || "Failed to record device heartbeat.",
    };
  }
}

/**
 * Returns connected devices with automatic stale offline sweep (lastSeenAt < now - 35s).
 */
export async function getConnectedDevicesAction() {
  try {
    await requireAuth([Role.ADMIN]);

    const cutoff = new Date(Date.now() - OFFLINE_THRESHOLD_MS);

    // Auto-flag stale devices as offline in SQLite
    try {
      await (prisma as any).connectedDevice.updateMany({
        where: {
          isOnline: true,
          lastSeenAt: { lt: cutoff },
        },
        data: {
          isOnline: false,
        },
      });
    } catch (sweepErr) {
      console.warn("[Stale Device Sweep Warning]:", sweepErr);
    }

    const devices = (await (prisma as any).connectedDevice.findMany({
      orderBy: [{ isOnline: "desc" }, { lastSeenAt: "desc" }],
      include: {
        user: {
          select: { id: true, name: true, role: true },
        },
      },
    })) as ConnectedDeviceRecord[];

    const onlineCount = devices.filter((d) => d.isOnline).length;
    const offlineCount = devices.length - onlineCount;

    return {
      success: true,
      devices,
      stats: {
        total: devices.length,
        online: onlineCount,
        offline: offlineCount,
      },
    };
  } catch (error: any) {
    console.error("[getConnectedDevicesAction Error]:", error);
    return {
      success: false,
      devices: [] as ConnectedDeviceRecord[],
      stats: { total: 0, online: 0, offline: 0 },
      message: error?.message || "Failed to load connected devices.",
    };
  }
}

/**
 * Sets human alias name and station for a hardware terminal.
 */
export async function updateDeviceAliasAction(
  id: string,
  deviceName: string,
  station?: string
) {
  try {
    await requireAuth([Role.ADMIN]);

    const updated = await (prisma as any).connectedDevice.update({
      where: { id },
      data: {
        deviceName: deviceName.trim(),
        ...(station !== undefined ? { station: station.trim() } : {}),
      },
      include: {
        user: {
          select: { id: true, name: true, role: true },
        },
      },
    });

    emitRealtimeEvent("DEVICE_HEARTBEAT", updated);
    revalidatePath("/admin/network");

    return {
      success: true,
      data: updated as ConnectedDeviceRecord,
      message: "Device alias updated successfully.",
    };
  } catch (error: any) {
    console.error("[updateDeviceAliasAction Error]:", error);
    return {
      success: false,
      message: error?.message || "Failed to update device alias.",
    };
  }
}

/**
 * Removes a device record from the fleet monitor.
 */
export async function deleteDeviceAction(id: string) {
  try {
    await requireAuth([Role.ADMIN]);

    const existing = await (prisma as any).connectedDevice.findUnique({
      where: { id },
    });

    if (!existing) {
      return {
        success: false,
        message: "Device not found.",
      };
    }

    await (prisma as any).connectedDevice.delete({
      where: { id },
    });

    emitRealtimeEvent("DEVICE_DISCONNECTED", {
      id,
      deviceId: existing.deviceId,
    });

    revalidatePath("/admin/network");

    return {
      success: true,
      message: "Device removed from fleet.",
    };
  } catch (error: any) {
    console.error("[deleteDeviceAction Error]:", error);
    return {
      success: false,
      message: error?.message || "Failed to delete device.",
    };
  }
}

/**
 * Broadcasts an emergency or high-priority audio/visual alert to all connected clinic clients.
 */
export async function broadcastSystemAlertAction(
  message: string,
  priority: string = "HIGH"
) {
  try {
    const session = await requireAuth([Role.ADMIN]);
    const trimmedMessage = message?.trim();

    if (!trimmedMessage) {
      return {
        success: false,
        message: "Alert message cannot be empty.",
      };
    }

    const payload = {
      message: trimmedMessage,
      priority: priority.toUpperCase(),
      sentBy: session.user.name || "Administrator",
      sentAt: new Date().toISOString(),
    };

    emitRealtimeEvent("SYSTEM_BROADCAST_ALERT", payload);

    return {
      success: true,
      data: payload,
      message: "Emergency broadcast alert dispatched to all active stations.",
    };
  } catch (error: any) {
    console.error("[broadcastSystemAlertAction Error]:", error);
    return {
      success: false,
      message: error?.message || "Failed to broadcast system alert.",
    };
  }
}
