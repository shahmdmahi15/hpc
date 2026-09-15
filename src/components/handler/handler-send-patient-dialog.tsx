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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Send,
  User,
  Phone,
  ArrowRight,
  Activity,
  Banknote,
  Users,
  CalendarCheck2,
  CreditCard,
  Loader2,
  Clock,
  Save,
  Stethoscope,
  Calendar,
  Check,
  FileText,
  Timer,
} from "lucide-react";
import type { AppointmentWithRelations } from "@/actions/receptionist/appointment.action";
import type { PerformerModel } from "@/generated/prisma/models";
import {
  routePatientAction,
  updateAppointmentFeeAction,
} from "@/actions/doctor/doctor.action";
import type { TreatmentPlanRecord } from "@/actions/doctor/treatment-plan.action";
import { toast } from "sonner";
import { DEFAULT_FEE } from "@/lib/billing";
import { formatTime12h } from "@/lib/queue-punctuality";

interface HandlerSendPatientDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: AppointmentWithRelations | null;
  todayPlan?: TreatmentPlanRecord | null;
  handlers: PerformerModel[];
  defaultHandlerId?: string;
  onSuccess?: () => void;
}

const DUE_PRESETS = [0, 300, 500, 800, 1000, 1500];

const DEFAULT_MODALITIES = [
  "Hot pack",
  "IFT / TENS",
  "Ultrasound Therapy (UST)",
  "Traction (Cervical/Lumbar)",
  "Stretching Exercises",
  "Strengthening Exercises",
  "Short Wave Diathermy (SWD)",
  "Laser Therapy",
  "Manual Mobilization",
  "Posture Correction",
];

export function HandlerSendPatientDialog({
  isOpen,
  onOpenChange,
  appointment,
  todayPlan,
  handlers,
  defaultHandlerId,
  onSuccess,
}: HandlerSendPatientDialogProps) {
  if (!appointment) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <HandlerSendPatientDialogContent
        key={appointment.id}
        appointment={appointment}
        todayPlan={todayPlan}
        handlers={handlers}
        defaultHandlerId={defaultHandlerId}
        onOpenChange={onOpenChange}
        onSuccess={onSuccess}
      />
    </Dialog>
  );
}

