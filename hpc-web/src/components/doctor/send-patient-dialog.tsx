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
  Ticket,
  Stethoscope,
  ArrowRight,
  Activity,
  Banknote,
  Users,
  AlertTriangle,
  CheckCircle2,
  CalendarCheck2,
  CreditCard,
  Edit3,
  Loader2,
  Clock,
  Save,
  FileText,
  Timer,
} from "lucide-react";
import type { AppointmentWithRelations } from "@/actions/receptionist/appointment.action";
import {
  routePatientAction,
  updateAppointmentFeeAction,
} from "@/actions/doctor/doctor.action";
import {
  getPatientTreatmentPlansAction,
  type TreatmentPlanRecord,
  type TodayTherapySlotInfo,
} from "@/actions/doctor/treatment-plan.action";
import { toast } from "sonner";
import { DEFAULT_FEE } from "@/lib/billing";
import { formatTime12h } from "@/lib/queue-punctuality";
import { useRealtimeEvents } from "@/hooks/use-realtime-events";

interface SendPatientDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: AppointmentWithRelations | null;
  doctorId?: string;
  onSuccess?: () => void;
  onOpenTreatmentPlan?: (tab: "today" | "next") => void;
  onComplete?: () => Promise<void>;
  onTransferToTherapy?: () => Promise<void>;
}

const DUE_PRESETS = [0, 300, 500, 800, 1000, 1500];

export function SendPatientDialog({
  isOpen,
  onOpenChange,
  appointment,
  doctorId,
  onSuccess,
  onOpenTreatmentPlan,
}: SendPatientDialogProps) {
  if (!appointment) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <SendPatientDialogContent
        key={appointment.id}
        isOpen={isOpen}
        appointment={appointment}
        doctorId={doctorId}
        onOpenChange={onOpenChange}
        onSuccess={onSuccess}
        onOpenTreatmentPlan={onOpenTreatmentPlan}
      />
    </Dialog>
  );
}

