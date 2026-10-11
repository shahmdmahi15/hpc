"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/guard";
import { Role } from "@/generated/prisma/enums";
import { verifyPerformerPin } from "@/lib/performer-auth";
import { emitRealtimeEvent } from "@/lib/realtime/event-bus";
import { revalidatePath } from "next/cache";

import {
  type ModalityTimerItem,
  type TherapyTimerState,
  recalculateTimer,
} from "@/lib/therapy-timer-utils";

export type { ModalityTimerItem, TherapyTimerState };

/**
 * Get or initialize therapy timer for an active appointment / patient
 */
export async function getTherapyTimerAction(params: {
  appointmentId: string;
  patientId?: string;
  roomNumber?: string | null;
  initialModalities?: { name: string; durationMinutes?: number; order?: number }[];
}): Promise<{ success: boolean; timer: TherapyTimerState | null; message?: string }> {
  try {
    await requireAuth([Role.HANDLER, Role.DOCTOR, Role.ADMIN, Role.RECEPTIONIST]);

    let effectivePatientId = params.patientId;
    if (!effectivePatientId) {
      const apt = await prisma.appointment.findUnique({
        where: { id: params.appointmentId },
        select: { patientId: true },
      });
      effectivePatientId = apt?.patientId || "";
    }

    let timer = await prisma.therapySessionTimer.findUnique({
      where: { appointmentId: params.appointmentId },
    });

    if (!timer) {
      // Find today's treatment plan for this patient if initialModalities not passed
      let parsedItems: ModalityTimerItem[] = [];

      if (params.initialModalities && params.initialModalities.length > 0) {
        parsedItems = params.initialModalities.map((m, idx) => ({
          id: `${m.name}-${idx}`,
          name: m.name,
          durationMinutes: m.durationMinutes || 15,
          totalSeconds: (m.durationMinutes || 15) * 60,
          remainingSeconds: (m.durationMinutes || 15) * 60,
          isRunning: false,
          isCompleted: false,
          isSkipped: false,
          order: m.order || idx + 1,
        }));
      } else {
        const plan = await prisma.treatmentPlan.findFirst({
          where: {
            patientId: effectivePatientId,
            planType: "TODAY",
            isActive: true,
          },
          orderBy: { createdAt: "desc" },
        });

        if (plan) {
          try {
            const raw = JSON.parse(plan.modalities);
            if (Array.isArray(raw)) {
              parsedItems = raw.map((item: any, idx: number) => {
                const name = typeof item === "string" ? item : item.name;
                const mins = typeof item === "object" && item.durationMinutes ? item.durationMinutes : 15;
                const order = typeof item === "object" && item.order ? item.order : idx + 1;
                return {
                  id: `${name}-${idx}`,
                  name,
                  durationMinutes: mins,
                  totalSeconds: mins * 60,
                  remainingSeconds: mins * 60,
                  isRunning: false,
                  isCompleted: false,
                  isSkipped: false,
                  order,
                };
              });
            }
          } catch {}
        }
      }

      if (parsedItems.length === 0) {
        // Fallback default modality
        parsedItems = [
          {
            id: "Physical-Therapy-0",
            name: "Physical Therapy Session",
            durationMinutes: 15,
            totalSeconds: 15 * 60,
            remainingSeconds: 15 * 60,
            isRunning: false,
            isCompleted: false,
            isSkipped: false,
            order: 1,
          },
        ];
      }

      timer = await prisma.therapySessionTimer.create({
        data: {
          appointmentId: params.appointmentId,
          patientId: effectivePatientId,
          roomNumber: params.roomNumber || null,
          modalities: JSON.stringify(parsedItems),
          currentStepIndex: 0,
          isRunning: false,
          lastStartedAt: null,
        },
      });
    }

    const calculated = recalculateTimer(timer);

    // Persist any auto-completed steps back to DB if timer state shifted
    if (calculated.isRunning !== timer.isRunning || calculated.currentStepIndex !== timer.currentStepIndex) {
      await prisma.therapySessionTimer.update({
        where: { id: timer.id },
        data: {
          modalities: JSON.stringify(calculated.modalities),
          currentStepIndex: calculated.currentStepIndex,
          isRunning: calculated.isRunning,
          lastStartedAt: calculated.lastStartedAt ? new Date(calculated.lastStartedAt) : null,
        },
      });
    }

    return { success: true, timer: calculated };
  } catch (error) {
    console.error("[getTherapyTimerAction Error]:", error);
    return { success: false, timer: null, message: "Failed to retrieve therapy timer." };
  }
}

/**
 * Start or resume the therapy timer (Requires Handler PIN)
 */
