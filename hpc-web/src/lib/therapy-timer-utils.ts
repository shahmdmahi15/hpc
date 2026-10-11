export interface ModalityTimerItem {
  id: string;
  name: string;
  durationMinutes: number;
  totalSeconds: number;
  remainingSeconds: number;
  isRunning: boolean;
  isCompleted: boolean;
  isSkipped: boolean;
  order: number;
}

export interface TherapyTimerState {
  id: string;
  appointmentId: string;
  patientId: string;
  roomNumber: string | null;
  modalities: ModalityTimerItem[];
  currentStepIndex: number;
  isRunning: boolean;
  lastStartedAt: string | null;
  performerId: string | null;
  isAllCompleted: boolean;
}

/**
 * Calculates accurate remaining seconds taking into account server time elapsed
 */
export function recalculateTimer(timer: any): TherapyTimerState {
  let modalities: ModalityTimerItem[] = [];
  try {
    modalities = typeof timer.modalities === "string" ? JSON.parse(timer.modalities) : timer.modalities;
    if (!Array.isArray(modalities)) modalities = [];
  } catch {
    modalities = [];
  }

  let isRunning = Boolean(timer.isRunning);
  let currentStepIndex = timer.currentStepIndex ?? 0;
  let lastStartedAt = timer.lastStartedAt ? new Date(timer.lastStartedAt) : null;

  if (isRunning && lastStartedAt && modalities[currentStepIndex]) {
    const elapsedSeconds = Math.floor((Date.now() - lastStartedAt.getTime()) / 1000);
    const current = modalities[currentStepIndex];
    const newRemaining = Math.max(0, current.remainingSeconds - elapsedSeconds);

    if (newRemaining <= 0) {
      // Current step elapsed! Mark completed
      current.remainingSeconds = 0;
      current.isCompleted = true;
      current.isRunning = false;

      // Automatically advance to next step if available
      if (currentStepIndex + 1 < modalities.length) {
        currentStepIndex += 1;
        modalities[currentStepIndex].isRunning = false;
        // Pause for handler confirmation or next start
        isRunning = false;
        lastStartedAt = null;
      } else {
        isRunning = false;
        lastStartedAt = null;
      }
    } else {
      current.remainingSeconds = newRemaining;
      current.isRunning = true;
    }
  }

  const isAllCompleted = modalities.length > 0 && modalities.every((m) => m.isCompleted || m.isSkipped);

  return {
    id: timer.id,
    appointmentId: timer.appointmentId,
    patientId: timer.patientId,
    roomNumber: timer.roomNumber,
    modalities,
    currentStepIndex,
    isRunning,
    lastStartedAt: lastStartedAt ? lastStartedAt.toISOString() : null,
    performerId: timer.performerId || null,
    isAllCompleted,
  };
}
