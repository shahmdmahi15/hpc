"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import {
  UserCheck,
  ShieldAlert,
  Phone,
  CheckCircle2,
  User,
  AlertCircle,
} from "lucide-react";

export interface ReceptionistPerformer {
  id: string;
  name: string;
  phone: string;
}

interface ReceptionistPerformerSelectProps {
  performers: ReceptionistPerformer[];
  selectedPerformerId: string;
  onSelectPerformerId: (id: string) => void;
  disabled?: boolean;
  label?: string;
  error?: string;
}

export function ReceptionistPerformerSelect({
  performers,
  selectedPerformerId,
  onSelectPerformerId,
  disabled = false,
  label = "Authorizing Receptionist",
  error,
}: ReceptionistPerformerSelectProps) {
  // If exactly 1 performer exists and none is selected, auto-select it
  React.useEffect(() => {
    if (performers.length === 1 && !selectedPerformerId) {
      onSelectPerformerId(performers[0].id);
    }
  }, [performers, selectedPerformerId, onSelectPerformerId]);

  // Case 1: No receptionist performers registered yet (Desk fallback)
  if (performers.length === 0) {
    return (
      <div className="p-3 rounded-xl bg-muted/30 border border-border/60 text-xs flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="size-6 rounded-md bg-primary/10 text-primary flex items-center justify-center">
            <User className="size-3.5" />
          </div>
          <div>
            <span className="font-semibold text-foreground">
              Acting as Reception Desk
            </span>
            <p className="text-[10.5px] text-muted-foreground">
              No individual receptionist profiles registered yet.
            </p>
          </div>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-muted text-[10px] font-mono text-muted-foreground font-bold">
          SYSTEM
        </span>
      </div>
    );
  }

  // Case 2: Exactly 1 receptionist performer registered
  if (performers.length === 1) {
    const single = performers[0];
    return (
      <div className="space-y-1.5">
        <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
          <UserCheck className="size-3.5 text-primary" />
          {label}
        </Label>
        <div className="p-2.5 rounded-xl bg-primary/5 border border-primary/20 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="size-7 rounded-lg bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0">
              {single.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 truncate">
              <p className="font-bold text-foreground truncate">
                {single.name}
              </p>
              <p className="text-[10.5px] font-mono text-muted-foreground flex items-center gap-1">
                <Phone className="size-2.5" />
                {single.phone}
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10.5px] font-semibold shrink-0">
            <CheckCircle2 className="size-3" />
            Active
          </span>
        </div>
      </div>
    );
  }

  // Case 3: Multiple receptionist staff exist — Selection is strictly mandatory!
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
          <UserCheck className="size-3.5 text-rose-500" />
          <span>{label}</span>
          <span className="text-destructive font-bold">*</span>
        </Label>
        <span className="text-[10px] font-semibold text-rose-500 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full">
          Selection Mandatory
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
        {performers.map((staff) => {
          const isSelected = staff.id === selectedPerformerId;

          return (
            <button
              key={staff.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectPerformerId(staff.id)}
              className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                isSelected
                  ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/40 shadow-xs font-semibold"
                  : "border-border/70 hover:border-border hover:bg-muted/40 text-muted-foreground"
              }`}
            >
              <div
                className={`size-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground border border-border"
                }`}
              >
                {staff.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-foreground truncate">
                  {staff.name}
                </p>
                <p className="text-[10px] font-mono text-muted-foreground flex items-center gap-1 truncate">
                  <Phone className="size-2.5 shrink-0" />
                  {staff.phone}
                </p>
              </div>
              {isSelected && (
                <CheckCircle2 className="size-4 text-primary shrink-0 ml-auto" />
              )}
            </button>
          );
        })}
      </div>

      {error ? (
        <p className="text-[11px] text-destructive font-medium flex items-center gap-1">
          <AlertCircle className="size-3" />
          {error}
        </p>
      ) : !selectedPerformerId ? (
        <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
          <ShieldAlert className="size-3" />
          Please select which receptionist is authorizing this action.
        </p>
      ) : null}
    </div>
  );
}
