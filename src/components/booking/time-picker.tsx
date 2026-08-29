"use client";

import * as React from "react";
import { Clock, Check, Sparkles } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface TimePickerProps {
  value: string; // e.g. "11:00 AM", "02:30 PM", "14:20", etc.
  onChange: (timeStr: string) => void;
  label?: string;
  slotLabel?: string; // e.g. "11:00 AM - 12:00 PM"
  error?: string;
  disabled?: boolean;
  className?: string;
}

const HOURS = [
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08",
  "09",
  "10",
  "11",
  "12",
];
const MINUTES = [
  "00",
  "05",
  "10",
  "15",
  "20",
  "25",
  "30",
  "35",
  "40",
  "45",
  "50",
  "55",
];

function parseTimeString(raw: string): {
  hour: string;
  minute: string;
  period: "AM" | "PM";
} {
  if (!raw || typeof raw !== "string") {
    return { hour: "11", minute: "00", period: "AM" };
  }

  // Clean extra tokens like (+10m)
  const cleaned = raw.replace(/\(\+.*?\)/g, "").trim();

  // Match 12h: "11:30 AM" or "02:15 PM"
  const match12 = cleaned.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    let h = parseInt(match12[1], 10);
    const m = match12[2];
    const p = match12[3].toUpperCase() as "AM" | "PM";
    if (h === 0) h = 12;
    if (h > 12) h = h % 12;
    return {
      hour: String(h).padStart(2, "0"),
      minute: m,
      period: p,
    };
  }

  // Match 24h: "14:30" or "09:15"
  const match24 = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    let h = parseInt(match24[1], 10);
    const m = match24[2];
    const p: "AM" | "PM" = h >= 12 ? "PM" : "AM";
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    return {
      hour: String(h).padStart(2, "0"),
      minute: m,
      period: p,
    };
  }

  return { hour: "11", minute: "00", period: "AM" };
}

