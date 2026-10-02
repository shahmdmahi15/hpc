"use client";

import * as React from "react";
import { Clock } from "lucide-react";

interface ConsultationTimerProps {
  startTime?: Date | string | null;
  className?: string;
}

export function ConsultationTimer({
  startTime,
  className = "",
}: ConsultationTimerProps) {
  const [elapsedSeconds, setElapsedSeconds] = React.useState<number>(0);

  React.useEffect(() => {
    if (!startTime) {
      setElapsedSeconds(0);
      return;
    }

    const startMs = new Date(startTime).getTime();

    const updateTimer = () => {
      const nowMs = Date.now();
      const diffSec = Math.max(0, Math.floor((nowMs - startMs) / 1000));
      setElapsedSeconds(diffSec);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  const formatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  // Color threshold: Green < 15m, Amber 15-25m, Red > 25m
  let colorStyles = "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
  if (minutes >= 25) {
    colorStyles = "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40 animate-pulse";
  } else if (minutes >= 15) {
    colorStyles = "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40";
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-mono font-bold shadow-2xs ${colorStyles} ${className}`}
      title="Elapsed consultation time"
    >
      <Clock className="size-3" />
      <span>{formatted}</span>
    </span>
  );
}
