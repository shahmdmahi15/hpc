"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  WEEK_DAYS,
  ALL_DAYS,
  WORKING_DAYS_SAT_THU,
  STANDARD_WEEKDAYS_MON_FRI,
  parseWeekDays,
  serializeWeekDays,
  formatWeekDays,
  type DayKey,
} from "@/lib/weekdays";
import { Calendar, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface WeekDaysSelectorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function WeekDaysSelector({
  value,
  onChange,
  className,
}: WeekDaysSelectorProps) {
  const selectedDays = React.useMemo(() => parseWeekDays(value), [value]);

  const toggleDay = (day: DayKey) => {
    let next: DayKey[];
    if (selectedDays.includes(day)) {
      // Don't allow unselecting all days
      if (selectedDays.length <= 1) return;
      next = selectedDays.filter((d) => d !== day);
    } else {
      next = [...selectedDays, day];
    }
    onChange(serializeWeekDays(next));
  };

  const setPreset = (presetDays: DayKey[]) => {
    onChange(serializeWeekDays(presetDays));
  };

  const isAll = selectedDays.length === 7;
  const isSatThu =
    selectedDays.length === 6 &&
    WORKING_DAYS_SAT_THU.every((d) => selectedDays.includes(d));
  const isMonFri =
    selectedDays.length === 5 &&
    STANDARD_WEEKDAYS_MON_FRI.every((d) => selectedDays.includes(d));

  return (
    <div className={cn("space-y-2.5", className)}>
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold flex items-center gap-1.5">
          <Calendar className="size-3.5 text-primary" />
          <span>Active Week Days</span>
        </Label>

        {/* Quick Presets */}
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant={isAll ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setPreset(ALL_DAYS)}
            className="h-6 px-2 text-[10.5px] rounded-lg font-medium cursor-pointer"
          >
            Every Day
          </Button>
          <Button
            type="button"
            variant={isSatThu ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setPreset(WORKING_DAYS_SAT_THU)}
            className="h-6 px-2 text-[10.5px] rounded-lg font-medium cursor-pointer"
          >
            Sat – Thu
          </Button>
          <Button
            type="button"
            variant={isMonFri ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setPreset(STANDARD_WEEKDAYS_MON_FRI)}
            className="h-6 px-2 text-[10.5px] rounded-lg font-medium cursor-pointer"
          >
            Mon – Fri
          </Button>
        </div>
      </div>

      {/* 7 Days Toggle Pills */}
      <div className="grid grid-cols-7 gap-1.5">
        {WEEK_DAYS.map((d) => {
          const active = selectedDays.includes(d.value);
          return (
            <button
              key={d.value}
              type="button"
              onClick={() => toggleDay(d.value)}
              className={cn(
                "flex flex-col items-center justify-center py-2 px-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer select-none",
                active
                  ? "bg-primary text-primary-foreground border-primary shadow-xs"
                  : "bg-muted/30 text-muted-foreground border-border/80 hover:bg-muted/60 hover:text-foreground",
              )}
              title={`${d.label} (${active ? "Active" : "Off"})`}
            >
              <span className="text-[11px] uppercase tracking-wider">
                {d.short}
              </span>
              <span className="text-[9.5px] opacity-80 mt-0.5">
                {active ? "ON" : "OFF"}
              </span>
            </button>
          );
        })}
      </div>

      {/* Live Selected Days Caption */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground bg-muted/20 border border-border/60 rounded-lg px-2.5 py-1.5">
        <span className="flex items-center gap-1.5 font-medium">
          <Check className="size-3 text-emerald-500" />
          <span>Scheduled on:</span>
          <span className="text-foreground font-semibold">
            {formatWeekDays(selectedDays)}
          </span>
        </span>
        <span className="font-mono text-[10.5px]">
          {selectedDays.length}/7 days
        </span>
      </div>
    </div>
  );
}
