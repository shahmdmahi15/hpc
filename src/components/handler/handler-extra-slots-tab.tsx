"use client";

import * as React from "react";
import type { AppointmentWithRelations } from "@/actions/receptionist/appointment.action";
import { ExtraApprovalStatus, AppointmentStatus } from "@/generated/prisma/enums";
import {
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Phone,
  DoorOpen,
  MessageSquare,
  ShieldCheck,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatTime12h } from "@/lib/queue-punctuality";

interface HandlerExtraSlotsTabProps {
  extraSlots: AppointmentWithRelations[];
}

export function HandlerExtraSlotsTab({
  extraSlots,
}: HandlerExtraSlotsTabProps) {
  const [filterQuery, setFilterQuery] = React.useState("");

  const filteredSlots = React.useMemo(() => {
    const q = filterQuery.toLowerCase().trim();
    if (!q) return extraSlots;
    return extraSlots.filter((apt) => {
      const name = (apt.patient?.name || "").toLowerCase();
      const phone = (apt.patient?.phone || "").toLowerCase();
      const slot = (apt.therapySlot?.label || "").toLowerCase();
      return name.includes(q) || phone.includes(q) || slot.includes(q);
    });
  }, [extraSlots, filterQuery]);

  const pendingCount = extraSlots.filter(
    (a) => a.extraStatus === ExtraApprovalStatus.PENDING,
  ).length;
  const approvedCount = extraSlots.filter(
    (a) => a.extraStatus === ExtraApprovalStatus.APPROVED,
  ).length;
  const rejectedCount = extraSlots.filter(
    (a) => a.extraStatus === ExtraApprovalStatus.REJECTED,
  ).length;

  return (
    <div className="space-y-3 animate-in fade-in duration-150">
      {/* 1. Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <div className="p-2.5 rounded-xl border border-border/80 bg-card/80 shadow-2xs space-y-0.5">
          <div className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">
            Total Extra Booked
          </div>
          <div className="text-xl font-black text-foreground">
            {extraSlots.length}
          </div>
          <div className="text-[10px] text-muted-foreground">
            Emergency buffer capacity
          </div>
        </div>

        <div className="p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5 shadow-2xs space-y-0.5">
          <div className="text-[10.5px] font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wider">
            Pending Dr. Approval
          </div>
          <div className="text-xl font-black text-amber-600 dark:text-amber-400">
            {pendingCount}
          </div>
          <div className="text-[10px] text-muted-foreground">
            Awaiting attending physician
          </div>
        </div>

        <div className="p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 shadow-2xs space-y-0.5">
          <div className="text-[10.5px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
            Approved by Doctor
          </div>
          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
            {approvedCount}
          </div>
          <div className="text-[10px] text-muted-foreground">
            Authorized for therapy
          </div>
        </div>

        <div className="p-2.5 rounded-xl border border-rose-500/30 bg-rose-500/5 shadow-2xs space-y-0.5">
          <div className="text-[10.5px] font-semibold text-rose-700 dark:text-rose-300 uppercase tracking-wider">
            Rejected
          </div>
          <div className="text-xl font-black text-rose-600 dark:text-rose-400">
            {rejectedCount}
          </div>
          <div className="text-[10px] text-muted-foreground">
            Quota released
          </div>
        </div>
      </div>

      {/* 2. Filter Bar */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
        <Input
          placeholder="Filter by patient name, phone, slot..."
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
          className="pl-7 h-7 text-xs bg-card"
        />
      </div>

      {/* 3. Extra Slots List */}
      {filteredSlots.length === 0 ? (
        <div className="p-8 rounded-xl border border-dashed border-border/80 text-center space-y-1 bg-muted/10">
          <ShieldCheck className="size-6 text-muted-foreground/60 mx-auto" />
          <h4 className="text-xs font-bold text-foreground">
            No Extra Slots Found
          </h4>
          <p className="text-[11px] text-muted-foreground">
            {extraSlots.length === 0
              ? "No standby extra slots have been booked today. Therapy sessions are operating within standard capacity."
              : "No extra slots matched your search filter."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
          {filteredSlots.map((apt) => {
            const isPending =
              apt.extraStatus === ExtraApprovalStatus.PENDING;
            const isApproved =
              apt.extraStatus === ExtraApprovalStatus.APPROVED;
            const isRejected =
              apt.extraStatus === ExtraApprovalStatus.REJECTED;
            const isCheckedIn =
              apt.status === AppointmentStatus.CHECKED_IN ||
              apt.status === AppointmentStatus.IN_THERAPY;

            return (
              <div
                key={apt.id}
                className={`rounded-xl border p-2.5 space-y-2 shadow-2xs transition-all ${
                  isPending
                    ? "border-amber-500/40 bg-amber-500/5"
                    : isApproved
                      ? "border-emerald-500/40 bg-card"
                      : "border-rose-500/30 bg-rose-500/5 opacity-75"
                }`}
              >
                {/* Header: Patient Name & Status Pill */}
                <div className="flex items-start justify-between gap-1.5">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`px-1.5 py-0.2 rounded text-[9.5px] font-bold border ${
                          apt.gender === "MALE"
                            ? "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20"
                            : "bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/20"
                        }`}
                      >
                        {apt.gender === "MALE" ? "M" : "F"}
                      </span>
                      <h4 className="font-bold text-xs text-foreground truncate">
                        {apt.patient?.name}
                      </h4>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                      <span className="flex items-center gap-0.5">
                        <Phone className="size-2.5 opacity-60" />
                        <span>{apt.patient?.phone}</span>
                      </span>
                      {apt.toldTime && <span>• Told: {apt.toldTime}</span>}
                    </div>
                  </div>

                  {/* Status Pill */}
                  {isPending && (
                    <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/30 text-[9.5px] font-bold">
                      <AlertCircle className="size-2.5" />
                      <span>Pending Dr.</span>
                    </span>
                  )}
                  {isApproved && (
                    <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border border-emerald-500/30 text-[9.5px] font-bold">
                      <CheckCircle2 className="size-2.5" />
                      <span>Approved</span>
                    </span>
                  )}
                  {isRejected && (
                    <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-800 dark:text-rose-200 border border-rose-500/30 text-[9.5px] font-bold">
                      <XCircle className="size-2.5" />
                      <span>Rejected</span>
                    </span>
                  )}
                </div>

                {/* Slot Details */}
                <div className="p-1.5 rounded-lg bg-muted/40 border border-border/50 text-[11px] flex items-center justify-between font-mono">
                  <div className="flex items-center gap-1 text-foreground font-sans font-medium">
                    <Clock className="size-3 text-primary/70" />
                    <span>{apt.therapySlot?.label || "Therapy Slot"}</span>
                  </div>
                  {apt.room?.number && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <DoorOpen className="size-3 text-emerald-500" />
                      <span>Room {apt.room.number}</span>
                    </div>
                  )}
                </div>

                {/* Notes Section: Receptionist Reason & Doctor Note */}
                <div className="space-y-1 text-[10.5px]">
                  {apt.extraReason && (
                    <div className="text-muted-foreground flex items-start gap-1">
                      <MessageSquare className="size-2.5 opacity-70 shrink-0 mt-0.5" />
                      <span>
                        <strong className="text-foreground/80 font-semibold">
                          Receptionist:
                        </strong>{" "}
                        <span className="italic">&ldquo;{apt.extraReason}&rdquo;</span>
                      </span>
                    </div>
                  )}

                  {apt.extraApprovalNote && (
                    <div className="text-foreground/90 flex items-start gap-1">
                      <ShieldCheck className="size-2.5 text-primary shrink-0 mt-0.5" />
                      <span>
                        <strong className="text-primary font-bold">
                          Doctor Note:
                        </strong>{" "}
                        <span className="italic">
                          &ldquo;{apt.extraApprovalNote}&rdquo;
                        </span>
                        {apt.extraApprovedBy?.name && (
                          <span className="text-muted-foreground text-[9.5px] block font-mono">
                            By: Dr. {apt.extraApprovedBy.name}
                            {apt.extraApprovedAt &&
                              ` at ${formatTime12h(apt.extraApprovedAt)}`}
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                </div>

                {/* Attendance Indicator */}
                <div className="pt-1 border-t border-border/40 flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                  <span>
                    Status:{" "}
                    <strong className="text-foreground">
                      {apt.status}
                    </strong>
                  </span>
                  {isCheckedIn && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
                      <CheckCircle2 className="size-2.5" />
                      In Queue / Therapy
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