export async function startTherapyTimerAction(params: {
  appointmentId: string;
  performerId: string;
  pin: string;
  stepIndex?: number;
}): Promise<{ success: boolean; timer?: TherapyTimerState; message: string }> {
  try {
    const sessionData = await requireAuth([Role.HANDLER, Role.DOCTOR, Role.ADMIN]);

    const isExempt = sessionData.user.role === Role.ADMIN || sessionData.user.role === Role.DOCTOR;
    if (!isExempt) {
      const pinRes = await verifyPerformerPin(params.performerId, params.pin);
      if (!pinRes.valid) {
        return { success: false, message: pinRes.error || "Invalid 4-digit security PIN." };
      }
    }

    let timer = await prisma.therapySessionTimer.findUnique({
      where: { appointmentId: params.appointmentId },
    });
    if (!timer) {
      return { success: false, message: "Therapy session timer record not found." };
    }

    const current = recalculateTimer(timer);
    const stepIdx = typeof params.stepIndex === "number" ? params.stepIndex : current.currentStepIndex;

    if (!current.modalities[stepIdx]) {
      return { success: false, message: "Selected modality index is invalid." };
    }

    // Set target modality active
    current.modalities.forEach((m, idx) => {
      m.isRunning = idx === stepIdx;
      if (idx === stepIdx && m.remainingSeconds === 0) {
        // Reset remaining if starting a completed one
        m.remainingSeconds = m.totalSeconds;
        m.isCompleted = false;
        m.isSkipped = false;
      }
    });

    const now = new Date();
    const updated = await prisma.therapySessionTimer.update({
      where: { id: timer.id },
      data: {
        currentStepIndex: stepIdx,
        isRunning: true,
        lastStartedAt: now,
        performerId: params.performerId,
        modalities: JSON.stringify(current.modalities),
      },
    });

    const result = recalculateTimer(updated);

    emitRealtimeEvent("THERAPY_TIMER_UPDATED", {
      appointmentId: params.appointmentId,
      patientId: updated.patientId,
      action: "START",
      stepIndex: stepIdx,
      modalityName: current.modalities[stepIdx]?.name,
      performerId: params.performerId,
    });

    revalidatePath("/handler");
    return { success: true, timer: result, message: `Started ${current.modalities[stepIdx]?.name} timer.` };
  } catch (error) {
    console.error("[startTherapyTimerAction Error]:", error);
    return { success: false, message: "Failed to start timer." };
  }
}

/**
 * Pause the therapy timer (Requires Handler PIN)
 */
export async function pauseTherapyTimerAction(params: {
  appointmentId: string;
  performerId: string;
  pin: string;
}): Promise<{ success: boolean; timer?: TherapyTimerState; message: string }> {
  try {
    const sessionData = await requireAuth([Role.HANDLER, Role.DOCTOR, Role.ADMIN]);

    const isExempt = sessionData.user.role === Role.ADMIN || sessionData.user.role === Role.DOCTOR;
    if (!isExempt) {
      const pinRes = await verifyPerformerPin(params.performerId, params.pin);
      if (!pinRes.valid) {
        return { success: false, message: pinRes.error || "Invalid 4-digit security PIN." };
      }
    }

    let timer = await prisma.therapySessionTimer.findUnique({
      where: { appointmentId: params.appointmentId },
    });
    if (!timer) {
      return { success: false, message: "Therapy session timer record not found." };
    }

    const current = recalculateTimer(timer);

    current.modalities.forEach((m) => {
      m.isRunning = false;
    });

    const updated = await prisma.therapySessionTimer.update({
      where: { id: timer.id },
      data: {
        isRunning: false,
        lastStartedAt: null,
        modalities: JSON.stringify(current.modalities),
      },
    });

    const result = recalculateTimer(updated);

    emitRealtimeEvent("THERAPY_TIMER_UPDATED", {
      appointmentId: params.appointmentId,
      patientId: updated.patientId,
      action: "PAUSE",
      stepIndex: result.currentStepIndex,
    });

    revalidatePath("/handler");
    return { success: true, timer: result, message: "Timer paused." };
  } catch (error) {
    console.error("[pauseTherapyTimerAction Error]:", error);
    return { success: false, message: "Failed to pause timer." };
  }
}

/**
 * Skip current modality and advance to next (Requires Handler PIN)
 */
