"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AdminPerformerSelect } from "@/components/admin/users/admin-performer-select";
import { seedDefaultHourlySlotsAction } from "@/actions/admin/slot.action";
import {
  Sparkles,
  Clock,
  Calendar,
  Users,
  ShieldAlert,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

interface SeedSlotsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  adminPerformers: { id: string; name: string; phone: string }[];
  defaultPerformerId?: string;
  onSuccess?: (performerId: string) => void;
}

const DEFAULT_SLOT_WINDOWS = [
  { label: "10:00 AM - 11:00 AM", range: "10:00 — 11:00", num: "01" },
  { label: "11:00 AM - 12:00 PM", range: "11:00 — 12:00", num: "02" },
  { label: "12:00 PM - 01:00 PM", range: "12:00 — 13:00", num: "03" },
  { label: "01:00 PM - 02:00 PM", range: "13:00 — 14:00", num: "04" },
  { label: "02:00 PM - 03:00 PM", range: "14:00 — 15:00", num: "05" },
  { label: "03:00 PM - 04:00 PM", range: "15:00 — 16:00", num: "06" },
  { label: "04:00 PM - 05:00 PM", range: "16:00 — 17:00", num: "07" },
  { label: "05:00 PM - 06:00 PM", range: "17:00 — 18:00", num: "08" },
  { label: "06:00 PM - 07:00 PM", range: "18:00 — 19:00", num: "09" },
  { label: "07:00 PM - 08:00 PM", range: "19:00 — 20:00", num: "10" },
];

export function SeedSlotsDialog({
  isOpen,
  onOpenChange,
  adminPerformers,
  defaultPerformerId = "",
  onSuccess,
}: SeedSlotsDialogProps) {
  const [selectedPerformerId, setSelectedPerformerId] = React.useState<string>(
    () =>
      defaultPerformerId ||
      (adminPerformers.length === 1 ? adminPerformers[0].id : ""),
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [prevOpen, setPrevOpen] = React.useState(isOpen);
  if (isOpen !== prevOpen) {
    setPrevOpen(isOpen);
    if (isOpen) {
      setSelectedPerformerId(
        defaultPerformerId ||
          (adminPerformers.length === 1 ? adminPerformers[0].id : ""),
      );
    }
  }

  const handleSeed = async () => {
    if (!selectedPerformerId && adminPerformers.length > 1) {
      toast.error("Please select an authorizing administrator.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await seedDefaultHourlySlotsAction(
        selectedPerformerId || undefined,
      );
      if (res.success) {
        toast.success(res.message);
        if (selectedPerformerId) {
          onSuccess?.(selectedPerformerId);
        }
        onOpenChange(false);
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("An unexpected error occurred while seeding default slots.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-lg md:max-w-xl max-h-[min(92vh,700px)] flex flex-col p-0 overflow-hidden border-border/80 shadow-2xl rounded-2xl">
        {/* Header */}
        <DialogHeader className="p-5 pb-4 border-b border-border/60 shrink-0 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <Sparkles className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                Seed Standard Daily Slots
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Generate 10 master 1-hour therapy slots from 10:00 AM to 08:00
                PM for all days.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Key Parameters Cards */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-2.5 rounded-xl bg-muted/30 border border-border/60 text-center">
              <div className="flex items-center justify-center text-primary mb-1">
                <Clock className="size-4" />
              </div>
              <p className="text-xs font-bold text-foreground">
                10 Hourly Slots
              </p>
              <p className="text-[10px] text-muted-foreground">
                10:00 AM — 08:00 PM
              </p>
            </div>

            <div className="p-2.5 rounded-xl bg-muted/30 border border-border/60 text-center">
              <div className="flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-1">
                <Calendar className="size-4" />
              </div>
              <p className="text-xs font-bold text-foreground">Every Day</p>
              <p className="text-[10px] text-muted-foreground">
                Mon — Sun (All Days)
              </p>
            </div>

            <div className="p-2.5 rounded-xl bg-muted/30 border border-border/60 text-center">
              <div className="flex items-center justify-center text-sky-600 dark:text-sky-400 mb-1">
                <Users className="size-4" />
              </div>
              <p className="text-xs font-bold text-foreground">3M + 3F Quota</p>
              <p className="text-[10px] text-muted-foreground">
                +1 Standby each
              </p>
            </div>
          </div>

          {/* Schedule Preview Matrix */}
          <div className="p-3 rounded-xl bg-background border border-border/70 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-foreground">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-emerald-500" />
                Slots To Be Generated:
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                60 min each
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-1">
              {DEFAULT_SLOT_WINDOWS.map((s) => (
                <div
                  key={s.num}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-muted/40 border border-border/50 text-[11px]"
                >
                  <span className="font-mono text-[10px] text-muted-foreground font-semibold">
                    #{s.num}
                  </span>
                  <span className="font-medium text-foreground text-[10.5px]">
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Authorizing Admin Performer */}
          <div className="space-y-1.5">
            <AdminPerformerSelect
              adminPerformers={adminPerformers}
              selectedPerformerId={selectedPerformerId}
              onSelectPerformerId={setSelectedPerformerId}
              disabled={isSubmitting}
              label="Authorizing Administrator *"
            />
          </div>

          {/* Non-destructive Note */}
          <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-xs flex items-start gap-2">
            <ShieldAlert className="size-4 shrink-0 mt-0.5 text-blue-500" />
            <div className="text-[11px] leading-relaxed">
              <span className="font-semibold">Safe & Idempotent: </span>
              Slots with identical start and end times that already exist will
              not be duplicated. Only missing slots will be added.
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t border-border/60 bg-muted/10 shrink-0 flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="cursor-pointer"
          >
            Cancel
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleSeed}
            disabled={
              isSubmitting ||
              (adminPerformers.length > 1 && !selectedPerformerId)
            }
            className="gap-2 bg-primary text-primary-foreground font-semibold cursor-pointer shadow-sm"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Seeding Standard Slots...</span>
              </>
            ) : (
              <>
                <Sparkles className="size-3.5" />
                <span>Seed 10 Standard Slots</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