function SendPatientDialogContent({
  isOpen,
  appointment,
  doctorId,
  onOpenChange,
  onSuccess,
  onOpenTreatmentPlan,
}: {
  isOpen: boolean;
  appointment: AppointmentWithRelations;
  doctorId?: string;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  onOpenTreatmentPlan?: (tab: "today" | "next") => void;
}) {
  const initialFee =
    typeof appointment.feeAmount === "number"
      ? appointment.feeAmount
      : appointment.type === "CONSULTATION" && !appointment.therapySlotId
        ? 0
        : DEFAULT_FEE;

  const [dueAmount, setDueAmount] = React.useState<number>(initialFee);
  const [isRouting, setIsRouting] = React.useState(false);
  const [routingDestination, setRoutingDestination] = React.useState<
    "CASHIER" | "HANDLER" | "RECEPTIONIST" | null
  >(null);
  const [routingNote, setRoutingNote] = React.useState<string>(
    appointment.routingNote || "",
  );

  // Today's Treatment Plan & Today's Therapy Slot state
  const [todayPlan, setTodayPlan] = React.useState<TreatmentPlanRecord | null>(
    null,
  );
  const [todayTherapySlot, setTodayTherapySlot] =
    React.useState<TodayTherapySlotInfo | null>(null);
  const [isLoadingPlan, setIsLoadingPlan] = React.useState<boolean>(
    Boolean(appointment.patientId),
  );
  const [isMissingPlanPromptOpen, setIsMissingPlanPromptOpen] =
    React.useState(false);
  const [isMissingSlotPromptOpen, setIsMissingSlotPromptOpen] =
    React.useState(false);

  const refreshPlanAndSlotStatus = React.useCallback(async () => {
    if (!appointment.patientId) return;
    setIsLoadingPlan(true);
    try {
      const res = await getPatientTreatmentPlansAction(
        appointment.patientId,
        appointment.id,
      );
      setTodayPlan(res.todayPlan || null);
      setTodayTherapySlot(res.todayTherapySlot || null);
    } catch (err) {
      console.error("[Fetch Treatment Plan & Slot Error]:", err);
    } finally {
      setIsLoadingPlan(false);
    }
  }, [appointment.patientId, appointment.id]);

  // Re-fetch whenever dialog opens or appointment changes
  React.useEffect(() => {
    if (isOpen && appointment.patientId) {
      void refreshPlanAndSlotStatus();
    }
  }, [isOpen, appointment.patientId, appointment.id, refreshPlanAndSlotStatus]);

  // Real-time refresh when a treatment plan is saved or a therapy slot is booked
  useRealtimeEvents({
    enabled: isOpen,
    onEvent: (event) => {
      const type = (event?.type || "").toUpperCase();
      if (
        type === "TREATMENT_PLAN_UPDATED" ||
        type === "TREATMENT_PLAN_SAVED" ||
        type === "APPOINTMENT_CREATED" ||
        type === "APPOINTMENT_UPDATED" ||
        type === "SLOT_UPDATED"
      ) {
        void refreshPlanAndSlotStatus();
      }
    },
  });

  const hasTherapySlotToday = Boolean(
    appointment.therapySlotId || todayTherapySlot?.slotId,
  );
  const effectiveSlotLabel =
    appointment.therapySlot?.label || todayTherapySlot?.label || null;
  const effectiveSlotRoom =
    appointment.therapySlot?.room?.number ||
    todayTherapySlot?.roomNumber ||
    null;

  const currentFee = appointment.feeAmount ?? initialFee;
  const isFeeModified = dueAmount !== currentFee;
  const isPaid = appointment.paymentStatus === "PAID";

  // Perform Routing
  const executeRouting = async (
    destination: "CASHIER" | "HANDLER" | "RECEPTIONIST",
  ) => {
    setIsRouting(true);
    setRoutingDestination(destination);
    try {
      const res = await routePatientAction({
        appointmentId: appointment.id,
        destination,
        feeAmount: Number(dueAmount),
        performerId: doctorId,
        pin: undefined,
        routingNote: routingNote.trim() || undefined,
      });

      if (res.success) {
        toast.success(res.message);
        onOpenChange(false);
        setIsMissingPlanPromptOpen(false);
        setIsMissingSlotPromptOpen(false);
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

  // Handle click on routing destination
  const handleDestinationClick = (
    destination: "CASHIER" | "HANDLER" | "RECEPTIONIST",
  ) => {
    if (dueAmount < 0) {
      toast.error("Due amount cannot be negative.");
      return;
    }

    if (destination === "HANDLER") {
      // 1. Check if there is a therapy slot booked for today
      if (!hasTherapySlotToday) {
        if (!todayPlan) {
          toast.warning(
            "No therapy slot booked for today, and there is no treatment plan for today!",
          );
        } else {
          toast.error(
            "There must be a therapy slot booked for today before sending to Handler.",
          );
        }
        setIsMissingSlotPromptOpen(true);
        return;
      }

      // 2. Check if there is a treatment plan for today
      if (!todayPlan) {
        toast.warning("Warning: There is no treatment plan for today!");
        setIsMissingPlanPromptOpen(true);
        return;
      }
    }

    executeRouting(destination);
  };

  return (
    <>
      <DialogContent className="w-[96vw] max-w-5xl lg:max-w-6xl max-h-[92dvh] flex flex-col p-0 overflow-hidden border-border/80 shadow-2xl rounded-2xl">
          {/* Header */}
          <DialogHeader className="p-4 sm:p-5 pb-3 pr-12 sm:pr-14 border-b border-border/60 bg-muted/20 shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary shrink-0 shadow-xs">
                  <Send className="size-5" />
                </div>
                <div>
                  <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                    <span>Send Patient</span>
                    <Badge
                      variant="outline"
                      className="text-[11px] font-mono font-bold bg-primary/10 border-primary/25 text-primary"
                    >
                      Destination Routing
                    </Badge>
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Review and edit billing due amount, check today&apos;s plan, and
                    route the patient to their next department.
                  </DialogDescription>
                </div>
              </div>

              {/* Status and Room Badges */}
              <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                {appointment.room?.number && (
                  <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-700 dark:text-sky-300">
                    Room {appointment.room.number}
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

          {/* Content Body */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4">
            {/* 1. Patient Summary Card */}
            <div className="p-3.5 rounded-xl bg-card/60 border border-border/70 shadow-2xs space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                    <User className="size-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-foreground">
                        {appointment.patient?.name || "Unnamed Patient"}
                      </h4>
                      <span className="text-[10.5px] font-semibold px-1.5 py-0.2 rounded bg-muted text-muted-foreground border border-border">
                        {appointment.gender === "MALE" ? "Male" : "Female"}
                      </span>
                      {appointment.patient?.age && (
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {appointment.patient.age} yrs
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono mt-0.5">
                      {appointment.patient?.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="size-3" />
                          {appointment.patient.phone}
                        </span>
                      )}
                      {appointment.therapySlot?.label && (
                        <span className="flex items-center gap-1">
                          <Ticket className="size-3" />
                          Slot: {appointment.therapySlot.label}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-700 dark:text-sky-300 font-bold text-xs">
                    <Stethoscope className="size-3.5" />
                    Doctor Consultation
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Due Amount & Billing Management Section */}
            {/* 2. Doctor Consultation Fee (Exclusive to Doctor) */}
            <div className="p-4 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/5 via-background to-amber-500/5 space-y-3 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300">
                    <Banknote className="size-4" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-2">
                      <span>Doctor Consultation Fee (ডাক্তার ফি)</span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-800 dark:text-amber-200 border border-amber-500/30">
                        Doctor Editable Only
                      </span>
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      Exclusive doctor fee. Whatever amount is set here automatically generates or updates the cashier invoice on send.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center">
                  {isPaid ? (
                    <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-bold text-[10.5px]">
                      <CheckCircle2 className="size-3 mr-1" />
                      Previously Paid
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 font-bold text-[10.5px]">
                      <Clock className="size-3 mr-1" />
                      Pending at Cashier
                    </Badge>
                  )}
                </div>
              </div>

              {/* Editable Input and Presets */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center pt-1">
                {/* Due Input */}
                <div className="sm:col-span-5 relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-sm text-foreground/80">
                    ৳
                  </div>
                  <Input
                    type="number"
                    min="0"
                    step="50"
                    value={dueAmount}
                    onChange={(e) => setDueAmount(Number(e.target.value))}
                    className="pl-8 h-9 font-mono font-bold text-sm bg-background border-border/80 focus-visible:ring-amber-500 rounded-lg shadow-2xs"
                    placeholder="Enter consultation fee..."
                  />
                </div>

                {/* Quick Presets */}
                <div className="sm:col-span-7 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-medium text-muted-foreground mr-1">
                    Presets:
                  </span>
                  {DUE_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setDueAmount(preset)}
                      className={`px-2 py-1 rounded-md text-[11px] font-bold font-mono transition-all cursor-pointer border ${
                        dueAmount === preset
                          ? "bg-amber-500 text-white border-amber-600 shadow-2xs"
                          : "bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground border-border/70"
                      }`}
                    >
                      {preset === 0 ? "Free (৳0)" : `৳${preset}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 3. Today's Therapy Slot & Treatment Plan Status Banners */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* 3A. Today's Therapy Slot Status Banner */}
              <div
                className={`p-3.5 rounded-xl border transition-all ${
                  hasTherapySlotToday
                    ? "bg-emerald-500/5 border-emerald-500/30"
                    : "bg-rose-500/5 border-rose-500/30"
                }`}
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-start gap-2.5">
                    <div
                      className={`p-1.5 rounded-lg shrink-0 ${
                        hasTherapySlotToday
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                          : "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                      }`}
                    >
                      <Ticket className="size-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h5 className="text-xs sm:text-sm font-bold text-foreground">
                          Today&apos;s Therapy Slot
                        </h5>
                        {isLoadingPlan ? (
                          <Loader2 className="size-3 animate-spin text-muted-foreground" />
                        ) : hasTherapySlotToday ? (
                          <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10.5px] font-bold">
                            Slot Booked
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 text-[10.5px] font-bold"
                          >
                            No Slot Booked Today
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {hasTherapySlotToday
                          ? `${effectiveSlotLabel || "Therapy Slot"}${effectiveSlotRoom ? ` • Room ${effectiveSlotRoom}` : ""}`
                          : "A therapy slot must be booked for today to send this patient to Handler Queue."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3B. Today's Treatment Plan Status Banner */}
              <div
                className={`p-3.5 rounded-xl border transition-all ${
                  todayPlan
                    ? "bg-emerald-500/5 border-emerald-500/30"
                    : "bg-amber-500/5 border-amber-500/30"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-start sm:items-center gap-2.5">
                    <div
                      className={`p-1.5 rounded-lg shrink-0 ${
                        todayPlan
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                          : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                      }`}
                    >
                      <CalendarCheck2 className="size-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h5 className="text-xs sm:text-sm font-bold text-foreground">
                          Today&apos;s Treatment Plan
                        </h5>
                        {isLoadingPlan ? (
                          <Loader2 className="size-3 animate-spin text-muted-foreground" />
                        ) : todayPlan ? (
                          <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10.5px] font-bold">
                            Prescribed ({todayPlan.modalities.length} items)
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10.5px] font-bold"
                          >
                            No Plan for Today
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {todayPlan
                          ? todayPlan.modalities.join(" • ") ||
                            "Modalities configured"
                          : "Warning: There is no treatment plan for today."}
                      </p>
                    </div>
                  </div>

                  {onOpenTreatmentPlan && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        onOpenTreatmentPlan("today");
                      }}
                      className={`h-7.5 px-3 text-xs font-bold gap-1.5 shrink-0 cursor-pointer ${
                        todayPlan
                          ? "border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
                          : "border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
                      }`}
                    >
                      <Edit3 className="size-3.5" />
                      <span>{todayPlan ? "Edit Plan" : "Set Plan Now"}</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* 4. Optional Routing / Department Note */}
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
                placeholder="e.g. Advised 5 days physical therapy (traction + hot pack); collect consultation fee at cashier counter..."
                value={routingNote}
                onChange={(e) => setRoutingNote(e.target.value.slice(0, 250))}
                className="min-h-16 text-xs resize-none"
              />
            </div>

            {/* 5. Clinical Journey Lifecycle Timestamps (All 7 Recorded Times) */}
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
                    {appointment.inConsultationTime ? formatTime12h(appointment.inConsultationTime) : (appointment.status === "IN_CONSULTATION" ? "Active Now" : "—")}
                  </div>
                </div>

                {/* 4. Out Consultation */}
                <div className="p-2 rounded-lg bg-background/80 border border-border/60">
                  <div className="text-[9.5px] uppercase font-bold text-muted-foreground">4. Out Consult</div>
                  <div className="text-xs font-bold font-mono text-sky-700 dark:text-sky-300 mt-0.5">
                    {appointment.outConsultationTime ? formatTime12h(appointment.outConsultationTime) : "Upon Send"}
                  </div>
                </div>

                {/* 5. In Therapy */}
                <div className="p-2 rounded-lg bg-background/80 border border-border/60">
                  <div className="text-[9.5px] uppercase font-bold text-muted-foreground">5. In Therapy</div>
                  <div className="text-xs font-bold font-mono text-purple-600 dark:text-purple-400 mt-0.5">
                    {appointment.inTherapyTime ? formatTime12h(appointment.inTherapyTime) : "—"}
                  </div>
                </div>

                {/* 6. Out Therapy */}
                <div className="p-2 rounded-lg bg-background/80 border border-border/60">
                  <div className="text-[9.5px] uppercase font-bold text-muted-foreground">6. Out Therapy</div>
                  <div className="text-xs font-bold font-mono text-purple-700 dark:text-purple-300 mt-0.5">
                    {appointment.outTherapyTime ? formatTime12h(appointment.outTherapyTime) : "—"}
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

            {/* 6. Three Primary Destination Routing Cards */}
            <div className="space-y-2 pt-1">
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-1">
                Select Patient Destination
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* 1. SEND TO CASHIER */}
                <div className="relative flex flex-col justify-between p-4 rounded-xl border border-amber-500/30 bg-card hover:bg-amber-500/[0.03] transition-all shadow-2xs group hover:border-amber-500/60">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="size-10 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300 flex items-center justify-center shadow-xs">
                        <CreditCard className="size-5" />
                      </div>
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-800 dark:text-amber-200 border border-amber-500/20">
                        ৳{dueAmount.toLocaleString()}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-sm text-foreground">
                        Send to Cashier
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                        Completes consultation, releases chamber room, and forwards
                        patient to Cashier Desk for bill settlement.
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-border/60">
                    <Button
                      type="button"
                      onClick={() => handleDestinationClick("CASHIER")}
                      disabled={isRouting}
                      className="w-full h-8.5 text-xs font-bold gap-1.5 bg-amber-500 hover:bg-amber-600 text-white shadow-xs cursor-pointer"
                    >
                      {isRouting && routingDestination === "CASHIER" ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Send className="size-3.5" />
                      )}
                      <span>Send to Cashier</span>
                    </Button>
                  </div>
                </div>

                {/* 2. SEND TO HANDLER QUEUE */}
                <div className="relative flex flex-col justify-between p-4 rounded-xl border border-emerald-500/30 bg-card hover:bg-emerald-500/[0.03] transition-all shadow-2xs group hover:border-emerald-500/60">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-1.5 flex-wrap">
                      <div className="size-10 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shadow-xs shrink-0">
                        <Activity className="size-5" />
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {hasTherapySlotToday ? (
                          <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border border-emerald-500/30 flex items-center gap-1">
                            <CheckCircle2 className="size-3" />
                            Slot Booked
                          </span>
                        ) : (
                          <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-800 dark:text-rose-200 border border-rose-500/30 flex items-center gap-1">
                            <AlertTriangle className="size-3" />
                            No Slot Today
                          </span>
                        )}
                        {todayPlan ? (
                          <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border border-emerald-500/30 flex items-center gap-1">
                            <CheckCircle2 className="size-3" />
                            Plan Ready
                          </span>
                        ) : (
                          <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-800 dark:text-amber-200 border border-amber-500/30 flex items-center gap-1 animate-pulse">
                            <AlertTriangle className="size-3" />
                            No Plan Today
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-bold text-sm text-foreground">
                        Send to Handler Queue
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                        Transfers patient to the live Physical Therapy queue.
                        Requires a booked therapy slot &amp; treatment plan for today.
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-border/60">
                    <Button
                      type="button"
                      onClick={() => handleDestinationClick("HANDLER")}
                      disabled={isRouting || isLoadingPlan}
                      className="w-full h-8.5 text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer"
                    >
                      {isRouting && routingDestination === "HANDLER" ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Activity className="size-3.5" />
                      )}
                      <span>Send to Handler</span>
                    </Button>
                  </div>
                </div>

                {/* 3. SEND TO RECEPTIONIST */}
                <div className="relative flex flex-col justify-between p-4 rounded-xl border border-indigo-500/30 bg-card hover:bg-indigo-500/[0.03] transition-all shadow-2xs group hover:border-indigo-500/60">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="size-10 rounded-xl bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 flex items-center justify-center shadow-xs">
                        <Users className="size-5" />
                      </div>
                      <span className="font-mono text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-800 dark:text-indigo-200 border border-indigo-500/20">
                        Front Desk
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-sm text-foreground">
                        Send to Receptionist
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                        Completes consultation, releases room, and forwards patient
                        to Receptionist Desk (Waiting Room) for slot booking or check-out.
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-border/60">
                    <Button
                      type="button"
                      onClick={() => handleDestinationClick("RECEPTIONIST")}
                      disabled={isRouting}
                      className="w-full h-8.5 text-xs font-bold gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer"
                    >
                      {isRouting && routingDestination === "RECEPTIONIST" ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <ArrowRight className="size-3.5" />
                      )}
                      <span>Send to Receptionist</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <DialogFooter className="p-3 sm:p-4 border-t border-border/60 bg-muted/10 flex flex-row items-center justify-between gap-2">
            <div className="text-[11px] text-muted-foreground">
              Applied Due:{" "}
              <span className="font-bold text-foreground font-mono">
                ৳{dueAmount.toLocaleString()} BDT
              </span>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs cursor-pointer"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>

      {/* Missing Therapy Slot for Today Warning Prompt (Blocks Handler Routing) */}
      <Dialog
        open={isMissingSlotPromptOpen}
        onOpenChange={setIsMissingSlotPromptOpen}
      >
        <DialogContent className="w-[90vw] sm:max-w-md max-h-[92dvh] overflow-y-auto p-5 border-rose-500/40 shadow-2xl rounded-2xl">
          <div className="flex items-start gap-3.5">
            <div className="size-10 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="size-5" />
            </div>
            <div className="space-y-2">
              <DialogTitle className="text-base font-bold text-foreground">
                No Therapy Slot Booked for Today
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
                To send <strong className="text-foreground">{appointment.patient?.name || "this patient"}</strong> to the{" "}
                <strong className="text-foreground">Physical Therapy Handler</strong>{" "}
                queue, there must be a Therapy Slot booked for today.
              </DialogDescription>

              {!todayPlan && (
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs font-semibold flex items-start gap-2">
                  <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    Warning: There is no treatment plan for today. Please also configure today&apos;s treatment plan before therapy.
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-3">
            {!todayPlan && onOpenTreatmentPlan && (
              <Button
                type="button"
                onClick={() => {
                  setIsMissingSlotPromptOpen(false);
                  onOpenTreatmentPlan("today");
                }}
                className="w-full h-9 text-xs font-bold gap-1.5 bg-amber-500 hover:bg-amber-600 text-white cursor-pointer shadow-xs"
              >
                <CalendarCheck2 className="size-4" />
                <span>Configure Today&apos;s Treatment Plan First</span>
              </Button>
            )}

            <Button
              type="button"
              onClick={() => {
                setIsMissingSlotPromptOpen(false);
                executeRouting("RECEPTIONIST");
              }}
              disabled={isRouting}
              className="w-full h-9 text-xs font-bold gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-xs"
            >
              {isRouting && routingDestination === "RECEPTIONIST" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Users className="size-3.5" />
              )}
              <span>Forward to Receptionist (To Book Therapy Slot)</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsMissingSlotPromptOpen(false)}
              className="w-full h-8 text-xs text-muted-foreground cursor-pointer"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Missing Today's Plan Warning Prompt */}
      <Dialog
        open={isMissingPlanPromptOpen}
        onOpenChange={setIsMissingPlanPromptOpen}
      >
        <DialogContent className="w-[90vw] sm:max-w-md max-h-[92dvh] overflow-y-auto p-5 border-amber-500/40 shadow-2xl rounded-2xl">
          <div className="flex items-start gap-3.5">
            <div className="size-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="size-5" />
            </div>
            <div className="space-y-1.5">
              <DialogTitle className="text-base font-bold text-foreground">
                Warning: There is no treatment plan for today
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
                You are routing this patient to the{" "}
                <strong className="text-foreground">Physical Therapy Handler</strong>{" "}
                queue, but there is no treatment plan for today.
                Handlers require today&apos;s prescribed modalities to execute therapy sessions.
              </DialogDescription>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-3">
            {onOpenTreatmentPlan && (
              <Button
                type="button"
                onClick={() => {
                  setIsMissingPlanPromptOpen(false);
                  onOpenTreatmentPlan("today");
                }}
                className="w-full h-9 text-xs font-bold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer shadow-xs"
              >
                <CalendarCheck2 className="size-4" />
                <span>Configure Today&apos;s Plan First</span>
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsMissingPlanPromptOpen(false);
                executeRouting("HANDLER");
              }}
              disabled={isRouting}
              className="w-full h-8.5 text-xs font-semibold gap-1.5 border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 cursor-pointer"
            >
              {isRouting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Activity className="size-3.5" />
              )}
              <span>Send to Handler Anyway (Without Plan)</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsMissingPlanPromptOpen(false)}
              className="w-full h-8 text-xs text-muted-foreground cursor-pointer"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
