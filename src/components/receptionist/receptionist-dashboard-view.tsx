"use client";

import * as React from "react";
import {
  type ReceptionistDashboardData,
  type PatientWithCount,
  type AppointmentWithRelations,
  getReceptionistDashboardDataAction,
  updateAppointmentStatusAction,
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
import { QueueManagementTab } from "@/components/receptionist/queue-management-tab";
import { AddToQueueDialog } from "@/components/receptionist/add-to-queue-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Clock, Users, UserPlus, Ticket, Activity, Plus } from "lucide-react";
import { useRealtimeEvents } from "@/hooks/use-realtime-events";
import { toast } from "sonner";
import { DashboardDateSelector } from "@/components/ui/dashboard-date-selector";

interface ReceptionistDashboardViewProps {
  initialData: ReceptionistDashboardData;
  currentUserRole?: Role;
}

export function ReceptionistDashboardView({
  initialData,
  currentUserRole,
}: ReceptionistDashboardViewProps) {
  const [data, setData] =
    React.useState<ReceptionistDashboardData>(initialData);
  const [selectedDate, setSelectedDate] = React.useState<string>(
    initialData.selectedDate,
  );

  // Remember the last chosen receptionist performer during this desk session
  const [lastPerformerId, setLastPerformerId] = React.useState<string>(() =>
    initialData.receptionistPerformers.length === 1
      ? initialData.receptionistPerformers[0].id
      : "",
  );

  // Modals state
  const [isNewPatientOpen, setIsNewPatientOpen] = React.useState(false);
  const [isBookTicketOpen, setIsBookTicketOpen] = React.useState(false);
  const [isAddToQueueOpen, setIsAddToQueueOpen] = React.useState(false);
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
      // If appointment, patient, or slot changed, refresh schedule and patients
      if (
        type === "APPOINTMENT_CREATED" ||
        type === "APPOINTMENT_UPDATED" ||
        type === "APPOINTMENT_CANCELLED" ||
        type === "PATIENT_CREATED" ||
        type === "SLOT_UPDATED"
      ) {
        refreshData(selectedDateRef.current);
      }
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

  // Quick Cancel
  const handleCancelAppointment = async (appointmentId: string) => {
    if (data.receptionistPerformers.length > 1) {
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
        );
        break;
      }
      case "CANCEL":
      case "REMOVE_FROM_QUEUE": {
        res = await updateAppointmentStatusAction(
          actionConfig.appointmentId,
          AppointmentStatus.CANCELLED,
          performerId,
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
        );
        break;
      }
      case "COMPLETE": {
        res = await updateAppointmentStatusAction(
          actionConfig.appointmentId,
          AppointmentStatus.COMPLETED,
          performerId,
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

      {/* 2. Main Desk Workspace with Shadcn Tabs */}
      <main className="flex-1 p-2.5 sm:p-4 max-w-[1600px] w-full mx-auto space-y-3">
        <Tabs defaultValue="slots" className="w-full space-y-3">
          {/* Tabs Navigation & Quick Actions Bar */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2.5 pb-1.5 border-b border-border/50">
            <div className="flex flex-wrap items-center gap-2">
              <DashboardDateSelector
                selectedDate={selectedDate}
                dayOfWeek={data.dayOfWeek}
                onSelectDate={handleSelectDate}
                onRefresh={() => refreshData(selectedDate)}
                isRefreshing={isPending}
              />

              <TabsList className="h-8.5 p-0.5 bg-muted/60 border border-border/70 rounded-lg">
              <TabsTrigger
                value="slots"
                className="h-7.5 px-3 text-xs font-bold gap-1.5 rounded-md data-active:bg-background data-active:text-primary data-active:shadow-xs data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-xs cursor-pointer"
              >
                <Clock className="size-3.5" />
                <span>Therapy Slots</span>
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-primary/10 text-primary font-mono font-bold">
                  {data.slots.length}
                </span>
              </TabsTrigger>

              <TabsTrigger
                value="queue"
                className="h-7.5 px-3 text-xs font-bold gap-1.5 rounded-md data-active:bg-background data-active:text-primary data-active:shadow-xs data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-xs cursor-pointer"
              >
                <Activity className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Live Queue</span>
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-mono font-bold">
                  {activeQueueCount}
                </span>
              </TabsTrigger>

              <TabsTrigger
                value="patients"
                className="h-7.5 px-3 text-xs font-bold gap-1.5 rounded-md data-active:bg-background data-active:text-primary data-active:shadow-xs data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-xs cursor-pointer"
              >
                <Users className="size-3.5" />
                <span>Directory</span>
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-muted text-muted-foreground border border-border font-mono font-bold">
                  {data.totalPatientsCount}
                </span>
              </TabsTrigger>
            </TabsList>
            </div>

            {/* Contextual Actions Bar */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddToQueueOpen(true)}
                className="h-7.5 px-2.5 text-xs font-semibold gap-1.5 border-emerald-500/40 hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 cursor-pointer shadow-xs"
              >
                <Plus className="size-3" />
                <span>Add to Queue</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsNewPatientOpen(true)}
                className="h-7.5 px-2.5 text-xs font-semibold gap-1.5 border-primary/40 hover:bg-primary/10 text-primary cursor-pointer shadow-xs"
              >
                <UserPlus className="size-3" />
                <span>Register Patient</span>
              </Button>

              <Button
                size="sm"
                onClick={() => {
                  setPreselectedPatient(null);
                  setPreselectedSlotId(undefined);
                  setIsBookTicketOpen(true);
                }}
                className="h-7.5 px-3 text-xs font-semibold gap-1.5 shadow-sm cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Ticket className="size-3" />
                <span>Book Ticket</span>
              </Button>
            </div>
          </div>

          {/* TAB 1: SLOTS & SCHEDULE BOARD */}
          <TabsContent
            value="slots"
            className="outline-none focus:outline-none space-y-6 m-0"
          >
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

          {/* TAB 2: LIVE QUEUE MANAGEMENT */}
          <TabsContent
            value="queue"
            className="outline-none focus:outline-none space-y-6 m-0"
          >
            <QueueManagementTab
              appointments={data.appointments || []}
              performers={data.receptionistPerformers}
              rooms={data.rooms || []}
              lastPerformerId={lastPerformerId}
              onOpenAddToQueue={() => setIsAddToQueueOpen(true)}
              onRequestAction={(config) => setPendingAction(config)}
              onRefresh={() => refreshData(selectedDate)}
            />
          </TabsContent>

          {/* TAB 3: PATIENTS DIRECTORY */}
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
        </Tabs>
      </main>

      {/* 3. Action Dialogs with Performer Attribution */}
      <AddToQueueDialog
        isOpen={isAddToQueueOpen}
        onOpenChange={setIsAddToQueueOpen}
        patients={data.patients || []}
        performers={data.receptionistPerformers}
        defaultPerformerId={lastPerformerId}
        onSuccess={() => refreshData(selectedDate)}
        onOpenCreatePatient={() => setIsNewPatientOpen(true)}
      />

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
