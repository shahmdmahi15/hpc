"use client";

import * as React from "react";
import {
  type CashierDashboardData,
  getCashierDashboardDataAction,
  collectPaymentAction,
} from "@/actions/cashier/cashier.action";
import {
  DEFAULT_FEE,
  QUICK_BILLING_PRESETS,
} from "@/lib/billing";
import {
  type AppointmentWithRelations,
  type PatientWithCount,
  updateAppointmentStatusAction,
} from "@/actions/receptionist/appointment.action";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  UserCheck,
  Phone,
  Clock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  RotateCw,
} from "lucide-react";
import { useRealtimeEvents } from "@/hooks/use-realtime-events";
import { toast } from "sonner";
import { formatTime12h } from "@/lib/queue-punctuality";

import { DashboardDateSelector, formatLocalDate } from "@/components/ui/dashboard-date-selector";

interface CashierDashboardViewProps {
  initialData: CashierDashboardData;
  currentUserRole?: Role;
}

export function CashierDashboardView({
  initialData,
  currentUserRole,
}: CashierDashboardViewProps) {
  const [data, setData] = React.useState<CashierDashboardData>(initialData);
  const [selectedDate, setSelectedDate] = React.useState<string>(
    initialData.selectedDate,
  );

  // Search filter
  const [searchQuery, setSearchQuery] = React.useState("");

  // Payment Collection Modal State
  const [collectingAppointment, setCollectingAppointment] =
    React.useState<AppointmentWithRelations | null>(null);
  const [paymentAmount, setPaymentAmount] = React.useState<number>(500);
  const [paymentMethod, setPaymentMethod] = React.useState<
    "CASH" | "CARD" | "MFS"
  >("CASH");
  const [paymentNotes, setPaymentNotes] = React.useState<string>("");
  const [isSubmittingPayment, setIsSubmittingPayment] = React.useState(false);

  // Receipt modal state after payment
  const [receiptAppointment, setReceiptAppointment] =
    React.useState<AppointmentWithRelations | null>(null);

  // Dialogs for booking & patients
  const [isNewPatientOpen, setIsNewPatientOpen] = React.useState(false);
  const [isBookTicketOpen, setIsBookTicketOpen] = React.useState(false);
  const [preselectedSlotId, setPreselectedSlotId] = React.useState<
    string | undefined
  >();
  const [preselectedPatient, setPreselectedPatient] =
    React.useState<PatientWithCount | null>(null);

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
      if (
        type === "APPOINTMENT_CREATED" ||
        type === "APPOINTMENT_UPDATED" ||
        type === "APPOINTMENT_CANCELLED" ||
        type === "SLOT_UPDATED"
      ) {
        refreshData(selectedDateRef.current);
        if (type === "APPOINTMENT_CREATED") {
          toast.info(
            `New Ticket Booked: ${event.data?.patientName || "Patient"} • ৳${event.data?.feeAmount ?? DEFAULT_FEE} Due on Bill`,
            { id: `ticket-${event.data?.id || Date.now()}` },
          );
        }
      }
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

  // Open payment dialog
  const handleOpenPaymentModal = (appointment: AppointmentWithRelations) => {
    setCollectingAppointment(appointment);
    const initialFee = appointment.feeAmount ?? DEFAULT_FEE;
    setPaymentAmount(initialFee);
    setPaymentMethod("CASH");
    setPaymentNotes("");
  };

  // Submit payment
  const handleConfirmPayment = async () => {
    if (!collectingAppointment) return;
    if (paymentAmount <= 0) {
      toast.error("Please enter a valid amount.");
      return;
    }

    setIsSubmittingPayment(true);
    try {
      const res = await collectPaymentAction({
        appointmentId: collectingAppointment.id,
        amount: paymentAmount,
        paymentMethod,
        performerId: currentCashierId || undefined,
        notes: paymentNotes.trim() || undefined,
      });

      if (res.success) {
        toast.success(res.message);
        setReceiptAppointment(collectingAppointment);
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

  // Filtered appointments
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

  const filteredPaid = React.useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return data.paidAppointments.filter((item) => {
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
  }, [data.paidAppointments, searchQuery]);

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
            {/* Cashier Payment Date Selector */}
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
                type="text"
                placeholder="Search bills by patient, phone, ticket..."
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
              <span>Unpaid: {data.billingStats.pendingCount}</span>
            </div>

            {/* Breakdown Chips */}
            <div className="hidden 2xl:flex items-center gap-1.5 pl-1.5 border-l border-border/60 text-[10.5px]">
              <span className="text-muted-foreground font-sans">Cash:</span>
              <span className="font-bold text-foreground">
                ৳{data.billingStats.cashCollected}
              </span>
              <span className="text-muted-foreground/40">•</span>
              <span className="text-muted-foreground font-sans">Card:</span>
              <span className="font-bold text-foreground">
                ৳{data.billingStats.cardCollected}
              </span>
              <span className="text-muted-foreground/40">•</span>
              <span className="text-muted-foreground font-sans">MFS:</span>
              <span className="font-bold text-foreground">
                ৳{data.billingStats.mfsCollected}
              </span>
            </div>
          </div>
        </div>

        {/* Unified Tabs Layout */}
        <Tabs defaultValue="pending" className="w-full space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-1.5">
            <TabsList className="h-8.5 rounded-lg bg-muted/50 p-0.5 border border-border/60">
              <TabsTrigger
                value="pending"
                className="text-xs h-7 px-3 gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs font-semibold"
              >
                <CreditCard className="size-3 text-amber-500" />
                <span>Pending Bills</span>
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300">
                  {filteredPending.length}
                </span>
              </TabsTrigger>

              <TabsTrigger
                value="paid"
                className="text-xs h-7 px-3 gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs font-semibold"
              >
                <Receipt className="size-3 text-emerald-500" />
                <span>Paid Invoices</span>
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                  {filteredPaid.length}
                </span>
              </TabsTrigger>

              <TabsTrigger
                value="schedule"
                className="text-xs h-7 px-3 gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs font-semibold"
              >
                <CalendarDays className="size-3 text-blue-500" />
                <span>Book Slots</span>
              </TabsTrigger>

              <TabsTrigger
                value="patients"
                className="text-xs h-7 px-3 gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs font-semibold"
              >
                <User className="size-3 text-purple-500" />
                <span>Patients</span>
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-muted text-muted-foreground">
                  {data.patients.length}
                </span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* TAB 1: PENDING BILLS */}
          <TabsContent value="pending" className="mt-0 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1 pb-1 border-b border-border/40">
              <span className="flex items-center gap-1.5">
                <Clock className="size-3.5 text-amber-500" />
                <span>
                  Pending Bills for{" "}
                  <strong className="text-foreground font-semibold">
                    {isToday ? "Today" : selectedDate} ({data.dayOfWeek})
                  </strong>
                  : {filteredPending.length} ticket{filteredPending.length === 1 ? "" : "s"}
                </span>
              </span>
              <span className="font-mono text-amber-700 dark:text-amber-300 font-bold text-xs bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                Total Due: ৳{data.billingStats.pendingCollection.toLocaleString()}
              </span>
            </div>
            {filteredPending.length === 0 ? (
              <div className="p-8 text-center rounded-xl border border-dashed border-border bg-card/40">
                <CheckCircle2 className="size-8 text-emerald-500/60 mx-auto mb-2" />
                <h3 className="text-sm font-semibold text-foreground">
                  All Patient Bills Cleared
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  No outstanding uncollected tickets found for this date.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                {filteredPending.map((item) => {
                  const estimatedFee = item.feeAmount ?? DEFAULT_FEE;

                  return (
                    <div
                      key={item.id}
                      className="group flex flex-col justify-between p-2.5 rounded-xl border border-border/70 bg-card hover:border-amber-500/40 hover:shadow-xs transition-all"
                    >
                      <div className="space-y-1.5">
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
                              <Phone className="size-2.5 text-muted-foreground" />
                              {item.patient?.phone || "---"}
                            </span>
                            {item.patient?.mrn && (
                              <span className="text-[10px] font-mono">
                                MRN: {item.patient.mrn}
                              </span>
                            )}
                          </div>
                        </div>

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

                      <div className="pt-2 mt-2 border-t border-border/50">
                        <Button
                          size="sm"
                          onClick={() => handleOpenPaymentModal(item)}
                          className="w-full h-7.5 text-xs font-semibold gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-xs cursor-pointer"
                        >
                          <CreditCard className="size-3.5" />
                          <span>Collect ৳{estimatedFee} Bill</span>
                        </Button>
                      </div>
                    </div>
                  );
                })}
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
                  : {filteredPaid.length} payment{filteredPaid.length === 1 ? "" : "s"}
                </span>
              </span>
              <span className="font-mono text-emerald-700 dark:text-emerald-300 font-bold text-xs bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                Total Settled: ৳{data.billingStats.totalCollected.toLocaleString()}
              </span>
            </div>
            {filteredPaid.length === 0 ? (
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
                        <th className="py-2 px-3">Ticket</th>
                        <th className="py-2 px-3">Patient Details</th>
                        <th className="py-2 px-3">Service Type</th>
                        <th className="py-2 px-3">Amount</th>
                        <th className="py-2 px-3">Method</th>
                        <th className="py-2 px-3">Settled Time</th>
                        <th className="py-2 px-3 text-right">Receipt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {filteredPaid.map((item) => (
                        <tr
                          key={item.id}
                          className="hover:bg-muted/20 transition-colors"
                        >
                          <td className="py-2 px-3">
                            <span className="font-mono font-bold text-foreground">
                              #{item.id.slice(-4).toUpperCase()}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <div className="font-semibold text-foreground">
                              {item.patient?.name || "Patient"}
                            </div>
                            <div className="text-[10.5px] text-muted-foreground">
                              {item.patient?.phone || "---"}
                            </div>
                          </td>
                          <td className="py-2 px-3">
                            <Badge
                              variant="outline"
                              className="text-[10px] font-semibold py-0"
                            >
                              {item.type}
                            </Badge>
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            ৳{item.feeAmount ?? 0}
                          </td>
                          <td className="py-2 px-3">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md bg-muted text-[10px] font-bold uppercase">
                              {item.paymentMethod || "CASH"}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-muted-foreground text-[11px] font-mono">
                            {item.paidAt
                              ? new Date(item.paidAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "---"}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setReceiptAppointment(item)}
                              className="h-6.5 px-2 text-[11px] gap-1 rounded-md cursor-pointer"
                            >
                              <Printer className="size-3 text-muted-foreground" />
                              <span>Receipt</span>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </TabsContent>

          {/* TAB 3: BOOK SLOTS */}
          <TabsContent value="schedule" className="mt-0 space-y-2 outline-none">
            <SlotScheduleBoard
              slots={data.slots}
              stats={data.stats}
              selectedDate={selectedDate}
              dayOfWeek={data.dayOfWeek}
              onSelectDate={handleSelectDate}
              onBookSlot={handleBookSlot}
              onCheckIn={handleCheckIn}
              onCancelAppointment={handleCancelAppointment}
            />
          </TabsContent>

          {/* TAB 4: PATIENTS */}
          <TabsContent value="patients" className="mt-0 space-y-2 outline-none">
            <PatientDirectoryView
              initialPatients={data.patients}
              totalCount={data.totalPatientsCount}
              onOpenNewPatient={() => setIsNewPatientOpen(true)}
              onBookTicketForPatient={(patient) => {
                setPreselectedPatient(patient);
                setPreselectedSlotId(undefined);
                setIsBookTicketOpen(true);
              }}
            />
          </TabsContent>
        </Tabs>
      </main>

      {/* Payment Collection Dialog */}
      <Dialog
        open={Boolean(collectingAppointment)}
        onOpenChange={(open) => {
          if (!open) setCollectingAppointment(null);
        }}
      >
        <DialogContent className="w-[95vw] sm:max-w-lg md:max-w-xl p-5 space-y-4 rounded-2xl shadow-2xl border-border/80">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <CreditCard className="size-4 text-amber-500" />
              <span>Collect Patient Fee</span>
            </DialogTitle>
          </DialogHeader>

          {collectingAppointment && (
            <div className="space-y-3.5 text-xs">
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
                  <span>Type: {collectingAppointment.type}</span>
                </div>
              </div>

              {/* Cashier Performer Selection */}
              {initialData.cashierPerformers.length === 1 ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                      <UserCheck className="size-3.5 text-amber-500" />
                      <span>Authorizing Cashier</span>
                    </label>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                      Auto-Selected
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="size-7 rounded-lg bg-amber-500/20 text-amber-800 dark:text-amber-200 font-bold flex items-center justify-center text-xs">
                        {initialData.cashierPerformers[0].name
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-foreground text-xs">
                          {initialData.cashierPerformers[0].name}
                        </p>
                        <p className="text-[10px] font-mono text-muted-foreground">
                          {initialData.cashierPerformers[0].phone}
                        </p>
                      </div>
                    </div>
                    <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                  </div>
                </div>
              ) : initialData.cashierPerformers.length > 1 ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                      <UserCheck className="size-3.5 text-amber-500" />
                      <span>Authorizing Cashier</span>
                    </label>
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                      Select Performer
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 max-h-28 overflow-y-auto pr-1">
                    {initialData.cashierPerformers.map((cashier) => {
                      const isSelected =
                        selectedCashierPerformerId === cashier.id;
                      return (
                        <button
                          key={cashier.id}
                          type="button"
                          onClick={() =>
                            setSelectedCashierPerformerId(cashier.id)
                          }
                          className={`p-2 rounded-xl border text-left flex items-center justify-between cursor-pointer transition-all ${
                            isSelected
                              ? "border-amber-500 bg-amber-500/10 text-amber-900 dark:text-amber-200 shadow-xs ring-1 ring-amber-500/40"
                              : "border-border/80 bg-background text-muted-foreground hover:bg-muted/50"
                          }`}
                        >
                          <div className="truncate">
                            <p className="font-bold text-xs text-foreground truncate">
                              {cashier.name}
                            </p>
                            <p className="text-[10px] font-mono text-muted-foreground">
                              {cashier.phone}
                            </p>
                          </div>
                          {isSelected && (
                            <CheckCircle2 className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0 ml-1" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

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

              {/* Reference / Notes */}
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

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCollectingAppointment(null)}
              disabled={isSubmittingPayment}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmPayment}
              disabled={isSubmittingPayment}
              className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
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
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog
        open={Boolean(receiptAppointment)}
        onOpenChange={(open) => {
          if (!open) setReceiptAppointment(null);
        }}
      >
        <DialogContent className="w-[95vw] sm:max-w-md md:max-w-lg p-5 space-y-4 rounded-2xl shadow-2xl border-border/80">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Receipt className="size-4 text-emerald-500" />
                <span>Payment Receipt</span>
              </span>
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px]">
                PAID
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {receiptAppointment && (
            <div className="p-3 rounded-lg border border-border/80 bg-muted/20 space-y-2 text-xs font-mono">
              <div className="text-center pb-2 border-b border-border/60">
                <div className="font-bold text-sm text-foreground font-sans">
                  Health &amp; Pain Care Center
                </div>
                <div className="text-[10px] text-muted-foreground font-sans">
                  Official Patient Billing Receipt
                </div>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Ticket:</span>
                <span className="font-bold text-foreground">
                  #{receiptAppointment.id.slice(-4).toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Patient:</span>
                <span className="font-bold text-foreground font-sans">
                  {receiptAppointment.patient?.name || "Patient"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phone:</span>
                <span>{receiptAppointment.patient?.phone || "---"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Service:</span>
                <span>{receiptAppointment.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment Method:</span>
                <span>{receiptAppointment.paymentMethod || "CASH"}</span>
              </div>
              <div className="flex justify-between pt-1.5 border-t border-border/60 text-sm font-bold">
                <span>Amount Paid:</span>
                <span className="text-emerald-600 dark:text-emerald-400">
                  ৳{receiptAppointment.feeAmount ?? paymentAmount}
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (typeof window !== "undefined") window.print();
              }}
              className="h-8 text-xs gap-1.5"
            >
              <Printer className="size-3.5" />
              <span>Print</span>
            </Button>
            <Button
              size="sm"
              onClick={() => setReceiptAppointment(null)}
              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
