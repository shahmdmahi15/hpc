"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { useRealtime } from "@/hooks/use-realtime";
import {
  getDailySerials,
  bookSerial,
  checkInPatient,
  updateSerialStatus,
} from "@/actions/serials";
import {
  searchPatients,
  createPatient,
  getAllPatients,
  getNextSuggestedPatientId,
} from "@/actions/patients";
import { getDailyCashLedger } from "@/actions/billing";
import {
  formatBSTTime,
  formatBSTShortDate,
  getBSTDateString,
} from "@/lib/date";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  UserPlus,
  Search,
  CheckCircle2,
  Clock,
  DollarSign,
  Users,
  AlertCircle,
  RefreshCw,
  PhoneCall,
  UserCheck,
  BookOpen,
  Plus,
  Calendar,
  DoorOpen,
} from "lucide-react";
import {
  Gender,
  SerialStatus,
  VisitType,
  HourlySlot,
  PaymentMethod,
} from "@/generated/prisma/enums";
import { getAllRoomsWithOccupancy } from "@/actions/rooms";
import { RoomSelect } from "@/components/rooms/room-select";
import { RoomOccupancyDashboard } from "@/components/rooms/room-occupancy-dashboard";
import {
  validatePatientForm,
  validateSerialBooking,
  validatePaymentInput,
} from "@/lib/validation";
import { SlotTicketPicker } from "@/components/booking/slot-ticket-picker";
import { DailySlotScheduleMatrix } from "@/components/booking/daily-slot-schedule-matrix";
import { Ticket } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface ReceptionistWorkspaceProps {
  initialSerials: Awaited<ReturnType<typeof getDailySerials>>;
  initialLedger: Awaited<ReturnType<typeof getDailyCashLedger>>;
}

type ReceptionistSerial = NonNullable<
  Awaited<ReturnType<typeof getDailySerials>>
>[number];
type PatientItem =
  | NonNullable<Awaited<ReturnType<typeof getAllPatients>>>[number]
  | NonNullable<Awaited<ReturnType<typeof searchPatients>>>[number]
  | NonNullable<
      NonNullable<Awaited<ReturnType<typeof createPatient>>>["patient"]
    >;

const VISIT_TYPE_LABELS: Record<VisitType, string> = {
  [VisitType.NEW_CONSULTATION]: "New Consultation (নতুন ভিজিট)",
  [VisitType.FOLLOW_UP]: "Follow-up Therapy (চলমান থেরাপি)",
  [VisitType.REPORT_REVIEW]: "Report Review (রিপোর্ট পর্যালোচনা)",
  [VisitType.THERAPY_PROCEDURE]: "Therapy Procedure (থেরাপি পদ্ধতি)",
  [VisitType.EMERGENCY]: "Emergency (জরুরী)",
};

const GENDER_LABELS: Record<Gender, string> = {
  [Gender.MALE]: "Male (পুরুষ)",
  [Gender.FEMALE]: "Female (মহিলা)",
  [Gender.OTHER]: "Other",
};

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  [PaymentMethod.CASH]: "Cash (নগদ)",
  [PaymentMethod.MOBILE_BANKING]: "bKash / Nagad / Rocket",
  [PaymentMethod.CARD]: "Card (কার্ড)",
  [PaymentMethod.OTHER]: "Other (অন্যান্য)",
  [PaymentMethod.INSURANCE]: "Insurance (বীমা)",
};

