"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw, CheckCircle2, Clock, Bell, FastForward, Loader2, Sparkles } from "lucide-react";
import {
  getTherapyTimerAction,
  startTherapyTimerAction,
  pauseTherapyTimerAction,
  skipTherapyTimerAction,
  completeCurrentModalityAction,
  resetTherapyTimerAction,
  type TherapyTimerState,
  type ModalityTimerItem,
} from "@/actions/handler/handler-timer.action";
import { TimerPinDialog, type TimerActionType } from "@/components/handler/timer-pin-dialog";
import type { PerformerModel } from "@/generated/prisma/models";
import { useRealtimeEvents } from "@/hooks/use-realtime-events";
import { toast } from "sonner";

interface ModalityTimersWidgetProps {
  appointmentId?: string;
  patientId?: string;
  roomNumber?: string | null;
  bedNumber?: string;
  modalities?: string[];
  initialModalityItems?: { name: string; durationMinutes?: number; order?: number }[];
  handlers?: PerformerModel[];
}

export function ModalityTimersWidget({
  appointmentId,
  patientId,
  roomNumber,
  bedNumber,
  modalities = [],
  initialModalityItems = [],
  handlers = [],
}: ModalityTimersWidgetProps) {
  const [timerState, setTimerState] = React.useState<TherapyTimerState | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(Boolean(appointmentId));
  const [displayRemaining, setDisplayRemaining] = React.useState<number>(0);

  // PIN Authorization Modal State
  const [pinAction, setPinAction] = React.useState<TimerActionType | null>(null);
  const [targetStepIndex, setTargetStepIndex] = React.useState<number>(0);

  const audioCtxRef = React.useRef<AudioContext | null>(null);

  // Fetch / Sync Timer from Server
  const loadServerTimer = React.useCallback(async () => {
    if (!appointmentId || !patientId) return;
    try {
      const itemsToPass =
        initialModalityItems.length > 0
          ? initialModalityItems
          : modalities.map((name, idx) => ({ name, durationMinutes: 15, order: idx + 1 }));

      const res = await getTherapyTimerAction({
        appointmentId,
        patientId,
        roomNumber,
        initialModalities: itemsToPass,
      });

      if (res.success && res.timer) {
        setTimerState(res.timer);
        const curr = res.timer.modalities[res.timer.currentStepIndex];
        if (curr) {
          setDisplayRemaining(curr.remainingSeconds);
        }
      }
    } catch (err) {
      console.error("[ModalityTimersWidget Sync Error]:", err);
    } finally {
      setIsLoading(false);
    }
  }, [appointmentId, patientId, roomNumber, initialModalityItems, modalities]);

  // Initial load
  React.useEffect(() => {
    void loadServerTimer();
  }, [loadServerTimer]);

  // Real-time synchronization across all devices
  useRealtimeEvents({
    onEvent: (event) => {
      if (
        event.type === "THERAPY_TIMER_UPDATED" &&
        (!appointmentId || (event.data as any)?.appointmentId === appointmentId)
      ) {
        void loadServerTimer();
      }
    },
  });

  // Play completion notification sound via Web Audio API
  const playTimerCompleteChime = React.useCallback(() => {
    try {
      if (typeof window === "undefined") return;
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch {}
      };

      osc.start();
      osc.stop(ctx.currentTime + 1.2);
    } catch {}
  }, []);

  // Live Countdown Tick
  React.useEffect(() => {
    if (!timerState || !timerState.isRunning || !timerState.lastStartedAt) return;

    const currModality = timerState.modalities[timerState.currentStepIndex];
    if (!currModality) return;

    const startedTime = new Date(timerState.lastStartedAt).getTime();
    const initialRemaining = currModality.remainingSeconds;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedTime) / 1000);
      const remaining = Math.max(0, initialRemaining - elapsed);
      setDisplayRemaining(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        playTimerCompleteChime();
        toast.success(`Time's up for ${currModality.name}! Advancing to next modality.`);

        if (appointmentId) {
          void completeCurrentModalityAction({
            appointmentId,
            stepIndex: timerState.currentStepIndex,
          }).then((res) => {
            if (res.success && res.timer) {
              setTimerState(res.timer);
            }
          });
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [timerState, appointmentId, playTimerCompleteChime]);

  // Fallback to local state if no appointmentId passed
  if (!appointmentId) {
    return null;
  }

  if (isLoading && !timerState) {
    return (
      <div className="w-full p-4 rounded-xl border border-border/80 bg-card/60 flex items-center justify-center gap-2 text-xs text-muted-foreground mt-2">
        <Loader2 className="size-4 animate-spin text-primary" />
        <span>Loading live bed timers...</span>
      </div>
    );
  }

  const modalitiesList = timerState?.modalities || [];
  if (modalitiesList.length === 0) return null;

  const currentStep = timerState?.currentStepIndex ?? 0;
  const activeModality = modalitiesList[currentStep];

  // Actions triggering PIN Dialog
  const handleOpenPin = (action: TimerActionType, stepIdx: number) => {
    setPinAction(action);
    setTargetStepIndex(stepIdx);
  };

  const handleExecutePinAction = async (performerId: string, pin: string) => {
    if (!appointmentId || !pinAction) return;

    if (pinAction === "START") {
      const res = await startTherapyTimerAction({
        appointmentId,
        performerId,
        pin,
        stepIndex: targetStepIndex,
      });
      if (res.success && res.timer) {
        setTimerState(res.timer);
        toast.success(res.message);
      } else {
        toast.error(res.message);
        throw new Error(res.message);
      }
    } else if (pinAction === "PAUSE") {
      const res = await pauseTherapyTimerAction({
        appointmentId,
        performerId,
        pin,
      });
      if (res.success && res.timer) {
        setTimerState(res.timer);
        toast.success(res.message);
      } else {
        toast.error(res.message);
        throw new Error(res.message);
      }
    } else if (pinAction === "SKIP") {
      const res = await skipTherapyTimerAction({
        appointmentId,
        performerId,
        pin,
      });
      if (res.success && res.timer) {
        setTimerState(res.timer);
        toast.success(res.message);
      } else {
        toast.error(res.message);
        throw new Error(res.message);
      }
    } else if (pinAction === "RESET") {
      const res = await resetTherapyTimerAction({
        appointmentId,
        performerId,
        pin,
      });
      if (res.success && res.timer) {
        setTimerState(res.timer);
        toast.success(res.message);
      } else {
        toast.error(res.message);
        throw new Error(res.message);
      }
    }
  };

  return (
    <div className="w-full bg-card/95 rounded-2xl border border-border/80 p-3.5 mt-2 space-y-3 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
            <Clock className="size-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <span>Per-Bed Prescribed Therapy Timers</span>
              {timerState?.isRunning && (
                <span className="size-2 rounded-full bg-emerald-500 animate-ping inline-block" />
              )}
            </h4>
            <p className="text-[10px] text-muted-foreground">
              Live synchronized across all clinic devices • Auto-advances when finished
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            size="xs"
            variant="ghost"
            onClick={() => handleOpenPin("RESET", 0)}
            className="h-6 px-2 text-[10.5px] font-semibold text-muted-foreground hover:text-foreground cursor-pointer gap-1"
            title="Reset All Timers"
          >
            <RotateCcw className="size-3" />
            <span>Reset</span>
          </Button>
        </div>
      </div>

      {/* Sequenced Modality Timers Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {modalitiesList.map((timer, index) => {
          const isCurrent = index === currentStep;
          const isDone = timer.isCompleted;
          const isSkipped = timer.isSkipped;
          const isRunning = isCurrent && Boolean(timerState?.isRunning);

          const remSeconds = isRunning ? displayRemaining : timer.remainingSeconds;
          const mins = Math.floor(remSeconds / 60);
          const secs = remSeconds % 60;
          const formatted = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

          return (
            <div
              key={timer.id || `${timer.name}-${index}`}
              className={`p-3 rounded-xl border transition-all flex flex-col justify-between gap-2 ${
                isDone
                  ? "bg-emerald-500/5 border-emerald-500/30 opacity-80"
                  : isSkipped
                    ? "bg-muted/40 border-border/60 opacity-60 line-through"
                    : isRunning
                      ? "bg-emerald-500/10 border-emerald-500/50 shadow-sm ring-1 ring-emerald-500/30"
                      : isCurrent
                        ? "bg-card border-primary/40 shadow-2xs"
                        : "bg-muted/20 border-border/70"
              }`}
            >
              {/* Top: Step Number, Name & Status */}
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={`size-5 rounded-full font-mono font-bold text-[10px] flex items-center justify-center shrink-0 ${
                      isDone
                        ? "bg-emerald-500 text-white"
                        : isRunning
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span className="font-bold text-xs text-foreground truncate" title={timer.name}>
                    {timer.name}
                  </span>
                </div>

                {isDone ? (
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[9.5px] font-bold flex items-center gap-1 shrink-0">
                    <CheckCircle2 className="size-2.5" />
                    DONE
                  </span>
                ) : isSkipped ? (
                  <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[9.5px] font-semibold shrink-0">
                    SKIPPED
                  </span>
                ) : (
                  <span
                    className={`font-mono text-xs font-black shrink-0 ${
                      isRunning ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                    }`}
                  >
                    {formatted}
                  </span>
                )}
              </div>

              {/* Bottom: Controls */}
              <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-border/50 text-[10.5px]">
                <span className="text-[10px] font-mono text-muted-foreground">
                  Prescribed: {timer.durationMinutes}m
                </span>

                <div className="flex items-center gap-1">
                  {isCurrent && (
                    <>
                      {isRunning ? (
                        <Button
                          size="xs"
                          type="button"
                          onClick={() => handleOpenPin("PAUSE", index)}
                          className="h-6 px-2 text-[10px] font-bold cursor-pointer gap-1 bg-amber-600 hover:bg-amber-700 text-white"
                        >
                          <Pause className="size-2.5" />
                          <span>Pause</span>
                        </Button>
                      ) : (
                        <Button
                          size="xs"
                          type="button"
                          onClick={() => handleOpenPin("START", index)}
                          className="h-6 px-2 text-[10px] font-bold cursor-pointer gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <Play className="size-2.5" />
                          <span>Start</span>
                        </Button>
                      )}

                      <Button
                        size="xs"
                        variant="ghost"
                        type="button"
                        onClick={() => handleOpenPin("SKIP", index)}
                        className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer gap-1"
                        title="Skip to next modality"
                      >
                        <FastForward className="size-2.5" />
                        <span>Skip</span>
                      </Button>
                    </>
                  )}

                  {!isCurrent && !isDone && (
                    <Button
                      size="xs"
                      variant="outline"
                      type="button"
                      onClick={() => handleOpenPin("START", index)}
                      className="h-6 px-1.5 text-[9.5px] font-semibold cursor-pointer border-border/80"
                    >
                      Jump Here
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Performer PIN Dialog */}
      {pinAction && activeModality && (
        <TimerPinDialog
          isOpen={Boolean(pinAction)}
          onOpenChange={(open) => {
            if (!open) setPinAction(null);
          }}
          actionType={pinAction}
          modalityName={modalitiesList[targetStepIndex]?.name || activeModality.name}
          stepNumber={targetStepIndex + 1}
          handlers={handlers}
          onConfirm={handleExecutePinAction}
        />
      )}
    </div>
  );
}
