"use client";

import * as React from "react";
import type { AppointmentWithRelations } from "@/actions/receptionist/appointment.action";
import {
  updateAppointmentStatusAction,
  updateAppointmentWillCallTimeAction,
} from "@/actions/receptionist/appointment.action";
import { AppointmentStatus } from "@/generated/prisma/enums";
import { evaluatePunctuality, formatTime12h } from "@/lib/queue-punctuality";
import { Button } from "@/components/ui/button";
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  DoorOpen,
  Pencil,
  Volume2,
  Phone,
  Stethoscope,
  Radio,
  FilePlus2,
  FolderOpen,
  Send,
  Activity,
  CalendarCheck2,
  User,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import type { RoomModel, PerformerModel } from "@/generated/prisma/models";
import { CallToChamberDialog } from "@/components/doctor/call-to-chamber-dialog";
import { CreateMedicalRecordDialog } from "@/components/doctor/medical/create-medical-record-dialog";
import { PatientMedicalHistoryDialog } from "@/components/doctor/medical/patient-medical-history-dialog";
import { SendPatientDialog } from "@/components/doctor/send-patient-dialog";
import { TreatmentPlanDialog } from "@/components/doctor/treatment/treatment-plan-dialog";

interface DoctorQueueCardProps {
  appointment: AppointmentWithRelations;
  performerId: string;
  selectedRoomId?: string;
  selectedRoomNumber?: string;
  rooms?: RoomModel[];
  doctors?: PerformerModel[];
  onRefresh: () => void;
}

