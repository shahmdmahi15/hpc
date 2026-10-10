"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, ShieldAlert, Loader2, Play, Pause, FastForward, RotateCcw } from "lucide-react";
import type { PerformerModel } from "@/generated/prisma/models";

export type TimerActionType = "START" | "PAUSE" | "SKIP" | "RESET";

interface TimerPinDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  actionType: TimerActionType;
  modalityName: string;
  stepNumber?: number;
  handlers: PerformerModel[];
  onConfirm: (performerId: string, pin: string) => Promise<void>;
}

export function TimerPinDialog({
  isOpen,
  onOpenChange,
  actionType,
  modalityName,
  stepNumber,
  handlers,
  onConfirm,
}: TimerPinDialogProps) {
  const [selectedHandlerId, setSelectedHandlerId] = React.useState<string>(() => handlers[0]?.id || "");
  const [pin, setPin] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Auto-select single performer
  React.useEffect(() => {
    if (handlers.length === 1 && handlers[0]) {
      setSelectedHandlerId(handlers[0].id);
    } else if (!selectedHandlerId && handlers[0]) {
      setSelectedHandlerId(handlers[0].id);
    }
  }, [handlers, selectedHandlerId]);

  // Reset pin when dialog opens
  React.useEffect(() => {
    if (isOpen) {
      setPin("");
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHandlerId) {
      setError("Please select an authorizing therapist.");
      return;
    }
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      setError("Please enter a valid 4-digit security PIN.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirm(selectedHandlerId, pin);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getActionBadge = () => {
    switch (actionType) {
      case "START":
        return {
          icon: Play,
          title: "Start Modality Timer",
          color: "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400",
          btnColor: "bg-emerald-600 hover:bg-emerald-700 text-white",
          btnText: "Confirm & Start Timer",
        };
      case "PAUSE":
        return {
          icon: Pause,
          title: "Pause Therapy Timer",
          color: "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400",
          btnColor: "bg-amber-600 hover:bg-amber-700 text-white",
          btnText: "Confirm & Pause Timer",
        };
      case "SKIP":
        return {
          icon: FastForward,
          title: "Skip Current Modality",
          color: "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400",
          btnColor: "bg-blue-600 hover:bg-blue-700 text-white",
          btnText: "Confirm & Skip to Next",
        };
      case "RESET":
        return {
          icon: RotateCcw,
          title: "Reset Therapy Timers",
          color: "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400",
          btnColor: "bg-rose-600 hover:bg-rose-700 text-white",
          btnText: "Confirm & Reset Timers",
        };
    }
  };

  const badge = getActionBadge();
  const IconComponent = badge.icon;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[94vw] max-w-md p-0 overflow-hidden rounded-2xl border-border/80 shadow-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="p-4 sm:p-5 pb-3 border-b border-border/60 bg-muted/20">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-xl border ${badge.color}`}>
                <IconComponent className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  {badge.title}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Therapist PIN authorization required for live bed control
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-4 sm:p-5 space-y-4">
            {/* Target Modality Info */}
            <div className="p-3 rounded-xl bg-card border border-border/80 flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                  Target Modality
                </span>
                <div className="font-bold text-foreground">
                  {stepNumber ? `${stepNumber}. ` : ""}{modalityName}
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-muted text-muted-foreground">
                Per-Bed Sync
              </span>
            </div>

            {/* Performer Selection */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">
                Attending Therapist
              </Label>
              {handlers.length === 1 ? (
                <div className="p-2.5 rounded-xl bg-muted/40 border border-border/70 flex items-center justify-between text-xs">
                  <span className="font-bold text-foreground">{handlers[0].name}</span>
                  <span className="text-[10.5px] font-mono text-muted-foreground">
                    {handlers[0].whatsapp || handlers[0].phone}
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {handlers.map((h) => {
                    const isSelected = selectedHandlerId === h.id;
                    return (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => setSelectedHandlerId(h.id)}
                        className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? "bg-primary/10 border-primary text-foreground font-bold shadow-2xs"
                            : "bg-card border-border/70 text-muted-foreground hover:bg-muted/50"
                        }`}
                      >
                        <div className="text-xs font-semibold truncate">{h.name}</div>
                        <div className="text-[10px] font-mono text-muted-foreground">
                          {h.whatsapp || h.phone}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 4-Digit Security PIN */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <KeyRound className="size-3.5 text-primary" />
                <span>Therapist 4-Digit PIN</span>
              </Label>
              <Input
                type="password"
                maxLength={4}
                autoFocus
                value={pin}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "");
                  setPin(val);
                  if (error) setError(null);
                }}
                placeholder="••••"
                className="h-10 text-center font-mono text-lg tracking-[0.5em] font-black rounded-xl bg-background border-border/80 focus-visible:ring-primary"
              />
            </div>

            {error && (
              <div className="p-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                <ShieldAlert className="size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <DialogFooter className="p-4 sm:p-5 pt-3 border-t border-border/60 bg-muted/10 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
              className="text-xs font-semibold cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || pin.length !== 4}
              className={`text-xs font-bold gap-1.5 shadow-xs cursor-pointer ${badge.btnColor}`}
            >
              {isSubmitting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <IconComponent className="size-3.5" />
              )}
              <span>{badge.btnText}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
