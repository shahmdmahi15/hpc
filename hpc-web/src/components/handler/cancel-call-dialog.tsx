"use client";

import * as React from "react";
import type { AppointmentWithRelations } from "@/actions/receptionist/appointment.action";
import { updateAppointmentStatusAction } from "@/actions/receptionist/appointment.action";
import { AppointmentStatus, QueueType } from "@/generated/prisma/enums";
import type { PerformerModel } from "@/generated/prisma/models";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  RotateCcw,
  DoorOpen,
  Phone,
  Clock,
  AlertTriangle,
  Activity,
  CheckCircle2,
} from "lucide-react";
import { StaffPerformerSelect } from "@/components/shared/staff-performer-select";
import { toast } from "sonner";
import { formatTime12h } from "@/lib/queue-punctuality";

export interface CancelCallDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: AppointmentWithRelations;
  handlers: PerformerModel[];
  defaultHandlerId?: string;
  onSuccess: () => void;
}

export function CancelCallDialog({
  isOpen,
  onOpenChange,
  appointment,
  handlers = [],
  defaultHandlerId,
  onSuccess,
}: CancelCallDialogProps) {
  // Handler selection: auto-select single performer or default
  const initialHandlerId = React.useMemo(() => {
    if (handlers.length === 1) {
      return handlers[0].id;
    }
    return defaultHandlerId || handlers[0]?.id || "";
  }, [handlers, defaultHandlerId]);

  const [selectedHandlerId, setSelectedHandlerId] = React.useState<string>(
    () => initialHandlerId,
  );
  const [handlerPin, setHandlerPin] = React.useState<string>("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Reset/sync state when dialog opens
  const [prevOpen, setPrevOpen] = React.useState(isOpen);
  if (isOpen !== prevOpen) {
    setPrevOpen(isOpen);
    if (isOpen) {
      setSelectedHandlerId(initialHandlerId);
      setHandlerPin("");
    }
  }

  const isMale = appointment.gender === "MALE";
  const assignedRoomNumber =
    appointment.room?.number ||
    appointment.therapySlot?.room?.number ||
    null;

  const handleConfirmCancelCall = async () => {
    if (handlers.length > 0) {
      if (!selectedHandlerId) {
        toast.error("Please select authorizing therapist / handler.");
        return;
      }
      if (!handlerPin.trim()) {
        toast.error("Please enter therapist 4-digit security PIN.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const res = await updateAppointmentStatusAction(
        appointment.id,
        AppointmentStatus.CHECKED_IN,
        selectedHandlerId || undefined,
        QueueType.THERAPY,
        "", // Clear assigned room so patient returns cleanly to waiting queue
        handlerPin.trim() || undefined,
      );

      if (res.success) {
        toast.info(
          `Call cancelled. ${appointment.patient?.name || "Patient"} returned to therapy waiting queue.`,
        );
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel call.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-lg max-h-[92dvh] flex flex-col p-0 overflow-hidden rounded-2xl shadow-2xl border-border/80">
        {/* Header */}
        <DialogHeader className="p-4 sm:p-5 pb-3 sm:pb-4 pr-12 sm:pr-14 border-b border-border/60 bg-muted/20 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <RotateCcw className="size-4.5 stroke-[2.2]" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  <span>Cancel Room Call</span>
                  <Badge
                    variant="outline"
                    className="text-[10px] uppercase font-bold tracking-wider py-0 border-rose-500/30 text-rose-700 dark:text-rose-300 bg-rose-500/10"
                  >
                    Therapy Queue
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Confirm cancellation, release room announcement, and return patient to queue.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Modal Body */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4">
          {/* Patient Details Card */}
          <div className="p-3.5 rounded-xl border border-border/80 bg-card/60 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant="secondary"
                    className={`text-[10px] font-bold ${
                      isMale
                        ? "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20"
                        : "bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/20"
                    }`}
                  >
                    {isMale ? "Male" : "Female"}
                  </Badge>
                  <h3 className="font-bold text-sm text-foreground">
                    {appointment.patient?.name || "Patient"}
                  </h3>
                  {appointment.patient?.mrn && (
                    <span className="text-[11px] font-mono text-muted-foreground">
                      ({appointment.patient.mrn})
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono flex-wrap">
                  <span className="flex items-center gap-1">
                    <Phone className="size-3 opacity-60" />
                    <span>{appointment.patient?.phone || "No phone"}</span>
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Clock className="size-3 opacity-60" />
                    <span>In: {formatTime12h(appointment.checkInTime)}</span>
                  </span>
                </div>
              </div>

              {assignedRoomNumber && (
                <div className="px-2.5 py-1 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-right">
                  <span className="text-[10px] block font-medium opacity-80 uppercase tracking-wider">
                    Calling To
                  </span>
                  <span className="text-xs font-mono font-bold flex items-center gap-1 justify-end">
                    <DoorOpen className="size-3" />
                    Room {assignedRoomNumber}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Warning / Explanation Banner */}
          <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5">
            <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">
                Patient is delayed or not ready to enter room
              </p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Cancelling this call will immediately clear the waiting room TV announcement and return the patient to the waiting queue in the waiting lounge. You can call another patient right away.
              </p>
            </div>
          </div>

          {/* Therapist Selection & 4-Digit PIN */}
          {handlers.length > 0 && (
            <StaffPerformerSelect
              performers={handlers.map((h) => ({
                id: h.id,
                name: h.name,
                phone: h.phone || "",
              }))}
              selectedPerformerId={selectedHandlerId}
              onSelectPerformerId={(id) => setSelectedHandlerId(id)}
              pin={handlerPin}
              onPinChange={(p) => setHandlerPin(p)}
              label="Authorizing Therapist / Handler"
              pinLabel="Therapist 4-Digit Security PIN:"
              fallbackRoleName="Therapy Floor Staff"
              roleIcon={Activity}
              pinInputName="handler_cancel_call_auth_pin"
            />
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-3 sm:p-4 border-t border-border/60 bg-muted/20 flex flex-row items-center justify-between gap-2 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
          >
            Keep Patient in Call
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleConfirmCancelCall}
            disabled={isSubmitting}
            className="text-xs font-bold gap-1.5 rounded-lg border border-rose-500/40 bg-rose-600 hover:bg-rose-700 text-white shadow-xs cursor-pointer px-4"
          >
            {isSubmitting ? (
              <span>Cancelling Call...</span>
            ) : (
              <>
                <RotateCcw className="size-3.5" />
                <span>Confirm Cancel Call</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
