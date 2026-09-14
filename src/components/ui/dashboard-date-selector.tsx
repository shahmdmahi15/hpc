"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  RotateCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface DashboardDateSelectorProps {
  selectedDate: string;
  dayOfWeek?: string;
  onSelectDate: (date: string) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  className?: string;
}

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const DAY_NAMES = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

export function DashboardDateSelector({
  selectedDate,
  dayOfWeek,
  onSelectDate,
  onRefresh,
  isRefreshing = false,
  className,
}: DashboardDateSelectorProps) {
  const isToday = selectedDate === formatLocalDate(new Date());

  const computedDay = React.useMemo(() => {
    if (dayOfWeek) return dayOfWeek;
    try {
      const [y, m, d] = selectedDate.split("-").map(Number);
      if (!y || !m || !d) return "";
      const date = new Date(y, m - 1, d);
      return DAY_NAMES[date.getDay()] || "";
    } catch {
      return "";
    }
  }, [selectedDate, dayOfWeek]);

  const handleSetToday = () => {
    onSelectDate(formatLocalDate(new Date()));
  };

  const handleStepDate = (daysDelta: number) => {
    try {
      const [y, m, d] = selectedDate.split("-").map(Number);
      const date = new Date(y, m - 1, d);
      date.setDate(date.getDate() + daysDelta);
      onSelectDate(formatLocalDate(date));
    } catch {
      // Fallback
    }
  };

  return (
    <div
      className={cn(
        "flex items-center gap-1 bg-background/90 p-1 rounded-lg border border-border/80 shadow-2xs shrink-0",
        className,
      )}
    >
      <Button
        type="button"
        variant={isToday ? "secondary" : "ghost"}
        size="sm"
        className="h-7 text-xs px-2.5 rounded-md font-semibold cursor-pointer"
        onClick={handleSetToday}
        title="Jump to Today"
      >
        Today
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7 rounded-md text-muted-foreground hover:text-foreground cursor-pointer"
        onClick={() => handleStepDate(-1)}
        title="Previous Day"
      >
        <ChevronLeft className="size-3.5" />
      </Button>

      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/40 border border-border/60">
        <CalendarDays className="size-3.5 text-primary shrink-0" />
        <Input
          type="date"
          value={selectedDate}
          onChange={(e) => e.target.value && onSelectDate(e.target.value)}
          className="h-6 w-[125px] text-xs font-mono bg-transparent border-0 p-0 focus-visible:ring-0 cursor-pointer text-foreground"
        />
        {computedDay && (
          <span className="px-1.5 py-0.2 rounded bg-primary/10 text-primary font-bold text-[10px] border border-primary/20 uppercase">
            {computedDay}
          </span>
        )}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7 rounded-md text-muted-foreground hover:text-foreground cursor-pointer"
        onClick={() => handleStepDate(1)}
        title="Next Day"
      >
        <ChevronRight className="size-3.5" />
      </Button>

      {onRefresh && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 rounded-md text-muted-foreground hover:text-foreground cursor-pointer"
          onClick={onRefresh}
          title="Refresh Register"
        >
          <RotateCw
            className={cn(
              "size-3.5",
              isRefreshing && "animate-spin text-primary",
            )}
          />
        </Button>
      )}
    </div>
  );
}