export function PromisedTimePicker({
  value,
  onChange,
  label = "Promised Arrival Time (Told Time / আসার সময়)",
  slotLabel,
  error,
  disabled = false,
  className = "",
}: TimePickerProps) {
  const parsed = React.useMemo(() => parseTimeString(value), [value]);

  const [hour, setHour] = React.useState(parsed.hour);
  const [minute, setMinute] = React.useState(parsed.minute);
  const [period, setPeriod] = React.useState<"AM" | "PM">(parsed.period);

  React.useEffect(() => {
    const p = parseTimeString(value);
    setHour(p.hour);
    setMinute(p.minute);
    setPeriod(p.period);
  }, [value]);

  const updateTime = (newH: string, newM: string, newP: "AM" | "PM") => {
    setHour(newH);
    setMinute(newM);
    setPeriod(newP);
    const formatted = `${newH}:${newM} ${newP}`;
    onChange(formatted);
  };

  // Generate slot quick chips based on slotLabel or default clinic hours
  const quickSlotChips = React.useMemo(() => {
    if (!slotLabel) {
      return [
        "10:00 AM",
        "11:00 AM",
        "12:00 PM",
        "02:00 PM",
        "03:30 PM",
        "05:00 PM",
        "06:30 PM",
        "07:30 PM",
      ];
    }

    // Try parsing slot start time, e.g. "11:00 AM - 12:00 PM"
    const parts = slotLabel.split("-");
    const startStr = parts[0]?.trim();
    const startParsed = parseTimeString(startStr);
    const startH = parseInt(startParsed.hour, 10);
    const startP = startParsed.period;

    // Build 10-minute intervals within this hour
    const chips: string[] = [];
    const minSteps = ["00", "10", "20", "30", "40", "50"];
    for (const m of minSteps) {
      chips.push(`${String(startH).padStart(2, "0")}:${m} ${startP}`);
    }
    return chips;
  }, [slotLabel]);

  const currentFormatted = `${hour}:${minute} ${period}`;

  return (
    <div className={`space-y-2.5 ${className}`}>
      {/* Label and Selected Time Badge */}
      <div className="flex items-center justify-between flex-wrap gap-1">
        <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-primary" />
          <span>{label}</span>
          <span className="text-destructive">*</span>
        </Label>
        <div className="flex items-center gap-1.5 font-mono">
          <span className="text-[10px] text-muted-foreground">
            Promised At:
          </span>
          <Badge
            variant="default"
            className="text-xs font-mono font-bold bg-primary text-primary-foreground shadow-2xs"
          >
            {currentFormatted}
          </Badge>
        </div>
      </div>

      {/* Main Interactive Time Picker Controls */}
      <div className="p-3 rounded-2xl bg-muted/40 border border-border/80 space-y-3 shadow-2xs">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            {/* Hour Selector */}
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground block font-medium">
                Hour
              </span>
              <Select
                value={hour}
                onValueChange={(val) => val && updateTime(val, minute, period)}
                disabled={disabled}
              >
                <SelectTrigger className="w-[74px] h-9 text-xs font-mono font-bold bg-background">
                  <SelectValue placeholder="Hour" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {HOURS.map((h) => (
                    <SelectItem key={h} value={h} className="font-mono text-xs">
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <span className="font-mono font-black text-base text-muted-foreground pt-4">
              :
            </span>

            {/* Minute Selector */}
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground block font-medium">
                Minute
              </span>
              <Select
                value={minute}
                onValueChange={(val) => val && updateTime(hour, val, period)}
                disabled={disabled}
              >
                <SelectTrigger className="w-[74px] h-9 text-xs font-mono font-bold bg-background">
                  <SelectValue placeholder="Min" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {MINUTES.map((m) => (
                    <SelectItem key={m} value={m} className="font-mono text-xs">
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* AM / PM Toggle Buttons */}
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground block font-medium">
                Period
              </span>
              <div className="flex items-center rounded-lg border border-border bg-background p-0.5 h-9">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => updateTime(hour, minute, "AM")}
                  className={`px-2.5 py-1 text-xs font-bold font-mono rounded-md transition-all cursor-pointer ${
                    period === "AM"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  AM
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => updateTime(hour, minute, "PM")}
                  className={`px-2.5 py-1 text-xs font-bold font-mono rounded-md transition-all cursor-pointer ${
                    period === "PM"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  PM
                </button>
              </div>
            </div>
          </div>

          {/* Native HTML5 Time Input Sync */}
          <div className="space-y-1">
            <span className="text-[10px] text-muted-foreground block font-medium">
              Browser Picker
            </span>
            <input
              type="time"
              disabled={disabled}
              value={(() => {
                let h24 = parseInt(hour, 10);
                if (period === "PM" && h24 < 12) h24 += 12;
                if (period === "AM" && h24 === 12) h24 = 0;
                return `${String(h24).padStart(2, "0")}:${minute}`;
              })()}
              onChange={(e) => {
                if (e.target.value) {
                  const p24 = parseTimeString(e.target.value);
                  updateTime(p24.hour, p24.minute, p24.period);
                }
              }}
              className="h-9 px-2 rounded-lg border border-border bg-background text-xs font-mono font-semibold text-foreground cursor-pointer focus:ring-1 focus:ring-primary outline-none"
            />
          </div>
        </div>

        {/* Quick Arrival Slot Preset Chips */}
        <div className="space-y-1 pt-1 border-t border-border/60">
          <span className="text-[10px] font-semibold text-muted-foreground block">
            Quick 1-Click Arrival Presets for this Slot:
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {quickSlotChips.map((chipTime) => {
              const isChipActive = currentFormatted === chipTime;
              return (
                <Button
                  key={chipTime}
                  type="button"
                  size="sm"
                  variant={isChipActive ? "default" : "outline"}
                  disabled={disabled}
                  className={`h-6 text-[11px] px-2 font-mono font-semibold cursor-pointer transition-all ${
                    isChipActive
                      ? "bg-primary text-primary-foreground shadow-xs font-bold"
                      : "border-border bg-background hover:bg-primary/10 hover:border-primary/50 text-foreground"
                  }`}
                  onClick={() => {
                    const parsedChip = parseTimeString(chipTime);
                    updateTime(
                      parsedChip.hour,
                      parsedChip.minute,
                      parsedChip.period,
                    );
                  }}
                >
                  {isChipActive && <Check className="h-2.5 w-2.5 mr-0.5" />}
                  <span>{chipTime}</span>
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      {error && (
        <p className="text-[11px] font-semibold text-destructive flex items-center gap-1">
          <Clock className="h-3 w-3 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
