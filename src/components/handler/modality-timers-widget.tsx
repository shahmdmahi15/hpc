"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw, CheckCircle2, Clock, Bell } from "lucide-react";

interface ModalityTimer {
  id: string;
  name: string;
  totalSeconds: number;
  remainingSeconds: number;
  isRunning: boolean;
  isCompleted: boolean;
}

interface ModalityTimersWidgetProps {
  modalities: string[];
}

export function ModalityTimersWidget({ modalities }: ModalityTimersWidgetProps) {
  const [timers, setTimers] = React.useState<ModalityTimer[]>(() =>
    modalities.map((name, index) => ({
      id: `${name}-${index}`,
      name,
      totalSeconds: 15 * 60, // 15 mins default
      remainingSeconds: 15 * 60,
      isRunning: false,
      isCompleted: false,
    })),
  );

  // Play completion notification sound via native Web Audio API
  const playTimerCompleteChime = React.useCallback(() => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 1.2);
    } catch {
      // Audio fallback
    }
  }, []);

  // Countdown Interval
  React.useEffect(() => {
    const hasRunning = timers.some((t) => t.isRunning);
    if (!hasRunning) return;

    const interval = setInterval(() => {
      setTimers((prev) =>
        prev.map((t) => {
          if (!t.isRunning) return t;
          if (t.remainingSeconds <= 1) {
            playTimerCompleteChime();
            return {
              ...t,
              remainingSeconds: 0,
              isRunning: false,
              isCompleted: true,
            };
          }
          return { ...t, remainingSeconds: t.remainingSeconds - 1 };
        }),
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [timers, playTimerCompleteChime]);

  const toggleTimer = (id: string) => {
    setTimers((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              isRunning: !t.isRunning,
              isCompleted: t.remainingSeconds === 0 ? false : t.isCompleted,
            }
          : t,
      ),
    );
  };

  const resetTimer = (id: string, mins = 15) => {
    setTimers((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              totalSeconds: mins * 60,
              remainingSeconds: mins * 60,
              isRunning: false,
              isCompleted: false,
            }
          : t,
      ),
    );
  };

  const setDuration = (id: string, mins: number) => {
    setTimers((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              totalSeconds: mins * 60,
              remainingSeconds: mins * 60,
              isRunning: false,
              isCompleted: false,
            }
          : t,
      ),
    );
  };

  if (modalities.length === 0) return null;

  return (
    <div className="w-full bg-card/90 rounded-xl border border-border/80 p-3 mt-2 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
          <Clock className="size-3.5 text-emerald-500" />
          <span>Active Therapy Modality Timers</span>
        </span>
        <span className="text-[10px] text-muted-foreground font-mono">
          Independent Bed Timers
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {timers.map((timer) => {
          const mins = Math.floor(timer.remainingSeconds / 60);
          const secs = timer.remainingSeconds % 60;
          const formatted = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
          const isDone = timer.isCompleted || timer.remainingSeconds === 0;
          const isWarning = timer.remainingSeconds > 0 && timer.remainingSeconds <= 120;

          return (
            <div
              key={timer.id}
              className={`p-2.5 rounded-lg border transition-all ${
                isDone
                  ? "bg-red-500/10 border-red-500/40"
                  : timer.isRunning
                    ? isWarning
                      ? "bg-amber-500/10 border-amber-500/40"
                      : "bg-emerald-500/10 border-emerald-500/40"
                    : "bg-muted/30 border-border/70"
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="font-bold text-xs text-foreground truncate">
                  {timer.name}
                </span>
                {isDone ? (
                  <span className="px-1.5 py-0.2 rounded bg-red-500 text-white text-[9.5px] font-bold animate-pulse flex items-center gap-1">
                    <Bell className="size-2.5" />
                    TIME UP
                  </span>
                ) : (
                  <span
                    className={`font-mono text-xs font-bold ${
                      timer.isRunning ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                    }`}
                  >
                    {formatted}
                  </span>
                )}
              </div>

              {/* Time Presets & Controls */}
              <div className="flex items-center justify-between gap-1.5 mt-2 pt-1.5 border-t border-border/50 text-[10px]">
                <div className="flex items-center gap-1">
                  {[10, 15, 20].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setDuration(timer.id, m)}
                      className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono cursor-pointer transition-colors ${
                        timer.totalSeconds === m * 60
                          ? "bg-primary text-primary-foreground font-bold"
                          : "bg-muted hover:bg-muted/80 text-muted-foreground"
                      }`}
                    >
                      {m}m
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    size="xs"
                    onClick={() => toggleTimer(timer.id)}
                    className={`h-6 px-2 text-[10px] font-bold cursor-pointer gap-1 ${
                      timer.isRunning
                        ? "bg-amber-600 hover:bg-amber-500 text-white"
                        : "bg-emerald-600 hover:bg-emerald-500 text-white"
                    }`}
                  >
                    {timer.isRunning ? (
                      <>
                        <Pause className="size-2.5" />
                        <span>Pause</span>
                      </>
                    ) : (
                      <>
                        <Play className="size-2.5" />
                        <span>Start</span>
                      </>
                    )}
                  </Button>

                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => resetTimer(timer.id, Math.round(timer.totalSeconds / 60))}
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                    title="Reset Timer"
                  >
                    <RotateCcw className="size-2.5" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