function HandlerSendPatientDialogContent({
  appointment,
  todayPlan,
  handlers,
  defaultHandlerId,
  onOpenChange,
  onSuccess,
}: {
  appointment: AppointmentWithRelations;
  todayPlan?: TreatmentPlanRecord | null;
  handlers: PerformerModel[];
  defaultHandlerId?: string;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}) {
  // Due amount state
  const [dueAmount, setDueAmount] = React.useState<number>(
    typeof appointment.feeAmount === "number"
      ? appointment.feeAmount
      : DEFAULT_FEE,
  );
  const [isSavingFee, setIsSavingFee] = React.useState(false);
  const [isRouting, setIsRouting] = React.useState(false);
  const [routingDestination, setRoutingDestination] = React.useState<
    "CASHIER" | "DOCTOR" | "RECEPTIONIST" | null
  >(null);
  const [routingNote, setRoutingNote] = React.useState<string>(
    appointment.routingNote || "",
  );

  // Performer auto-selection rule: If single performer, automatically select it!
  const initialHandlerId = React.useMemo(() => {
    if (handlers.length === 1) {
      return handlers[0].id;
    }
    return defaultHandlerId && handlers.some((h) => h.id === defaultHandlerId)
      ? defaultHandlerId
      : handlers[0]?.id || "";
  }, [handlers, defaultHandlerId]);

  const [selectedHandlerId, setSelectedHandlerId] =
    React.useState<string>(initialHandlerId);

  // Synchronize handler selection if handlers prop updates or has 1 handler
  const [prevHandlers, setPrevHandlers] = React.useState(handlers);
  if (handlers !== prevHandlers) {
    setPrevHandlers(handlers);
    if (handlers.length === 1) {
      setSelectedHandlerId(handlers[0].id);
    } else if (!handlers.some((h) => h.id === selectedHandlerId)) {
      setSelectedHandlerId(
        defaultHandlerId && handlers.some((h) => h.id === defaultHandlerId)
          ? defaultHandlerId
          : handlers[0]?.id || "",
      );
    }
  }

  // Next Day Treatment Plan (Optional)
  const [assignNextPlan, setAssignNextPlan] = React.useState(false);
  const [nextPlanDate, setNextPlanDate] = React.useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  });
  const [selectedNextModalities, setSelectedNextModalities] = React.useState<
    string[]
  >([]);
  const [nextInstructions, setNextInstructions] = React.useState("");

  const currentFee = appointment.feeAmount ?? DEFAULT_FEE;
  const isFeeModified = dueAmount !== currentFee;

  // Toggle next modality
  const toggleNextModality = (modality: string) => {
    setSelectedNextModalities((prev) =>
      prev.includes(modality)
        ? prev.filter((m) => m !== modality)
        : [...prev, modality],
    );
  };

  // Quick preset offset for next date
  const setNextDateOffset = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    setNextPlanDate(d.toISOString().split("T")[0]);
  };

  // Handle Quick Save Due Amount only
  const handleSaveDueOnly = async () => {
    if (dueAmount < 0) {
      toast.error("Due amount cannot be negative.");
      return;
    }
    setIsSavingFee(true);
    try {
      const res = await updateAppointmentFeeAction({
        appointmentId: appointment.id,
        feeAmount: Number(dueAmount),
        performerId: selectedHandlerId || undefined,
      });
      if (res.success) {
        toast.success(res.message);
        onSuccess?.();
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Failed to update due amount.");
    } finally {
      setIsSavingFee(false);
    }
  };

  // Perform Routing
  const executeRouting = async (
    destination: "CASHIER" | "DOCTOR" | "RECEPTIONIST",
  ) => {
    if (dueAmount < 0) {
      toast.error("Due amount cannot be negative.");
      return;
    }

    setIsRouting(true);
    setRoutingDestination(destination);
    try {
      const nextPlanData =
        assignNextPlan && selectedNextModalities.length > 0
          ? {
              modalities: selectedNextModalities,
              instructions: nextInstructions.trim() || undefined,
              targetDate: nextPlanDate || undefined,
            }
          : undefined;

      const effectivePerformerId =
        selectedHandlerId ||
        (handlers.length === 1 ? handlers[0].id : undefined);

      const res = await routePatientAction({
        appointmentId: appointment.id,
        destination,
        feeAmount: Number(dueAmount),
        performerId: effectivePerformerId,
        routingNote: routingNote.trim() || undefined,
        nextPlan: nextPlanData,
      });

      if (res.success) {
        toast.success(res.message);
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Failed to route patient.");
    } finally {
      setIsRouting(false);
      setRoutingDestination(null);
    }
  };

  const isMale = appointment.gender === "MALE";

  return (
    <DialogContent className="w-[95vw] sm:max-w-3xl md:max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden border-border/80 shadow-2xl rounded-2xl">
      {/* Header */}
      <DialogHeader className="p-4 sm:p-5 pb-3 border-b border-border/60 bg-muted/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0 shadow-xs">
              <Send className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                <span>Send Patient & Complete Therapy</span>
                <Badge
                  variant="outline"
                  className="text-[11px] font-mono font-bold bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-300"
                >
                  Therapy Desk
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Review billing due amount, verify who performed the therapy,
                optionally assign next day plan, and route the patient.
              </DialogDescription>
            </div>
          </div>

          {/* Badges */}
          <div className="flex items-center gap-1.5 flex-wrap shrink-0">
            {(appointment.room?.number ||
              appointment.therapySlot?.room?.number) && (
              <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-700 dark:text-sky-300">
                Room{" "}
                {appointment.room?.number ||
                  appointment.therapySlot?.room?.number}
              </span>
            )}
            {appointment.patient?.mrn && (
              <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 text-primary">
                MRN: {appointment.patient.mrn}
              </span>
            )}
          </div>
        </div>
      </DialogHeader>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {/* 1. Patient Quick Information Bar */}
        <div className="p-3.5 rounded-xl border border-border/80 bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
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
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
              <span className="flex items-center gap-1">
                <Phone className="size-3 opacity-60" />
                <span>{appointment.patient?.phone || "No phone"}</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="size-3 opacity-60" />
                <span>In: {appointment.checkInTime ? "Checked In" : "--"}</span>
              </span>
            </div>
          </div>

          <Badge
            variant="outline"
            className="bg-background text-muted-foreground font-mono text-[11px]"
          >
            Session Routing
          </Badge>
        </div>

        {/* 2. Therapy Performed By - Dedicated Performer Selector */}
        <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                <User className="size-4" />
              </div>
              <div>
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <span>Therapy Performed By</span>
                  <span className="text-rose-500">*</span>
                </label>
                <p className="text-[11px] text-muted-foreground">
                  Select the physical therapist / handler who performed this session
                </p>
              </div>
            </div>

            {handlers.length === 1 ? (
              <Badge
                variant="outline"
                className="self-start sm:self-auto bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-bold text-[10px] px-2 py-0.5"
              >
                Auto-selected (Sole Performer)
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="self-start sm:self-auto bg-muted text-muted-foreground text-[10px] font-mono px-2 py-0.5"
              >
                {handlers.length} Handlers Available
              </Badge>
            )}
          </div>

          {handlers.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-1">
              No on-duty handlers configured.
            </p>
          ) : handlers.length === 1 ? (
            <div className="flex items-center justify-between p-2.5 rounded-xl border border-emerald-500/40 bg-background shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs">
                  {handlers[0].name.charAt(0)}
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">
                    {handlers[0].name}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    {handlers[0].phone || "Attending Physical Therapist"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-xs font-bold">
                <Check className="size-3.5" />
                <span>Selected</span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {handlers.map((h) => {
                const isSelected = selectedHandlerId === h.id;
                return (
                  <button
                    type="button"
                    key={h.id}
                    onClick={() => setSelectedHandlerId(h.id)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? "border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/25 shadow-2xs font-bold"
                        : "border-border/80 bg-background/80 hover:border-border hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`size-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          isSelected
                            ? "bg-emerald-600 text-white"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {h.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-foreground truncate">
                          {h.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono truncate">
                          {h.phone || "Therapist"}
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="size-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 ml-1">
                        <Check className="size-3 stroke-[2.5]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 2. Billing Due Amount Editor Card */}
        <div className="p-4 rounded-xl border-2 border-primary/30 bg-primary/5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <Banknote className="size-3.5" />
                <span>Billing Due Amount</span>
              </h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Current payable fee for this appointment. Editable by therapist.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-mono">
                Current Due:
              </span>
              <span className="font-mono text-base font-black text-foreground">
                ৳{currentFee}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm font-bold text-muted-foreground">
                ৳
              </span>
              <Input
                type="number"
                min={0}
                step={50}
                value={dueAmount}
                onChange={(e) => setDueAmount(Number(e.target.value) || 0)}
                className="pl-7 h-9 font-mono text-sm font-bold bg-background border-border/80 focus-visible:ring-emerald-500"
                placeholder="Enter due amount..."
              />
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {DUE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setDueAmount(preset)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                    dueAmount === preset
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-background hover:bg-muted text-foreground border border-border/80"
                  }`}
                >
                  ৳{preset}
                </button>
              ))}
            </div>

            {isFeeModified && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleSaveDueOnly}
                disabled={isSavingFee}
                className="h-9 px-3 text-xs font-bold border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 shrink-0 gap-1.5 cursor-pointer"
              >
                {isSavingFee ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Save className="size-3.5" />
                )}
                <span>Save Due</span>
              </Button>
            )}
          </div>
        </div>

        {/* 3. Today's Treatment Plan Card */}
        <div className="p-3.5 rounded-xl border border-border/80 bg-muted/10 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Activity className="size-3.5 text-emerald-500" />
              <span>Today&apos;s Prescribed Treatment Plan</span>
            </span>
            {todayPlan ? (
              <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold">
                Prescribed by Dr. {todayPlan.doctorName || "Doctor"}
              </span>
            ) : (
              <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-muted text-muted-foreground font-semibold">
                No Plan Prescribed
              </span>
            )}
          </div>

          {todayPlan && todayPlan.modalities.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                {todayPlan.modalities.map((mod, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/25 text-emerald-800 dark:text-emerald-200 text-xs font-semibold"
                  >
                    {mod}
                  </span>
                ))}
              </div>
              {todayPlan.instructions && (
                <p className="text-xs text-muted-foreground italic bg-background/60 p-2 rounded-lg border border-border/60">
                  &ldquo;{todayPlan.instructions}&rdquo;
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              No specific modalities prescribed by doctor for today.
            </p>
          )}
        </div>

        {/* 4. Assign Next Day Treatment Plan (Optional) */}
        <div className="p-3.5 rounded-xl border border-indigo-500/30 bg-indigo-500/5 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-foreground flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={assignNextPlan}
                onChange={(e) => setAssignNextPlan(e.target.checked)}
                className="size-4 rounded border-border text-indigo-600 focus:ring-indigo-500"
              />
              <span className="flex items-center gap-1.5">
                <CalendarCheck2 className="size-3.5 text-indigo-500" />
                <span>Assign Next Session Treatment Plan (Optional)</span>
              </span>
            </label>
            <Badge
              variant="outline"
              className={`text-[9.5px] ${
                assignNextPlan
                  ? "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {assignNextPlan ? "Enabled" : "Optional / Skipped"}
            </Badge>
          </div>

          {assignNextPlan && (
            <div className="space-y-3 pt-2 border-t border-indigo-500/20 animate-in fade-in-50 duration-200">
              {/* Target Date */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
                    <Calendar className="size-3 text-indigo-500" />
                    <span>Next Session Target Date:</span>
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setNextDateOffset(1)}
                      className="px-2 py-0.5 rounded text-[10px] bg-background hover:bg-muted border border-border text-foreground font-mono cursor-pointer"
                    >
                      +1 Day (Tomorrow)
                    </button>
                    <button
                      type="button"
                      onClick={() => setNextDateOffset(2)}
                      className="px-2 py-0.5 rounded text-[10px] bg-background hover:bg-muted border border-border text-foreground font-mono cursor-pointer"
                    >
                      +2 Days
                    </button>
                    <button
                      type="button"
                      onClick={() => setNextDateOffset(3)}
                      className="px-2 py-0.5 rounded text-[10px] bg-background hover:bg-muted border border-border text-foreground font-mono cursor-pointer"
                    >
                      +3 Days
                    </button>
                  </div>
                </div>
                <Input
                  type="date"
                  value={nextPlanDate}
                  onChange={(e) => setNextPlanDate(e.target.value)}
                  className="h-8 text-xs font-mono bg-background border-border/80"
                />
              </div>

              {/* Next Modalities Selector */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-muted-foreground">
                  Select Prescribed Modalities for Next Session:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {DEFAULT_MODALITIES.map((mod) => {
                    const isSelected = selectedNextModalities.includes(mod);
                    return (
                      <button
                        key={mod}
                        type="button"
                        onClick={() => toggleNextModality(mod)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? "bg-indigo-600 text-white shadow-xs"
                            : "bg-background hover:bg-muted text-foreground border border-border/70"
                        }`}
                      >
                        {mod}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Instructions Textarea */}
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-muted-foreground">
                  Therapist Notes / Instructions for Next Session:
                </span>
                <Textarea
                  value={nextInstructions}
                  onChange={(e) => setNextInstructions(e.target.value)}
                  placeholder="e.g. Focus on cervical traction, increase UST intensity, assess lumbar mobility..."
                  className="min-h-[50px] text-xs bg-background border-border/80"
                />
              </div>
            </div>
          )}
        </div>

        {/* Optional Routing / Department Note */}
        <div className="p-3.5 rounded-xl border border-border/80 bg-card/60 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <FileText className="size-3.5 text-primary" />
              <span>Transfer / Routing Note</span>
              <span className="text-[10.5px] font-normal text-muted-foreground">(Optional)</span>
            </label>
            <span className="text-[10px] text-muted-foreground font-mono">
              {routingNote.length}/250
            </span>
          </div>
          <Textarea
            placeholder="e.g. Completed Day 1 therapy; sending to Doctor for progress checkup or Cashier for bill settlement..."
            value={routingNote}
            onChange={(e) => setRoutingNote(e.target.value.slice(0, 250))}
            className="min-h-16 text-xs resize-none"
          />
        </div>

        {/* Clinical Journey Lifecycle Timestamps (All 7 Recorded Times) */}
        <div className="p-3.5 rounded-xl border border-border/80 bg-card/40 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <Timer className="size-3.5 text-primary" />
              <span>Appointment Lifecycle Journey</span>
            </div>
            <span className="text-[10.5px] text-muted-foreground">
              7 Visit Checkpoints
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5 text-center">
            {/* 1. Told Time */}
            <div className="p-2 rounded-lg bg-background/80 border border-border/60">
              <div className="text-[9.5px] uppercase font-bold text-muted-foreground">1. Told Time</div>
              <div className="text-xs font-bold font-mono text-foreground mt-0.5">
                {appointment.toldTime || "—"}
              </div>
            </div>

            {/* 2. Check In Time */}
            <div className="p-2 rounded-lg bg-background/80 border border-border/60">
              <div className="text-[9.5px] uppercase font-bold text-muted-foreground">2. Check In</div>
              <div className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                {appointment.checkInTime ? formatTime12h(appointment.checkInTime) : "—"}
              </div>
            </div>

            {/* 3. In Consultation */}
            <div className="p-2 rounded-lg bg-background/80 border border-border/60">
              <div className="text-[9.5px] uppercase font-bold text-muted-foreground">3. In Consult</div>
              <div className="text-xs font-bold font-mono text-sky-600 dark:text-sky-400 mt-0.5">
                {appointment.inConsultationTime ? formatTime12h(appointment.inConsultationTime) : "—"}
              </div>
            </div>

            {/* 4. Out Consultation */}
            <div className="p-2 rounded-lg bg-background/80 border border-border/60">
              <div className="text-[9.5px] uppercase font-bold text-muted-foreground">4. Out Consult</div>
              <div className="text-xs font-bold font-mono text-sky-700 dark:text-sky-300 mt-0.5">
                {appointment.outConsultationTime ? formatTime12h(appointment.outConsultationTime) : "—"}
              </div>
            </div>

            {/* 5. In Therapy */}
            <div className="p-2 rounded-lg bg-background/80 border border-border/60">
              <div className="text-[9.5px] uppercase font-bold text-muted-foreground">5. In Therapy</div>
              <div className="text-xs font-bold font-mono text-purple-600 dark:text-purple-400 mt-0.5">
                {appointment.inTherapyTime ? formatTime12h(appointment.inTherapyTime) : (appointment.status === "IN_THERAPY" ? "Active Now" : "—")}
              </div>
            </div>

            {/* 6. Out Therapy */}
            <div className="p-2 rounded-lg bg-background/80 border border-border/60">
              <div className="text-[9.5px] uppercase font-bold text-muted-foreground">6. Out Therapy</div>
              <div className="text-xs font-bold font-mono text-purple-700 dark:text-purple-300 mt-0.5">
                {appointment.outTherapyTime ? formatTime12h(appointment.outTherapyTime) : "Upon Send"}
              </div>
            </div>

            {/* 7. Check Out Time */}
            <div className="p-2 rounded-lg bg-background/80 border border-border/60">
              <div className="text-[9.5px] uppercase font-bold text-muted-foreground">7. Check Out</div>
              <div className="text-xs font-bold font-mono text-amber-600 dark:text-amber-400 mt-0.5">
                {appointment.checkOutTime ? formatTime12h(appointment.checkOutTime) : "Pending"}
              </div>
            </div>
          </div>
        </div>

        {/* 5. Destination Routing Actions */}
        <div className="space-y-2 pt-1">
          <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Send className="size-3.5 text-primary" />
            <span>Select Destination & Complete Routing</span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* 1. Cashier Counter */}
            <button
              type="button"
              onClick={() => executeRouting("CASHIER")}
              disabled={isRouting}
              className="p-3.5 rounded-xl border border-border/80 hover:border-emerald-500/50 bg-card hover:bg-emerald-500/5 text-left transition-all group flex flex-col justify-between space-y-2 shadow-xs cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 group-hover:scale-105 transition-transform">
                  <CreditCard className="size-4" />
                </div>
                <Badge
                  variant="outline"
                  className="text-[9.5px] font-bold text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                >
                  Payment Desk
                </Badge>
              </div>
              <div>
                <h5 className="font-bold text-xs text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                  Send to Cashier
                </h5>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Complete therapy session and send patient to Cashier counter
                  to settle bill (৳{dueAmount}).
                </p>
              </div>
              <div className="pt-1 flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                <span>Route to Cashier</span>
                <ArrowRight className="size-3 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>

            {/* 2. Doctor Consultation Queue */}
            <button
              type="button"
              onClick={() => executeRouting("DOCTOR")}
              disabled={isRouting}
              className="p-3.5 rounded-xl border border-border/80 hover:border-sky-500/50 bg-card hover:bg-sky-500/5 text-left transition-all group flex flex-col justify-between space-y-2 shadow-xs cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 group-hover:scale-105 transition-transform">
                  <Stethoscope className="size-4" />
                </div>
                <Badge
                  variant="outline"
                  className="text-[9.5px] font-bold text-sky-700 dark:text-sky-300 border-sky-500/30"
                >
                  Doctor Review
                </Badge>
              </div>
              <div>
                <h5 className="font-bold text-xs text-foreground group-hover:text-sky-600 dark:group-hover:text-sky-400">
                  Send to Doctor Queue
                </h5>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Transfer patient back to Doctor Consultation Queue for
                  follow-up or re-evaluation.
                </p>
              </div>
              <div className="pt-1 flex items-center gap-1 text-[11px] font-bold text-sky-600 dark:text-sky-400">
                <span>Route to Doctor</span>
                <ArrowRight className="size-3 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>

            {/* 3. Reception Desk */}
            <button
              type="button"
              onClick={() => executeRouting("RECEPTIONIST")}
              disabled={isRouting}
              className="p-3.5 rounded-xl border border-border/80 hover:border-amber-500/50 bg-card hover:bg-amber-500/5 text-left transition-all group flex flex-col justify-between space-y-2 shadow-xs cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 group-hover:scale-105 transition-transform">
                  <Users className="size-4" />
                </div>
                <Badge
                  variant="outline"
                  className="text-[9.5px] font-bold text-amber-700 dark:text-amber-300 border-amber-500/30"
                >
                  Front Desk
                </Badge>
              </div>
              <div>
                <h5 className="font-bold text-xs text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400">
                  Send to Receptionist
                </h5>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Mark therapy completed and route patient to front desk for
                  follow-up booking or exit.
                </p>
              </div>
              <div className="pt-1 flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                <span>Route to Reception</span>
                <ArrowRight className="size-3 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
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
          disabled={isRouting}
          className="text-xs cursor-pointer"
        >
          Cancel
        </Button>

        {isRouting && (
          <div className="flex items-center gap-2 text-xs text-primary font-bold">
            <Loader2 className="size-3.5 animate-spin" />
            <span>Sending patient to {routingDestination}...</span>
          </div>
        )}
      </DialogFooter>
    </DialogContent>
  );
}
