"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Stethoscope,
  Clock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  DoorOpen,
  Search,
  Plus,
  X,
  Printer,
  Receipt,
  Phone,
  User,
  ShieldCheck,
  Loader2,
  Calendar,
  CreditCard,
  Users,
  LayoutGrid,
  Table as TableIcon,
  ChevronRight,
  Sparkles,
  Download,
  MapPin,
  RefreshCw,
  Ban,
  Activity,
} from "lucide-react";
import { Gender, Role } from "@/generated/prisma/enums";
import type {
  ConsultationSerialWithRelations,
} from "@/actions/receptionist/appointment.action";
import {
  bookConsultationSerialAction,
  cancelConsultationSerialAction,
  searchPatientsAction,
} from "@/actions/receptionist/patient.action";
import { DashboardDateSelector } from "@/components/ui/dashboard-date-selector";
import { ReceptionistPerformerSelect } from "@/components/receptionist/receptionist-performer-select";
import { evaluatePunctuality, formatTime12h } from "@/lib/queue-punctuality";
import { CLINIC_CONFIG } from "@/lib/clinic-config";
import { downloadElementAsPdf, printElementIsolated } from "@/lib/pdf-generator";
import { toast } from "sonner";

interface DoctorInfo {
  id: string;
  name: string | null;
  email: string | null;
  consultationFee: number;
  consultationRoomId?: string | null;
  consultationRoom?: {
    id: string;
    number: string;
    purpose: string | null;
  } | null;
}

interface PerformerInfo {
  id: string;
  name: string;
  phone: string;
  role: Role;
}

interface ConsultationSerialTabProps {
  serials: ConsultationSerialWithRelations[];
  doctors: DoctorInfo[];
  performers: PerformerInfo[];
  selectedDate: string;
  dayOfWeek: string;
  showDateSelector?: boolean;
  lastPerformerId?: string;
  onSelectPerformerId?: (id: string) => void;
  onSelectDate: (date: string) => void;
  onRefresh?: () => void;
}

