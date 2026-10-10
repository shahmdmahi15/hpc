"use client";

import * as React from "react";
import type {
  ReceptionistDashboardData,
  PatientWithCount,
  AppointmentWithRelations,
} from "@/actions/receptionist/appointment.action";
import {
  getReceptionistDashboardDataAction,
  updateAppointmentStatusAction,
  checkOutPatientAction,
  switchQueueAction,
} from "@/actions/receptionist/appointment.action";
import {
  AppointmentStatus,
  QueueType,
  AppointmentType,
  Role,
} from "@/generated/prisma/enums";
import { ReceptionistHeader } from "@/components/receptionist/receptionist-header";
import { SlotScheduleBoard } from "@/components/receptionist/slot-schedule-board";
import { PatientDirectoryView } from "@/components/receptionist/patient-directory-view";
import { CreatePatientDialog } from "@/components/receptionist/create-patient-dialog";
import { BookTicketDialog } from "@/components/receptionist/book-ticket-dialog";
import {
  AuthorizeReceptionistActionDialog,
  type AuthorizeReceptionistActionConfig,
} from "@/components/receptionist/authorize-receptionist-action-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Clock, Users, UserPlus, Ticket, Activity, Search, Compass, UserCheck, Stethoscope, MessageSquare } from "lucide-react";
import { useRealtimeEvents } from "@/hooks/use-realtime-events";
import { toast } from "sonner";
import { DashboardDateSelector } from "@/components/ui/dashboard-date-selector";
import { PatientJourneyTrackerView } from "@/components/tracking/patient-journey-tracker-view";
import { PatientArrivalTab } from "@/components/receptionist/patient-arrival-tab";
import { ConsultationSerialTab } from "@/components/receptionist/consultation-serial-tab";
import { ClinicChatView } from "@/components/chat/clinic-chat-view";
import { useChatNotifications } from "@/hooks/use-chat-notifications";

interface ReceptionistDashboardViewProps {
  initialData: ReceptionistDashboardData;
  currentUserRole?: Role;
  currentUserId?: string;
}

