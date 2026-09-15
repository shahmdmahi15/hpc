"use client";

import * as React from "react";
import type { AppointmentWithRelations } from "@/actions/receptionist/appointment.action";
import { updateAppointmentStatusAction } from "@/actions/receptionist/appointment.action";
import {
  AppointmentStatus,
  QueueType,
  RoomAccessType,
  RoomStatus,
} from "@/generated/prisma/enums";
import type { RoomModel, PerformerModel } from "@/generated/prisma/models";
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
  Volume2,
  DoorOpen,
  Activity,
  Phone,
  Clock,
  Check,
  User,
  Radio,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { evaluatePunctuality, formatTime12h } from "@/lib/queue-punctuality";

export interface CallToTherapyRoomDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: AppointmentWithRelations;
  handlers: PerformerModel[];
  rooms: RoomModel[];
  defaultHandlerId?: string;
  defaultRoomId?: string;
  onSuccess: () => void;
}

export function CallToTherapyRoomDialog({
  isOpen,
  onOpenChange,
  appointment,
  handlers,
  rooms,
  defaultHandlerId,
  defaultRoomId,
  onSuccess,
}: CallToTherapyRoomDialogProps) {
  // 1. Strictly filter rooms: RoomAccessType.PUBLIC and RoomStatus.AVAILABLE
  const publicAvailableRooms = React.useMemo(() => {
    return rooms.filter((r) => {
      return (
        r.accessType === RoomAccessType.PUBLIC &&
        r.status === RoomStatus.AVAILABLE
      );
    });
  }, [rooms]);

  // First available public room
  const firstPublicRoom = React.useMemo(() => {
    return publicAvailableRooms[0] || null;
  }, [publicAvailableRooms]);

  // Handler Performers
  const firstHandler = React.useMemo(() => {
    return handlers[0] || null;
  }, [handlers]);

  // Initial room selection
  const initialRoomId = React.useMemo(() => {
    if (
      defaultRoomId &&
      publicAvailableRooms.some((r) => r.id === defaultRoomId)
    ) {
      return defaultRoomId;
    }
    return firstPublicRoom?.id || "";
  }, [defaultRoomId, publicAvailableRooms, firstPublicRoom]);

  // Performer auto-selection rule: If single performer, automatically select it!
  const initialHandlerId = React.useMemo(() => {
    if (handlers.length === 1) {
      return handlers[0].id;
    }
    return defaultHandlerId || firstHandler?.id || "";
  }, [handlers, defaultHandlerId, firstHandler]);

  const [selectedRoomId, setSelectedRoomId] = React.useState<string>(
    () => initialRoomId,
  );
  const [selectedHandlerId, setSelectedHandlerId] = React.useState<string>(
    () => initialHandlerId,
  );
  const [isCalling, setIsCalling] = React.useState(false);

  // Sync state when dialog opens
  const [prevOpen, setPrevOpen] = React.useState(isOpen);
  if (isOpen !== prevOpen) {
    setPrevOpen(isOpen);
    if (isOpen) {
      setSelectedRoomId(initialRoomId);
      setSelectedHandlerId(initialHandlerId);
    }
  }

  // Active room entity
  const activeRoom = React.useMemo(() => {
    return (
      publicAvailableRooms.find((r) => r.id === selectedRoomId) ||
      firstPublicRoom
    );
  }, [publicAvailableRooms, selectedRoomId, firstPublicRoom]);

  // Active handler entity
  const activeHandler = React.useMemo(() => {
    return (
      handlers.find((h) => h.id === selectedHandlerId) || firstHandler
    );
  }, [handlers, selectedHandlerId, firstHandler]);

  // Punctuality info
  const punctuality = React.useMemo(() => {
    return evaluatePunctuality(appointment.toldTime, appointment.checkInTime);
  }, [appointment.toldTime, appointment.checkInTime]);

  const isMale = appointment.gender === "MALE";

  const handleConfirmCall = async () => {
    if (!selectedRoomId) {
      toast.error("Please select an available public therapy room.");
      return;
    }

    setIsCalling(true);
    try {
      const res = await updateAppointmentStatusAction(
        appointment.id,
        AppointmentStatus.CALLING,
        selectedHandlerId || undefined,
        QueueType.THERAPY,
        selectedRoomId,
      );

      if (res.success) {
        toast.success(
          `Calling ${appointment.patient?.name || "Patient"} to Room ${activeRoom?.number || ""}. Patient can enter now!`,
        );
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Failed to call patient to therapy room.");
    } finally {
      setIsCalling(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-lg md:max-w-xl max-h-[92vh] flex flex-col p-0 overflow-hidden border-border/80 shadow-2xl rounded-2xl">
        {/* Header */}
        <DialogHeader className="p-4 sm:p-5 pb-3 border-b border-border/60 bg-emerald-500/5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400">
                <Volume2 className="size-5 animate-pulse" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <span>Call Patient to Therapy Room</span>
                  <Badge
                    variant="outline"
                    className="text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                  >
                    Public Room
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Announce patient on waiting room TV screens and call into an
                  available public therapy room.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Patient Card */}
          <div className="p-3 rounded-xl border border-border/80 bg-card/60 backdrop-blur-xs space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
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

                <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono mt-1 flex-wrap">
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

              {/* Punctuality Status */}
              <div
                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                  punctuality.status === "green"
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                    : punctuality.status === "yellow"
                      ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20"
                      : "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20"
                }`}
              >
                {punctuality.label}
              </div>
            </div>
          </div>

          {/* Section 1: Public Available Therapy Rooms */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <DoorOpen className="size-3.5 text-emerald-500" />
                <span>Select Available Public Room</span>
                <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] font-mono text-muted-foreground">
                {publicAvailableRooms.length} Available
              </span>
            </div>

            {publicAvailableRooms.length === 0 ? (
              <div className="rounded-xl border border-dashed border-amber-500/40 bg-amber-500/5 p-4 text-center space-y-1">
                <AlertCircle className="size-5 text-amber-500 mx-auto" />
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                  No Public Therapy Rooms Available
                </p>
                <p className="text-[11px] text-muted-foreground">
                  All public rooms are currently occupied or in maintenance.
                  Wait for an active session to complete or check room status.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {publicAvailableRooms.map((r) => {
                  const isSelected = selectedRoomId === r.id;
                  return (
                    <button
                      type="button"
                      key={r.id}
                      onClick={() => setSelectedRoomId(r.id)}
                      className={`relative flex flex-col p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/20 shadow-xs"
                          : "border-border/80 bg-muted/20 hover:border-border hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold font-mono text-foreground">
                          Room {r.number}
                        </span>
                        {isSelected && (
                          <div className="size-4 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                            <Check className="size-2.5 stroke-[3]" />
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground truncate mt-0.5">
                        {r.purpose || "Therapy"}
                      </span>
                      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                        <span className="px-1 py-0.2 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[9px] font-bold uppercase">
                          Available
                        </span>
                        <span className="px-1 py-0.2 rounded bg-muted text-muted-foreground text-[9px] font-mono">
                          {r.gender || "Public"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: Handler Performer Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <User className="size-3.5 text-emerald-500" />
                <span>Attending Therapist / Handler</span>
                {handlers.length === 1 && (
                  <span className="px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold">
                    Auto-selected
                  </span>
                )}
              </label>
            </div>

            {handlers.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                No on-duty handlers configured.
              </p>
            ) : handlers.length === 1 ? (
              <div className="p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-6 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-[11px]">
                    {handlers[0].name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">
                      {handlers[0].name}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      Therapy Performer
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="text-[9.5px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25"
                >
                  Sole Performer
                </Badge>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {handlers.map((h) => {
                  const isSelected = selectedHandlerId === h.id;
                  return (
                    <button
                      type="button"
                      key={h.id}
                      onClick={() => setSelectedHandlerId(h.id)}
                      className={`flex items-center justify-between p-2 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/25 font-bold"
                          : "border-border/80 bg-muted/20 hover:border-border hover:bg-muted/40"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-xs text-foreground truncate">
                          {h.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono truncate">
                          {h.phone || "Therapist"}
                        </p>
                      </div>
                      {isSelected && (
                        <Check className="size-3.5 text-emerald-500 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Announcement Preview Box */}
          <div className="p-3 rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent flex items-center gap-3">
            <Radio className="size-4 text-emerald-500 animate-pulse shrink-0" />
            <div className="text-xs">
              <span className="font-semibold text-foreground">
                Live TV Call Preview:{" "}
              </span>
              <span className="text-muted-foreground">
                &ldquo;Calling {appointment.patient?.name || "Patient"} to Room{" "}
                {activeRoom?.number || "..."} (Physical Therapy)&rdquo;
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="p-3 sm:p-4 border-t border-border/60 bg-muted/20 flex flex-row items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isCalling}
            className="text-xs cursor-pointer"
          >
            Cancel
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleConfirmCall}
            disabled={isCalling || publicAvailableRooms.length === 0}
            className="h-8 px-4 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs cursor-pointer gap-1.5"
          >
            <Volume2 className="size-3.5" />
            <span>{isCalling ? "Calling..." : "Call to Room Now"}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
