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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ReceptionistPerformerSelect,
  type ReceptionistPerformer,
} from "@/components/receptionist/receptionist-performer-select";
import {
  createPatientAction,
  checkInArrivingPatientAction,
  searchPatientsWithArrivalStatusAction,
  getTodayArrivalsDataAction,
} from "@/actions/receptionist/patient.action";
import { Gender, QueueType, AppointmentStatus } from "@/generated/prisma/enums";
import { BLOOD_GROUPS } from "@/schemas/receptionist/patient.schema";
import {
  UserCheck,
  UserPlus,
  Search,
  Phone,
  Mail,
  User,
  Clock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  LogIn,
  Stethoscope,
  Activity,
  MapPin,
  HeartHandshake,
  Briefcase,
  Droplet,
  Sparkles,
  X,
  Loader2,
  Ticket,
  ArrowRight,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { formatBSTShortDate } from "@/lib/date";

export interface PatientArrivalDoctor {
  id: string;
  name: string | null;
  email: string | null;
  consultationFee: number;
  consultationRoomId?: string | null;
  consultationRoom?: {
    id: string;
    number: string;
    purpose?: string | null;
  } | null;
}

interface PatientArrivalTabProps {
  performers: ReceptionistPerformer[];
  doctors?: PatientArrivalDoctor[];
  lastPerformerId: string;
  onSelectPerformerId: (id: string) => void;
  onRefresh?: () => void;
  selectedDate: string;
}

interface PatientSearchResult {
  id: string;
  mrn: string | null;
  name: string;
  phone: string;
  gender: Gender;
  age?: number | null;
  email?: string | null;
  address?: string | null;
  emergencyPhone?: string | null;
  profession?: string | null;
  bloodGroup?: string | null;
  createdAt: Date | string;
  todayAppointment?: {
    id: string;
    status: AppointmentStatus;
    queueType: QueueType;
    currentStation: string | null;
    checkInTime: Date | string | null;
    toldTime: string | null;
    feeAmount: number | null;
    paidAmount: number | null;
    dueAmount: number | null;
    paymentStatus: string | null;
    doctorName: string | null;
    slotLabel: string | null;
  } | null;
}

export function PatientArrivalTab({
  performers,
  doctors = [],
  lastPerformerId,
  onSelectPerformerId,
  onRefresh,
  selectedDate,
}: PatientArrivalTabProps) {
  // Staff Identity
  const [activePerformerId, setActivePerformerId] = React.useState<string>(
    () => lastPerformerId || (performers[0]?.id ?? ""),
  );
  const [activePin, setActivePin] = React.useState<string>("");

  // Search State
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [searchResults, setSearchResults] = React.useState<PatientSearchResult[]>([]);
  const [isSearching, setIsSearching] = React.useState<boolean>(false);

  // Today's Arrivals stream
  const [todayArrivals, setTodayArrivals] = React.useState<any[]>([]);
  const [isLoadingArrivals, setIsLoadingArrivals] = React.useState<boolean>(false);

  // Modals
  const [checkInModalPatient, setCheckInModalPatient] =
    React.useState<PatientSearchResult | null>(null);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = React.useState<boolean>(false);

  // Check-In Form State (for existing patient)
  const [checkInQueueType, setCheckInQueueType] = React.useState<QueueType>(
    QueueType.THERAPY,
  );
  const [checkInDoctorId, setCheckInDoctorId] = React.useState<string>(
    () => (doctors[0]?.id ?? ""),
  );
  const [checkInTime, setCheckInTime] = React.useState<string>(() => {
    const d = new Date();
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  });
  const [checkInToldTime, setCheckInToldTime] = React.useState<string>("");
  const [checkInNotes, setCheckInNotes] = React.useState<string>("");
  const [isSubmittingCheckIn, setIsSubmittingCheckIn] = React.useState<boolean>(false);

  // Register Arriving Patient Form State
  const [regName, setRegName] = React.useState<string>("");
  const [regPhone, setRegPhone] = React.useState<string>("");
  const [regGender, setRegGender] = React.useState<Gender>(Gender.MALE);
  const [regAge, setRegAge] = React.useState<string>("");
  const [regEmail, setRegEmail] = React.useState<string>("");
  const [regAddress, setRegAddress] = React.useState<string>("");
  const [regEmergencyPhone, setRegEmergencyPhone] = React.useState<string>("");
  const [regProfession, setRegProfession] = React.useState<string>("");
  const [regBloodGroup, setRegBloodGroup] = React.useState<string>("");
  const [regQueueType, setRegQueueType] = React.useState<QueueType>(
    QueueType.THERAPY,
  );
  const [regDoctorId, setRegDoctorId] = React.useState<string>(
    () => (doctors[0]?.id ?? ""),
  );
  const [regToldTime, setRegToldTime] = React.useState<string>("");
  const [regNotes, setRegNotes] = React.useState<string>("");
  const [isSubmittingRegister, setIsSubmittingRegister] =
    React.useState<boolean>(false);

  // Synchronize performer selection
  const handlePerformerChange = (id: string) => {
    setActivePerformerId(id);
    onSelectPerformerId(id);
  };

  // Memoized Select Items for Base UI / shadcn Select
  const doctorSelectItems = React.useMemo(() => {
    return doctors.map((d) => ({
      value: d.id,
      label: `${d.name || "Doctor"}${d.consultationRoom ? ` (Room ${d.consultationRoom.number})` : ""} — ৳${(d.consultationFee ?? 1000).toLocaleString()} Fee`,
    }));
  }, [doctors]);


  // Load Today Arrivals
  const loadTodayArrivals = React.useCallback(async () => {
    setIsLoadingArrivals(true);
    try {
      const data = await getTodayArrivalsDataAction();
      setTodayArrivals(data);
    } catch (e) {
      console.error("[Arrivals Load Error]:", e);
    } finally {
      setIsLoadingArrivals(false);
    }
  }, []);

  React.useEffect(() => {
    loadTodayArrivals();
  }, [loadTodayArrivals]);

  // Debounced Patient Search
  React.useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchPatientsWithArrivalStatusAction(q);
        setSearchResults(results as PatientSearchResult[]);
      } catch (err) {
        console.error("[Search Arriving Patients Error]:", err);
      } finally {
        setIsSearching(false);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Open Registration Modal with prefilled search query
  const handleOpenRegisterWithQuery = () => {
    const q = searchQuery.trim();
    // If user searched a number, prefill phone; if name, prefill name
    const cleanedNumber = q.replace(/^(\+880|880)/, "0").replace(/[\s-]/g, "");
    if (/^\d+$/.test(cleanedNumber)) {
      setRegPhone(cleanedNumber);
      setRegName("");
    } else {
      setRegName(q);
      setRegPhone("");
    }
    setRegGender(Gender.MALE);
    setRegAge("");
    setRegEmail("");
    setRegAddress("");
    setRegEmergencyPhone("");
    setRegProfession("");
    setRegBloodGroup("");
    setRegQueueType(QueueType.THERAPY);
    setRegDoctorId(doctors[0]?.id ?? "");
    setRegToldTime("");
    setRegNotes("");
    setActivePin("");
    setIsRegisterModalOpen(true);
  };

  // Open Check-In Modal for existing patient
  const handleOpenCheckIn = (patient: PatientSearchResult) => {
    setActivePin("");
    setCheckInModalPatient(patient);
    setCheckInQueueType(
      patient.todayAppointment?.queueType || QueueType.THERAPY,
    );
    setCheckInDoctorId(doctors[0]?.id ?? "");
    const d = new Date();
    setCheckInTime(
      d.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }),
    );
    setCheckInToldTime(patient.todayAppointment?.toldTime || "");
    setCheckInNotes("");
  };

  // Submit Check-In for existing patient
  const handleConfirmCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkInModalPatient) return;

    if (!activePerformerId && performers.length > 0) {
      toast.error("Please select an authorizing receptionist staff member.");
      return;
    }

    if (!activePin || activePin.length !== 4) {
      toast.error("Please enter your 4-digit receptionist security PIN.");
      return;
    }

    setIsSubmittingCheckIn(true);
    try {
      const selectedDoc =
        checkInQueueType === QueueType.CONSULTATION && checkInDoctorId
          ? doctors.find((d) => d.id === checkInDoctorId)
          : undefined;

      const res = await checkInArrivingPatientAction({
        patientId: checkInModalPatient.id,
        performerId: activePerformerId,
        pin: activePin,
        queueType: checkInQueueType,
        doctorId: checkInQueueType === QueueType.CONSULTATION ? checkInDoctorId : undefined,
        toldTime: checkInToldTime.trim() || undefined,
        notes: checkInNotes.trim() || undefined,
        feeAmount: selectedDoc?.consultationFee,
      });

      if (res.success) {
        toast.success(res.message);
        setActivePin("");
        setCheckInModalPatient(null);
        setSearchQuery("");
        setSearchResults([]);
        loadTodayArrivals();
        onRefresh?.();
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Failed to check in patient.");
    } finally {
      setIsSubmittingCheckIn(false);
    }
  };

  // Submit Registration and Immediate Check-In
  const handleConfirmRegisterAndCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!regName.trim()) {
      toast.error("Please enter patient full name.");
      return;
    }

    const cleanedPhone = regPhone.replace(/^(\+880|880)/, "0").replace(/[\s-]/g, "");
    if (!/^01[3-9]\d{8}$/.test(cleanedPhone)) {
      toast.error(
        "Please enter a valid 11-digit Bangladeshi mobile number starting with 01 (e.g. 01712345678).",
      );
      return;
    }

    if (!activePerformerId && performers.length > 0) {
      toast.error("Please select an authorizing receptionist staff member.");
      return;
    }

    if (!activePin || activePin.length !== 4) {
      toast.error("Please enter your 4-digit receptionist security PIN.");
      return;
    }

    setIsSubmittingRegister(true);
    try {
      const selectedDoc =
        regQueueType === QueueType.CONSULTATION && regDoctorId
          ? doctors.find((d) => d.id === regDoctorId)
          : undefined;

      const res = await createPatientAction({
        name: regName.trim(),
        phone: cleanedPhone,
        gender: regGender,
        age: regAge ? parseInt(regAge, 10) : undefined,
        email: regEmail.trim() || undefined,
        address: regAddress.trim() || undefined,
        emergencyPhone: regEmergencyPhone.trim() || undefined,
        profession: regProfession.trim() || undefined,
        bloodGroup: regBloodGroup.trim() || undefined,
        performerId: activePerformerId,
        pin: activePin,
        checkInNow: true,
        queueType: regQueueType,
        doctorId: regQueueType === QueueType.CONSULTATION ? regDoctorId : undefined,
        toldTime: regToldTime.trim() || undefined,
        notes: regNotes.trim() || undefined,
        feeAmount: selectedDoc?.consultationFee,
      });

      if (res.success) {
        toast.success(res.message);
        setActivePin("");
        setIsRegisterModalOpen(false);
        setSearchQuery("");
        setSearchResults([]);
        loadTodayArrivals();
        onRefresh?.();
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("An unexpected error occurred while registering patient.");
    } finally {
      setIsSubmittingRegister(false);
    }
  };

  // KPI Calculations
  const stats = React.useMemo(() => {
    const total = todayArrivals.length;
    const therapy = todayArrivals.filter((a) => a.queueType === QueueType.THERAPY).length;
    const consult = todayArrivals.filter((a) => a.queueType === QueueType.CONSULTATION).length;
    const serving = todayArrivals.filter(
      (a) =>
        a.status === AppointmentStatus.IN_CONSULTATION ||
        a.status === AppointmentStatus.IN_THERAPY ||
        a.status === AppointmentStatus.CALLING,
    ).length;
    const completed = todayArrivals.filter((a) => a.status === AppointmentStatus.COMPLETED).length;

    return { total, therapy, consult, serving, completed };
  }, [todayArrivals]);

  return (
    <div className="space-y-4">
      {/* 1. TOP ARRIVAL DESK BANNER */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-card border border-border/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-10 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
            <UserCheck className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-bold text-foreground">
                Patient Arrival &amp; Check-In Desk
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-700 dark:text-sky-300 font-semibold border border-sky-500/20">
                100% LAN
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
              Verify arriving patients by MRN, Name or Mobile; register new walk-ins with immediate check-in.
            </p>
          </div>
        </div>
      </div>

      {/* 2. RAPID SEARCH & ARRIVAL WORKFLOW SECTION */}
      <Card className="border-border/80 shadow-xs rounded-2xl overflow-hidden">
        <CardHeader className="p-4 sm:p-5 pb-3 border-b border-border/60 bg-muted/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Search className="size-4 text-sky-500" />
                <span>Search Arriving Patient</span>
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Check if the arriving patient is already registered in the Directory
              </p>
            </div>

            <Button
              type="button"
              onClick={handleOpenRegisterWithQuery}
              size="sm"
              className="h-8 px-3 text-xs font-bold gap-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs cursor-pointer self-start sm:self-auto"
            >
              <UserPlus className="size-3.5" />
              <span>Register New Arriving Patient</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-5 space-y-4">
          {/* Prominent Search Input (Protected against password manager autofill) */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              type="search"
              name="arriving_patient_search_query"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-lpignore="true"
              data-1p-ignore="true"
              data-form-type="other"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search arriving patient by MRN (e.g. HPC-2026-0001), Name, or 11-digit Phone (01XXXXXXXXX)..."
              className="pl-10 pr-10 h-11 text-sm rounded-xl font-medium bg-background border-border shadow-2xs"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 size-6 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Search Loading */}
          {isSearching && (
            <div className="p-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="size-4 animate-spin text-sky-500" />
              <span>Searching patient directory...</span>
            </div>
          )}

          {/* Case A: Results Found */}
          {!isSearching && searchQuery.trim() && searchResults.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                <span>
                  Found <strong className="text-foreground">{searchResults.length}</strong> matching patient{searchResults.length > 1 ? "s" : ""}
                </span>
                <span className="text-[11px]">
                  Click <strong>Check In Patient</strong> to mark arrival
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {searchResults.map((patient) => {
                  const hasArrivedToday =
                    patient.todayAppointment &&
                    (patient.todayAppointment.status === AppointmentStatus.CHECKED_IN ||
                      patient.todayAppointment.status === AppointmentStatus.CALLING ||
                      patient.todayAppointment.status === AppointmentStatus.IN_CONSULTATION ||
                      patient.todayAppointment.status === AppointmentStatus.IN_THERAPY ||
                      patient.todayAppointment.status === AppointmentStatus.COMPLETED);

                  const isScheduledToday =
                    patient.todayAppointment &&
                    patient.todayAppointment.status === AppointmentStatus.CONFIRMED;

                  return (
                    <div
                      key={patient.id}
                      className="p-3.5 rounded-xl border border-border/80 bg-card hover:border-sky-500/50 transition-all flex flex-col justify-between gap-3 shadow-2xs"
                    >
                      <div className="space-y-2">
                        {/* Top: Name, MRN & Gender */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="text-sm font-bold text-foreground">
                              {patient.name}
                            </h4>
                            <span className="text-[10px] font-mono font-bold text-muted-foreground">
                              MRN: {patient.mrn || "Pending"}
                            </span>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              patient.gender === Gender.FEMALE
                                ? "bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/30"
                                : "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30"
                            }`}
                          >
                            {patient.gender}
                          </span>
                        </div>

                        {/* Phone & Demographics */}
                        <div className="space-y-1 text-xs">
                          <div className="flex items-center gap-1.5 font-mono text-muted-foreground">
                            <Phone className="size-3 text-emerald-500 shrink-0" />
                            <span className="text-foreground font-semibold">
                              {patient.phone}
                            </span>
                            {patient.age && (
                              <span className="text-muted-foreground text-[11px] ml-1">
                                • {patient.age} yrs
                              </span>
                            )}
                          </div>

                          {patient.bloodGroup && (
                            <div className="flex items-center gap-1.5 text-[11px] text-rose-600 dark:text-rose-400 font-semibold">
                              <Droplet className="size-3 shrink-0" />
                              <span>Blood Group: {patient.bloodGroup}</span>
                            </div>
                          )}

                          {patient.profession && (
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <Briefcase className="size-3 shrink-0" />
                              <span>{patient.profession}</span>
                            </div>
                          )}

                          {patient.address && (
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground truncate">
                              <MapPin className="size-3 shrink-0" />
                              <span className="truncate">{patient.address}</span>
                            </div>
                          )}
                        </div>

                        {/* Today's Arrival Status Badge */}
                        <div className="pt-2 border-t border-border/50">
                          {hasArrivedToday ? (
                            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between text-[11px]">
                              <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-bold">
                                <CheckCircle2 className="size-3.5 text-emerald-500" />
                                <span>Checked In Today</span>
                              </span>
                              <span className="font-mono text-[10px] text-muted-foreground font-semibold">
                                {patient.todayAppointment?.checkInTime
                                  ? new Date(
                                      patient.todayAppointment.checkInTime,
                                    ).toLocaleTimeString("en-US", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      hour12: true,
                                    })
                                  : "Arrived"}
                              </span>
                            </div>
                          ) : isScheduledToday ? (
                            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-between text-[11px]">
                              <span className="flex items-center gap-1 text-amber-700 dark:text-amber-300 font-semibold">
                                <Clock className="size-3.5 text-amber-500" />
                                <span>Scheduled Today</span>
                              </span>
                              <span className="font-mono text-[10px] text-muted-foreground font-semibold">
                                {patient.todayAppointment?.slotLabel || "Today"}
                              </span>
                            </div>
                          ) : (
                            <div className="p-1.5 rounded-lg bg-muted/40 text-[11px] text-muted-foreground flex items-center gap-1">
                              <LogIn className="size-3 text-muted-foreground" />
                              <span>No check-in recorded today (Walk-In)</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Button */}
                      <div>
                        {hasArrivedToday ? (
                          <div className="text-[11px] text-center font-bold py-1 text-emerald-600 dark:text-emerald-400">
                            Station: {patient.todayAppointment?.currentStation || "Active Queue"}
                          </div>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleOpenCheckIn(patient)}
                            className="w-full h-8 text-xs font-bold gap-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white shadow-xs cursor-pointer"
                          >
                            <UserCheck className="size-3.5" />
                            <span>
                              {isScheduledToday
                                ? "Check In Scheduled Patient"
                                : "Check In Patient (Walk-In)"}
                            </span>
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Case B: No Results Found (Prompt to Register) */}
          {!isSearching && searchQuery.trim() && searchResults.length === 0 && (
            <div className="p-6 rounded-2xl border border-dashed border-sky-500/40 bg-sky-500/5 text-center space-y-3">
              <div className="size-12 rounded-2xl bg-sky-500/15 text-sky-600 dark:text-sky-400 mx-auto flex items-center justify-center">
                <UserPlus className="size-6" />
              </div>
              <div className="max-w-md mx-auto">
                <h3 className="text-sm font-bold text-foreground">
                  Patient Not Found in Directory
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  No registered patient matches &quot;<strong>{searchQuery}</strong>&quot;.
                  Click below to quickly register this patient and complete immediate arrival check-in.
                </p>
              </div>
              <Button
                type="button"
                onClick={handleOpenRegisterWithQuery}
                className="h-9 px-4 text-xs font-bold gap-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white shadow-sm cursor-pointer"
              >
                <UserPlus className="size-4" />
                <span>Register &quot;{searchQuery}&quot; & Check In</span>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. TODAY'S ARRIVALS LIVE STREAM */}
      <Card className="border-border/80 shadow-xs rounded-2xl overflow-hidden">
        <CardHeader className="p-4 sm:p-5 pb-3 border-b border-border/60 bg-muted/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Activity className="size-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold">
                  Patients Arrived Today ({todayArrivals.length})
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Live queue of patients who checked in today ({selectedDate})
                </p>
              </div>
            </div>

            {/* Quick KPI Strip */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-700 dark:text-sky-300 font-bold border border-sky-500/20">
                Therapy: {stats.therapy}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-500/20">
                Consultation: {stats.consult}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-500/20">
                Serving: {stats.serving}
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoadingArrivals ? (
            <div className="p-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="size-4 animate-spin text-sky-500" />
              <span>Loading today&apos;s arrivals...</span>
            </div>
          ) : todayArrivals.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground space-y-1">
              <Clock className="size-6 text-muted-foreground mx-auto opacity-50 mb-1" />
              <p className="font-semibold text-foreground">No arrivals recorded yet today</p>
              <p>Search or register arriving patients above to populate today&apos;s check-in desk.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/60 overflow-x-auto">
              {todayArrivals.map((apt, index) => {
                const checkInTimeStr = apt.checkInTime
                  ? new Date(apt.checkInTime).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    })
                  : "N/A";

                return (
                  <div
                    key={apt.id}
                    className="p-3.5 sm:px-5 hover:bg-muted/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-start sm:items-center gap-3">
                      <span className="size-6 rounded-lg bg-muted text-muted-foreground font-mono font-bold text-[11px] flex items-center justify-center shrink-0">
                        #{index + 1}
                      </span>

                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-foreground text-sm">
                            {apt.patient?.name || "Patient"}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground border font-semibold">
                            MRN: {apt.patient?.mrn || "N/A"}
                          </span>
                          <span
                            className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded border ${
                              apt.queueType === QueueType.CONSULTATION
                                ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20"
                                : "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20"
                            }`}
                          >
                            {apt.queueType === QueueType.CONSULTATION
                              ? "Doctor Consultation"
                              : "Physical Therapy"}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-mono">
                          <span>Phone: {apt.patient?.phone}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                            <Clock className="size-3" />
                            Checked In: {checkInTimeStr}
                          </span>
                          {apt.doctor && (
                            <>
                              <span>•</span>
                              <span>Dr. {apt.doctor.name}</span>
                            </>
                          )}
                          {apt.therapySlot && (
                            <>
                              <span>•</span>
                              <span>{apt.therapySlot.label}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-muted text-foreground border">
                        {apt.currentStation || "RECEPTIONIST_DESK"}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          apt.paymentStatus === "PAID"
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                        }`}
                      >
                        {apt.paymentStatus || "PENDING"} (৳{(apt.feeAmount ?? 0).toLocaleString()})
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. MODAL: CHECK-IN EXISTING PATIENT */}
      {checkInModalPatient && (
        <Dialog
          open={Boolean(checkInModalPatient)}
          onOpenChange={(open) => {
            if (!open) {
              setCheckInModalPatient(null);
              setActivePin("");
            }
          }}
        >
          <DialogContent className="w-[96vw] max-w-lg max-h-[92dvh] flex flex-col p-0 overflow-hidden rounded-2xl border bg-card shadow-2xl">
            <DialogHeader className="p-4 sm:p-5 pb-3 sm:pb-4 pr-12 sm:pr-14 border-b border-border/60 bg-muted/20 shrink-0">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                  <UserCheck className="size-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-foreground">
                    Check In Arriving Patient
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Record arrival timestamp and route to clinical waiting queue
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <form
              onSubmit={handleConfirmCheckIn}
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
              <div className="p-4 sm:p-5 overflow-y-auto overscroll-contain space-y-4 flex-1 min-h-0">
                {/* Arriving Patient Profile Summary */}
              <div className="p-3 rounded-xl border border-border/80 bg-muted/30 space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground text-sm">
                    {checkInModalPatient.name}
                  </span>
                  <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">
                    MRN: {checkInModalPatient.mrn || "Pending"}
                  </span>
                </div>
                <div className="flex items-center gap-3 font-mono text-muted-foreground text-[11px]">
                  <span>Phone: {checkInModalPatient.phone}</span>
                  <span>•</span>
                  <span>Sex: {checkInModalPatient.gender}</span>
                  {checkInModalPatient.age && (
                    <>
                      <span>•</span>
                      <span>Age: {checkInModalPatient.age} yrs</span>
                    </>
                  )}
                </div>
              </div>

              {/* Destination Queue Selection */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">
                  Clinical Queue Destination *
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCheckInQueueType(QueueType.THERAPY)}
                    className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                      checkInQueueType === QueueType.THERAPY
                        ? "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500 ring-1 ring-sky-500"
                        : "bg-background border-border text-foreground hover:bg-muted"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Activity className="size-3.5 text-sky-500" />
                      <span>Physical Therapy</span>
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      Queue
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCheckInQueueType(QueueType.CONSULTATION)}
                    className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                      checkInQueueType === QueueType.CONSULTATION
                        ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500 ring-1 ring-indigo-500"
                        : "bg-background border-border text-foreground hover:bg-muted"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Stethoscope className="size-3.5 text-indigo-500" />
                      <span>Doctor Consultation</span>
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      Chamber
                    </span>
                  </button>
                </div>
              </div>

              {/* If Doctor Consultation Queue: Select Doctor */}
              {checkInQueueType === QueueType.CONSULTATION && doctors.length > 0 && (
                <div className="space-y-1.5 p-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5">
                  <Label className="text-xs font-bold text-foreground flex items-center justify-between">
                    <span>Consulting Doctor</span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      Fee automatically populated
                    </span>
                  </Label>
                  <Select
                    items={doctorSelectItems}
                    value={checkInDoctorId || ""}
                    onValueChange={(val) => setCheckInDoctorId(val || "")}
                  >
                    <SelectTrigger className="w-full h-9 text-xs font-semibold bg-background border-border text-foreground">
                      <SelectValue placeholder="Select Doctor">
                        {(val: string | null) => {
                          const item = doctorSelectItems.find((d) => d.value === val);
                          return item ? item.label : "Select Doctor";
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="z-50 max-h-56">
                      {doctorSelectItems.map((d) => (
                        <SelectItem
                          key={d.value}
                          value={d.value}
                          label={d.label}
                          className="text-xs"
                        >
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Check-In Timestamp & Told Time */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-foreground">
                    Check-In Time *
                  </Label>
                  <Input
                    value={checkInTime}
                    onChange={(e) => setCheckInTime(e.target.value)}
                    placeholder="e.g. 10:30 AM"
                    className="h-9 text-xs font-mono font-bold rounded-xl"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-foreground">
                    Told / Expected Time (Optional)
                  </Label>
                  <Input
                    value={checkInToldTime}
                    onChange={(e) => setCheckInToldTime(e.target.value)}
                    placeholder="e.g. 11:00 AM"
                    className="h-9 text-xs font-mono rounded-xl"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <Label className="text-xs font-bold text-foreground">
                  Arrival Notes (Optional)
                </Label>
                <Input
                  value={checkInNotes}
                  onChange={(e) => setCheckInNotes(e.target.value)}
                  placeholder="e.g. Complains of severe knee pain, walk-in"
                  className="h-9 text-xs rounded-xl"
                />
              </div>

              {/* Authorizing Receptionist Confirmation */}
              <ReceptionistPerformerSelect
                performers={performers}
                selectedPerformerId={activePerformerId}
                onSelectPerformerId={handlePerformerChange}
                pin={activePin}
                onPinChange={setActivePin}
                label="Authorizing Receptionist / Desk Staff"
                pinLabel="Staff 4-Digit PIN:"
              />
            </div>

            <DialogFooter className="shrink-0 p-3 sm:p-4 border-t border-border/60 bg-muted/20 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCheckInModalPatient(null)}
                disabled={isSubmittingCheckIn}
                className="rounded-xl h-8.5 text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmittingCheckIn || !activePin || activePin.length !== 4}
                className="rounded-xl h-8.5 text-xs font-bold gap-1.5 bg-sky-600 hover:bg-sky-700 text-white shadow-xs cursor-pointer"
              >
                {isSubmittingCheckIn ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Checking In...</span>
                  </>
                ) : (
                  <>
                    <UserCheck className="size-3.5" />
                    <span>Confirm & Check In Patient</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
        </Dialog>
      )}

      {/* 5. MODAL: REGISTER NEW ARRIVING PATIENT & CHECK IN */}
      {isRegisterModalOpen && (
        <Dialog
          open={isRegisterModalOpen}
          onOpenChange={(open) => {
            setIsRegisterModalOpen(open);
            if (!open) {
              setActivePin("");
            }
          }}
        >
          <DialogContent className="w-[96vw] max-w-2xl max-h-[92dvh] flex flex-col p-0 overflow-hidden rounded-2xl border bg-card shadow-2xl">
            <DialogHeader className="p-4 sm:p-5 pb-3 sm:pb-4 pr-12 sm:pr-14 border-b border-border/60 bg-muted/20 shrink-0">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                  <UserPlus className="size-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-foreground">
                    Register New Arriving Patient
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Create directory profile and complete immediate arrival check-in
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <form
              onSubmit={handleConfirmRegisterAndCheckIn}
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
              <div className="p-4 sm:p-5 overflow-y-auto overscroll-contain space-y-4 flex-1 min-h-0">
                {/* Mandatory Fields Block */}
              <div className="p-3.5 rounded-xl border border-sky-500/30 bg-sky-500/5 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-sky-700 dark:text-sky-300">
                  <span>Mandatory Registration Details</span>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-sky-500/15 border border-sky-500/25">
                    Required
                  </span>
                </div>

                <div className="space-y-3">
                  {/* Name */}
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-foreground">
                      Full Name *
                    </Label>
                    <Input
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="e.g. Mohammad Rahim"
                      className="h-9 text-xs rounded-xl bg-background"
                      required
                      autoFocus
                    />
                  </div>

                  {/* Bangladeshi 11-Digit Mobile & Sex */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-foreground flex items-center justify-between">
                        <span>Mobile Phone (11-Digit) *</span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          Without +88
                        </span>
                      </Label>
                      <div className="relative">
                        <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                        <Input
                          value={regPhone}
                          onChange={(e) => setRegPhone(e.target.value)}
                          placeholder="e.g. 01712345678"
                          className="pl-8 h-9 text-xs font-mono font-bold rounded-xl bg-background"
                          required
                          maxLength={15}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-foreground">
                        Sex / Gender *
                      </Label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setRegGender(Gender.MALE)}
                          className={`h-9 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            regGender === Gender.MALE
                              ? "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500 ring-1 ring-sky-500"
                              : "bg-background border-border text-foreground hover:bg-muted"
                          }`}
                        >
                          Male
                        </button>
                        <button
                          type="button"
                          onClick={() => setRegGender(Gender.FEMALE)}
                          className={`h-9 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            regGender === Gender.FEMALE
                              ? "bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500 ring-1 ring-pink-500"
                              : "bg-background border-border text-foreground hover:bg-muted"
                          }`}
                        >
                          Female
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Optional Fields Block */}
              <div className="space-y-3 pt-1">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  Optional Patient Information
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-foreground">
                      Age (Years)
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      max={120}
                      value={regAge}
                      onChange={(e) => setRegAge(e.target.value)}
                      placeholder="e.g. 35"
                      className="h-8.5 text-xs font-mono rounded-xl"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs font-medium text-foreground">
                      Email Address
                    </Label>
                    <Input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="e.g. patient@example.com"
                      className="h-8.5 text-xs rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-foreground">
                      Emergency Contact Number
                    </Label>
                    <Input
                      value={regEmergencyPhone}
                      onChange={(e) => setRegEmergencyPhone(e.target.value)}
                      placeholder="e.g. 01812345678"
                      className="h-8.5 text-xs font-mono rounded-xl"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-foreground">
                      Profession
                    </Label>
                    <Input
                      value={regProfession}
                      onChange={(e) => setRegProfession(e.target.value)}
                      placeholder="e.g. Teacher, Business, Homemaker"
                      className="h-8.5 text-xs rounded-xl"
                    />
                  </div>
                </div>

                {/* Blood Group Pills */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <Droplet className="size-3.5 text-rose-500" />
                    <span>Blood Group</span>
                  </Label>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                    {BLOOD_GROUPS.map((bg) => (
                      <button
                        key={bg}
                        type="button"
                        onClick={() =>
                          setRegBloodGroup(regBloodGroup === bg ? "" : bg)
                        }
                        className={`py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          regBloodGroup === bg
                            ? "bg-rose-500 text-white border-rose-600 shadow-xs"
                            : "bg-background border-border text-foreground hover:bg-muted"
                        }`}
                      >
                        {bg}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium text-foreground">
                    Address / Area
                  </Label>
                  <Input
                    value={regAddress}
                    onChange={(e) => setRegAddress(e.target.value)}
                    placeholder="e.g. Chanchra, Jashore"
                    className="h-8.5 text-xs rounded-xl"
                  />
                </div>
              </div>

              {/* Immediate Check-In Settings */}
              <div className="p-3.5 rounded-xl border border-border/80 bg-muted/30 space-y-3">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <UserCheck className="size-3.5 text-sky-500" />
                  <span>Immediate Arrival Check-In Routing</span>
                </span>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRegQueueType(QueueType.THERAPY)}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                      regQueueType === QueueType.THERAPY
                        ? "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500 ring-1 ring-sky-500"
                        : "bg-background border-border text-foreground hover:bg-muted"
                    }`}
                  >
                    <span>Physical Therapy</span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      Queue
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRegQueueType(QueueType.CONSULTATION)}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                      regQueueType === QueueType.CONSULTATION
                        ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500 ring-1 ring-indigo-500"
                        : "bg-background border-border text-foreground hover:bg-muted"
                    }`}
                  >
                    <span>Doctor Consultation</span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      Queue
                    </span>
                  </button>
                </div>

                {regQueueType === QueueType.CONSULTATION && doctors.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <Label className="text-xs font-semibold text-foreground">
                      Assigned Doctor
                    </Label>
                    <Select
                      items={doctorSelectItems}
                      value={regDoctorId || ""}
                      onValueChange={(val) => setRegDoctorId(val || "")}
                    >
                      <SelectTrigger className="w-full h-9 text-xs font-semibold bg-background border-border text-foreground">
                        <SelectValue placeholder="Select Doctor">
                          {(val: string | null) => {
                            const item = doctorSelectItems.find((d) => d.value === val);
                            return item ? item.label : "Select Doctor";
                          }}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="z-50 max-h-56">
                        {doctorSelectItems.map((d) => (
                          <SelectItem
                            key={d.value}
                            value={d.value}
                            label={d.label}
                            className="text-xs"
                          >
                            {d.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Staff PIN Authorization */}
              <ReceptionistPerformerSelect
                performers={performers}
                selectedPerformerId={activePerformerId}
                onSelectPerformerId={handlePerformerChange}
                pin={activePin}
                onPinChange={setActivePin}
                label="Authorizing Receptionist / Desk Staff"
                pinLabel="Staff 4-Digit PIN:"
              />
            </div>

            <DialogFooter className="shrink-0 p-3 sm:p-4 border-t border-border/60 bg-muted/20 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsRegisterModalOpen(false)}
                disabled={isSubmittingRegister}
                className="rounded-xl h-8.5 text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={
                  isSubmittingRegister ||
                  !regName.trim() ||
                  !regPhone.trim() ||
                  !activePin ||
                  activePin.length !== 4
                }
                className="rounded-xl h-8.5 text-xs font-bold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs cursor-pointer"
              >
                {isSubmittingRegister ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Registering & Checking In...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="size-3.5" />
                    <span>Register & Check In Arriving Patient</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
