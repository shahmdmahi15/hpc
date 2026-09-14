"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Clock,
  CheckCircle2,
  Ticket,
  DoorOpen,
  Search,
  Plus,
  X,
  AlertTriangle,
  Megaphone,
  Stethoscope,
  Activity,
} from "lucide-react";
import {
  AppointmentStatus,
  BookingType,
  ExtraApprovalStatus,
} from "@/generated/prisma/enums";
import type { SlotWithTelemetry } from "@/actions/receptionist/appointment.action";

interface SlotScheduleBoardProps {
  slots: SlotWithTelemetry[];
  stats: {
    totalBooked: number;
    checkedInCount: number;
    maleBooked: number;
    femaleBooked: number;
    extraBooked: number;
    totalActiveSlots: number;
    totalRegularCapacity: number;
    totalExtraCapacity: number;
  };
  selectedDate: string;
  dayOfWeek: string;
  onSelectDate: (date: string) => void;
  onBookSlot: (slotId: string) => void;
  onCheckIn: (appointmentId: string) => Promise<void>;
  onCancelAppointment: (appointmentId: string) => Promise<void>;
}

function formatCheckInTime(
  dateVal: Date | string | null | undefined,
): string | null {
  if (!dateVal) return null;
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return null;

    let hours = d.getHours();
    const minutes = d.getMinutes();
    const period = hours >= 12 ? "PM" : "AM";

    hours = hours % 12;
    if (hours === 0) hours = 12;

    const formattedHours = String(hours).padStart(2, "0");
    const formattedMinutes = String(minutes).padStart(2, "0");

    return `${formattedHours}:${formattedMinutes} ${period}`;
  } catch {
    return null;
  }
}

import { DashboardDateSelector } from "@/components/ui/dashboard-date-selector";

