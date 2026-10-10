"use client";

import * as React from "react";
import type { AppointmentWithRelations } from "@/actions/receptionist/appointment.action";
import { updateAppointmentStatusAction } from "@/actions/receptionist/appointment.action";
import { AppointmentStatus, QueueType } from "@/generated/prisma/enums";
import type { PerformerModel } from "@/generated/prisma/models";
import type { TreatmentPlanRecord } from "@/actions/doctor/treatment-plan.action";
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
  Play,
  DoorOpen,
  Phone,
  Clock,
  Activity,
  FileText,
  AlertCircle,
  Stethoscope,
} from "lucide-react";
import { StaffPerformerSelect } from "@/components/shared/staff-performer-select";
import { toast } from "sonner";
import { formatTime12h } from "@/lib/queue-punctuality";

export interface MarkInTherapyDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: AppointmentWithRelations | null;
  todayPlan?: TreatmentPlanRecord | null;
  handlers: PerformerModel[];
  defaultHandlerId?: string;
  selectedRoomId?: string;
  onSuccess: () => void;
}

export function MarkInTherapyDialog({
  isOpen,
  onOpenChange,
  appointment,
  todayPlan,
  handlers = [],
  defaultHandlerId,
  selectedRoomId,
  onSuccess,
}: MarkInTherapyDialogProps) {
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

  if (!appointment) return null;

  const isMale = appointment.gender === "MALE";
  const assignedRoomNumber =
    appointment.room?.number ||
    appointment.therapySlot?.room?.number ||
    null;

  const handleConfirmStartTherapy = async () => {
    if (handlers.length > 0) {
      if (!selectedHandlerId) {
        toast.error("Please select attending therapist / handler.");
        return;
      }
      if (!handlerPin.trim()) {
        toast.error("Please enter therapist 4-digit security PIN.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const roomIdToUse =
        appointment.roomId || selectedRoomId || undefined;
      const res = await updateAppointmentStatusAction(
        appointment.id,
        AppointmentStatus.IN_THERAPY,
        selectedHandlerId || undefined,
        QueueType.THERAPY,
        roomIdToUse,
        handlerPin.trim() || undefined,
      );

      if (res.success) {
        toast.success(
          `Therapy session started for ${appointment.patient?.name || "Patient"}${
            assignedRoomNumber ? ` in Room ${assignedRoomNumber}` : ""
          }.`,
        );
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to start therapy session.");
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
              <div className="size-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Play className="size-4.5 stroke-[2.2] fill-emerald-600/20" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  <span>Start Physical Therapy Session</span>
                  {assignedRoomNumber && (
                    <Badge
                      variant="outline"
                      className="text-[10px] font-mono font-bold py-0 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10"
                    >
                      Room {assignedRoomNumber}
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Confirm patient arrival in therapy room and verify therapist PIN.
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
                <div className="px-2.5 py-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-right">
                  <span className="text-[10px] block font-medium opacity-80 uppercase tracking-wider">
                    Assigned Room
                  </span>
                  <span className="text-xs font-mono font-bold flex items-center gap-1 justify-end">
                    <DoorOpen className="size-3" />
                    Room {assignedRoomNumber}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Today's Treatment Plan Preview */}
          {todayPlan ? (
            <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <Activity className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Prescribed Treatment Plan (Today)</span>
                </span>
                {todayPlan.doctorName && (
                  <Badge variant="outline" className="text-[10px] font-semibold py-0">
                    By Dr. {todayPlan.doctorName}
                  </Badge>
                )}
              </div>

              {todayPlan.modalities && (
                <div className="text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground mr-1">Modalities:</span>
                  <span>
                    {Array.isArray(todayPlan.modalities)
                      ? (todayPlan.modalities as string[]).join(", ")
                      : String(todayPlan.modalities)}
                  </span>
                </div>
              )}

              {todayPlan.instructions && (
                <div className="text-[10.5px] text-muted-foreground bg-muted/40 p-2 rounded-lg border border-border/40 italic">
                  &ldquo;{todayPlan.instructions}&rdquo;
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs flex items-start gap-2.5">
              <AlertCircle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold text-amber-900 dark:text-amber-200">
                  No Treatment Plan for Today
                </p>
                <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 leading-relaxed">
                  No specific daily treatment plan has been prescribed yet. You may proceed with standard therapy or consult the doctor.
                </p>
              </div>
            </div>
          )}

          {/* Attending Therapist Selection & 4-Digit Security PIN */}
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
              label="Attending Therapist / Handler"
              pinLabel="Therapist 4-Digit Security PIN:"
              fallbackRoleName="Therapy Floor Staff"
              roleIcon={Stethoscope}
              pinInputName="handler_start_therapy_auth_pin"
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
            Cancel
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleConfirmStartTherapy}
            disabled={isSubmitting}
            className="text-xs font-bold gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer px-4"
          >
            {isSubmitting ? (
              <span>Starting Session...</span>
            ) : (
              <>
                <Play className="size-3.5" />
                <span>Confirm & Start Therapy</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
