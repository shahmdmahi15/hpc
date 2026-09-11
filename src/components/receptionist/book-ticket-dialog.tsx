"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Ticket,
  Search,
  User,
  Clock,
  Calendar,
  UserPlus,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  X,
} from "lucide-react";
import { Gender, BookingType } from "@/generated/prisma/enums";
import { searchPatientsAction } from "@/actions/receptionist/patient.action";
import { bookTherapyTicketAction } from "@/actions/receptionist/appointment.action";
import { ReceptionistPerformerSelect } from "@/components/receptionist/receptionist-performer-select";
import { toast } from "sonner";

import type {
  PatientWithCount,
  SlotWithTelemetry,
  AppointmentWithRelations,
} from "@/actions/receptionist/appointment.action";
import type { PatientModel } from "@/generated/prisma/models";

interface BookTicketDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  slots: SlotWithTelemetry[];
  selectedDate: string;
  preselectedSlotId?: string;
  preselectedPatient?: PatientWithCount | null;
  performers: { id: string; name: string; phone: string }[];
  activePerformerId?: string;
  onTicketBooked: (appointment: AppointmentWithRelations) => void;
  onOpenRegisterPatient: () => void;
}

const HOUR_ITEMS = [
  { value: "01", label: "01" },
  { value: "02", label: "02" },
  { value: "03", label: "03" },
  { value: "04", label: "04" },
  { value: "05", label: "05" },
  { value: "06", label: "06" },
  { value: "07", label: "07" },
  { value: "08", label: "08" },
  { value: "09", label: "09" },
  { value: "10", label: "10" },
  { value: "11", label: "11" },
  { value: "12", label: "12" },
] as const;

const MINUTE_ITEMS = [
  { value: "00", label: "00" },
  { value: "05", label: "05" },
  { value: "10", label: "10" },
  { value: "15", label: "15" },
  { value: "20", label: "20" },
  { value: "25", label: "25" },
  { value: "30", label: "30" },
  { value: "35", label: "35" },
  { value: "40", label: "40" },
  { value: "45", label: "45" },
  { value: "50", label: "50" },
  { value: "55", label: "55" },
] as const;

