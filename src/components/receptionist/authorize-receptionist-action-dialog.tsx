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
import {
  ReceptionistPerformerSelect,
  type ReceptionistPerformer,
} from "@/components/receptionist/receptionist-performer-select";
import { QueueType } from "@/generated/prisma/enums";
import {
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Clock,
  Activity,
  Stethoscope,
  ArrowRightLeft,
  PlayCircle,
  XCircle,
  DoorOpen,
  LogOut,
} from "lucide-react";
import type { RoomModel } from "@/generated/prisma/models";
import { toast } from "sonner";

export type ReceptionistActionType =
  | "CHECK_IN"
  | "CHECK_OUT"
  | "CANCEL"
  | "START_SERVICE"
  | "COMPLETE"
  | "SWITCH_QUEUE"
  | "REMOVE_FROM_QUEUE";

export interface AuthorizeReceptionistActionConfig {
  actionType: ReceptionistActionType;
  appointmentId: string;
  patientName?: string;
  slotLabel?: string;
  defaultQueueType?: QueueType;
  targetQueueType?: QueueType;
  currentRoomId?: string;
}

interface AuthorizeReceptionistActionDialogProps {
  config: AuthorizeReceptionistActionConfig | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  performers: ReceptionistPerformer[];
  rooms?: RoomModel[];
  defaultPerformerId?: string;
  onConfirm: (
    config: AuthorizeReceptionistActionConfig,
    performerId: string,
    queueType?: QueueType,
    roomId?: string,
  ) => Promise<boolean>;
}

export function AuthorizeReceptionistActionDialog({
  config,
  isOpen,
  onOpenChange,
  performers,
  rooms = [],
  defaultPerformerId = "",
  onConfirm,
}: AuthorizeReceptionistActionDialogProps) {
  if (!config) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      {isOpen && (
        <AuthorizeReceptionistActionDialogBody
          key={`${config.appointmentId}-${config.actionType}`}
          config={config}
          onOpenChange={onOpenChange}
          performers={performers}
          rooms={rooms}
          defaultPerformerId={defaultPerformerId}
          onConfirm={onConfirm}
        />
      )}
    </Dialog>
  );
}

