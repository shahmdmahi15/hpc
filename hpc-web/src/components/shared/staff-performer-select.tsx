"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  UserCheck,
  ShieldAlert,
  Phone,
  CheckCircle2,
  User,
  AlertCircle,
  KeyRound,
  LucideIcon,
} from "lucide-react";

export interface StaffPerformer {
  id: string;
  name: string;
  phone?: string | null;
}

export interface StaffPerformerSelectProps {
  performers: StaffPerformer[];
  selectedPerformerId: string;
  onSelectPerformerId: (id: string) => void;
  disabled?: boolean;
  label?: string;
  error?: string;
  pin?: string;
  onPinChange?: (pin: string) => void;
  pinLabel?: string;
  fallbackRoleName?: string;
  roleIcon?: LucideIcon;
  pinInputName?: string;
  autoSelectSingle?: boolean;
  className?: string;
}

export function StaffPerformerSelect({
  performers = [],
  selectedPerformerId,
  onSelectPerformerId,
  disabled = false,
  label = "Authorizing Staff",
  error,
  pin,
  onPinChange,
  pinLabel = "Staff 4-Digit PIN:",
  fallbackRoleName = "Desk Staff",
  roleIcon: RoleIcon = UserCheck,
  pinInputName = "staff_performer_auth_pin",
  autoSelectSingle = true,
  className = "",
}: StaffPerformerSelectProps) {
  // If exactly 1 performer exists and none is selected, auto-select it
  React.useEffect(() => {
    if (autoSelectSingle && performers.length === 1 && !selectedPerformerId) {
      onSelectPerformerId(performers[0].id);
    }
  }, [autoSelectSingle, performers, selectedPerformerId, onSelectPerformerId]);

  // Helper to extract 2 uppercase letters for the avatar
  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Case 1: No staff performers registered yet (Desk fallback)
  if (performers.length === 0) {
    return (
      <div className={`p-3 rounded-xl bg-muted/30 border border-border/60 text-xs flex items-center justify-between gap-2 ${className}`}>
        <div className="flex items-center gap-2">
          <div className="size-6 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <User className="size-3.5" />
          </div>
          <div>
            <span className="font-semibold text-foreground">
              Acting as {fallbackRoleName}
            </span>
            <p className="text-[10.5px] text-muted-foreground">
              No individual staff profiles registered yet.
            </p>
          </div>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-muted text-[10px] font-mono text-muted-foreground font-bold">
          SYSTEM
        </span>
      </div>
    );
  }

  // Case 2: Exactly 1 staff performer registered
  if (performers.length === 1) {
    const single = performers[0];
    return (
      <div className={`space-y-2 ${className}`}>
        <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
          <RoleIcon className="size-3.5 text-primary" />
          <span>{label}</span>
        </Label>
        <div className="p-2.5 rounded-xl bg-primary/5 border border-primary/20 text-xs flex items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2 min-w-0">
            <div className="size-7 rounded-lg bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0">
              {getInitials(single.name)}
            </div>
            <div className="min-w-0 truncate">
              <p className="font-bold text-foreground truncate">
                {single.name}
              </p>
              <p className="text-[10.5px] font-mono text-muted-foreground flex items-center gap-1">
                <Phone className="size-2.5 shrink-0" />
                <span>{single.phone || "No phone configured"}</span>
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10.5px] font-semibold shrink-0">
            <CheckCircle2 className="size-3" />
            Active
          </span>
        </div>

        {onPinChange && (
          <div className="flex items-center gap-2 p-2 rounded-xl bg-amber-500/5 border border-amber-500/20">
            <KeyRound className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div className="flex-1 flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-foreground">
                {pinLabel}
              </span>
              <Input
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                name={pinInputName}
                data-lpignore="true"
                data-1p-ignore="true"
                data-form-type="other"
                maxLength={4}
                value={pin || ""}
                onChange={(e) => onPinChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="••••"
                disabled={disabled}
                className="h-7 text-xs font-mono tracking-widest text-center rounded-lg bg-background w-24 border-amber-500/40"
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  // Case 3: Multiple staff exist — Selection is strictly mandatory!
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
          <RoleIcon className="size-3.5 text-rose-500" />
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
                {getInitials(staff.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-foreground truncate">
                  {staff.name}
                </p>
                <p className="text-[10px] font-mono text-muted-foreground flex items-center gap-1 truncate">
                  <Phone className="size-2.5 shrink-0" />
                  <span>{staff.phone || "No phone configured"}</span>
                </p>
              </div>
              {isSelected && (
                <CheckCircle2 className="size-4 text-primary shrink-0 ml-auto" />
              )}
            </button>
          );
        })}
      </div>

      {onPinChange && selectedPerformerId && (
        <div className="flex items-center gap-2 p-2 rounded-xl bg-amber-500/5 border border-amber-500/20">
          <KeyRound className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
          <div className="flex-1 flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-foreground">
              {pinLabel}
            </span>
            <Input
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              name={pinInputName}
              data-lpignore="true"
              data-1p-ignore="true"
              data-form-type="other"
              maxLength={4}
              value={pin || ""}
              onChange={(e) => onPinChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="••••"
              disabled={disabled}
              className="h-7 text-xs font-mono tracking-widest text-center rounded-lg bg-background w-24 border-amber-500/40"
            />
          </div>
        </div>
      )}

      {error ? (
        <p className="text-[11px] text-destructive font-medium flex items-center gap-1">
          <AlertCircle className="size-3" />
          {error}
        </p>
      ) : !selectedPerformerId ? (
        <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
          <ShieldAlert className="size-3" />
          Please select which staff member is authorizing this action.
        </p>
      ) : null}
    </div>
  );
}