export function BookTicketDialog({
  isOpen,
  onOpenChange,
  slots,
  selectedDate,
  preselectedSlotId,
  preselectedPatient,
  performers,
  activePerformerId,
  onTicketBooked,
  onOpenRegisterPatient,
}: BookTicketDialogProps) {
  // Patient state
  const [selectedPatient, setSelectedPatient] = React.useState<
    PatientModel | PatientWithCount | null
  >(() => preselectedPatient || null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<PatientModel[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);

  // Slot & Booking state
  const [slotId, setSlotId] = React.useState<string>(
    () => preselectedSlotId || slots[0]?.id || "",
  );
  const [appointmentDate, setAppointmentDate] =
    React.useState<string>(selectedDate);
  const [notes, setNotes] = React.useState("");
  const [extraReason, setExtraReason] = React.useState("");
  const [bookedById, setBookedById] = React.useState<string>(
    () =>
      activePerformerId || (performers.length === 1 ? performers[0].id : ""),
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Told Time (with AM / PM) state
  const [toldHour, setToldHour] = React.useState("10");
  const [toldMinute, setToldMinute] = React.useState("00");
  const [toldPeriod, setToldPeriod] = React.useState<"AM" | "PM">("AM");

  // Sync props on dialog open (render-time adjustment)
  const [prevOpen, setPrevOpen] = React.useState(isOpen);
  if (isOpen !== prevOpen) {
    setPrevOpen(isOpen);
    if (isOpen) {
      if (preselectedPatient) {
        setSelectedPatient(preselectedPatient);
      }
      if (preselectedSlotId) {
        setSlotId(preselectedSlotId);
      } else if (slots.length > 0 && !slotId) {
        setSlotId(slots[0].id);
      }
      setAppointmentDate(selectedDate);
      setBookedById(
        activePerformerId || (performers.length === 1 ? performers[0].id : ""),
      );
      setExtraReason("");
      setNotes("");
    }
  }

  // Debounced patient search
  React.useEffect(() => {
    if (!isOpen || selectedPatient) return;
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await searchPatientsAction(searchQuery);
        setSearchResults(res);
      } finally {
        setIsSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, isOpen, selectedPatient]);

  const selectedSlot = slots.find((s) => s.id === slotId);

  // Sync told time when selected slot changes (render-time adjustment)
  const [prevSlotStartTime, setPrevSlotStartTime] = React.useState(
    selectedSlot?.startTime,
  );
  if (selectedSlot?.startTime !== prevSlotStartTime) {
    setPrevSlotStartTime(selectedSlot?.startTime);
    if (selectedSlot?.startTime) {
      const [hStr, mStr] = selectedSlot.startTime.split(":");
      const hNum = parseInt(hStr, 10);
      if (!isNaN(hNum)) {
        const period: "AM" | "PM" = hNum >= 12 ? "PM" : "AM";
        const h12 = hNum % 12 === 0 ? 12 : hNum % 12;
        setToldHour(String(h12).padStart(2, "0"));
        setToldMinute(mStr || "00");
        setToldPeriod(period);
      }
    }
  }

  // Quick Time Presets derived from slot start time
  const quickTimePresets = React.useMemo(() => {
    if (!selectedSlot?.startTime) return [];
    const [hStr] = selectedSlot.startTime.split(":");
    const hNum = parseInt(hStr, 10);
    if (isNaN(hNum)) return [];

    const period: "AM" | "PM" = hNum >= 12 ? "PM" : "AM";
    const h12 = hNum % 12 === 0 ? 12 : hNum % 12;
    const hourStr = String(h12).padStart(2, "0");

    return [
      { label: `${hourStr}:00 ${period}`, hour: hourStr, minute: "00", period },
      { label: `${hourStr}:15 ${period}`, hour: hourStr, minute: "15", period },
      { label: `${hourStr}:30 ${period}`, hour: hourStr, minute: "30", period },
      { label: `${hourStr}:45 ${period}`, hour: hourStr, minute: "45", period },
    ];
  }, [selectedSlot]);

  const toldTime = `${toldHour}:${toldMinute} ${toldPeriod}`;

  // Mapped items for Base UI select value label resolution
  const slotItems = React.useMemo(
    () =>
      slots.map((s) => ({
        value: s.id,
        label: `${s.label}${s.room ? ` (Room ${s.room.number})` : ""}`,
      })),
    [slots],
  );

  // Compute live quota availability for selected patient's gender
  const quotaInfo = React.useMemo(() => {
    if (!selectedSlot || !selectedPatient) return null;

    const isMale = selectedPatient.gender === Gender.MALE;
    const regularLimit = isMale
      ? selectedSlot.regularMaleCapacity
      : selectedSlot.regularFemaleCapacity;
    const extraLimit = isMale
      ? selectedSlot.extraMaleCapacity
      : selectedSlot.extraFemaleCapacity;
    const currentBooked = isMale
      ? selectedSlot.telemetry?.maleTotalBooked || 0
      : selectedSlot.telemetry?.femaleTotalBooked || 0;

    const isRegularAvailable = currentBooked < regularLimit;
    const isExtraAvailable =
      !isRegularAvailable && currentBooked < regularLimit + extraLimit;
    const isFull = !isRegularAvailable && !isExtraAvailable;

    return {
      isMale,
      regularLimit,
      extraLimit,
      currentBooked,
      isRegularAvailable,
      isExtraAvailable,
      isFull,
    };
  }, [selectedSlot, selectedPatient]);

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPatient) {
      toast.error("Please select or register a patient first.");
      return;
    }

    if (!slotId) {
      toast.error("Please select a therapy time slot.");
      return;
    }

    if (quotaInfo?.isFull) {
      toast.error("Selected slot is completely full for this gender.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await bookTherapyTicketAction({
        patientId: selectedPatient.id,
        therapySlotId: slotId,
        appointmentDate,
        bookingType: quotaInfo?.isExtraAvailable
          ? BookingType.EXTRA
          : BookingType.REGULAR,
        extraReason: quotaInfo?.isExtraAvailable
          ? extraReason.trim() || undefined
          : undefined,
        toldTime,
        notes: notes || undefined,
        bookedById: bookedById || undefined,
      });

      if (res.success && res.appointment) {
        toast.success(res.message);
        onTicketBooked(res.appointment);
        onOpenChange(false);
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("An unexpected error occurred while booking the ticket.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-xl md:max-w-2xl max-h-[min(94vh,760px)] flex flex-col p-0 overflow-hidden border-border/80 shadow-2xl rounded-2xl">
        {/* Header */}
        <DialogHeader className="p-5 pb-4 border-b border-border/60 shrink-0 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <Ticket className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                Book Therapy Ticket / Serial
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Assign patient to hourly therapy slot with automated token
                generation and gender quota tracking.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form
          onSubmit={handleBook}
          className="flex flex-col flex-1 overflow-hidden"
        >
          <div className="p-5 overflow-y-auto space-y-4 flex-1">
            {/* 1. Patient Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <User className="size-3.5 text-primary" />
                  <span>Select Patient *</span>
                </Label>
                <button
                  type="button"
                  onClick={() => {
                    onOpenChange(false);
                    onOpenRegisterPatient();
                  }}
                  className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <UserPlus className="size-3" />
                  <span>+ Register New Patient</span>
                </button>
              </div>

              {selectedPatient ? (
                /* Selected Patient Pill */
                <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground">
                        {selectedPatient.name}
                      </span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                          selectedPatient.gender === "MALE"
                            ? "bg-sky-500/15 text-sky-600 dark:text-sky-400"
                            : "bg-pink-500/15 text-pink-600 dark:text-pink-400"
                        }`}
                      >
                        {selectedPatient.gender}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-mono">
                      Phone: {selectedPatient.phone}{" "}
                      {selectedPatient.mrn && `• MRN: ${selectedPatient.mrn}`}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
                    onClick={() => setSelectedPatient(null)}
                    title="Change Patient"
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              ) : (
                /* Patient Search Autocomplete Input */
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search patient by name, phone or MRN..."
                      className="pl-8 h-9 text-xs"
                      autoFocus
                    />
                    {isSearching && (
                      <Loader2 className="absolute right-2.5 top-2.5 size-3.5 animate-spin text-muted-foreground" />
                    )}
                  </div>

                  {searchResults.length > 0 && (
                    <div className="max-h-36 overflow-y-auto rounded-xl border border-border/70 bg-card divide-y divide-border/40 text-xs shadow-md">
                      {searchResults.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setSelectedPatient(p)}
                          className="w-full text-left p-2.5 hover:bg-muted/40 transition-colors flex items-center justify-between cursor-pointer"
                        >
                          <div>
                            <span className="font-semibold text-foreground">
                              {p.name}
                            </span>
                            <span className="text-muted-foreground text-[11px] ml-2 font-mono">
                              {p.phone}
                            </span>
                          </div>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              p.gender === "MALE"
                                ? "bg-sky-500/15 text-sky-600 dark:text-sky-400"
                                : "bg-pink-500/15 text-pink-600 dark:text-pink-400"
                            }`}
                          >
                            {p.gender}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2. Date & Therapy Slot Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-primary" />
                  <span>Scheduled Date *</span>
                </Label>
                <Input
                  type="date"
                  value={appointmentDate}
                  onChange={(e) => setAppointmentDate(e.target.value)}
                  required
                  className="h-9 text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Clock className="size-3.5 text-primary" />
                  <span>Therapy Slot *</span>
                </Label>
                <Select
                  items={slotItems}
                  value={slotId}
                  onValueChange={(val) => setSlotId(val || "")}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select hourly slot">
                      {(val: string | null) => {
                        const s = slotItems.find((item) => item.value === val);
                        return s ? s.label : "Select hourly slot";
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-48">
                    {slotItems.map((s) => (
                      <SelectItem
                        key={s.value}
                        value={s.value}
                        className="text-xs"
                      >
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 2.1 Told / Reporting Time Selector (with AM / PM) */}
            <div className="p-3.5 rounded-xl border border-border/80 bg-muted/20 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                  <Clock className="size-3.5 text-primary" />
                  <span>Patient Told / Arrival Time *</span>
                </Label>
                <span className="text-xs font-mono font-bold text-primary px-2.5 py-0.5 rounded-lg bg-primary/10 border border-primary/25 shadow-xs">
                  {toldTime}
                </span>
              </div>

              {/* Time Selector Controls (Hour, Minute, AM/PM) */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Hour */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground font-medium">
                    Hour:
                  </span>
                  <Select
                    items={HOUR_ITEMS}
                    value={toldHour}
                    onValueChange={(val) => val && setToldHour(val)}
                  >
                    <SelectTrigger className="w-[74px] h-9 text-xs font-mono font-bold bg-background">
                      <SelectValue placeholder="Hour">
                        {(val: string | null) => {
                          const h = HOUR_ITEMS.find(
                            (item) => item.value === val,
                          );
                          return h ? h.label : val || "Hour";
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="max-h-48">
                      {HOUR_ITEMS.map((h) => (
                        <SelectItem
                          key={h.value}
                          value={h.value}
                          className="text-xs font-mono"
                        >
                          {h.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <span className="font-bold text-muted-foreground text-sm">
                  :
                </span>

                {/* Minute */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground font-medium">
                    Min:
                  </span>
                  <Select
                    items={MINUTE_ITEMS}
                    value={toldMinute}
                    onValueChange={(val) => val && setToldMinute(val)}
                  >
                    <SelectTrigger className="w-[74px] h-9 text-xs font-mono font-bold bg-background">
                      <SelectValue placeholder="Min">
                        {(val: string | null) => {
                          const m = MINUTE_ITEMS.find(
                            (item) => item.value === val,
                          );
                          return m ? m.label : val || "Min";
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="max-h-48">
                      {MINUTE_ITEMS.map((m) => (
                        <SelectItem
                          key={m.value}
                          value={m.value}
                          className="text-xs font-mono"
                        >
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* AM / PM Segmented Toggle */}
                <div className="flex items-center rounded-lg border border-border/80 bg-background p-0.5 shadow-xs">
                  <button
                    type="button"
                    onClick={() => setToldPeriod("AM")}
                    className={`h-8 px-3 text-xs font-bold rounded-md transition-all cursor-pointer ${
                      toldPeriod === "AM"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    AM
                  </button>
                  <button
                    type="button"
                    onClick={() => setToldPeriod("PM")}
                    className={`h-8 px-3 text-xs font-bold rounded-md transition-all cursor-pointer ${
                      toldPeriod === "PM"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    PM
                  </button>
                </div>
              </div>

              {/* Slot-derived Quick Presets */}
              {quickTimePresets.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/50 text-[11px]">
                  <span className="text-muted-foreground text-[10.5px] font-semibold">
                    Presets:
                  </span>
                  {quickTimePresets.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setToldHour(preset.hour);
                        setToldMinute(preset.minute);
                        setToldPeriod(preset.period);
                      }}
                      className={`px-2 py-0.5 rounded-md font-mono text-[11px] font-semibold transition-all border cursor-pointer ${
                        toldHour === preset.hour &&
                        toldMinute === preset.minute &&
                        toldPeriod === preset.period
                          ? "bg-primary text-primary-foreground border-primary shadow-xs"
                          : "bg-background hover:bg-muted text-muted-foreground hover:text-foreground border-border/70"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Live Quota & Token Preview Card */}
            {selectedPatient && selectedSlot && quotaInfo && (
              <div className="p-3.5 rounded-xl border border-border/80 bg-muted/20 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5 text-emerald-500" />
                    Slot Quota Status for {selectedPatient.gender}:
                  </span>
                  <span className="font-mono text-xs font-bold text-foreground">
                    {quotaInfo.currentBooked} / {quotaInfo.regularLimit} regular
                    (+{quotaInfo.extraLimit} standby)
                  </span>
                </div>

                {/* Quota Booking Status */}
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-background border border-border/60">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold block">
                      Booking Status
                    </span>
                    <span className="text-sm font-bold font-mono text-foreground">
                      {quotaInfo.isRegularAvailable
                        ? "Regular Quota"
                        : quotaInfo.isExtraAvailable
                          ? "Standby Extra"
                          : "Unavailable"}
                    </span>
                  </div>

                  <div>
                    {quotaInfo.isRegularAvailable ? (
                      <span className="px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold">
                        Regular Slot Available
                      </span>
                    ) : quotaInfo.isExtraAvailable ? (
                      <span className="px-2 py-1 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center gap-1">
                        <AlertTriangle className="size-3" />
                        Standby Extra Quota
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded-md bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-bold">
                        Slot Fully Booked
                      </span>
                    )}
                  </div>
                </div>

                {quotaInfo.isExtraAvailable && (
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                        Standby Extra Note / Reason
                      </Label>
                      <span className="text-[10px] text-muted-foreground italic">
                        Optional
                      </span>
                    </div>
                    <Input
                      value={extraReason}
                      onChange={(e) => setExtraReason(e.target.value)}
                      placeholder="e.g. Urgent post-surgery rehabilitation (optional)"
                      className="h-8 text-xs bg-background"
                    />
                  </div>
                )}
              </div>
            )}

            {/* 4. Performer Attribution */}
            <ReceptionistPerformerSelect
              performers={performers}
              selectedPerformerId={bookedById}
              onSelectPerformerId={setBookedById}
              disabled={isSubmitting}
              label="Authorizing Receptionist / Desk Staff"
            />

            {/* 5. Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Clinical / Booking Notes (Optional)
              </Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Patient requires wheelchair assistance"
                className="h-9 text-xs"
              />
            </div>
          </div>

          {/* Footer */}
          <DialogFooter className="p-4 border-t border-border/60 bg-muted/10 shrink-0 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="cursor-pointer"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              size="sm"
              disabled={
                isSubmitting ||
                !selectedPatient ||
                !slotId ||
                quotaInfo?.isFull ||
                (performers.length > 0 && !bookedById)
              }
              className="gap-2 font-semibold cursor-pointer shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Issuing Ticket...</span>
                </>
              ) : (
                <>
                  <Ticket className="size-3.5" />
                  <span>Issue Serial Ticket</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
