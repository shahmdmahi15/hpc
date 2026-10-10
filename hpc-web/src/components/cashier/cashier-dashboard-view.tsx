"use client";

import * as React from "react";
import type { CashierDashboardData } from "@/actions/cashier/cashier.action";
import {
  getCashierDashboardDataAction,
  collectPaymentAction,
  processConsultationBillingAction,
  clearPreviousDueAction,
} from "@/actions/cashier/cashier.action";
import {
  DEFAULT_FEE,
  QUICK_BILLING_PRESETS,
} from "@/lib/billing";
import type {
  AppointmentWithRelations,
  PatientWithCount,
} from "@/actions/receptionist/appointment.action";
import { updateAppointmentStatusAction } from "@/actions/receptionist/appointment.action";
import {
  AppointmentStatus,
  AppointmentType,
  QueueType,
  Role,
} from "@/generated/prisma/enums";
import { CashierHeader } from "@/components/cashier/cashier-header";
import { SlotScheduleBoard } from "@/components/receptionist/slot-schedule-board";
import { PatientDirectoryView } from "@/components/receptionist/patient-directory-view";
import { CreatePatientDialog } from "@/components/receptionist/create-patient-dialog";
import { BookTicketDialog } from "@/components/receptionist/book-ticket-dialog";
import { ThermalReceiptDialog } from "@/components/print/thermal-receipt-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  Search,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Banknote,
  Smartphone,
  Printer,
  Receipt,
  User,
  Phone,
  Clock,
  CalendarDays,
  Calculator,
  Compass,
  Stethoscope,
  Activity,
  DoorOpen,
  ArrowRight,
  ShieldAlert,
  MessageSquare,
  FileText,
} from "lucide-react";
import { CashDrawerCloseoutDialog } from "@/components/cashier/cash-drawer-closeout-dialog";
import { StaffPerformerSelect } from "@/components/shared/staff-performer-select";
import { useRealtimeEvents } from "@/hooks/use-realtime-events";
import { toast } from "sonner";
import { formatTime12h, evaluatePunctuality } from "@/lib/queue-punctuality";
import { PatientJourneyTrackerView } from "@/components/tracking/patient-journey-tracker-view";
import { DashboardDateSelector, formatLocalDate } from "@/components/ui/dashboard-date-selector";
import { ClinicChatView } from "@/components/chat/clinic-chat-view";
import { useChatNotifications } from "@/hooks/use-chat-notifications";
import { playChatChime } from "@/lib/chat-chime";

interface CashierDashboardViewProps {
  initialData: CashierDashboardData;
  currentUserRole?: Role;
  currentUserId?: string;
}