export async function skipTherapyTimerAction(params: {
  appointmentId: string;
  performerId: string;
  pin: string;
}): Promise<{ success: boolean; timer?: TherapyTimerState; message: string }> {
  try {
    const sessionData = await requireAuth([Role.HANDLER, Role.DOCTOR, Role.ADMIN]);

    const isExempt = sessionData.user.role === Role.ADMIN || sessionData.user.role === Role.DOCTOR;
    if (!isExempt) {
      const pinRes = await verifyPerformerPin(params.performerId, params.pin);
      if (!pinRes.valid) {
        return { success: false, message: pinRes.error || "Invalid 4-digit security PIN." };
      }
    }

    let timer = await prisma.therapySessionTimer.findUnique({
      where: { appointmentId: params.appointmentId },
    });
    if (!timer) {
      return { success: false, message: "Therapy session timer record not found." };
    }

    const current = recalculateTimer(timer);
    const currIdx = current.currentStepIndex;

    if (current.modalities[currIdx]) {
      current.modalities[currIdx].isSkipped = true;
      current.modalities[currIdx].isRunning = false;
    }

    let nextIdx = currIdx;
    if (currIdx + 1 < current.modalities.length) {
      nextIdx = currIdx + 1;
    }

    const updated = await prisma.therapySessionTimer.update({
      where: { id: timer.id },
      data: {
        currentStepIndex: nextIdx,
        isRunning: false,
        lastStartedAt: null,
        modalities: JSON.stringify(current.modalities),
      },
    });

    const result = recalculateTimer(updated);

    emitRealtimeEvent("THERAPY_TIMER_UPDATED", {
      appointmentId: params.appointmentId,
      patientId: updated.patientId,
      action: "SKIP",
      stepIndex: nextIdx,
    });

    revalidatePath("/handler");
    return { success: true, timer: result, message: "Modality skipped. Advanced to next step." };
  } catch (error) {
    console.error("[skipTherapyTimerAction Error]:", error);
    return { success: false, message: "Failed to skip modality." };
  }
}

/**
 * Advance or complete modality upon countdown reaching 0
 */
export async function completeCurrentModalityAction(params: {
  appointmentId: string;
  stepIndex: number;
}): Promise<{ success: boolean; timer?: TherapyTimerState; message: string }> {
  try {
    await requireAuth([Role.HANDLER, Role.DOCTOR, Role.ADMIN]);

    let timer = await prisma.therapySessionTimer.findUnique({
      where: { appointmentId: params.appointmentId },
    });
    if (!timer) {
      return { success: false, message: "Therapy timer not found." };
    }

    const current = recalculateTimer(timer);
    const currIdx = params.stepIndex;

    if (current.modalities[currIdx]) {
      current.modalities[currIdx].isCompleted = true;
      current.modalities[currIdx].remainingSeconds = 0;
      current.modalities[currIdx].isRunning = false;
    }

    let nextIdx = currIdx;
    if (currIdx + 1 < current.modalities.length) {
      nextIdx = currIdx + 1;
    }

    const updated = await prisma.therapySessionTimer.update({
      where: { id: timer.id },
      data: {
        currentStepIndex: nextIdx,
        isRunning: false,
        lastStartedAt: null,
        modalities: JSON.stringify(current.modalities),
      },
    });

    const result = recalculateTimer(updated);

    emitRealtimeEvent("THERAPY_TIMER_UPDATED", {
      appointmentId: params.appointmentId,
      patientId: updated.patientId,
      action: "COMPLETE_STEP",
      stepIndex: nextIdx,
    });

    revalidatePath("/handler");
    return { success: true, timer: result, message: "Modality completed." };
  } catch (error) {
    console.error("[completeCurrentModalityAction Error]:", error);
    return { success: false, message: "Failed to complete modality." };
  }
}

/**
 * Reset all timers back to original prescribed times (Requires Handler PIN)
 */
export async function resetTherapyTimerAction(params: {
  appointmentId: string;
  performerId: string;
  pin: string;
}): Promise<{ success: boolean; timer?: TherapyTimerState; message: string }> {
  try {
    const sessionData = await requireAuth([Role.HANDLER, Role.DOCTOR, Role.ADMIN]);

    const isExempt = sessionData.user.role === Role.ADMIN || sessionData.user.role === Role.DOCTOR;
    if (!isExempt) {
      const pinRes = await verifyPerformerPin(params.performerId, params.pin);
      if (!pinRes.valid) {
        return { success: false, message: pinRes.error || "Invalid 4-digit security PIN." };
      }
    }

    let timer = await prisma.therapySessionTimer.findUnique({
      where: { appointmentId: params.appointmentId },
    });
    if (!timer) {
      return { success: false, message: "Timer not found." };
    }

    const current = recalculateTimer(timer);

    current.modalities.forEach((m) => {
      m.remainingSeconds = m.totalSeconds;
      m.isCompleted = false;
      m.isSkipped = false;
      m.isRunning = false;
    });

    const updated = await prisma.therapySessionTimer.update({
      where: { id: timer.id },
      data: {
        currentStepIndex: 0,
        isRunning: false,
        lastStartedAt: null,
        modalities: JSON.stringify(current.modalities),
      },
    });

    const result = recalculateTimer(updated);

    emitRealtimeEvent("THERAPY_TIMER_UPDATED", {
      appointmentId: params.appointmentId,
      patientId: updated.patientId,
      action: "RESET",
      stepIndex: 0,
    });

    revalidatePath("/handler");
    return { success: true, timer: result, message: "Timers reset to initial plan." };
  } catch (error) {
    console.error("[resetTherapyTimerAction Error]:", error);
    return { success: false, message: "Failed to reset timer." };
  }
}
