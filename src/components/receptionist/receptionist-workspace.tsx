"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { useRealtime } from "@/hooks/use-realtime";
import {
  getDailySerials,
  bookSerial,
  checkInPatient,
  collectSerialPayment,
  updateSerialPayment,
  updateSerialStatus,
  updateSerialDetails,
} from "@/actions/serials";
import {
  searchPatients,
  createPatient,
  updatePatient,
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
  CreditCard,
  Receipt,
  Banknote,
  Sparkles,
  CheckCheck,
  Pencil,
  Edit,
  Edit2,
  Edit3,
  FileEdit,
  UserCog,
  Ticket,
} from "lucide-react";
import {
  Gender,
  BloodGroup,
  Priority,
  SerialStatus,
  VisitType,
  HourlySlot,
  PaymentMethod,
  PaymentStatus,
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
import { PromisedTimePicker } from "@/components/booking/time-picker";
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
  [PaymentMethod.MOBILE_BANKING]: "bKash / Nagad / Rocket (মোবাইল ব্যাংকিং)",
  [PaymentMethod.CARD]: "Card (কার্ড)",
  [PaymentMethod.INSURANCE]: "Insurance (বীমা)",
  [PaymentMethod.OTHER]: "Other (অন্যান্য)",
};

export function ReceptionistWorkspace({
  initialSerials,
  initialLedger,
}: ReceptionistWorkspaceProps) {
  const { t } = useI18n();
  const [isPending, startTransition] = useTransition();
  const [serials, setSerials] = useState<ReceptionistSerial[]>(initialSerials);
  const [ledger, setLedger] = useState(initialLedger);
  const [roomsData, setRoomsData] = useState<Awaited<
    ReturnType<typeof getAllRoomsWithOccupancy>
  > | null>(null);

  const [selectedDate, setSelectedDate] = useState<string>(getBSTDateString());
  const [activeTab, setActiveTab] = useState<
    "serials" | "ledger" | "directory" | "chambers" | "slots"
  >("serials");

  // Search & Patient Selection
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PatientItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [allPatientsList, setAllPatientsList] = useState<PatientItem[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientItem | null>(
    null,
  );

  // In-Modal Patient Search
  const [modalSearchQuery, setModalSearchQuery] = useState("");
  const [modalSearchResults, setModalSearchResults] = useState<PatientItem[]>(
    [],
  );
  const [isModalSearching, setIsModalSearching] = useState(false);

  // Modals
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isBookOpen, setIsBookOpen] = useState(false);
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
  const [checkInSerial, setCheckInSerial] = useState<ReceptionistSerial | null>(
    null,
  );
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentSerial, setPaymentSerial] = useState<ReceptionistSerial | null>(
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
  const [paymentErrors, setPaymentErrors] = useState<Record<string, string>>(
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

  // Physical Arrival Check-in Form
  const [checkInForm, setCheckInForm] = useState<{
    roomNo: string;
    customArrivalTime: string;
  }>({
    roomNo: "207",
    customArrivalTime: "",
  });

  // Separate Payment & Billing Edit Form
  const [paymentForm, setPaymentForm] = useState<{
    fee: number;
    paidAmount: number;
    discount: number;
    isNoPayment: boolean;
    paymentMethod: PaymentMethod;
    paymentStatus: PaymentStatus;
    notes: string;
  }>({
    fee: 500,
    paidAmount: 500,
    discount: 0,
    isNoPayment: false,
    paymentMethod: PaymentMethod.CASH,
    paymentStatus: PaymentStatus.PAID,
    notes: "",
  });

  // Edit Patient State
  const [isEditPatientOpen, setIsEditPatientOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<any | null>(null);
  const [editPatientForm, setEditPatientForm] = useState<{
    patientId: string;
    name: string;
    phone: string;
    email: string;
    age: string;
    gender: Gender;
    bloodGroup: BloodGroup | "";
    occupation: string;
    address: string;
    city: string;
    emergencyContactName: string;
    emergencyContactPhone: string;
    notes: string;
  }>({
    patientId: "",
    name: "",
    phone: "",
    email: "",
    age: "",
    gender: Gender.MALE,
    bloodGroup: "",
    occupation: "",
    address: "",
    city: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    notes: "",
  });
  const [editPatientErrors, setEditPatientErrors] = useState<
    Record<string, string>
  >({});

  // Edit Serial State
  const [isEditSerialOpen, setIsEditSerialOpen] = useState(false);
  const [editingSerial, setEditingSerial] = useState<ReceptionistSerial | null>(
    null,
  );
  const [editSerialForm, setEditSerialForm] = useState<{
    date: string;
    hourlySlot: HourlySlot;
    timeSlot: string;
    toldTime: string;
    roomNo: string;
    type: VisitType;
    priority: Priority;
    status: SerialStatus;
    isReport: boolean;
    notes: string;
  }>({
    date: getBSTDateString(new Date()),
    hourlySlot: HourlySlot.SLOT_11_12,
    timeSlot: "11:00 AM - 12:00 PM",
    toldTime: "11:00 AM",
    roomNo: "207",
    type: VisitType.NEW_CONSULTATION,
    priority: Priority.REGULAR,
    status: SerialStatus.PENDING,
    isReport: false,
    notes: "",
  });
  const [editSerialErrors, setEditSerialErrors] = useState<
    Record<string, string>
  >({});

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

  // In-Modal Live Patient Search (by ID, Name, or Phone)
  const handleModalSearch = async (val: string) => {
    setModalSearchQuery(val);
    if (!val.trim()) {
      setModalSearchResults([]);
      return;
    }
    setIsModalSearching(true);
    try {
      const results = await searchPatients(val);
      setModalSearchResults(results);
    } catch (e) {
      console.error("Modal search failed", e);
    } finally {
      setIsModalSearching(false);
    }
  };

  const handleSelectPatientForBooking = (patient: PatientItem) => {
    setSelectedPatient(patient);
    setModalSearchQuery("");
    setModalSearchResults([]);
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
    setErrorMessage("");
    setBookErrors({});

    if (!selectedPatient) {
      setBookErrors({ patientId: "Please search and select a patient first." });
      setErrorMessage("Please search and select a patient.");
      toast.error("Please search and select a patient.");
      return;
    }

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
      roomNo: bookForm.roomNo
        ? bookForm.roomNo.replace(/[^0-9A-Za-z]/g, "")
        : undefined,
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

  // Open Check-in Modal when patient physically arrives
  const handleOpenCheckInModal = (serial: ReceptionistSerial) => {
    setCheckInSerial(serial);
    setCheckInForm({
      roomNo: (serial.roomNo || "").replace(/[^0-9]/g, "") || "207",
      customArrivalTime: "",
    });
    setIsCheckInModalOpen(true);
  };

  // Submit Physical Arrival (Check-In Only)
  const handleConfirmArrivalCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkInSerial) return;

    const res = await checkInPatient({
      serialId: checkInSerial.id,
      roomNo: checkInForm.roomNo || "207",
      customArrivalTime: checkInForm.customArrivalTime || undefined,
    });

    if (res.error) {
      toast.error(res.error);
      return;
    }

    toast.success(
      `Arrival recorded for Serial #${checkInSerial.serialNumber} (${checkInSerial.patient.name})!`,
    );
    setIsCheckInModalOpen(false);
    setCheckInSerial(null);
    refreshData();
  };

  // Open Dedicated Payment / Edit Payment Modal
  const handleOpenPaymentModal = (serial: ReceptionistSerial) => {
    setPaymentSerial(serial);
    setPaymentErrors({});
    const totalFee = serial.fee ?? 500;
    const remainingDue = Math.max(0, totalFee - (serial.paidAmount || 0));
    setPaymentForm({
      fee: totalFee,
      paidAmount:
        serial.paymentStatus === PaymentStatus.PAID || serial.paidAmount > 0
          ? serial.paidAmount
          : remainingDue > 0
            ? remainingDue
            : totalFee,
      discount: 0,
      isNoPayment: Boolean(serial.isPackageCovered),
      paymentMethod: serial.paymentMethod || PaymentMethod.CASH,
      paymentStatus:
        serial.paymentStatus ||
        (serial.paidAmount > 0 ? PaymentStatus.PAID : PaymentStatus.UNPAID),
      notes: "",
    });
    setIsPaymentModalOpen(true);
  };

  // Submit Payment / Payment Edit
  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentSerial) return;
    setPaymentErrors({});

    const valResult = validatePaymentInput({
      paidAmount: Number(paymentForm.paidAmount),
      actualBill: Number(paymentForm.fee) || 500,
      isNoPayment: paymentForm.isNoPayment,
    });

    if (!valResult.isValid) {
      setPaymentErrors(valResult.errors);
      return;
    }

    const res = await updateSerialPayment({
      serialId: paymentSerial.id,
      fee: Number(paymentForm.fee) || 500,
      paidAmount: paymentForm.isNoPayment ? 0 : Number(paymentForm.paidAmount),
      discount: Number(paymentForm.discount) || 0,
      isNoPayment: paymentForm.isNoPayment,
      paymentMethod: paymentForm.paymentMethod,
      paymentStatus: paymentForm.paymentStatus,
      notes: paymentForm.notes.trim() || undefined,
    });

    if (res.error) {
      toast.error(res.error);
      return;
    }

    toast.success(
      `Payment details updated for Serial #${paymentSerial.serialNumber} (${paymentSerial.patient.name})!`,
    );
    setIsPaymentModalOpen(false);
    setPaymentSerial(null);
    refreshData();
  };

  const handleStatusChange = async (serialId: string, status: SerialStatus) => {
    await updateSerialStatus(serialId, status);
    refreshData();
  };

  // Open Edit Patient Modal
  const handleOpenEditPatient = (patient: any) => {
    setEditingPatient(patient);
    setEditPatientErrors({});
    setEditPatientForm({
      patientId: patient.patientId || "",
      name: patient.name || "",
      phone: patient.phone || "",
      email: patient.email || "",
      age: patient.age ? String(patient.age) : "",
      gender: patient.gender || Gender.MALE,
      bloodGroup: patient.bloodGroup || "",
      occupation: patient.occupation || "",
      address: patient.address || "",
      city: patient.city || "",
      emergencyContactName: patient.emergencyContactName || "",
      emergencyContactPhone: patient.emergencyContactPhone || "",
      notes: patient.notes || "",
    });
    setIsEditPatientOpen(true);
  };

  // Submit Edit Patient
  const handleSaveEditPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPatient) return;
    setEditPatientErrors({});

    const valResult = validatePatientForm({
      patientId: editPatientForm.patientId,
      name: editPatientForm.name,
      phone: editPatientForm.phone,
      gender: editPatientForm.gender,
      age: editPatientForm.age ? Number(editPatientForm.age) : undefined,
    });

    if (!valResult.isValid) {
      setEditPatientErrors(valResult.errors);
      return;
    }

    const res = await updatePatient(editingPatient.id, {
      patientId: editPatientForm.patientId.trim(),
      name: editPatientForm.name.trim(),
      phone: editPatientForm.phone.trim(),
      email: editPatientForm.email.trim() || undefined,
      age: editPatientForm.age ? Number(editPatientForm.age) : undefined,
      gender: editPatientForm.gender,
      bloodGroup: (editPatientForm.bloodGroup as BloodGroup) || undefined,
      occupation: editPatientForm.occupation.trim() || undefined,
      address: editPatientForm.address.trim() || undefined,
      city: editPatientForm.city.trim() || undefined,
      emergencyContactName:
        editPatientForm.emergencyContactName.trim() || undefined,
      emergencyContactPhone:
        editPatientForm.emergencyContactPhone.trim() || undefined,
      notes: editPatientForm.notes.trim() || undefined,
    });

    if (res.error) {
      toast.error(res.error);
      return;
    }

    toast.success(
      `Patient profile #${editPatientForm.patientId} (${editPatientForm.name}) updated successfully!`,
    );
    setIsEditPatientOpen(false);
    setEditingPatient(null);
    loadPatientsData();
    refreshData();
  };

  // Open Edit Serial Modal
  const handleOpenEditSerial = (serial: ReceptionistSerial) => {
    setEditingSerial(serial);
    setEditSerialErrors({});
    const serialDateStr = serial.date
      ? getBSTDateString(new Date(serial.date))
      : selectedDate;
    let formattedToldTime = "";
    if (serial.toldTime) {
      formattedToldTime = formatBSTTime(serial.toldTime);
    } else {
      formattedToldTime = serial.timeSlot
        ? serial.timeSlot.split("-")[0].trim()
        : "11:00 AM";
    }

    setEditSerialForm({
      date: serialDateStr,
      hourlySlot: serial.hourlySlot || HourlySlot.SLOT_11_12,
      timeSlot: serial.timeSlot || "11:00 AM - 12:00 PM",
      toldTime: formattedToldTime,
      roomNo: serial.roomNo || "207",
      type: serial.type || VisitType.NEW_CONSULTATION,
      priority: serial.priority || Priority.REGULAR,
      status: serial.status || SerialStatus.PENDING,
      isReport: Boolean(serial.isReport),
      notes: serial.notes || "",
    });
    setIsEditSerialOpen(true);
  };

  // Submit Edit Serial
  const handleSaveEditSerial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSerial) return;
    setEditSerialErrors({});

    const valResult = validateSerialBooking({
      date: editSerialForm.date,
      toldTime: editSerialForm.toldTime,
      roomNo: editSerialForm.roomNo,
      patientId: editingSerial.patient.id,
    });

    if (!valResult.isValid) {
      setEditSerialErrors(valResult.errors);
      return;
    }

    const res = await updateSerialDetails({
      serialId: editingSerial.id,
      date: editSerialForm.date,
      hourlySlot: editSerialForm.hourlySlot,
      timeSlot: editSerialForm.timeSlot,
      toldTime: editSerialForm.toldTime,
      roomNo: editSerialForm.roomNo
        ? editSerialForm.roomNo.replace(/[^0-9A-Za-z]/g, "")
        : undefined,
      type: editSerialForm.type,
      priority: editSerialForm.priority,
      status: editSerialForm.status,
      isReport: editSerialForm.isReport,
      notes: editSerialForm.notes,
    });

    if (res.error) {
      toast.error(res.error);
      return;
    }

    toast.success(
      `Serial #${editingSerial.serialNumber} for ${editingSerial.patient.name} updated successfully!`,
    );
    setIsEditSerialOpen(false);
    setEditingSerial(null);
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
                  onClick={() => {
                    setSelectedPatient(null);
                    setModalSearchQuery("");
                    setModalSearchResults([]);
                    setBookForm((prev) => ({
                      ...prev,
                      date: selectedDate,
                      roomNo: "",
                      type: VisitType.NEW_CONSULTATION,
                    }));
                    setIsBookOpen(true);
                  }}
                  size="sm"
                  className="h-7 text-xs font-bold gap-1.5 cursor-pointer shadow-xs bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Ticket className="h-3.5 w-3.5" />
                  <span>{t("rec.create_serial", "Create Serial")}</span>
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
                              className="h-7 text-[11px] px-2.5 gap-1.5 cursor-pointer font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                              onClick={() => handleOpenCheckInModal(s)}
                              title="Record patient physical arrival"
                            >
                              <UserCheck className="h-3.5 w-3.5" />
                              <span>Check-In</span>
                            </Button>
                          )}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            {s.isPackageCovered ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 font-semibold"
                              >
                                N.P (Covered)
                              </Badge>
                            ) : s.paymentStatus === PaymentStatus.PAID ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-mono font-bold"
                              >
                                ৳{s.paidAmount} Paid
                              </Badge>
                            ) : s.paidAmount > 0 ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 font-mono font-bold"
                              >
                                ৳{s.paidAmount} / ৳{s.fee} (Due ৳
                                {s.fee - s.paidAmount})
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 font-mono font-bold"
                              >
                                ৳{s.fee || 500} Unpaid
                              </Badge>
                            )}

                            {s.paidAmount > 0 ||
                            s.isPackageCovered ||
                            s.paymentStatus === PaymentStatus.PAID ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-[10px] px-2 gap-1 cursor-pointer font-bold border-border bg-background hover:bg-muted/80 text-foreground shadow-2xs"
                                onClick={() => handleOpenPaymentModal(s)}
                                title="Edit serial payment & billing details"
                              >
                                <Pencil className="h-2.5 w-2.5 text-primary" />
                                <span>Edit Payment</span>
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                className="h-6 text-[10px] px-2 gap-1 cursor-pointer font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
                                onClick={() => handleOpenPaymentModal(s)}
                                title="Collect patient serial fee"
                              >
                                <CreditCard className="h-3 w-3" />
                                <span>Pay / Collect</span>
                              </Button>
                            )}
                          </div>
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
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px] px-2 gap-1 cursor-pointer font-bold border-border bg-background hover:bg-muted text-foreground"
                              onClick={() => handleOpenEditSerial(s)}
                              title="Edit serial date, slot, told time, room, or status"
                            >
                              <FileEdit className="h-3 w-3 text-primary" />
                              <span>Edit Serial</span>
                            </Button>
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
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[11px] gap-1 cursor-pointer font-bold border-border hover:bg-muted text-foreground"
                                onClick={() => handleOpenEditPatient(p)}
                                title="Edit patient profile details"
                              >
                                <UserCog className="h-3 w-3 text-primary" />
                                <span>Edit Profile</span>
                              </Button>
                              <Button
                                size="sm"
                                className="h-7 text-[11px] gap-1 cursor-pointer font-bold bg-primary text-primary-foreground shadow-xs"
                                onClick={() => handleSelectPatientForBooking(p)}
                                title="Schedule serial booking"
                              >
                                <Ticket className="h-3 w-3" />
                                <span>
                                  {todaySerial ? "Book Another" : "Book Serial"}
                                </span>
                              </Button>
                            </div>
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
                    <th className="pb-3 font-semibold text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {ledger.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
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
                        <td className="py-3 text-right">
                          {item.serialId ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-[10px] px-2 gap-1 cursor-pointer font-bold border-border hover:bg-muted"
                              onClick={() => {
                                const matchingSerial =
                                  serials.find((s) => s.id === item.serialId) ||
                                  item.serial;
                                if (matchingSerial) {
                                  handleOpenPaymentModal(matchingSerial as any);
                                }
                              }}
                              title="Edit serial payment & billing"
                            >
                              <Pencil className="h-2.5 w-2.5 text-primary" />
                              <span>Edit</span>
                            </Button>
                          ) : (
                            <span className="text-[10px] text-muted-foreground italic">
                              Direct
                            </span>
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

      {/* DIALOG 2: Create Serial Modal (with In-Modal Patient Search & Quick Registration) */}
      <Dialog open={isBookOpen} onOpenChange={setIsBookOpen}>
        <DialogContent className="sm:max-w-3xl md:max-w-4xl bg-card w-[96vw] sm:w-[92vw] md:w-[860px] p-4 sm:p-6 max-h-[92vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Ticket className="h-5 w-5" />
              </div>
              <div>
                <span>
                  {t(
                    "booking.schedule_title",
                    "Create Patient Serial / Appointment",
                  )}
                </span>
                <span className="block text-xs font-normal text-muted-foreground">
                  (সিরিয়াল ও অ্যাপয়েন্টমেন্ট শিডিউলিং)
                </span>
              </div>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t(
                "booking.schedule_desc",
                "Search patient by ID, Name, or Phone number, choose slot, and set promised arrival time.",
              )}
            </DialogDescription>
          </DialogHeader>

          {/* STEP 1: PATIENT SEARCH OR SELECTED PATIENT SUMMARY */}
          {!selectedPatient ? (
            <div className="p-3.5 rounded-2xl bg-muted/60 border border-border space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Search className="h-3.5 w-3.5 text-primary" />
                  <span>Search &amp; Select Patient *</span>
                </Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs font-semibold gap-1 cursor-pointer hover:border-primary hover:bg-primary/10"
                  onClick={() => {
                    setIsBookOpen(false);
                    setIsRegisterOpen(true);
                  }}
                >
                  <UserPlus className="h-3 w-3" />
                  <span>+ Register New Patient</span>
                </Button>
              </div>

              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by 5-digit Patient ID (e.g. 10001), Full Name, or Phone (017...)"
                  value={modalSearchQuery}
                  onChange={(e) => handleModalSearch(e.target.value)}
                  className="pl-9 h-9 text-xs font-medium bg-background"
                  autoFocus
                />
                {isModalSearching && (
                  <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-primary" />
                )}
              </div>

              {/* Live Search Results List */}
              {modalSearchResults.length > 0 ? (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">
                    Select Matching Patient ({modalSearchResults.length}):
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {modalSearchResults.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => handleSelectPatientForBooking(p)}
                        className="p-2.5 rounded-xl border border-border/80 bg-background hover:bg-primary/5 hover:border-primary/50 cursor-pointer transition-all flex items-center justify-between group shadow-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="font-bold text-xs text-foreground truncate group-hover:text-primary transition-colors">
                            {p.name}
                          </div>
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 font-mono">
                            <span>#{p.patientId}</span>
                            <span>&bull;</span>
                            <span>{p.phone}</span>
                            <span>&bull;</span>
                            <span>{p.gender}</span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[10px] px-2 font-bold group-hover:bg-primary group-hover:text-primary-foreground pointer-events-none"
                        >
                          Select
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : modalSearchQuery.trim().length > 0 && !isModalSearching ? (
                <div className="p-3 text-center rounded-xl bg-background border border-dashed border-border text-xs text-muted-foreground space-y-2">
                  <p>
                    No existing patient found matching &quot;{modalSearchQuery}
                    &quot;.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 text-xs font-bold gap-1 cursor-pointer bg-primary text-primary-foreground"
                    onClick={() => {
                      setIsBookOpen(false);
                      setPatientForm((prev) => ({
                        ...prev,
                        name: isNaN(Number(modalSearchQuery))
                          ? modalSearchQuery
                          : "",
                        phone:
                          !isNaN(Number(modalSearchQuery)) &&
                          modalSearchQuery.length >= 10
                            ? modalSearchQuery
                            : "",
                      }));
                      setIsRegisterOpen(true);
                    }}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    <span>
                      Register &quot;{modalSearchQuery}&quot; as New Patient
                    </span>
                  </Button>
                </div>
              ) : (
                <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-1">
                  <span>Type above to search existing clinic patients.</span>
                  <span>
                    {allPatientsList.length} total registered patients
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs flex items-center justify-between flex-wrap gap-2">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-foreground text-sm">
                    {selectedPatient.name}
                  </span>
                  <Badge
                    variant="outline"
                    className="font-mono text-[10px] font-bold bg-background text-primary border-primary/30"
                  >
                    ID: #{selectedPatient.patientId}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-[10px] font-semibold"
                  >
                    {selectedPatient.gender}
                  </Badge>
                </div>
                <div className="text-muted-foreground text-[11px]">
                  Phone: {selectedPatient.phone}{" "}
                  {selectedPatient.age ? `• Age: ${selectedPatient.age}y` : ""}{" "}
                  {selectedPatient.address
                    ? `• ${selectedPatient.address}`
                    : ""}
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs font-semibold cursor-pointer bg-background hover:bg-muted"
                onClick={() => {
                  setSelectedPatient(null);
                  setModalSearchQuery("");
                  setModalSearchResults([]);
                }}
              >
                Change Patient
              </Button>
            </div>
          )}

          {bookErrors.patientId && (
            <p className="text-xs font-semibold text-destructive flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {bookErrors.patientId}
            </p>
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

            {/* Promised Arrival Time (Told Time) Interactive Time Picker */}
            <PromisedTimePicker
              value={bookForm.toldTime}
              onChange={(timeStr) =>
                setBookForm({ ...bookForm, toldTime: timeStr })
              }
              slotLabel={bookForm.timeSlot}
              error={bookErrors.toldTime}
            />

            {/* Assigned Chamber / Room (Staff-only rooms excluded) */}
            <RoomSelect
              value={bookForm.roomNo}
              onChange={(roomNum) =>
                setBookForm({ ...bookForm, roomNo: roomNum })
              }
              genderFilter={
                selectedPatient?.gender === "MALE" ||
                selectedPatient?.gender === "FEMALE"
                  ? selectedPatient.gender
                  : undefined
              }
              roomsOccupancy={roomsData?.rooms}
              label={t(
                "booking.assigned_room",
                "Pre-Assigned Chamber / Room (Optional)",
              )}
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
                className="font-bold cursor-pointer shadow-xs bg-primary text-primary-foreground gap-1.5"
                disabled={!selectedPatient}
              >
                <Ticket className="h-4 w-4" />
                <span>{t("booking.confirm", "Confirm Serial Booking")}</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG 3: Pure Physical Arrival Check-In */}
      <Dialog open={isCheckInModalOpen} onOpenChange={setIsCheckInModalOpen}>
        <DialogContent className="sm:max-w-md bg-card w-[95vw] sm:w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <span>{t("checkin.title", "Patient Arrival Check-In")}</span>
                <span className="block text-xs font-normal text-muted-foreground">
                  (উপস্থিতি নিশ্চিতকরণ)
                </span>
              </div>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t(
                "checkin.desc_only",
                "Stamps patient physical arrival time and assigns chamber room for consultation.",
              )}
            </DialogDescription>
          </DialogHeader>

          {checkInSerial && (
            <div className="p-3.5 rounded-2xl bg-muted/60 border border-border text-xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-extrabold text-foreground text-sm flex items-center gap-1.5">
                  <span>{checkInSerial.patient.name}</span>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {checkInSerial.patient.gender}
                  </Badge>
                </div>
                <Badge
                  variant="default"
                  className="font-mono font-bold bg-primary"
                >
                  Serial #{checkInSerial.serialNumber}
                </Badge>
              </div>
              <div className="text-muted-foreground flex items-center justify-between text-[11px]">
                <span>
                  ID: #{checkInSerial.patient.patientId} &bull;{" "}
                  {checkInSerial.patient.phone}
                </span>
                <span className="font-medium text-foreground">
                  Purpose:{" "}
                  {VISIT_TYPE_LABELS[checkInSerial.type] || checkInSerial.type}
                </span>
              </div>
              <div className="text-primary font-semibold text-[11px] pt-1.5 border-t border-border/60 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  Promised Arrival:{" "}
                  {checkInSerial.toldTime
                    ? formatBSTTime(checkInSerial.toldTime)
                    : checkInSerial.timeSlot}
                </span>
                <span className="text-muted-foreground text-[10px]">
                  Current Time: {formatBSTTime(new Date())}
                </span>
              </div>
            </div>
          )}

          <form onSubmit={handleConfirmArrivalCheckIn} className="space-y-4">
            {/* Room Confirmation / Selection for Arrival */}
            <div className="space-y-1.5">
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
            </div>

            {/* Custom Arrival Time (Optional override) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground">
                  Arrival Time Override (Optional)
                </Label>
                <span className="text-[10px] text-muted-foreground">
                  Leave blank for Current Time ({formatBSTTime(new Date())})
                </span>
              </div>
              <Input
                type="text"
                placeholder="e.g. 11:15 AM or 14:00 (Blank for Now)"
                value={checkInForm.customArrivalTime}
                onChange={(e) =>
                  setCheckInForm({
                    ...checkInForm,
                    customArrivalTime: e.target.value,
                  })
                }
                className="text-xs"
              />
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
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer shadow-xs gap-1.5"
              >
                <UserCheck className="h-4 w-4" />
                <span>Confirm Check-In</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG 4: Dedicated Serial Payment & Billing Edit Modal */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="sm:max-w-lg md:max-w-xl bg-card w-[95vw] sm:w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                {paymentSerial &&
                (paymentSerial.paidAmount > 0 ||
                  paymentSerial.isPackageCovered ||
                  paymentSerial.paymentStatus === PaymentStatus.PAID) ? (
                  <Pencil className="h-5 w-5" />
                ) : (
                  <CreditCard className="h-5 w-5" />
                )}
              </div>
              <div>
                <span>
                  {paymentSerial &&
                  (paymentSerial.paidAmount > 0 ||
                    paymentSerial.isPackageCovered ||
                    paymentSerial.paymentStatus === PaymentStatus.PAID)
                    ? "Edit Serial Payment & Billing Record"
                    : t(
                        "payment.collect_title",
                        "Collect Serial Fee / Payment",
                      )}
                </span>
                <span className="block text-xs font-normal text-muted-foreground">
                  (পেমেন্ট সংশোধন ও হিসাব হালনাগাদ)
                </span>
              </div>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t(
                "payment.collect_desc",
                "Adjust payment amount, fee, discount, or payment method. Automatically syncs with cash ledger.",
              )}
            </DialogDescription>
          </DialogHeader>

          {paymentSerial && (
            <div className="p-3.5 rounded-2xl bg-muted/60 border border-border text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-foreground text-sm">
                  {paymentSerial.patient.name}
                </span>
                <Badge
                  variant="default"
                  className="font-mono font-bold bg-primary"
                >
                  Serial #{paymentSerial.serialNumber}
                </Badge>
              </div>
              <div className="text-muted-foreground flex items-center justify-between text-[11px]">
                <span>
                  ID: #{paymentSerial.patient.patientId} &bull;{" "}
                  {paymentSerial.patient.phone}
                </span>
                <span className="font-medium text-foreground">
                  Chamber / Room: {paymentSerial.roomNo || "207"}
                </span>
              </div>

              {/* Fee Breakdown Pills */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/60">
                <div className="p-2 rounded-xl bg-background border border-border text-center">
                  <div className="text-[10px] text-muted-foreground">
                    Current Fee
                  </div>
                  <div className="font-mono font-black text-xs text-foreground">
                    ৳{paymentForm.fee || 500}
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400">
                    Paid Amount
                  </div>
                  <div className="font-mono font-black text-xs text-emerald-600 dark:text-emerald-400">
                    ৳{paymentForm.isNoPayment ? 0 : paymentForm.paidAmount || 0}
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
                  <div className="text-[10px] text-amber-600 dark:text-amber-400">
                    Remaining Due
                  </div>
                  <div className="font-mono font-black text-xs text-amber-600 dark:text-amber-400">
                    ৳
                    {paymentForm.isNoPayment
                      ? 0
                      : Math.max(
                          0,
                          (paymentForm.fee || 500) -
                            (paymentForm.discount || 0) -
                            (paymentForm.paidAmount || 0),
                        )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleConfirmPayment} className="space-y-4">
            {/* Quick Amount Preset Chips */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                Quick Presets
              </Label>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs font-semibold cursor-pointer hover:border-primary hover:bg-primary/10"
                  onClick={() => {
                    const currentFee = paymentForm.fee || 500;
                    setPaymentForm({
                      ...paymentForm,
                      paidAmount: currentFee,
                      discount: 0,
                      isNoPayment: false,
                      paymentStatus: PaymentStatus.PAID,
                    });
                  }}
                >
                  Full Fee (৳{paymentForm.fee || 500})
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs font-semibold cursor-pointer hover:border-primary hover:bg-primary/10"
                  onClick={() => {
                    setPaymentForm({
                      ...paymentForm,
                      paidAmount: 300,
                      discount: 0,
                      isNoPayment: false,
                      paymentStatus: PaymentStatus.PARTIALLY_PAID,
                    });
                  }}
                >
                  ৳300
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs font-semibold cursor-pointer hover:border-primary hover:bg-primary/10"
                  onClick={() => {
                    setPaymentForm({
                      ...paymentForm,
                      paidAmount: 200,
                      discount: 0,
                      isNoPayment: false,
                      paymentStatus: PaymentStatus.PARTIALLY_PAID,
                    });
                  }}
                >
                  ৳200
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs font-semibold cursor-pointer hover:border-purple-500 hover:bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30"
                  onClick={() => {
                    setPaymentForm({
                      ...paymentForm,
                      paidAmount: 0,
                      discount: 0,
                      isNoPayment: true,
                      paymentStatus: PaymentStatus.PAID,
                    });
                  }}
                >
                  Free / N.P (৳0)
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Standard Fee (Actual Bill) */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">
                  Total Fee / Bill Amount (৳) *
                </Label>
                <Input
                  type="number"
                  value={paymentForm.fee}
                  onChange={(e) =>
                    setPaymentForm({
                      ...paymentForm,
                      fee: Math.max(0, Number(e.target.value)),
                    })
                  }
                  className="font-mono text-xs"
                  min={0}
                  required
                />
              </div>

              {/* Payment Status Override */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">
                  Payment Status
                </Label>
                <Select
                  value={paymentForm.paymentStatus}
                  onValueChange={(val) =>
                    setPaymentForm({
                      ...paymentForm,
                      paymentStatus: val as PaymentStatus,
                    })
                  }
                >
                  <SelectTrigger className="w-full h-9 text-xs font-bold">
                    <SelectValue placeholder="Select Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={PaymentStatus.PAID}>
                      PAID (পরিশোধিত)
                    </SelectItem>
                    <SelectItem value={PaymentStatus.PARTIALLY_PAID}>
                      PARTIALLY PAID (আংশিক পরিশোধ)
                    </SelectItem>
                    <SelectItem value={PaymentStatus.UNPAID}>
                      UNPAID (বকেয়া)
                    </SelectItem>
                    <SelectItem value={PaymentStatus.REFUNDED}>
                      REFUNDED (ফেরত প্রদান)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Paid Amount */}
              <div className="space-y-1">
                <Label className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>
                    {t("checkin.amount", "Collected Paid Amount (৳)")} *
                  </span>
                  {paymentForm.isNoPayment && (
                    <span className="text-[10px] text-purple-600 font-normal">
                      Marked as Free / N.P
                    </span>
                  )}
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono font-bold">
                    ৳
                  </span>
                  <Input
                    type="number"
                    value={paymentForm.paidAmount}
                    onChange={(e) =>
                      setPaymentForm({
                        ...paymentForm,
                        paidAmount: Math.max(0, Number(e.target.value)),
                        isNoPayment: false,
                      })
                    }
                    disabled={paymentForm.isNoPayment}
                    className="pl-8 font-mono font-black text-sm"
                    required={!paymentForm.isNoPayment}
                    min={0}
                  />
                </div>
                {paymentErrors.paidAmount && (
                  <p className="text-[10px] text-destructive font-medium flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    {paymentErrors.paidAmount}
                  </p>
                )}
              </div>

              {/* Payment Method */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">
                  {t("checkin.method", "Payment Method")}
                </Label>
                <Select
                  value={paymentForm.paymentMethod}
                  onValueChange={(val) =>
                    setPaymentForm({
                      ...paymentForm,
                      paymentMethod: val as PaymentMethod,
                    })
                  }
                  disabled={paymentForm.isNoPayment}
                >
                  <SelectTrigger className="w-full h-9 text-xs">
                    <SelectValue placeholder="Select Method">
                      {paymentForm.paymentMethod
                        ? PAYMENT_METHOD_LABELS[paymentForm.paymentMethod]
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

            {/* Discount / Concession & Remarks */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">
                  Special Discount / Concession (৳)
                </Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={paymentForm.discount || ""}
                  onChange={(e) =>
                    setPaymentForm({
                      ...paymentForm,
                      discount: Math.max(0, Number(e.target.value)),
                    })
                  }
                  disabled={paymentForm.isNoPayment}
                  className="text-xs font-mono"
                  min={0}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">
                  Reason for Edit / Receipt Remarks
                </Label>
                <Input
                  type="text"
                  placeholder="e.g. Typo adjustment, Discount waiver, Cash correction"
                  value={paymentForm.notes}
                  onChange={(e) =>
                    setPaymentForm({
                      ...paymentForm,
                      notes: e.target.value,
                    })
                  }
                  className="text-xs"
                />
              </div>
            </div>

            {/* 1-Click N.P (No Payment Made / Package Covered) Toggle */}
            <div className="p-3 rounded-2xl border border-purple-500/30 bg-purple-500/5">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="modal-no-payment-checkbox"
                  checked={paymentForm.isNoPayment}
                  onCheckedChange={(checked) =>
                    setPaymentForm({
                      ...paymentForm,
                      isNoPayment: Boolean(checked),
                      paidAmount: checked ? 0 : paymentForm.fee || 500,
                      paymentStatus: PaymentStatus.PAID,
                    })
                  }
                />
                <Label
                  htmlFor="modal-no-payment-checkbox"
                  className="font-bold text-foreground text-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                  <span>
                    {t(
                      "checkin.mark_np",
                      "Mark as N.P (Package Covered / Complimentary Free Visit)",
                    )}
                  </span>
                </Label>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1 pl-6">
                {t(
                  "checkin.np_desc",
                  "Check this if patient is on an active treatment package or complimentary review session without fees.",
                )}
              </p>
            </div>

            {/* Live Calculation Summary Banner */}
            <div className="p-3 rounded-2xl bg-muted/70 border border-border flex items-center justify-between text-xs font-mono">
              <div>
                <span className="text-muted-foreground block text-[10px]">
                  Net Payable
                </span>
                <span className="font-bold text-foreground">
                  ৳
                  {paymentForm.isNoPayment
                    ? 0
                    : Math.max(
                        0,
                        (paymentForm.fee || 500) - (paymentForm.discount || 0),
                      )}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">
                  Collecting / Paid
                </span>
                <span className="font-bold text-primary">
                  ৳{paymentForm.isNoPayment ? 0 : paymentForm.paidAmount}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">
                  Balance Due
                </span>
                <span
                  className={`font-bold ${
                    (paymentForm.isNoPayment
                      ? 0
                      : Math.max(
                          0,
                          (paymentForm.fee || 500) -
                            (paymentForm.discount || 0) -
                            (paymentForm.paidAmount || 0),
                        )) > 0
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  ৳
                  {paymentForm.isNoPayment
                    ? 0
                    : Math.max(
                        0,
                        (paymentForm.fee || 500) -
                          (paymentForm.discount || 0) -
                          (paymentForm.paidAmount || 0),
                      )}
                </span>
              </div>
            </div>

            <DialogFooter className="pt-3 flex flex-row items-center justify-end gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsPaymentModalOpen(false)}
                className="cursor-pointer"
              >
                {t("btn.cancel", "Cancel")}
              </Button>
              <Button
                type="submit"
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold cursor-pointer shadow-xs gap-1.5"
              >
                <Banknote className="h-4 w-4" />
                <span>
                  {paymentSerial &&
                  (paymentSerial.paidAmount > 0 ||
                    paymentSerial.isPackageCovered ||
                    paymentSerial.paymentStatus === PaymentStatus.PAID)
                    ? "Save Payment Changes"
                    : paymentForm.isNoPayment
                      ? "Confirm Free / N.P Visit"
                      : `Record Payment (৳${paymentForm.paidAmount})`}
                </span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG 5: Edit Patient Profile Modal */}
      <Dialog open={isEditPatientOpen} onOpenChange={setIsEditPatientOpen}>
        <DialogContent className="sm:max-w-xl md:max-w-2xl bg-card w-[95vw] sm:w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <UserCog className="h-5 w-5" />
              </div>
              <div>
                <span>Edit Patient Profile &amp; Information</span>
                <span className="block text-xs font-normal text-muted-foreground">
                  (রোগীর তথ্য সংশোধন ও হালনাগাদ)
                </span>
              </div>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Update demographics, contact numbers, address, and clinical
              records for #{editPatientForm.patientId}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEditPatient} className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">
                  Patient 5-Digit ID *
                </Label>
                <Input
                  value={editPatientForm.patientId}
                  onChange={(e) =>
                    setEditPatientForm({
                      ...editPatientForm,
                      patientId: e.target.value,
                    })
                  }
                  className="font-mono text-xs"
                  required
                />
                {editPatientErrors.patientId && (
                  <p className="text-[10px] text-destructive font-medium flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    {editPatientErrors.patientId}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">
                  Full Name *
                </Label>
                <Input
                  value={editPatientForm.name}
                  onChange={(e) =>
                    setEditPatientForm({
                      ...editPatientForm,
                      name: e.target.value,
                    })
                  }
                  className="text-xs"
                  required
                />
                {editPatientErrors.name && (
                  <p className="text-[10px] text-destructive font-medium flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    {editPatientErrors.name}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">
                  Phone Number *
                </Label>
                <Input
                  value={editPatientForm.phone}
                  onChange={(e) =>
                    setEditPatientForm({
                      ...editPatientForm,
                      phone: e.target.value,
                    })
                  }
                  className="font-mono text-xs"
                  required
                />
                {editPatientErrors.phone && (
                  <p className="text-[10px] text-destructive font-medium flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    {editPatientErrors.phone}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">
                  Age (Years)
                </Label>
                <Input
                  type="number"
                  placeholder="e.g. 45"
                  value={editPatientForm.age}
                  onChange={(e) =>
                    setEditPatientForm({
                      ...editPatientForm,
                      age: e.target.value,
                    })
                  }
                  className="font-mono text-xs"
                  min={1}
                  max={125}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">
                  Gender *
                </Label>
                <Select
                  value={editPatientForm.gender}
                  onValueChange={(val) =>
                    setEditPatientForm({
                      ...editPatientForm,
                      gender: val as Gender,
                    })
                  }
                >
                  <SelectTrigger className="w-full h-9 text-xs">
                    <SelectValue placeholder="Gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={Gender.MALE}>Male (পুরুষ)</SelectItem>
                    <SelectItem value={Gender.FEMALE}>
                      Female (মহিলা)
                    </SelectItem>
                    <SelectItem value={Gender.OTHER}>
                      Other (অন্যান্য)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">
                  Blood Group
                </Label>
                <Select
                  value={editPatientForm.bloodGroup || "UNKNOWN"}
                  onValueChange={(val) =>
                    setEditPatientForm({
                      ...editPatientForm,
                      bloodGroup: val === "UNKNOWN" ? "" : (val as BloodGroup),
                    })
                  }
                >
                  <SelectTrigger className="w-full h-9 text-xs">
                    <SelectValue placeholder="Select Blood Group" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UNKNOWN">Not Known</SelectItem>
                    <SelectItem value={BloodGroup.A_POSITIVE}>A+</SelectItem>
                    <SelectItem value={BloodGroup.A_NEGATIVE}>A-</SelectItem>
                    <SelectItem value={BloodGroup.B_POSITIVE}>B+</SelectItem>
                    <SelectItem value={BloodGroup.B_NEGATIVE}>B-</SelectItem>
                    <SelectItem value={BloodGroup.O_POSITIVE}>O+</SelectItem>
                    <SelectItem value={BloodGroup.O_NEGATIVE}>O-</SelectItem>
                    <SelectItem value={BloodGroup.AB_POSITIVE}>AB+</SelectItem>
                    <SelectItem value={BloodGroup.AB_NEGATIVE}>AB-</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">
                  Occupation
                </Label>
                <Input
                  placeholder="e.g. Teacher, Business"
                  value={editPatientForm.occupation}
                  onChange={(e) =>
                    setEditPatientForm({
                      ...editPatientForm,
                      occupation: e.target.value,
                    })
                  }
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">
                  Email (Optional)
                </Label>
                <Input
                  type="email"
                  placeholder="e.g. name@mail.com"
                  value={editPatientForm.email}
                  onChange={(e) =>
                    setEditPatientForm({
                      ...editPatientForm,
                      email: e.target.value,
                    })
                  }
                  className="text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">
                  Address / Area
                </Label>
                <Input
                  placeholder="e.g. Mostofapur, Madaripur"
                  value={editPatientForm.address}
                  onChange={(e) =>
                    setEditPatientForm({
                      ...editPatientForm,
                      address: e.target.value,
                    })
                  }
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">
                  City / District
                </Label>
                <Input
                  placeholder="e.g. Madaripur"
                  value={editPatientForm.city}
                  onChange={(e) =>
                    setEditPatientForm({
                      ...editPatientForm,
                      city: e.target.value,
                    })
                  }
                  className="text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">
                  Emergency Contact Name
                </Label>
                <Input
                  placeholder="Relative / Guardian Name"
                  value={editPatientForm.emergencyContactName}
                  onChange={(e) =>
                    setEditPatientForm({
                      ...editPatientForm,
                      emergencyContactName: e.target.value,
                    })
                  }
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">
                  Emergency Contact Phone
                </Label>
                <Input
                  placeholder="Guardian Phone"
                  value={editPatientForm.emergencyContactPhone}
                  onChange={(e) =>
                    setEditPatientForm({
                      ...editPatientForm,
                      emergencyContactPhone: e.target.value,
                    })
                  }
                  className="font-mono text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                Clinical Remarks / Medical Notes
              </Label>
              <Input
                placeholder="e.g. Stroke rehab / Lower back pain / Post-surgery"
                value={editPatientForm.notes}
                onChange={(e) =>
                  setEditPatientForm({
                    ...editPatientForm,
                    notes: e.target.value,
                  })
                }
                className="text-xs"
              />
            </div>

            <DialogFooter className="pt-3 flex flex-row items-center justify-end gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditPatientOpen(false)}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-primary text-primary-foreground font-bold cursor-pointer shadow-xs gap-1.5"
              >
                <UserCheck className="h-4 w-4" />
                <span>Save Patient Changes</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG 6: Edit Serial / Appointment Booking Modal */}
      <Dialog open={isEditSerialOpen} onOpenChange={setIsEditSerialOpen}>
        <DialogContent className="sm:max-w-3xl md:max-w-4xl bg-card w-[96vw] sm:w-[92vw] md:w-[860px] p-4 sm:p-6 max-h-[92vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <FileEdit className="h-5 w-5" />
              </div>
              <div>
                <span>Edit Patient Serial / Appointment</span>
                <span className="block text-xs font-normal text-muted-foreground">
                  (সিরিয়াল ও অ্যাপয়েন্টমেন্ট সংশোধন)
                </span>
              </div>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Reschedule date, change time slot, update promised arrival time,
              or reassign chamber room.
            </DialogDescription>
          </DialogHeader>

          {editingSerial && (
            <div className="p-3.5 rounded-2xl bg-muted/60 border border-border text-xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-foreground text-sm">
                    {editingSerial.patient.name}
                  </span>
                  <Badge
                    variant="outline"
                    className="font-mono text-[10px] font-bold bg-background text-primary border-primary/30"
                  >
                    ID: #{editingSerial.patient.patientId}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {editingSerial.patient.gender}
                  </Badge>
                </div>
                <Badge
                  variant="default"
                  className="font-mono font-bold bg-primary"
                >
                  Serial #{editingSerial.serialNumber}
                </Badge>
              </div>
              <div className="text-muted-foreground flex items-center justify-between text-[11px]">
                <span>Phone: {editingSerial.patient.phone}</span>
                <span className="font-medium text-foreground">
                  Current Status:{" "}
                  <span className="font-bold text-primary">
                    {editingSerial.status.replace("_", " ")}
                  </span>
                </span>
              </div>
            </div>
          )}

          <form onSubmit={handleSaveEditSerial} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-primary">
                  Appointment Date *
                </Label>
                <Input
                  type="date"
                  value={editSerialForm.date}
                  onChange={(e) =>
                    setEditSerialForm({
                      ...editSerialForm,
                      date: e.target.value,
                    })
                  }
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">
                  Visit Purpose / Type
                </Label>
                <Select
                  value={editSerialForm.type}
                  onValueChange={(val) =>
                    setEditSerialForm({
                      ...editSerialForm,
                      type: val as VisitType,
                    })
                  }
                >
                  <SelectTrigger className="w-full h-9 text-xs">
                    <SelectValue placeholder="Select Visit Purpose">
                      {editSerialForm.type
                        ? VISIT_TYPE_LABELS[editSerialForm.type]
                        : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={VisitType.NEW_CONSULTATION}>
                      New Consultation (নতুন ভিজিট)
                    </SelectItem>
                    <SelectItem value={VisitType.FOLLOW_UP}>
                      Follow-up Therapy (চলমান থেরাপি)
                    </SelectItem>
                    <SelectItem value={VisitType.REPORT_REVIEW}>
                      Report Review (রিপোর্ট পর্যালোচনা)
                    </SelectItem>
                    <SelectItem value={VisitType.THERAPY_PROCEDURE}>
                      Therapy Procedure (থেরাপি পদ্ধতি)
                    </SelectItem>
                    <SelectItem value={VisitType.EMERGENCY}>
                      Emergency (জরুরী)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Ticket Booking Slot Picker */}
            <SlotTicketPicker
              selectedSlot={editSerialForm.hourlySlot}
              selectedTime={editSerialForm.toldTime}
              selectedDate={editSerialForm.date}
              onSlotSelect={(slot, toldTime, timeSlotLabel) =>
                setEditSerialForm({
                  ...editSerialForm,
                  hourlySlot: slot as HourlySlot,
                  toldTime,
                  timeSlot: timeSlotLabel,
                })
              }
              error={editSerialErrors.toldTime || editSerialErrors.hourlySlot}
            />

            {/* Promised Arrival Time (Told Time) Interactive Time Picker */}
            <PromisedTimePicker
              value={editSerialForm.toldTime}
              onChange={(timeStr) =>
                setEditSerialForm({ ...editSerialForm, toldTime: timeStr })
              }
              slotLabel={editSerialForm.timeSlot}
              error={editSerialErrors.toldTime}
            />

            {/* Status Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                Serial Queue Status
              </Label>
              <Select
                value={editSerialForm.status}
                onValueChange={(val) =>
                  setEditSerialForm({
                    ...editSerialForm,
                    status: val as SerialStatus,
                  })
                }
              >
                <SelectTrigger className="w-full h-9 text-xs font-bold">
                  <SelectValue placeholder="Queue Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SerialStatus.PENDING}>
                    PENDING (অপেক্ষমান শিডিউল)
                  </SelectItem>
                  <SelectItem value={SerialStatus.WAITING}>
                    WAITING / ARRIVED (উপস্থিত / ওয়েটিং লাউঞ্জ)
                  </SelectItem>
                  <SelectItem value={SerialStatus.IN_CONSULTATION}>
                    IN CONSULTATION (ডাক্তারের চেম্বারে)
                  </SelectItem>
                  <SelectItem value={SerialStatus.IN_THERAPY}>
                    IN THERAPY (থেরাপি বে-তে)
                  </SelectItem>
                  <SelectItem value={SerialStatus.COMPLETED}>
                    COMPLETED (সম্পন্ন)
                  </SelectItem>
                  <SelectItem value={SerialStatus.CANCELLED}>
                    CANCELLED (বাতিল)
                  </SelectItem>
                  <SelectItem value={SerialStatus.NO_SHOW}>
                    NO SHOW (অনুপস্থিত)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Assigned Chamber / Room */}
            <RoomSelect
              value={editSerialForm.roomNo}
              onChange={(roomNum) =>
                setEditSerialForm({ ...editSerialForm, roomNo: roomNum })
              }
              genderFilter={
                editingSerial?.patient?.gender === "MALE" ||
                editingSerial?.patient?.gender === "FEMALE"
                  ? editingSerial.patient.gender
                  : undefined
              }
              roomsOccupancy={roomsData?.rooms}
              label="Assigned Chamber / Room (Staff-only rooms excluded)"
            />

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                Desk Remarks / Notes
              </Label>
              <Input
                value={editSerialForm.notes}
                onChange={(e) =>
                  setEditSerialForm({
                    ...editSerialForm,
                    notes: e.target.value,
                  })
                }
                placeholder="e.g. Revisit / Mostofapur / Doctor review"
              />
            </div>

            {/* Report Checkbox */}
            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="edit-report-review-checkbox"
                checked={editSerialForm.isReport}
                onCheckedChange={(checked) =>
                  setEditSerialForm({
                    ...editSerialForm,
                    isReport: Boolean(checked),
                  })
                }
              />
              <Label
                htmlFor="edit-report-review-checkbox"
                className="text-xs font-medium cursor-pointer text-foreground"
              >
                Report Review Session (রিপোর্ট পর্যালোচনা)
              </Label>
            </div>

            <DialogFooter className="pt-3 flex flex-row items-center justify-end gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditSerialOpen(false)}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="font-bold cursor-pointer shadow-xs bg-primary text-primary-foreground gap-1.5"
              >
                <FileEdit className="h-4 w-4" />
                <span>Save Serial Changes</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