export function CashierDashboardView({
  initialData,
  currentUserRole,
  currentUserId,
}: CashierDashboardViewProps) {
  const [data, setData] = React.useState<CashierDashboardData>(initialData);
  const [selectedDate, setSelectedDate] = React.useState<string>(
    initialData.selectedDate,
  );
  const [activeTab, setActiveTab] = React.useState<string>("pending");

  // Real-time Chat Notifications & Chime at the Cashier Console Root Level
  const { unreadCount: unreadChatCount } = useChatNotifications({
    isChatTabActive: activeTab === "chat",
    currentUserId,
    onOpenChatTab: () => setActiveTab("chat"),
  });

  // Search filter
  const [searchQuery, setSearchQuery] = React.useState("");

  // Payment Collection Modal State (Therapy Sessions)
  const [collectingAppointment, setCollectingAppointment] =
    React.useState<AppointmentWithRelations | null>(null);
  const [paymentAmount, setPaymentAmount] = React.useState<number>(500);
  const [paymentMethod, setPaymentMethod] = React.useState<
    "CASH" | "CARD" | "MFS" | "DUE"
  >("CASH");
  const [paymentNotes, setPaymentNotes] = React.useState<string>("");
  const [cashierPin, setCashierPin] = React.useState<string>("");
  const [isSubmittingPayment, setIsSubmittingPayment] = React.useState(false);
  const [includePreviousDueInTherapy, setIncludePreviousDueInTherapy] =
    React.useState<boolean>(false);
  const [previousDueInTherapyAmount, setPreviousDueInTherapyAmount] =
    React.useState<number>(0);
  const [includeConsultInTherapy, setIncludeConsultInTherapy] =
    React.useState<boolean>(false);
  const [consultInTherapyAmount, setConsultInTherapyAmount] =
    React.useState<number>(0);

  // Payment Collection Modal State (Consultation Serials)
  const [collectingSerial, setCollectingSerial] = React.useState<any | null>(null);
  const [consultPaymentAmount, setConsultPaymentAmount] = React.useState<number>(1000);
  const [consultPaymentMethod, setConsultPaymentMethod] = React.useState<
    "CASH" | "CARD" | "MFS" | "DUE"
  >("CASH");
  const [consultPaymentNotes, setConsultPaymentNotes] = React.useState<string>("");
  const [isSubmittingConsultPayment, setIsSubmittingConsultPayment] = React.useState(false);
  const [includePreviousDueInConsult, setIncludePreviousDueInConsult] =
    React.useState<boolean>(false);
  const [previousDueInConsultAmount, setPreviousDueInConsultAmount] =
    React.useState<number>(0);
  const [includeTherapyInConsult, setIncludeTherapyInConsult] =
    React.useState<boolean>(false);
  const [therapyInConsultAmount, setTherapyInConsultAmount] =
    React.useState<number>(0);

  // Previous Due Clearance Modal State (Therapy Arrivals - Scenario 7)
  const [clearingDueApt, setClearingDueApt] = React.useState<any | null>(null);
  const [clearDueAmount, setClearDueAmount] = React.useState<number>(0);
  const [clearDuePaymentMethod, setClearDuePaymentMethod] = React.useState<
    "CASH" | "CARD" | "MFS" | "DUE"
  >("CASH");
  const [clearDueNotes, setClearDueNotes] = React.useState<string>("");
  const [isSubmittingClearDue, setIsSubmittingClearDue] = React.useState(false);

  // Receipt modal state after payment
  const [receiptAppointment, setReceiptAppointment] =
    React.useState<AppointmentWithRelations | null>(null);
  const [isCloseoutOpen, setIsCloseoutOpen] = React.useState(false);

  // Dialogs for booking & patients
  const [isNewPatientOpen, setIsNewPatientOpen] = React.useState(false);
  const [isBookTicketOpen, setIsBookTicketOpen] = React.useState(false);
  const [preselectedSlotId, setPreselectedSlotId] = React.useState<
    string | undefined
  >();
  const [preselectedPatient, setPreselectedPatient] =
    React.useState<PatientWithCount | null>(null);

  // Sub-filter for pending bills (All, Doctor, Therapy)
  const [pendingCategory, setPendingCategory] = React.useState<"ALL" | "DOCTOR" | "THERAPY">("ALL");

  // Cashier performer identity
  const [selectedCashierPerformerId, setSelectedCashierPerformerId] =
    React.useState<string>(
      () =>
        initialData.currentCashier?.id ||
        (initialData.cashierPerformers.length === 1
          ? initialData.cashierPerformers[0].id
          : ""),
    );

  const currentCashierId = React.useMemo(() => {
    return (
      selectedCashierPerformerId ||
      initialData.currentCashier?.id ||
      initialData.cashierPerformers[0]?.id ||
      ""
    );
  }, [
    selectedCashierPerformerId,
    initialData.currentCashier,
    initialData.cashierPerformers,
  ]);

  // Transition refresh with ref to always use current selected date
  const [isPending, startTransition] = React.useTransition();

  const selectedDateRef = React.useRef(selectedDate);
  React.useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  const refreshData = React.useCallback(
    (targetDate?: string) => {
      startTransition(async () => {
        try {
          const dateToFetch = targetDate || selectedDateRef.current;
          const fresh = await getCashierDashboardDataAction(dateToFetch);
          setData(fresh);
        } catch (err) {
          console.error("[Cashier Dashboard Refresh Error]:", err);
        }
      });
    },
    [],
  );

  // Realtime offline SSE synchronization
  const { connectionStatus } = useRealtimeEvents({
    onEvent: (event) => {
      const type = (event?.type || "").toUpperCase();
      if (type !== "CHAT_MESSAGE_SENT" && type !== "CHAT_MESSAGE_DELETED") {
        refreshData(selectedDateRef.current);
        if (type === "CONSULTATION_SERIAL_BOOKED") {
          playChatChime(false);
          toast.info(
            `Doctor Consultation Forwarded: ${event.data?.patientName || "Patient"} (Dr. ${event.data?.doctorName || "Doctor"}) • ৳${event.data?.feeAmount ?? 0}`,
            { id: `serial-${event.data?.serialNumber || Date.now()}` },
          );
        } else if (type === "THERAPY_FORWARDED_FOR_DUE") {
          playChatChime(false);
          toast.info(
            `Therapy Arrival with Due: ${event.data?.patientName || "Patient"} (${event.data?.slotLabel || "Therapy Slot"}) • Due: ৳${event.data?.totalDue ?? 0}`,
            { id: `therapy-due-${event.data?.patientId || Date.now()}` },
          );
        } else if (type === "APPOINTMENT_CREATED") {
          toast.info(
            `New Ticket Booked: ${event.data?.patientName || "Patient"} • ৳${event.data?.feeAmount ?? DEFAULT_FEE} Due on Bill`,
            { id: `ticket-${event.data?.id || Date.now()}` },
          );
        }
      }
    },
    onReconnect: () => {
      refreshData(selectedDateRef.current);
    },
  });

  const isToday = selectedDate === formatLocalDate(new Date());

  // Date selection change
  const handleSelectDate = (newDate: string) => {
    setSelectedDate(newDate);
    refreshData(newDate);
  };

  // Quick book slot
  const handleBookSlot = (slotId: string) => {
    setPreselectedSlotId(slotId);
    setPreselectedPatient(null);
    setIsBookTicketOpen(true);
  };

  // New Patient created from dialog
  const handlePatientCreated = (
    patient: PatientWithCount,
    proceedToBooking: boolean,
  ) => {
    refreshData(selectedDate);
    if (proceedToBooking) {
      setPreselectedPatient(patient);
      setIsBookTicketOpen(true);
    }
  };

  // Ticket booked callback
  const handleTicketBooked = () => {
    refreshData(selectedDate);
  };

  // Check In from schedule board
  const handleCheckIn = async (appointmentId: string) => {
    try {
      const res = await updateAppointmentStatusAction(
        appointmentId,
        AppointmentStatus.CHECKED_IN,
        currentCashierId,
        QueueType.THERAPY,
      );
      if (res.success) {
        toast.success("Patient checked in successfully.");
        refreshData(selectedDate);
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Failed to check in patient.");
    }
  };

  // Cancel Ticket from schedule board
  const handleCancelAppointment = async (appointmentId: string) => {
    try {
      const res = await updateAppointmentStatusAction(
        appointmentId,
        AppointmentStatus.CANCELLED,
        currentCashierId,
      );
      if (res.success) {
        toast.success("Ticket cancelled.");
        refreshData(selectedDate);
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Failed to cancel ticket.");
    }
  };

  // Memoized checks for cross-department billing
  const pendingSerialForTherapy = React.useMemo(() => {
    if (!collectingAppointment) return null;
    return (
      data.pendingConsultationSerials.find(
        (s) => s.patientId === collectingAppointment.patientId,
      ) || null
    );
  }, [collectingAppointment, data.pendingConsultationSerials]);

  const pendingTherapyForConsult = React.useMemo(() => {
    if (!collectingSerial) return null;
    return (
      data.pendingAppointments.find(
        (a) => a.patientId === collectingSerial.patientId,
      ) || null
    );
  }, [collectingSerial, data.pendingAppointments]);

  // Open Therapy Payment Modal
  const handleOpenPaymentModal = (appointment: AppointmentWithRelations) => {
    setCollectingAppointment(appointment);
    const initialFee = appointment.feeAmount ?? 0;
    setPaymentAmount(initialFee);
    setPaymentMethod("CASH");
    setPaymentNotes("");
    setCashierPin("");
    const patientDue = appointment.patient?.totalDue ?? 0;
    setIncludePreviousDueInTherapy(patientDue > 0);
    setPreviousDueInTherapyAmount(patientDue);

    const matchSerial = data.pendingConsultationSerials.find(
      (s) => s.patientId === appointment.patientId,
    );
    if (matchSerial) {
      setIncludeConsultInTherapy(true);
      setConsultInTherapyAmount(matchSerial.feeAmount || 1000);
    } else {
      setIncludeConsultInTherapy(false);
      setConsultInTherapyAmount(0);
    }
  };

  // Submit Therapy Payment (or mark as DUE)
  const handleConfirmPayment = async (markAsDueDirectly = false) => {
    if (!collectingAppointment) return;

    if (currentCashierId && initialData.cashierPerformers.length > 0 && !cashierPin) {
      toast.error("Please enter your 4-digit Cashier PIN.");
      return;
    }

    const isDue = markAsDueDirectly || paymentMethod === "DUE";
    const amountToCollect = isDue ? 0 : paymentAmount;
    const initialFee = collectingAppointment.feeAmount ?? 0;
    const previousDueToCollect =
      !isDue && includePreviousDueInTherapy && previousDueInTherapyAmount > 0
        ? previousDueInTherapyAmount
        : 0;
    const extraConsultToCollect =
      !isDue && includeConsultInTherapy && pendingSerialForTherapy
        ? consultInTherapyAmount
        : 0;

    if (
      !isDue &&
      amountToCollect <= 0 &&
      initialFee > 0 &&
      previousDueToCollect <= 0 &&
      extraConsultToCollect <= 0
    ) {
      toast.error("Please enter a valid payment amount.");
      return;
    }

    setIsSubmittingPayment(true);
    try {
      const res = await collectPaymentAction({
        appointmentId: collectingAppointment.id,
        amount: amountToCollect,
        paymentMethod: isDue ? "DUE" : paymentMethod,
        isDue,
        performerId: currentCashierId || undefined,
        pin: cashierPin || undefined,
        notes: paymentNotes.trim() || undefined,
        previousDueCollected: previousDueToCollect,
        includeConsultationSerialId:
          !isDue && includeConsultInTherapy && pendingSerialForTherapy
            ? pendingSerialForTherapy.id
            : undefined,
        consultationAmount: extraConsultToCollect || undefined,
      });

      if (res.success) {
        toast.success(res.message);
        const receiptData = {
          ...(res.appointment || collectingAppointment),
          invoice: res.invoice || (res.appointment as any)?.invoice,
        } as AppointmentWithRelations;
        setReceiptAppointment(receiptData);
        setCollectingAppointment(null);
        refreshData();
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Failed to record payment.");
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Open Consultation Payment Modal
  const handleOpenConsultPaymentModal = (serial: any) => {
    setCollectingSerial(serial);
    setConsultPaymentAmount(serial.feeAmount || 1000);
    setConsultPaymentMethod("CASH");
    setConsultPaymentNotes("");
    setCashierPin("");
    const due = serial.patient?.totalDue || 0;
    setPreviousDueInConsultAmount(due);
    setIncludePreviousDueInConsult(due > 0);

    const matchTherapy = data.pendingAppointments.find(
      (a) => a.patientId === serial.patientId,
    );
    if (matchTherapy) {
      setIncludeTherapyInConsult(true);
      setTherapyInConsultAmount(matchTherapy.feeAmount ?? DEFAULT_FEE);
    } else {
      setIncludeTherapyInConsult(false);
      setTherapyInConsultAmount(0);
    }
  };

  // Submit Consultation Billing & Auto-Queue Trigger
  const handleConfirmConsultPayment = async (markAsDueDirectly = false) => {
    if (!collectingSerial) return;

    if (currentCashierId && initialData.cashierPerformers.length > 0 && !cashierPin) {
      toast.error("Please enter your 4-digit Cashier PIN.");
      return;
    }

    const isDue = markAsDueDirectly || consultPaymentMethod === "DUE";
    const amountToCollect = isDue ? 0 : consultPaymentAmount;
    const extraTherapyToCollect =
      !isDue && includeTherapyInConsult && pendingTherapyForConsult
        ? therapyInConsultAmount
        : 0;

    if (!isDue && amountToCollect <= 0 && extraTherapyToCollect <= 0) {
      toast.error("Please enter a valid payment amount.");
      return;
    }

    setIsSubmittingConsultPayment(true);
    try {
      const res = await processConsultationBillingAction({
        consultationSerialId: collectingSerial.id,
        amount: amountToCollect,
        paymentMethod: isDue ? "DUE" : consultPaymentMethod,
        isDue,
        performerId: currentCashierId || undefined,
        pin: cashierPin || undefined,
        notes: consultPaymentNotes.trim() || undefined,
        previousDueCollected:
          !isDue && includePreviousDueInConsult ? previousDueInConsultAmount : 0,
        includeTherapyAppointmentId:
          !isDue && includeTherapyInConsult && pendingTherapyForConsult
            ? pendingTherapyForConsult.id
            : undefined,
        therapyAmount: extraTherapyToCollect || undefined,
      });

      if (res.success) {
        toast.success(res.message);
        if (res.invoice) {
          setReceiptAppointment({
            id: res.invoice.invoiceNumber,
            appointmentDate: new Date(),
            feeAmount: collectingSerial.feeAmount,
            paidAmount: res.invoice.paidAmount,
            dueAmount: res.invoice.dueAmount,
            paymentStatus: res.invoice.status,
            patient: collectingSerial.patient,
            type: AppointmentType.CONSULTATION,
            doctor: collectingSerial.doctor,
            invoice: res.invoice,
            room: { number: "Waiting", purpose: "Public Waiting Room" },
          } as any);
        }
        setCollectingSerial(null);
        refreshData();
      } else {
        toast.error(res.message);
      }
    } catch (e) {
      toast.error("Failed to process consultation billing.");
    } finally {
      setIsSubmittingConsultPayment(false);
    }
  };

  // Open Therapy Arrival Due Clearance Modal (Scenario 7)
  const handleOpenClearDueModal = (apt: any) => {
    setClearingDueApt(apt);
    setClearDueAmount(apt.patient?.totalDue || 0);
    setClearDuePaymentMethod("CASH");
    setClearDueNotes("");
    setCashierPin("");
  };

  // Submit Therapy Arrival Due Clearance & Queue Trigger
  const handleConfirmClearDue = async (markAsDueDirectly = false) => {
    if (!clearingDueApt) return;

    if (currentCashierId && initialData.cashierPerformers.length > 0 && !cashierPin) {
      toast.error("Please enter your 4-digit Cashier PIN.");
      return;
    }

    const isDue = markAsDueDirectly || clearDuePaymentMethod === "DUE";
    const amountToCollect = isDue ? 0 : clearDueAmount;

    if (!isDue && amountToCollect <= 0) {
      toast.error("Please enter a valid payment amount.");
      return;
    }

    setIsSubmittingClearDue(true);
    try {
      const res = await clearPreviousDueAction({
        patientId: clearingDueApt.patientId,
        appointmentId: clearingDueApt.id,
        amount: amountToCollect,
        paymentMethod: isDue ? "DUE" : clearDuePaymentMethod,
        isDue,
        performerId: currentCashierId || undefined,
        pin: cashierPin || undefined,
        notes: clearDueNotes.trim() || undefined,
      });

      if (res.success) {
        toast.success(res.message);
        if (res.invoice) {
          setReceiptAppointment({
            id: res.invoice.invoiceNumber,
            appointmentDate: new Date(),
            feeAmount: amountToCollect,
            paidAmount: amountToCollect,
            dueAmount: 0,
            paymentStatus: "PAID",
            patient: clearingDueApt.patient,
            type: AppointmentType.THERAPY,
            invoice: res.invoice,
            room: { number: "Therapy", purpose: "Physical Therapy Floor" },
          } as any);
        }
        setClearingDueApt(null);
        refreshData();
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Failed to clear previous due.");
    } finally {
      setIsSubmittingClearDue(false);
    }
  };

  // Filtered therapy appointments
  const filteredPending = React.useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return data.pendingAppointments.filter((item) => {
      if (!q) return true;
      const name = (item.patient?.name || "").toLowerCase();
      const phone = (item.patient?.phone || "").toLowerCase();
      const token = item.id.slice(-4).toLowerCase();
      const mrn = (item.patient?.mrn || "").toLowerCase();
      return (
        name.includes(q) ||
        phone.includes(q) ||
        token.includes(q) ||
        mrn.includes(q)
      );
    });
  }, [data.pendingAppointments, searchQuery]);

  // Filtered consultation serials awaiting payment
  const filteredPendingConsultations = React.useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const list = data.pendingConsultationSerials || [];
    return list.filter((item: any) => {
      if (!q) return true;
      const name = (item.patient?.name || "").toLowerCase();
      const phone = (item.patient?.phone || "").toLowerCase();
      const mrn = (item.patient?.mrn || "").toLowerCase();
      const doc = (item.doctor?.name || "").toLowerCase();
      const serial = String(item.serialNumber);
      return (
        name.includes(q) ||
        phone.includes(q) ||
        mrn.includes(q) ||
        doc.includes(q) ||
        serial.includes(q)
      );
    });
  }, [data.pendingConsultationSerials, searchQuery]);

  const filteredPaid = React.useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return data.paidAppointments.filter((item) => {
      if (!q) return true;
      const name = (item.patient?.name || "").toLowerCase();
      const phone = (item.patient?.phone || "").toLowerCase();
      const token = item.id.slice(-4).toLowerCase();
      const mrn = (item.patient?.mrn || "").toLowerCase();
      const inv = (item.invoice?.invoiceNumber || (item as any).invoice?.invoiceNumber || "").toLowerCase();
      return (
        name.includes(q) ||
        phone.includes(q) ||
        token.includes(q) ||
        mrn.includes(q) ||
        inv.includes(q)
      );
    });
  }, [data.paidAppointments, searchQuery]);

  // Filtered settled consultation serials for Paid Invoices tab
  const filteredPaidConsultations = React.useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const list = data.paidConsultationSerials || [];
    return list.filter((item: any) => {
      if (!q) return true;
      const name = (item.patient?.name || "").toLowerCase();
      const phone = (item.patient?.phone || "").toLowerCase();
      const mrn = (item.patient?.mrn || "").toLowerCase();
      const doc = (item.doctor?.name || "").toLowerCase();
      const serial = String(item.serialNumber || "");
      const inv = (item.invoice?.invoiceNumber || "").toLowerCase();
      return (
        name.includes(q) ||
        phone.includes(q) ||
        mrn.includes(q) ||
        doc.includes(q) ||
        serial.includes(q) ||
        inv.includes(q)
      );
    });
  }, [data.paidConsultationSerials, searchQuery]);

  // Filtered therapy arrivals awaiting due clearance (Scenario 7)
  const filteredTherapyDueClearance = React.useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const list = data.therapyAwaitingDueClearance || [];
    return list.filter((item: any) => {
      if (!q) return true;
      const name = (item.patient?.name || "").toLowerCase();
      const phone = (item.patient?.phone || "").toLowerCase();
      const mrn = (item.patient?.mrn || "").toLowerCase();
      const slot = (item.therapySlot?.label || "").toLowerCase();
      return (
        name.includes(q) ||
        phone.includes(q) ||
        mrn.includes(q) ||
        slot.includes(q)
      );
    });
  }, [data.therapyAwaitingDueClearance, searchQuery]);

  const totalPendingBillsCount =
    filteredPending.length +
    filteredPendingConsultations.length +
    filteredTherapyDueClearance.length;

  const totalPaidInvoicesCount =
    filteredPaid.length + filteredPaidConsultations.length;

  return (
    <div className="min-h-screen w-full flex flex-col bg-background text-foreground selection:bg-amber-500/20">
      {/* 1. Full-Width Cashier Header */}
      <CashierHeader
        connectionStatus={connectionStatus}
        currentUserRole={currentUserRole}
      />

      {/* 2. Main Workspace */}
      <main className="flex-1 w-full max-w-[1700px] mx-auto px-3 sm:px-5 py-2.5 space-y-2.5">
        {/* Top Control Bar: Date Selector, Search & Financial Badges */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2.5 bg-card/60 backdrop-blur-xl p-2.5 px-3 rounded-xl border border-border/80 shadow-xs">
          {/* Left: Date Navigator & Live Search */}
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <DashboardDateSelector
              selectedDate={selectedDate}
              dayOfWeek={data.dayOfWeek}
              onSelectDate={handleSelectDate}
              onRefresh={() => refreshData(selectedDate)}
              isRefreshing={isPending}
            />

            {/* Live Search */}
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                type="search"
                name="cashier_billing_search_query"
                placeholder="Search bills by patient, phone, serial..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs rounded-lg bg-background border-border/80 focus-visible:ring-amber-500"
              />
            </div>
          </div>

          {/* Right: Financial Badges */}
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground flex-wrap">
            {/* Total Collected */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold text-[11px]">
              <Banknote className="size-3.5" />
              <span>
                {isToday ? "Collected Today:" : "Collected:"} ৳
                {data.billingStats.totalCollected.toLocaleString()}
              </span>
            </div>

            {/* Pending Due */}
            {data.billingStats.pendingCollection > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 font-bold text-[11px] animate-pulse">
                <AlertCircle className="size-3.5" />
                <span>
                  Pending: ৳
                  {data.billingStats.pendingCollection.toLocaleString()}
                </span>
              </div>
            )}

            {/* Paid Count */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/60 border border-border text-muted-foreground font-bold text-[11px]">
              <CheckCircle2 className="size-3 text-emerald-500" />
              <span>Paid: {data.billingStats.paidCount}</span>
            </div>

            {/* Pending Count */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/60 border border-border text-muted-foreground font-bold text-[11px]">
              <Clock className="size-3 text-amber-500" />
              <span>Unpaid: {totalPendingBillsCount}</span>
            </div>

            {/* Daily Shift Closeout Button */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsCloseoutOpen(true)}
              className="h-7.5 px-2.5 text-xs font-bold gap-1.5 border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 cursor-pointer shadow-2xs"
              title="Daily Shift Register Closeout & Cash Count"
            >
              <Calculator className="size-3.5 text-amber-500" />
              <span>Shift Closeout</span>
            </Button>
          </div>
        </div>

        {/* Unified Tabs Layout */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-2">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2 border-b border-border/60 pb-1.5 w-full min-w-0">
            <div className="w-full overflow-x-auto scrollbar-none min-w-0">
              <TabsList className="h-auto min-h-9 rounded-xl bg-muted/50 p-1 border border-border/60 inline-flex items-center gap-1 shrink-0 overflow-y-hidden scrollbar-none">
                <TabsTrigger
                  value="pending"
                  className="text-xs h-7 px-3 gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs font-semibold shrink-0 whitespace-nowrap"
                >
                  <CreditCard className="size-3 text-amber-500" />
                  <span>Pending Bills</span>
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300">
                    {totalPendingBillsCount}
                  </span>
                </TabsTrigger>

                <TabsTrigger
                  value="paid"
                  className="text-xs h-7 px-3 gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs font-semibold shrink-0 whitespace-nowrap"
                >
                  <Receipt className="size-3 text-emerald-500" />
                  <span>Paid Invoices</span>
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                    {totalPaidInvoicesCount}
                  </span>
                </TabsTrigger>

                <TabsTrigger
                  value="schedule"
                  className="text-xs h-7 px-3 gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs font-semibold shrink-0 whitespace-nowrap"
                >
                  <CalendarDays className="size-3 text-blue-500" />
                  <span>Book Slots</span>
                </TabsTrigger>

                <TabsTrigger
                  value="tracking"
                  className="text-xs h-7 px-3 gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs font-semibold shrink-0 whitespace-nowrap"
                >
                  <Compass className="size-3 text-indigo-500" />
                  <span>Patient Journey</span>
                </TabsTrigger>

                <TabsTrigger
                  value="patients"
                  className="text-xs h-7 px-3 gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs font-semibold shrink-0 whitespace-nowrap"
                >
                  <User className="size-3 text-purple-500" />
                  <span>Patients</span>
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-muted text-muted-foreground">
                    {data.patients.length}
                  </span>
                </TabsTrigger>

                <TabsTrigger
                  value="chat"
                  className="text-xs h-7 px-3 gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs font-semibold shrink-0 whitespace-nowrap"
                >
                  <MessageSquare className="size-3 text-primary" />
                  <span>Clinic Chat</span>
                  {unreadChatCount > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-bold font-mono animate-pulse shadow-xs">
                      {unreadChatCount}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          {/* TAB 1: PENDING BILLS (Doctor Consultations & Therapy Sessions) */}
          <TabsContent value="pending" className="mt-0 space-y-4">
            {/* Category Filter Pills */}
            <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant={pendingCategory === "ALL" ? "default" : "outline"}
                  onClick={() => setPendingCategory("ALL")}
                  className="h-7 px-2.5 text-xs font-semibold cursor-pointer"
                >
                  All Pending ({totalPendingBillsCount})
                </Button>
                <Button
                  size="sm"
                  variant={pendingCategory === "DOCTOR" ? "default" : "outline"}
                  onClick={() => setPendingCategory("DOCTOR")}
                  className="h-7 px-2.5 text-xs font-semibold gap-1.5 cursor-pointer text-indigo-700 dark:text-indigo-300 border-indigo-500/30"
                >
                  <Stethoscope className="size-3 text-indigo-500" />
                  <span>Doctor Consultations ({filteredPendingConsultations.length})</span>
                </Button>
                <Button
                  size="sm"
                  variant={pendingCategory === "THERAPY" ? "default" : "outline"}
                  onClick={() => setPendingCategory("THERAPY")}
                  className="h-7 px-2.5 text-xs font-semibold gap-1.5 cursor-pointer text-sky-700 dark:text-sky-300 border-sky-500/30"
                >
                  <Activity className="size-3 text-sky-500" />
                  <span>Physical Therapy ({filteredPending.length})</span>
                </Button>
              </div>

              <span className="font-mono text-amber-700 dark:text-amber-300 font-bold text-xs bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                Pending Collection: ৳{data.billingStats.pendingCollection.toLocaleString()}
              </span>
            </div>

            {totalPendingBillsCount === 0 ? (
              <div className="p-8 text-center rounded-xl border border-dashed border-border bg-card/40">
                <CheckCircle2 className="size-8 text-emerald-500/60 mx-auto mb-2" />
                <h3 className="text-sm font-semibold text-foreground">
                  All Patient Bills Cleared
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  No outstanding uncollected tickets or consultation serials found for this date.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* SECTION 1: DOCTOR CONSULTATION SERIALS AWAITING BILLING */}
                {(pendingCategory === "ALL" || pendingCategory === "DOCTOR") &&
                  filteredPendingConsultations.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                        <Stethoscope className="size-4 text-indigo-500" />
                        <span>
                          Doctor Consultation Bills ({filteredPendingConsultations.length}) — Forwarded from Reception
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                        {filteredPendingConsultations.map((serial: any) => {
                          const punctuality = evaluatePunctuality(
                            serial.toldTime,
                            serial.createdAt,
                          );

                          return (
                            <div
                              key={serial.id}
                              className="group flex flex-col justify-between p-3 rounded-xl border border-indigo-500/30 bg-card hover:border-indigo-500/60 hover:shadow-xs transition-all space-y-2.5"
                            >
                              <div className="space-y-2">
                                <div className="flex items-center justify-between gap-1.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-mono font-bold text-xs border border-indigo-500/30">
                                      Serial #{serial.serialNumber}
                                    </span>
                                    <Badge
                                      variant="outline"
                                      className="text-[9.5px] uppercase font-bold text-indigo-600 dark:text-indigo-400 py-0"
                                    >
                                      Doctor
                                    </Badge>
                                  </div>
                                  <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.2 rounded-md">
                                    ৳{serial.feeAmount} DUE
                                  </span>
                                </div>

                                <div>
                                  <div className="font-bold text-xs text-foreground group-hover:text-indigo-600 transition-colors truncate">
                                    {serial.patient?.name || "Patient"}
                                  </div>
                                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <Phone className="size-2.5" />
                                      {serial.patient?.phone || "---"}
                                    </span>
                                    {serial.patient?.mrn && (
                                      <span className="text-[10px] font-mono">
                                        MRN: {serial.patient.mrn}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="p-2 rounded-lg bg-indigo-500/5 border border-indigo-500/15 space-y-1 text-[11px]">
                                  <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Doctor:</span>
                                    <span className="font-bold text-foreground">
                                      Dr. {serial.doctor?.name || "Doctor"}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between text-[10px]">
                                    <span className="text-muted-foreground">Status:</span>
                                    <span className="text-amber-600 dark:text-amber-400 font-semibold">
                                      Forwarded to Cashier
                                    </span>
                                  </div>
                                </div>

                                {serial.notes && (
                                  <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10.5px] text-amber-900 dark:text-amber-200 flex items-start gap-1">
                                    <FileText className="size-3 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                    <span className="italic line-clamp-2">{serial.notes}</span>
                                  </div>
                                )}

                                {(serial.patient?.totalDue ?? 0) > 0 && (
                                  <div className="flex items-center justify-between text-[10px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/25 font-bold">
                                    <span>Previous Due:</span>
                                    <span className="font-mono text-rose-600 dark:text-rose-400">
                                      ৳{serial.patient.totalDue}
                                    </span>
                                  </div>
                                )}

                                <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
                                  <span
                                    className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded-full border flex items-center gap-1 ${punctuality.badgeClass}`}
                                  >
                                    <span className={`size-1 rounded-full ${punctuality.dotClass}`} />
                                    <span>{punctuality.label}</span>
                                  </span>
                                  <span className="font-mono font-bold text-sm text-indigo-600 dark:text-indigo-400">
                                    ৳{serial.feeAmount}
                                  </span>
                                </div>
                              </div>

                              <div className="pt-2 border-t border-border/50">
                                <Button
                                  size="sm"
                                  onClick={() => handleOpenConsultPaymentModal(serial)}
                                  className="w-full h-7.5 text-xs font-semibold gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer"
                                >
                                  <CreditCard className="size-3.5" />
                                  <span>Collect / Mark Due &amp; Queue</span>
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                {/* SECTION 1.5: THERAPY ARRIVALS AWAITING DUE CLEARANCE (SCENARIO 7) */}
                {(pendingCategory === "ALL" || pendingCategory === "THERAPY") &&
                  filteredTherapyDueClearance.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-300">
                        <AlertCircle className="size-4 text-amber-500 animate-pulse" />
                        <span>
                          Outstanding Due Clearance — Therapy Arrivals ({filteredTherapyDueClearance.length})
                        </span>
                        <span className="text-[10px] font-normal text-muted-foreground ml-1">
                          (Waiting Room • Clear due or acknowledge to place into Therapy Queue)
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                        {filteredTherapyDueClearance.map((item: any) => {
                          const patientDue = item.patient?.totalDue || 0;

                          return (
                            <div
                              key={item.id}
                              className="group flex flex-col justify-between p-3 rounded-xl border border-amber-500/40 bg-amber-500/5 hover:border-amber-500/70 hover:shadow-xs transition-all space-y-2.5"
                            >
                              <div className="space-y-2">
                                <div className="flex items-center justify-between gap-1.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-800 dark:text-amber-200 font-mono font-bold text-xs border border-amber-500/30">
                                      {item.therapySlot?.label || "Therapy Slot"}
                                    </span>
                                    <Badge
                                      variant="outline"
                                      className="text-[9.5px] uppercase font-bold text-amber-700 dark:text-amber-300 py-0"
                                    >
                                      Arrival Due
                                    </Badge>
                                  </div>
                                  <span className="text-[10.5px] font-bold text-rose-700 dark:text-rose-300 bg-rose-500/15 border border-rose-500/30 px-1.5 py-0.2 rounded-md font-mono">
                                    ৳{patientDue} DUE
                                  </span>
                                </div>

                                <div>
                                  <div className="font-bold text-xs text-foreground group-hover:text-amber-600 transition-colors truncate">
                                    {item.patient?.name || "Patient"}
                                  </div>
                                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <Phone className="size-2.5" />
                                      {item.patient?.phone || "---"}
                                    </span>
                                    {item.patient?.mrn && (
                                      <span className="text-[10px] font-mono">
                                        MRN: {item.patient.mrn}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {item.notes && (
                                  <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10.5px] text-amber-900 dark:text-amber-200 flex items-start gap-1">
                                    <FileText className="size-3 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                    <span className="italic line-clamp-2">{item.notes}</span>
                                  </div>
                                )}

                                <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
                                  <span className="text-muted-foreground text-[11px]">
                                    Previous Due:
                                  </span>
                                  <span className="font-mono font-bold text-sm text-rose-600 dark:text-rose-400">
                                    ৳{patientDue}
                                  </span>
                                </div>
                              </div>

                              <div className="pt-2 border-t border-border/50">
                                <Button
                                  size="sm"
                                  onClick={() => handleOpenClearDueModal(item)}
                                  className="w-full h-7.5 text-xs font-semibold gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-xs cursor-pointer"
                                >
                                  <CreditCard className="size-3.5" />
                                  <span>Clear Due &amp; Queue for Therapy</span>
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                {/* SECTION 2: PHYSICAL THERAPY SESSIONS AWAITING BILLING */}
                {(pendingCategory === "ALL" || pendingCategory === "THERAPY") &&
                  filteredPending.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-sky-700 dark:text-sky-300">
                        <Activity className="size-4 text-sky-500" />
                        <span>
                          Physical Therapy Session Bills ({filteredPending.length})
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                        {filteredPending.map((item) => {
                          const estimatedFee = item.feeAmount ?? DEFAULT_FEE;
                          const patientDue = item.patient?.totalDue ?? 0;

                          return (
                            <div
                              key={item.id}
                              className="group flex flex-col justify-between p-3 rounded-xl border border-border/70 bg-card hover:border-amber-500/40 hover:shadow-xs transition-all space-y-2.5"
                            >
                              <div className="space-y-2">
                                <div className="flex items-center justify-between gap-1.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 font-mono font-bold text-xs border border-amber-500/20">
                                      #{item.id.slice(-4).toUpperCase()}
                                    </span>
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] uppercase font-bold tracking-wider py-0"
                                    >
                                      {item.type}
                                    </Badge>
                                  </div>
                                  <span className="text-[10.5px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.2 rounded-md">
                                    ৳{estimatedFee} DUE
                                  </span>
                                </div>

                                <div>
                                  <div className="font-bold text-xs text-foreground group-hover:text-amber-600 transition-colors truncate">
                                    {item.patient?.name || "Patient"}
                                  </div>
                                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <Phone className="size-2.5" />
                                      {item.patient?.phone || "---"}
                                    </span>
                                    {item.patient?.mrn && (
                                      <span className="text-[10px] font-mono">
                                        MRN: {item.patient.mrn}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {item.notes && (
                                  <div className="p-1.5 rounded-lg bg-muted/40 border border-border/50 text-[10.5px] text-muted-foreground flex items-start gap-1">
                                    <FileText className="size-3 text-sky-500 shrink-0 mt-0.5" />
                                    <span className="italic line-clamp-2">{item.notes}</span>
                                  </div>
                                )}

                                {patientDue > 0 && (
                                  <div className="flex items-center justify-between text-[10px] px-2 py-0.5 rounded bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-500/25 font-bold">
                                    <span className="flex items-center gap-1">
                                      <AlertCircle className="size-2.5 text-rose-500" />
                                      <span>Previous Due:</span>
                                    </span>
                                    <span className="font-mono text-rose-600 dark:text-rose-400">
                                      ৳{patientDue}
                                    </span>
                                  </div>
                                )}

                                <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
                                  <span className="text-muted-foreground text-[11px]">
                                    {item.therapySlot
                                      ? `${formatTime12h(item.therapySlot.startTime)} - ${formatTime12h(item.therapySlot.endTime)}`
                                      : item.room?.number || "General Chamber"}
                                  </span>
                                  <span className="font-mono font-bold text-sm text-amber-600 dark:text-amber-400">
                                    ৳{estimatedFee} Due
                                  </span>
                                </div>
                              </div>

                              <div className="pt-2 border-t border-border/50">
                                <Button
                                  size="sm"
                                  onClick={() => handleOpenPaymentModal(item)}
                                  className="w-full h-7.5 text-xs font-semibold gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-xs cursor-pointer"
                                >
                                  <CreditCard className="size-3.5" />
                                  <span>
                                    {estimatedFee === 0 && patientDue > 0
                                      ? `Clear ৳${patientDue} Due & Issue ৳0 Bill`
                                      : `Collect ৳${estimatedFee} Bill${patientDue > 0 ? " + Due" : ""}`}
                                  </span>
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
              </div>
            )}
          </TabsContent>

          {/* TAB 2: PAID INVOICES */}
          <TabsContent value="paid" className="mt-0 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1 pb-1 border-b border-border/40">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-emerald-500" />
                <span>
                  Settled Invoices for{" "}
                  <strong className="text-foreground font-semibold">
                    {isToday ? "Today" : selectedDate} ({data.dayOfWeek})
                  </strong>
                  : {totalPaidInvoicesCount} payment{totalPaidInvoicesCount === 1 ? "" : "s"}
                </span>
              </span>
              <span className="font-mono text-emerald-700 dark:text-emerald-300 font-bold text-xs bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                Total Settled: ৳{data.billingStats.totalCollected.toLocaleString()}
              </span>
            </div>
            {totalPaidInvoicesCount === 0 ? (
              <div className="p-8 text-center rounded-xl border border-dashed border-border bg-card/40">
                <Receipt className="size-8 text-muted-foreground/40 mx-auto mb-2" />
                <h3 className="text-sm font-semibold text-foreground">
                  No Settled Invoices Yet
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Payments collected today will appear here with receipts.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border/70 bg-muted/40 text-muted-foreground font-semibold">
                        <th className="py-2.5 px-3">Invoice / Token</th>
                        <th className="py-2.5 px-3">Patient</th>
                        <th className="py-2.5 px-3">Service &amp; Provider</th>
                        <th className="py-2.5 px-3">Fee</th>
                        <th className="py-2.5 px-3">Paid</th>
                        <th className="py-2.5 px-3">Due</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {/* Settled Doctor Consultation Serials */}
                      {filteredPaidConsultations.map((serial: any) => {
                        const fee = serial.feeAmount ?? 0;
                        const paid = serial.paidAmount ?? 0;
                        const due = serial.dueAmount ?? Math.max(0, fee - paid);
                        const invoiceNo =
                          serial.invoice?.invoiceNumber ||
                          `S-${String(serial.serialNumber).padStart(2, "0")}`;
                        const payMethod = serial.invoice?.paymentMethod || "CASH";

                        return (
                          <tr
                            key={`serial-${serial.id}`}
                            className="hover:bg-muted/30 transition-colors"
                          >
                            <td className="py-2.5 px-3">
                              <div className="font-mono font-bold text-foreground">
                                {invoiceNo}
                              </div>
                              <div className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
                                Serial #{serial.serialNumber}
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-foreground">
                                {serial.patient?.name || "Patient"}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {serial.patient?.phone}
                                {serial.patient?.mrn ? ` • ${serial.patient.mrn}` : ""}
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <Badge
                                variant="outline"
                                className="text-[10px] uppercase font-bold tracking-wider bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/25"
                              >
                                CONSULTATION
                              </Badge>
                              <div className="text-[11px] text-muted-foreground mt-0.5 font-medium">
                                {serial.doctor?.name || "Attending Doctor"}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 font-mono">৳{fee.toLocaleString()}</td>
                            <td className="py-2.5 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              ৳{paid.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-amber-600 dark:text-amber-400">
                              ৳{due.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    due === 0
                                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                      : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                                  }`}
                                >
                                  {serial.paymentStatus || "PAID"}
                                </span>
                                <span className="text-[10px] font-mono text-muted-foreground border border-border/70 px-1.5 py-0.2 rounded">
                                  {payMethod}
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  setReceiptAppointment({
                                    id: serial.invoice?.invoiceNumber || serial.id,
                                    appointmentDate: serial.appointmentDate || new Date(),
                                    feeAmount: fee,
                                    paidAmount: paid,
                                    dueAmount: due,
                                    paymentStatus: serial.paymentStatus || "PAID",
                                    paymentMethod: payMethod,
                                    patient: serial.patient,
                                    type: AppointmentType.CONSULTATION,
                                    doctor: serial.doctor,
                                    invoice: serial.invoice,
                                    room: {
                                      number: "Waiting",
                                      purpose: "Public Waiting Room",
                                    },
                                  } as any)
                                }
                                className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
                              >
                                <Printer className="size-3.5" />
                                <span>Receipt</span>
                              </Button>
                            </td>
                          </tr>
                        );
                      })}

                      {/* Settled Physical Therapy Appointments */}
                      {filteredPaid.map((item) => {
                        const fee = item.feeAmount ?? DEFAULT_FEE;
                        const paid = item.paidAmount ?? fee;
                        const due = item.dueAmount ?? 0;

                        return (
                          <tr
                            key={item.id}
                            className="hover:bg-muted/30 transition-colors"
                          >
                            <td className="py-2.5 px-3 font-mono font-bold">
                              {(item as any).invoice?.invoiceNumber ||
                                `#${item.id.slice(-4).toUpperCase()}`}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-foreground">
                                {item.patient?.name || "Patient"}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {item.patient?.phone}
                                {item.patient?.mrn ? ` • ${item.patient.mrn}` : ""}
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <Badge
                                variant="outline"
                                className="text-[10px] uppercase font-bold tracking-wider"
                              >
                                {item.type}
                              </Badge>
                              {item.therapySlot?.label && (
                                <div className="text-[11px] text-muted-foreground mt-0.5 font-medium">
                                  {item.therapySlot.label}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-mono">৳{fee.toLocaleString()}</td>
                            <td className="py-2.5 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              ৳{paid.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-amber-600 dark:text-amber-400">
                              ৳{due.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    due === 0
                                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                      : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                                  }`}
                                >
                                  {item.paymentStatus || "PAID"}
                                </span>
                                {item.paymentMethod && (
                                  <span className="text-[10px] font-mono text-muted-foreground border border-border/70 px-1.5 py-0.2 rounded">
                                    {item.paymentMethod}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setReceiptAppointment(item)}
                                className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
                              >
                                <Printer className="size-3.5" />
                                <span>Receipt</span>
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </TabsContent>

          {/* TAB 3: BOOK SLOTS / SCHEDULE BOARD */}
          <TabsContent value="schedule" className="mt-0">
            <SlotScheduleBoard
              slots={data.slots}
              stats={data.stats}
              selectedDate={selectedDate}
              dayOfWeek={data.dayOfWeek}
              showDateSelector={false}
              onSelectDate={handleSelectDate}
              onBookSlot={handleBookSlot}
              onCheckIn={handleCheckIn}
              onCancelAppointment={handleCancelAppointment}
            />
          </TabsContent>

          {/* TAB 4: PATIENT JOURNEY TRACKER */}
          <TabsContent value="tracking" className="mt-0">
            <PatientJourneyTrackerView
              defaultDate={selectedDate}
              showDateSelector={false}
            />
          </TabsContent>

          {/* TAB 5: PATIENTS DIRECTORY */}
          <TabsContent value="patients" className="mt-0">
            <PatientDirectoryView
              initialPatients={data.patients}
              totalCount={data.totalPatientsCount}
              onOpenNewPatient={() => setIsNewPatientOpen(true)}
              onBookTicketForPatient={(patient: any) => {
                setPreselectedPatient(patient);
                setPreselectedSlotId(undefined);
                setIsBookTicketOpen(true);
              }}
            />
          </TabsContent>

          {/* TAB 6: CLINIC CHAT */}
          <TabsContent value="chat" className="mt-0">
            <ClinicChatView
              currentUserRole={currentUserRole || Role.CASHIER}
              currentUserId={currentUserId}
              initialDate={selectedDate}
              showDateSelector={false}
              activePerformerId={selectedCashierPerformerId}
              performers={data.cashierPerformers}
              onDateChange={handleSelectDate}
            />
          </TabsContent>
        </Tabs>
      </main>

      {/* 3. MODAL: THERAPY PAYMENT COLLECTION */}
      <Dialog
        open={Boolean(collectingAppointment)}
        onOpenChange={(open) => {
          if (!open) setCollectingAppointment(null);
        }}
      >
        <DialogContent className="w-[96vw] max-w-lg md:max-w-xl max-h-[92dvh] flex flex-col p-0 overflow-hidden rounded-2xl shadow-2xl border-border/80">
          <DialogHeader className="p-4 sm:p-5 pb-3 sm:pb-4 pr-12 sm:pr-14 border-b border-border/60 bg-muted/20 shrink-0">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <CreditCard className="size-4 text-amber-500" />
              <span>Collect Physical Therapy Fee</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Record patient billing transaction, payment method, and issue receipt
            </DialogDescription>
          </DialogHeader>

          {collectingAppointment && (
            <div className="p-4 sm:p-5 space-y-3.5 text-xs flex-1 min-h-0 overflow-y-auto overscroll-contain">
              {/* Patient Info Card */}
              <div className="p-3 rounded-xl bg-muted/40 border border-border/80 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground text-sm">
                    {collectingAppointment.patient?.name || "Patient"}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 font-mono font-bold text-xs">
                    #{collectingAppointment.id.slice(-4).toUpperCase()}
                  </span>
                </div>
                <div className="text-muted-foreground flex items-center gap-2">
                  <span>
                    Phone: {collectingAppointment.patient?.phone || "---"}
                  </span>
                  <span>•</span>
                  <span>Type: Physical Therapy</span>
                </div>
              </div>

              {/* Cashier Performer Selection */}
              <StaffPerformerSelect
                performers={initialData.cashierPerformers.map((c) => ({
                  id: c.id,
                  name: c.name,
                  phone: c.phone || "",
                }))}
                selectedPerformerId={selectedCashierPerformerId}
                onSelectPerformerId={(id) => setSelectedCashierPerformerId(id)}
                pin={cashierPin}
                onPinChange={(p) => setCashierPin(p)}
                label="Authorizing Cashier"
                pinLabel="Cashier 4-Digit PIN:"
                fallbackRoleName="Cashier Desk"
                roleIcon={Banknote}
                pinInputName="cashier_desk_auth_pin"
              />

              {/* Amount Selection & Presets */}
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground text-xs">
                  Fee Amount (৳ BDT)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-bold text-muted-foreground">
                    ৳
                  </span>
                  <Input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(Number(e.target.value))}
                    className="pl-7 h-8.5 text-sm font-mono font-bold rounded-lg"
                  />
                </div>
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[10.5px] text-muted-foreground">
                    Presets:
                  </span>
                  {QUICK_BILLING_PRESETS.map((preset) => (
                    <Button
                      key={preset}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPaymentAmount(preset)}
                      className={`h-6 px-2 text-[10.5px] rounded-md font-mono ${
                        paymentAmount === preset
                          ? "bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300 font-bold"
                          : ""
                      }`}
                    >
                      ৳{preset}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Previous Due Callout & Option to Collect */}
              {(collectingAppointment.patient?.totalDue ?? 0) > 0 && (
                <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-300 font-bold">
                      <AlertCircle className="size-4 shrink-0" />
                      <span>
                        Previous Unpaid Due: ৳
                        {collectingAppointment.patient?.totalDue.toLocaleString()}
                      </span>
                    </div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includePreviousDueInTherapy}
                        onChange={(e) =>
                          setIncludePreviousDueInTherapy(e.target.checked)
                        }
                        className="size-3.5 rounded border-rose-500 text-rose-600 focus:ring-rose-500"
                      />
                      <span>Clear Due Now</span>
                    </label>
                  </div>

                  {includePreviousDueInTherapy && (
                    <div className="pt-2 border-t border-rose-500/20 space-y-1">
                      <label className="text-[11px] text-muted-foreground font-medium flex items-center justify-between">
                        <span>Previous Due Amount to Clear</span>
                        <span className="font-mono text-rose-600 font-bold">
                          Max: ৳{collectingAppointment.patient?.totalDue}
                        </span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono font-bold text-muted-foreground text-xs">
                          ৳
                        </span>
                        <Input
                          type="number"
                          value={previousDueInTherapyAmount}
                          onChange={(e) =>
                            setPreviousDueInTherapyAmount(
                              Math.min(
                                collectingAppointment.patient?.totalDue ?? 0,
                                Math.max(0, Number(e.target.value)),
                              ),
                            )
                          }
                          className="pl-6 h-7.5 text-xs font-mono font-bold rounded-lg border-rose-500/40"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Option to Bundle Pending Doctor Consultation */}
              {pendingSerialForTherapy && (
                <div className="p-3 rounded-xl border border-indigo-500/30 bg-indigo-500/10 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300 font-bold">
                      <Stethoscope className="size-4 shrink-0" />
                      <span>
                        Pending Doctor Consultation: Serial #{pendingSerialForTherapy.serialNumber} (৳{pendingSerialForTherapy.feeAmount})
                      </span>
                    </div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeConsultInTherapy}
                        onChange={(e) =>
                          setIncludeConsultInTherapy(e.target.checked)
                        }
                        className="size-3.5 rounded border-indigo-500 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Bundle Bill</span>
                    </label>
                  </div>
                  {includeConsultInTherapy && (
                    <div className="pt-2 border-t border-indigo-500/20 flex items-center justify-between gap-2">
                      <span className="text-muted-foreground text-xs">Consultation Fee to Collect:</span>
                      <div className="relative w-36">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono font-bold text-muted-foreground text-xs">
                          ৳
                        </span>
                        <Input
                          type="number"
                          value={consultInTherapyAmount}
                          onChange={(e) =>
                            setConsultInTherapyAmount(
                              Math.max(0, Number(e.target.value)),
                            )
                          }
                          className="pl-6 h-7 text-xs font-mono font-bold rounded-lg border-indigo-500/40"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Total Collection Summary */}
              {(includePreviousDueInTherapy || includeConsultInTherapy) && (
                <div className="p-2.5 rounded-xl bg-muted/40 border border-border flex items-center justify-between text-xs font-bold">
                  <span className="text-muted-foreground">Total Cashier Collection:</span>
                  <span className="text-sm font-mono text-amber-600 dark:text-amber-400">
                    ৳{((paymentMethod === "DUE" ? 0 : paymentAmount) + (includePreviousDueInTherapy ? previousDueInTherapyAmount : 0) + (includeConsultInTherapy ? consultInTherapyAmount : 0)).toLocaleString()}
                  </span>
                </div>
              )}

              {/* Payment Method Selector */}
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground text-xs">
                  Payment Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("CASH")}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs font-semibold gap-1 transition-all cursor-pointer ${
                      paymentMethod === "CASH"
                        ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300 shadow-xs"
                        : "border-border/80 bg-background text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    <Banknote className="size-4" />
                    <span>Cash</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod("CARD")}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs font-semibold gap-1 transition-all cursor-pointer ${
                      paymentMethod === "CARD"
                        ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300 shadow-xs"
                        : "border-border/80 bg-background text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    <CreditCard className="size-4" />
                    <span>POS Card</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod("MFS")}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs font-semibold gap-1 transition-all cursor-pointer ${
                      paymentMethod === "MFS"
                        ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300 shadow-xs"
                        : "border-border/80 bg-background text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    <Smartphone className="size-4" />
                    <span>bKash / Nagad</span>
                  </button>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="font-semibold text-foreground text-xs">
                  Transaction Notes / Reference (Optional)
                </label>
                <Input
                  type="text"
                  placeholder="e.g. TrxID, invoice remarks..."
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="h-8 text-xs rounded-lg"
                />
              </div>
            </div>
          )}

          <DialogFooter className="shrink-0 p-3 sm:p-4 border-t border-border/60 bg-muted/20 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => handleConfirmPayment(true)}
              disabled={isSubmittingPayment}
              className="h-8 text-xs gap-1 cursor-pointer bg-rose-600 hover:bg-rose-700"
            >
              <AlertCircle className="size-3.5" />
              <span>Mark as DUE &amp; Issue Invoice</span>
            </Button>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCollectingAppointment(null)}
                disabled={isSubmittingPayment}
                className="h-8 text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => handleConfirmPayment(false)}
                disabled={isSubmittingPayment}
                className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white gap-1.5 cursor-pointer shadow-xs"
              >
                {isSubmittingPayment ? (
                  <span>Recording...</span>
                ) : (
                  <>
                    <CheckCircle2 className="size-3.5" />
                    <span>Confirm Payment</span>
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 4. MODAL: DOCTOR CONSULTATION BILLING & AUTO-QUEUE */}
      <Dialog
        open={Boolean(collectingSerial)}
        onOpenChange={(open) => {
          if (!open) setCollectingSerial(null);
        }}
      >
        <DialogContent className="w-[96vw] max-w-lg md:max-w-xl max-h-[92dvh] flex flex-col p-0 overflow-hidden rounded-2xl shadow-2xl border-border/80">
          <DialogHeader className="p-4 sm:p-5 pb-3 sm:pb-4 pr-12 sm:pr-14 border-b border-border/60 bg-muted/20 shrink-0">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Stethoscope className="size-4 text-indigo-500" />
              <span>Collect Doctor Consultation Fee</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Collect consultation bill or mark DUE, issue invoice, and automatically queue patient into Doctor Chamber
            </DialogDescription>
          </DialogHeader>

          {collectingSerial && (
            <div className="p-4 sm:p-5 space-y-3.5 text-xs flex-1 min-h-0 overflow-y-auto overscroll-contain">
              {/* Patient & Doctor Info Card */}
              <div className="p-3.5 rounded-xl bg-indigo-500/5 border border-indigo-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-foreground text-sm">
                      {collectingSerial.patient?.name || "Patient"}
                    </span>
                    <div className="text-[11px] text-muted-foreground font-mono">
                      Phone: {collectingSerial.patient?.phone} • MRN: {collectingSerial.patient?.mrn || "Pending"}
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-mono font-bold text-xs border border-indigo-500/30">
                    Serial #{collectingSerial.serialNumber}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1.5 border-t border-indigo-500/20 text-xs">
                  <span className="text-muted-foreground">Destination Doctor:</span>
                  <span className="font-bold text-foreground">
                    Dr. {collectingSerial.doctor?.name || "Doctor"}
                  </span>
                </div>

                {/* Patient Notes / Chief Complaint */}
                {collectingSerial.notes && (
                  <div className="pt-2 border-t border-indigo-500/20 text-xs flex items-start gap-1.5 text-indigo-950 dark:text-indigo-200 bg-indigo-500/10 p-2 rounded-lg">
                    <FileText className="size-3.5 text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">Receptionist / Complaint Note: </span>
                      <span>{collectingSerial.notes}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Cashier Performer Selection */}
              <StaffPerformerSelect
                performers={initialData.cashierPerformers.map((c) => ({
                  id: c.id,
                  name: c.name,
                  phone: c.phone || "",
                }))}
                selectedPerformerId={selectedCashierPerformerId}
                onSelectPerformerId={(id) => setSelectedCashierPerformerId(id)}
                pin={cashierPin}
                onPinChange={(p) => setCashierPin(p)}
                label="Authorizing Cashier"
                pinLabel="Cashier 4-Digit PIN:"
                fallbackRoleName="Cashier Desk"
                roleIcon={Banknote}
                pinInputName="cashier_desk_auth_pin_consult"
              />

              {/* Consultation Fee Amount */}
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground text-xs flex items-center justify-between">
                  <span>Consultation Fee Amount (৳ BDT)</span>
                  <span className="text-muted-foreground font-normal">Preset by Receptionist</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-bold text-muted-foreground">
                    ৳
                  </span>
                  <Input
                    type="number"
                    value={consultPaymentAmount}
                    onChange={(e) => setConsultPaymentAmount(Number(e.target.value))}
                    className="pl-7 h-8.5 text-sm font-mono font-bold rounded-lg"
                  />
                </div>
              </div>

              {/* Previous Due Callout & Option to Collect (Scenario 5 & 6) */}
              {(collectingSerial.patient?.totalDue ?? 0) > 0 && (
                <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-300 font-bold">
                      <AlertCircle className="size-4 shrink-0" />
                      <span>Previous Unpaid Due: ৳{collectingSerial.patient.totalDue.toLocaleString()}</span>
                    </div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includePreviousDueInConsult}
                        onChange={(e) => setIncludePreviousDueInConsult(e.target.checked)}
                        className="rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                      />
                      <span>Collect with Consultation</span>
                    </label>
                  </div>
                  {includePreviousDueInConsult && (
                    <div className="pt-2 border-t border-rose-500/20 flex items-center justify-between gap-2">
                      <span className="text-muted-foreground text-xs">Amount of Due to Collect:</span>
                      <div className="relative w-36">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono font-bold text-muted-foreground text-xs">
                          ৳
                        </span>
                        <Input
                          type="number"
                          value={previousDueInConsultAmount}
                          onChange={(e) => setPreviousDueInConsultAmount(Number(e.target.value))}
                          className="pl-6 h-7 text-xs font-mono font-bold rounded-lg"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Option to Bundle Pending Physical Therapy Session */}
              {pendingTherapyForConsult && (
                <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 font-bold">
                      <Activity className="size-4 shrink-0" />
                      <span>
                        Pending Physical Therapy: {pendingTherapyForConsult.therapySlot?.label || "Session"} (৳{pendingTherapyForConsult.feeAmount ?? DEFAULT_FEE})
                      </span>
                    </div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeTherapyInConsult}
                        onChange={(e) =>
                          setIncludeTherapyInConsult(e.target.checked)
                        }
                        className="size-3.5 rounded border-amber-500 text-amber-600 focus:ring-amber-500"
                      />
                      <span>Bundle Bill</span>
                    </label>
                  </div>
                  {includeTherapyInConsult && (
                    <div className="pt-2 border-t border-amber-500/20 flex items-center justify-between gap-2">
                      <span className="text-muted-foreground text-xs">Therapy Fee to Collect:</span>
                      <div className="relative w-36">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono font-bold text-muted-foreground text-xs">
                          ৳
                        </span>
                        <Input
                          type="number"
                          value={therapyInConsultAmount}
                          onChange={(e) =>
                            setTherapyInConsultAmount(
                              Math.max(0, Number(e.target.value)),
                            )
                          }
                          className="pl-6 h-7 text-xs font-mono font-bold rounded-lg border-amber-500/40"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Total Collection Summary */}
              {(includePreviousDueInConsult || includeTherapyInConsult) && (
                <div className="p-2.5 rounded-xl bg-muted/40 border border-border flex items-center justify-between text-xs font-bold">
                  <span className="text-muted-foreground">Total Cashier Collection:</span>
                  <span className="text-sm font-mono text-indigo-600 dark:text-indigo-400">
                    ৳{((consultPaymentMethod === "DUE" ? 0 : consultPaymentAmount) + (includePreviousDueInConsult ? previousDueInConsultAmount : 0) + (includeTherapyInConsult ? therapyInConsultAmount : 0)).toLocaleString()}
                  </span>
                </div>
              )}

              {/* Payment Method Selector */}
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground text-xs">
                  Payment Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setConsultPaymentMethod("CASH")}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs font-semibold gap-1 transition-all cursor-pointer ${
                      consultPaymentMethod === "CASH"
                        ? "border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 shadow-xs"
                        : "border-border/80 bg-background text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    <Banknote className="size-4" />
                    <span>Cash</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConsultPaymentMethod("CARD")}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs font-semibold gap-1 transition-all cursor-pointer ${
                      consultPaymentMethod === "CARD"
                        ? "border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 shadow-xs"
                        : "border-border/80 bg-background text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    <CreditCard className="size-4" />
                    <span>POS Card</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConsultPaymentMethod("MFS")}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs font-semibold gap-1 transition-all cursor-pointer ${
                      consultPaymentMethod === "MFS"
                        ? "border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 shadow-xs"
                        : "border-border/80 bg-background text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    <Smartphone className="size-4" />
                    <span>bKash / Nagad</span>
                  </button>
                </div>
              </div>

              {/* Auto Queue Notice */}
              <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-200">
                <DoorOpen className="size-4 text-emerald-600 shrink-0" />
                <span>
                  Processing this invoice will <strong>automatically place the patient into the Doctor Consultation Queue</strong> in the Public Waiting Lounge.
                </span>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="font-semibold text-foreground text-xs">
                  Invoice Remarks (Optional)
                </label>
                <Input
                  type="text"
                  placeholder="e.g. TrxID or receipt notes..."
                  value={consultPaymentNotes}
                  onChange={(e) => setConsultPaymentNotes(e.target.value)}
                  className="h-8 text-xs rounded-lg"
                />
              </div>
            </div>
          )}

          <DialogFooter className="shrink-0 p-3 sm:p-4 border-t border-border/60 bg-muted/20 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => handleConfirmConsultPayment(true)}
              disabled={isSubmittingConsultPayment}
              className="h-8 text-xs gap-1 cursor-pointer bg-rose-600 hover:bg-rose-700"
            >
              <AlertCircle className="size-3.5" />
              <span>Mark as DUE &amp; Auto-Queue</span>
            </Button>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCollectingSerial(null)}
                disabled={isSubmittingConsultPayment}
                className="h-8 text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => handleConfirmConsultPayment(false)}
                disabled={isSubmittingConsultPayment}
                className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 cursor-pointer shadow-xs"
              >
                {isSubmittingConsultPayment ? (
                  <span>Processing &amp; Queuing...</span>
                ) : (
                  <>
                    <CheckCircle2 className="size-3.5" />
                    <span>Confirm Paid &amp; Auto-Queue</span>
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 5. MODAL: THERAPY ARRIVAL PREVIOUS DUE CLEARANCE & QUEUE (Scenario 7) */}
      <Dialog
        open={Boolean(clearingDueApt)}
        onOpenChange={(open) => {
          if (!open) setClearingDueApt(null);
        }}
      >
        <DialogContent className="w-[96vw] max-w-lg md:max-w-xl max-h-[92dvh] flex flex-col p-0 overflow-hidden rounded-2xl shadow-2xl border-border/80">
          <DialogHeader className="p-4 sm:p-5 pb-3 sm:pb-4 pr-12 sm:pr-14 border-b border-border/60 bg-muted/20 shrink-0">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <AlertCircle className="size-4 text-amber-500" />
              <span>Clear Previous Due &amp; Queue for Therapy</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Patient has an outstanding balance from prior visits. Collect payment or acknowledge DUE to admit patient into Physical Therapy queue.
            </DialogDescription>
          </DialogHeader>

          {clearingDueApt && (
            <div className="p-4 sm:p-5 space-y-3.5 text-xs flex-1 min-h-0 overflow-y-auto overscroll-contain">
              {/* Patient & Booking Info Card */}
              <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-foreground text-sm">
                      {clearingDueApt.patient?.name || "Patient"}
                    </span>
                    <div className="text-[11px] text-muted-foreground font-mono">
                      Phone: {clearingDueApt.patient?.phone} • MRN: {clearingDueApt.patient?.mrn || "Pending"}
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 font-mono font-bold text-xs border border-amber-500/30">
                    {clearingDueApt.therapySlot?.label || "Therapy Slot"}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1.5 border-t border-amber-500/20 text-xs">
                  <span className="text-muted-foreground">Total Prior Outstanding Due:</span>
                  <span className="font-bold font-mono text-sm text-rose-600 dark:text-rose-400">
                    ৳{(clearingDueApt.patient?.totalDue || 0).toLocaleString()}
                  </span>
                </div>

                {/* Arrival Notes if any */}
                {(clearingDueApt.notes || clearingDueApt.arrivalNotes) && (
                  <div className="pt-2 border-t border-amber-500/20 text-xs flex items-start gap-1.5 text-amber-950 dark:text-amber-200 bg-amber-500/10 p-2 rounded-lg">
                    <FileText className="size-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">Notes: </span>
                      <span>{clearingDueApt.notes || clearingDueApt.arrivalNotes}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Cashier Performer Selection */}
              <StaffPerformerSelect
                performers={initialData.cashierPerformers.map((c) => ({
                  id: c.id,
                  name: c.name,
                  phone: c.phone || "",
                }))}
                selectedPerformerId={selectedCashierPerformerId}
                onSelectPerformerId={(id) => setSelectedCashierPerformerId(id)}
                pin={cashierPin}
                onPinChange={(p) => setCashierPin(p)}
                label="Authorizing Cashier"
                pinLabel="Cashier 4-Digit PIN:"
                fallbackRoleName="Cashier Desk"
                roleIcon={Banknote}
                pinInputName="cashier_desk_auth_pin_clear_due"
              />

              {/* Amount to Collect */}
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground text-xs flex items-center justify-between">
                  <span>Amount to Collect Now (৳ BDT)</span>
                  <span className="text-muted-foreground font-normal">Can be partial or full</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-bold text-muted-foreground">
                    ৳
                  </span>
                  <Input
                    type="number"
                    value={clearDueAmount}
                    onChange={(e) => setClearDueAmount(Number(e.target.value))}
                    className="pl-7 h-8.5 text-sm font-mono font-bold rounded-lg"
                  />
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground text-xs">
                  Payment Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setClearDuePaymentMethod("CASH")}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs font-semibold gap-1 transition-all cursor-pointer ${
                      clearDuePaymentMethod === "CASH"
                        ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300 shadow-xs"
                        : "border-border/80 bg-background text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    <Banknote className="size-4" />
                    <span>Cash</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setClearDuePaymentMethod("CARD")}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs font-semibold gap-1 transition-all cursor-pointer ${
                      clearDuePaymentMethod === "CARD"
                        ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300 shadow-xs"
                        : "border-border/80 bg-background text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    <CreditCard className="size-4" />
                    <span>POS Card</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setClearDuePaymentMethod("MFS")}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs font-semibold gap-1 transition-all cursor-pointer ${
                      clearDuePaymentMethod === "MFS"
                        ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300 shadow-xs"
                        : "border-border/80 bg-background text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    <Smartphone className="size-4" />
                    <span>bKash / Nagad</span>
                  </button>
                </div>
              </div>

              {/* Auto Queue Notice */}
              <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-200">
                <DoorOpen className="size-4 text-emerald-600 shrink-0" />
                <span>
                  Clearing or acknowledging this due will <strong>immediately place the patient into the Therapy Floor Queue</strong>.
                </span>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="font-semibold text-foreground text-xs">
                  Receipt / Transaction Remarks (Optional)
                </label>
                <Input
                  type="text"
                  placeholder="e.g. Cleared prior balance, TrxID..."
                  value={clearDueNotes}
                  onChange={(e) => setClearDueNotes(e.target.value)}
                  className="h-8 text-xs rounded-lg"
                />
              </div>
            </div>
          )}

          <DialogFooter className="shrink-0 p-3 sm:p-4 border-t border-border/60 bg-muted/20 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => handleConfirmClearDue(true)}
              disabled={isSubmittingClearDue}
              className="h-8 text-xs gap-1 cursor-pointer bg-rose-600 hover:bg-rose-700"
            >
              <AlertCircle className="size-3.5" />
              <span>Mark as DUE &amp; Queue for Therapy</span>
            </Button>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setClearingDueApt(null)}
                disabled={isSubmittingClearDue}
                className="h-8 text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => handleConfirmClearDue(false)}
                disabled={isSubmittingClearDue}
                className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white gap-1.5 cursor-pointer shadow-xs"
              >
                {isSubmittingClearDue ? (
                  <span>Processing &amp; Queuing...</span>
                ) : (
                  <>
                    <CheckCircle2 className="size-3.5" />
                    <span>Confirm Paid &amp; Queue for Therapy</span>
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Professional Thermal POS Receipt Dialog */}
      <ThermalReceiptDialog
        isOpen={Boolean(receiptAppointment)}
        onOpenChange={(open) => {
          if (!open) setReceiptAppointment(null);
        }}
        appointment={receiptAppointment}
        cashierName={data.currentCashier?.name || "Cashier Desk"}
      />

      {/* Daily Shift Closeout & Drawer Reconcile Modal */}
      <CashDrawerCloseoutDialog
        isOpen={isCloseoutOpen}
        onOpenChange={setIsCloseoutOpen}
        selectedDate={selectedDate}
        cashierName={data.currentCashier?.name || "Cashier Desk"}
        stats={data.billingStats}
      />

      {/* Register Patient Dialog */}
      <CreatePatientDialog
        isOpen={isNewPatientOpen}
        onOpenChange={setIsNewPatientOpen}
        performers={
          data.cashierPerformers.length > 0
            ? data.cashierPerformers
            : data.receptionistPerformers
        }
        defaultPerformerId={currentCashierId}
        onPatientCreated={handlePatientCreated}
      />

      {/* Book Ticket Dialog */}
      <BookTicketDialog
        isOpen={isBookTicketOpen}
        onOpenChange={setIsBookTicketOpen}
        slots={data.slots}
        selectedDate={selectedDate}
        preselectedSlotId={preselectedSlotId}
        preselectedPatient={preselectedPatient}
        performers={
          data.cashierPerformers.length > 0
            ? data.cashierPerformers
            : data.receptionistPerformers
        }
        activePerformerId={currentCashierId}
        onTicketBooked={handleTicketBooked}
        onOpenRegisterPatient={() => {
          setIsBookTicketOpen(false);
          setIsNewPatientOpen(true);
        }}
      />
    </div>
  );
}
