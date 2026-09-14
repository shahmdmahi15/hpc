"use client";

import * as React from "react";
import type { AppointmentWithRelations } from "@/actions/receptionist/appointment.action";
import {
  updateAppointmentStatusAction,
  updateAppointmentWillCallTimeAction,
  switchQueueAction,
} from "@/actions/receptionist/appointment.action";
import { AppointmentStatus, QueueType } from "@/generated/prisma/enums";
import { evaluatePunctuality, formatTime12h } from "@/lib/queue-punctuality";
import { Button } from "@/components/ui/button";
import {
  Clock,
  CheckCircle2,
  DoorOpen,
  Pencil,
  ArrowRightLeft,
  Phone,
  Play,
  Activity,
} from "lucide-react";
import { toast } from "sonner";

interface HandlerQueueCardProps {
  appointment: AppointmentWithRelations;
  performerId: string;
  selectedRoomId?: string;
  selectedRoomNumber?: string;
  onRefresh: () => void;
}

export function HandlerQueueCard({
  appointment,
  performerId,
  selectedRoomId,
  selectedRoomNumber,
  onRefresh,
}: HandlerQueueCardProps) {
  // Call time inline editing
  const [isEditingCallTime, setIsEditingCallTime] = React.useState(false);
  const [prevWillCallTime, setPrevWillCallTime] = React.useState(
    appointment.willCallTime,
  );
  const [callTimeInput, setCallTimeInput] = React.useState(
    appointment.willCallTime || "",
  );
  const [isSavingCallTime, setIsSavingCallTime] = React.useState(false);
  const [isActionLoading, setIsActionLoading] = React.useState(false);

  // Sync state if appointment prop updates
  if (appointment.willCallTime !== prevWillCallTime) {
    setPrevWillCallTime(appointment.willCallTime);
    setCallTimeInput(appointment.willCallTime || "");
  }

  const handleSaveCallTime = async () => {
    setIsSavingCallTime(true);
    try {
      const res = await updateAppointmentWillCallTimeAction(
        appointment.id,
        callTimeInput,
        performerId,
      );
      if (res.success) {
        toast.success(res.message);
        setIsEditingCallTime(false);
        onRefresh();
      } else {
        toast.error(res.message);
      }
    } finally {
      setIsSavingCallTime(false);
    }
  };

  const handleAddMinutesToCallTime = (mins: number) => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + mins);
    let h = d.getHours();
    const m = d.getMinutes();
    const period = h >= 12 ? "PM" : "AM";
    h = h % 12;
    if (h === 0) h = 12;
    const formatted = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
    setCallTimeInput(formatted);
  };

  // Start Therapy Session
  const handleStartTherapy = async () => {
    setIsActionLoading(true);
    try {
      const res = await updateAppointmentStatusAction(
        appointment.id,
        AppointmentStatus.IN_THERAPY,
        performerId,
        QueueType.THERAPY,
        selectedRoomId,
      );
      if (res.success) {
        toast.success(
          `Therapy started for ${appointment.patient?.name || "Patient"}${selectedRoomNumber ? ` in Room ${selectedRoomNumber}` : ""}.`,
        );
        onRefresh();
      } else {
        toast.error(res.message);
      }
    } finally {
      setIsActionLoading(false);
    }
  };

  // Complete Therapy Session
  const handleCompleteTherapy = async () => {
    setIsActionLoading(true);
    try {
      const res = await updateAppointmentStatusAction(
        appointment.id,
        AppointmentStatus.COMPLETED,
        performerId,
        QueueType.THERAPY,
        selectedRoomId,
      );
      if (res.success) {
        toast.success(
          `Therapy completed for ${appointment.patient?.name || "Patient"}.`,
        );
        onRefresh();
      } else {
        toast.error(res.message);
      }
    } finally {
      setIsActionLoading(false);
    }
  };

  // Transfer to Doctor Consultation Queue
  const handleTransferToDoctor = async () => {
    setIsActionLoading(true);
    try {
      const res = await switchQueueAction(
        appointment.id,
        QueueType.CONSULTATION,
        performerId,
      );
      if (res.success) {
        toast.success(
          `${appointment.patient?.name || "Patient"} transferred to Doctor Consultation Queue.`,
        );
        onRefresh();
      } else {
        toast.error(res.message);
      }
    } finally {
      setIsActionLoading(false);
    }
  };

  const isMale = appointment.gender === "MALE";
  const isInTherapy = appointment.status === AppointmentStatus.IN_THERAPY;
  const punctuality = evaluatePunctuality(
    appointment.toldTime,
    appointment.checkInTime,
  );

  return (
    <div
      className={`rounded-xl border p-2.5 space-y-1.5 shadow-2xs transition-all duration-200 relative overflow-hidden flex flex-col justify-between ${
        isInTherapy
          ? "border-emerald-500/60 bg-emerald-500/5 ring-1 ring-emerald-500/30"
          : "border-border/80 bg-card hover:border-border"
      }`}
    >
      {/* 1. Header Row: Patient Name & Badges */}
      <div className="flex items-start justify-between gap-1.5">
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`px-1.5 py-0.2 rounded text-[9.5px] font-bold border shrink-0 ${
                isMale
                  ? "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20"
                  : "bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/20"
              }`}
            >
              {isMale ? "Male" : "Female"}
            </span>

            <h4 className="font-bold text-xs text-foreground tracking-tight truncate">
              {appointment.patient?.name || "Patient"}
            </h4>

            {isInTherapy && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-emerald-500 text-white text-[9.5px] font-bold uppercase animate-pulse">
                <Activity className="size-2.5" />
                In Therapy
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono flex-wrap">
            <span className="flex items-center gap-0.5">
              <Phone className="size-2.5 opacity-60" />
              <span>{appointment.patient?.phone || "No phone"}</span>
            </span>
            {appointment.patient?.mrn && (
              <>
                <span>•</span>
                <span>{appointment.patient.mrn}</span>
              </>
            )}
          </div>
        </div>

        {/* Room / Chamber Tag */}
        {(appointment.room?.number ||
          appointment.therapySlot?.room?.number) && (
          <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-muted/60 text-muted-foreground border border-border text-[10px] font-mono font-semibold">
            <DoorOpen className="size-2.5 text-emerald-500" />
            <span>
              R
              {appointment.room?.number ||
                appointment.therapySlot?.room?.number}
            </span>
          </span>
        )}
      </div>

      {/* 2. Timing Row: Told Time, Check-In, Punctuality & Will-Call Editor */}
      <div className="p-1.5 rounded-lg bg-muted/30 border border-border/50 space-y-1 text-[10.5px]">
        <div className="flex items-center justify-between text-muted-foreground font-mono">
          <span>Told: {appointment.toldTime || "--"}</span>
          <span>In: {formatTime12h(appointment.checkInTime)}</span>
          <span
            className={`px-1 py-0.2 rounded font-sans text-[9.5px] font-semibold ${
              punctuality.status === "green"
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : punctuality.status === "yellow"
                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                  : "bg-rose-500/10 text-rose-700 dark:text-rose-300"
            }`}
          >
            {punctuality.label}
          </span>
        </div>

        {/* Will Call Time Inline Editor */}
        <div className="pt-0.5 border-t border-border/40">
          {isEditingCallTime ? (
            <div className="space-y-1 animate-in fade-in-50 duration-150">
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={callTimeInput}
                  onChange={(e) => setCallTimeInput(e.target.value)}
                  placeholder="e.g. 11:30 AM"
                  className="flex-1 h-5 px-1.5 text-[10px] font-mono rounded bg-background border border-border focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleSaveCallTime}
                  disabled={isSavingCallTime}
                  className="h-5 px-2 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded cursor-pointer"
                >
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsEditingCallTime(false)}
                  disabled={isSavingCallTime}
                  className="h-5 px-1.5 text-[10px] text-muted-foreground rounded cursor-pointer"
                >
                  Cancel
                </Button>
              </div>

              {/* Quick Preset Pills */}
              <div className="flex items-center gap-1 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleAddMinutesToCallTime(5)}
                  className="px-1.5 py-0.2 rounded bg-muted hover:bg-muted/80 text-foreground text-[9px] font-mono border border-border/60 cursor-pointer"
                >
                  +5m
                </button>
                <button
                  type="button"
                  onClick={() => handleAddMinutesToCallTime(10)}
                  className="px-1.5 py-0.2 rounded bg-muted hover:bg-muted/80 text-foreground text-[9px] font-mono border border-border/60 cursor-pointer"
                >
                  +10m
                </button>
                <button
                  type="button"
                  onClick={() => handleAddMinutesToCallTime(15)}
                  className="px-1.5 py-0.2 rounded bg-muted hover:bg-muted/80 text-foreground text-[9px] font-mono border border-border/60 cursor-pointer"
                >
                  +15m
                </button>
                <button
                  type="button"
                  onClick={() => handleAddMinutesToCallTime(30)}
                  className="px-1.5 py-0.2 rounded bg-muted hover:bg-muted/80 text-foreground text-[9px] font-mono border border-border/60 cursor-pointer"
                >
                  +30m
                </button>
                <button
                  type="button"
                  onClick={() => setCallTimeInput("")}
                  className="px-1.5 py-0.2 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 text-[9px] font-mono border border-rose-500/20 cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-muted-foreground font-mono">
                <Clock className="size-2.5 text-emerald-500" />
                <span>Will Call:</span>
                {appointment.willCallTime ? (
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {appointment.willCallTime}
                  </span>
                ) : (
                  <span className="italic text-muted-foreground/70">
                    Not set
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsEditingCallTime(true)}
                className="size-4 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="Edit will call time"
              >
                <Pencil className="size-2.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3. Action Buttons */}
      <div className="flex items-center gap-1.5 pt-1 flex-wrap">
        {!isInTherapy ? (
          <Button
            size="sm"
            onClick={handleStartTherapy}
            disabled={isActionLoading}
            className="flex-1 h-7 rounded-lg font-bold text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs cursor-pointer gap-1"
          >
            <Play className="size-3" />
            <span>Start Therapy</span>
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={handleCompleteTherapy}
            disabled={isActionLoading}
            className="flex-1 h-7 rounded-lg font-bold text-[11px] bg-sky-600 hover:bg-sky-700 text-white shadow-2xs cursor-pointer gap-1"
          >
            <CheckCircle2 className="size-3" />
            <span>Complete Session</span>
          </Button>
        )}

        <Button
          size="sm"
          variant="outline"
          onClick={handleTransferToDoctor}
          disabled={isActionLoading}
          title="Transfer patient to Doctor Consultation Queue"
          className="h-7 px-2 text-[11px] font-semibold border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 rounded-lg cursor-pointer gap-1"
        >
          <ArrowRightLeft className="size-2.5" />
          <span>To Doctor</span>
        </Button>
      </div>
    </div>
  );
}
