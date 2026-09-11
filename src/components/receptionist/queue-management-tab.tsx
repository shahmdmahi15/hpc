"use client";

import * as React from "react";
import {
  type AppointmentWithRelations,
  switchQueueAction,
  updateAppointmentWillCallTimeAction,
} from "@/actions/receptionist/appointment.action";
import { type ReceptionistPerformer } from "@/components/receptionist/receptionist-performer-select";
import { evaluatePunctuality, formatTime12h } from "@/lib/queue-punctuality";
import { AppointmentStatus, QueueType } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Activity,
  Stethoscope,
  Plus,
  Search,
  CheckCircle2,
  ArrowRightLeft,
  AlertCircle,
  AlertTriangle,
  DoorOpen,
  Users,
  Clock,
  Pencil,
  Megaphone,
} from "lucide-react";
import { type AuthorizeReceptionistActionConfig } from "@/components/receptionist/authorize-receptionist-action-dialog";
import type { RoomModel } from "@/generated/prisma/models";
import { toast } from "sonner";

interface QueueManagementTabProps {
  appointments: AppointmentWithRelations[];
  performers: ReceptionistPerformer[];
  rooms?: RoomModel[];
  lastPerformerId: string;
  onOpenAddToQueue: () => void;
  onRequestAction?: (config: AuthorizeReceptionistActionConfig) => void;
  onRefresh: () => void;
}