function AuthorizeReceptionistActionDialogBody({
  config,
  onOpenChange,
  performers,
  rooms = [],
  defaultPerformerId = "",
  onConfirm,
}: {
  config: AuthorizeReceptionistActionConfig;
  onOpenChange: (open: boolean) => void;
  performers: ReceptionistPerformer[];
  rooms?: RoomModel[];
  defaultPerformerId?: string;
  onConfirm: (
    config: AuthorizeReceptionistActionConfig,
    performerId: string,
    queueType?: QueueType,
    roomId?: string,
  ) => Promise<boolean>;
}) {
  const [selectedPerformerId, setSelectedPerformerId] = React.useState<string>(
    () =>
      defaultPerformerId || (performers.length === 1 ? performers[0].id : ""),
  );
  const [selectedQueueType, setSelectedQueueType] = React.useState<QueueType>(
    () => config.defaultQueueType || QueueType.THERAPY,
  );

  const defaultDoctorRoom = React.useMemo(() => {
    return (
      rooms.find(
        (r) =>
          r.id === config.currentRoomId ||
          r.accessType === "DOCTOR" ||
          r.purpose.toLowerCase().includes("doctor"),
      ) || (rooms.length > 0 ? rooms[0] : null)
    );
  }, [rooms, config.currentRoomId]);

  const [selectedRoomId, setSelectedRoomId] = React.useState<string>(() => {
    return defaultDoctorRoom?.id || config.currentRoomId || "";
  });

  const selectedRoom = React.useMemo(() => {
    return rooms.find((r) => r.id === selectedRoomId);
  }, [rooms, selectedRoomId]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const isCheckIn = config.actionType === "CHECK_IN";

  // Action-specific UI attributes
  const isConsult =
    config.defaultQueueType === QueueType.CONSULTATION ||
    config.targetQueueType === QueueType.CONSULTATION;

  let dialogIcon = <CheckCircle2 className="size-5" />;
  let iconContainerClass =
    "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400";
  let title = "Authorize Action";
  let description = "Please select the authorizing staff member to proceed.";
  let confirmLabel = "Confirm Action";
  let confirmVariant: "default" | "destructive" = "default";
  let confirmButtonClass = "";

  if (config.actionType === "CHECK_IN") {
    dialogIcon = <CheckCircle2 className="size-5" />;
    iconContainerClass =
      "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400";
    title = "Authorize Patient Check-In";
    description = "Assign waiting queue and confirm patient arrival at clinic.";
    confirmLabel = "Confirm Check-In";
    confirmVariant = "default";
  } else if (config.actionType === "CHECK_OUT") {
    dialogIcon = <LogOut className="size-5" />;
    iconContainerClass =
      "bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400";
    title = "Authorize Patient Check-Out";
    description =
      "Mark patient visit completed for the day and record check-out timestamp.";
    confirmLabel = "Confirm Check-Out";
    confirmVariant = "default";
    confirmButtonClass = "bg-indigo-600 hover:bg-indigo-700 text-white";
  } else if (config.actionType === "CANCEL") {
    dialogIcon = <AlertTriangle className="size-5" />;
    iconContainerClass =
      "bg-destructive/10 border-destructive/20 text-destructive";
    title = "Authorize Ticket Cancellation";
    description = "Cancel this ticket and release the quota back to the slot.";
    confirmLabel = "Confirm Cancellation";
    confirmVariant = "destructive";
  } else if (config.actionType === "START_SERVICE") {
    dialogIcon = <PlayCircle className="size-5" />;
    iconContainerClass = isConsult
      ? "bg-sky-500/10 border-sky-500/20 text-sky-600 dark:text-sky-400"
      : "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400";
    title = isConsult
      ? "Call Patient to Doctor Chamber"
      : "Authorize Physical Therapy";
    description = isConsult
      ? "Assign consultation room and broadcast audible alert to waiting room."
      : "Admit patient into physical therapy and begin session.";
    confirmLabel = isConsult
      ? selectedRoom
        ? `Call to Room ${selectedRoom.number}`
        : "Call Doctor"
      : "Start Therapy";
    confirmVariant = "default";
    confirmButtonClass = isConsult
      ? "bg-sky-600 hover:bg-sky-700 text-white"
      : "";
  } else if (config.actionType === "COMPLETE") {
    dialogIcon = <CheckCircle2 className="size-5" />;
    iconContainerClass =
      "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400";
    title = "Authorize Session Completion";
    description =
      "Mark therapy or doctor consultation completed and clear from queue.";
    confirmLabel = "Complete Session";
    confirmVariant = "default";
    confirmButtonClass = "bg-emerald-600 hover:bg-emerald-700 text-white";
  } else if (config.actionType === "SWITCH_QUEUE") {
    const isToConsult = config.targetQueueType === QueueType.CONSULTATION;
    dialogIcon = <ArrowRightLeft className="size-5" />;
    iconContainerClass = isToConsult
      ? "bg-sky-500/10 border-sky-500/20 text-sky-600 dark:text-sky-400"
      : "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400";
    title = isToConsult
      ? "Switch to Consultation Queue"
      : "Switch to Therapy Queue";
    description = `Transfer patient to ${
      isToConsult
        ? "Consultation Queue (Doctor Chambers)"
        : "Therapy Queue (Physical Therapy & Rehab)"
    }.`;
    confirmLabel = isToConsult ? "Transfer to Consult" : "Transfer to Therapy";
    confirmVariant = "default";
  } else if (config.actionType === "REMOVE_FROM_QUEUE") {
    dialogIcon = <XCircle className="size-5" />;
    iconContainerClass =
      "bg-destructive/10 border-destructive/20 text-destructive";
    title = "Authorize Removal from Queue";
    description = "Remove this patient from the live waiting room queue.";
    confirmLabel = "Remove from Queue";
    confirmVariant = "destructive";
  }

  const handleConfirm = async () => {
    if (!selectedPerformerId && performers.length > 0) {
      toast.error("Please select an authorizing receptionist staff member.");
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await onConfirm(
        config,
        selectedPerformerId,
        isCheckIn ? selectedQueueType : undefined,
        config.actionType === "START_SERVICE" && isConsult
          ? selectedRoomId
          : undefined,
      );
      if (success) {
        onOpenChange(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DialogContent className="w-[95vw] sm:max-w-lg md:max-w-xl max-h-[min(90vh,620px)] flex flex-col p-0 overflow-hidden border-border/80 shadow-2xl rounded-2xl">
      {/* Header */}
      <DialogHeader className="p-5 pb-4 border-b border-border/60 shrink-0 bg-muted/20">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-xl border ${iconContainerClass}`}>
            {dialogIcon}
          </div>
          <div>
            <DialogTitle className="text-base font-bold">{title}</DialogTitle>
            <DialogDescription className="text-xs">
              {description}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      {/* Body */}
      <div className="p-5 space-y-4 overflow-y-auto flex-1">
        {/* Appointment Summary Card */}
        <div className="p-3.5 rounded-xl border border-border/70 bg-card space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-foreground">
              Patient: {config.patientName || "Patient"}
            </p>
            {config.slotLabel && (
              <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                <Clock className="size-3" />
                {config.slotLabel}
              </span>
            )}
          </div>

          {config.actionType === "SWITCH_QUEUE" && (
            <div className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1 border-t border-border/50">
              <span className="font-medium">Transfer target:</span>
              <span className="font-bold text-foreground">
                {config.targetQueueType === QueueType.CONSULTATION
                  ? "Consultation Queue (Doctor)"
                  : "Therapy Queue (Physiotherapy)"}
              </span>
            </div>
          )}
        </div>

        {/* Queue Selector (Only for Check-In) */}
        {isCheckIn && (
          <div className="space-y-2">
            <label className="text-xs font-bold text-foreground flex items-center justify-between">
              <span>Assign to Queue</span>
              <span className="text-[11px] text-muted-foreground font-normal">
                Waiting screen column
              </span>
            </label>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedQueueType(QueueType.THERAPY)}
                className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                  selectedQueueType === QueueType.THERAPY
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-950 dark:text-emerald-200 ring-2 ring-emerald-500/20"
                    : "border-border/80 bg-card hover:bg-muted/50 text-foreground"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div
                    className={`p-1.5 rounded-lg ${
                      selectedQueueType === QueueType.THERAPY
                        ? "bg-emerald-500 text-white"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Activity className="size-4" />
                  </div>
                  {selectedQueueType === QueueType.THERAPY && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                      Active
                    </span>
                  )}
                </div>
                <div>
                  <div className="text-xs font-black">Therapy Queue</div>
                  <div className="text-[10.5px] text-muted-foreground leading-tight">
                    Physical therapy & rehab
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedQueueType(QueueType.CONSULTATION)}
                className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                  selectedQueueType === QueueType.CONSULTATION
                    ? "border-sky-500 bg-sky-500/10 text-sky-950 dark:text-sky-200 ring-2 ring-sky-500/20"
                    : "border-border/80 bg-card hover:bg-muted/50 text-foreground"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div
                    className={`p-1.5 rounded-lg ${
                      selectedQueueType === QueueType.CONSULTATION
                        ? "bg-sky-500 text-white"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Stethoscope className="size-4" />
                  </div>
                  {selectedQueueType === QueueType.CONSULTATION && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-700 dark:text-sky-300">
                      Active
                    </span>
                  )}
                </div>
                <div>
                  <div className="text-xs font-black">Consultation Queue</div>
                  <div className="text-[10.5px] text-muted-foreground leading-tight">
                    Doctor chambers & consult
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Room / Chamber Selector (Only when Calling Doctor) */}
        {config.actionType === "START_SERVICE" && isConsult && (
          <div className="space-y-2">
            <label className="text-xs font-bold text-foreground flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <DoorOpen className="size-3.5 text-sky-600 dark:text-sky-400" />
                <span>Assign Doctor Room / Chamber</span>
              </span>
              <span className="text-[11px] text-muted-foreground font-normal">
                Announced on waiting TV
              </span>
            </label>

            {rooms.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-44 overflow-y-auto p-1 rounded-xl border border-border/60 bg-muted/10">
                {rooms.map((room) => {
                  const isSelected = selectedRoomId === room.id;
                  const isDoctorRoom =
                    room.accessType === "DOCTOR" ||
                    room.purpose.toLowerCase().includes("doctor");

                  return (
                    <button
                      key={room.id}
                      type="button"
                      onClick={() => setSelectedRoomId(room.id)}
                      className={`p-2.5 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between gap-1 relative ${
                        isSelected
                          ? "border-sky-500 bg-sky-500/15 text-sky-950 dark:text-sky-100 ring-2 ring-sky-500/20 shadow-xs"
                          : isDoctorRoom
                            ? "border-sky-500/30 bg-card hover:bg-sky-500/5 text-foreground"
                            : "border-border/60 bg-card/60 hover:bg-muted/40 text-muted-foreground"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-black text-foreground">
                          Room {room.number}
                        </span>
                        {isDoctorRoom && (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1 py-0.2 rounded bg-sky-500/20 text-sky-700 dark:text-sky-300">
                            Doctor
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] truncate leading-tight text-muted-foreground">
                        {room.purpose || "Chamber"}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-3 rounded-xl border border-border/70 bg-card text-xs text-muted-foreground">
                No rooms configured. Calling to General Doctor Chamber.
              </div>
            )}
          </div>
        )}

        {/* Performer Selector */}
        <ReceptionistPerformerSelect
          performers={performers}
          selectedPerformerId={selectedPerformerId}
          onSelectPerformerId={setSelectedPerformerId}
          disabled={isSubmitting}
          label="Authorizing Receptionist"
        />
      </div>

      {/* Footer */}
      <DialogFooter className="p-4 sm:px-6 py-3.5 border-t border-border/60 bg-muted/20 shrink-0 flex items-center justify-end gap-2.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onOpenChange(false)}
          disabled={isSubmitting}
          className="cursor-pointer text-xs"
        >
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          variant={confirmVariant}
          onClick={handleConfirm}
          disabled={
            isSubmitting || (!selectedPerformerId && performers.length > 0)
          }
          className={`cursor-pointer gap-1.5 text-xs font-semibold ${confirmButtonClass}`}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              <span>Processing...</span>
            </>
          ) : (
            <span>{confirmLabel}</span>
          )}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
