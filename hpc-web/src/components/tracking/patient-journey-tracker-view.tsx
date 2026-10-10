"use client";

import * as React from "react";
import {
  type LiveTrackedPatient,
  type PatientStation,
  type PatientTrackingData,
  getLivePatientTrackingDataAction,
  transferPatientStationAction,
  quickCheckInWithoutSlotAction,
  quickCheckOutPatientAction,
} from "@/actions/tracking/tracking.action";
import { searchPatientsAction } from "@/actions/receptionist/patient.action";
import { QueueType } from "@/generated/prisma/enums";
import { useRealtimeEvents } from "@/hooks/use-realtime-events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Activity,
  ArrowRight,
  Banknote,
  CheckCircle2,
  Clock,
  Compass,
  CreditCard,
  DoorOpen,
  Eye,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Stethoscope,
  UserCheck,
  UserPlus,
  Users,
  Wifi,
} from "lucide-react";
import { toast } from "sonner";
import { formatTime12h, evaluatePunctuality } from "@/lib/queue-punctuality";

interface PatientJourneyTrackerViewProps {
  initialData?: PatientTrackingData;
  defaultDate?: string;
  showDateSelector?: boolean;
}

const STATION_CONFIG: Record<
  PatientStation,
  {
    label: string;
    shortLabel: string;
    description: string;
    icon: React.ElementType;
    badgeClass: string;
    pillClass: string;
    borderClass: string;
    bgHoverClass: string;
  }
> = {
  RECEPTIONIST_DESK: {
    label: "Public Waiting Lounge (Arrival Desk)",
    shortLabel: "Waiting Lounge",
    description: "Checked in & waiting in Public Waiting Lounge",
    icon: DoorOpen,
    badgeClass:
      "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30",
    pillClass: "bg-emerald-600 text-white",
    borderClass: "border-emerald-500/40",
    bgHoverClass: "hover:bg-emerald-500/10",
  },
  CONSULTATION_ROOM: {
    label: "Doctor Consultation Room",
    shortLabel: "Consultation",
    description: "In doctor chamber / consultation",
    icon: Stethoscope,
    badgeClass:
      "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
    pillClass: "bg-sky-500 text-white",
    borderClass: "border-sky-500/40",
    bgHoverClass: "hover:bg-sky-500/10",
  },
  CASHIER_REGISTER: {
    label: "Cashier Register",
    shortLabel: "Cashier Desk",
    description: "Billing, invoices & payment counter",
    icon: CreditCard,
    badgeClass:
      "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    pillClass: "bg-amber-500 text-white",
    borderClass: "border-amber-500/40",
    bgHoverClass: "hover:bg-amber-500/10",
  },
  THERAPY_ROOM: {
    label: "Physical Therapy Room",
    shortLabel: "Therapy Floor",
    description: "Under active rehabilitation / modalities",
    icon: Activity,
    badgeClass:
      "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
    pillClass: "bg-purple-600 text-white",
    borderClass: "border-purple-500/40",
    bgHoverClass: "hover:bg-purple-500/10",
  },
  CHECKED_OUT: {
    label: "Checked Out (Discharged)",
    shortLabel: "Discharged",
    description: "Completed visit & discharged",
    icon: CheckCircle2,
    badgeClass: "bg-muted text-muted-foreground border-border",
    pillClass: "bg-slate-500 text-white",
    borderClass: "border-border",
    bgHoverClass: "hover:bg-muted/50",
  },
};