export function QueueManagementTab({
  appointments,
  performers,
  rooms = [],
  lastPerformerId,
  onOpenAddToQueue,
  onRequestAction,
  onRefresh,
}: QueueManagementTabProps) {
  const [filterQuery, setFilterQuery] = React.useState<string>("");
  const [actionLoadingId, setActionLoadingId] = React.useState<string | null>(
    null,
  );

  const performerId =
    lastPerformerId || (performers.length > 0 ? performers[0].id : "");

  // All active queue items: CHECKED_IN, CALLING, IN_THERAPY, IN_CONSULTATION
  const activeQueue = React.useMemo(() => {
    return appointments.filter(
      (a) =>
        a.status === AppointmentStatus.CHECKED_IN ||
        a.status === AppointmentStatus.CALLING ||
        a.status === AppointmentStatus.IN_THERAPY ||
        a.status === AppointmentStatus.IN_CONSULTATION,
    );
  }, [appointments]);

  // Filtered by search query
  const filteredQueue = React.useMemo(() => {
    if (!filterQuery.trim()) return activeQueue;
    const q = filterQuery.toLowerCase();
    return activeQueue.filter(
      (a) =>
        a.patient?.name.toLowerCase().includes(q) ||
        a.patient?.phone.includes(q),
    );
  }, [activeQueue, filterQuery]);

  // Therapy Queue items
  const therapyQueue = React.useMemo(() => {
    return filteredQueue.filter(
      (a) => (a.queueType || QueueType.THERAPY) === QueueType.THERAPY,
    );
  }, [filteredQueue]);

  // Consultation Queue items
  const consultationQueue = React.useMemo(() => {
    return filteredQueue.filter((a) => a.queueType === QueueType.CONSULTATION);
  }, [filteredQueue]);

  // Handle Switch Queue (Therapy <-> Consultation)
  const handleSwitchQueue = async (apt: AppointmentWithRelations) => {
    const targetQueue =
      apt.queueType === QueueType.CONSULTATION
        ? QueueType.THERAPY
        : QueueType.CONSULTATION;

    if (onRequestAction) {
      onRequestAction({
        actionType: "SWITCH_QUEUE",
        appointmentId: apt.id,
        patientName: apt.patient?.name,
        slotLabel: apt.therapySlot?.label,
        defaultQueueType: apt.queueType || QueueType.THERAPY,
        targetQueueType: targetQueue,
      });
      return;
    }

    setActionLoadingId(apt.id);
    try {
      const res = await switchQueueAction(apt.id, targetQueue, performerId);
      if (res.success) {
        toast.success(res.message);
        onRefresh();
      } else {
        toast.error(res.message);
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-2.5">
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 px-3 rounded-xl border border-border/70 bg-card/75 shadow-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 sm:w-64">
            <Search className="size-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Filter by patient name or phone..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="pl-7 text-xs h-7 rounded-lg"
            />
          </div>

          <div className="flex items-center gap-1.5 text-[11px] font-semibold">
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
              Therapy: {therapyQueue.length}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">
              Consultation: {consultationQueue.length}
            </span>
          </div>
        </div>

        <Button
          size="sm"
          onClick={onOpenAddToQueue}
          className="h-7 px-2.5 text-xs font-semibold gap-1.5 shadow-xs cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
        >
          <Plus className="size-3" />
          <span>Add Patient to Queue</span>
        </Button>
      </div>

      {/* Dual Queue Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 items-start">
        {/* Column 1: Therapy Queue */}
        <div className="rounded-xl border border-border/80 bg-card/60 shadow-xs overflow-hidden flex flex-col">
          {/* Column Header */}
          <div className="px-3 py-1.5 border-b border-border/70 flex items-center justify-between bg-muted/20">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                <Activity className="size-3.5" />
              </div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs font-bold text-foreground">
                  Therapy Queue
                </h3>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  {therapyQueue.length}
                </span>
              </div>
            </div>
            <span className="text-[10px] text-muted-foreground hidden sm:inline">
              Physical Therapy
            </span>
          </div>

          {/* List of Therapy Queue Items */}
          <div className="p-2 space-y-2 max-h-[calc(100vh-170px)] overflow-y-auto">
            {therapyQueue.length === 0 ? (
              <div className="p-5 text-center text-muted-foreground space-y-1 rounded-lg border border-dashed border-border/60 bg-muted/10">
                <Users className="size-5 mx-auto opacity-40" />
                <p className="text-xs font-semibold">Therapy queue is empty</p>
                <p className="text-[10.5px]">
                  Click &quot;Add Patient to Queue&quot; above to check in a
                  patient.
                </p>
              </div>
            ) : (
              therapyQueue.map((apt) => (
                <QueueManagementCard
                  key={apt.id}
                  appointment={apt}
                  isLoading={actionLoadingId === apt.id}
                  performerId={performerId}
                  onSwitchQueue={() => handleSwitchQueue(apt)}
                  onRefresh={onRefresh}
                />
              ))
            )}
          </div>
        </div>

        {/* Column 2: Consultation Queue */}
        <div className="rounded-xl border border-border/80 bg-card/60 shadow-xs overflow-hidden flex flex-col">
          {/* Column Header */}
          <div className="px-3 py-1.5 border-b border-border/70 flex items-center justify-between bg-muted/20">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-md bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30">
                <Stethoscope className="size-3.5" />
              </div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs font-bold text-foreground">
                  Consultation Queue
                </h3>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30">
                  {consultationQueue.length}
                </span>
                {rooms.length > 0 && (
                  <span className="hidden sm:inline-flex px-1.5 py-0.2 rounded-full text-[9.5px] font-medium bg-muted/80 text-muted-foreground border border-border/50">
                    {rooms.length} {rooms.length === 1 ? "Chamber" : "Chambers"}
                  </span>
                )}
              </div>
            </div>
            <span className="text-[10px] text-muted-foreground hidden sm:inline">
              Doctor Chambers
            </span>
          </div>

          {/* List of Consultation Queue Items */}
          <div className="p-2 space-y-2 max-h-[calc(100vh-170px)] overflow-y-auto">
            {consultationQueue.length === 0 ? (
              <div className="p-5 text-center text-muted-foreground space-y-1 rounded-lg border border-dashed border-border/60 bg-muted/10">
                <Users className="size-5 mx-auto opacity-40" />
                <p className="text-xs font-semibold">
                  Consultation queue is empty
                </p>
                <p className="text-[10.5px]">
                  Click &quot;Add Patient to Queue&quot; above to check in a
                  patient.
                </p>
              </div>
            ) : (
              consultationQueue.map((apt) => (
                <QueueManagementCard
                  key={apt.id}
                  appointment={apt}
                  isLoading={actionLoadingId === apt.id}
                  performerId={performerId}
                  onSwitchQueue={() => handleSwitchQueue(apt)}
                  onRefresh={onRefresh}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Queue Management Card for Receptionist Workspace
 */
function QueueManagementCard({
  appointment,
  isLoading,
  performerId,
  onSwitchQueue,
  onRefresh,
}: {
  appointment: AppointmentWithRelations;
  isLoading: boolean;
  performerId: string;
  onSwitchQueue: () => void;
  onRefresh: () => void;
}) {
  const [isEditingCallTime, setIsEditingCallTime] = React.useState(false);
  const [prevWillCallTime, setPrevWillCallTime] = React.useState(
    appointment.willCallTime,
  );
  const [callTimeInput, setCallTimeInput] = React.useState(
    appointment.willCallTime || "",
  );
  const [isSavingCallTime, setIsSavingCallTime] = React.useState(false);

  // Sync state if appointment prop updates (React recommended pattern without useEffect)
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

  const setPresetOffset = (offsetMinutes: number) => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + offsetMinutes);
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    const h12 = hours % 12 || 12;
    const mStr = String(minutes).padStart(2, "0");
    setCallTimeInput(`${h12}:${mStr} ${ampm}`);
  };

  const p = evaluatePunctuality(appointment.toldTime, appointment.checkInTime);
  const isMale = appointment.gender === "MALE";
  const isCalling = appointment.status === AppointmentStatus.CALLING;
  const isServing =
    appointment.status === AppointmentStatus.IN_THERAPY ||
    appointment.status === AppointmentStatus.IN_CONSULTATION;
  const isConsultation = appointment.queueType === QueueType.CONSULTATION;
  const roomNumber =
    appointment.room?.number || appointment.therapySlot?.room?.number;

  return (
    <div
      className={`p-2.5 rounded-xl border transition-all space-y-1.5 shadow-2xs ${p.cardClass} ${p.borderClass}`}
    >
      {/* Top: Name, Gender, Status & Punctuality */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-xs font-bold text-foreground truncate">
            {appointment.patient?.name || "Patient"}
          </span>
          <span
            className={`px-1 py-0.2 rounded text-[9.5px] font-semibold shrink-0 border ${
              isMale
                ? "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20"
                : "bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/20"
            }`}
          >
            {isMale ? "M" : "F"}
          </span>
          {roomNumber && (
            <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9.5px] font-bold bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30 shrink-0">
              <DoorOpen className="size-2" />
              <span>Room {roomNumber}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Status pill */}
          <span
            className={`px-1.5 py-0.2 rounded text-[9.5px] font-bold border ${
              isCalling
                ? "bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-500/40 shadow-xs animate-pulse font-black"
                : isServing
                  ? "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30 animate-pulse"
                  : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
            }`}
          >
            {isCalling ? (
              <span className="inline-flex items-center gap-1">
                <Megaphone className="size-2.5 text-sky-600 dark:text-sky-400 animate-bounce" />
                <span>Calling...</span>
              </span>
            ) : isServing ? (
              <span>In Service</span>
            ) : (
              <span>Waiting</span>
            )}
          </span>

          {/* Punctuality Badge */}
          <span
            className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9.5px] font-bold border ${p.badgeClass}`}
          >
            {p.status === "green" ? (
              <CheckCircle2 className="size-2.5 shrink-0" />
            ) : p.status === "yellow" ? (
              <AlertCircle className="size-2.5 shrink-0" />
            ) : (
              <AlertTriangle className="size-2.5 shrink-0" />
            )}
            <span>{p.label}</span>
          </span>
        </div>
      </div>

      {/* Middle: Phone & Time Breakdown */}
      <div className="flex items-center justify-between text-[10.5px] font-mono text-muted-foreground pt-0.5 border-t border-border/40">
        <span>{appointment.patient?.phone}</span>
        <div className="flex items-center gap-1.5">
          <span>Told: {appointment.toldTime || "--:--"}</span>
          <span className={`font-bold ${p.textClass}`}>
            In: {formatTime12h(appointment.checkInTime)}
          </span>
        </div>
      </div>

      {/* Will Call Time (Editable by Receptionist) */}
      <div className="pt-0.5 border-t border-border/40 space-y-1">
        <div className="flex items-center justify-between text-[10.5px] font-mono">
          <span className="text-muted-foreground flex items-center gap-1 font-sans text-[10px]">
            <Clock className="size-2.5 text-sky-500 shrink-0" />
            <span>Will Call:</span>
          </span>

          {!isEditingCallTime ? (
            <button
              type="button"
              onClick={() => {
                setCallTimeInput(appointment.willCallTime || "");
                setIsEditingCallTime(true);
              }}
              className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/25 transition-colors cursor-pointer text-[10px] font-bold"
              title="Click to set or edit estimated call time"
            >
              <span>{appointment.willCallTime || "Set Call Time"}</span>
              <Pencil className="size-2 opacity-70" />
            </button>
          ) : (
            <span className="text-[9.5px] text-muted-foreground">
              Editing time...
            </span>
          )}
        </div>

        {isEditingCallTime && (
          <div className="p-2 rounded-lg bg-background border border-sky-500/40 space-y-2 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                placeholder="e.g. 11:30 AM"
                value={callTimeInput}
                onChange={(e) => setCallTimeInput(e.target.value)}
                className="flex-1 h-6 px-2 text-xs font-mono rounded bg-muted/30 border border-border focus:border-sky-500 focus:outline-none"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveCallTime();
                  if (e.key === "Escape") setIsEditingCallTime(false);
                }}
              />
              <Button
                size="xs"
                variant="default"
                onClick={handleSaveCallTime}
                disabled={isSavingCallTime}
                className="h-6 px-2 text-[10.5px] font-bold cursor-pointer bg-sky-600 hover:bg-sky-700 text-white"
              >
                {isSavingCallTime ? "..." : "Save"}
              </Button>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => {
                  setCallTimeInput(appointment.willCallTime || "");
                  setIsEditingCallTime(false);
                }}
                className="h-6 px-1.5 text-[10.5px] cursor-pointer"
              >
                ✕
              </Button>
            </div>

            {/* Quick Presets for receptionist convenience */}
            <div className="flex items-center gap-1 text-[10px] font-mono">
              <span className="text-muted-foreground text-[9.5px]">Quick:</span>
              <button
                type="button"
                onClick={() => setPresetOffset(5)}
                className="px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 border border-border/60 cursor-pointer"
              >
                +5m
              </button>
              <button
                type="button"
                onClick={() => setPresetOffset(10)}
                className="px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 border border-border/60 cursor-pointer"
              >
                +10m
              </button>
              <button
                type="button"
                onClick={() => setPresetOffset(15)}
                className="px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 border border-border/60 cursor-pointer"
              >
                +15m
              </button>
              <button
                type="button"
                onClick={() => setPresetOffset(30)}
                className="px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 border border-border/60 cursor-pointer"
              >
                +30m
              </button>
              {appointment.willCallTime && (
                <button
                  type="button"
                  onClick={() => setCallTimeInput("")}
                  className="px-1.5 py-0.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 cursor-pointer ml-auto"
                  title="Clear call time"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom: Switching Button only */}
      <div className="pt-1 border-t border-border/40">
        <Button
          size="xs"
          variant="outline"
          onClick={onSwitchQueue}
          disabled={isLoading}
          className="w-full h-6 text-[10.5px] font-semibold gap-1.5 cursor-pointer hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title={
            isConsultation
              ? "Move to Therapy Queue"
              : "Move to Consultation Queue"
          }
        >
          <ArrowRightLeft className="size-2.5 text-muted-foreground" />
          <span>{isConsultation ? "To Therapy" : "To Consult"}</span>
        </Button>
      </div>
    </div>
  );
}
