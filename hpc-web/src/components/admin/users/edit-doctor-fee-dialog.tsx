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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateDoctorConsultationFeeAction } from "@/actions/admin/user.action";
import { toast } from "sonner";
import {
  Banknote,
  Stethoscope,
  Loader2,
  CheckCircle2,
  Sparkles,
  Info,
} from "lucide-react";

export interface DoctorFeeTarget {
  id: string;
  name?: string | null;
  email?: string | null;
  consultationFee?: number | null;
}

interface EditDoctorFeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctor: DoctorFeeTarget | null;
  onSuccess?: (doctorId: string, newFee: number) => void;
}

const COMMON_FEE_PRESETS = [500, 800, 1000, 1200, 1500, 2000];

export function EditDoctorFeeDialog({
  open,
  onOpenChange,
  doctor,
  onSuccess,
}: EditDoctorFeeDialogProps) {
  const [feeInput, setFeeInput] = React.useState<string>("1000");
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open && doctor) {
      setFeeInput(
        typeof doctor.consultationFee === "number" && !isNaN(doctor.consultationFee)
          ? String(doctor.consultationFee)
          : "1000",
      );
    }
  }, [open, doctor]);

  if (!doctor) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedFee = parseFloat(feeInput);

    if (isNaN(parsedFee) || parsedFee < 0) {
      toast.error("Please enter a valid non-negative consultation fee.");
      return;
    }

    startTransition(async () => {
      const res = await updateDoctorConsultationFeeAction(doctor.id, parsedFee);
      if (res.success) {
        toast.success(res.message);
        onSuccess?.(doctor.id, parsedFee);
        onOpenChange(false);
      } else {
        toast.error(res.message);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-md max-h-[92dvh] flex flex-col p-0 overflow-hidden rounded-2xl border bg-card shadow-2xl">
        <div className="shrink-0 p-4 sm:p-5 pr-12 sm:pr-14 border-b border-border/60 bg-muted/20">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                <Stethoscope className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  Set Doctor Default Fee
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Configure standard consultation charges for this doctor
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4">
          {/* Doctor Info Card */}
          <div className="p-3 rounded-xl border border-border/80 bg-muted/40 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">
                {doctor.name || "Doctor"}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30 font-semibold">
                DOCTOR
              </span>
            </div>
            {doctor.email && (
              <span className="text-[11px] text-muted-foreground font-mono block truncate">
                {doctor.email}
              </span>
            )}
            <div className="pt-1 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Current Default Fee:</span>
              <span className="font-mono font-bold text-foreground">
                ৳{(doctor.consultationFee ?? 1000).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Fee Input */}
          <div className="space-y-1.5">
            <Label htmlFor="doctor-fee-input" className="text-xs font-bold text-foreground">
              New Default Consultation Fee (৳)
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">
                ৳
              </span>
              <Input
                id="doctor-fee-input"
                type="number"
                min="0"
                step="50"
                value={feeInput}
                onChange={(e) => setFeeInput(e.target.value)}
                placeholder="1000"
                required
                disabled={isPending}
                className="pl-8 h-10 text-sm font-mono font-bold rounded-xl bg-background"
                autoFocus
              />
            </div>
          </div>

          {/* Quick Preset Buttons */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
              <Sparkles className="size-3 text-amber-500" />
              <span>Quick Presets:</span>
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {COMMON_FEE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setFeeInput(String(preset))}
                  className={`py-1.5 px-2 rounded-lg text-xs font-mono font-bold transition-all border cursor-pointer ${
                    feeInput === String(preset)
                      ? "bg-sky-600 text-white border-sky-700 shadow-xs ring-2 ring-sky-500/30"
                      : "bg-background border-border/70 text-foreground hover:bg-muted"
                  }`}
                >
                  ৳{preset}
                </button>
              ))}
            </div>
          </div>

          {/* Operational Info Notice */}
          <div className="p-3 rounded-xl border border-sky-500/20 bg-sky-500/5 text-xs text-muted-foreground flex items-start gap-2">
            <Info className="size-4 text-sky-500 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              Whenever a patient is added to this doctor&apos;s consultation queue from Receptionist Desk or Universal Patient Tracker, this fee will be automatically loaded as the preset bill. Staff can also adjust it on a per-patient basis if approved.
            </p>
          </div>
          </div>

          {/* Dialog Footer Actions */}
          <DialogFooter className="shrink-0 p-3 sm:p-4 border-t border-border/60 bg-muted/20 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => onOpenChange(false)}
              className="rounded-xl h-9 text-xs cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isPending}
              className="rounded-xl h-9 text-xs font-bold gap-1.5 bg-sky-600 hover:bg-sky-700 text-white shadow-xs cursor-pointer"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Saving Fee...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3.5" />
                  <span>Save Default Fee</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