export function PatientJourneyTrackerView({
  initialData,
  defaultDate,
  showDateSelector = true,
}: PatientJourneyTrackerViewProps) {
  const [data, setData] = React.useState<PatientTrackingData | null>(
    initialData || null,
  );
  const [selectedDate, setSelectedDate] = React.useState<string>(() => {
    if (defaultDate) return defaultDate;
    if (initialData?.selectedDate) return initialData.selectedDate;
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });

  const [isLoading, setIsLoading] = React.useState<boolean>(!initialData);
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [selectedStationFilter, setSelectedStationFilter] = React.useState<
    PatientStation | "ALL"
  >("ALL");

  // Transfer modal state
  const [transferPatient, setTransferTargetPatient] =
    React.useState<LiveTrackedPatient | null>(null);

  // Quick Check-in modal state
  const [isQuickCheckInOpen, setIsQuickCheckInOpen] =
    React.useState<boolean>(false);

  // Fetch / Refresh data
  const loadTrackingData = React.useCallback(
    async (dateToLoad: string, showToast = false) => {
      try {
        setIsLoading(true);
        const res = await getLivePatientTrackingDataAction(dateToLoad);
        setData(res);
        if (showToast) {
          toast.success("Patient tracking updated.");
        }
      } catch (err) {
        console.error("[Tracking Data Load Error]:", err);
        toast.error("Failed to load patient tracking data.");
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  React.useEffect(() => {
    if (!initialData) {
      loadTrackingData(selectedDate);
    }
  }, [selectedDate, initialData, loadTrackingData]);

  // Synchronize when parent passes a new defaultDate
  React.useEffect(() => {
    if (defaultDate && defaultDate !== selectedDate) {
      setSelectedDate(defaultDate);
      loadTrackingData(defaultDate);
    }
  }, [defaultDate, selectedDate, loadTrackingData]);

  // Real-time Event Subscription for 100% offline sync
  useRealtimeEvents({
    onEvent: (event) => {
      const type = (event?.type || "").toUpperCase();
      if (type !== "CHAT_MESSAGE_SENT" && type !== "CHAT_MESSAGE_DELETED") {
        loadTrackingData(selectedDate);
      }
    },
    onReconnect: () => {
      loadTrackingData(selectedDate);
    },
  });

  // Filtered patients
  const filteredPatients = React.useMemo(() => {
    if (!data?.patients) return [];
    let list = data.patients;

    if (selectedStationFilter !== "ALL") {
      list = list.filter((p) => p.currentStation === selectedStationFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.phone.includes(q) ||
          (p.mrn && p.mrn.toLowerCase().includes(q)) ||
          (p.doctorName && p.doctorName.toLowerCase().includes(q)) ||
          (p.roomNumber && p.roomNumber.toLowerCase().includes(q)),
      );
    }

    return list;
  }, [data?.patients, selectedStationFilter, searchQuery]);

  // 1-Click checkout loading indicator
  const [checkingOutPatientId, setCheckingOutPatientId] =
    React.useState<string | null>(null);

  // Handle direct 1-click Check Out
  const handleQuickCheckOut = async (patient: LiveTrackedPatient) => {
    if (patient.dueAmount > 0) {
      const confirmed = window.confirm(
        `Patient ${patient.name} has an unpaid balance of ৳${patient.dueAmount.toLocaleString()}. Are you sure you want to check out before billing is cleared?`,
      );
      if (!confirmed) return;
    }
    try {
      setCheckingOutPatientId(patient.id);
      const res = await quickCheckOutPatientAction(patient.id);
      if (res.success) {
        toast.success(`Patient ${patient.name} checked out.`);
        loadTrackingData(selectedDate);
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Failed to check out patient.");
    } finally {
      setCheckingOutPatientId(null);
    }
  };

  const stats = data?.stats || {
    totalPatients: 0,
    atReception: 0,
    inConsultation: 0,
    atCashier: 0,
    inTherapy: 0,
    checkedOut: 0,
  };

  return (
    <div className="w-full space-y-3 pb-8">
      {/* 1. Header & Live Indicator Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3.5 rounded-2xl bg-card/70 backdrop-blur-xl border border-border/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-sky-500/20 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 shrink-0">
            <Compass className="size-5 sm:size-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black tracking-tight text-foreground">
                Patient Journey & Station Tracking
              </h2>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live LAN Bus
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Real-time multi-counter tracking across Public Waiting Lounge, Doctor
              Chambers, Cashier &amp; Therapy without requiring slot assignments.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
          {/* Date Selector or Date Badge */}
          {showDateSelector ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-background border border-border text-xs font-medium">
              <Clock className="size-3.5 text-muted-foreground shrink-0" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  loadTrackingData(e.target.value);
                }}
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore="true"
                data-bwignore="true"
                data-form-type="other"
                className="bg-transparent text-xs font-semibold focus:outline-hidden cursor-pointer"
              />
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-muted/40 border border-border/70 text-xs font-medium text-muted-foreground">
              <Clock className="size-3.5 text-primary shrink-0" />
              <span className="font-mono text-[11px] font-semibold">{selectedDate}</span>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => loadTrackingData(selectedDate, true)}
            disabled={isLoading}
            className="h-8.5 px-2.5 rounded-xl text-xs font-semibold gap-1.5 cursor-pointer shadow-2xs hover:bg-muted"
          >
            <RefreshCw
              className={`size-3.5 ${isLoading ? "animate-spin" : ""}`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          <Button
            size="sm"
            onClick={() => setIsQuickCheckInOpen(true)}
            className="h-8.5 px-3 rounded-xl text-xs font-bold gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer shadow-xs"
          >
            <Plus className="size-3.5" />
            <span>+ Quick Check-in (Waiting Lounge)</span>
          </Button>
        </div>
      </div>

      {/* 2. Live Station Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5">
        {/* Total Metric */}
        <button
          type="button"
          onClick={() => setSelectedStationFilter("ALL")}
          className={`p-2.5 sm:p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1 shadow-2xs ${
            selectedStationFilter === "ALL"
              ? "border-primary bg-primary/10 ring-2 ring-primary/20 text-foreground"
              : "border-border/80 bg-card hover:bg-muted/50 text-foreground"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-muted-foreground">
              Total Today
            </span>
            <Users className="size-3.5 sm:size-4 text-primary shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-foreground">
            {stats.totalPatients}
          </div>
          <span className="text-[9.5px] sm:text-[10px] text-muted-foreground font-medium truncate">
            All registered visits
          </span>
        </button>

        {/* Public Waiting Lounge */}
        <button
          type="button"
          onClick={() => setSelectedStationFilter("RECEPTIONIST_DESK")}
          className={`p-2.5 sm:p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1 shadow-2xs ${
            selectedStationFilter === "RECEPTIONIST_DESK"
              ? "border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/20 text-emerald-950 dark:text-emerald-200"
              : "border-border/80 bg-card hover:bg-muted/50 text-foreground"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-emerald-700 dark:text-emerald-400 truncate">
              Waiting Lounge
            </span>
            <DoorOpen className="size-3.5 sm:size-4 text-emerald-500 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-emerald-600 dark:text-emerald-400">
            {stats.atReception}
          </div>
          <span className="text-[9.5px] sm:text-[10px] text-muted-foreground font-medium truncate">
            Checked in & waiting
          </span>
        </button>

        {/* Doctor Consultation */}
        <button
          type="button"
          onClick={() => setSelectedStationFilter("CONSULTATION_ROOM")}
          className={`p-2.5 sm:p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1 shadow-2xs ${
            selectedStationFilter === "CONSULTATION_ROOM"
              ? "border-sky-500 bg-sky-500/10 ring-2 ring-sky-500/20 text-sky-950 dark:text-sky-200"
              : "border-border/80 bg-card hover:bg-muted/50 text-foreground"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-sky-600 dark:text-sky-400">
              Doctor Rooms
            </span>
            <Stethoscope className="size-3.5 sm:size-4 text-sky-500 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-sky-600 dark:text-sky-400">
            {stats.inConsultation}
          </div>
          <span className="text-[9.5px] sm:text-[10px] text-muted-foreground font-medium truncate">
            In consultation
          </span>
        </button>

        {/* Cashier Register */}
        <button
          type="button"
          onClick={() => setSelectedStationFilter("CASHIER_REGISTER")}
          className={`p-2.5 sm:p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1 shadow-2xs ${
            selectedStationFilter === "CASHIER_REGISTER"
              ? "border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/20 text-amber-950 dark:text-amber-200"
              : "border-border/80 bg-card hover:bg-muted/50 text-foreground"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-amber-600 dark:text-amber-400">
              Cashier Register
            </span>
            <CreditCard className="size-3.5 sm:size-4 text-amber-500 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-amber-600 dark:text-amber-400">
            {stats.atCashier}
          </div>
          <span className="text-[9.5px] sm:text-[10px] text-muted-foreground font-medium truncate">
            Billing counter
          </span>
        </button>

        {/* Physical Therapy Floor */}
        <button
          type="button"
          onClick={() => setSelectedStationFilter("THERAPY_ROOM")}
          className={`p-2.5 sm:p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1 shadow-2xs ${
            selectedStationFilter === "THERAPY_ROOM"
              ? "border-purple-500 bg-purple-500/10 ring-2 ring-purple-500/20 text-purple-950 dark:text-purple-200"
              : "border-border/80 bg-card hover:bg-muted/50 text-foreground"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-purple-600 dark:text-purple-400">
              Therapy Floor
            </span>
            <Activity className="size-3.5 sm:size-4 text-purple-500 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-purple-600 dark:text-purple-400">
            {stats.inTherapy}
          </div>
          <span className="text-[9.5px] sm:text-[10px] text-muted-foreground font-medium truncate">
            Under rehabilitation
          </span>
        </button>

        {/* Checked Out */}
        <button
          type="button"
          onClick={() => setSelectedStationFilter("CHECKED_OUT")}
          className={`p-2.5 sm:p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1 shadow-2xs ${
            selectedStationFilter === "CHECKED_OUT"
              ? "border-slate-500 bg-slate-500/10 ring-2 ring-slate-500/20 text-foreground"
              : "border-border/80 bg-card hover:bg-muted/50 text-foreground"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-muted-foreground">
              Checked Out
            </span>
            <CheckCircle2 className="size-3.5 sm:size-4 text-slate-500 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-muted-foreground">
            {stats.checkedOut}
          </div>
          <span className="text-[9.5px] sm:text-[10px] text-muted-foreground font-medium truncate">
            Visit completed
          </span>
        </button>
      </div>

      {/* 3. Search & Live Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2 rounded-xl bg-card border border-border/80 shadow-2xs">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            name="journey_tracker_patient_search"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-lpignore="true"
            data-1p-ignore="true"
            data-form-type="other"
            placeholder="Search patient by name, phone, MRN, doctor or room..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 text-xs h-8.5 rounded-lg bg-background w-full"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar sm:flex-wrap pb-1 sm:pb-0">
          <span className="text-[11px] text-muted-foreground font-bold px-1 shrink-0">
            Station:
          </span>
          {(
            [
              "ALL",
              "RECEPTIONIST_DESK",
              "CONSULTATION_ROOM",
              "CASHIER_REGISTER",
              "THERAPY_ROOM",
              "CHECKED_OUT",
            ] as const
          ).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setSelectedStationFilter(st)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                selectedStationFilter === st
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {st === "ALL" ? "All Patients" : STATION_CONFIG[st].shortLabel}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Live Patient Grid */}
      {filteredPatients.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-card/40 space-y-3">
          <div className="size-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
            <Compass className="size-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-foreground">
              No patients found in this station
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              There are currently no patients tracked under the selected filter
              for {selectedDate}. Use "+ Quick Check-in" to check in a walk-in
              patient.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setIsQuickCheckInOpen(true)}
            className="h-8 text-xs font-semibold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
          >
            <Plus className="size-3.5" />
            <span>Check In Patient Now</span>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredPatients.map((patient) => {
            const stationCfg =
              STATION_CONFIG[patient.currentStation] ||
              STATION_CONFIG.RECEPTIONIST_DESK;
            const StationIcon = stationCfg.icon;
            const isCheckedOut = patient.currentStation === "CHECKED_OUT";

            return (
              <div
                key={patient.id}
                className={`p-4 rounded-2xl border bg-card/80 backdrop-blur-md shadow-xs flex flex-col justify-between gap-3.5 transition-all hover:shadow-md ${stationCfg.borderClass}`}
              >
                {/* Card Top: Patient Info & Station Badge */}
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-black text-foreground">
                          {patient.name}
                        </span>
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-muted text-muted-foreground">
                          {patient.gender}
                        </span>
                        {patient.mrn && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-muted/80 text-muted-foreground font-semibold">
                            {patient.mrn}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {patient.phone}
                      </div>
                    </div>

                    {/* Current Station Pill */}
                    <div
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border shrink-0 ${stationCfg.badgeClass}`}
                    >
                      <StationIcon className="size-3.5" />
                      <span>{stationCfg.shortLabel}</span>
                    </div>
                  </div>

                  {/* Badges / Routing Details */}
                  <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                    {/* Slot or Consultation Serial vs Walk-in */}
                    {patient.slotLabel ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/25 font-bold">
                        {patient.serialNumber ? (
                          <Stethoscope className="size-3" />
                        ) : (
                          <Clock className="size-3" />
                        )}
                        <span>{patient.slotLabel}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border font-medium">
                        <span>Walk-in (No Slot)</span>
                      </span>
                    )}

                    {/* Punctuality Indicator Badge */}
                    {patient.checkInTime && (
                      (() => {
                        const p = evaluatePunctuality(patient.toldTime, patient.checkInTime);
                        return (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${p.badgeClass}`}
                          >
                            <span className={`size-1.5 rounded-full ${p.dotClass}`} />
                            <span>{p.label}</span>
                          </span>
                        );
                      })()
                    )}

                    {/* Room / Waiting Lounge */}
                    {patient.currentStation === "RECEPTIONIST_DESK" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 font-mono font-bold">
                        <DoorOpen className="size-3 text-emerald-600 dark:text-emerald-400" />
                        <span>{patient.roomNumber ? `Waiting Room ${patient.roomNumber}` : "Waiting Lounge"}</span>
                      </span>
                    ) : patient.roomNumber ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20 font-mono font-bold">
                        <DoorOpen className="size-3" />
                        <span>Room {patient.roomNumber}</span>
                      </span>
                    ) : null}

                    {/* Status Marker (Forwarded to Cashier, Queued for Doctor, etc.) */}
                    {patient.statusMarker ? (
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[10.5px] border ${
                          patient.statusMarker.includes("Forwarded to Cashier")
                            ? "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30"
                            : "bg-indigo-500/15 text-indigo-800 dark:text-indigo-300 border-indigo-500/30"
                        }`}
                      >
                        <span>{patient.statusMarker}</span>
                      </span>
                    ) : patient.doctorName && !patient.slotLabel?.includes("Dr.") ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 font-medium">
                        <Stethoscope className="size-3" />
                        <span>Dr. {patient.doctorName}</span>
                      </span>
                    ) : patient.currentStation === "RECEPTIONIST_DESK" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground border border-border/50 text-[10.5px]">
                        <span>Waiting in Lounge</span>
                      </span>
                    ) : null}

                    {/* Elapsed Time */}
                    {patient.checkInTime && !isCheckedOut && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 font-mono text-[10.5px]">
                        <Clock className="size-3" />
                        <span>
                          {patient.elapsedMinutesSinceCheckIn !== null
                            ? `${patient.elapsedMinutesSinceCheckIn}m in clinic`
                            : `In: ${formatTime12h(patient.checkInTime)}`}
                        </span>
                      </span>
                    )}

                    {/* Checkout Time */}
                    {isCheckedOut && patient.checkOutTime && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/20 font-mono text-[10.5px]">
                        <CheckCircle2 className="size-3" />
                        <span>Out: {formatTime12h(patient.checkOutTime)}</span>
                      </span>
                    )}
                  </div>

                  {/* Financial / Billing Snapshot */}
                  <div className="flex items-center justify-between text-xs p-2 rounded-xl bg-muted/40 border border-border/50">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Banknote className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Fee: ৳{patient.feeAmount.toLocaleString()}</span>
                    </span>

                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-[11px] text-muted-foreground">
                        Paid: ৳{patient.paidAmount.toLocaleString()}
                      </span>
                      {patient.paymentStatus === "PENDING" && patient.paidAmount === 0 ? (
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                          {patient.feeAmount > 0
                            ? `PENDING (৳${patient.feeAmount.toLocaleString()})`
                            : "NO BILL YET"}
                        </span>
                      ) : patient.paymentStatus === "DUE" || patient.paymentStatus === "PARTIAL" || patient.dueAmount > 0 ? (
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                          DUE: ৳{patient.dueAmount.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                          PAID
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Notes if present */}
                  {patient.notes && (
                    <div className="text-[11px] text-amber-900 dark:text-amber-200 bg-amber-500/10 px-2.5 py-1.5 rounded-lg border border-amber-500/25 italic">
                      <span className="font-semibold not-italic">Note: </span>
                      <span>{patient.notes}</span>
                    </div>
                  )}
                </div>

                {/* Card Bottom: Station Transfer & Actions */}
                <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                  <div className="flex items-center gap-1.5 flex-1 min-w-[130px]">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setTransferTargetPatient(patient)}
                      className="h-8 px-2.5 text-xs font-semibold gap-1.5 border-primary/30 hover:bg-primary/10 text-primary cursor-pointer flex-1 justify-center"
                    >
                      <ArrowRight className="size-3.5" />
                      <span>Move Station...</span>
                    </Button>
                  </div>

                  {!isCheckedOut && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleQuickCheckOut(patient)}
                      disabled={checkingOutPatientId === patient.id}
                      title="Complete visit & check out patient"
                      className="h-8 px-2.5 text-xs font-bold gap-1 text-slate-600 dark:text-slate-400 hover:text-destructive hover:bg-destructive/10 cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      {checkingOutPatientId === patient.id ? (
                        <RefreshCw className="size-3.5 animate-spin" />
                      ) : (
                        <LogOut className="size-3.5" />
                      )}
                      <span>
                        {checkingOutPatientId === patient.id
                          ? "Checking out..."
                          : "Check Out"}
                      </span>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Transfer Station Dialog */}
      {transferPatient && (
        <TransferStationDialog
          isOpen={Boolean(transferPatient)}
          onOpenChange={(open) => {
            if (!open) setTransferTargetPatient(null);
          }}
          patient={transferPatient}
          rooms={data?.rooms || []}
          doctors={data?.doctors || []}
          onSuccess={() => {
            setTransferTargetPatient(null);
            loadTrackingData(selectedDate);
          }}
        />
      )}

      {/* 6. Quick Check-In Without Slot Dialog */}
      {isQuickCheckInOpen && (
        <QuickCheckInWithoutSlotDialog
          isOpen={isQuickCheckInOpen}
          onOpenChange={setIsQuickCheckInOpen}
          rooms={data?.rooms || []}
          doctors={data?.doctors || []}
          performers={data?.performers || []}
          onSuccess={() => {
            setIsQuickCheckInOpen(false);
            loadTrackingData(selectedDate);
          }}
        />
      )}
    </div>
  );
}

/**
 * Dialog to transfer patient seamlessly between clinic stations
 */
function TransferStationDialog({
  isOpen,
  onOpenChange,
  patient,
  rooms,
  doctors,
  onSuccess,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  patient: LiveTrackedPatient;
  rooms: PatientTrackingData["rooms"];
  doctors: {
    id: string;
    name: string | null;
    email: string | null;
    consultationFee: number;
  }[];
  onSuccess: () => void;
}) {
  const [targetStation, setTargetStation] = React.useState<PatientStation>(
    patient.currentStation,
  );
  const [selectedRoomId, setSelectedRoomId] = React.useState<string>(
    patient.roomId || "",
  );
  const [selectedDoctorId, setSelectedDoctorId] = React.useState<string>(
    patient.doctorId || "",
  );
  const [notes, setNotes] = React.useState<string>("");
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await transferPatientStationAction({
        appointmentId: patient.id,
        targetStation,
        roomId: selectedRoomId || undefined,
        doctorId: selectedDoctorId || undefined,
        notes: notes.trim() || undefined,
      });

      if (res.success) {
        toast.success(res.message);
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Failed to transfer patient station.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const stations: PatientStation[] = [
    "RECEPTIONIST_DESK",
    "CONSULTATION_ROOM",
    "CASHIER_REGISTER",
    "THERAPY_ROOM",
    "CHECKED_OUT",
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-lg max-h-[92dvh] flex flex-col p-0 overflow-hidden rounded-2xl border-border/80 shadow-2xl">
        <DialogHeader className="p-4 sm:p-5 pb-3 sm:pb-4 pr-12 sm:pr-14 border-b border-border/60 bg-muted/20 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <Compass className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Move Patient: {patient.name}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Transfer patient to any counter or room instantly.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 min-h-0 overflow-hidden"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-lpignore="true"
          data-1p-ignore="true"
          data-bwignore="true"
          data-form-type="other"
        >
          <div className="p-4 sm:p-5 space-y-4 overflow-y-auto overscroll-contain flex-1 min-h-0">
            {/* Target Station Radio Grid */}
          <div className="space-y-2">
            <Label className="text-xs font-bold text-foreground">
              Select Destination Station
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {stations.map((st) => {
                const cfg = STATION_CONFIG[st];
                const Icon = cfg.icon;
                const isSelected = targetStation === st;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setTargetStation(st)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                      isSelected
                        ? "border-primary bg-primary/10 text-foreground ring-2 ring-primary/20 font-bold"
                        : "border-border/80 bg-card hover:bg-muted/50 text-foreground"
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg ${
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold">{cfg.label}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {cfg.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Conditional Doctor Selection */}
          {targetStation === "CONSULTATION_ROOM" && (
            <div className="space-y-1.5 p-3 rounded-xl bg-sky-500/5 border border-sky-500/30">
              <Label className="text-xs font-bold text-sky-700 dark:text-sky-300 flex items-center gap-1.5">
                <Stethoscope className="size-3.5" />
                <span>Assign Consulting Doctor</span>
              </Label>
              <Select
                value={selectedDoctorId || "ANY"}
                onValueChange={(val) =>
                  setSelectedDoctorId(val === "ANY" || !val ? "" : val)
                }
              >
                <SelectTrigger className="w-full text-xs h-9 bg-background border-border/80 text-foreground font-medium">
                  <SelectValue placeholder="Keep current / Any Doctor" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  <SelectItem value="ANY" label="Keep current / Any Doctor">
                    Keep current / Any Doctor
                  </SelectItem>
                  {doctors.map((doc) => {
                    const docLabel = `${doc.name || "Doctor"} (Fee: ৳${(doc.consultationFee ?? 1000).toLocaleString()})`;
                    return (
                      <SelectItem key={doc.id} value={doc.id} label={docLabel}>
                        {docLabel}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Conditional Room Selection */}
          {(targetStation === "CONSULTATION_ROOM" ||
            targetStation === "THERAPY_ROOM") && (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <DoorOpen className="size-3.5 text-muted-foreground" />
                <span>Assign Room (Optional)</span>
              </Label>
              <Select
                value={selectedRoomId || "NONE"}
                onValueChange={(val) =>
                  setSelectedRoomId(val === "NONE" || !val ? "" : val)
                }
              >
                <SelectTrigger className="w-full text-xs h-9 bg-background border-border/80 text-foreground font-medium">
                  <SelectValue placeholder="No specific room" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  <SelectItem value="NONE" label="No specific room">
                    No specific room
                  </SelectItem>
                  {rooms.map((r) => {
                    const rLabel = `Room ${r.number}${r.purpose ? ` (${r.purpose})` : ""}`;
                    return (
                      <SelectItem key={r.id} value={r.id} label={rLabel}>
                        {rLabel}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground">
              Transfer Notes (Optional)
            </Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Sent for ultrasound therapy, BP check, etc."
              className="text-xs h-9"
            />
          </div>
        </div>

        <DialogFooter className="shrink-0 p-3 sm:p-4 border-t border-border/60 bg-muted/20 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="text-xs cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={isSubmitting}
            className="text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-xs"
          >
            {isSubmitting ? "Updating Station..." : "Confirm Move"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
    </Dialog>
  );
}

/**
 * Modal to check in any patient today WITHOUT requiring an assigned therapy slot.
 */
function QuickCheckInWithoutSlotDialog({
  isOpen,
  onOpenChange,
  rooms,
  doctors,
  performers = [],
  onSuccess,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  rooms: PatientTrackingData["rooms"];
  doctors: {
    id: string;
    name: string | null;
    email: string | null;
    consultationFee: number;
  }[];
  performers?: {
    id: string;
    name: string;
    role: any;
  }[];
  onSuccess: () => void;
}) {
  const [patientSearch, setPatientSearch] = React.useState<string>("");
  const [patientResults, setPatientResults] = React.useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = React.useState<any | null>(null);
  const [isSearching, setIsSearching] = React.useState<boolean>(false);

  const [station, setStation] = React.useState<PatientStation>("RECEPTIONIST_DESK");
  const [queueType, setQueueType] = React.useState<QueueType>(QueueType.CONSULTATION);
  const [selectedDoctorId, setSelectedDoctorId] = React.useState<string>("");
  const [consultationFee, setConsultationFee] = React.useState<string>("1000");
  const [selectedRoomId, setSelectedRoomId] = React.useState<string>(() => {
    const publicRoom =
      rooms.find((r) => r.accessType === "PUBLIC") ||
      rooms.find((r) => r.number === "200");
    return publicRoom ? publicRoom.id : (rooms[0]?.id || "");
  });
  const [authorizingPerformerId, setAuthorizingPerformerId] = React.useState<string>(() => {
    return performers.length > 0 ? performers[0].id : "";
  });
  const [pin, setPin] = React.useState<string>("");
  const [toldTime, setToldTime] = React.useState<string>(() => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    const h12 = hours % 12 || 12;
    return `${String(h12).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${ampm}`;
  });
  const [notes, setNotes] = React.useState<string>("");
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);

  // Auto assign Public Waiting Lounge when station is RECEPTIONIST_DESK
  React.useEffect(() => {
    if (station === "RECEPTIONIST_DESK") {
      const publicRoom =
        rooms.find((r) => r.accessType === "PUBLIC") ||
        rooms.find((r) => r.number === "200");
      if (publicRoom) setSelectedRoomId(publicRoom.id);
    }
  }, [station, rooms]);

  // Search patients
  React.useEffect(() => {
    let active = true;
    if (!patientSearch.trim()) {
      setPatientResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchPatientsAction(patientSearch);
        if (active) setPatientResults(results);
      } finally {
        if (active) setIsSearching(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [patientSearch]);

  const handleDoctorChange = (docId: string) => {
    setSelectedDoctorId(docId);
    if (docId) {
      const doc = doctors.find((d) => d.id === docId);
      if (doc) {
        setConsultationFee(String(doc.consultationFee ?? 1000));
      }
    } else {
      setConsultationFee("1000");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) {
      toast.error("Please search and select a patient.");
      return;
    }

    if (authorizingPerformerId && pin.trim().length !== 4) {
      toast.error("Please enter the 4-digit security PIN for authorizing staff.");
      return;
    }

    setIsSubmitting(true);
    try {
      const isReception = station === "RECEPTIONIST_DESK";
      const parsedFee =
        !isReception && queueType === QueueType.CONSULTATION
          ? Math.max(0, parseFloat(consultationFee) || 0)
          : isReception
            ? 0
            : undefined;

      const res = await quickCheckInWithoutSlotAction({
        patientId: selectedPatient.id,
        station,
        queueType: isReception ? undefined : queueType,
        doctorId: isReception ? undefined : (selectedDoctorId || undefined),
        feeAmount: parsedFee,
        roomId: selectedRoomId || undefined,
        toldTime: toldTime.trim() || undefined,
        notes: notes.trim() || undefined,
        performerId: authorizingPerformerId || undefined,
        pin: pin.trim() || undefined,
      });

      if (res.success) {
        toast.success(res.message);
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Failed to check in patient.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-xl max-h-[92dvh] flex flex-col p-0 overflow-hidden rounded-2xl border-border/80 shadow-2xl">
        <DialogHeader className="p-4 sm:p-5 pb-3 sm:pb-4 pr-12 sm:pr-14 border-b border-border/60 bg-muted/20 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <Plus className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Quick Patient Check-In (No Therapy Slot Required)
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Check in a walk-in patient directly to Reception, Doctor
                Chamber, or Cashier.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 min-h-0 overflow-hidden"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-lpignore="true"
          data-1p-ignore="true"
          data-bwignore="true"
          data-form-type="other"
        >
          <div className="p-4 sm:p-5 space-y-4 overflow-y-auto overscroll-contain flex-1 min-h-0">
            {/* 1. Patient Picker */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-foreground">
                Select Patient <span className="text-destructive">*</span>
              </Label>

              {selectedPatient ? (
                <div className="p-3 rounded-xl border border-primary/40 bg-primary/5 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">
                        {selectedPatient.name}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground font-semibold">
                        {selectedPatient.gender}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">
                      {selectedPatient.phone}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedPatient(null)}
                    className="h-7 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="search"
                      name="quick_checkin_patient_search"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      data-lpignore="true"
                      data-1p-ignore="true"
                      data-form-type="other"
                      placeholder="Search patient by name, phone or MRN..."
                      value={patientSearch}
                      onChange={(e) => setPatientSearch(e.target.value)}
                      className="pl-8 pr-8 text-xs h-9"
                      autoFocus
                    />
                    {isSearching && (
                      <RefreshCw className="size-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin" />
                    )}
                  </div>

                  {!isSearching && patientSearch.trim() && patientResults.length === 0 && (
                    <div className="p-3 text-center text-xs text-muted-foreground rounded-xl border border-dashed border-border/80 bg-muted/20">
                      No patients found matching &ldquo;{patientSearch}&rdquo;
                    </div>
                  )}

                  {patientResults.length > 0 && (
                    <div className="max-h-36 overflow-y-auto rounded-xl border border-border/80 divide-y divide-border/50 bg-card shadow-xs">
                      {patientResults.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setSelectedPatient(p)}
                          className="w-full px-3 py-2 text-left hover:bg-muted/50 flex items-center justify-between cursor-pointer transition-colors"
                        >
                          <div>
                            <span className="text-xs font-bold text-foreground block">
                              {p.name}
                            </span>
                            <span className="text-[11px] text-muted-foreground font-mono">
                              {p.phone}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {p.gender}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2. Destination Station */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">
                Initial Station
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(
                  [
                    "RECEPTIONIST_DESK",
                    "CONSULTATION_ROOM",
                    "CASHIER_REGISTER",
                    "THERAPY_ROOM",
                  ] as const
                ).map((st) => {
                  const cfg = STATION_CONFIG[st];
                  const Icon = cfg.icon;
                  const isSelected = station === st;
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStation(st)}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                        isSelected
                          ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20 font-bold"
                          : "border-border/80 bg-card hover:bg-muted/50 text-foreground"
                      }`}
                    >
                      <Icon className="size-4" />
                      <span className="text-[11px] leading-tight font-bold">
                        {cfg.shortLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Public Waiting Lounge banner if Receptionist Desk */}
            {station === "RECEPTIONIST_DESK" && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2.5 text-xs text-emerald-950 dark:text-emerald-200">
                <DoorOpen className="size-4.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-bold">Destination: Public Waiting Lounge (Arrival Desk)</div>
                  <div className="text-[11px] text-muted-foreground">
                    Patient will be placed directly into the Public Waiting Lounge without queue assignment.
                  </div>
                </div>
              </div>
            )}

            {/* 3. Queue Type (if NOT Reception Desk) */}
            {station !== "RECEPTIONIST_DESK" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">
                  Visit Category
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setQueueType(QueueType.CONSULTATION)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2 ${
                      queueType === QueueType.CONSULTATION
                        ? "border-sky-500 bg-sky-500/10 text-sky-900 dark:text-sky-200 ring-2 ring-sky-500/20 font-bold"
                        : "border-border/80 bg-card hover:bg-muted/50 text-foreground"
                    }`}
                  >
                    <Stethoscope className="size-4 text-sky-500" />
                    <div>
                      <div className="text-xs font-bold">Doctor Consultation</div>
                      <div className="text-[10px] text-muted-foreground">
                        Chamber visit & assessment
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setQueueType(QueueType.THERAPY)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2 ${
                      queueType === QueueType.THERAPY
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20 font-bold"
                        : "border-border/80 bg-card hover:bg-muted/50 text-foreground"
                    }`}
                  >
                    <Activity className="size-4 text-emerald-500" />
                    <div>
                      <div className="text-xs font-bold">Therapy Treatment</div>
                      <div className="text-[10px] text-muted-foreground">
                        Walk-in physiotherapy
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* 4. Doctor Selection & Fee Modifier (if Consultation & NOT Reception Desk) */}
            {station !== "RECEPTIONIST_DESK" && queueType === QueueType.CONSULTATION && (
              <div className="p-3.5 rounded-xl border border-sky-500/30 bg-sky-500/5 space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-sky-700 dark:text-sky-300">
                      <Stethoscope className="size-3.5" />
                      <span>Doctor (Optional)</span>
                    </span>
                    <span className="text-[10.5px] text-muted-foreground">
                      Preset fee loads automatically
                    </span>
                  </Label>
                  <Select
                    value={selectedDoctorId || "GENERAL"}
                    onValueChange={(val) => {
                      const finalVal = val === "GENERAL" || !val ? "" : val;
                      handleDoctorChange(finalVal);
                    }}
                  >
                    <SelectTrigger className="w-full text-xs h-9 bg-background border-border/80 text-foreground font-medium">
                      <SelectValue placeholder="General Consultation (No Doctor)" />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      <SelectItem
                        value="GENERAL"
                        label="General Consultation (No Doctor)"
                      >
                        General Consultation (No Doctor)
                      </SelectItem>
                      {doctors.map((doc) => {
                        const docLabel = `${doc.name || "Doctor"} — Preset: ৳${(doc.consultationFee ?? 1000).toLocaleString()}`;
                        return (
                          <SelectItem key={doc.id} value={doc.id} label={docLabel}>
                            {docLabel}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Banknote className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Consultation Fee (৳ BDT)</span>
                    </span>
                    <span className="text-[10.5px] text-muted-foreground">
                      Editable / Custom discount
                    </span>
                  </Label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground font-mono">
                        ৳
                      </span>
                      <Input
                        type="number"
                        min="0"
                        step="50"
                        value={consultationFee}
                        onChange={(e) => setConsultationFee(e.target.value)}
                        className="pl-7 text-xs h-9 font-mono font-bold"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setConsultationFee("0")}
                      className="h-9 px-2 text-[10px] font-bold text-emerald-600 hover:bg-emerald-500/10 cursor-pointer"
                    >
                      Free (৳0)
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const doc = doctors.find((d) => d.id === selectedDoctorId);
                        setConsultationFee(String(doc?.consultationFee ?? 1000));
                      }}
                      className="h-9 px-2 text-[10px] font-bold text-sky-600 hover:bg-sky-500/10 cursor-pointer"
                    >
                      Reset Preset
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* 5. Authorizing Staff & Security PIN */}
            {performers.length > 0 && (
              <div className="p-3.5 rounded-xl border border-border/80 bg-muted/20 space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">
                    Authorizing Staff Performer
                  </Label>
                  <Select
                    value={authorizingPerformerId}
                    onValueChange={(val) => setAuthorizingPerformerId(val ?? "")}
                  >
                    <SelectTrigger className="w-full text-xs h-9 bg-background border-border/80 text-foreground font-medium">
                      <SelectValue placeholder="Select Staff Member" />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {performers.map((perf) => (
                        <SelectItem key={perf.id} value={perf.id} label={`${perf.name} (${perf.role})`}>
                          {perf.name} ({perf.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {authorizingPerformerId && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground">
                      Staff Security PIN (4 Digits) <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      type="password"
                      maxLength={4}
                      pattern="[0-9]{4}"
                      inputMode="numeric"
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      placeholder="••••"
                      className="text-xs h-9 font-mono tracking-widest text-center"
                    />
                  </div>
                )}
              </div>
            )}

            {/* 6. Room & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {station !== "RECEPTIONIST_DESK" && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">
                    Room (Optional)
                  </Label>
                  <Select
                    value={selectedRoomId || "NONE"}
                    onValueChange={(val) =>
                      setSelectedRoomId(val === "NONE" || !val ? "" : val)
                    }
                  >
                    <SelectTrigger className="w-full text-xs h-9 bg-background border-border/80 text-foreground font-medium">
                      <SelectValue placeholder="No Room Assigned" />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      <SelectItem value="NONE" label="No Room Assigned">
                        No Room Assigned
                      </SelectItem>
                      {rooms.map((r) => {
                        const rLabel = `Room ${r.number}${r.purpose ? ` (${r.purpose})` : ""}`;
                        return (
                          <SelectItem key={r.id} value={r.id} label={rLabel}>
                            {rLabel}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">
                  Told Arrival Time
                </Label>
                <Input
                  value={toldTime}
                  onChange={(e) => setToldTime(e.target.value)}
                  placeholder="e.g. 11:30 AM"
                  className="text-xs h-9 font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">
                Notes (Optional)
              </Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Walk-in notes, referral source, etc."
                className="text-xs h-9"
              />
            </div>
          </div>

          <DialogFooter className="p-3 sm:p-4 border-t border-border/60 bg-muted/20 shrink-0 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="text-xs cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !selectedPatient}
              className="text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
            >
              {isSubmitting ? "Checking In..." : "Confirm Check-In"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