export function DoctorQueueCard({
  appointment,
  performerId,
  selectedRoomId,
  selectedRoomNumber,
  rooms = [],
  doctors = [],
  onRefresh,
}: DoctorQueueCardProps) {
  // Call to chamber dialog state
  const [isCallDialogOpen, setIsCallDialogOpen] = React.useState(false);
  const [isCreateRecordOpen, setIsCreateRecordOpen] = React.useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = React.useState(false);
  const [isSendDialogOpen, setIsSendDialogOpen] = React.useState(false);
  const [isTreatmentPlanOpen, setIsTreatmentPlanOpen] = React.useState(false);
  const [treatmentPlanTab, setTreatmentPlanTab] = React.useState<
    "today" | "next"
  >("today");

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

  const handleStartConsultation = async () => {
    setIsActionLoading(true);
    try {
      const res = await updateAppointmentStatusAction(
        appointment.id,
        AppointmentStatus.IN_CONSULTATION,
        performerId,
      );
      if (res.success) {
        toast.success(
          `${appointment.patient?.name || "Patient"} is now in consultation.`,
        );
        onRefresh();
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Failed to start consultation session.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const p = evaluatePunctuality(appointment.toldTime, appointment.checkInTime);
  const isMale = appointment.gender === "MALE";
  const isCalling = appointment.status === AppointmentStatus.CALLING;
  const isServing = appointment.status === AppointmentStatus.IN_CONSULTATION;
  const roomNumber =
    appointment.room?.number || appointment.therapySlot?.room?.number;

  return (
    <div
      className={`p-2.5 rounded-xl border transition-all space-y-1.5 shadow-2xs ${
        isServing
          ? "bg-emerald-500/10 dark:bg-emerald-950/30 border-emerald-500/50 ring-2 ring-emerald-500/20"
          : isCalling
            ? "bg-amber-500/10 dark:bg-amber-950/30 border-amber-500/50 ring-2 ring-amber-500/30 shadow-xs animate-in fade-in"
            : `${p.cardClass} ${p.borderClass}`
      }`}
    >
      {/* Top: Name, Gender, Room & Status */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-xs font-bold text-foreground truncate tracking-tight">
            {appointment.patient?.name || "Patient"}
          </span>
          <span
            className={`px-1 py-0.2 rounded text-[9.5px] font-bold shrink-0 border ${
              isMale
                ? "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20"
                : "bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/20"
            }`}
          >
            {isMale ? "M" : "F"}
          </span>

          {roomNumber && (
            <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9.5px] font-bold bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30 shrink-0">
              <DoorOpen className="size-2.5" />
              <span>R{roomNumber}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 flex-wrap">
          {appointment.routingOrigin === "THERAPY" && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 text-[9.5px] font-bold shrink-0">
              <Activity className="size-2.5" />
              From Therapy
            </span>
          )}
          {appointment.routingOrigin === "DOCTOR" && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 text-[9.5px] font-bold shrink-0">
              <User className="size-2.5" />
              From Doctor
            </span>
          )}

          {/* Status badge */}
          <span
            className={`px-1.5 py-0.2 rounded-full text-[9.5px] font-bold border flex items-center gap-1 ${
              isServing
                ? "bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 border-emerald-500/40 animate-pulse"
                : isCalling
                  ? "bg-amber-500/20 text-amber-800 dark:text-amber-200 border-amber-500/40 animate-pulse"
                  : "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30"
            }`}
          >
            {isServing ? (
              <>
                <Stethoscope className="size-2.5" />
                <span>In Chamber</span>
              </>
            ) : isCalling ? (
              <>
                <Radio className="size-2.5 animate-pulse text-amber-600 dark:text-amber-400" />
                <span>Calling...</span>
              </>
            ) : (
              "Waiting"
            )}
          </span>

          {/* Punctuality Badge */}
          <span
            className={`inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9.5px] font-bold border ${p.badgeClass}`}
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

      {/* Transfer Routing Note Banner */}
      {appointment.routingNote && (
        <div className="p-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-[10px] text-purple-900 dark:text-purple-200 flex items-start gap-1.5">
          <FileText className="size-3 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <span className="font-bold mr-1">Transfer Note:</span>
            <span className="italic">{appointment.routingNote}</span>
          </div>
        </div>
      )}

      {/* Middle: Phone & Time Breakdown */}
      <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground pt-0.5 border-t border-border/40">
        <span className="flex items-center gap-1 text-[10px]">
          <Phone className="size-2.5 opacity-60" />
          <span>{appointment.patient?.phone || "No phone"}</span>
        </span>
        <div className="flex items-center gap-1.5">
          <span>Told: {appointment.toldTime || "--:--"}</span>
          <span className={`font-bold ${p.textClass}`}>
            In: {formatTime12h(appointment.checkInTime)}
          </span>
        </div>
      </div>

      {/* Will Call Time (Editable by Doctor) */}
      <div className="pt-0.5 border-t border-border/40 space-y-1">
        <div className="flex items-center justify-between text-[10px] font-mono">
          <span className="text-muted-foreground flex items-center gap-1 font-sans text-[10px] font-medium">
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
          <div className="p-1.5 rounded-lg bg-background border border-sky-500/40 space-y-1.5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-1">
              <input
                type="text"
                placeholder="e.g. 11:30 AM"
                value={callTimeInput}
                onChange={(e) => setCallTimeInput(e.target.value)}
                className="flex-1 h-5 px-1.5 text-[10.5px] font-mono rounded bg-muted/30 border border-border focus:border-sky-500 focus:outline-none"
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
                className="h-5 px-1.5 text-[10px] font-bold cursor-pointer bg-sky-600 hover:bg-sky-700 text-white"
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
                className="h-5 px-1 text-[10px] cursor-pointer"
              >
                ✕
              </Button>
            </div>

            {/* Quick Presets for Doctor convenience */}
            <div className="flex items-center gap-1 text-[9.5px] font-mono flex-wrap">
              <span className="text-muted-foreground mr-0.5 text-[9px]">
                Quick:
              </span>
              <button
                type="button"
                onClick={() => setPresetOffset(5)}
                className="px-1 py-0.2 rounded bg-muted/60 hover:bg-muted text-foreground border border-border/60 transition-colors cursor-pointer"
              >
                +5m
              </button>
              <button
                type="button"
                onClick={() => setPresetOffset(10)}
                className="px-1 py-0.2 rounded bg-muted/60 hover:bg-muted text-foreground border border-border/60 transition-colors cursor-pointer"
              >
                +10m
              </button>
              <button
                type="button"
                onClick={() => setPresetOffset(15)}
                className="px-1 py-0.2 rounded bg-muted/60 hover:bg-muted text-foreground border border-border/60 transition-colors cursor-pointer"
              >
                +15m
              </button>
              <button
                type="button"
                onClick={() => setPresetOffset(30)}
                className="px-1 py-0.2 rounded bg-muted/60 hover:bg-muted text-foreground border border-border/60 transition-colors cursor-pointer"
              >
                +30m
              </button>
              <button
                type="button"
                onClick={() => setCallTimeInput("")}
                className="px-1 py-0.2 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30 transition-colors cursor-pointer ml-auto text-[9px]"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Doctor Action Buttons */}
      <div className="pt-1 border-t border-border/40 flex items-center gap-1.5">
        {isCalling ? (
          <div className="flex items-center gap-1.5 w-full animate-in fade-in">
            <Button
              size="sm"
              onClick={handleStartConsultation}
              disabled={isActionLoading}
              className="flex-1 h-7 rounded-lg font-bold text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer gap-1"
            >
              <Stethoscope className="size-3" />
              <span>In Consultation</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsCallDialogOpen(true)}
              disabled={isActionLoading}
              title="Call again to broadcast announcement on TV"
              className="h-7 px-2 rounded-lg font-semibold text-[11px] border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 cursor-pointer gap-1"
            >
              <Volume2 className="size-3" />
              <span>Recall</span>
            </Button>
          </div>
        ) : isServing ? (
          <div className="space-y-1 w-full">
            <div className="flex items-center gap-1 w-full">
              <Button
                size="xs"
                variant="outline"
                onClick={() => setIsHistoryOpen(true)}
                title="View previous medical files and checkup history"
                className="flex-1 h-6 rounded-md font-bold text-[10px] border-sky-500/40 text-sky-700 dark:text-sky-300 hover:bg-sky-500/10 cursor-pointer gap-1"
              >
                <FolderOpen className="size-2.5" />
                <span>Old Files</span>
              </Button>

              <Button
                size="xs"
                onClick={() => setIsCreateRecordOpen(true)}
                title="Create new physiotherapy assessment file"
                className="flex-1 h-6 rounded-md font-bold text-[10px] bg-sky-600 hover:bg-sky-700 text-white shadow-xs cursor-pointer gap-1"
              >
                <FilePlus2 className="size-2.5" />
                <span>New File</span>
              </Button>
            </div>

            {/* Treatment Plans: Today & Next */}
            <div className="flex items-center gap-1 w-full">
              <Button
                size="xs"
                variant="outline"
                onClick={() => {
                  setTreatmentPlanTab("today");
                  setIsTreatmentPlanOpen(true);
                }}
                title="Today's Treatment Plan"
                className="flex-1 h-6 rounded-md font-bold text-[10px] border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 cursor-pointer gap-1"
              >
                <Activity className="size-2.5" />
                <span>Today&apos;s Plan</span>
              </Button>

              <Button
                size="xs"
                variant="outline"
                onClick={() => {
                  setTreatmentPlanTab("next");
                  setIsTreatmentPlanOpen(true);
                }}
                title="Next Session Treatment Plan"
                className="flex-1 h-6 rounded-md font-bold text-[10px] border-purple-500/40 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10 cursor-pointer gap-1"
              >
                <CalendarCheck2 className="size-2.5" />
                <span>Next Plan</span>
              </Button>
            </div>

            <div className="flex items-center gap-1.5 w-full">
              <Button
                size="sm"
                onClick={() => setIsSendDialogOpen(true)}
                disabled={isActionLoading}
                className="flex-1 h-7 rounded-lg font-bold text-[11px] bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs cursor-pointer gap-1.5"
                title="Send patient to next destination"
              >
                <Send className="size-3" />
                <span>Send Patient</span>
              </Button>
            </div>
          </div>
        ) : (
          <Button
            size="sm"
            onClick={() => setIsCallDialogOpen(true)}
            disabled={isActionLoading}
            className="flex-1 h-7 rounded-lg font-bold text-[11px] bg-sky-600 hover:bg-sky-700 text-white shadow-xs cursor-pointer gap-1"
          >
            <Volume2 className="size-3" />
            <span>
              Call to Chamber{" "}
              {selectedRoomNumber ? `(R${selectedRoomNumber})` : ""}
            </span>
          </Button>
        )}
      </div>

      {/* Call to Chamber Dialog */}
      <CallToChamberDialog
        isOpen={isCallDialogOpen}
        onOpenChange={setIsCallDialogOpen}
        appointment={appointment}
        doctors={doctors}
        rooms={rooms}
        defaultDoctorId={performerId}
        defaultRoomId={selectedRoomId}
        onSuccess={onRefresh}
      />

      {/* Medical Assessment Dialogs */}
      <CreateMedicalRecordDialog
        isOpen={isCreateRecordOpen}
        onOpenChange={setIsCreateRecordOpen}
        appointment={appointment}
        doctorId={performerId}
        onSuccess={onRefresh}
      />

      <PatientMedicalHistoryDialog
        isOpen={isHistoryOpen}
        onOpenChange={setIsHistoryOpen}
        patient={appointment.patient || null}
        onNewRecordRequested={() => setIsCreateRecordOpen(true)}
      />

      {/* Send Patient Dialog */}
      <SendPatientDialog
        isOpen={isSendDialogOpen}
        onOpenChange={setIsSendDialogOpen}
        appointment={appointment}
        doctorId={performerId}
        onSuccess={onRefresh}
        onOpenTreatmentPlan={(tab) => {
          setTreatmentPlanTab(tab);
          setIsTreatmentPlanOpen(true);
        }}
      />

      {/* Treatment Plan Dialog */}
      <TreatmentPlanDialog
        isOpen={isTreatmentPlanOpen}
        onOpenChange={setIsTreatmentPlanOpen}
        appointment={appointment}
        defaultTab={treatmentPlanTab}
        doctorId={performerId}
        doctors={doctors}
        onSuccess={onRefresh}
      />
    </div>
  );
}
