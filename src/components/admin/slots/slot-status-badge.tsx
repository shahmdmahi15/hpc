"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { SlotStatus } from "@/generated/prisma/enums";
import {
  CheckCircle2,
  AlertCircle,
  Ban,
  XCircle,
  Lock,
  Unlock,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SlotStatusBadgeProps {
  status: SlotStatus;
  className?: string;
}

export function SlotStatusBadge({ status, className }: SlotStatusBadgeProps) {
  switch (status) {
    case SlotStatus.OPEN:
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
            className,
          )}
        >
          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Open
        </span>
      );
    case SlotStatus.FULL:
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
            className,
          )}
        >
          <span className="size-1.5 rounded-full bg-amber-500" />
          Capacity Full
        </span>
      );
    case SlotStatus.BLOCKED:
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20",
            className,
          )}
        >
          <span className="size-1.5 rounded-full bg-rose-500" />
          Blocked
        </span>
      );
    case SlotStatus.CANCELLED:
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border",
            className,
          )}
        >
          <span className="size-1.5 rounded-full bg-muted-foreground/60" />
          Cancelled
        </span>
      );
    default:
      return (
        <Badge variant="outline" className={className}>
          {status}
        </Badge>
      );
  }
}

interface ExtraSlotBadgeProps {
  isUnlocked: boolean;
  approverName?: string | null;
  className?: string;
}

export function ExtraSlotBadge({
  isUnlocked,
  approverName,
  className,
}: ExtraSlotBadgeProps) {
  if (isUnlocked) {
    return (
      <Badge
        variant="outline"
        className={cn(
          "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 gap-1 font-semibold text-[11px] px-2 py-0.5",
          className,
        )}
        title={
          approverName
            ? `Extra slots approved & unlocked by ${approverName}`
            : "Extra slots unlocked"
        }
      >
        <Unlock className="size-3 text-blue-500" />
        <span>Unlocked (+2 Extra)</span>
        {approverName && (
          <span className="text-[9.5px] opacity-80 border-l border-blue-500/30 pl-1 ml-0.5">
            {approverName}
          </span>
        )}
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20 gap-1 font-medium text-[11px] px-2 py-0.5",
        className,
      )}
      title="Requires Doctor or Admin approval to unlock 2 extra slots (1 Male, 1 Female)"
    >
      <Lock className="size-3 text-zinc-400" />
      <span>Extra Slots Locked</span>
    </Badge>
  );
}

interface QuotaBarProps {
  label: "Male" | "Female";
  booked: number;
  capacity: number;
  className?: string;
}

export function QuotaBar({
  label,
  booked,
  capacity,
  className,
}: QuotaBarProps) {
  const isMale = label === "Male";
  const percentage =
    capacity > 0 ? Math.min(100, Math.round((booked / capacity) * 100)) : 0;
  const isFull = booked >= capacity && capacity > 0;

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between text-xs">
        <span
          className={cn(
            "font-semibold flex items-center gap-1",
            isMale
              ? "text-sky-600 dark:text-sky-400"
              : "text-pink-600 dark:text-pink-400",
          )}
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              isMale ? "bg-sky-500" : "bg-pink-500",
            )}
          />
          {label}
        </span>
        <span className="font-mono font-medium text-[11px] text-muted-foreground">
          {booked}/{capacity}
          {isFull && (
            <span className="ml-1 text-[10px] text-amber-500 font-bold">
              FULL
            </span>
          )}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full transition-all duration-300 rounded-full",
            isMale
              ? isFull
                ? "bg-amber-500"
                : "bg-sky-500"
              : isFull
                ? "bg-amber-500"
                : "bg-pink-500",
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
