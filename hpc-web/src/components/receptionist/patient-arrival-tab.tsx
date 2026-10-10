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
  bookConsultationSerialAction,
  checkoutPatientVisitAction,
} from "@/actions/receptionist/patient.action";
import { Gender, QueueType, AppointmentStatus } from "@/generated/prisma/enums";
import { BLOOD_GROUPS } from "@/schemas/receptionist/patient.schema";
import { evaluatePunctuality } from "@/lib/queue-punctuality";
import {
  UserCheck,
  UserPlus,
  Search,
  Phone,
  Clock,
  CheckCircle2,
  AlertCircle,
  LogIn,
  LogOut,
  Stethoscope,
  Activity,
  MapPin,
  Briefcase,
  Droplet,
  Loader2,
  DoorOpen,
  Receipt,
  ShieldAlert,
  ShieldCheck,
  Calendar,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { useRealtimeEvents } from "@/hooks/use-realtime-events";

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
  activeVisit?: {
    id: string;
    visitNumber: number;
    checkInTime: Date | string | null;
    checkOutTime: Date | string | null;
    status: string;
  } | null;
  todayAppointment?: {
    id: string;
    status: AppointmentStatus;
    queueType: QueueType;
    currentStation: string | null;
    checkInTime: Date | string | null;
    checkOutTime?: Date | string | null;
    toldTime: string | null;
    feeAmount: number | null;
    paidAmount: number | null;
    dueAmount: number | null;
    paymentStatus: string | null;
    doctorName: string | null;
    slotLabel: string | null;
    roomId?: string | null;
    roomNumber?: string | null;
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
  const [regCheckInNow, setRegCheckInNow] = React.useState<boolean>(true);
  const [regToldTime, setRegToldTime] = React.useState<string>("");
  const [regNotes, setRegNotes] = React.useState<string>("");
  const [isSubmittingRegister, setIsSubmittingRegister] =
    React.useState<boolean>(false);

  // Book Doctor Consultation Modal State
  const [bookConsultModalApt, setBookConsultModalApt] = React.useState<any | null>(null);
  const [consultDoctorId, setConsultDoctorId] = React.useState<string>("");
  const [consultFee, setConsultFee] = React.useState<number>(1000);
  const [consultToldTime, setConsultToldTime] = React.useState<string>("");
  const [consultNotes, setConsultNotes] = React.useState<string>("");
  const [isSubmittingConsultBooking, setIsSubmittingConsultBooking] =
    React.useState<boolean>(false);

  // Check Out Modal State
  const [checkoutModalApt, setCheckoutModalApt] = React.useState<any | null>(null);
  const [checkoutNotes, setCheckoutNotes] = React.useState<string>("");
  const [isSubmittingCheckout, setIsSubmittingCheckout] =
    React.useState<boolean>(false);

  // Synchronize performer selection
  const handlePerformerChange = (id: string) => {
    setActivePerformerId(id);
    onSelectPerformerId(id);
  };

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

  // Real-time SSE sync for Patient Arrival Tab
  useRealtimeEvents({
    onEvent: (event) => {
      const type = (event?.type || "").toUpperCase();
      if (type !== "CHAT_MESSAGE_SENT" && type !== "CHAT_MESSAGE_DELETED") {
        void loadTodayArrivals();
        const q = searchQuery.trim();
        if (q) {
          searchPatientsWithArrivalStatusAction(q)
            .then((results) => setSearchResults(results as PatientSearchResult[]))
            .catch(() => {});
        }
      }
    },
    onReconnect: () => {
      void loadTodayArrivals();
    },
  });

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
    setRegCheckInNow(true);
    setRegToldTime("");
    setRegNotes("");
    setActivePin("");
    setIsRegisterModalOpen(true);
  };

  // Open Check-In Modal for existing patient
  const handleOpenCheckIn = (patient: PatientSearchResult) => {
    setActivePin("");
    setCheckInModalPatient(patient);
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
      const res = await checkInArrivingPatientAction({
        patientId: checkInModalPatient.id,
        performerId: activePerformerId,
        pin: activePin,
        toldTime: checkInToldTime.trim() || undefined,
        notes: checkInNotes.trim() || undefined,
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

  // Submit Registration and Immediate Check-In (places in Public Waiting Room)
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
        checkInNow: regCheckInNow,
        toldTime: regToldTime.trim() || undefined,
        notes: regNotes.trim() || undefined,
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

  // Open Book Doctor Consultation Modal
  const handleOpenBookConsultation = (apt: any) => {
    setBookConsultModalApt(apt);
    const initialDoc = doctors[0];
    const initialDocId = initialDoc?.id || "";
    setConsultDoctorId(initialDocId);
    setConsultFee(initialDoc?.consultationFee ?? 1000);
    const d = new Date();
    setConsultToldTime(
      d.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }),
    );
    setConsultNotes("");
    setActivePin("");
  };

  // Handle doctor selection change in consultation booking
  const handleDoctorSelectionChange = (doctorId: string | null) => {
    if (!doctorId) return;
    setConsultDoctorId(doctorId);
    const selectedDoc = doctors.find((d) => d.id === doctorId);
    if (selectedDoc) {
      setConsultFee(selectedDoc.consultationFee ?? 1000);
    }
  };

  // Confirm Book Doctor Consultation
  const handleConfirmBookConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookConsultModalApt) return;

    if (!consultDoctorId) {
      toast.error("Please select a doctor for consultation.");
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

    setIsSubmittingConsultBooking(true);
    try {
      const patientId =
        bookConsultModalApt.patientId || bookConsultModalApt.patient?.id;
      const visitId =
        bookConsultModalApt.visitId ||
        bookConsultModalApt.patient?.visits?.[0]?.id;

      const res = await bookConsultationSerialAction({
        patientId,
        visitId: visitId || undefined,
        doctorId: consultDoctorId,
        feeAmount: Number(consultFee) || 0,
        toldTime: consultToldTime.trim() || undefined,
        performerId: activePerformerId,
        pin: activePin,
        notes: consultNotes.trim() || undefined,
      });

      if (res.success) {
        toast.success(res.message);
        setActivePin("");
        setBookConsultModalApt(null);
        loadTodayArrivals();
        onRefresh?.();
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Failed to book consultation serial.");
    } finally {
      setIsSubmittingConsultBooking(false);
    }
  };

  // Open Checkout Modal
  const handleOpenCheckout = (apt: any) => {
    setCheckoutModalApt(apt);
    setCheckoutNotes("");
    setActivePin("");
  };

  // Confirm Checkout
  const handleConfirmCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutModalApt) return;

    if (!activePerformerId && performers.length > 0) {
      toast.error("Please select an authorizing receptionist staff member.");
      return;
    }

    if (!activePin || activePin.length !== 4) {
      toast.error("Please enter your 4-digit receptionist security PIN.");
      return;
    }

    setIsSubmittingCheckout(true);
    try {
      const patientId =
        checkoutModalApt.patientId || checkoutModalApt.patient?.id;
      const visitId =
        checkoutModalApt.visitId ||
        checkoutModalApt.patient?.visits?.[0]?.id;

      const res = await checkoutPatientVisitAction({
        patientId,
        visitId: visitId || undefined,
        performerId: activePerformerId,
        pin: activePin,
        notes: checkoutNotes.trim() || undefined,
      });

      if (res.success) {
        toast.success(res.message);
        setActivePin("");
        setCheckoutModalApt(null);
        loadTodayArrivals();
        onRefresh?.();
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Failed to check out patient.");
    } finally {
      setIsSubmittingCheckout(false);
    }
  };

  // KPI Calculations
  const stats = React.useMemo(() => {
    const total = todayArrivals.length;
    const therapy = todayArrivals.filter(
      (a) => a.queueType === QueueType.THERAPY || a.therapySlotId,
    ).length;
    const consult = todayArrivals.filter(
      (a) =>
        a.queueType === QueueType.CONSULTATION ||
        a.patient?.consultationSerials?.length > 0,
    ).length;
    const serving = todayArrivals.filter(
      (a) =>
        a.status === AppointmentStatus.IN_CONSULTATION ||
        a.status === AppointmentStatus.IN_THERAPY ||
        a.status === AppointmentStatus.CALLING,
    ).length;
    const waiting = todayArrivals.filter(
      (a) =>
        a.currentStation === "RECEPTIONIST_DESK" ||
        a.status === AppointmentStatus.CHECKED_IN,
    ).length;

    return { total, therapy, consult, serving, waiting };
  }, [todayArrivals]);

  // Clearance Check for active checkout modal
  const checkoutClearance = React.useMemo(() => {
    if (!checkoutModalApt) return { canCheckout: true, unbilledReason: null };

    // Check consultation serials
    const serials = checkoutModalApt.patient?.consultationSerials || [];
    for (const s of serials) {
      if (s.status !== "CANCELLED" && (!s.invoiceId || s.paymentStatus === "PENDING")) {
        return {
          canCheckout: false,
          unbilledReason: `Doctor Consultation Serial #${s.serialNumber} (Dr. ${s.doctor?.name || "Doctor"}) has not been invoiced at Cashier Desk.`,
        };
      }
    }

    // Check therapy appointment
    if (
      checkoutModalApt.type === QueueType.THERAPY ||
      checkoutModalApt.queueType === QueueType.THERAPY ||
      checkoutModalApt.therapySlotId
    ) {
      if (
        checkoutModalApt.paymentStatus === "PENDING" &&
        !checkoutModalApt.invoiceId
      ) {
        return {
          canCheckout: false,
          unbilledReason: "Physical Therapy session bill has not been settled or marked DUE at Cashier Desk.",
        };
      }
    }

    return { canCheckout: true, unbilledReason: null };
  }, [checkoutModalApt]);

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
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-500/20">
                100% Offline LAN
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
              Verify arriving patients by MRN, Name or Mobile; place them into Public Waiting Lounge; manage consultations and check-outs.
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
                Search directory by Name, Mobile, MRN, Email or Emergency Contact
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

          <div className="pt-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by patient name, mobile number (e.g. 017...), MRN, email or emergency contact..."
                className="pl-10 h-10 text-xs sm:text-sm rounded-xl bg-background border-border/80 focus-visible:ring-sky-500"
              />
              {isSearching && (
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-5">
          {/* Case A: Search Results Found */}
          {searchResults.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Found <strong className="text-foreground">{searchResults.length}</strong> matching patient{searchResults.length > 1 ? "s" : ""}
                </span>
                <span className="text-[11px]">
                  Click <strong>Check In Patient</strong> to record arrival in Public Waiting Lounge
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {searchResults.map((patient) => {
                  const isCurrentlyInCenter = Boolean(
                    (patient.todayAppointment &&
                      patient.todayAppointment.currentStation !== "CHECKED_OUT" &&
                      (patient.todayAppointment.status === AppointmentStatus.CHECKED_IN ||
                        patient.todayAppointment.status === AppointmentStatus.CALLING ||
                        patient.todayAppointment.status === AppointmentStatus.IN_CONSULTATION ||
                        patient.todayAppointment.status === AppointmentStatus.IN_THERAPY)) ||
                    (patient.activeVisit &&
                      patient.activeVisit.status !== "CHECKED_OUT" &&
                      patient.todayAppointment?.currentStation !== "CHECKED_OUT" &&
                      patient.todayAppointment?.status !== AppointmentStatus.COMPLETED)
                  );

                  const isCheckedOutToday = Boolean(
                    !isCurrentlyInCenter &&
                    (patient.activeVisit?.status === "CHECKED_OUT" ||
                      patient.todayAppointment?.currentStation === "CHECKED_OUT" ||
                      patient.todayAppointment?.status === AppointmentStatus.COMPLETED)
                  );

                  const isScheduledToday = Boolean(
                    !isCurrentlyInCenter &&
                    !isCheckedOutToday &&
                    patient.todayAppointment?.status === AppointmentStatus.CONFIRMED
                  );

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
                          {isCurrentlyInCenter ? (
                            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between text-[11px]">
                              <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-bold">
                                <CheckCircle2 className="size-3.5 text-emerald-500" />
                                <span>Currently in Center</span>
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
                          ) : isCheckedOutToday ? (
                            <div className="p-2 rounded-lg bg-zinc-500/10 border border-zinc-500/25 flex items-center justify-between text-[11px]">
                              <span className="flex items-center gap-1 text-zinc-700 dark:text-zinc-300 font-semibold">
                                <CheckCircle2 className="size-3.5 text-zinc-500" />
                                <span>
                                  {patient.activeVisit?.visitNumber
                                    ? `Visit #${patient.activeVisit.visitNumber} Completed`
                                    : "Checked Out Today"}
                                </span>
                              </span>
                              <span className="font-mono text-[10px] text-muted-foreground font-semibold">
                                {patient.activeVisit?.checkOutTime || patient.todayAppointment?.checkOutTime
                                  ? `Out: ${new Date(
                                      patient.activeVisit?.checkOutTime || patient.todayAppointment?.checkOutTime!,
                                    ).toLocaleTimeString("en-US", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      hour12: true,
                                    })}`
                                  : "Checked Out"}
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
                        {isCurrentlyInCenter ? (
                          <div className="text-[11px] text-center font-bold py-1 text-emerald-600 dark:text-emerald-400">
                            Public Waiting Lounge (Checked In)
                          </div>
                        ) : isCheckedOutToday ? (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleOpenCheckIn(patient)}
                            className="w-full h-8 text-xs font-bold gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer"
                          >
                            <UserCheck className="size-3.5" />
                            <span>Check In Patient (New Visit)</span>
                          </Button>
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
                  Click below to quickly register this patient and place them into the Public Waiting Lounge.
                </p>
              </div>
              <Button
                type="button"
                onClick={handleOpenRegisterWithQuery}
                className="h-9 px-4 text-xs font-bold gap-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white shadow-sm cursor-pointer"
              >
                <UserPlus className="size-4" />
                <span>Register &quot;{searchQuery}&quot; &amp; Check In</span>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. TODAY'S ARRIVALS LIVE STREAM & QUEUE DESK */}
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
                  Live active arrivals in the center for {selectedDate}
                </p>
              </div>
            </div>

            {/* Quick KPI Strip */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-500/20">
                Waiting: {stats.waiting}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-500/20">
                Consultation: {stats.consult}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-700 dark:text-sky-300 font-bold border border-sky-500/20">
                Therapy: {stats.therapy}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-700 dark:text-purple-300 font-bold border border-purple-500/20">
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
              <p className="font-semibold text-foreground">No active arrivals in center right now</p>
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

                const punctuality = evaluatePunctuality(
                  apt.toldTime,
                  apt.checkInTime,
                );

                const existingSerial =
                  apt.patient?.consultationSerials?.[0];

                const isConsultWithSerial =
                  Boolean(existingSerial) && !apt.therapySlotId;

                const effectivePaymentStatus = isConsultWithSerial
                  ? existingSerial.paymentStatus || "PENDING"
                  : apt.paymentStatus || "PENDING";

                const effectiveFeeAmount = isConsultWithSerial
                  ? (existingSerial.feeAmount ?? 0)
                  : (apt.feeAmount ?? existingSerial?.feeAmount ?? 0);

                const effectivePaidAmount = isConsultWithSerial
                  ? (existingSerial.paidAmount ?? 0)
                  : (apt.paidAmount ?? 0);

                const effectiveDueAmount = isConsultWithSerial
                  ? (existingSerial.dueAmount ?? 0)
                  : (apt.dueAmount ?? 0);

                const effectiveDoctor = apt.doctor || existingSerial?.doctor;
                const effectiveInvoice = existingSerial?.invoice || apt.invoice;
                const effectiveToldTime = apt.toldTime || existingSerial?.toldTime;

                const roomBadgeText = apt.room
                  ? `${apt.room.purpose || "Waiting Room"} (Room ${apt.room.number})`
                  : "Waiting Room (Public)";

                const stationBadgeText =
                  apt.currentStation === "RECEPTIONIST_DESK" || !apt.currentStation
                    ? roomBadgeText
                    : apt.currentStation === "CASHIER_REGISTER"
                      ? `${roomBadgeText} • Cashier Desk`
                      : apt.currentStation === "CONSULTATION_ROOM"
                        ? `Doctor Chamber (${effectiveDoctor ? `Dr. ${effectiveDoctor.name}` : apt.room?.number || "Chamber"})`
                        : apt.currentStation === "THERAPY_ROOM"
                          ? `Therapy Room (${apt.room?.number || "Floor"})`
                          : apt.currentStation;

                return (
                  <div
                    key={apt.id}
                    className="p-3.5 sm:px-5 hover:bg-muted/30 transition-colors flex flex-col xl:flex-row xl:items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-start sm:items-center gap-3">
                      <span className="size-6 rounded-lg bg-muted text-muted-foreground font-mono font-bold text-[11px] flex items-center justify-center shrink-0">
                        #{index + 1}
                      </span>

                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-foreground text-sm">
                            {apt.patient?.name || "Patient"}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground border font-semibold">
                            MRN: {apt.patient?.mrn || "N/A"}
                          </span>

                          {/* Punctuality Indicator Badge */}
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1.5 shrink-0 ${punctuality.badgeClass}`}
                          >
                            <span
                              className={`size-1.5 rounded-full ${punctuality.dotClass}`}
                            />
                            <span>{punctuality.label}</span>
                          </span>

                          {/* Room / Station Badge */}
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/25">
                            {stationBadgeText}
                          </span>

                          {/* Existing Consultation Serial Indicator */}
                          {existingSerial && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/25 font-bold">
                              Serial #{existingSerial.serialNumber}: Dr. {existingSerial.doctor?.name || "Doctor"} (
                              {existingSerial.status === "FORWARDED_TO_CASHIER"
                                ? "Forwarded to Cashier"
                                : existingSerial.status === "QUEUED"
                                  ? "Queued for Doctor"
                                  : existingSerial.status}
                              )
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2.5 text-[11px] text-muted-foreground font-mono flex-wrap">
                          <span>Phone: {apt.patient?.phone}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                            <Clock className="size-3" />
                            In: {checkInTimeStr}
                          </span>
                          {effectiveToldTime && (
                            <>
                              <span>•</span>
                              <span>Told: {effectiveToldTime}</span>
                            </>
                          )}
                          {effectiveDoctor && (
                            <>
                              <span>•</span>
                              <span>Dr. {effectiveDoctor.name}</span>
                            </>
                          )}
                          {apt.therapySlot && (
                            <>
                              <span>•</span>
                              <span className="text-sky-600 dark:text-sky-400 font-bold">
                                {apt.therapySlot.label}
                              </span>
                            </>
                          )}
                          {effectiveInvoice && (
                            <>
                              <span>•</span>
                              <span className="text-purple-600 dark:text-purple-400 font-bold">
                                Inv: {effectiveInvoice.invoiceNumber}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Arrival / Booking Notes display */}
                        {(apt.notes || existingSerial?.notes || (apt.patient as any)?.visits?.[0]?.notes) && (
                          <div className="flex items-center gap-1.5 text-[11px] text-amber-900 dark:text-amber-200 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md mt-1 w-fit">
                            <FileText className="size-3 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span className="italic">
                              Note: {existingSerial?.notes || apt.notes || (apt.patient as any)?.visits?.[0]?.notes}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Actions (Book Consultation, Checkout) & Billing Chip */}
                    <div className="flex items-center gap-2 self-start xl:self-auto flex-wrap">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          effectivePaymentStatus === "PAID" && effectiveFeeAmount > 0
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                            : effectivePaymentStatus === "DUE" || effectivePaymentStatus === "PARTIAL"
                              ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20"
                              : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20"
                        }`}
                      >
                        {effectivePaymentStatus === "PARTIAL"
                          ? `PARTIAL (Paid: ৳${effectivePaidAmount.toLocaleString()} • Due: ৳${effectiveDueAmount.toLocaleString()})`
                          : !existingSerial && !apt.therapySlotId && effectiveFeeAmount === 0
                            ? "NO BILL YET (৳0)"
                            : `${effectivePaymentStatus} (৳${effectiveFeeAmount.toLocaleString()})`}
                      </span>

                      {/* Action 1: Book Consultation with Doctor (if none yet today) */}
                      {!existingSerial && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenBookConsultation(apt)}
                          className="h-7.5 px-2.5 text-xs font-bold gap-1 rounded-lg border-indigo-500/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/10 cursor-pointer shadow-2xs"
                        >
                          <Stethoscope className="size-3.5 text-indigo-500" />
                          <span>Book Consultation</span>
                        </Button>
                      )}

                      {/* Action 2: Check Out Patient */}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenCheckout(apt)}
                        className="h-7.5 px-2.5 text-xs font-bold gap-1 rounded-lg border-rose-500/30 text-rose-700 dark:text-rose-300 hover:bg-rose-500/10 cursor-pointer shadow-2xs"
                      >
                        <LogOut className="size-3.5 text-rose-500" />
                        <span>Check Out</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. MODAL: CHECK-IN EXISTING PATIENT (Places in Public Waiting Room) */}
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
                    Record arrival timestamp and route to Public Waiting Lounge
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <form
              onSubmit={handleConfirmCheckIn}
              className="flex flex-col flex-1 min-h-0 overflow-hidden"
              autoComplete="off"
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

                {/* Destination Indicator: Public Waiting Lounge */}
                <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 shrink-0">
                    <DoorOpen className="size-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-foreground">
                        Destination: Public Waiting Lounge
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 font-bold">
                        Unassigned Queue
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Patient will be marked as checked in without placing into any doctor or therapy queue. Specific consultations or therapy slots are booked separately.
                    </p>
                  </div>
                </div>

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
                    placeholder="e.g. Complains of knee pain, walk-in"
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
                      <span>Confirm &amp; Check In Patient</span>
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

                {/* Immediate Check-In Settings: Checkbox */}
                <div className="p-3.5 rounded-xl border border-indigo-500/30 bg-indigo-500/5 space-y-2.5">
                  <label className="flex items-start gap-2.5 text-xs text-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={regCheckInNow}
                      onChange={(e) => setRegCheckInNow(e.target.checked)}
                      className="size-4 mt-0.5 rounded text-emerald-600 accent-emerald-600 cursor-pointer shrink-0"
                    />
                    <div>
                      <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                        <DoorOpen className="size-4 text-emerald-600 dark:text-emerald-400" />
                        Mark check-in now (Public Waiting Lounge)
                      </span>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Automatically checks in patient to the Public Waiting Lounge upon registration without queue assignment.
                      </p>
                    </div>
                  </label>
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
                      <span>Registering &amp; Checking In...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="size-3.5" />
                      <span>Register &amp; Check In Arriving Patient</span>
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* 6. NEW MODAL: BOOK DOCTOR CONSULTATION SERIAL (Forwards to Cashier Desk) */}
      {bookConsultModalApt && (
        <Dialog
          open={Boolean(bookConsultModalApt)}
          onOpenChange={(open) => {
            if (!open) {
              setBookConsultModalApt(null);
              setActivePin("");
            }
          }}
        >
          <DialogContent className="w-[96vw] max-w-lg max-h-[92dvh] flex flex-col p-0 overflow-hidden rounded-2xl border bg-card shadow-2xl">
            <DialogHeader className="p-4 sm:p-5 pb-3 sm:pb-4 pr-12 sm:pr-14 border-b border-border/60 bg-muted/20 shrink-0">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <Stethoscope className="size-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-foreground">
                    Book Doctor Consultation Serial
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Forward patient to Cashier Desk for billing before chamber queue entry
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <form
              onSubmit={handleConfirmBookConsultation}
              className="flex flex-col flex-1 min-h-0 overflow-hidden"
              autoComplete="off"
            >
              <div className="p-4 sm:p-5 overflow-y-auto overscroll-contain space-y-4 flex-1 min-h-0">
                {/* Patient Summary Card */}
                <div className="p-3 rounded-xl border border-border/80 bg-muted/30 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground text-sm">
                      {bookConsultModalApt.patient?.name || "Patient"}
                    </span>
                    <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                      MRN: {bookConsultModalApt.patient?.mrn || "Pending"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-muted-foreground text-[11px]">
                    <span>Phone: {bookConsultModalApt.patient?.phone}</span>
                    <span>•</span>
                    <span>Sex: {bookConsultModalApt.patient?.gender}</span>
                  </div>
                </div>

                {/* Doctor Selection */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">
                    Select Consultation Doctor *
                  </Label>
                  <Select
                    value={consultDoctorId}
                    onValueChange={handleDoctorSelectionChange}
                  >
                    <SelectTrigger className="h-10 text-xs rounded-xl bg-background border-border/80">
                      <SelectValue placeholder="Choose a doctor..." />
                    </SelectTrigger>
                    <SelectContent>
                      {doctors.map((d) => (
                        <SelectItem key={d.id} value={d.id} className="text-xs">
                          {d.name || "Doctor"}
                          {d.consultationRoom
                            ? ` (Room ${d.consultationRoom.number})`
                            : ""}{" "}
                          — ৳{(d.consultationFee ?? 1000).toLocaleString()} Preset Fee
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Editable Consultation Fee & Told Time */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-foreground flex items-center justify-between">
                      <span>Consultation Fee (৳) *</span>
                      <span className="text-[10px] text-muted-foreground font-normal">
                        Editable
                      </span>
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      step={50}
                      value={consultFee}
                      onChange={(e) => setConsultFee(Number(e.target.value) || 0)}
                      className="h-9 text-xs font-mono font-bold rounded-xl"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-foreground">
                      Told Arrival Time (Optional)
                    </Label>
                    <Input
                      value={consultToldTime}
                      onChange={(e) => setConsultToldTime(e.target.value)}
                      placeholder="e.g. 10:30 AM"
                      className="h-9 text-xs font-mono rounded-xl"
                    />
                  </div>
                </div>

                {/* Cashier Routing Notice */}
                <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-center gap-3 text-xs">
                  <Receipt className="size-5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <p className="text-muted-foreground text-[11px]">
                    Booking will assign a <strong>Serial Number</strong> and forward the patient to the <strong>Cashier Desk</strong>. Patient will enter Doctor Consultation Queue once the invoice is processed (Paid or Due).
                  </p>
                </div>

                {/* Notes */}
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-foreground">
                    Consultation Notes (Optional)
                  </Label>
                  <Input
                    value={consultNotes}
                    onChange={(e) => setConsultNotes(e.target.value)}
                    placeholder="e.g. Follow-up consultation, knee joint review"
                    className="h-9 text-xs rounded-xl"
                  />
                </div>

                {/* Authorizing Receptionist Performer Select */}
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
                  onClick={() => setBookConsultModalApt(null)}
                  disabled={isSubmittingConsultBooking}
                  className="rounded-xl h-8.5 text-xs cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={
                    isSubmittingConsultBooking ||
                    !consultDoctorId ||
                    !activePin ||
                    activePin.length !== 4
                  }
                  className="rounded-xl h-8.5 text-xs font-bold gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer"
                >
                  {isSubmittingConsultBooking ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      <span>Booking Serial...</span>
                    </>
                  ) : (
                    <>
                      <Stethoscope className="size-3.5" />
                      <span>Book Serial &amp; Forward to Cashier</span>
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* 7. NEW MODAL: CHECK OUT PATIENT (Enforces Unbilled Clearance Guard) */}
      {checkoutModalApt && (
        <Dialog
          open={Boolean(checkoutModalApt)}
          onOpenChange={(open) => {
            if (!open) {
              setCheckoutModalApt(null);
              setActivePin("");
            }
          }}
        >
          <DialogContent className="w-[96vw] max-w-lg max-h-[92dvh] flex flex-col p-0 overflow-hidden rounded-2xl border bg-card shadow-2xl">
            <DialogHeader className="p-4 sm:p-5 pb-3 sm:pb-4 pr-12 sm:pr-14 border-b border-border/60 bg-muted/20 shrink-0">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <LogOut className="size-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-foreground">
                    Check Out Patient from Center
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Record checkout timestamp and archive active visit session
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <form
              onSubmit={handleConfirmCheckout}
              className="flex flex-col flex-1 min-h-0 overflow-hidden"
              autoComplete="off"
            >
              <div className="p-4 sm:p-5 overflow-y-auto overscroll-contain space-y-4 flex-1 min-h-0">
                {/* Patient Summary */}
                <div className="p-3 rounded-xl border border-border/80 bg-muted/30 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground text-sm">
                      {checkoutModalApt.patient?.name || "Patient"}
                    </span>
                    <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-muted text-muted-foreground border">
                      MRN: {checkoutModalApt.patient?.mrn || "Pending"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-muted-foreground text-[11px]">
                    <span>Phone: {checkoutModalApt.patient?.phone}</span>
                    <span>•</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                      Check-In:{" "}
                      {checkoutModalApt.checkInTime
                        ? new Date(
                            checkoutModalApt.checkInTime,
                          ).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                          })
                        : "Today"}
                    </span>
                  </div>
                </div>

                {/* ZERO UNBILLED CHECKOUTS GUARD */}
                {!checkoutClearance.canCheckout ? (
                  <div className="p-3.5 rounded-xl border border-rose-500/40 bg-rose-500/10 space-y-2 text-xs">
                    <div className="flex items-center gap-2 font-bold text-rose-700 dark:text-rose-300">
                      <ShieldAlert className="size-4 shrink-0 text-rose-600" />
                      <span>Checkout Blocked — Unbilled Session Detected</span>
                    </div>
                    <p className="text-[11px] text-rose-800 dark:text-rose-200">
                      {checkoutClearance.unbilledReason}
                    </p>
                    <p className="text-[10.5px] text-muted-foreground pt-1 border-t border-rose-500/20">
                      <strong>Policy:</strong> Every patient who has a doctor consultation or therapy session must have their invoice settled (Paid or marked Due) at the Cashier Register before leaving the center.
                    </p>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center gap-2.5 text-xs">
                    <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="font-semibold text-emerald-800 dark:text-emerald-200">
                      Billing Clearance Verified: All sessions are invoiced (Paid or Due recorded on file).
                    </span>
                  </div>
                )}

                {/* Checkout Notes */}
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-foreground">
                    Checkout Notes (Optional)
                  </Label>
                  <Input
                    value={checkoutNotes}
                    onChange={(e) => setCheckoutNotes(e.target.value)}
                    placeholder="e.g. Advised 5-day therapy course, prescribed medication collected"
                    className="h-9 text-xs rounded-xl"
                  />
                </div>

                {/* Authorizing Receptionist Performer Select */}
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
                  onClick={() => setCheckoutModalApt(null)}
                  disabled={isSubmittingCheckout}
                  className="rounded-xl h-8.5 text-xs cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={
                    isSubmittingCheckout ||
                    !checkoutClearance.canCheckout ||
                    !activePin ||
                    activePin.length !== 4
                  }
                  className="rounded-xl h-8.5 text-xs font-bold gap-1.5 bg-rose-600 hover:bg-rose-700 text-white shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingCheckout ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      <span>Checking Out...</span>
                    </>
                  ) : (
                    <>
                      <LogOut className="size-3.5" />
                      <span>Confirm &amp; Check Out Patient</span>
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
