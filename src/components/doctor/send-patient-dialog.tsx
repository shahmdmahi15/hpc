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
import {
  Send,
  User,
  Phone,
  Ticket,
  Sparkles,
  Stethoscope,
  ArrowRight,
  ArrowRightLeft,
  CheckCircle2,
} from "lucide-react";
import type { AppointmentWithRelations } from "@/actions/receptionist/appointment.action";

interface SendPatientDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: AppointmentWithRelations | null;
  onSuccess?: () => void;
  onComplete?: () => Promise<void>;
  onTransferToTherapy?: () => Promise<void>;
}

export function SendPatientDialog({
  isOpen,
  onOpenChange,
  appointment,
  onComplete,
  onTransferToTherapy,
}: SendPatientDialogProps) {
  if (!appointment) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-lg md:max-w-xl p-0 overflow-hidden border-border/80 shadow-2xl rounded-2xl">
        {/* Header */}
        <DialogHeader className="p-5 pb-4 border-b border-border/60 bg-muted/20">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
                <Send className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold">
                  Send Patient
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Route and transfer this patient to their next destination.
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {appointment.patient?.mrn ? (
                <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 text-primary">
                  MRN: {appointment.patient.mrn}
                </span>
              ) : (
                <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 text-primary">
                  In Consultation
                </span>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          {/* Patient Card Summary */}
          <div className="p-3 rounded-xl bg-muted/40 border border-border/70 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-xs">
                  <User className="size-3.5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-foreground">
                    {appointment.patient?.name || "Unnamed Patient"}
                  </h4>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                    {appointment.patient?.mrn && (
                      <span>MRN: {appointment.patient.mrn}</span>
                    )}
                    {appointment.patient?.gender && (
                      <span className="capitalize">
                        • {appointment.patient.gender.toLowerCase()}
                      </span>
                    )}
                    {appointment.patient?.age && (
                      <span>• {appointment.patient.age} yrs</span>
                    )}
                  </div>
                </div>
              </div>

              {appointment.patient?.phone && (
                <div className="flex items-center gap-1 text-xs font-mono text-muted-foreground">
                  <Phone className="size-3" />
                  <span>{appointment.patient.phone}</span>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Stethoscope className="size-3.5 text-primary" />
                <span>Doctor Consultation</span>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-[11px]">
                <Ticket className="size-3 text-muted-foreground" />
                <span>
                  {appointment.room?.number
                    ? `Room R${appointment.room.number}`
                    : "Chamber Desk"}
                </span>
              </div>
            </div>
          </div>

          {/* Placeholder Destination Box */}
          <div className="p-4 rounded-xl border border-dashed border-primary/40 bg-primary/5 space-y-2 text-center">
            <div className="size-9 rounded-xl bg-primary/10 text-primary mx-auto flex items-center justify-center">
              <Sparkles className="size-4" />
            </div>
            <div>
              <h5 className="font-bold text-xs text-foreground">
                Destination Routing Options
              </h5>
              <p className="text-[11.5px] text-muted-foreground mt-1 max-w-sm mx-auto leading-relaxed">
                This workflow dialog will configure destinations such as
                transferring to Physical Therapy desk, routing to cashier, or
                discharging the patient.
              </p>
            </div>
          </div>

          {/* Quick Routing Actions (if available) */}
          {(onTransferToTherapy || onComplete) && (
            <div className="space-y-1.5 pt-1">
              <div className="text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider px-0.5">
                Quick Actions
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {onTransferToTherapy && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={async () => {
                      await onTransferToTherapy();
                      onOpenChange(false);
                    }}
                    className="h-9 justify-start text-xs border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 cursor-pointer gap-2"
                  >
                    <ArrowRightLeft className="size-3.5 text-amber-500" />
                    <span>Send to Therapy</span>
                  </Button>
                )}
                {onComplete && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={async () => {
                      await onComplete();
                      onOpenChange(false);
                    }}
                    className="h-9 justify-start text-xs border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 cursor-pointer gap-2"
                  >
                    <CheckCircle2 className="size-3.5 text-emerald-500" />
                    <span>Complete & Discharge</span>
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 pt-3 border-t border-border/60 bg-muted/10 flex flex-row items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs font-semibold gap-1.5 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <span>Proceed</span>
            <ArrowRight className="size-3.5" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
