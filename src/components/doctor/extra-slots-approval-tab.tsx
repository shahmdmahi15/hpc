"use client";

import * as React from "react";
import { reviewExtraSlotAction } from "@/actions/doctor/doctor.action";
import type { AppointmentWithRelations } from "@/actions/receptionist/appointment.action";
import { ExtraApprovalStatus } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Phone,
  DoorOpen,
  AlertCircle,
  MessageSquare,
  Sparkles,
  ShieldAlert,
  CalendarCheck,
  History,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { formatTime12h } from "@/lib/queue-punctuality";

interface ExtraSlotsApprovalTabProps {
  pendingExtraSlots: AppointmentWithRelations[];
  decidedExtraSlots: AppointmentWithRelations[];
  performerId: string;
  onRefresh: () => void;
}

const APPROVE_PRESET_NOTES = [
  "Approved for urgent rehabilitation",
  "Patient in acute distress - approved",
  "Chamber capacity permits extra patient",
  "Approved on attending doctor order",
];

const REJECT_PRESET_NOTES = [
  "Chamber at maximum capacity - cannot accommodate",
  "Reschedule patient to another slot or tomorrow",
  "Condition does not warrant emergency standby",
  "Please consult doctor before adding standby slot",
];

export function ExtraSlotsApprovalTab({
  pendingExtraSlots,
  decidedExtraSlots,
  performerId,
  onRefresh,
}: ExtraSlotsApprovalTabProps) {
  // Modal state
  const [selectedAppointment, setSelectedAppointment] =
    React.useState<AppointmentWithRelations | null>(null);
  const [decisionType, setDecisionType] = React.useState<"APPROVE" | "REJECT">(
    "APPROVE",
  );
  const [doctorNote, setDoctorNote] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showHistory, setShowHistory] = React.useState(false);

  const handleOpenReview = (
    apt: AppointmentWithRelations,
    decision: "APPROVE" | "REJECT",
  ) => {
    setSelectedAppointment(apt);
    setDecisionType(decision);
    setDoctorNote("");
  };

  const handleCloseReview = () => {
    if (isSubmitting) return;
    setSelectedAppointment(null);
    setDoctorNote("");
  };

  const handleConfirmDecision = async () => {
    if (!selectedAppointment) return;
    setIsSubmitting(true);
    try {
      const res = await reviewExtraSlotAction({
        appointmentId: selectedAppointment.id,
        decision: decisionType,
        note: doctorNote.trim() || undefined,
        performerId,
      });

      if (res.success) {
        toast.success(
          decisionType === "APPROVE"
            ? `Extra slot for ${selectedAppointment.patient?.name} approved.`
            : `Extra slot for ${selectedAppointment.patient?.name} rejected and quota released.`,
        );
        handleCloseReview();
        onRefresh();
      } else {
        toast.error(res.message || "Failed to process decision.");
      }
    } catch (err) {
      console.error("Failed to review extra slot:", err);
      toast.error("An unexpected error occurred while reviewing the slot.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* ---------------------------------------------------- */}
      {/* 1. Header & Summary Banner                           */}
      {/* ---------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 sm:px-4 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <ShieldAlert className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-black tracking-tight text-foreground">
                Extra Slot Requests
              </h2>
              <span className="px-2 py-0.2 rounded-full bg-amber-500 text-white text-[10.5px] font-bold shadow-xs">
                {pendingExtraSlots.length} Pending
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              When regular therapy slot capacity is reached, standby extra slots
              require attending doctor authorization.
            </p>
          </div>
        </div>

        {decidedExtraSlots.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHistory((prev) => !prev)}
            className="h-7.5 text-xs font-semibold rounded-lg gap-1.5 self-start sm:self-auto cursor-pointer border-border/80"
          >
            <History className="size-3.5 text-muted-foreground" />
            <span>
              {showHistory
                ? "Hide History"
                : `View History (${decidedExtraSlots.length})`}
            </span>
          </Button>
        )}
      </div>

      {/* ---------------------------------------------------- */}
      {/* 2. Pending Requests Grid                             */}
      {/* ---------------------------------------------------- */}
      {pendingExtraSlots.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/80 bg-card/50 p-8 text-center space-y-2">
          <div className="size-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <CalendarCheck className="size-5" />
          </div>
          <h3 className="text-xs sm:text-sm font-bold text-foreground">
            No Pending Extra Slot Requests
          </h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            All extra slot bookings have been reviewed or regular quota is
            operating normally. New standby extra slots booked by receptionist
            will appear here for approval in real-time.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {pendingExtraSlots.map((apt) => {
            const isMale = apt.gender === "MALE";
            return (
              <div
                key={apt.id}
                className="relative rounded-xl border border-amber-500/40 bg-card/95 hover:border-amber-500/60 shadow-xs flex flex-col justify-between overflow-hidden transition-all duration-200"
              >
                {/* Standby Header Stripe */}
                <div className="bg-amber-500/10 border-b border-amber-500/20 px-3 py-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 font-bold text-[11px]">
                    <AlertCircle className="size-3" />
                    <span>Standby Extra Slot Request</span>
                  </div>
                  <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-800 dark:text-amber-200 text-[10px] font-mono font-bold uppercase">
                    Awaiting Dr.
                  </span>
                </div>

                {/* Card Body */}
                <div className="p-3 space-y-2.5 flex-1">
                  {/* Patient Info */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${
                            isMale
                              ? "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20"
                              : "bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/20"
                          }`}
                        >
                          {isMale ? "Male" : "Female"}
                        </span>
                        <h4 className="font-black text-sm text-foreground tracking-tight">
                          {apt.patient?.name || "Patient"}
                        </h4>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                        <span className="flex items-center gap-1">
                          <Phone className="size-2.5 opacity-70" />
                          <span>{apt.patient?.phone || "No phone"}</span>
                        </span>
                        {apt.toldTime && (
                          <>
                            <span>•</span>
                            <span className="text-primary font-bold">
                              Told: {apt.toldTime}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Slot Details */}
                  <div className="p-2 rounded-lg bg-muted/40 border border-border/70 space-y-1 text-xs">
                    <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                      <span className="font-semibold text-foreground">
                        {apt.therapySlot?.label || "Therapy Slot"}
                      </span>
                      {apt.room?.number && (
                        <span className="flex items-center gap-1 font-mono font-bold text-foreground">
                          <DoorOpen className="size-3 text-sky-500" />
                          <span>Room {apt.room.number}</span>
                        </span>
                      )}
                    </div>
                    {apt.therapySlot && (
                      <div className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                        <Clock className="size-3 text-primary/70" />
                        <span>
                          {apt.therapySlot.startTime} -{" "}
                          {apt.therapySlot.endTime}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Receptionist Reason / Note */}
                  <div className="p-2 rounded-lg bg-amber-500/5 border border-amber-500/20 space-y-1">
                    <div className="flex items-center gap-1 text-[10.5px] font-bold text-amber-700 dark:text-amber-300">
                      <MessageSquare className="size-3" />
                      <span>Receptionist Reason:</span>
                    </div>
                    <p className="text-xs text-foreground/90 italic">
                      &ldquo;{apt.extraReason || "No specific note provided"}
                      &rdquo;
                    </p>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="p-2.5 pt-0 flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleOpenReview(apt, "APPROVE")}
                    className="flex-1 h-8 rounded-lg font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer gap-1.5"
                  >
                    <CheckCircle2 className="size-3.5" />
                    <span>Approve</span>
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenReview(apt, "REJECT")}
                    className="flex-1 h-8 rounded-lg font-semibold text-xs border-rose-500/30 text-rose-700 dark:text-rose-300 hover:bg-rose-500/10 cursor-pointer gap-1.5"
                  >
                    <XCircle className="size-3.5" />
                    <span>Reject</span>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 3. Decided Extra Slots History Table                 */}
      {/* ---------------------------------------------------- */}
      {showHistory && decidedExtraSlots.length > 0 && (
        <div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-2xs space-y-0 animate-in fade-in-50 duration-200">
          <div className="p-2.5 px-3 bg-muted/30 border-b border-border/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="size-3.5 text-muted-foreground" />
              <h3 className="text-xs font-bold text-foreground">
                Decided Extra Slot History (Today)
              </h3>
            </div>
            <span className="text-[11px] font-mono text-muted-foreground">
              {decidedExtraSlots.length} records
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border/80 bg-muted/20 text-muted-foreground font-semibold">
                  <th className="py-2 px-3 text-[11px]">Patient</th>
                  <th className="py-2 px-2.5 text-[11px]">Slot & Time</th>
                  <th className="py-2 px-2.5 text-[11px]">Receptionist Note</th>
                  <th className="py-2 px-2.5 text-[11px]">
                    Doctor Note & Reviewer
                  </th>
                  <th className="py-2 px-3 text-right text-[11px]">Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {decidedExtraSlots.map((a) => {
                  const isApproved =
                    a.extraStatus === ExtraApprovalStatus.APPROVED;
                  return (
                    <tr
                      key={a.id}
                      className="hover:bg-muted/15 transition-colors"
                    >
                      <td className="py-2 px-3">
                        <div className="font-bold text-foreground">
                          {a.patient?.name}
                        </div>
                        <div className="text-[10px] font-mono text-muted-foreground">
                          {a.patient?.phone} • {a.gender === "MALE" ? "M" : "F"}
                        </div>
                      </td>
                      <td className="py-2 px-2.5 font-mono text-[11px]">
                        <div>{a.therapySlot?.label || "Slot"}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {a.therapySlot?.startTime} - {a.therapySlot?.endTime}
                        </div>
                      </td>
                      <td className="py-2 px-2.5 text-[11px] max-w-[200px]">
                        <span className="italic text-muted-foreground">
                          &ldquo;{a.extraReason || "---"}&rdquo;
                        </span>
                      </td>
                      <td className="py-2 px-2.5 text-[11px] max-w-[240px]">
                        <div className="font-medium text-foreground">
                          {a.extraApprovalNote ? (
                            <span>&ldquo;{a.extraApprovalNote}&rdquo;</span>
                          ) : (
                            <span className="text-muted-foreground italic">
                              No note added
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
                          <span>
                            By: {a.extraApprovedBy?.name || "Attending Doctor"}
                          </span>
                          {a.extraApprovedAt && (
                            <>
                              <span>•</span>
                              <span>{formatTime12h(a.extraApprovedAt)}</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-right">
                        {isApproved ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[10.5px] font-bold">
                            <CheckCircle2 className="size-3" />
                            <span>Approved</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 text-[10.5px] font-bold">
                            <XCircle className="size-3" />
                            <span>Rejected</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 4. Review Confirmation Dialog with Optional Note     */}
      {/* ---------------------------------------------------- */}
      <Dialog
        open={Boolean(selectedAppointment)}
        onOpenChange={(open) => !open && handleCloseReview()}
      >
        <DialogContent className="w-[95vw] sm:max-w-lg md:max-w-xl p-0 overflow-hidden border-border/80 shadow-2xl rounded-2xl">
          <DialogHeader
            className={`p-4 border-b ${
              decisionType === "APPROVE"
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-900 dark:text-emerald-100"
                : "bg-rose-500/10 border-rose-500/20 text-rose-900 dark:text-rose-100"
            }`}
          >
            <div className="flex items-center gap-2">
              <div
                className={`size-8 rounded-lg flex items-center justify-center ${
                  decisionType === "APPROVE"
                    ? "bg-emerald-500 text-white"
                    : "bg-rose-500 text-white"
                }`}
              >
                {decisionType === "APPROVE" ? (
                  <CheckCircle2 className="size-4" />
                ) : (
                  <XCircle className="size-4" />
                )}
              </div>
              <div>
                <DialogTitle className="text-sm sm:text-base font-black">
                  {decisionType === "APPROVE"
                    ? "Approve Extra Slot Booking"
                    : "Reject Extra Slot Booking"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {decisionType === "APPROVE"
                    ? "The ticket will be confirmed and ready for receptionist check-in."
                    : "The ticket will be cancelled and slot standby quota will be freed."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {selectedAppointment && (
            <div className="p-4 space-y-3.5">
              {/* Patient & Slot Mini Summary */}
              <div className="p-2.5 rounded-lg bg-muted/40 border border-border/70 space-y-1.5 text-xs">
                <div className="flex items-center justify-between font-bold">
                  <span className="text-foreground">
                    {selectedAppointment.patient?.name}
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {selectedAppointment.patient?.phone}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                  <span>{selectedAppointment.therapySlot?.label}</span>
                  <span>•</span>
                  <span>
                    {selectedAppointment.therapySlot?.startTime} -{" "}
                    {selectedAppointment.therapySlot?.endTime}
                  </span>
                  {selectedAppointment.room?.number && (
                    <>
                      <span>•</span>
                      <span>Room {selectedAppointment.room.number}</span>
                    </>
                  )}
                </div>
                {selectedAppointment.extraReason && (
                  <div className="pt-1 text-[11px] text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      Receptionist Note:
                    </span>{" "}
                    <span className="italic">
                      &ldquo;{selectedAppointment.extraReason}&rdquo;
                    </span>
                  </div>
                )}
              </div>

              {/* Doctor's Optional Note */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="doctor-note"
                    className="text-xs font-bold text-foreground flex items-center gap-1.5"
                  >
                    <FileText className="size-3 text-primary" />
                    <span>Doctor&apos;s Optional Note</span>
                  </label>
                  <span className="text-[10.5px] text-muted-foreground italic">
                    Optional
                  </span>
                </div>

                <Textarea
                  id="doctor-note"
                  rows={2}
                  placeholder={
                    decisionType === "APPROVE"
                      ? "e.g., Approved for acute rehab case..."
                      : "e.g., Chamber fully packed, reschedule to tomorrow..."
                  }
                  value={doctorNote}
                  onChange={(e) => setDoctorNote(e.target.value)}
                  className="text-xs resize-none bg-background border-border/80 focus-visible:ring-primary"
                />

                {/* Quick Presets */}
                <div className="space-y-1 pt-1">
                  <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                    <Sparkles className="size-2.5 text-amber-500" />
                    Quick presets:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {(decisionType === "APPROVE"
                      ? APPROVE_PRESET_NOTES
                      : REJECT_PRESET_NOTES
                    ).map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setDoctorNote(preset)}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-muted hover:bg-muted/80 border border-border/70 text-foreground transition-colors cursor-pointer"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="p-3 px-4 border-t border-border/60 bg-muted/20 flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCloseReview}
              disabled={isSubmitting}
              className="h-8 text-xs font-semibold rounded-lg cursor-pointer"
            >
              Cancel
            </Button>

            <Button
              size="sm"
              onClick={handleConfirmDecision}
              disabled={isSubmitting}
              className={`h-8 text-xs font-bold rounded-lg cursor-pointer shadow-xs gap-1.5 ${
                decisionType === "APPROVE"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-rose-600 hover:bg-rose-700 text-white"
              }`}
            >
              {isSubmitting ? (
                <span>Saving...</span>
              ) : decisionType === "APPROVE" ? (
                <>
                  <CheckCircle2 className="size-3.5" />
                  <span>Confirm Approval</span>
                </>
              ) : (
                <>
                  <XCircle className="size-3.5" />
                  <span>Confirm Rejection</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