export function ConsultationSerialTab({
  serials,
  doctors,
  performers,
  selectedDate,
  dayOfWeek,
  showDateSelector = false,
  lastPerformerId,
  onSelectPerformerId,
  onSelectDate,
  onRefresh,
}: ConsultationSerialTabProps) {
  // Staff Identity
  const [activePerformerId, setActivePerformerId] = React.useState<string>(
    () => lastPerformerId || (performers[0]?.id ?? ""),
  );
  const [activePin, setActivePin] = React.useState<string>("");

  // Filters & View State
  const [filterQuery, setFilterQuery] = React.useState("");
  const [selectedDoctorFilter, setSelectedDoctorFilter] = React.useState<string>("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = React.useState<string>("all");
  const [viewMode, setViewMode] = React.useState<"chambers" | "table">("chambers");

  // Modals
  const [isBookModalOpen, setIsBookModalOpen] = React.useState(false);
  const [cancelModalSerial, setCancelModalSerial] =
    React.useState<ConsultationSerialWithRelations | null>(null);
  const [cancelReason, setCancelReason] = React.useState("");
  const [isCancelling, setIsCancelling] = React.useState(false);

  const [printModalSerial, setPrintModalSerial] =
    React.useState<ConsultationSerialWithRelations | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = React.useState(false);

  // Booking Form State
  const [patientSearchQuery, setPatientSearchQuery] = React.useState("");
  const [patientSearchResults, setPatientSearchResults] = React.useState<any[]>([]);
  const [isSearchingPatient, setIsSearchingPatient] = React.useState(false);
  const [selectedPatient, setSelectedPatient] = React.useState<any | null>(null);

  const [bookDoctorId, setBookDoctorId] = React.useState<string>("");
  const [bookFee, setBookFee] = React.useState<number>(1000);
  const [bookToldTime, setBookToldTime] = React.useState<string>("");
  const [bookNotes, setBookNotes] = React.useState<string>("");
  const [isSubmittingBooking, setIsSubmittingBooking] = React.useState(false);

  // Sync performer selection
  const handlePerformerChange = (val: string | null) => {
    if (val) {
      setActivePerformerId(val);
      onSelectPerformerId?.(val);
    }
  };

  // Open booking modal with optional preselected doctor
  const handleOpenBookModal = (preselectedDocId?: string) => {
    const docId = preselectedDocId || (doctors[0]?.id ?? "");
    setBookDoctorId(docId);

    const doc = doctors.find((d) => d.id === docId);
    setBookFee(doc?.consultationFee ?? 1000);

    // Default told time to current time formatted
    const now = new Date();
    let hours = now.getHours();
    const minutes = now.getMinutes();
    const period = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    const timeStr = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${period}`;
    setBookToldTime(timeStr);

    setSelectedPatient(null);
    setPatientSearchQuery("");
    setPatientSearchResults([]);
    setBookNotes("");
    setActivePin("");
    setIsBookModalOpen(true);
  };

  // When doctor is changed in booking modal, update preset fee
  const handleDoctorChange = (docId: string | null) => {
    if (docId) {
      setBookDoctorId(docId);
      const doc = doctors.find((d) => d.id === docId);
      if (doc) {
        setBookFee(doc.consultationFee ?? 1000);
      }
    }
  };

  // Debounced patient search
  React.useEffect(() => {
    if (!patientSearchQuery.trim()) {
      setPatientSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingPatient(true);
      try {
        const results = await searchPatientsAction(patientSearchQuery);
        setPatientSearchResults(results);
      } catch (err) {
        console.error("Patient search error:", err);
      } finally {
        setIsSearchingPatient(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [patientSearchQuery]);

  // Submit Consultation Serial Booking
  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPatient) {
      toast.error("Please search and select a patient first.");
      return;
    }

    if (!bookDoctorId) {
      toast.error("Please select a doctor for consultation.");
      return;
    }

    if (!activePerformerId && performers.length > 0) {
      toast.error("Please select the authorizing receptionist staff.");
      return;
    }

    if (!activePin || activePin.length !== 4) {
      toast.error("Please enter your 4-digit receptionist security PIN.");
      return;
    }

    setIsSubmittingBooking(true);
    try {
      const res = await bookConsultationSerialAction({
        patientId: selectedPatient.id,
        doctorId: bookDoctorId,
        feeAmount: Number(bookFee) || 0,
        toldTime: bookToldTime.trim() || undefined,
        performerId: activePerformerId,
        pin: activePin,
        notes: bookNotes.trim() || undefined,
      });

      if (res.success) {
        toast.success(res.message);
        setIsBookModalOpen(false);
        setActivePin("");
        onRefresh?.();
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Failed to book consultation serial.");
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  // Submit Cancel Serial
  const handleConfirmCancel = async () => {
    if (!cancelModalSerial) return;

    if (!activePerformerId && performers.length > 0) {
      toast.error("Please select authorizing receptionist staff.");
      return;
    }

    if (!activePin || activePin.length !== 4) {
      toast.error("Please enter your 4-digit receptionist security PIN.");
      return;
    }

    setIsCancelling(true);
    try {
      const res = await cancelConsultationSerialAction({
        serialId: cancelModalSerial.id,
        performerId: activePerformerId,
        pin: activePin,
        reason: cancelReason.trim() || "Cancelled by receptionist",
      });

      if (res.success) {
        toast.success(res.message);
        setCancelModalSerial(null);
        setCancelReason("");
        setActivePin("");
        onRefresh?.();
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Failed to cancel consultation serial.");
    } finally {
      setIsCancelling(false);
    }
  };

  // Print Serial Ticket
  const handlePrintSlip = () => {
    if (!printModalSerial) return;
    printElementIsolated("consultation-serial-slip-print", {
      title: `Consultation Serial #${printModalSerial.serialNumber} - ${printModalSerial.patient.name}`,
    });
  };

  // Download PDF Slip
  const handleDownloadPdf = async () => {
    if (!printModalSerial) return;
    setIsGeneratingPdf(true);
    try {
      await downloadElementAsPdf("consultation-serial-slip-print", {
        filename: `Consultation-Serial-${printModalSerial.serialNumber}-${printModalSerial.patient.name}.pdf`,
        format: "thermal",
      });
      toast.success("Consultation ticket PDF downloaded.");
    } catch {
      toast.error("Failed to generate ticket PDF.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Telemetry Calculations (6 Statistics Cards)
  const telemetry = React.useMemo(() => {
    const total = serials.length;
    const atCashier = serials.filter(
      (s) =>
        s.status === "FORWARDED_TO_CASHIER" ||
        s.paymentStatus === "PENDING" ||
        (s.paymentStatus !== "PAID" && s.status !== "CANCELLED"),
    ).length;
    const inQueue = serials.filter((s) => s.status === "QUEUED").length;
    const inChamber = serials.filter(
      (s) => s.status === "IN_CONSULTATION" || s.status === "CALLING",
    ).length;
    const completed = serials.filter((s) => s.status === "COMPLETED").length;

    let totalInvoiced = 0;
    let totalPaid = 0;
    let totalDue = 0;

    serials.forEach((s) => {
      if (s.status !== "CANCELLED") {
        totalInvoiced += s.feeAmount || 0;
        totalPaid += s.paidAmount || 0;
        totalDue += s.dueAmount || 0;
      }
    });

    return {
      total,
      atCashier,
      inQueue,
      inChamber,
      completed,
      totalInvoiced,
      totalPaid,
      totalDue,
    };
  }, [serials]);

  // Filtered Serials
  const filteredSerials = React.useMemo(() => {
    return serials.filter((s) => {
      // Doctor filter
      if (selectedDoctorFilter !== "all" && s.doctorId !== selectedDoctorFilter) {
        return false;
      }

      // Status filter
      if (selectedStatusFilter !== "all") {
        if (selectedStatusFilter === "FORWARDED_TO_CASHIER") {
          if (s.status !== "FORWARDED_TO_CASHIER") return false;
        } else if (selectedStatusFilter === "QUEUED") {
          if (s.status !== "QUEUED") return false;
        } else if (selectedStatusFilter === "IN_CONSULTATION") {
          if (s.status !== "IN_CONSULTATION" && s.status !== "CALLING") return false;
        } else if (selectedStatusFilter === "COMPLETED") {
          if (s.status !== "COMPLETED") return false;
        } else if (selectedStatusFilter === "CANCELLED") {
          if (s.status !== "CANCELLED") return false;
        }
      }

      // Query filter
      if (filterQuery.trim()) {
        const q = filterQuery.toLowerCase().trim();
        const pName = (s.patient?.name || "").toLowerCase();
        const pPhone = (s.patient?.phone || "").toLowerCase();
        const mrn = (s.patient?.mrn || "").toLowerCase();
        const serialNum = String(s.serialNumber);
        const docName = (s.doctor?.name || "").toLowerCase();

        return (
          pName.includes(q) ||
          pPhone.includes(q) ||
          mrn.includes(q) ||
          serialNum.includes(q) ||
          docName.includes(q)
        );
      }

      return true;
    });
  }, [serials, selectedDoctorFilter, selectedStatusFilter, filterQuery]);

  // Group filtered serials by doctor
  const doctorGroups = React.useMemo(() => {
    // Start with all active doctors
    const map = new Map<
      string,
      {
        doctor: DoctorInfo;
        serials: ConsultationSerialWithRelations[];
      }
    >();

    doctors.forEach((doc) => {
      map.set(doc.id, { doctor: doc, serials: [] });
    });

    // Populate serials into doctor groups
    filteredSerials.forEach((s) => {
      if (map.has(s.doctorId)) {
        map.get(s.doctorId)!.serials.push(s);
      } else {
        // Fallback for doctor not in list
        const fallbackDoc: DoctorInfo = {
          id: s.doctorId,
          name: s.doctor?.name || "Consultant Doctor",
          email: s.doctor?.email || null,
          consultationFee: s.feeAmount || 1000,
          consultationRoom: s.doctor?.consultationRoom,
        };
        map.set(s.doctorId, { doctor: fallbackDoc, serials: [s] });
      }
    });

    // Sort serials within each doctor by serialNumber ascending
    map.forEach((grp) => {
      grp.serials.sort((a, b) => a.serialNumber - b.serialNumber);
    });

    // If specific doctor filter is active, only return that doctor
    if (selectedDoctorFilter !== "all") {
      const single = map.get(selectedDoctorFilter);
      return single ? [single] : [];
    }

    return Array.from(map.values());
  }, [doctors, filteredSerials, selectedDoctorFilter]);

  return (
    <div className="space-y-3">
      {/* ---------------------------------------------------- */}
      {/* 1. Date Navigation, Filters & Actions Bar            */}
      {/* ---------------------------------------------------- */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2.5 p-2.5 rounded-xl bg-card border border-border/80 shadow-2xs">
        {/* Left: Date Navigator or Schedule Title */}
        <div className="flex flex-wrap items-center gap-2">
          {showDateSelector ? (
            <DashboardDateSelector
              selectedDate={selectedDate}
              dayOfWeek={dayOfWeek}
              onSelectDate={onSelectDate}
              onRefresh={onRefresh}
            />
          ) : (
            <div className="flex items-center gap-2 px-1 text-xs font-semibold text-muted-foreground">
              <Stethoscope className="size-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
              <span>Consultation Serials Schedule — {dayOfWeek}</span>
            </div>
          )}
        </div>

        {/* Right: Search, Filters & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Doctor Filter */}
          <div className="w-36 sm:w-44">
            <Select
              value={selectedDoctorFilter}
              onValueChange={(val) => setSelectedDoctorFilter(val || "all")}
            >
              <SelectTrigger className="h-7.5 text-xs bg-background border-border/80">
                <SelectValue placeholder="All Doctors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  All Doctors ({doctors.length})
                </SelectItem>
                {doctors.map((d) => (
                  <SelectItem key={d.id} value={d.id} className="text-xs">
                    {d.name || "Doctor"} {d.consultationRoom ? `(R${d.consultationRoom.number})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter */}
          <div className="w-32 sm:w-36">
            <Select
              value={selectedStatusFilter}
              onValueChange={(val) => setSelectedStatusFilter(val || "all")}
            >
              <SelectTrigger className="h-7.5 text-xs bg-background border-border/80">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  All Status
                </SelectItem>
                <SelectItem value="FORWARDED_TO_CASHIER" className="text-xs">
                  At Cashier
                </SelectItem>
                <SelectItem value="QUEUED" className="text-xs">
                  In Queue
                </SelectItem>
                <SelectItem value="IN_CONSULTATION" className="text-xs">
                  In Chamber
                </SelectItem>
                <SelectItem value="COMPLETED" className="text-xs">
                  Completed
                </SelectItem>
                <SelectItem value="CANCELLED" className="text-xs">
                  Cancelled
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Live Search */}
          <div className="relative flex-1 min-w-[140px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
            <Input
              type="search"
              name="consultation_serial_filter"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Search serial, patient, phone..."
              className="pl-7 h-7.5 text-xs bg-background"
            />
            {filterQuery && (
              <button
                onClick={() => setFilterQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center rounded-lg border border-border/80 bg-muted/40 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("chambers")}
              className={`p-1 rounded-md text-xs font-medium transition-colors ${
                viewMode === "chambers"
                  ? "bg-background text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Chambers Board View"
            >
              <LayoutGrid className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`p-1 rounded-md text-xs font-medium transition-colors ${
                viewMode === "table"
                  ? "bg-background text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Table View"
            >
              <TableIcon className="size-3.5" />
            </button>
          </div>

          {/* Book Consultation Serial Button */}
          <Button
            size="sm"
            onClick={() => handleOpenBookModal()}
            className="h-7.5 px-3 text-xs font-bold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/95 shadow-xs cursor-pointer"
          >
            <Plus className="size-3.5" />
            <span>Book Serial</span>
          </Button>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 2. Top Telemetry Metrics (6 Statistics Cards)        */}
      {/* ---------------------------------------------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {/* Total Booked */}
        <Card className="border-border/80 bg-card/80 shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-1 p-2.5">
            <CardTitle className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Total Serials
            </CardTitle>
            <Stethoscope className="size-3 text-primary" />
          </CardHeader>
          <CardContent className="p-2.5 pt-0">
            <div className="text-lg sm:text-xl font-bold text-foreground">
              {telemetry.total}
            </div>
            <p className="text-[10px] text-muted-foreground whitespace-nowrap">
              Doctor consultations today
            </p>
          </CardContent>
        </Card>

        {/* At Cashier / Pending */}
        <Card className="border-border/80 bg-card/80 shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-1 p-2.5">
            <CardTitle className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              At Cashier
            </CardTitle>
            <CreditCard className="size-3 text-sky-500" />
          </CardHeader>
          <CardContent className="p-2.5 pt-0">
            <div className="text-lg sm:text-xl font-bold text-sky-600 dark:text-sky-400">
              {telemetry.atCashier}
            </div>
            <p className="text-[10px] text-muted-foreground whitespace-nowrap">
              Pending payment & invoice
            </p>
          </CardContent>
        </Card>

        {/* In Doctor Queue */}
        <Card className="border-border/80 bg-card/80 shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-1 p-2.5">
            <CardTitle className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              In Doctor Queue
            </CardTitle>
            <Users className="size-3 text-emerald-500" />
          </CardHeader>
          <CardContent className="p-2.5 pt-0">
            <div className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400">
              {telemetry.inQueue}
            </div>
            <p className="text-[10px] text-muted-foreground whitespace-nowrap">
              Cleared & waiting in hall
            </p>
          </CardContent>
        </Card>

        {/* In Chamber */}
        <Card className="border-border/80 bg-card/80 shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-1 p-2.5">
            <CardTitle className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              In Chamber
            </CardTitle>
            <DoorOpen className="size-3 text-amber-500" />
          </CardHeader>
          <CardContent className="p-2.5 pt-0">
            <div className="text-lg sm:text-xl font-bold text-amber-600 dark:text-amber-400">
              {telemetry.inChamber}
            </div>
            <p className="text-[10px] text-muted-foreground whitespace-nowrap">
              Currently consulting
            </p>
          </CardContent>
        </Card>

        {/* Completed */}
        <Card className="border-border/80 bg-card/80 shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-1 p-2.5">
            <CardTitle className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Completed
            </CardTitle>
            <CheckCircle2 className="size-3 text-indigo-500" />
          </CardHeader>
          <CardContent className="p-2.5 pt-0">
            <div className="text-lg sm:text-xl font-bold text-indigo-600 dark:text-indigo-400">
              {telemetry.completed}
            </div>
            <p className="text-[10px] text-muted-foreground whitespace-nowrap">
              Consultations finished
            </p>
          </CardContent>
        </Card>

        {/* Total Invoiced / Revenue */}
        <Card className="border-border/80 bg-card/80 shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-1 p-2.5">
            <CardTitle className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Doctor Invoiced
            </CardTitle>
            <Receipt className="size-3 text-teal-500" />
          </CardHeader>
          <CardContent className="p-2.5 pt-0">
            <div className="text-lg sm:text-xl font-bold text-teal-600 dark:text-teal-400">
              ৳{telemetry.totalInvoiced.toLocaleString()}
            </div>
            <p className="text-[10px] text-muted-foreground whitespace-nowrap">
              ৳{telemetry.totalPaid.toLocaleString()} paid • ৳{telemetry.totalDue.toLocaleString()} due
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 3. Main Content: Chambers Board vs Master Table      */}
      {/* ---------------------------------------------------- */}
      {serials.length === 0 ? (
        <Card className="border-border/80 bg-card/80 p-8 text-center flex flex-col items-center justify-center space-y-3 shadow-2xs">
          <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Stethoscope className="size-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-foreground">
              No Consultation Serials for this Date
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm">
              There are no doctor consultation serials scheduled for {selectedDate}.
              You can book a serial directly for an arriving or scheduled patient.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => handleOpenBookModal()}
            className="h-8 px-4 text-xs font-semibold gap-1.5"
          >
            <Plus className="size-3.5" />
            <span>Book Consultation Serial</span>
          </Button>
        </Card>
      ) : viewMode === "chambers" ? (
        /* STRICTLY 2 COLUMNS ON DESKTOP & TABLET: grid-cols-1 lg:grid-cols-2 */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          {doctorGroups.map(({ doctor, serials: docSerials }) => {
            const activeInChamber = docSerials.filter(
              (s) => s.status === "IN_CONSULTATION" || s.status === "CALLING",
            ).length;
            const waitingInQueue = docSerials.filter(
              (s) => s.status === "QUEUED",
            ).length;
            const pendingCashier = docSerials.filter(
              (s) => s.status === "FORWARDED_TO_CASHIER",
            ).length;

            return (
              <Card
                key={doctor.id}
                className="border-border/80 bg-card/90 shadow-2xs hover:border-border transition-all flex flex-col justify-between overflow-hidden"
              >
                {/* Chamber Card Header */}
                <CardHeader className="p-3 pb-2.5 border-b border-border/60 bg-muted/20 flex flex-row items-start justify-between space-y-0 gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <div className="size-6 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                        <Stethoscope className="size-3.5" />
                      </div>
                      <h3 className="text-xs sm:text-sm font-bold text-foreground">
                        {doctor.name || "Doctor"}
                      </h3>
                      {doctor.consultationRoom && (
                        <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 text-[10px] font-mono font-bold flex items-center gap-1">
                          <DoorOpen className="size-3" />
                          Room {doctor.consultationRoom.number}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                      <span className="font-medium text-foreground">
                        Preset Fee: ৳{(doctor.consultationFee ?? 1000).toLocaleString()}
                      </span>
                      <span>•</span>
                      <span>{docSerials.length} Booked</span>
                      {activeInChamber > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-amber-600 dark:text-amber-400 font-bold">
                            {activeInChamber} in chamber
                          </span>
                        </>
                      )}
                      {waitingInQueue > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                            {waitingInQueue} in queue
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Quick Book For This Doctor */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenBookModal(doctor.id)}
                    className="h-7 px-2 text-xs font-semibold gap-1 border-primary/30 text-primary hover:bg-primary/10 shrink-0"
                  >
                    <Plus className="size-3" />
                    <span>Book</span>
                  </Button>
                </CardHeader>

                {/* Serials List */}
                <CardContent className="p-2.5 flex-1 space-y-2">
                  {docSerials.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground space-y-1.5">
                      <p className="text-xs">No consultation serials for this doctor today.</p>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenBookModal(doctor.id)}
                        className="h-7 text-xs text-primary"
                      >
                        + Book first serial
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {docSerials.map((serial) => {
                        // Evaluate Punctuality
                        const punctuality = evaluatePunctuality(
                          serial.toldTime,
                          serial.visit?.checkInTime || serial.createdAt,
                        );

                        const isCancelled = serial.status === "CANCELLED";
                        const isCompleted = serial.status === "COMPLETED";

                        return (
                          <div
                            key={serial.id}
                            className={`p-2 sm:p-2.5 rounded-lg border transition-all ${
                              isCancelled
                                ? "bg-muted/30 border-border/40 opacity-60"
                                : serial.status === "IN_CONSULTATION"
                                  ? "bg-amber-500/10 border-amber-500/30"
                                  : serial.status === "CALLING"
                                    ? "bg-purple-500/10 border-purple-500/30 animate-pulse"
                                    : serial.status === "QUEUED"
                                      ? "bg-emerald-500/5 border-emerald-500/25"
                                      : "bg-card border-border/70 hover:border-border"
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                              {/* Left: Serial Badge, Patient Info */}
                              <div className="flex items-start sm:items-center gap-2 flex-1 min-w-0">
                                {/* Serial Number Badge */}
                                <div className="px-2 py-0.5 rounded-md bg-muted border border-border text-xs font-mono font-bold text-foreground shrink-0">
                                  #{String(serial.serialNumber).padStart(2, "0")}
                                </div>

                                <div className="min-w-0 flex-1 space-y-0.5">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-xs font-bold text-foreground truncate">
                                      {serial.patient?.name || "Patient"}
                                    </span>

                                    {/* Gender Pill */}
                                    <span
                                      className={`text-[9.5px] font-semibold px-1 py-0.2 rounded ${
                                        serial.patient?.gender === Gender.FEMALE
                                          ? "bg-pink-500/10 text-pink-700 dark:text-pink-300"
                                          : "bg-sky-500/10 text-sky-700 dark:text-sky-300"
                                      }`}
                                    >
                                      {serial.patient?.gender === Gender.FEMALE ? "F" : "M"}
                                    </span>

                                    {/* MRN */}
                                    {serial.patient?.mrn && (
                                      <span className="text-[9.5px] font-mono text-muted-foreground">
                                        MRN: {serial.patient.mrn}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2 text-[10.5px] text-muted-foreground flex-wrap">
                                    {serial.patient?.phone && (
                                      <span className="font-mono">
                                        {serial.patient.phone}
                                      </span>
                                    )}

                                    {/* Told Time */}
                                    {serial.toldTime && (
                                      <>
                                        <span>•</span>
                                        <span className="flex items-center gap-0.5 font-mono">
                                          <Clock className="size-2.5" />
                                          {serial.toldTime}
                                        </span>
                                      </>
                                    )}

                                    {/* Punctuality Indicator */}
                                    {serial.toldTime && (
                                      <span
                                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border flex items-center gap-1 ${punctuality.badgeClass}`}
                                      >
                                        <span className={`size-1 rounded-full ${punctuality.dotClass}`} />
                                        <span>{punctuality.label}</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Right: Payment, Status & Actions */}
                              <div className="flex items-center gap-1.5 sm:self-center shrink-0 flex-wrap justify-between sm:justify-end">
                                {/* Fee / Billing Status Badge */}
                                <div className="text-right">
                                  <span
                                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border font-mono ${
                                      serial.paymentStatus === "PAID"
                                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                        : serial.paymentStatus === "DUE"
                                          ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                                          : "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30"
                                    }`}
                                  >
                                    {serial.paymentStatus === "PAID"
                                      ? `PAID ৳${serial.paidAmount || serial.feeAmount}`
                                      : serial.paymentStatus === "DUE"
                                        ? `DUE ৳${serial.dueAmount || serial.feeAmount}`
                                        : `৳${serial.feeAmount} PENDING`}
                                  </span>
                                </div>

                                {/* Operational Status Pill */}
                                <div>
                                  <span
                                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                                      serial.status === "FORWARDED_TO_CASHIER"
                                        ? "bg-sky-500/15 text-sky-800 dark:text-sky-300"
                                        : serial.status === "QUEUED"
                                          ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
                                          : serial.status === "IN_CONSULTATION"
                                            ? "bg-amber-500/20 text-amber-800 dark:text-amber-200"
                                            : serial.status === "CALLING"
                                              ? "bg-purple-500/20 text-purple-800 dark:text-purple-200"
                                              : serial.status === "COMPLETED"
                                                ? "bg-muted text-muted-foreground"
                                                : "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                                    }`}
                                  >
                                    {serial.status === "FORWARDED_TO_CASHIER"
                                      ? "At Cashier"
                                      : serial.status === "QUEUED"
                                        ? "In Queue"
                                        : serial.status === "IN_CONSULTATION"
                                          ? "In Chamber"
                                          : serial.status === "CALLING"
                                            ? "Calling"
                                            : serial.status === "COMPLETED"
                                              ? "Completed"
                                              : "Cancelled"}
                                  </span>
                                </div>

                                {/* Actions: Print Ticket */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setPrintModalSerial(serial)}
                                  className="h-6.5 w-6.5 p-0 text-muted-foreground hover:text-foreground"
                                  title="Print Serial Slip"
                                >
                                  <Printer className="size-3" />
                                </Button>

                                {/* Actions: Cancel Serial */}
                                {!isCancelled && !isCompleted && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setCancelModalSerial(serial);
                                      setCancelReason("");
                                      setActivePin("");
                                    }}
                                    className="h-6.5 w-6.5 p-0 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                                    title="Cancel Serial"
                                  >
                                    <X className="size-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        /* MASTER TABLE VIEW */
        <Card className="border-border/80 bg-card/90 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border/80 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Serial #</th>
                  <th className="py-2.5 px-3">Patient</th>
                  <th className="py-2.5 px-3">Doctor / Chamber</th>
                  <th className="py-2.5 px-3">Told Time</th>
                  <th className="py-2.5 px-3">Punctuality</th>
                  <th className="py-2.5 px-3">Fee / Billing</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredSerials.map((serial) => {
                  const punctuality = evaluatePunctuality(
                    serial.toldTime,
                    serial.visit?.checkInTime || serial.createdAt,
                  );
                  const isCancelled = serial.status === "CANCELLED";
                  const isCompleted = serial.status === "COMPLETED";

                  return (
                    <tr
                      key={serial.id}
                      className={`hover:bg-muted/20 transition-colors ${
                        isCancelled ? "opacity-60 bg-muted/10" : ""
                      }`}
                    >
                      <td className="py-2 px-3 font-mono font-bold text-foreground">
                        #{String(serial.serialNumber).padStart(2, "0")}
                      </td>
                      <td className="py-2 px-3">
                        <div className="font-semibold text-foreground">
                          {serial.patient?.name}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          {serial.patient?.phone} • {serial.patient?.gender}
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <div className="font-medium text-foreground">
                          {serial.doctor?.name || "Doctor"}
                        </div>
                        {serial.doctor?.consultationRoom && (
                          <div className="text-[10px] text-muted-foreground">
                            Room {serial.doctor.consultationRoom.number}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-3 font-mono text-muted-foreground">
                        {serial.toldTime || "—"}
                      </td>
                      <td className="py-2 px-3">
                        {serial.toldTime ? (
                          <span
                            className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded-full border inline-flex items-center gap-1 ${punctuality.badgeClass}`}
                          >
                            <span className={`size-1 rounded-full ${punctuality.dotClass}`} />
                            <span>{punctuality.label}</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2 px-3 font-mono">
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                            serial.paymentStatus === "PAID"
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                              : serial.paymentStatus === "DUE"
                                ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                                : "bg-sky-500/10 text-sky-700 dark:text-sky-300"
                          }`}
                        >
                          ৳{serial.feeAmount} ({serial.paymentStatus})
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                            serial.status === "FORWARDED_TO_CASHIER"
                              ? "bg-sky-500/15 text-sky-800 dark:text-sky-300"
                              : serial.status === "QUEUED"
                                ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
                                : serial.status === "IN_CONSULTATION"
                                  ? "bg-amber-500/20 text-amber-800 dark:text-amber-200"
                                  : serial.status === "CALLING"
                                    ? "bg-purple-500/20 text-purple-800 dark:text-purple-200"
                                    : serial.status === "COMPLETED"
                                      ? "bg-muted text-muted-foreground"
                                      : "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                          }`}
                        >
                          {serial.status === "FORWARDED_TO_CASHIER"
                            ? "At Cashier"
                            : serial.status === "QUEUED"
                              ? "In Queue"
                              : serial.status === "IN_CONSULTATION"
                                ? "In Chamber"
                                : serial.status === "CALLING"
                                  ? "Calling"
                                  : serial.status === "COMPLETED"
                                    ? "Completed"
                                    : "Cancelled"}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPrintModalSerial(serial)}
                            className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                          >
                            <Printer className="size-3 mr-1" />
                            <span>Slip</span>
                          </Button>
                          {!isCancelled && !isCompleted && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setCancelModalSerial(serial);
                                setCancelReason("");
                                setActivePin("");
                              }}
                              className="h-6 px-1.5 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                            >
                              <X className="size-3 mr-1" />
                              <span>Cancel</span>
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ---------------------------------------------------- */}
      {/* 4. Book Doctor Consultation Serial Modal             */}
      {/* ---------------------------------------------------- */}
      <Dialog open={isBookModalOpen} onOpenChange={setIsBookModalOpen}>
        <DialogContent className="sm:max-w-md w-[95vw] max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
              <Stethoscope className="size-4 text-primary" />
              <span>Book Doctor Consultation Serial</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmitBooking} className="space-y-3.5 pt-1">
            {/* Step 1: Search & Select Patient */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">
                1. Select Patient *
              </Label>

              {selectedPatient ? (
                <div className="p-2.5 rounded-lg border border-primary/40 bg-primary/5 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                      <span>{selectedPatient.name}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        ({selectedPatient.gender})
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono">
                      Phone: {selectedPatient.phone} {selectedPatient.mrn ? `• MRN: ${selectedPatient.mrn}` : ""}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedPatient(null);
                      setPatientSearchQuery("");
                    }}
                    className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
                    <Input
                      type="search"
                      value={patientSearchQuery}
                      onChange={(e) => setPatientSearchQuery(e.target.value)}
                      placeholder="Search patient name, phone, MRN..."
                      className="pl-7 h-8 text-xs bg-background"
                      autoFocus
                    />
                    {isSearchingPatient && (
                      <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3 animate-spin text-muted-foreground" />
                    )}
                  </div>

                  {patientSearchResults.length > 0 && (
                    <div className="max-h-40 overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-md space-y-1">
                      {patientSearchResults.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setSelectedPatient(p);
                            setPatientSearchResults([]);
                          }}
                          className="w-full text-left p-1.5 rounded hover:bg-muted text-xs flex items-center justify-between"
                        >
                          <div>
                            <span className="font-semibold">{p.name}</span>
                            <span className="text-[10px] text-muted-foreground ml-1.5">
                              ({p.gender}, {p.phone})
                            </span>
                          </div>
                          {p.mrn && (
                            <span className="text-[10px] font-mono text-muted-foreground">
                              {p.mrn}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Step 2: Select Doctor */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">
                2. Select Doctor *
              </Label>
              <Select value={bookDoctorId} onValueChange={handleDoctorChange}>
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue placeholder="Choose a doctor..." />
                </SelectTrigger>
                <SelectContent>
                  {doctors.map((d) => (
                    <SelectItem key={d.id} value={d.id} className="text-xs">
                      {d.name || "Doctor"}{" "}
                      {d.consultationRoom ? `(Room ${d.consultationRoom.number})` : ""}{" "}
                      — ৳{(d.consultationFee ?? 1000).toLocaleString()} Preset Fee
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Step 3: Fee Override & Told Time */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-foreground">
                  Consultation Fee (৳) *
                </Label>
                <Input
                  type="number"
                  min={0}
                  step={50}
                  value={bookFee}
                  onChange={(e) => setBookFee(Number(e.target.value))}
                  className="h-8 text-xs font-mono font-bold bg-background"
                  required
                />
                <p className="text-[9.5px] text-muted-foreground">
                  Editable by receptionist
                </p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-foreground">
                  Told Arrival Time
                </Label>
                <Input
                  type="text"
                  placeholder="e.g. 10:30 AM"
                  value={bookToldTime}
                  onChange={(e) => setBookToldTime(e.target.value)}
                  className="h-8 text-xs font-mono bg-background"
                />
                <p className="text-[9.5px] text-muted-foreground">
                  Used for punctuality (🟢/🟡/🔴)
                </p>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">
                Clinical / Priority Notes (Optional)
              </Label>
              <Input
                type="text"
                placeholder="e.g. Follow-up consultation, urgent report review"
                value={bookNotes}
                onChange={(e) => setBookNotes(e.target.value)}
                className="h-8 text-xs bg-background"
              />
            </div>

            {/* Authorizing Receptionist Performer Select & 4-Digit PIN */}
            <ReceptionistPerformerSelect
              performers={performers}
              selectedPerformerId={activePerformerId}
              onSelectPerformerId={handlePerformerChange}
              pin={activePin}
              onPinChange={setActivePin}
              disabled={isSubmittingBooking}
              label="Authorizing Receptionist / Staff *"
            />

            <DialogFooter className="pt-2 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsBookModalOpen(false)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={
                  isSubmittingBooking ||
                  !selectedPatient ||
                  activePin.length !== 4 ||
                  (!activePerformerId && performers.length > 0)
                }
                className="h-8 text-xs font-bold gap-1.5 bg-primary text-primary-foreground"
              >
                {isSubmittingBooking ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-3" />
                )}
                <span>Forward to Cashier</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ---------------------------------------------------- */}
      {/* 5. Cancel Consultation Serial Modal                  */}
      {/* ---------------------------------------------------- */}
      <Dialog
        open={Boolean(cancelModalSerial)}
        onOpenChange={(open) => {
          if (!open) setCancelModalSerial(null);
        }}
      >
        <DialogContent className="sm:max-w-sm w-[95vw]">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="size-4" />
              <span>Cancel Consultation Serial</span>
            </DialogTitle>
          </DialogHeader>

          {cancelModalSerial && (
            <div className="space-y-3 pt-1 text-xs">
              <div className="p-2.5 rounded-lg border border-rose-500/20 bg-rose-500/5 space-y-1">
                <div className="font-bold text-foreground">
                  Serial #{cancelModalSerial.serialNumber}: {cancelModalSerial.patient?.name}
                </div>
                <div className="text-muted-foreground font-mono text-[11px]">
                  Doctor: {cancelModalSerial.doctor?.name || "Doctor"} • Fee: ৳{cancelModalSerial.feeAmount}
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">
                  Cancellation Reason (Optional)
                </Label>
                <Input
                  type="text"
                  placeholder="e.g. Patient requested, doctor emergency"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="h-8 text-xs bg-background"
                />
              </div>

              {/* Staff Authorization & Security PIN */}
              <ReceptionistPerformerSelect
                performers={performers}
                selectedPerformerId={activePerformerId}
                onSelectPerformerId={handlePerformerChange}
                pin={activePin}
                onPinChange={setActivePin}
                disabled={isCancelling}
                label="Authorizing Receptionist / Staff *"
              />

              <DialogFooter className="pt-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCancelModalSerial(null)}
                  className="h-8 text-xs"
                >
                  Keep Serial
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={
                    isCancelling ||
                    activePin.length !== 4 ||
                    (!activePerformerId && performers.length > 0)
                  }
                  onClick={handleConfirmCancel}
                  className="h-8 text-xs font-bold gap-1.5"
                >
                  {isCancelling ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Ban className="size-3" />
                  )}
                  <span>Confirm Cancel</span>
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ---------------------------------------------------- */}
      {/* 6. Thermal Print Serial Ticket Modal                 */}
      {/* ---------------------------------------------------- */}
      <Dialog
        open={Boolean(printModalSerial)}
        onOpenChange={(open) => {
          if (!open) setPrintModalSerial(null);
        }}
      >
        <DialogContent className="sm:max-w-md w-[95vw] max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Printer className="size-4 text-primary" />
              <span>Doctor Consultation Ticket Slip</span>
            </DialogTitle>
          </DialogHeader>

          {printModalSerial && (
            <div className="space-y-3 pt-1">
              {/* Slip Print Preview Container */}
              <div
                id="consultation-serial-slip-print"
                className="bg-white text-black p-4 rounded-lg border border-slate-300 font-sans space-y-3 shadow-inner"
              >
                {/* Clinic Header */}
                <div className="text-center border-b border-dashed border-slate-300 pb-2 space-y-0.5">
                  <h2 className="text-sm font-black tracking-wide uppercase text-slate-900">
                    {CLINIC_CONFIG.name}
                  </h2>
                  <p className="text-[10px] text-slate-600">{CLINIC_CONFIG.tagline}</p>
                  <p className="text-[9.5px] text-slate-500 font-mono">
                    {CLINIC_CONFIG.phone} • {CLINIC_CONFIG.addressEnglish}
                  </p>
                </div>

                {/* Big Serial Number Badge */}
                <div className="text-center py-1 bg-slate-100 rounded border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                    Consultation Serial
                  </div>
                  <div className="text-3xl font-black text-slate-900 font-mono">
                    #{String(printModalSerial.serialNumber).padStart(2, "0")}
                  </div>
                  <div className="text-[10px] font-bold text-emerald-700 font-mono">
                    Status: {printModalSerial.status.replace(/_/g, " ")}
                  </div>
                </div>

                {/* Details Table */}
                <div className="space-y-1 text-xs border-b border-dashed border-slate-300 pb-2.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Doctor:</span>
                    <span className="font-bold text-slate-900">
                      {printModalSerial.doctor?.name || "Consultant"}
                    </span>
                  </div>
                  {printModalSerial.doctor?.consultationRoom && (
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Chamber:</span>
                      <span className="font-bold text-slate-900 font-mono">
                        Room {printModalSerial.doctor.consultationRoom.number}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Patient:</span>
                    <span className="font-bold text-slate-900">
                      {printModalSerial.patient?.name} ({printModalSerial.patient?.gender})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Phone:</span>
                    <span className="font-mono text-slate-900">
                      {printModalSerial.patient?.phone}
                    </span>
                  </div>
                  {printModalSerial.patient?.mrn && (
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">MRN:</span>
                      <span className="font-mono text-slate-900">
                        {printModalSerial.patient.mrn}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Date & Time:</span>
                    <span className="font-mono text-slate-900">
                      {selectedDate} • {printModalSerial.toldTime || "Walk-In"}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-200">
                    <span className="text-slate-600 font-bold">Consultation Fee:</span>
                    <span className="font-bold text-slate-900 font-mono">
                      ৳{printModalSerial.feeAmount} ({printModalSerial.paymentStatus})
                    </span>
                  </div>
                  {printModalSerial.invoice?.invoiceNumber && (
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Invoice No:</span>
                      <span className="font-mono text-slate-900">
                        {printModalSerial.invoice.invoiceNumber}
                      </span>
                    </div>
                  )}
                </div>

                {/* Footer Notice */}
                <div className="text-center text-[9.5px] text-slate-500 space-y-0.5">
                  <p>Please wait in the Waiting Room (Room 200).</p>
                  <p>Your serial will be called on the Waiting Room Display screen.</p>
                </div>
              </div>

              {/* Action Buttons */}
              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPrintModalSerial(null)}
                  className="h-8 text-xs"
                >
                  Close
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isGeneratingPdf}
                  onClick={handleDownloadPdf}
                  className="h-8 text-xs font-semibold gap-1.5"
                >
                  <Download className="size-3" />
                  <span>Download PDF</span>
                </Button>
                <Button
                  size="sm"
                  onClick={handlePrintSlip}
                  className="h-8 text-xs font-bold gap-1.5 bg-primary text-primary-foreground"
                >
                  <Printer className="size-3" />
                  <span>Print Slip</span>
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
