"use client";

import * as React from "react";
import { useRealtime } from "@/hooks/use-realtime";
import { getDailySlotAvailability } from "@/actions/serials";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, Ticket, CheckCircle2 } from "lucide-react";

export function DailySlotScheduleMatrix({
  selectedDate,
}: {
  selectedDate: string;
}) {
  const [data, setData] = React.useState<Awaited<
    ReturnType<typeof getDailySlotAvailability>
  > | null>(null);

  const loadSlotData = React.useCallback(async () => {
    try {
      const res = await getDailySlotAvailability(selectedDate);
      setData(res);
    } catch (err) {
      console.error("Failed to load daily slot availability", err);
    }
  }, [selectedDate]);

  React.useEffect(() => {
    let isMounted = true;
    getDailySlotAvailability(selectedDate)
      .then((res) => {
        if (isMounted) setData(res);
      })
      .catch((err) => {
        console.error("Failed to load daily slot availability", err);
      });
    return () => {
      isMounted = false;
    };
  }, [selectedDate]);

  useRealtime({
    onRefresh: loadSlotData,
  });

  const slots = data?.slots || [];
  const stats = data?.stats || {
    totalSlots: slots.length,
    activeSlotsCount: slots.filter((s) => s.isActive).length,
    totalCapacity: 60,
    totalBooked: 0,
    totalRemaining: 60,
    soldOutSlotsCount: 0,
  };

  return (
    <div className="space-y-3">
      {/* Top Slot Summary Cards (Compact & High Density) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Card className="p-2 sm:p-2.5 shadow-xs border-border bg-card">
          <div className="flex items-center justify-between text-muted-foreground text-[10px] sm:text-[11px] font-semibold uppercase">
            <span>Total Active Slots</span>
            <Clock className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-lg sm:text-xl font-black mt-0.5 font-mono text-foreground">
            {stats.activeSlotsCount} Slots
          </p>
          <span className="text-[9px] sm:text-[10px] text-muted-foreground">
            Dynamic clinic schedule
          </span>
        </Card>

        <Card className="p-2 sm:p-2.5 shadow-xs border-border bg-card">
          <div className="flex items-center justify-between text-muted-foreground text-[10px] sm:text-[11px] font-semibold uppercase">
            <span>Slot Daily Capacity</span>
            <Ticket className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-lg sm:text-xl font-black mt-0.5 font-mono text-foreground">
            {stats.totalCapacity} Tickets
          </p>
          <span className="text-[9px] sm:text-[10px] text-muted-foreground">
            Configured max patients
          </span>
        </Card>

        <Card className="p-2 sm:p-2.5 shadow-xs border-border bg-card">
          <div className="flex items-center justify-between text-primary text-[10px] sm:text-[11px] font-semibold uppercase">
            <span>Booked Today</span>
            <Users className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-lg sm:text-xl font-black mt-0.5 font-mono text-primary">
            {stats.totalBooked} Booked
          </p>
          <span className="text-[9px] sm:text-[10px] text-muted-foreground">
            {stats.totalCapacity > 0
              ? Math.round((stats.totalBooked / stats.totalCapacity) * 100)
              : 0}
            % capacity filled
          </span>
        </Card>

        <Card className="p-2 sm:p-2.5 shadow-xs border-border bg-card">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-[10px] sm:text-[11px] font-semibold uppercase">
            <span>Available Seats</span>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <p className="text-lg sm:text-xl font-black mt-0.5 font-mono text-emerald-600 dark:text-emerald-400">
            {stats.totalRemaining} Open
          </p>
          <span className="text-[9px] sm:text-[10px] text-muted-foreground">
            Available for booking
          </span>
        </Card>
      </div>

      {/* Dynamic Hourly Slots Matrix View */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {slots.map((slot) => {
          const isFull = slot.isSoldOut;
          const booked = slot.bookedCount;

          return (
            <Card
              key={slot.id || slot.slotCode}
              className={`border transition-all shadow-xs ${
                !slot.isActive
                  ? "border-border/40 bg-muted/20 opacity-60"
                  : isFull
                    ? "border-destructive/30 bg-destructive/5"
                    : booked > 0
                      ? "border-primary/30 bg-card"
                      : "border-border bg-card"
              }`}
            >
              <CardHeader className="p-2.5 pb-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center px-1.5 h-6 rounded-md font-mono font-bold text-[11px] bg-primary/10 text-primary border border-primary/20">
                      {slot.slotCode}
                    </span>
                    <div>
                      <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <span>{slot.label}</span>
                        {slot.isVipOnly && (
                          <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-[9px] px-1 py-0 h-3.5">
                            VIP
                          </Badge>
                        )}
                      </div>
                      <span className="text-[9px] text-muted-foreground">
                        {slot.maxCapacity} Patient Seat Tokens (
                        {slot.intervalMinutes}m interval)
                      </span>
                    </div>
                  </div>

                  <Badge
                    variant={
                      !slot.isActive
                        ? "secondary"
                        : isFull
                          ? "destructive"
                          : booked > 0
                            ? "default"
                            : "outline"
                    }
                    className="text-[9px] font-bold px-1.5 py-0"
                  >
                    {!slot.isActive
                      ? "Inactive"
                      : `${booked}/${slot.maxCapacity} ${isFull ? "FULL" : "Booked"}`}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-2.5 pt-0.5 space-y-1.5">
                {/* Seat Cards Grid */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 pt-0.5">
                  {slot.seatTokens.map((seat) => (
                    <div
                      key={seat.seatNumber}
                      className={`p-1.5 rounded-md border text-center transition-all flex flex-col justify-between min-h-[46px] ${
                        seat.isBooked
                          ? "bg-primary/10 border-primary/40 text-foreground"
                          : "bg-muted/30 border-border/80 text-muted-foreground"
                      }`}
                    >
                      <div className="flex items-center justify-between text-[9px]">
                        <span className="font-mono font-bold">
                          #{seat.seatNumber}
                        </span>
                        {seat.isBooked ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        )}
                      </div>

                      <div className="mt-0.5">
                        {seat.serial ? (
                          <div className="text-[9px] font-bold text-foreground truncate">
                            #{seat.serial.serialNumber}{" "}
                            {seat.serial.patientName}
                          </div>
                        ) : (
                          <div className="text-[9px] text-muted-foreground">
                            Open
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Status Bar */}
                <div className="flex items-center justify-between text-[10px] pt-0.5 text-muted-foreground">
                  <span>
                    {isFull
                      ? "❌ Maximum capacity reached"
                      : `🟢 ${slot.remainingSeats} patient seat(s) available`}
                  </span>
                  {slot.notes && (
                    <span className="text-[9px] text-primary/80 font-medium">
                      {slot.notes}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