export function SlotScheduleBoard({
  slots,
  stats,
  selectedDate,
  dayOfWeek,
  onSelectDate,
  onBookSlot,
  onCheckIn,
  onCancelAppointment,
}: SlotScheduleBoardProps) {
  const [filterQuery, setFilterQuery] = React.useState("");

  return (
    <div className="space-y-3">
      {/* ---------------------------------------------------- */}
      {/* 1. Date Navigation & Filter Bar                      */}
      {/* ---------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 rounded-xl bg-card border border-border/70 shadow-2xs">
        {/* Date Navigator */}
        <DashboardDateSelector
          selectedDate={selectedDate}
          dayOfWeek={dayOfWeek}
          onSelectDate={onSelectDate}
        />

        {/* Live Filter Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1.5 size-3 text-muted-foreground" />
          <Input
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Search token, patient, phone..."
            className="pl-7 h-7 text-xs bg-background"
          />
          {filterQuery && (
            <button
              onClick={() => setFilterQuery("")}
              className="absolute right-2.5 top-1.5 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 2. Today's Capacity & Queue Telemetry Metrics        */}
      {/* ---------------------------------------------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
        {/* Total Booked */}
        <Card className="border-border/80 bg-card/80 shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-1 p-2.5">
            <CardTitle className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Total Booked
            </CardTitle>
            <Ticket className="size-3 text-primary" />
          </CardHeader>
          <CardContent className="p-2.5 pt-0">
            <div className="text-lg sm:text-xl font-bold text-foreground">
              {stats.totalBooked}
            </div>
            <p className="text-[10px] text-muted-foreground">
              of {stats.totalRegularCapacity} standard capacity
            </p>
          </CardContent>
        </Card>

        {/* Checked-In Patients */}
        <Card className="border-border/80 bg-card/80 shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-1 p-2.5">
            <CardTitle className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Checked In
            </CardTitle>
            <CheckCircle2 className="size-3 text-emerald-500" />
          </CardHeader>
          <CardContent className="p-2.5 pt-0">
            <div className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400">
              {stats.checkedInCount}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Ready in waiting area
            </p>
          </CardContent>
        </Card>

        {/* Male Patients Booked */}
        <Card className="border-border/80 bg-card/80 shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-1 p-2.5">
            <CardTitle className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Male Quota
            </CardTitle>
            <div className="size-1.5 rounded-full bg-sky-500" />
          </CardHeader>
          <CardContent className="p-2.5 pt-0">
            <div className="text-lg sm:text-xl font-bold text-sky-600 dark:text-sky-400">
              {stats.maleBooked}
            </div>
            <p className="text-[10px] text-muted-foreground">
              {Math.round(stats.totalRegularCapacity / 2)} capacity
            </p>
          </CardContent>
        </Card>

        {/* Female Patients Booked */}
        <Card className="border-border/80 bg-card/80 shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-1 p-2.5">
            <CardTitle className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Female Quota
            </CardTitle>
            <div className="size-1.5 rounded-full bg-pink-500" />
          </CardHeader>
          <CardContent className="p-2.5 pt-0">
            <div className="text-lg sm:text-xl font-bold text-pink-600 dark:text-pink-400">
              {stats.femaleBooked}
            </div>
            <p className="text-[10px] text-muted-foreground">
              {Math.round(stats.totalRegularCapacity / 2)} capacity
            </p>
          </CardContent>
        </Card>

        {/* Standby Extra Booked */}
        <Card className="border-border/80 bg-card/80 shadow-2xs col-span-2 lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-1 p-2.5">
            <CardTitle className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Standby Extra
            </CardTitle>
            <AlertTriangle className="size-3 text-amber-500" />
          </CardHeader>
          <CardContent className="p-2.5 pt-0">
            <div className="text-lg sm:text-xl font-bold text-amber-600 dark:text-amber-400">
              {stats.extraBooked}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Emergency buffer tickets
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 3. Hourly Slots Booking Matrix                       */}
      {/* ---------------------------------------------------- */}
      {slots.length === 0 ? (
        <Card className="p-10 text-center border-dashed border-border/80">
          <Clock className="size-8 mx-auto text-muted-foreground mb-2" />
          <p className="font-bold text-sm text-foreground">
            No Therapy Slots Operating on {dayOfWeek}
          </p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Check the admin slots configuration or select another date.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {slots.map((slot) => {
            const { telemetry, appointments = [] } = slot;
            const filteredAppointments = appointments.filter((a) => {
              if (!filterQuery.trim()) return true;
              const q = filterQuery.toLowerCase();
              return (
                a.patient?.name?.toLowerCase().includes(q) ||
                a.patient?.phone?.includes(q)
              );
            });

            return (
              <Card
                key={slot.id}
                className="border-border/80 bg-card/90 shadow-2xs hover:border-border transition-all flex flex-col justify-between overflow-hidden"
              >
                {/* Slot Card Header */}
                <CardHeader className="p-2.5 pb-2 border-b border-border/60 bg-muted/15 flex flex-row items-start justify-between space-y-0 gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.2 rounded bg-muted border border-border text-[9.5px] font-mono font-bold">
                        Slot #{String(slot.order || 1).padStart(2, "0")}
                      </span>
                      <h3 className="text-xs font-bold text-foreground">
                        {slot.label}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
                      <Clock className="size-2.5 text-primary/70" />
                      <span>
                        {slot.startTime} — {slot.endTime}
                      </span>
                      {slot.room && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-0.5 text-foreground font-sans font-medium">
                            <DoorOpen className="size-2.5 text-blue-500" />R
                            {slot.room.number}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Slot Status Badge & Quick Book */}
                  <div className="flex items-center gap-1.5">
                    {telemetry.isCompletelyFull ? (
                      <span className="px-1.5 py-0.2 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[9.5px] font-bold">
                        Full
                      </span>
                    ) : telemetry.isMaleRegularFull &&
                      telemetry.isFemaleRegularFull ? (
                      <span className="px-1.5 py-0.2 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[9.5px] font-bold">
                        Standby Only
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[9.5px] font-bold">
                        Available
                      </span>
                    )}

                    <Button
                      size="sm"
                      onClick={() => onBookSlot(slot.id)}
                      disabled={telemetry.isCompletelyFull}
                      className="h-6 text-[11px] px-2 gap-1 font-semibold cursor-pointer shadow-2xs"
                    >
                      <Plus className="size-2.5" />
                      <span>Book</span>
                    </Button>
                  </div>
                </CardHeader>

                {/* Quota Progress Meters */}
                <CardContent className="p-2.5 space-y-2 flex-1">
                  <div className="grid grid-cols-2 gap-2">
                    {/* Male Meter */}
                    <div className="p-2 rounded-lg bg-sky-500/5 border border-sky-500/15 space-y-1">
                      <div className="flex items-center justify-between text-[10.5px]">
                        <span className="font-semibold text-sky-700 dark:text-sky-300 flex items-center gap-1">
                          <span className="size-1.5 rounded-full bg-sky-500" />
                          Male Quota
                        </span>
                        <span className="font-mono font-bold text-foreground">
                          {telemetry.maleTotalBooked} /{" "}
                          {slot.regularMaleCapacity}
                        </span>
                      </div>
                      {/* Meter Bar */}
                      <div className="h-1.5 w-full bg-sky-200/50 dark:bg-sky-950 rounded-full overflow-hidden flex">
                        <div
                          className="bg-sky-500 h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.min(
                              100,
                              (telemetry.maleRegularBooked /
                                slot.regularMaleCapacity) *
                                100,
                            )}%`,
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[9.5px] text-muted-foreground font-mono">
                        <span>
                          {slot.regularMaleCapacity -
                            telemetry.maleRegularBooked}{" "}
                          regular left
                        </span>
                        {telemetry.maleExtraBooked > 0 && (
                          <span className="text-amber-600 dark:text-amber-400 font-semibold">
                            +{telemetry.maleExtraBooked} extra
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Female Meter */}
                    <div className="p-2 rounded-lg bg-pink-500/5 border border-pink-500/15 space-y-1">
                      <div className="flex items-center justify-between text-[10.5px]">
                        <span className="font-semibold text-pink-700 dark:text-pink-300 flex items-center gap-1">
                          <span className="size-1.5 rounded-full bg-pink-500" />
                          Female Quota
                        </span>
                        <span className="font-mono font-bold text-foreground">
                          {telemetry.femaleTotalBooked} /{" "}
                          {slot.regularFemaleCapacity}
                        </span>
                      </div>
                      {/* Meter Bar */}
                      <div className="h-1.5 w-full bg-pink-200/50 dark:bg-pink-950 rounded-full overflow-hidden flex">
                        <div
                          className="bg-pink-500 h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.min(
                              100,
                              (telemetry.femaleRegularBooked /
                                slot.regularFemaleCapacity) *
                                100,
                            )}%`,
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[9.5px] text-muted-foreground font-mono">
                        <span>
                          {slot.regularFemaleCapacity -
                            telemetry.femaleRegularBooked}{" "}
                          regular left
                        </span>
                        {telemetry.femaleExtraBooked > 0 && (
                          <span className="text-amber-600 dark:text-amber-400 font-semibold">
                            +{telemetry.femaleExtraBooked} extra
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Booked Patient Queue List */}
                  <div className="space-y-1 pt-0.5">
                    <div className="flex items-center justify-between text-[10.5px] font-semibold text-muted-foreground">
                      <span>
                        Booked Tickets ({filteredAppointments.length}):
                      </span>
                    </div>

                    {filteredAppointments.length === 0 ? (
                      <div className="p-2.5 rounded-lg border border-dashed border-border/60 text-center text-[11px] text-muted-foreground">
                        No tickets issued for this slot yet.
                      </div>
                    ) : (
                      <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
                        {filteredAppointments.map((apt) => {
                          const isCalling =
                            apt.status === AppointmentStatus.CALLING;
                          const isServing =
                            apt.status === AppointmentStatus.IN_CONSULTATION ||
                            apt.status === AppointmentStatus.IN_THERAPY;
                          const isCompleted =
                            apt.status === AppointmentStatus.COMPLETED;
                          const isCancelled =
                            apt.status === AppointmentStatus.CANCELLED;
                          const isCheckedIn =
                            apt.status === AppointmentStatus.CHECKED_IN;
                          const isExtra = apt.bookingType === BookingType.EXTRA;
                          const isExtraPending =
                            isExtra &&
                            apt.extraStatus === ExtraApprovalStatus.PENDING;
                          const isExtraApproved =
                            isExtra &&
                            apt.extraStatus === ExtraApprovalStatus.APPROVED;
                          const isExtraRejected =
                            isExtra &&
                            apt.extraStatus === ExtraApprovalStatus.REJECTED;

                          return (
                            <div
                              key={apt.id}
                              className={`flex flex-col gap-1 p-2 rounded-lg border text-[11px] transition-colors ${
                                isCalling
                                  ? "bg-sky-500/10 border-sky-500/40 shadow-xs ring-1 ring-sky-500/30 animate-pulse"
                                  : isServing
                                    ? "bg-purple-500/5 border-purple-500/25"
                                    : isCheckedIn
                                      ? "bg-emerald-500/5 border-emerald-500/20"
                                      : isExtraPending
                                        ? "bg-amber-500/5 border-amber-500/30"
                                        : isExtraRejected
                                          ? "bg-rose-500/5 border-rose-500/30 opacity-70"
                                          : "bg-background border-border/60 hover:border-border"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1.5">
                                {/* Gender & Patient Name */}
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span
                                    className={`font-mono font-bold text-[10px] px-1.5 py-0.2 rounded shrink-0 ${
                                      apt.gender === "MALE"
                                        ? "bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/20"
                                        : "bg-pink-500/15 text-pink-700 dark:text-pink-300 border border-pink-500/20"
                                    }`}
                                  >
                                    {apt.gender === "MALE" ? "M" : "F"}
                                  </span>

                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1 flex-wrap">
                                      <span className="font-semibold text-foreground truncate">
                                        {apt.patient?.name}
                                      </span>
                                      {apt.toldTime && (
                                        <span
                                          className="px-1 py-0.2 rounded bg-primary/10 text-primary border border-primary/20 text-[9px] font-mono font-bold shrink-0"
                                          title="Patient Told Arrival Time"
                                        >
                                          Told: {apt.toldTime}
                                        </span>
                                      )}
                                      {apt.paymentStatus === "PAID" ? (
                                        <span
                                          className="px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[9px] font-mono font-bold shrink-0"
                                          title="Bill Cleared"
                                        >
                                          ৳{apt.feeAmount ?? 500} Paid
                                        </span>
                                      ) : (
                                        <span
                                          className="px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[9px] font-mono font-bold shrink-0"
                                          title="Bill Due"
                                        >
                                          ৳{apt.feeAmount ?? 500} Due
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[9.5px] text-muted-foreground font-mono block">
                                      {apt.patient?.phone}
                                    </span>
                                  </div>
                                </div>

                                {/* Actions: Status badge or Check-in, Cancel */}
                                <div className="flex items-center gap-1 shrink-0">
                                  {isCalling ? (
                                    <span
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/40 text-[9.5px] font-black shadow-2xs animate-pulse"
                                      title="Doctor is currently calling patient to chamber"
                                    >
                                      <Megaphone className="size-2.5 text-sky-600 dark:text-sky-400 animate-bounce" />
                                      <span>
                                        Calling{" "}
                                        {apt.room?.number
                                          ? `• Rm ${apt.room.number}`
                                          : "Dr."}
                                      </span>
                                    </span>
                                  ) : isServing ? (
                                    <span
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 text-[9.5px] font-bold shadow-2xs"
                                      title={
                                        apt.status ===
                                        AppointmentStatus.IN_CONSULTATION
                                          ? "In Doctor Consultation"
                                          : "In Physical Therapy"
                                      }
                                    >
                                      {apt.status ===
                                      AppointmentStatus.IN_CONSULTATION ? (
                                        <Stethoscope className="size-2.5 text-purple-600 dark:text-purple-400" />
                                      ) : (
                                        <Activity className="size-2.5 text-amber-600 dark:text-amber-400" />
                                      )}
                                      <span>
                                        {apt.status ===
                                        AppointmentStatus.IN_CONSULTATION
                                          ? `Consulting ${apt.room?.number ? `• Rm ${apt.room.number}` : ""}`
                                          : "In Therapy"}
                                      </span>
                                    </span>
                                  ) : isCompleted ? (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/80 text-[9.5px] font-medium">
                                      <CheckCircle2 className="size-2.5 text-muted-foreground" />
                                      <span>Done</span>
                                    </span>
                                  ) : isCancelled ? (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 text-[9.5px] font-medium">
                                      <X className="size-2.5" />
                                      <span>Cancelled</span>
                                    </span>
                                  ) : isCheckedIn ? (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[9.5px] font-bold shadow-2xs">
                                      <CheckCircle2 className="size-2.5 text-emerald-600 dark:text-emerald-400" />
                                      <span>Checked In</span>
                                      {apt.checkInTime && (
                                        <span className="font-mono text-[9px] font-bold text-emerald-800 dark:text-emerald-200">
                                          • {formatCheckInTime(apt.checkInTime)}
                                        </span>
                                      )}
                                    </span>
                                  ) : isExtraPending ? (
                                    <span
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[9.5px] font-semibold"
                                      title="Doctor authorization required before check-in"
                                    >
                                      <Clock className="size-2.5" />
                                      <span>Needs Dr.</span>
                                    </span>
                                  ) : isExtraRejected ? (
                                    <span
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 text-[9.5px] font-semibold"
                                      title="Extra slot was rejected by doctor"
                                    >
                                      <X className="size-2.5" />
                                      <span>Rejected</span>
                                    </span>
                                  ) : (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-5.5 text-[9.5px] px-1.5 gap-1 cursor-pointer"
                                      onClick={() => onCheckIn(apt.id)}
                                      title="Mark Checked In"
                                    >
                                      <CheckCircle2 className="size-2.5 text-emerald-500" />
                                      <span>Check In</span>
                                    </Button>
                                  )}

                                  {!isCompleted &&
                                    !isCancelled &&
                                    !isServing && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-5.5 text-muted-foreground hover:text-destructive cursor-pointer"
                                        onClick={() =>
                                          onCancelAppointment(apt.id)
                                        }
                                        title="Cancel Ticket"
                                      >
                                        <X className="size-2.5" />
                                      </Button>
                                    )}
                                </div>
                              </div>

                              {/* Standby Extra Status & Doctor Notes Banner */}
                              {isExtra && (
                                <div className="mt-0.5 pt-1 border-t border-border/40 text-[10px] space-y-0.5">
                                  <div className="flex items-center gap-1 flex-wrap">
                                    {isExtraPending && (
                                      <span className="px-1.5 py-0.2 rounded-md bg-amber-500/15 text-amber-800 dark:text-amber-200 border border-amber-500/30 font-bold">
                                        ⏳ Awaiting Dr. Approval
                                      </span>
                                    )}
                                    {isExtraApproved && (
                                      <span className="px-1.5 py-0.2 rounded-md bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border border-emerald-500/30 font-bold">
                                        ✓ Extra Approved
                                      </span>
                                    )}
                                    {isExtraRejected && (
                                      <span className="px-1.5 py-0.2 rounded-md bg-rose-500/15 text-rose-800 dark:text-rose-200 border border-rose-500/30 font-bold">
                                        ✕ Extra Rejected
                                      </span>
                                    )}
                                    {apt.extraReason && (
                                      <span className="text-muted-foreground italic">
                                        Rec: &ldquo;{apt.extraReason}&rdquo;
                                      </span>
                                    )}
                                  </div>

                                  {apt.extraApprovalNote && (
                                    <div className="text-foreground/90 font-medium pl-1 flex items-center gap-1">
                                      <span className="font-bold text-[9.5px] text-primary">
                                        Dr Note:
                                      </span>
                                      <span className="italic">
                                        &ldquo;{apt.extraApprovalNote}&rdquo;
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