export function ReceptionistDashboardView({
  initialData,
  currentUserRole,
  currentUserId,
}: ReceptionistDashboardViewProps) {
  const [data, setData] =
    React.useState<ReceptionistDashboardData>(initialData);
  const [selectedDate, setSelectedDate] = React.useState<string>(
    initialData.selectedDate,
  );
  const [activeTab, setActiveTab] = React.useState<string>("arrival");

  // Real-time Chat Notifications & Chime at the Dashboard Root Level
  const { unreadCount: unreadChatCount } = useChatNotifications({
    isChatTabActive: activeTab === "chat",
    currentUserId,
    onOpenChatTab: () => setActiveTab("chat"),
  });

  // Remember the last chosen receptionist performer during this desk session
  const [lastPerformerId, setLastPerformerId] = React.useState<string>(() =>
    initialData.receptionistPerformers.length === 1
      ? initialData.receptionistPerformers[0].id
      : "",
  );

  // Modals state
  const [isNewPatientOpen, setIsNewPatientOpen] = React.useState(false);
  const [isBookTicketOpen, setIsBookTicketOpen] = React.useState(false);
  const [preselectedSlotId, setPreselectedSlotId] = React.useState<
    string | undefined
  >();
  const [preselectedPatient, setPreselectedPatient] =
    React.useState<PatientWithCount | null>(null);

  // Performer action authorization modal
  const [pendingAction, setPendingAction] =
    React.useState<AuthorizeReceptionistActionConfig | null>(null);

  // Active queue count (checked in / serving / calling)
  const activeQueueCount = React.useMemo(() => {
    return (data.appointments || []).filter(
      (a) =>
        a.status === AppointmentStatus.CHECKED_IN ||
        a.status === AppointmentStatus.CALLING ||
        a.status === AppointmentStatus.IN_THERAPY ||
        a.status === AppointmentStatus.IN_CONSULTATION,
    ).length;
  }, [data.appointments]);

  // Search filter
  const [searchQuery, setSearchQuery] = React.useState("");

  // Transitions & Refresh
  const [isPending, startTransition] = React.useTransition();

  const selectedDateRef = React.useRef(selectedDate);
  React.useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  const refreshData = React.useCallback((targetDate?: string) => {
    startTransition(async () => {
      try {
        const dateToFetch = targetDate || selectedDateRef.current;
        const fresh = await getReceptionistDashboardDataAction(dateToFetch);
        setData(fresh);
      } catch (error) {
        console.error("[Refresh Dashboard Error]:", error);
      }
    });
  }, []);

  // 100% Offline Real-time SSE Subscription
  const { connectionStatus } = useRealtimeEvents({
    onEvent: (event) => {
      const type = (event?.type || "").toUpperCase();
      if (type !== "CHAT_MESSAGE_SENT" && type !== "CHAT_MESSAGE_DELETED") {
        refreshData(selectedDateRef.current);
      }
    },
    onReconnect: () => {
      refreshData(selectedDateRef.current);
    },
  });

  // Handle Date Selection Change
  const handleSelectDate = (newDate: string) => {
    setSelectedDate(newDate);
    refreshData(newDate);
  };

  // Handle Quick Book Slot Click
  const handleBookSlot = (slotId: string) => {
    setPreselectedSlotId(slotId);
    setPreselectedPatient(null);
    setIsBookTicketOpen(true);
  };

  // Handle New Patient Created -> Jump to ticket booking if requested
  const handlePatientCreated = (
    patient: PatientWithCount,
    proceedToBooking: boolean,
    performerId?: string,
  ) => {
    if (performerId) {
      setLastPerformerId(performerId);
    }
    refreshData(selectedDate);
    if (proceedToBooking) {
      setPreselectedPatient(patient);
      setIsBookTicketOpen(true);
    }
  };

  // Handle Ticket Booked -> Refresh data directly (no token printing needed)
  const handleTicketBooked = () => {
    refreshData(selectedDate);
  };

  // Find appointment helper
  const findAppointment = (
    appointmentId: string,
  ): AppointmentWithRelations | undefined => {
    return (
      data.appointments?.find((a) => a.id === appointmentId) ||
      data.slots
        ?.flatMap((s) => s.appointments || [])
        .find((a) => a.id === appointmentId)
    );
  };

  // Patient Check In: always prompt queue assignment (Therapy vs Consultation) & performer
  const handleCheckIn = async (appointmentId: string) => {
    const apt = findAppointment(appointmentId);
    const defaultQueueType =
      apt?.type === AppointmentType.CONSULTATION
        ? QueueType.CONSULTATION
        : QueueType.THERAPY;

    setPendingAction({
      actionType: "CHECK_IN",
      appointmentId,
      patientName: apt?.patient?.name,
      slotLabel: apt?.therapySlot?.label,
      defaultQueueType,
    });
  };

  // Patient Check Out: mark visit completed for the day
  const handleCheckOut = async (appointmentId: string) => {
    const apt = findAppointment(appointmentId);
    if (data.receptionistPerformers.length > 0) {
      setPendingAction({
        actionType: "CHECK_OUT",
        appointmentId,
        patientName: apt?.patient?.name,
        slotLabel: apt?.therapySlot?.label,
      });
      return;
    }

    const performerId =
      lastPerformerId || (data.receptionistPerformers[0]?.id ?? "");
    const res = await checkOutPatientAction(appointmentId, performerId);
    if (res.success) {
      toast.success(res.message);
      refreshData(selectedDate);
    } else {
      toast.error(res.message);
    }
  };

  // Quick Cancel
  const handleCancelAppointment = async (appointmentId: string) => {
    if (data.receptionistPerformers.length > 0) {
      const apt = findAppointment(appointmentId);
      setPendingAction({
        actionType: "CANCEL",
        appointmentId,
        patientName: apt?.patient?.name,
        slotLabel: apt?.therapySlot?.label,
      });
      return;
    }

    const performerId =
      lastPerformerId || (data.receptionistPerformers[0]?.id ?? "");
    const res = await updateAppointmentStatusAction(
      appointmentId,
      AppointmentStatus.CANCELLED,
      performerId,
    );
    if (res.success) {
      toast.success(res.message);
      refreshData(selectedDate);
    } else {
      toast.error(res.message);
    }
  };

  // Handle Confirmation from AuthorizeReceptionistActionDialog
  const handleConfirmPendingAction = async (
    actionConfig: AuthorizeReceptionistActionConfig,
    performerId: string,
    queueType?: QueueType,
    roomId?: string,
    pin?: string,
  ): Promise<boolean> => {
    setLastPerformerId(performerId);

    let res: { success: boolean; message: string };

    switch (actionConfig.actionType) {
      case "CHECK_IN": {
        res = await updateAppointmentStatusAction(
          actionConfig.appointmentId,
          AppointmentStatus.CHECKED_IN,
          performerId,
          queueType,
          undefined,
          pin,
        );
        break;
      }
      case "CHECK_OUT": {
        res = await checkOutPatientAction(
          actionConfig.appointmentId,
          performerId,
          pin,
        );
        break;
      }
      case "CANCEL":
      case "REMOVE_FROM_QUEUE": {
        res = await updateAppointmentStatusAction(
          actionConfig.appointmentId,
          AppointmentStatus.CANCELLED,
          performerId,
          undefined,
          undefined,
          pin,
        );
        break;
      }
      case "START_SERVICE": {
        const isConsult =
          actionConfig.defaultQueueType === QueueType.CONSULTATION;
        const targetStatus = isConsult
          ? AppointmentStatus.IN_CONSULTATION
          : AppointmentStatus.IN_THERAPY;
        res = await updateAppointmentStatusAction(
          actionConfig.appointmentId,
          targetStatus,
          performerId,
          undefined,
          roomId,
          pin,
        );
        break;
      }
      case "COMPLETE": {
        res = await updateAppointmentStatusAction(
          actionConfig.appointmentId,
          AppointmentStatus.COMPLETED,
          performerId,
          undefined,
          undefined,
          pin,
        );
        break;
      }
      case "SWITCH_QUEUE": {
        const targetQueue =
          actionConfig.targetQueueType || QueueType.CONSULTATION;
        res = await switchQueueAction(
          actionConfig.appointmentId,
          targetQueue,
          performerId,
          pin,
        );
        break;
      }
      default:
        return false;
    }

    if (res.success) {
      toast.success(res.message);
      refreshData(selectedDate);
      return true;
    } else {
      toast.error(res.message);
      return false;
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col bg-gradient-to-br from-background via-muted/10 to-background text-foreground selection:bg-primary/20">
      {/* 1. Header (Clean top bar with brand, live clock, SSE indicator, TV display link, theme/fullscreen toggles, logout) */}
      <ReceptionistHeader
        connectionStatus={connectionStatus}
        currentUserRole={currentUserRole}
      />

      {/* 2. Main Desk Workspace */}
      <main className="flex-1 w-full max-w-[1700px] mx-auto px-3 sm:px-5 py-2.5 space-y-2.5">
        {/* Top Control Bar: Date Selector, Search & Live Desk Badges */}
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
                name="receptionist_queue_search_query"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
                data-1p-ignore="true"
                data-form-type="other"
                placeholder="Search queue by patient, phone, ticket..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs rounded-lg bg-background border-border/80 focus-visible:ring-primary"
              />
            </div>
          </div>

          {/* Right: Desk Badges */}
          <div className="grid grid-cols-3 gap-1.5 w-full sm:flex sm:w-auto sm:items-center sm:gap-2 text-xs font-mono text-muted-foreground">
            <div className="flex items-center justify-center sm:justify-start gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold text-[10.5px] sm:text-[11px] truncate">
              <Activity className="size-3 sm:size-3.5 shrink-0" />
              <span className="truncate">Queue: {activeQueueCount}</span>
            </div>

            <div className="flex items-center justify-center sm:justify-start gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-700 dark:text-sky-300 font-bold text-[10.5px] sm:text-[11px] truncate">
              <Clock className="size-3 sm:size-3.5 shrink-0" />
              <span className="truncate">Slots: {data.slots.length}</span>
            </div>

            <div className="flex items-center justify-center sm:justify-start gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg bg-muted/60 border border-border text-muted-foreground font-bold text-[10.5px] sm:text-[11px] truncate">
              <Users className="size-3 sm:size-3.5 text-indigo-500 shrink-0" />
              <span className="truncate">Patients: {data.totalPatientsCount}</span>
            </div>
          </div>
        </div>

        {/* Tabs for Receptionist Desk Navigation (Single-line layout across all devices) */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-2.5">
          <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2 w-full min-w-0">
            {/* Scrollable Tabs List with shortened names */}
            <div className="flex items-center overflow-x-auto scrollbar-none min-w-0 flex-1">
              <TabsList className="bg-muted/50 p-1 rounded-xl h-auto min-h-9 border border-border/60 inline-flex items-center gap-1 shrink-0">
                {/* TAB 1: ARRIVALS */}
                <TabsTrigger
                  value="arrival"
                  className="h-7.5 px-2.5 sm:px-3 text-xs font-bold gap-1.5 rounded-md data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-xs cursor-pointer shrink-0 whitespace-nowrap"
                >
                  <UserCheck className="size-3.5 text-sky-600 dark:text-sky-400" />
                  <span>Arrivals</span>
                  <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-sky-500/15 text-sky-700 dark:text-sky-300 font-mono font-bold">
                    Desk
                  </span>
                </TabsTrigger>

                {/* TAB 2: CONSULTATION */}
                <TabsTrigger
                  value="consultations"
                  className="h-7.5 px-2.5 sm:px-3 text-xs font-bold gap-1.5 rounded-md data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-xs cursor-pointer shrink-0 whitespace-nowrap"
                >
                  <Stethoscope className="size-3.5 text-teal-600 dark:text-teal-400" />
                  <span>Consultation</span>
                  <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-teal-500/15 text-teal-700 dark:text-teal-300 font-mono font-bold">
                    {(data.consultationSerials || []).length}
                  </span>
                </TabsTrigger>

                {/* TAB 3: THERAPY */}
                <TabsTrigger
                  value="slots"
                  className="h-7.5 px-2.5 sm:px-3 text-xs font-bold gap-1.5 rounded-md data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-xs cursor-pointer shrink-0 whitespace-nowrap"
                >
                  <Clock className="size-3.5" />
                  <span>Therapy</span>
                  <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-primary/10 text-primary font-mono font-bold">
                    {data.slots.length}
                  </span>
                </TabsTrigger>

                {/* TAB 4: JOURNEY */}
                <TabsTrigger
                  value="tracking"
                  className="h-7.5 px-2.5 sm:px-3 text-xs font-bold gap-1.5 rounded-md data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-xs cursor-pointer shrink-0 whitespace-nowrap"
                >
                  <Compass className="size-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Journey</span>
                </TabsTrigger>

                {/* TAB 5: PATIENTS */}
                <TabsTrigger
                  value="patients"
                  className="h-7.5 px-2.5 sm:px-3 text-xs font-bold gap-1.5 rounded-md data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-xs cursor-pointer shrink-0 whitespace-nowrap"
                >
                  <Users className="size-3.5" />
                  <span>Patients</span>
                  <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-muted text-muted-foreground border border-border font-mono font-bold">
                    {data.totalPatientsCount}
                  </span>
                </TabsTrigger>

                {/* TAB 6: CHAT */}
                <TabsTrigger
                  value="chat"
                  className="h-7.5 px-2.5 sm:px-3 text-xs font-bold gap-1.5 rounded-md data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-xs cursor-pointer shrink-0 whitespace-nowrap"
                >
                  <MessageSquare className="size-3.5 text-primary" />
                  <span>Chat</span>
                  {unreadChatCount > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-bold font-mono animate-pulse shadow-xs">
                      {unreadChatCount}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Contextual Actions Bar (Single Line with tabs) */}
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsNewPatientOpen(true)}
                className="h-7.5 px-2 sm:px-2.5 text-xs font-semibold gap-1 border-primary/40 hover:bg-primary/10 text-primary cursor-pointer shadow-xs justify-center shrink-0"
              >
                <UserPlus className="size-3 shrink-0" />
                <span className="hidden sm:inline">Register Patient</span>
                <span className="sm:hidden">Patient</span>
              </Button>

              <Button
                size="sm"
                onClick={() => {
                  setPreselectedPatient(null);
                  setPreselectedSlotId(undefined);
                  setIsBookTicketOpen(true);
                }}
                className="h-7.5 px-2 sm:px-2.5 text-xs font-semibold gap-1 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-xs justify-center shrink-0"
              >
                <Ticket className="size-3 shrink-0" />
                <span className="hidden sm:inline">Book Ticket</span>
                <span className="sm:hidden">Ticket</span>
              </Button>
            </div>
          </div>

          {/* TAB 1: PATIENT ARRIVAL & IMMEDIATE CHECK-IN DESK (DEFAULT / FIRST TAB) */}
          <TabsContent
            value="arrival"
            className="outline-none focus:outline-none space-y-4 m-0"
          >
            <PatientArrivalTab
              performers={data.receptionistPerformers}
              doctors={data.doctors || []}
              lastPerformerId={lastPerformerId}
              onSelectPerformerId={setLastPerformerId}
              selectedDate={selectedDate}
              onRefresh={() => refreshData(selectedDate)}
            />
          </TabsContent>

          {/* TAB 2: CONSULTATION SERIALS MANAGEMENT (BETWEEN ARRIVAL AND THERAPY SLOTS) */}
          <TabsContent
            value="consultations"
            className="outline-none focus:outline-none space-y-4 m-0"
          >
            <ConsultationSerialTab
              serials={data.consultationSerials || []}
              doctors={data.doctors || []}
              performers={data.receptionistPerformers || []}
              selectedDate={selectedDate}
              dayOfWeek={data.dayOfWeek}
              showDateSelector={false}
              lastPerformerId={lastPerformerId}
              onSelectPerformerId={setLastPerformerId}
              onSelectDate={handleSelectDate}
              onRefresh={() => refreshData(selectedDate)}
            />
          </TabsContent>

          {/* TAB 3: SLOTS & SCHEDULE BOARD */}
          <TabsContent
            value="slots"
            className="outline-none focus:outline-none space-y-6 m-0"
          >
            <SlotScheduleBoard
              slots={data.slots}
              stats={data.stats}
              selectedDate={selectedDate}
              dayOfWeek={data.dayOfWeek}
              showDateSelector={false}
              onSelectDate={handleSelectDate}
              onBookSlot={handleBookSlot}
              onCheckIn={handleCheckIn}
              onCheckOut={handleCheckOut}
              onCancelAppointment={handleCancelAppointment}
            />
          </TabsContent>

          {/* TAB 1B: PATIENT JOURNEY TRACKING (SLOT-FREE & FULL CLINIC TRACKING) */}
          <TabsContent
            value="tracking"
            className="outline-none focus:outline-none space-y-4 m-0"
          >
            <PatientJourneyTrackerView
              defaultDate={selectedDate}
              showDateSelector={false}
            />
          </TabsContent>

          {/* TAB 5: PATIENTS DIRECTORY */}
          <TabsContent
            value="patients"
            className="outline-none focus:outline-none space-y-6 m-0"
          >
            <PatientDirectoryView
              initialPatients={data.patients}
              totalCount={data.totalPatientsCount}
              onOpenNewPatient={() => setIsNewPatientOpen(true)}
              onBookTicketForPatient={(patient) => {
                setPreselectedPatient(patient);
                setPreselectedSlotId(undefined);
                setIsBookTicketOpen(true);
              }}
              performers={data.receptionistPerformers}
              defaultPerformerId={lastPerformerId}
              onPatientUpdated={(updated) => {
                setData((prev) => ({
                  ...prev,
                  patients: prev.patients.map((p) =>
                    p.id === updated.id ? { ...p, ...updated } : p,
                  ),
                }));
              }}
            />
          </TabsContent>

          {/* TAB 6: CLINIC REAL-TIME INTERNAL CHAT */}
          <TabsContent
            value="chat"
            className="outline-none focus:outline-none space-y-4 m-0"
          >
            <ClinicChatView
              currentUserRole={currentUserRole || Role.RECEPTIONIST}
              currentUserId={currentUserId}
              initialDate={selectedDate}
              showDateSelector={false}
              activePerformerId={lastPerformerId}
              performers={data.receptionistPerformers}
              rooms={data.rooms}
              onDateChange={handleSelectDate}
            />
          </TabsContent>
        </Tabs>
      </main>

      {/* 3. Action Dialogs with Performer Attribution */}
      <CreatePatientDialog
        isOpen={isNewPatientOpen}
        onOpenChange={setIsNewPatientOpen}
        performers={data.receptionistPerformers}
        defaultPerformerId={lastPerformerId}
        onPatientCreated={handlePatientCreated}
      />

      <BookTicketDialog
        isOpen={isBookTicketOpen}
        onOpenChange={setIsBookTicketOpen}
        slots={data.slots}
        selectedDate={selectedDate}
        preselectedSlotId={preselectedSlotId}
        preselectedPatient={preselectedPatient}
        performers={data.receptionistPerformers}
        activePerformerId={lastPerformerId}
        onTicketBooked={handleTicketBooked}
        onOpenRegisterPatient={() => setIsNewPatientOpen(true)}
      />

      <AuthorizeReceptionistActionDialog
        config={pendingAction}
        isOpen={Boolean(pendingAction)}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null);
        }}
        performers={data.receptionistPerformers}
        rooms={data.rooms || []}
        defaultPerformerId={lastPerformerId}
        onConfirm={handleConfirmPendingAction}
      />
    </div>
  );
}
