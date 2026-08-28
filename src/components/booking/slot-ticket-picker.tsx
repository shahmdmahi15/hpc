"use client";

import * as React from "react";
import { HourlySlot } from "@/generated/prisma/enums";
import { getDailySlotAvailability } from "@/actions/serials";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Ticket } from "lucide-react";

export interface SlotTicketPickerProps {
  selectedSlot: HourlySlot | string;
  selectedTime: string; // e.g. "14:20" or "02:20 PM"
  selectedDate: string; // "YYYY-MM-DD"
  onSlotSelect: (
    slot: HourlySlot | string,
    toldTime: string,
    timeSlotLabel: string,
  ) => void;
  disabled?: boolean;
  error?: string;
  className?: string;
}

export function SlotTicketPicker({
  selectedSlot,
  selectedTime,
  selectedDate,
  onSlotSelect,
  disabled = false,
  error,
  className = "",
}: SlotTicketPickerProps) {
  const [availability, setAvailability] = React.useState<Awaited<
    ReturnType<typeof getDailySlotAvailability>
  > | null>(null);

  React.useEffect(() => {
    let isMounted = true;
    getDailySlotAvailability(selectedDate)
      .then((res) => {
        if (isMounted) setAvailability(res);
      })
      .catch((err) => {
        console.error("Failed to load slot availability", err);
      });
    return () => {
      isMounted = false;
    };
  }, [selectedDate]);

  const slots = React.useMemo(() => availability?.slots || [], [availability]);

  // Selected slot availability object
  const currentSlotData = React.useMemo(() => {
    if (!slots.length) return null;
    return (
      slots.find((s) => s.slotCode === selectedSlot) ||
      slots.find((s) => s.isActive) ||
      slots[0] ||
      null
    );
  }, [slots, selectedSlot]);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header with Slot Stats */}
      <div className="flex items-center justify-between">
        <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
          <Ticket className="h-3.5 w-3.5 text-primary" />
          <span>Appointment Time Slot</span>
        </Label>
        {availability && (
          <span className="text-[11px] font-mono font-semibold text-muted-foreground flex items-center gap-1">
            <span className="text-primary font-bold">
              {availability.stats.totalBooked}
            </span>
            /{availability.stats.totalCapacity} Booked Today (
            {availability.stats.totalRemaining} Left)
          </span>
        )}
      </div>

      {/* Dynamic Hourly Slots Matrix */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {slots.map((slot) => {
          const booked = slot.bookedCount;
          const maxCapacity = slot.maxCapacity;
          const isFull = slot.isSoldOut;
          const isSelected =
            selectedSlot === slot.slotCode ||
            (currentSlotData && currentSlotData.slotCode === slot.slotCode);

          // Status colors
          let statusBadgeColor =
            "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
          let statusLabel = `${slot.remainingSeats} Seats`;

          if (isFull) {
            statusBadgeColor =
              "bg-destructive/10 text-destructive border-destructive/20";
            statusLabel = "FULL";
          } else if (slot.isFillingFast) {
            statusBadgeColor =
              "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
            statusLabel = `${slot.remainingSeats} Left`;
          }

          return (
            <button
              key={slot.id || slot.slotCode}
              type="button"
              disabled={disabled || !slot.isActive}
              onClick={() => {
                const firstFreeSeat = slot.seatTokens.find(
                  (st) => !st.isBooked,
                );
                const targetTime = firstFreeSeat
                  ? `${slot.startTime.split(" ")[0]}`
                  : slot.startTime;
                onSlotSelect(
                  slot.slotCode as HourlySlot | string,
                  targetTime,
                  slot.label,
                );
              }}
              className={`p-2 sm:p-2.5 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between min-h-[60px] min-w-0 w-full ${
                !slot.isActive
                  ? "border-border/40 bg-muted/20 opacity-50 cursor-not-allowed"
                  : isSelected
                    ? "border-primary bg-primary/10 shadow-xs ring-2 ring-primary/30"
                    : isFull
                      ? "border-border/60 bg-muted/40 opacity-70 hover:opacity-100 hover:border-border"
                      : "border-border bg-card hover:border-primary/50 hover:bg-muted/30"
              }`}
            >
              <div className="flex items-center justify-between w-full gap-1 min-w-0">
                <span className="text-[11px] font-bold text-foreground truncate">
                  {slot.label.split(" - ")[0]}
                </span>
                <span
                  className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md border shrink-0 ${statusBadgeColor}`}
                >
                  {statusLabel}
                </span>
              </div>

              {/* Mini Visual Bed / Token Dots */}
              <div className="flex items-center gap-1 mt-1.5 w-full">
                {Array.from({ length: maxCapacity }).map((_, idx) => {
                  const isSeatBooked = booked > idx;
                  return (
                    <span
                      key={idx}
                      className={`h-1.5 sm:h-2 flex-1 rounded-sm transition-all ${
                        isSeatBooked
                          ? "bg-primary"
                          : isSelected
                            ? "bg-primary/20 border border-primary/40"
                            : "bg-muted-foreground/20"
                      }`}
                      title={
                        isSeatBooked
                          ? `Ticket #${idx + 1} Booked`
                          : `Ticket #${idx + 1} Available`
                      }
                    />
                  );
                })}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Slot's Ticket Tokens Map */}
      {currentSlotData && (
        <div className="p-3 rounded-2xl border border-primary/30 bg-primary/5 space-y-2.5 animate-fadeIn">
          <div className="flex items-center justify-between flex-wrap gap-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-primary uppercase">
                {currentSlotData.label}
              </span>
              <Badge
                variant={currentSlotData.isSoldOut ? "destructive" : "default"}
                className="text-[10px] font-bold"
              >
                {currentSlotData.bookedCount}/{currentSlotData.maxCapacity}{" "}
                Tickets Booked
              </Badge>
            </div>
            <span className="text-[10px] text-muted-foreground">
              Pick arrival ticket token ({currentSlotData.intervalMinutes}-min
              intervals)
            </span>
          </div>

          {/* Seat Tokens Map */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {currentSlotData.seatTokens.map((seat) => {
              const tokenTime = `${currentSlotData.startTime} (+${(seat.seatNumber - 1) * currentSlotData.intervalMinutes}m)`;
              const isSelectedTime =
                selectedTime === tokenTime ||
                (seat.seatNumber === 1 && !selectedTime);

              return (
                <button
                  key={seat.seatNumber}
                  type="button"
                  onClick={() => {
                    onSlotSelect(
                      currentSlotData.slotCode as HourlySlot | string,
                      tokenTime,
                      currentSlotData.label,
                    );
                  }}
                  className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between min-w-0 w-full ${
                    seat.isBooked
                      ? "border-border bg-muted/60 text-muted-foreground cursor-not-allowed"
                      : isSelectedTime
                        ? "border-primary bg-primary text-primary-foreground shadow-md ring-2 ring-primary/40"
                        : "border-primary/40 bg-card hover:bg-primary/10 text-foreground"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[10px] font-mono font-black">
                      #{seat.seatNumber}
                    </span>
                    {seat.isBooked ? (
                      <span className="text-[9px] font-bold px-1 rounded bg-destructive/10 text-destructive">
                        Booked
                      </span>
                    ) : (
                      <span
                        className={`text-[9px] font-bold px-1 rounded ${
                          isSelectedTime
                            ? "bg-primary-foreground/20 text-primary-foreground"
                            : "bg-emerald-500/10 text-emerald-600"
                        }`}
                      >
                        Free
                      </span>
                    )}
                  </div>

                  <div className="mt-1">
                    <div className="text-xs font-bold font-mono">
                      Token #{seat.seatNumber}
                    </div>
                    {seat.serial ? (
                      <div
                        className="text-[10px] truncate text-muted-foreground mt-0.5"
                        title={seat.serial.patientName}
                      >
                        #{seat.serial.serialNumber} {seat.serial.patientName}
                      </div>
                    ) : (
                      <div className="text-[9px] opacity-80 mt-0.5">
                        Available Ticket
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {currentSlotData.isSoldOut && (
            <p className="text-[11px] text-destructive flex items-center gap-1.5 pt-1">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>
                All {currentSlotData.maxCapacity} patient tickets are filled for
                this slot. Please select an adjacent available time slot.
              </span>
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="text-[11px] text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
