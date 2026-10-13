"use client";

import * as React from "react";
import type { AppointmentWithRelations } from "@/actions/receptionist/appointment.action";
import { switchTherapyRoomAction } from "@/actions/handler/handler.action";
import { AppointmentStatus, RoomAccessType, RoomStatus } from "@/generated/prisma/enums";
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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DoorOpen,
  ArrowRight,
  Check,
  Activity,
  AlertCircle,
  Phone,
  Sparkles,
  RefreshCw,
  User,
} from "lucide-react";
import { StaffPerformerSelect } from "@/components/shared/staff-performer-select";
import { toast } from "sonner";

export interface SwitchTherapyRoomDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: AppointmentWithRelations | null;
  rooms: RoomModel[];
  handlers: PerformerModel[];
  activeAppointments?: AppointmentWithRelations[];
  defaultHandlerId?: string;
  onSuccess: () => void;
}

export function SwitchTherapyRoomDialog({
  isOpen,
  onOpenChange,
  appointment,
  rooms = [],
  handlers = [],
  activeAppointments = [],
  defaultHandlerId,
  onSuccess,
}: SwitchTherapyRoomDialogProps) {
  // Handler selection
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
  const [selectedRoomId, setSelectedRoomId] = React.useState<string>("");
  const [reasonInput, setReasonInput] = React.useState<string>("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Current assigned room of this patient
  const currentRoomNumber =
    appointment?.room?.number ||
    appointment?.therapySlot?.room?.number ||
    null;
  const currentRoomId = appointment?.roomId || null;

  // Filter all therapy rooms
  const therapyRooms = React.useMemo(() => {
    return rooms
      .filter((r) => {
        const num = parseInt(r.number, 10);
        return (
          r.accessType === RoomAccessType.THERAPY ||
          r.purpose?.toLowerCase().includes("therapy") ||
          (num >= 207 && num <= 215)
        );
      })
      .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
  }, [rooms]);

  // Identify occupancy map from active appointments
  const roomOccupancyMap = React.useMemo(() => {
    const map = new Map<string, { patientName: string; appointmentId: string; status: string }>();
    for (const apt of activeAppointments) {
      if (
        apt.id !== appointment?.id &&
        (apt.status === AppointmentStatus.IN_THERAPY || apt.status === AppointmentStatus.CALLING)
      ) {
        const rId = apt.roomId || apt.room?.id;
        const rNum = apt.room?.number || apt.therapySlot?.room?.number;
        if (rId) {
          map.set(rId, {
            patientName: apt.patient?.name || "Patient",
            appointmentId: apt.id,
            status: apt.status === AppointmentStatus.IN_THERAPY ? "In Therapy" : "Calling",
          });
        } else if (rNum) {
          // fallback match by number
          const matched = therapyRooms.find((r) => r.number === rNum);
          if (matched) {
            map.set(matched.id, {
              patientName: apt.patient?.name || "Patient",
              appointmentId: apt.id,
              status: apt.status === AppointmentStatus.IN_THERAPY ? "In Therapy" : "Calling",
            });
          }
        }
      }
    }
    return map;
  }, [activeAppointments, appointment?.id, therapyRooms]);

  // Available / Empty therapy rooms
  const emptyTherapyRooms = React.useMemo(() => {
    return therapyRooms.filter(
      (r) => r.id !== currentRoomId && !roomOccupancyMap.has(r.id),
    );
  }, [therapyRooms, currentRoomId, roomOccupancyMap]);

  // Sync state on open
  const [prevOpen, setPrevOpen] = React.useState(isOpen);
  if (isOpen !== prevOpen) {
    setPrevOpen(isOpen);
    if (isOpen) {
      setSelectedHandlerId(initialHandlerId);
      setHandlerPin("");
      setReasonInput("");
      // Preselect first empty therapy room
      const firstEmpty = emptyTherapyRooms[0];
      setSelectedRoomId(firstEmpty ? firstEmpty.id : "");
    }
  }

  if (!appointment) return null;

  const isMale = appointment.gender === "MALE";
  const selectedTargetRoom = therapyRooms.find((r) => r.id === selectedRoomId);

  const handleConfirmSwitch = async () => {
    if (!selectedRoomId) {
      toast.error("Please select an empty therapy room to transfer.");
      return;
    }

    if (selectedRoomId === currentRoomId) {
      toast.error(`Patient is already in Room ${currentRoomNumber}. Please pick another empty room.`);
      return;
    }

    if (roomOccupancyMap.has(selectedRoomId)) {
      const occ = roomOccupancyMap.get(selectedRoomId);
      toast.error(`Room is currently occupied by ${occ?.patientName}. Please select an empty room.`);
      return;
    }

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
      const res = await switchTherapyRoomAction({
        appointmentId: appointment.id,
        targetRoomId: selectedRoomId,
        performerId: selectedHandlerId || undefined,
        pin: handlerPin.trim() || undefined,
        reason: reasonInput.trim() || undefined,
      });

      if (res.success) {
        toast.success(res.message);
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to switch therapy room.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-2xl max-h-[92dvh] flex flex-col p-0 overflow-hidden rounded-2xl shadow-2xl border-border/80">
        {/* Header */}
        <DialogHeader className="p-4 sm:p-5 pb-3 sm:pb-4 pr-12 sm:pr-14 border-b border-border/60 bg-amber-500/5 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <DoorOpen className="size-5 stroke-[2.2]" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2 flex-wrap">
                  <span>Switch Therapy Room</span>
                  <Badge
                    variant="outline"
                    className="text-[10px] font-mono font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                  >
                    রুম পরিবর্তন
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Transfer patient to another empty therapy room (e.g. 210 → 215) in real time.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Modal Body */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4">
          {/* Patient Overview Card */}
          <div className="p-3 rounded-xl border border-border/80 bg-card/60 backdrop-blur-xs space-y-2">
            <div className="flex items-start justify-between gap-2 flex-wrap">
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

                  <h3 className="text-sm sm:text-base font-bold text-foreground">
                    {appointment.patient?.name || "Patient"}
                  </h3>

                  <Badge
                    variant="outline"
                    className="text-[10px] font-mono bg-muted/60 text-muted-foreground border-border"
                  >
                    {appointment.patient?.mrn || "No MRN"}
                  </Badge>

                  <Badge
                    variant="outline"
                    className={`text-[10px] font-bold ${
                      appointment.status === AppointmentStatus.IN_THERAPY
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                        : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                    }`}
                  >
                    {appointment.status === AppointmentStatus.IN_THERAPY
                      ? "In Therapy Session"
                      : "Calling to Therapy"}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 font-mono">
                  <span className="flex items-center gap-1">
                    <Phone className="size-3 opacity-60" />
                    <span>{appointment.patient?.phone || "No phone"}</span>
                  </span>
                </div>
              </div>

              {/* Current Room Indicator */}
              <div className="flex items-center gap-2 bg-muted/40 p-2 px-3 rounded-xl border border-border">
                <div className="text-right">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                    Current Bed / Room
                  </span>
                  <span className="text-sm font-black font-mono text-foreground flex items-center gap-1 justify-end">
                    <DoorOpen className="size-3.5 text-amber-500" />
                    Room {currentRoomNumber || "--"}
                  </span>
                </div>
                {selectedTargetRoom && (
                  <>
                    <ArrowRight className="size-4 text-emerald-500 shrink-0" />
                    <div className="text-left">
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-bold block">
                        New Room
                      </span>
                      <span className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <DoorOpen className="size-3.5" />
                        Room {selectedTargetRoom.number}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Section: Select New Therapy Room */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <DoorOpen className="size-3.5 text-emerald-500" />
                <span>Select Target Empty Therapy Room</span>
                <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                  {emptyTherapyRooms.length} Empty
                </span>
                <span>•</span>
                <span>{therapyRooms.length} Total</span>
              </div>
            </div>

            {therapyRooms.length === 0 ? (
              <div className="rounded-xl border border-dashed border-amber-500/40 bg-amber-500/5 p-4 text-center space-y-1">
                <AlertCircle className="size-5 text-amber-500 mx-auto" />
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                  No Therapy Rooms Configured
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Please verify clinic room setup in Admin / Room Management.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {therapyRooms.map((r) => {
                  const isCurrent = r.id === currentRoomId || r.number === currentRoomNumber;
                  const occupiedInfo = roomOccupancyMap.get(r.id);
                  const isOccupied = Boolean(occupiedInfo);
                  const isSelected = selectedRoomId === r.id;
                  const isDisabled = isCurrent || isOccupied;

                  return (
                    <button
                      type="button"
                      key={r.id}
                      disabled={isDisabled}
                      onClick={() => setSelectedRoomId(r.id)}
                      className={`relative flex flex-col p-2.5 rounded-xl border text-left transition-all ${
                        isCurrent
                          ? "border-blue-500/40 bg-blue-500/5 opacity-70 cursor-not-allowed"
                          : isOccupied
                            ? "border-amber-500/40 bg-amber-500/5 opacity-60 cursor-not-allowed"
                            : isSelected
                              ? "border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/30 shadow-xs cursor-pointer"
                              : "border-border/80 bg-muted/20 hover:border-emerald-500/50 hover:bg-emerald-500/5 cursor-pointer"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold font-mono text-foreground flex items-center gap-1">
                          <DoorOpen className="size-3 opacity-70" />
                          Room {r.number}
                        </span>
                        {isSelected && !isCurrent && (
                          <div className="size-4 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                            <Check className="size-2.5 stroke-[3]" />
                          </div>
                        )}
                      </div>

                      <span className="text-[10px] text-muted-foreground truncate mt-0.5">
                        {r.purpose || "Therapy Room"}
                      </span>

                      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                        {isCurrent ? (
                          <span className="px-1 py-0.2 rounded bg-blue-500/20 text-blue-700 dark:text-blue-300 text-[9px] font-bold uppercase">
                            Current Room
                          </span>
                        ) : isOccupied ? (
                          <span className="px-1 py-0.2 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[9px] font-bold truncate max-w-[120px]">
                            {occupiedInfo?.patientName} ({occupiedInfo?.status})
                          </span>
                        ) : (
                          <span className="px-1 py-0.2 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[9px] font-bold uppercase flex items-center gap-0.5">
                            <span className="size-1 rounded-full bg-emerald-500" />
                            Empty / Available
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Reason Chips & Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Sparkles className="size-3 text-amber-500" />
              <span>Transfer Reason / Note (Optional)</span>
            </label>

            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                "Machine Transfer",
                "Patient Requested Bed",
                "Equipment Relocation",
                "More Space / Modality",
                "Routine Bed Reallocation",
              ].map((reason) => (
                <button
                  type="button"
                  key={reason}
                  onClick={() => setReasonInput(reason)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all border cursor-pointer ${
                    reasonInput === reason
                      ? "bg-amber-500 text-white border-amber-600 shadow-2xs"
                      : "bg-muted/40 hover:bg-muted text-muted-foreground border-border/60"
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>

            <Input
              type="text"
              placeholder="e.g. Switched to Room 215 for traction equipment..."
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
              className="h-8 text-xs rounded-lg bg-background border-border"
            />
          </div>

          {/* Staff Performer Selection & PIN */}
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
            pinLabel="Therapist 4-Digit PIN:"
            fallbackRoleName="Therapy Floor"
            roleIcon={Activity}
            pinInputName="handler_switch_room_auth_pin"
          />
        </div>

        {/* Footer */}
        <DialogFooter className="p-3 sm:p-4 border-t border-border/60 bg-muted/20 flex flex-row items-center justify-end gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="h-8 px-3 text-xs font-semibold cursor-pointer"
          >
            Cancel
          </Button>

          <Button
            type="button"
            onClick={handleConfirmSwitch}
            disabled={isSubmitting || !selectedRoomId || selectedRoomId === currentRoomId}
            className="h-8 px-4 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs cursor-pointer gap-1.5"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="size-3.5 animate-spin" />
                <span>Switching...</span>
              </>
            ) : (
              <>
                <DoorOpen className="size-3.5" />
                <span>
                  Confirm Switch to Room {selectedTargetRoom?.number || ""}
                </span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