export function ReceptionistWorkspace({
  initialSerials,
  initialLedger,
}: ReceptionistWorkspaceProps) {
  const { t } = useI18n();
  const [selectedDate, setSelectedDate] = useState(() => getBSTDateString());
  const [serials, setSerials] = useState(initialSerials);
  const [ledger, setLedger] = useState(initialLedger);
  const [roomsData, setRoomsData] = useState<Awaited<
    ReturnType<typeof getAllRoomsWithOccupancy>
  > | null>(null);
  const [activeTab, setActiveTab] = useState<
    "serials" | "ledger" | "directory" | "chambers" | "slots"
  >("serials");
  const [allPatientsList, setAllPatientsList] = useState<PatientItem[]>([]);

  const [isPending, startTransition] = useTransition();

  // Search & Patient selection
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PatientItem[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientItem | null>(
    null,
  );

  // Modals
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isBookOpen, setIsBookOpen] = useState(false);
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
  const [checkInSerial, setCheckInSerial] = useState<ReceptionistSerial | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState("");

  // Validation Errors
  const [patientErrors, setPatientErrors] = useState<Record<string, string>>(
    {},
  );
  const [bookErrors, setBookErrors] = useState<Record<string, string>>({});
  const [checkInErrors, setCheckInErrors] = useState<Record<string, string>>(
    {},
  );

  // New Patient Form (Step 1)
  const [patientForm, setPatientForm] = useState<{
    patientId: string;
    name: string;
    phone: string;
    age: string;
    gender: Gender;
    address: string;
    occupation: string;
    notes: string;
  }>({
    patientId: "",
    name: "",
    phone: "",
    age: "",
    gender: Gender.MALE,
    address: "",
    occupation: "",
    notes: "",
  });

  // Pure Scheduling Form (No Payment collected during phone booking)
  const [bookForm, setBookForm] = useState<{
    date: string;
    toldTime: string;
    timeSlot: string;
    hourlySlot: HourlySlot;
    type: VisitType;
    isReport: boolean;
    notes: string;
    roomNo: string;
  }>({
    date: getBSTDateString(),
    toldTime: "14:00",
    timeSlot: "02:00 - 03:00 PM",
    hourlySlot: HourlySlot.SLOT_02_03,
    type: VisitType.NEW_CONSULTATION,
    isReport: false,
    notes: "",
    roomNo: "207",
  });

  // Physical Arrival Check-in & Payment Form (Step 2)
  const [checkInForm, setCheckInForm] = useState<{
    paidAmount: number;
    isNoPayment: boolean;
    paymentMethod: PaymentMethod;
    roomNo: string;
  }>({
    paidAmount: 500,
    isNoPayment: false,
    paymentMethod: PaymentMethod.CASH,
    roomNo: "207",
  });

  // Load directory
  const loadPatientsData = useCallback(async () => {
    try {
      const all = await getAllPatients();
      setAllPatientsList(all);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    getAllPatients()
      .then((patients) => {
        if (isMounted) setAllPatientsList(patients);
      })
      .catch(console.error);
    getAllRoomsWithOccupancy(selectedDate)
      .then((rooms) => {
        if (isMounted) setRoomsData(rooms);
      })
      .catch(console.error);
    return () => {
      isMounted = false;
    };
  }, [selectedDate]);

  const refreshData = useCallback(
    (targetDate?: string) => {
      const dateToFetch = targetDate || selectedDate;
      startTransition(async () => {
        try {
          const [updatedSerials, updatedLedger, updatedRooms] =
            await Promise.all([
              getDailySerials(dateToFetch),
              getDailyCashLedger(dateToFetch),
              getAllRoomsWithOccupancy(dateToFetch),
            ]);
          setSerials(updatedSerials);
          setLedger(updatedLedger);
          setRoomsData(updatedRooms);
          loadPatientsData();
        } catch (err) {
          console.error("Failed to refresh receptionist data", err);
        }
      });
    },
    [selectedDate, loadPatientsData],
  );

  useRealtime({
    onRefresh: () => refreshData(selectedDate),
  });

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    refreshData(newDate);
  };

  // Quick Patient Search
  const handleSearch = async (val: string) => {
    setSearchQuery(val);
    if (!val.trim()) {
      setSearchResults([]);
      return;
    }
    const results = await searchPatients(val);
    setSearchResults(results);
  };

  const handleSelectPatientForBooking = (patient: PatientItem) => {
    setSelectedPatient(patient);
    setBookErrors({});
    setErrorMessage("");
    setBookForm((prev) => ({
      ...prev,
      date: selectedDate,
      roomNo: "",
      type:
        "serials" in patient &&
        Array.isArray(patient.serials) &&
        patient.serials.length > 0
          ? VisitType.FOLLOW_UP
          : VisitType.NEW_CONSULTATION,
    }));
    setIsBookOpen(true);
  };

  const handleRegisterPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setPatientErrors({});

    const valResult = validatePatientForm({
      patientId: patientForm.patientId,
      name: patientForm.name,
      phone: patientForm.phone,
      age: patientForm.age,
      gender: patientForm.gender,
    });

    if (!valResult.isValid) {
      setPatientErrors(valResult.errors);
      setErrorMessage("Please correct the form errors before proceeding.");
      return;
    }

    const res = await createPatient({
      patientId: patientForm.patientId.trim(),
      name: patientForm.name.trim(),
      phone: patientForm.phone.trim(),
      age: patientForm.age ? parseInt(patientForm.age) : undefined,
      gender: patientForm.gender,
      address: patientForm.address.trim() || undefined,
      occupation: patientForm.occupation.trim() || undefined,
      notes: patientForm.notes.trim() || undefined,
    });

    if (res.error) {
      setErrorMessage(res.error);
      return;
    }

    if (res.patient) {
      toast.success(
        `Patient #${res.patient.patientId} registered successfully!`,
      );
      setSelectedPatient(res.patient);
      setIsRegisterOpen(false);
      setBookErrors({});
      setBookForm((prev) => ({
        ...prev,
        date: selectedDate,
        roomNo: "",
      }));
      setIsBookOpen(true);
      setPatientForm({
        patientId: "",
        name: "",
        phone: "",
        age: "",
        gender: Gender.MALE,
        address: "",
        occupation: "",
        notes: "",
      });
      refreshData();
    }
  };

  // Pure Scheduling Booking (No payment at phone call step)
  const handleBookSerial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;
    setErrorMessage("");
    setBookErrors({});

    const valResult = validateSerialBooking({
      date: bookForm.date,
      toldTime: bookForm.toldTime,
      roomNo: bookForm.roomNo,
      patientId: selectedPatient.id,
    });

    if (!valResult.isValid) {
      setBookErrors(valResult.errors);
      setErrorMessage("Please correct appointment details.");
      return;
    }

    const res = await bookSerial({
      patientId: selectedPatient.id,
      date: bookForm.date,
      toldTime: bookForm.toldTime,
      timeSlot: bookForm.timeSlot,
      hourlySlot: bookForm.hourlySlot,
      gender: selectedPatient.gender,
      type: bookForm.type,
      fee: 500,
      isReport: bookForm.isReport,
      notes: bookForm.notes.trim() || undefined,
    });

    if (res.error) {
      setErrorMessage(res.error);
      toast.error(res.error);
      return;
    }

    toast.success("Serial booked successfully!");
    setIsBookOpen(false);
    setSelectedPatient(null);
    refreshData();
  };

  // Open Check-in & Payment Modal when patient physically arrives
  const handleOpenCheckInModal = (serial: ReceptionistSerial) => {
    setCheckInSerial(serial);
    setCheckInForm({
      paidAmount: serial.fee || 500,
      isNoPayment: false,
      paymentMethod: PaymentMethod.CASH,
      roomNo: (serial.roomNo || "").replace(/[^0-9]/g, "") || "207",
    });
    setIsCheckInModalOpen(true);
  };

  // Submit Physical Arrival & Record Payment/N.P
  const handleConfirmArrivalCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkInSerial) return;
    setCheckInErrors({});

    const valResult = validatePaymentInput({
      paidAmount: Number(checkInForm.paidAmount),
      isNoPayment: checkInForm.isNoPayment,
    });

    if (!valResult.isValid) {
      setCheckInErrors(valResult.errors);
      return;
    }

    await checkInPatient({
      serialId: checkInSerial.id,
      paidAmount: checkInForm.isNoPayment ? 0 : Number(checkInForm.paidAmount),
      isNoPayment: checkInForm.isNoPayment,
      paymentMethod: checkInForm.paymentMethod,
      roomNo: checkInForm.roomNo || "207",
    });

    toast.success("Arrival recorded & queue status updated!");
    setIsCheckInModalOpen(false);
    setCheckInSerial(null);
    refreshData();
  };

  const handleStatusChange = async (serialId: string, status: SerialStatus) => {
    await updateSerialStatus(serialId, status);
    refreshData();
  };

  // Metrics
  const totalBooked = serials.length;
  const waitingCount = serials.filter(
    (s) =>
      s.status === SerialStatus.WAITING || s.status === SerialStatus.CHECKED_IN,
  ).length;
  const completedCount = serials.filter(
    (s) => s.status === SerialStatus.COMPLETED,
  ).length;
  const totalCashCollected = ledger.reduce(
    (acc, curr) => acc + (curr.paidAmount || 0),
    0,
  );

  return (
    <div className="space-y-3 w-full max-w-full min-w-0 overflow-x-hidden">
      {/* Top Metrics Row (Compact & High Density) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5 min-w-0">
        <Card className="p-2 sm:p-2.5 shadow-xs border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase">
              {t("rec.scheduled_today", "Scheduled")} ({selectedDate})
            </span>
            <Users className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-lg sm:text-xl font-black mt-0.5 font-mono text-foreground">
            {totalBooked}
          </p>
          <span className="text-[9px] sm:text-[10px] text-muted-foreground block">
            {t("rec.total_registered", "Total Serials")}
          </span>
        </Card>

        <Card className="p-2 sm:p-2.5 shadow-xs border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase">
              {t("rec.waiting_room", "Waiting Room")}
            </span>
            <Clock className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-lg sm:text-xl font-black mt-0.5 font-mono text-foreground">
            {waitingCount}
          </p>
          <span className="text-[9px] sm:text-[10px] text-muted-foreground block">
            {t("status.waiting", "Waiting")} &bull; Room 205
          </span>
        </Card>

        <Card className="p-2 sm:p-2.5 shadow-xs border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase">
              {t("rec.completed_today", "Completed Today")}
            </span>
            <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-lg sm:text-xl font-black mt-0.5 font-mono text-foreground">
            {completedCount}
          </p>
          <span className="text-[9px] sm:text-[10px] text-muted-foreground block">
            {t("status.completed", "Completed")}
          </span>
        </Card>

        <Card className="p-2 sm:p-2.5 shadow-xs border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase">
              {t("rec.cash_collection", "Cash Collection (BST)")}
            </span>
            <DollarSign className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-lg sm:text-xl font-black mt-0.5 font-mono text-primary">
            ৳{totalCashCollected.toLocaleString()}
          </p>
          <span className="text-[9px] sm:text-[10px] text-muted-foreground block">
            {t("col.cash_received", "Cash Received")}
          </span>
        </Card>
      </div>

      {/* Action Header, Date Filter & Search (Compact Single Bar) */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2 bg-card p-1.5 sm:p-2 rounded-xl border border-border shadow-xs max-w-full min-w-0">
        {/* Navigation Tabs (Compact pills without ugly scrollbar) */}
        <div className="flex items-center gap-1 bg-muted/70 p-0.5 rounded-lg overflow-x-auto min-w-0 shrink-0 scrollbar-none [&::-webkit-scrollbar]:hidden">
          <button
            onClick={() => setActiveTab("serials")}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "serials"
                ? "bg-card text-primary shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("nav.serials", "Daily Serials")}
          </button>
          <button
            onClick={() => setActiveTab("directory")}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ${
              activeTab === "directory"
                ? "bg-card text-primary shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BookOpen className="h-3 w-3" />
            <span>{t("nav.patients", "Patients Directory")}</span>
          </button>
          <button
            onClick={() => setActiveTab("ledger")}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "ledger"
                ? "bg-card text-primary shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("nav.ledger", "Cash Ledger")}
          </button>
          <button
            onClick={() => setActiveTab("chambers")}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ${
              activeTab === "chambers"
                ? "bg-card text-primary shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <DoorOpen className="h-3 w-3" />
            <span>{t("nav.chambers", "Chambers & Bays")}</span>
          </button>
          <button
            onClick={() => setActiveTab("slots")}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ${
              activeTab === "slots"
                ? "bg-card text-primary shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Ticket className="h-3 w-3" />
            <span>{t("nav.slot_matrix", "Slot Matrix")}</span>
          </button>
        </div>

        {/* Right Tools Bar (Date, Search, Refresh) */}
        <div className="flex items-center gap-1.5 w-full lg:w-auto justify-between lg:justify-end min-w-0">
          {/* Appointment Date Picker */}
          <div className="flex items-center gap-1 bg-background border border-input px-2 py-0.5 rounded-lg shadow-xs shrink-0 h-7.5">
            <Calendar className="h-3 w-3 text-primary shrink-0" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase hidden sm:inline">
              Date:
            </span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="bg-transparent text-xs font-bold text-foreground focus:outline-none cursor-pointer"
            />
          </div>

          {/* Search Input for Old Patients */}
          <div className="relative flex-1 lg:w-56 min-w-[130px]">
            <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search ID, Name..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-7.5 h-7.5 text-xs"
            />
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={() => refreshData(selectedDate)}
            title="Refresh"
            className="h-7.5 w-7.5 cursor-pointer shrink-0"
          >
            <RefreshCw
              className={`h-3 w-3 ${isPending ? "animate-spin text-primary" : ""}`}
            />
          </Button>
        </div>
      </div>

      {/* Search Results Dropdown List */}
      {searchResults.length > 0 && (
        <Card className="p-3 shadow-lg border-primary/30 bg-card">
          <div className="text-xs font-bold text-primary mb-2 flex items-center justify-between">
            <span>Found {searchResults.length} Matching Patient(s)</span>
            <span className="text-[10px] text-muted-foreground">
              Click patient card to schedule serial
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {searchResults.map((p) => (
              <div
                key={p.id}
                onClick={() => {
                  handleSelectPatientForBooking(p);
                  setSearchResults([]);
                  setSearchQuery("");
                }}
                className="p-2.5 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-xs text-foreground">
                    {p.name}
                  </div>
                  <Badge
                    variant="outline"
                    className="font-mono text-[10px] font-bold text-primary"
                  >
                    #{p.patientId}
                  </Badge>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {p.phone} &bull; {p.gender} &bull; {p.address || "No address"}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* VIEW 1: Daily Serial Schedule */}
      {activeTab === "serials" && (
        <Card className="shadow-xs border-border bg-card">
          <CardHeader className="p-3 pb-2 px-3 sm:px-4">
            <CardTitle className="text-xs sm:text-sm font-bold flex items-center justify-between flex-wrap gap-2">
              <span>
                HPC Daily Patient Serial Register &bull; {selectedDate}
              </span>
              <div className="flex items-center gap-1.5">
                <Badge
                  variant="outline"
                  className="font-mono text-[10px] px-2 py-0.5"
                >
                  {serials.length} {t("rec.total_registered", "Total Serials")}
                </Badge>
                <Button
                  onClick={() => setIsRegisterOpen(true)}
                  size="sm"
                  className="h-7 text-xs font-bold gap-1 cursor-pointer shadow-xs"
                >
                  <UserPlus className="h-3 w-3" />
                  <span>{t("rec.new_patient", "New Patient")}</span>
                </Button>
              </div>
            </CardTitle>
            <CardDescription className="text-[11px]">
              When patient physically arrives, click &quot;Check-In &amp;
              Payment&quot; to stamp arrival time and record desk payment or
              N.P.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 px-2 sm:px-4 pb-3">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[720px]">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="pb-2 font-semibold w-12">
                      {t("col.serial", "Serial")}
                    </th>
                    <th className="pb-2 font-semibold">
                      {t("col.date", "Date")}
                    </th>
                    <th className="pb-2 font-semibold">
                      {t("col.patient_details", "Patient Details")}
                    </th>
                    <th className="pb-2 font-semibold">
                      {t("col.phone", "Phone Number")}
                    </th>
                    <th className="pb-2 font-semibold">
                      {t("col.told_time", "Told Time")}
                    </th>
                    <th className="pb-2 font-semibold">
                      {t("col.arrival_status", "Arrival & Status")}
                    </th>
                    <th className="pb-2 font-semibold">
                      {t("col.billing_payment", "Billing & Payment")}
                    </th>
                    <th className="pb-2 font-semibold">
                      {t("col.queue_status", "Queue Status")}
                    </th>
                    <th className="pb-2 font-semibold text-right">
                      {t("col.action", "Action")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {serials.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="py-6 text-center text-muted-foreground text-xs"
                      >
                        No patient serials registered for {selectedDate}. Use
                        search or directory to book.
                      </td>
                    </tr>
                  ) : (
                    serials.map((s) => (
                      <tr
                        key={s.id}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-2 font-mono font-black text-sm text-primary">
                          #{s.serialNumber}
                        </td>
                        <td className="py-2 font-mono text-muted-foreground font-semibold text-[11px]">
                          {formatBSTShortDate(s.date)}
                        </td>
                        <td className="py-2">
                          <div className="font-bold text-foreground">
                            {s.patient.name}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            ID: #{s.patient.patientId} &bull; {s.patient.gender}
                          </div>
                        </td>
                        <td className="py-2 font-mono text-muted-foreground text-[11px]">
                          {s.patient.phone}
                        </td>
                        <td className="py-2 font-medium text-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span>
                              {s.toldTime
                                ? formatBSTTime(s.toldTime)
                                : s.timeSlot || "Scheduled"}
                            </span>
                          </div>
                        </td>
                        <td className="py-3">
                          {s.inTime ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono text-[11px] font-semibold text-foreground">
                                {formatBSTTime(s.inTime)}
                              </span>
                              {s.punctualityStatus === "ON_TIME" && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                  On-Time
                                </span>
                              )}
                              {s.punctualityStatus === "MODERATE_LATE" && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                  Late (+{s.latenessMinutes}m)
                                </span>
                              )}
                              {s.punctualityStatus === "SEVERE_LATE" && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-destructive/15 text-destructive border border-destructive/30">
                                  Severe Delay (+{s.latenessMinutes}m)
                                </span>
                              )}
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              className="h-7 text-[11px] gap-1 cursor-pointer font-bold bg-primary text-primary-foreground shadow-xs hover:bg-primary/90"
                              onClick={() => handleOpenCheckInModal(s)}
                            >
                              <UserCheck className="h-3.5 w-3.5" />
                              <span>Check-In &amp; Pay</span>
                            </Button>
                          )}
                        </td>
                        <td className="py-3">
                          {s.isPackageCovered ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] text-muted-foreground font-semibold"
                            >
                              N.P (No Payment)
                            </Badge>
                          ) : s.paidAmount > 0 ? (
                            <span className="font-mono font-bold text-primary text-xs">
                              ৳{s.paidAmount} Paid
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground italic">
                              Unpaid (Not arrived)
                            </span>
                          )}
                        </td>
                        <td className="py-3">
                          <Badge
                            variant={
                              s.status === SerialStatus.IN_CONSULTATION ||
                              s.status === SerialStatus.IN_THERAPY
                                ? "default"
                                : s.status === SerialStatus.WAITING
                                  ? "secondary"
                                  : "outline"
                            }
                            className="text-[10px] font-bold"
                          >
                            {s.status.replace("_", " ")}
                          </Badge>
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {s.status !== SerialStatus.COMPLETED &&
                              s.status !== SerialStatus.CANCELLED && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-[11px] text-destructive hover:bg-destructive/10 cursor-pointer"
                                  onClick={() =>
                                    handleStatusChange(
                                      s.id,
                                      SerialStatus.CANCELLED,
                                    )
                                  }
                                >
                                  Cancel
                                </Button>
                              )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* VIEW 2: All Registered Patients Directory (Easy Serial Booking for ANY Patient) */}
      {activeTab === "directory" && (
        <Card className="shadow-md border-border bg-card">
          <CardHeader className="pb-3 px-4 sm:px-6">
            <CardTitle className="text-sm sm:text-base font-bold flex items-center justify-between flex-wrap gap-2">
              <span>All Registered Patients Directory</span>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="font-mono text-xs px-2.5 py-1"
                >
                  {allPatientsList.length} Total Patients
                </Badge>
                <Button
                  onClick={() => setIsRegisterOpen(true)}
                  size="sm"
                  className="h-8 text-xs font-bold gap-1.5 cursor-pointer shadow-xs"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>New Patient</span>
                </Button>
              </div>
            </CardTitle>
            <CardDescription className="text-xs">
              List of all registered patients. Click &quot;Book Serial&quot; on
              any patient to schedule an appointment.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[700px]">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="pb-3 font-semibold w-16">Patient ID</th>
                    <th className="pb-3 font-semibold">Full Name</th>
                    <th className="pb-3 font-semibold">Phone Number</th>
                    <th className="pb-3 font-semibold">Gender &amp; Age</th>
                    <th className="pb-3 font-semibold">Address</th>
                    <th className="pb-3 font-semibold">
                      Status ({selectedDate})
                    </th>
                    <th className="pb-3 font-semibold text-right">
                      Serial Booking
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {allPatientsList.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-8 text-center text-muted-foreground"
                      >
                        No registered patients in directory.
                      </td>
                    </tr>
                  ) : (
                    allPatientsList.map((p) => {
                      const todaySerial =
                        "serials" in p && Array.isArray(p.serials)
                          ? p.serials[0]
                          : undefined;
                      return (
                        <tr
                          key={p.id}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          <td className="py-3 font-mono font-bold text-primary">
                            #{p.patientId}
                          </td>
                          <td className="py-3 font-bold text-foreground">
                            {p.name}
                          </td>
                          <td className="py-3 font-mono text-muted-foreground">
                            {p.phone}
                          </td>
                          <td className="py-3 text-muted-foreground">
                            {p.gender} {p.age ? `(${p.age}y)` : ""}
                          </td>
                          <td className="py-3 text-muted-foreground">
                            {p.address || "-"}
                          </td>
                          <td className="py-3">
                            {todaySerial ? (
                              <Badge variant="default" className="text-[10px]">
                                Serial #{todaySerial.serialNumber} Booked
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-[10px] text-muted-foreground"
                              >
                                No Serial Today
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 text-right">
                            <Button
                              size="sm"
                              className="h-7 text-[11px] gap-1 cursor-pointer font-bold"
                              onClick={() => handleSelectPatientForBooking(p)}
                            >
                              <Plus className="h-3 w-3" />
                              <span>
                                {todaySerial ? "Book Another" : "Book Serial"}
                              </span>
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* VIEW 3: Daily Cash Ledger */}
      {activeTab === "ledger" && (
        <Card className="shadow-md border-border bg-card">
          <CardHeader className="pb-3 px-4 sm:px-6">
            <CardTitle className="text-sm sm:text-base font-bold flex items-center justify-between flex-wrap gap-2">
              <span>
                Official Daily Cash Collection Sheet &bull; {selectedDate}
              </span>
              <div className="text-sm font-bold font-mono text-primary">
                Total Collection: ৳{totalCashCollected.toLocaleString()}
              </div>
            </CardTitle>
            <CardDescription className="text-xs">
              HPC Desk Cashier register for {selectedDate} (SL NO, NAME, TAKA,
              CASHIER, CEO)
            </CardDescription>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[650px]">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="pb-3 font-semibold w-16">SL NO</th>
                    <th className="pb-3 font-semibold">PATIENT NAME</th>
                    <th className="pb-3 font-semibold">AMOUNT (TAKA)</th>
                    <th className="pb-3 font-semibold">CASHIER</th>
                    <th className="pb-3 font-semibold">CEO AUDIT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {ledger.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-8 text-center text-muted-foreground"
                      >
                        No cash transactions recorded for {selectedDate}.
                      </td>
                    </tr>
                  ) : (
                    ledger.map((item, idx) => (
                      <tr
                        key={item.id}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-3 font-mono font-bold text-muted-foreground">
                          {String(idx + 1).padStart(2, "0")}.
                        </td>
                        <td className="py-3">
                          <div className="font-bold text-foreground">
                            {item.patient.name}
                          </div>
                          <div className="text-[11px] text-muted-foreground font-mono">
                            ID: #{item.patient.patientId}
                          </div>
                        </td>
                        <td className="py-3 font-mono font-bold">
                          {item.isPackageCovered ? (
                            <Badge variant="secondary" className="text-[10px]">
                              N.P (No Payment Made)
                            </Badge>
                          ) : (
                            <span className="text-primary text-sm font-bold">
                              ৳{item.paidAmount}
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-muted-foreground">
                          {item.cashier?.name || "Front Desk"}
                        </td>
                        <td className="py-3">
                          {item.auditedBy ? (
                            <span className="inline-flex items-center gap-1 text-primary font-semibold text-[11px]">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>Approved ({item.auditedBy.name})</span>
                            </span>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">
                              Pending CEO Audit
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* VIEW 4: Live Chambers & Therapy Bays (Rooms 201 to 220) */}
      {activeTab === "chambers" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-foreground">
                Chambers &amp; Therapy Bay Realtime Occupancy
              </h2>
              <p className="text-xs text-muted-foreground">
                Live monitoring of clinic chambers and therapy bays.
              </p>
            </div>
          </div>
          <RoomOccupancyDashboard initialData={roomsData ?? undefined} />
        </div>
      )}

      {/* VIEW 5: Daily 10-Slot Ticket Matrix (Max 6 patients per slot) */}
      {activeTab === "slots" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Ticket className="h-4 w-4 text-primary" />
                <span>Daily Slot Booking Matrix ({selectedDate})</span>
              </h2>
              <p className="text-xs text-muted-foreground">
                10 hourly slots from 10:00 AM to 08:00 PM with strict 6-patient
                max capacity per slot.
              </p>
            </div>
          </div>
          <DailySlotScheduleMatrix selectedDate={selectedDate} />
        </div>
      )}

      {/* DIALOG 1: Register New Patient (Robust Shadcn Modal) */}
      <Dialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen}>
        <DialogContent className="sm:max-w-xl md:max-w-2xl bg-card w-[95vw] sm:w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              <span>{t("patient.register_title", "Register New Patient")}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t(
                "patient.register_desc",
                "Fill in required patient credentials to generate physical card & profile.",
              )}
            </DialogDescription>
          </DialogHeader>

          {errorMessage && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleRegisterPatient} className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-foreground">
                    {t("patient.id", "Patient 5-Digit ID")}{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1 text-[10px] font-mono text-primary hover:text-primary/80 font-bold"
                    onClick={async () => {
                      try {
                        const nextId = await getNextSuggestedPatientId();
                        setPatientForm((prev) => ({
                          ...prev,
                          patientId: nextId,
                        }));
                        if (patientErrors.patientId) {
                          setPatientErrors((prev) => ({
                            ...prev,
                            patientId: "",
                          }));
                        }
                      } catch {
                        // ignore
                      }
                    }}
                  >
                    + {t("patient.auto_generate", "Auto Generate")}
                  </Button>
                </div>
                <Input
                  placeholder="e.g. 10001"
                  maxLength={5}
                  value={patientForm.patientId}
                  onChange={(e) => {
                    const cleaned = e.target.value
                      .replace(/[^0-9]/g, "")
                      .slice(0, 5);
                    setPatientForm({
                      ...patientForm,
                      patientId: cleaned,
                    });
                    if (patientErrors.patientId) {
                      setPatientErrors((prev) => ({ ...prev, patientId: "" }));
                    }
                  }}
                  className={`font-mono font-bold ${
                    patientErrors.patientId
                      ? "border-destructive text-destructive"
                      : ""
                  }`}
                  required
                />
                {patientErrors.patientId && (
                  <p className="text-[11px] text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    <span>{patientErrors.patientId}</span>
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">
                  {t("patient.name", "Full Name")}{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="e.g. Umme Habiba / Abdul Khaleque"
                  value={patientForm.name}
                  onChange={(e) => {
                    setPatientForm({ ...patientForm, name: e.target.value });
                    if (patientErrors.name) {
                      setPatientErrors((prev) => ({ ...prev, name: "" }));
                    }
                  }}
                  className={
                    patientErrors.name
                      ? "border-destructive text-destructive"
                      : ""
                  }
                  required
                />
                {patientErrors.name && (
                  <p className="text-[11px] text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    <span>{patientErrors.name}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">
                  {t("patient.phone", "Phone Number")}{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="01973-818213"
                  value={patientForm.phone}
                  onChange={(e) => {
                    setPatientForm({ ...patientForm, phone: e.target.value });
                    if (patientErrors.phone) {
                      setPatientErrors((prev) => ({ ...prev, phone: "" }));
                    }
                  }}
                  className={`font-mono ${
                    patientErrors.phone
                      ? "border-destructive text-destructive"
                      : ""
                  }`}
                  required
                />
                {patientErrors.phone && (
                  <p className="text-[11px] text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    <span>{patientErrors.phone}</span>
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">
                  {t("patient.age", "Age")}
                </Label>
                <Input
                  type="number"
                  placeholder="e.g. 28"
                  min={0}
                  max={125}
                  value={patientForm.age}
                  onChange={(e) => {
                    setPatientForm({ ...patientForm, age: e.target.value });
                    if (patientErrors.age) {
                      setPatientErrors((prev) => ({ ...prev, age: "" }));
                    }
                  }}
                  className={
                    patientErrors.age
                      ? "border-destructive text-destructive"
                      : ""
                  }
                />
                {patientErrors.age && (
                  <p className="text-[11px] text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    <span>{patientErrors.age}</span>
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">
                  {t("patient.gender", "Gender")}{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={patientForm.gender}
                  onValueChange={(val) =>
                    setPatientForm({
                      ...patientForm,
                      gender: val as Gender,
                    })
                  }
                >
                  <SelectTrigger className="w-full h-9 text-xs">
                    <SelectValue placeholder="Select Gender">
                      {patientForm.gender
                        ? GENDER_LABELS[patientForm.gender]
                        : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={Gender.MALE}>
                      {t("gender.male", "Male (পুরুষ)")}
                    </SelectItem>
                    <SelectItem value={Gender.FEMALE}>
                      {t("gender.female", "Female (মহিলা)")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">
                  {t("patient.address", "Address / Location")}
                </Label>
                <Input
                  placeholder="e.g. Mostofapur / Jhenaidah"
                  value={patientForm.address}
                  onChange={(e) =>
                    setPatientForm({ ...patientForm, address: e.target.value })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">
                  {t("patient.occupation", "Occupation")}
                </Label>
                <Input
                  placeholder="Service / Business / Housewife"
                  value={patientForm.occupation}
                  onChange={(e) =>
                    setPatientForm({
                      ...patientForm,
                      occupation: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                {t("patient.notes", "Clinical Remarks / Notes")}
              </Label>
              <Input
                placeholder="Referred by Dr. / Chronic Back Pain"
                value={patientForm.notes}
                onChange={(e) =>
                  setPatientForm({ ...patientForm, notes: e.target.value })
                }
              />
            </div>

            <DialogFooter className="pt-3 flex flex-row items-center justify-end gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsRegisterOpen(false)}
                className="cursor-pointer"
              >
                {t("btn.cancel", "Cancel")}
              </Button>
              <Button
                type="submit"
                className="font-bold cursor-pointer shadow-xs"
              >
                {t("patient.save_proceed", "Save & Proceed to Booking")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG 2: Schedule Queue Serial (Pure Booking - No Payment) */}
      <Dialog open={isBookOpen} onOpenChange={setIsBookOpen}>
        <DialogContent className="sm:max-w-3xl md:max-w-4xl bg-card w-[96vw] sm:w-[92vw] md:w-[860px] p-4 sm:p-6 max-h-[92vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <PhoneCall className="h-5 w-5 text-primary" />
              <span>
                {t("booking.schedule_title", "Schedule Patient Serial")}
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t(
                "booking.schedule_desc",
                "Set appointment date and promised arrival time.",
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedPatient && (
            <div className="p-3 rounded-xl bg-muted/60 border border-border text-xs space-y-1">
              <div className="font-bold text-foreground">
                {selectedPatient.name} &bull;{" "}
                <span className="font-mono text-primary font-bold">
                  #{selectedPatient.patientId}
                </span>
              </div>
              <div className="text-muted-foreground">
                Phone: {selectedPatient.phone} &bull; Gender:{" "}
                {selectedPatient.gender}{" "}
                {selectedPatient.age ? `• Age: ${selectedPatient.age}y` : ""}
              </div>
            </div>
          )}

          <form onSubmit={handleBookSerial} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-primary">
                  {t("booking.date", "Appointment Date")} *
                </Label>
                <Input
                  type="date"
                  value={bookForm.date}
                  onChange={(e) =>
                    setBookForm({ ...bookForm, date: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">
                  {t("booking.purpose", "Visit Purpose / Type")}
                </Label>
                <Select
                  value={bookForm.type}
                  onValueChange={(val) =>
                    setBookForm({
                      ...bookForm,
                      type: val as VisitType,
                    })
                  }
                >
                  <SelectTrigger className="w-full h-9 text-xs">
                    <SelectValue placeholder="Select Visit Purpose">
                      {bookForm.type
                        ? VISIT_TYPE_LABELS[bookForm.type]
                        : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={VisitType.NEW_CONSULTATION}>
                      {t(
                        "visit.new_consultation",
                        "New Consultation (নতুন ভিজিট)",
                      )}
                    </SelectItem>
                    <SelectItem value={VisitType.FOLLOW_UP}>
                      {t("visit.follow_up", "Follow-up Therapy (চলমান থেরাপি)")}
                    </SelectItem>
                    <SelectItem value={VisitType.REPORT_REVIEW}>
                      {t(
                        "visit.report_review",
                        "Report Review (রিপোর্ট পর্যালোচনা)",
                      )}
                    </SelectItem>
                    <SelectItem value={VisitType.THERAPY_PROCEDURE}>
                      {t(
                        "visit.therapy_procedure",
                        "Therapy Procedure (থেরাপি পদ্ধতি)",
                      )}
                    </SelectItem>
                    <SelectItem value={VisitType.EMERGENCY}>
                      {t("visit.emergency", "Emergency (জরুরী)")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Ticket Booking Slot Picker */}
            <SlotTicketPicker
              selectedSlot={bookForm.hourlySlot}
              selectedTime={bookForm.toldTime}
              selectedDate={bookForm.date}
              onSlotSelect={(slot, toldTime, timeSlotLabel) =>
                setBookForm({
                  ...bookForm,
                  hourlySlot: slot as HourlySlot,
                  toldTime,
                  timeSlot: timeSlotLabel,
                })
              }
              error={bookErrors.toldTime || bookErrors.hourlySlot}
            />

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                {t("booking.desk_remarks", "Desk Remarks")}
              </Label>
              <Input
                value={bookForm.notes}
                onChange={(e) =>
                  setBookForm({ ...bookForm, notes: e.target.value })
                }
                placeholder="e.g. Mostofapur / Revisit / Therapy session"
              />
            </div>

            {/* Report Checkbox */}
            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="report-review-checkbox"
                checked={bookForm.isReport}
                onCheckedChange={(checked) =>
                  setBookForm({
                    ...bookForm,
                    isReport: Boolean(checked),
                  })
                }
              />
              <Label
                htmlFor="report-review-checkbox"
                className="text-xs font-medium cursor-pointer text-foreground"
              >
                {t("booking.report_session", "Report Review Session (রিপোর্ট)")}
              </Label>
            </div>

            <DialogFooter className="pt-3 flex flex-row items-center justify-end gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsBookOpen(false)}
                className="cursor-pointer"
              >
                {t("btn.cancel", "Cancel")}
              </Button>
              <Button
                type="submit"
                className="font-bold cursor-pointer shadow-xs"
              >
                {t("booking.confirm", "Confirm Serial Booking")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG 3: Physical Arrival Check-In & Desk Payment */}
      <Dialog open={isCheckInModalOpen} onOpenChange={setIsCheckInModalOpen}>
        <DialogContent className="sm:max-w-lg md:max-w-xl bg-card w-[95vw] sm:w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" />
              <span>{t("checkin.title", "Record Arrival & Payment")}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t(
                "checkin.desc",
                "Stamps patient check-in time and records payment.",
              )}
            </DialogDescription>
          </DialogHeader>

          {checkInSerial && (
            <div className="p-3.5 rounded-xl bg-muted/60 border border-border text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-foreground text-sm">
                  {checkInSerial.patient.name}
                </span>
                <Badge variant="default" className="font-mono font-bold">
                  Serial #{checkInSerial.serialNumber}
                </Badge>
              </div>
              <div className="text-muted-foreground flex items-center justify-between">
                <span>
                  ID: #{checkInSerial.patient.patientId} &bull;{" "}
                  {checkInSerial.patient.phone}
                </span>
                <span>Room: {checkInSerial.roomNo || "205"}</span>
              </div>
              <div className="text-primary font-semibold text-[11px] pt-1 border-t border-border/60 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                <span>
                  Promised Arrival Time:{" "}
                  {checkInSerial.toldTime
                    ? formatBSTTime(checkInSerial.toldTime)
                    : checkInSerial.timeSlot}
                </span>
              </div>
            </div>
          )}

          <form onSubmit={handleConfirmArrivalCheckIn} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-foreground">
                {t("checkin.payment_collection", "Payment Collection")}
              </Label>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground font-semibold">
                    {t("checkin.amount", "Amount (৳)")}
                  </Label>
                  <Input
                    type="number"
                    value={checkInForm.paidAmount}
                    onChange={(e) =>
                      setCheckInForm({
                        ...checkInForm,
                        paidAmount: Number(e.target.value),
                        isNoPayment: false,
                      })
                    }
                    disabled={checkInForm.isNoPayment}
                    className="font-mono font-bold text-sm"
                  />
                  {checkInErrors.paidAmount && (
                    <p className="text-[10px] text-destructive font-medium">
                      {checkInErrors.paidAmount}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground font-semibold">
                    {t("checkin.method", "Payment Method")}
                  </Label>
                  <Select
                    value={checkInForm.paymentMethod}
                    onValueChange={(val) =>
                      setCheckInForm({
                        ...checkInForm,
                        paymentMethod: val as PaymentMethod,
                      })
                    }
                    disabled={checkInForm.isNoPayment}
                  >
                    <SelectTrigger className="w-full h-9 text-xs">
                      <SelectValue placeholder="Select Method">
                        {checkInForm.paymentMethod
                          ? PAYMENT_METHOD_LABELS[checkInForm.paymentMethod]
                          : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={PaymentMethod.CASH}>
                        {t("payment.cash", "Cash (নগদ)")}
                      </SelectItem>
                      <SelectItem value={PaymentMethod.MOBILE_BANKING}>
                        {t("payment.mobile", "bKash / Nagad / Rocket")}
                      </SelectItem>
                      <SelectItem value={PaymentMethod.CARD}>
                        {t("payment.card", "Card (কার্ড)")}
                      </SelectItem>
                      <SelectItem value={PaymentMethod.OTHER}>
                        {t("payment.other", "Other (অন্যান্য)")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Room Confirmation / Selection for Arrival */}
            <RoomSelect
              value={checkInForm.roomNo}
              onChange={(roomNum) =>
                setCheckInForm({ ...checkInForm, roomNo: roomNum })
              }
              genderFilter={
                checkInSerial?.patient?.gender === "MALE" ||
                checkInSerial?.patient?.gender === "FEMALE"
                  ? checkInSerial.patient.gender
                  : undefined
              }
              roomsOccupancy={roomsData?.rooms}
              label={t(
                "col.chamber_bay",
                "Assigned Chamber / Therapy Bay for this Visit",
              )}
            />

            {/* 1-Click N.P (No Payment Made) Toggle */}
            <div className="p-2.5 rounded-xl border border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="no-payment-checkbox"
                  checked={checkInForm.isNoPayment}
                  onCheckedChange={(checked) =>
                    setCheckInForm({
                      ...checkInForm,
                      isNoPayment: Boolean(checked),
                      paidAmount: checked ? 0 : 500,
                    })
                  }
                />
                <Label
                  htmlFor="no-payment-checkbox"
                  className="font-bold text-foreground text-xs cursor-pointer"
                >
                  {t("checkin.mark_np", "Mark as N.P (No Payment Made)")}
                </Label>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1 pl-6">
                {t(
                  "checkin.np_desc",
                  "Check this if patient is on a complimentary visit, package, or pending dues.",
                )}
              </p>
            </div>

            <DialogFooter className="pt-3 flex flex-row items-center justify-end gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCheckInModalOpen(false)}
                className="cursor-pointer"
              >
                {t("btn.cancel", "Cancel")}
              </Button>
              <Button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer shadow-xs"
              >
                {t("checkin.confirm", "Confirm Arrival & Save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
