"use client";

import * as React from "react";
import type { AppointmentWithRelations } from "@/actions/receptionist/appointment.action";
import { updateAppointmentStatusAction } from "@/actions/receptionist/appointment.action";
import { AppointmentStatus, QueueType, RoomAccessType } from "@/generated/prisma/enums";
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
  Stethoscope,
  Phone,
  Clock,
  Check,
  User,
  Radio,
} from "lucide-react";
import { toast } from "sonner";
import { evaluatePunctuality } from "@/lib/queue-punctuality";

export interface CallToChamberDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: AppointmentWithRelations;
  doctors: PerformerModel[];
  rooms: RoomModel[];
  defaultDoctorId?: string;
  defaultRoomId?: string;
  onSuccess: () => void;
}

export function CallToChamberDialog({
  isOpen,
  onOpenChange,
  appointment,
  doctors,
  rooms,
  defaultDoctorId,
  defaultRoomId,
  onSuccess,
}: CallToChamberDialogProps) {
  // 1. Strictly identify Doctor Consultation rooms only using RoomAccessType.DOCTOR or purpose "Doctor Consultation"
  const doctorConsultationRooms = React.useMemo(() => {
    return rooms.filter((r) => {
      return (
        r.accessType === RoomAccessType.DOCTOR ||
        r.purpose?.toLowerCase().includes("consultation")
      );
    });
  }, [rooms]);

  // First doctor consultation room
  const firstDoctorRoom = React.useMemo(() => {
    return doctorConsultationRooms[0] || null;
  }, [doctorConsultationRooms]);

  // First doctor performer
  const firstDoctor = React.useMemo(() => {
    return doctors[0] || null;
  }, [doctors]);

  // Initial Doctor Room ID: only accept defaultRoomId if it is a doctor consultation room
  const initialDoctorRoomId = React.useMemo(() => {
    if (
      defaultRoomId &&
      doctorConsultationRooms.some((r) => r.id === defaultRoomId)
    ) {
      return defaultRoomId;
    }
    return firstDoctorRoom?.id || "";
  }, [defaultRoomId, doctorConsultationRooms, firstDoctorRoom]);

  // State with defaults pointing strictly to 1st doctor room and 1st doctor
  const [selectedRoomId, setSelectedRoomId] = React.useState<string>(
    () => initialDoctorRoomId,
  );
  const [selectedDoctorId, setSelectedDoctorId] = React.useState<string>(
    () => defaultDoctorId || firstDoctor?.id || "",
  );
  const [isCalling, setIsCalling] = React.useState(false);

  // Sync state when dialog opens (React recommended render-time adjustment)
  const [prevOpen, setPrevOpen] = React.useState(isOpen);
  if (isOpen !== prevOpen) {
    setPrevOpen(isOpen);
    if (isOpen) {
      setSelectedRoomId(initialDoctorRoomId);
      setSelectedDoctorId(defaultDoctorId || firstDoctor?.id || "");
    }
  }

  // Selected entities
  const activeRoom = React.useMemo(() => {
    return (
      doctorConsultationRooms.find((r) => r.id === selectedRoomId) ||
      firstDoctorRoom
    );
  }, [doctorConsultationRooms, selectedRoomId, firstDoctorRoom]);

  const activeDoctor = React.useMemo(() => {
    return doctors.find((d) => d.id === selectedDoctorId) || firstDoctor;
  }, [doctors, selectedDoctorId, firstDoctor]);

  // Punctuality info
  const punctuality = React.useMemo(() => {
    return evaluatePunctuality(
      appointment.toldTime,
      appointment.checkInTime,
    );
  }, [
    appointment.toldTime,
    appointment.checkInTime,
  ]);

  const isMale = appointment.gender === "MALE";

  const handleConfirmCall = async () => {
    if (!selectedRoomId) {
      toast.error("Please select a chamber room.");
      return;
    }

    setIsCalling(true);
    try {
      const res = await updateAppointmentStatusAction(
        appointment.id,
        AppointmentStatus.CALLING,
        selectedDoctorId || undefined,
        QueueType.CONSULTATION,
        selectedRoomId,
      );

      if (res.success) {
        toast.success(
          `Calling ${appointment.patient?.name || "Patient"} to Chamber ${activeRoom?.number ? `(Room ${activeRoom.number})` : ""}. Patient can enter now!`,
        );
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Failed to broadcast call to chamber.");
    } finally {
      setIsCalling(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-lg md:max-w-xl p-5 space-y-4 rounded-2xl shadow-2xl border-border/80">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="size-8.5 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
              <Volume2 className="size-4.5 animate-pulse" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Call Patient to Chamber
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Broadcasts call on Waiting Hall TV &amp; changes status to Calling. Mark In Consultation when patient arrives.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* 1. Patient Summary Card */}
        <div className="p-3 rounded-xl border border-border/80 bg-muted/30 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span
                className={`px-1.5 py-0.2 rounded text-[9.5px] font-bold border shrink-0 ${
                  isMale
                    ? "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20"
                    : "bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/20"
                }`}
              >
                {isMale ? "M" : "F"}
              </span>
              <span className="font-bold text-sm text-foreground">
                {appointment.patient?.name || "Patient"}
              </span>
            </div>

            <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-background border border-border/80 text-foreground">
              #{appointment.id.slice(-4).toUpperCase()}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono flex-wrap">
            <span className="flex items-center gap-1">
              <Phone className="size-3 opacity-70" />
              {appointment.patient?.phone || "---"}
            </span>

            {appointment.toldTime && (
              <span className="flex items-center gap-1">
                <Clock className="size-3 opacity-70" />
                Told: {appointment.toldTime}
              </span>
            )}

            <Badge
              variant="outline"
              className={`text-[10px] py-0 font-bold ${punctuality.badgeClass}`}
            >
              {punctuality.label}
            </Badge>
          </div>
        </div>

        {/* 2. Select Chamber Room */}
        {doctorConsultationRooms.length === 0 ? (
          <div className="p-3 rounded-lg border border-dashed border-border text-center text-xs text-muted-foreground">
            No Doctor Consultation rooms found.
          </div>
        ) : doctorConsultationRooms.length === 1 ? (
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <DoorOpen className="size-3.5 text-sky-500" />
                <span>Chamber Room</span>
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                Auto-Selected Room
              </span>
            </label>
            <div className="p-2.5 rounded-xl border border-sky-500/40 bg-sky-500/10 text-sky-900 dark:text-sky-200 flex items-center justify-between">
              <div>
                <div className="font-bold text-xs flex items-center gap-1.5">
                  <span>Room {doctorConsultationRooms[0].number}</span>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {doctorConsultationRooms[0].purpose || "Doctor Consultation"}
                </div>
              </div>
              <Check className="size-4 text-sky-600 dark:text-sky-400 shrink-0" />
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <DoorOpen className="size-3.5 text-sky-500" />
                <span>Chamber Room</span>
              </span>
              <span className="text-[10.5px] text-muted-foreground font-normal">
                Default: 1st Doctor Room
              </span>
            </label>

            <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
              {doctorConsultationRooms.map((room) => {
                const isSelected = selectedRoomId === room.id;
                return (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => setSelectedRoomId(room.id)}
                    className={`flex items-center justify-between p-2 rounded-lg border text-left transition-all cursor-pointer ${
                      isSelected
                        ? "border-sky-500 bg-sky-500/10 text-sky-900 dark:text-sky-200 shadow-xs ring-1 ring-sky-500/40"
                        : "border-border/80 bg-card hover:bg-muted/50 text-foreground"
                    }`}
                  >
                    <div className="truncate">
                      <div className="font-bold text-xs flex items-center gap-1">
                        <span>Room {room.number}</span>
                        {firstDoctorRoom?.id === room.id && (
                          <span className="text-[9px] font-bold px-1 rounded bg-sky-500/20 text-sky-700 dark:text-sky-300">
                            1st Doctor Room
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {room.purpose || "Doctor Consultation"}
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="size-3.5 text-sky-600 dark:text-sky-400 shrink-0 ml-1" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. Select Attending Doctor */}
        {doctors.length === 1 ? (
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Stethoscope className="size-3.5 text-blue-500" />
                <span>Attending Doctor</span>
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                Auto-Selected Doctor
              </span>
            </label>
            <div className="p-2.5 rounded-xl border border-sky-500/40 bg-sky-500/10 text-sky-900 dark:text-sky-200 flex items-center justify-between">
              <div className="flex items-center gap-2 truncate">
                <div className="size-7 rounded-lg bg-sky-500/20 flex items-center justify-center shrink-0 text-sky-600 dark:text-sky-300 font-bold text-xs">
                  {doctors[0].name.slice(0, 2).toUpperCase()}
                </div>
                <div className="truncate">
                  <p className="font-bold text-xs text-foreground truncate">
                    {doctors[0].name}
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                    <Phone className="size-2.5" />
                    {doctors[0].phone}
                  </p>
                </div>
              </div>
              <Check className="size-4 text-sky-600 dark:text-sky-400 shrink-0" />
            </div>
          </div>
        ) : doctors.length > 1 ? (
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Stethoscope className="size-3.5 text-blue-500" />
                <span>Attending Doctor</span>
              </span>
              <span className="text-[10.5px] text-muted-foreground font-normal">
                Default: 1st Doctor
              </span>
            </label>

            <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
              {doctors.map((doctor, index) => {
                const isSelected = selectedDoctorId === doctor.id;
                return (
                  <button
                    key={doctor.id}
                    type="button"
                    onClick={() => setSelectedDoctorId(doctor.id)}
                    className={`w-full flex items-center justify-between p-2 rounded-lg border text-left transition-all cursor-pointer ${
                      isSelected
                        ? "border-sky-500 bg-sky-500/10 text-sky-900 dark:text-sky-200 shadow-xs ring-1 ring-sky-500/40"
                        : "border-border/80 bg-card hover:bg-muted/50 text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div className="size-6 rounded-md bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
                        <User className="size-3.5" />
                      </div>
                      <div className="truncate">
                        <div className="font-bold text-xs flex items-center gap-1">
                          <span>{doctor.name}</span>
                          {index === 0 && (
                            <span className="text-[9px] font-bold px-1 rounded bg-blue-500/20 text-blue-700 dark:text-blue-300">
                              1st Doctor
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          {doctor.phone}
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="size-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* 4. Live Broadcast Preview */}
        <div className="p-2.5 rounded-lg border border-sky-500/30 bg-sky-500/5 text-xs space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-sky-700 dark:text-sky-300 text-[11px]">
            <Radio className="size-3 animate-pulse" />
            <span>Waiting Room Live Broadcast Preview:</span>
          </div>
          <p className="text-[11px] text-foreground font-sans italic pl-4 border-l-2 border-sky-500/40">
            &ldquo;Attention please. Patient {appointment.patient?.name || "Patient"}. Please proceed to Room {activeRoom?.number || "Chamber"}{activeDoctor ? ` with ${activeDoctor.name}` : ""}.&rdquo;
          </p>
        </div>

        <DialogFooter className="pt-1 gap-1.5 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isCalling}
            className="h-8 text-xs cursor-pointer"
          >
            Cancel
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleConfirmCall}
            disabled={isCalling || !selectedRoomId}
            className="h-8 text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white gap-1.5 shadow-xs cursor-pointer"
          >
            {isCalling ? (
              <span>Calling...</span>
            ) : (
              <>
                <Volume2 className="size-3.5" />
                <span>Call to Room {activeRoom?.number || ""}</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
