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
} from "@/actions/patients";
import { getDailyCashLedger } from "@/actions/billing";
import {
  formatBSTTime,
  formatBSTShortDate,
  formatBSTDate,
  getBSTDateString,
  getBSTTimeString,
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
} from "lucide-react";
import {
  Gender,
  SerialStatus,
  VisitType,
  HourlySlot,
  PaymentMethod,
  PunctualityStatus,
} from "@/generated/prisma/enums";

interface ReceptionistWorkspaceProps {
  initialSerials: Awaited<ReturnType<typeof getDailySerials>>;
  initialLedger: Awaited<ReturnType<typeof getDailyCashLedger>>;
}

export function ReceptionistWorkspace({
  initialSerials,
  initialLedger,
}: ReceptionistWorkspaceProps) {
  const [selectedDate, setSelectedDate] = useState(() => getBSTDateString());
  const [serials, setSerials] = useState(initialSerials);
  const [ledger, setLedger] = useState(initialLedger);
  const [activeTab, setActiveTab] = useState<
    "serials" | "ledger" | "directory"
  >("serials");
  const [allPatientsList, setAllPatientsList] = useState<any[]>([]);

  const [isPending, startTransition] = useTransition();

  // Search & Patient selection
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);

  // Modals
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isBookOpen, setIsBookOpen] = useState(false);
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
  const [checkInSerial, setCheckInSerial] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

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
    roomNo: "205",
  });

  // Physical Arrival Check-in & Payment Form (Step 2)
  const [checkInForm, setCheckInForm] = useState<{
    paidAmount: number;
    isNoPayment: boolean;
    paymentMethod: PaymentMethod;
  }>({
    paidAmount: 500,
    isNoPayment: false,
    paymentMethod: PaymentMethod.CASH,
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
    loadPatientsData();
  }, [loadPatientsData]);

  const refreshData = useCallback(
    (targetDate?: string) => {
      const dateToFetch = targetDate || selectedDate;
      startTransition(async () => {
        try {
          const [updatedSerials, updatedLedger] = await Promise.all([
            getDailySerials(dateToFetch),
            getDailyCashLedger(dateToFetch),
          ]);
          setSerials(updatedSerials);
          setLedger(updatedLedger);
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

  const handleSelectPatientForBooking = (patient: any) => {
    setSelectedPatient(patient);
    setBookForm((prev) => ({
      ...prev,
      date: selectedDate,
      type:
        patient.serials && patient.serials.length > 0
          ? VisitType.FOLLOW_UP
          : VisitType.NEW_CONSULTATION,
    }));
    setIsBookOpen(true);
  };

  const handleRegisterPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!patientForm.patientId || !patientForm.name || !patientForm.phone) {
      setErrorMessage("Please fill required fields: Patient ID, Name, Phone.");
      return;
    }

    const res = await createPatient({
      patientId: patientForm.patientId,
      name: patientForm.name,
      phone: patientForm.phone,
      age: patientForm.age ? parseInt(patientForm.age) : undefined,
      gender: patientForm.gender,
      address: patientForm.address,
      occupation: patientForm.occupation,
      notes: patientForm.notes,
    });

    if (res.error) {
      setErrorMessage(res.error);
      return;
    }

    if (res.patient) {
      setSelectedPatient(res.patient);
      setIsRegisterOpen(false);
      setBookForm((prev) => ({ ...prev, date: selectedDate }));
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
      notes: bookForm.notes,
      roomNo: bookForm.roomNo || "205",
    });

    if (res.error) {
      setErrorMessage(res.error);
      return;
    }

    setIsBookOpen(false);
    setSelectedPatient(null);
    refreshData();
  };

  // Open Check-in & Payment Modal when patient physically arrives
  const handleOpenCheckInModal = (serial: any) => {
    setCheckInSerial(serial);
    setCheckInForm({
      paidAmount: serial.fee || 500,
      isNoPayment: false,
      paymentMethod: PaymentMethod.CASH,
    });
    setIsCheckInModalOpen(true);
  };

  // Submit Physical Arrival & Record Payment/N.P
  const handleConfirmArrivalCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkInSerial) return;

    await checkInPatient({
      serialId: checkInSerial.id,
      paidAmount: checkInForm.isNoPayment ? 0 : Number(checkInForm.paidAmount),
      isNoPayment: checkInForm.isNoPayment,
      paymentMethod: checkInForm.paymentMethod,
    });

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
    <div className="space-y-4 sm:space-y-6 w-full max-w-full overflow-hidden">
      {/* Top Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-3.5 sm:p-4 shadow-sm border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-muted-foreground uppercase">
              Scheduled ({selectedDate})
            </span>
            <Users className="h-4 w-4 text-primary" />
          </div>
          <p className="text-xl sm:text-2xl font-bold mt-1.5 sm:mt-2 font-mono text-foreground">
            {totalBooked}
          </p>
          <span className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 block">
            Registered queue serials
          </span>
        </Card>

        <Card className="p-3.5 sm:p-4 shadow-sm border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-muted-foreground uppercase">
              Waiting Room
            </span>
            <Clock className="h-4 w-4 text-primary" />
          </div>
          <p className="text-xl sm:text-2xl font-bold mt-1.5 sm:mt-2 font-mono text-foreground">
            {waitingCount}
          </p>
          <span className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 block">
            Checked in &bull; Room 205
          </span>
        </Card>

        <Card className="p-3.5 sm:p-4 shadow-sm border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-muted-foreground uppercase">
              Completed Today
            </span>
            <CheckCircle2 className="h-4 w-4 text-primary" />
          </div>
          <p className="text-xl sm:text-2xl font-bold mt-1.5 sm:mt-2 font-mono text-foreground">
            {completedCount}
          </p>
          <span className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 block">
            Discharged or served
          </span>
        </Card>

        <Card className="p-3.5 sm:p-4 shadow-sm border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-muted-foreground uppercase">
              Cash Collection (BST)
            </span>
            <DollarSign className="h-4 w-4 text-primary" />
          </div>
          <p className="text-xl sm:text-2xl font-bold mt-1.5 sm:mt-2 font-mono text-primary">
            ৳{totalCashCollected.toLocaleString()}
          </p>
          <span className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 block">
            Daily desk receipts
          </span>
        </Card>
      </div>

      {/* Action Header, Date Filter & Search (Fully Responsive Single-Bar Layout) */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 sm:gap-3 bg-card p-2 sm:p-2.5 rounded-2xl border border-border shadow-xs">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 bg-muted p-1 rounded-xl overflow-x-auto shrink-0">
          <button
            onClick={() => setActiveTab("serials")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "serials"
                ? "bg-card text-primary shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Serials (সিরিয়াল)
          </button>
          <button
            onClick={() => setActiveTab("directory")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "directory"
                ? "bg-card text-primary shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Patients (রোগী)</span>
          </button>
          <button
            onClick={() => setActiveTab("ledger")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "ledger"
                ? "bg-card text-primary shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Ledger (ক্যাশ)
          </button>
        </div>

        {/* Right Tools Bar (Date, Search, Refresh) */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
          {/* Appointment Date Picker */}
          <div className="flex items-center gap-1 bg-background border border-input px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl shadow-xs shrink-0">
            <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-[11px] font-bold text-muted-foreground uppercase hidden sm:inline">
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
          <div className="relative flex-1 md:w-60">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search ID, Name..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-8 h-8.5 sm:h-9 text-xs"
            />
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={() => refreshData(selectedDate)}
            title="Refresh"
            className="h-8.5 w-8.5 sm:h-9 sm:w-9 cursor-pointer shrink-0"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${isPending ? "animate-spin text-primary" : ""}`}
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
        <Card className="shadow-md border-border bg-card">
          <CardHeader className="pb-3 px-4 sm:px-6">
            <CardTitle className="text-sm sm:text-base font-bold flex items-center justify-between flex-wrap gap-2">
              <span>
                HPC Daily Patient Serial Register &bull; {selectedDate} (সিরিয়াল
                তালিকা)
              </span>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="font-mono text-xs px-2.5 py-1"
                >
                  {serials.length} Total Registered Serials
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
              When patient physically arrives, click &quot;Check-In &amp;
              Payment&quot; to stamp arrival time and record desk payment or
              N.P.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[720px]">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="pb-3 font-semibold w-12">সিরিয়াল</th>
                    <th className="pb-3 font-semibold">তারিখ</th>
                    <th className="pb-3 font-semibold">রোগীর নাম ও আইডি</th>
                    <th className="pb-3 font-semibold">ফোন নম্বর</th>
                    <th className="pb-3 font-semibold">
                      নির্ধারিত সময় (Told Time)
                    </th>
                    <th className="pb-3 font-semibold">
                      উপস্থিতি (Arrival &amp; Punctuality)
                    </th>
                    <th className="pb-3 font-semibold">পেমেন্ট (Payment)</th>
                    <th className="pb-3 font-semibold">অবস্থা</th>
                    <th className="pb-3 font-semibold text-right">
                      পদক্ষেপ (Action)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {serials.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="py-8 text-center text-muted-foreground"
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
                        <td className="py-3 font-mono font-black text-base text-primary">
                          #{s.serialNumber}
                        </td>
                        <td className="py-3 font-mono text-muted-foreground font-semibold">
                          {formatBSTShortDate(s.date)}
                        </td>
                        <td className="py-3">
                          <div className="font-bold text-foreground">
                            {s.patient.name}
                          </div>
                          <div className="text-[11px] text-muted-foreground font-mono">
                            ID: #{s.patient.patientId} &bull; {s.patient.gender}
                          </div>
                        </td>
                        <td className="py-3 font-mono text-muted-foreground">
                          {s.patient.phone}
                        </td>
                        <td className="py-3 font-medium text-foreground">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
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
                                  সময়মত
                                </span>
                              )}
                              {s.punctualityStatus === "MODERATE_LATE" && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                  বিলম্ব (+{s.latenessMinutes}m)
                                </span>
                              )}
                              {s.punctualityStatus === "SEVERE_LATE" && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-destructive/15 text-destructive border border-destructive/30">
                                  অতিরিক্ত বিলম্ব (+{s.latenessMinutes}m | -5
                                  Pos)
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
              <span>
                All Registered Patients Directory (সকল নিবন্ধিত রোগীর তালিকা)
              </span>
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
                    <th className="pb-3 font-semibold w-16">রোগী কোড</th>
                    <th className="pb-3 font-semibold">রোগীর নাম</th>
                    <th className="pb-3 font-semibold">ফোন নম্বর</th>
                    <th className="pb-3 font-semibold">লিঙ্গ / বয়স</th>
                    <th className="pb-3 font-semibold">ঠিকানা</th>
                    <th className="pb-3 font-semibold">
                      আজকের অবস্থা ({selectedDate})
                    </th>
                    <th className="pb-3 font-semibold text-right">
                      সিরিয়াল বুকিং
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
                      const todaySerial = p.serials && p.serials[0];
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

      {/* VIEW 3: Daily Cash Ledger (Page 3 of PDF 1) */}
      {activeTab === "ledger" && (
        <Card className="shadow-md border-border bg-card">
          <CardHeader className="pb-3 px-4 sm:px-6">
            <CardTitle className="text-sm sm:text-base font-bold flex items-center justify-between flex-wrap gap-2">
              <span>
                Official Daily Cash Collection Sheet &bull; {selectedDate} (টাকা
                জমার খাতা)
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
                    <th className="pb-3 font-semibold">TAKA (টাকা)</th>
                    <th className="pb-3 font-semibold">CASHIER (ক্যাশিয়ার)</th>
                    <th className="pb-3 font-semibold">
                      CEO AUDIT (সিইও অনুমোদন)
                    </th>
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

      {/* DIALOG 1: Register New Patient */}
      <Dialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen}>
        <DialogContent className="sm:max-w-lg bg-card w-[95vw] sm:w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              Register New Patient (নতুন রোগী নিবন্ধন)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Enter primary details to create patient profile.
            </DialogDescription>
          </DialogHeader>

          {errorMessage && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleRegisterPatient} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Patient 4-Digit ID (রোগী কোড) *
                </Label>
                <Input
                  placeholder="e.g. 1800"
                  value={patientForm.patientId}
                  onChange={(e) =>
                    setPatientForm({
                      ...patientForm,
                      patientId: e.target.value,
                    })
                  }
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Full Name (নাম) *
                </Label>
                <Input
                  placeholder="উম্মে হাবিবা / আব্দুল খালেক"
                  value={patientForm.name}
                  onChange={(e) =>
                    setPatientForm({ ...patientForm, name: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Phone (ফোন নম্বর) *
                </Label>
                <Input
                  placeholder="01973-818213"
                  value={patientForm.phone}
                  onChange={(e) =>
                    setPatientForm({ ...patientForm, phone: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Age (বয়স)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 28"
                  value={patientForm.age}
                  onChange={(e) =>
                    setPatientForm({ ...patientForm, age: e.target.value })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Gender (লিঙ্গ)</Label>
                <select
                  value={patientForm.gender}
                  onChange={(e) =>
                    setPatientForm({
                      ...patientForm,
                      gender: e.target.value as Gender,
                    })
                  }
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs"
                >
                  <option value={Gender.MALE}>Male (পুরুষ)</option>
                  <option value={Gender.FEMALE}>Female (মহিলা)</option>
                  <option value={Gender.OTHER}>Other</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Address / Location (ঠিকানা)
                </Label>
                <Input
                  placeholder="মোস্তফাপুর / ঝিনাইদহ / নড়াইল"
                  value={patientForm.address}
                  onChange={(e) =>
                    setPatientForm({ ...patientForm, address: e.target.value })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Occupation (পেশা)
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
              <Label className="text-xs font-semibold">
                Clinical Remarks / Notes (মন্তব্য)
              </Label>
              <Input
                placeholder="Referred by Dr. / Chronic Back Pain"
                value={patientForm.notes}
                onChange={(e) =>
                  setPatientForm({ ...patientForm, notes: e.target.value })
                }
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsRegisterOpen(false)}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button type="submit" className="font-bold cursor-pointer">
                Save &amp; Proceed to Booking
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG 2: Schedule Queue Serial (Pure Booking - No Payment) */}
      <Dialog open={isBookOpen} onOpenChange={setIsBookOpen}>
        <DialogContent className="sm:max-w-lg bg-card w-[95vw] sm:w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <PhoneCall className="h-5 w-5 text-primary" />
              <span>Schedule Patient Serial (সিরিয়াল বুকিং)</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Discuss and set appointment date and promised arrival time. No
              payment required at booking.
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
                  Appointment Date (সিরিয়ালের তারিখ) *
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
                <Label className="text-xs font-bold text-primary">
                  Promised Arrival Time (আসার নির্ধারিত সময়) *
                </Label>
                <Input
                  type="time"
                  value={bookForm.toldTime}
                  onChange={(e) =>
                    setBookForm({ ...bookForm, toldTime: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Hourly Slot (ঘণ্টাভিত্তিক স্লট)
                </Label>
                <select
                  value={bookForm.hourlySlot}
                  onChange={(e) =>
                    setBookForm({
                      ...bookForm,
                      hourlySlot: e.target.value as HourlySlot,
                      timeSlot:
                        e.target.value
                          .replace("SLOT_", "")
                          .replace("_", ":00 - ") + ":00",
                    })
                  }
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs"
                >
                  <option value={HourlySlot.SLOT_10_11}>
                    10:00 - 11:00 AM
                  </option>
                  <option value={HourlySlot.SLOT_11_12}>
                    11:00 - 12:00 PM
                  </option>
                  <option value={HourlySlot.SLOT_12_01}>
                    12:00 - 01:00 PM
                  </option>
                  <option value={HourlySlot.SLOT_01_02}>
                    01:00 - 02:00 PM
                  </option>
                  <option value={HourlySlot.SLOT_02_03}>
                    02:00 - 03:00 PM
                  </option>
                  <option value={HourlySlot.SLOT_03_04}>
                    03:00 - 04:00 PM
                  </option>
                  <option value={HourlySlot.SLOT_04_05}>
                    04:00 - 05:00 PM
                  </option>
                  <option value={HourlySlot.SLOT_05_06}>
                    05:00 - 06:00 PM
                  </option>
                  <option value={HourlySlot.SLOT_06_07}>
                    06:00 - 07:00 PM
                  </option>
                  <option value={HourlySlot.SLOT_07_08}>
                    07:00 - 08:00 PM
                  </option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Visit Purpose / Type
                </Label>
                <select
                  value={bookForm.type}
                  onChange={(e) =>
                    setBookForm({
                      ...bookForm,
                      type: e.target.value as VisitType,
                    })
                  }
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs"
                >
                  <option value={VisitType.NEW_CONSULTATION}>
                    New Consultation (নতুন রোগী)
                  </option>
                  <option value={VisitType.FOLLOW_UP}>
                    Follow-up Therapy (রিভিসিট)
                  </option>
                  <option value={VisitType.REPORT_REVIEW}>
                    Report Review (রিপোর্ট)
                  </option>
                  <option value={VisitType.THERAPY_PROCEDURE}>
                    Therapy Procedure
                  </option>
                  <option value={VisitType.EMERGENCY}>Emergency</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Assigned Room</Label>
                <Input
                  value={bookForm.roomNo}
                  onChange={(e) =>
                    setBookForm({ ...bookForm, roomNo: e.target.value })
                  }
                  placeholder="205"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Desk Remarks</Label>
                <Input
                  value={bookForm.notes}
                  onChange={(e) =>
                    setBookForm({ ...bookForm, notes: e.target.value })
                  }
                  placeholder="e.g. মোস্তফাপুর / রিভিসিট"
                />
              </div>
            </div>

            {/* Report Checkbox */}
            <div className="pt-1">
              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={bookForm.isReport}
                  onChange={(e) =>
                    setBookForm({
                      ...bookForm,
                      isReport: e.target.checked,
                    })
                  }
                  className="h-4 w-4 rounded text-primary"
                />
                <span>রিপোর্ট পেশ (Report Review Session)</span>
              </label>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsBookOpen(false)}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button type="submit" className="font-bold cursor-pointer">
                Confirm Serial Booking
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG 3: Physical Arrival Check-In & Desk Payment (Step 2) */}
      <Dialog open={isCheckInModalOpen} onOpenChange={setIsCheckInModalOpen}>
        <DialogContent className="sm:max-w-md bg-card w-[95vw] sm:w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" />
              <span>Record Arrival &amp; Payment (উপস্থিতি ও বিল গ্রহণ)</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Stamps patient check-in time and records payment to put patient on
              the Waiting List for Room 205.
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
                Payment Collection (বিল ও টাকা আদায়)
              </Label>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground font-semibold">
                    Amount (টাকা) ৳
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
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground font-semibold">
                    Method (পদ্ধতি)
                  </Label>
                  <select
                    value={checkInForm.paymentMethod}
                    onChange={(e) =>
                      setCheckInForm({
                        ...checkInForm,
                        paymentMethod: e.target.value as PaymentMethod,
                      })
                    }
                    disabled={checkInForm.isNoPayment}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs"
                  >
                    <option value={PaymentMethod.CASH}>Cash (নগদ)</option>
                    <option value={PaymentMethod.MOBILE_BANKING}>
                      bKash / Nagad / Rocket
                    </option>
                    <option value={PaymentMethod.CARD}>Card (কার্ড)</option>
                    <option value={PaymentMethod.OTHER}>
                      Other (অন্যান্য)
                    </option>
                  </select>
                </div>
              </div>
            </div>

            {/* 1-Click N.P (No Payment Made) Toggle */}
            <div className="p-2.5 rounded-xl border border-border bg-muted/30">
              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={checkInForm.isNoPayment}
                  onChange={(e) =>
                    setCheckInForm({
                      ...checkInForm,
                      isNoPayment: e.target.checked,
                      paidAmount: e.target.checked ? 0 : 500,
                    })
                  }
                  className="h-4 w-4 rounded text-primary cursor-pointer"
                />
                <span className="font-bold text-foreground">
                  Mark as N.P (No Payment Made / কোন টাকা দেয়নি)
                </span>
              </label>
              <p className="text-[10px] text-muted-foreground mt-1 pl-6">
                Check this if patient is on a complimentary visit, pending dues,
                or non-payment.
              </p>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCheckInModalOpen(false)}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="font-bold cursor-pointer bg-primary text-primary-foreground gap-1.5"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Confirm Check-In &amp; Place in Waiting</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
