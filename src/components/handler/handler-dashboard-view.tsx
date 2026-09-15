"use client";

import * as React from "react";
import {
  type HandlerDashboardData,
  getHandlerDashboardDataAction,
} from "@/actions/handler/handler.action";
import {
  updateAppointmentStatusAction,
  type PatientWithCount,
  type AppointmentWithRelations,
} from "@/actions/receptionist/appointment.action";
import { AppointmentStatus, QueueType, Role } from "@/generated/prisma/enums";
import { HandlerHeader } from "@/components/handler/handler-header";
import { HandlerQueueCard } from "@/components/handler/handler-queue-card";
import { HandlerExtraSlotsTab } from "@/components/handler/handler-extra-slots-tab";
import { SlotScheduleBoard } from "@/components/receptionist/slot-schedule-board";
import { DashboardDateSelector } from "@/components/ui/dashboard-date-selector";
import { PatientDirectoryView } from "@/components/receptionist/patient-directory-view";
import { CreatePatientDialog } from "@/components/receptionist/create-patient-dialog";
import { BookTicketDialog } from "@/components/receptionist/book-ticket-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Activity,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Users,
  Play,
  Volume2,
  DoorOpen,
  Send,
  Phone,
} from "lucide-react";
import { useRealtimeEvents } from "@/hooks/use-realtime-events";
import { toast } from "sonner";
import { formatTime12h } from "@/lib/queue-punctuality";
import { HandlerSendPatientDialog } from "@/components/handler/handler-send-patient-dialog";

interface HandlerDashboardViewProps {
  initialData: HandlerDashboardData;
  currentUserRole?: Role;
}

export function HandlerDashboardView({
  initialData,
  currentUserRole,
}: HandlerDashboardViewProps) {
  const [data, setData] = React.useState<HandlerDashboardData>(initialData);
  const [selectedDate, setSelectedDate] = React.useState<string>(
    initialData.selectedDate,
  );

  // Modals for ticket booking and registering patients
  const [isNewPatientOpen, setIsNewPatientOpen] = React.useState(false);
  const [isBookTicketOpen, setIsBookTicketOpen] = React.useState(false);
  const [preselectedSlotId, setPreselectedSlotId] = React.useState<
    string | undefined
  >();
  const [preselectedPatient, setPreselectedPatient] =
    React.useState<PatientWithCount | null>(null);

  // Send Patient dialog from Spotlight banner
  const [spotlightSendAppointment, setSpotlightSendAppointment] =
    React.useState<AppointmentWithRelations | null>(null);
  const [isSpotlightActionLoading, setIsSpotlightActionLoading] =
    React.useState(false);

  // Handler Performer identity
  const selectedHandlerId = React.useMemo(() => {
    return (
      initialData.currentHandler?.id ||
      initialData.handlerPerformers[0]?.id ||
      ""
    );
  }, [initialData.currentHandler, initialData.handlerPerformers]);

  // Default therapy room
  const selectedRoomId = React.useMemo(() => {
    const therapyRoom = data.rooms.find(
      (r) =>
        r.purpose?.toLowerCase().includes("therapy") ||
        r.number.startsWith("1") ||
        r.number.startsWith("3"),
    );
    return therapyRoom?.id || data.rooms[0]?.id || "";
  }, [data.rooms]);

  const selectedRoom = React.useMemo(() => {
    return data.rooms.find((r) => r.id === selectedRoomId);
  }, [data.rooms, selectedRoomId]);

  // Search filter
  const [searchQuery, setSearchQuery] = React.useState("");

  // Refresh data transition
  const [isPending, startTransition] = React.useTransition();
  const selectedDateRef = React.useRef(selectedDate);
  React.useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  const refreshData = React.useCallback(
    (targetDate?: string) => {
      const dateToFetch = targetDate || selectedDateRef.current;
      startTransition(async () => {
        try {
          const fresh = await getHandlerDashboardDataAction(dateToFetch);
          setData(fresh);
        } catch (err) {
          console.error("[Handler Dashboard Refresh Error]:", err);
        }
      });
    },
    [],
  );

  // 100% Offline Real-Time SSE Subscription
  const { connectionStatus } = useRealtimeEvents({
    onEvent: (event) => {
      if (
        event.type === "APPOINTMENT_CREATED" ||
        event.type === "APPOINTMENT_UPDATED" ||
        event.type === "APPOINTMENT_CANCELLED" ||
        event.type === "PATIENT_CREATED" ||
        event.type === "SLOT_UPDATED" ||
        event.type === "ROOM_UPDATED" ||
        event.type === "DOCTOR_CALLED"
      ) {
        refreshData(selectedDateRef.current);
      }
    },
  });

  // Date navigation
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

  // Patient created callback
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

  // Patient Check-In from schedule board
  const handleCheckIn = async (appointmentId: string) => {
    try {
      const res = await updateAppointmentStatusAction(
        appointmentId,
        AppointmentStatus.CHECKED_IN,
        selectedHandlerId,
        QueueType.THERAPY,
      );
      if (res.success) {
        toast.success("Patient checked in successfully for Physical Therapy.");
        refreshData(selectedDate);
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Failed to check in patient.");
    }
  };

  // Start Calling Consultation from Spotlight Banner
  const handleStartCallingTherapy = async () => {
    if (!data.callingTherapyAppointment) return;
    setIsSpotlightActionLoading(true);
    try {
      const res = await updateAppointmentStatusAction(
        data.callingTherapyAppointment.id,
        AppointmentStatus.IN_THERAPY,
        selectedHandlerId,
        QueueType.THERAPY,
        data.callingTherapyAppointment.roomId || selectedRoomId,
      );
      if (res.success) {
        toast.success(
          `Therapy session started for ${data.callingTherapyAppointment.patient?.name || "Patient"}.`,
        );
        refreshData(selectedDate);
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Failed to start therapy session.");
    } finally {
      setIsSpotlightActionLoading(false);
    }
  };

  // Cancel Ticket from schedule board
  const handleCancelAppointment = async (appointmentId: string) => {
    try {
      const res = await updateAppointmentStatusAction(
        appointmentId,
        AppointmentStatus.CANCELLED,
        selectedHandlerId,
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

  // Filtered therapy queue
  const filteredTherapyQueue = React.useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return data.therapyQueue.filter((item) => {
      if (!q) return true;
      const name = (item.patient?.name || "").toLowerCase();
      const phone = (item.patient?.phone || "").toLowerCase();
      return name.includes(q) || phone.includes(q);
    });
  }, [data.therapyQueue, searchQuery]);

  // In Therapy count
  const inTherapyCount = data.therapyQueue.filter(
    (a) => a.status === AppointmentStatus.IN_THERAPY,
  ).length;

  const callingApt = data.callingTherapyAppointment;
  const activeApt = data.activeTherapyAppointment;
  const activePlan = activeApt
    ? data.todayPlansByPatientId?.[activeApt.patientId]
    : null;

  return (
    <div className="min-h-screen w-full flex flex-col bg-background text-foreground selection:bg-emerald-500/20">
      {/* 1. Full-Width Handler Header */}
      <HandlerHeader
        connectionStatus={connectionStatus}
        currentUserRole={currentUserRole}
      />

      {/* 2. Main Workspace */}
      <main className="flex-1 w-full max-w-[1700px] mx-auto px-3 sm:px-5 py-2.5 space-y-2.5">
        {/* Top Control Bar: Date Selector, Search & Status Indicators */}
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
                type="text"
                placeholder="Search therapy queue by name or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs rounded-lg bg-background border-border/80 focus-visible:ring-emerald-500"
              />
            </div>
          </div>

          {/* Right: Status Badges */}
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground flex-wrap">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold text-[11px]">
              <Activity className="size-3.5" />
              <span>Therapy Waiting: {data.therapyQueue.length}</span>
            </div>

            {inTherapyCount > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-700 dark:text-sky-300 font-bold text-[11px] animate-pulse">
                <Play className="size-3.5" />
                <span>In Therapy: {inTherapyCount}</span>
              </div>
            )}

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/60 border border-border text-muted-foreground font-bold text-[11px]">
              <CheckCircle2 className="size-3 text-emerald-500" />
              <span>Completed Today: {data.completedTherapy.length}</span>
            </div>

            {data.pendingExtraSlots.length > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 font-bold text-[11px] animate-pulse">
                <AlertCircle className="size-3.5" />
                <span>Extra Standby: {data.pendingExtraSlots.length}</span>
              </div>
            )}
          </div>
        </div>

        {/* Calling Spotlight Banner (If a patient is being called into a public therapy room) */}
        {callingApt && (
          <div className="relative overflow-hidden rounded-xl border border-amber-500/50 bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-emerald-500/10 p-3 px-4 shadow-sm backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500 text-white text-[10.5px] font-black uppercase tracking-wider shadow-xs animate-pulse">
                    <span className="size-1.5 rounded-full bg-white" />
                    Calling To Therapy Room
                  </span>

                  {(callingApt.room?.number ||
                    callingApt.therapySlot?.room?.number) && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-md bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/30 text-[11px] font-bold font-mono">
                      <DoorOpen className="size-3" />
                      <span>
                        Room{" "}
                        {callingApt.room?.number ||
                          callingApt.therapySlot?.room?.number}
                      </span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-black tracking-tight text-foreground">
                    {callingApt.patient?.name || "Patient"}
                  </h2>
                  <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-muted text-muted-foreground border border-border">
                    {callingApt.gender === "MALE" ? "Male" : "Female"}
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1">
                    <Phone className="size-2.5 opacity-60" />
                    <span>{callingApt.patient?.phone || "No phone"}</span>
                  </span>
                  <span className="text-muted-foreground text-xs">•</span>
                  <span className="text-xs text-amber-700 dark:text-amber-300 font-semibold">
                    Announced on TV screens. When patient arrives in therapy
                    room, click Mark In Therapy.
                  </span>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-2 w-full md:w-auto shrink-0 flex-wrap">
                <Button
                  size="sm"
                  onClick={handleStartCallingTherapy}
                  disabled={isSpotlightActionLoading}
                  className="h-7.5 px-3 rounded-lg font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer gap-1.5"
                >
                  <Play className="size-3.5" />
                  <span>Mark In Therapy</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSpotlightSendAppointment(callingApt)}
                  className="h-7.5 px-2.5 text-xs font-semibold border-border cursor-pointer gap-1"
                >
                  <Send className="size-3" />
                  <span>Send Patient</span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Active In-Therapy Spotlight Banner */}
        {activeApt && (
          <div className="relative overflow-hidden rounded-xl border border-emerald-500/50 bg-gradient-to-r from-emerald-500/15 via-emerald-500/5 to-sky-500/10 p-3 px-4 shadow-sm backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500 text-white text-[10.5px] font-black uppercase tracking-wider shadow-xs">
                    <span className="size-1.5 rounded-full bg-white animate-pulse" />
                    Now In Therapy
                  </span>

                  {(activeApt.room?.number ||
                    activeApt.therapySlot?.room?.number) && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-md bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 border border-emerald-500/30 text-[11px] font-bold font-mono">
                      <DoorOpen className="size-3" />
                      <span>
                        Room{" "}
                        {activeApt.room?.number ||
                          activeApt.therapySlot?.room?.number}
                      </span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-black tracking-tight text-foreground">
                    {activeApt.patient?.name || "Patient"}
                  </h2>
                  <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-muted text-muted-foreground border border-border">
                    {activeApt.gender === "MALE" ? "Male" : "Female"}
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1">
                    <Phone className="size-2.5 opacity-60" />
                    <span>{activeApt.patient?.phone || "No phone"}</span>
                  </span>
                  {activePlan && activePlan.modalities.length > 0 && (
                    <>
                      <span className="text-muted-foreground text-xs">•</span>
                      <div className="flex items-center gap-1 flex-wrap">
                        {activePlan.modalities.slice(0, 4).map((m, i) => (
                          <span
                            key={i}
                            className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-900 dark:text-emerald-100 text-[10px] font-bold"
                          >
                            {m}
                          </span>
                        ))}
                        {activePlan.modalities.length > 4 && (
                          <span className="text-[10px] text-muted-foreground font-mono">
                            +{activePlan.modalities.length - 4} more
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* In-Therapy Actions */}
              <div className="flex items-center gap-2 w-full md:w-auto shrink-0 flex-wrap">
                <Button
                  size="sm"
                  onClick={() => setSpotlightSendAppointment(activeApt)}
                  className="h-7.5 px-3 rounded-lg font-bold text-xs bg-sky-600 hover:bg-sky-700 text-white shadow-xs cursor-pointer gap-1.5"
                >
                  <Send className="size-3.5" />
                  <span>Send Patient</span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Tabs for Handler Desk Navigation */}
        <Tabs defaultValue="queue" className="w-full space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-1.5">
            <TabsList className="bg-muted/50 p-0.5 rounded-lg h-8.5 border border-border/60 flex-wrap">
              <TabsTrigger
                value="queue"
                className="rounded-md text-xs font-bold gap-1 px-3 py-1 data-[state=active]:bg-background data-[state=active]:shadow-xs cursor-pointer"
              >
                <Activity className="size-3 text-emerald-500" />
                <span>Therapy Queue</span>
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-mono">
                  {data.therapyQueue.length}
                </span>
              </TabsTrigger>

              <TabsTrigger
                value="booking"
                className="rounded-md text-xs font-bold gap-1 px-3 py-1 data-[state=active]:bg-background data-[state=active]:shadow-xs cursor-pointer"
              >
                <Clock className="size-3 text-primary" />
                <span>Book Slots</span>
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-primary/15 text-primary text-[10px] font-mono">
                  {data.slots.length}
                </span>
              </TabsTrigger>

              <TabsTrigger
                value="extra-slots"
                className="rounded-md text-xs font-bold gap-1 px-3 py-1 data-[state=active]:bg-background data-[state=active]:shadow-xs cursor-pointer"
              >
                <AlertCircle className="size-3 text-amber-500" />
                <span>Extra Slots</span>
                {data.extraSlots.length > 0 ? (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px] font-mono font-bold">
                    {data.extraSlots.length}
                  </span>
                ) : (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full bg-muted text-muted-foreground text-[10px] font-mono">
                    0
                  </span>
                )}
              </TabsTrigger>

              <TabsTrigger
                value="patients"
                className="rounded-md text-xs font-bold gap-1 px-3 py-1 data-[state=active]:bg-background data-[state=active]:shadow-xs cursor-pointer"
              >
                <Users className="size-3 text-indigo-500" />
                <span>Patients</span>
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 text-[10px] font-mono">
                  {data.patients.length}
                </span>
              </TabsTrigger>

              <TabsTrigger
                value="completed"
                className="rounded-md text-xs font-bold gap-1 px-3 py-1 data-[state=active]:bg-background data-[state=active]:shadow-xs cursor-pointer"
              >
                <CheckCircle2 className="size-3 text-primary" />
                <span>Completed Today</span>
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-primary/15 text-primary text-[10px] font-mono">
                  {data.completedTherapy.length}
                </span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* 1. Therapy Queue Tab */}
          <TabsContent value="queue" className="space-y-2 outline-none">
            {filteredTherapyQueue.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/80 bg-muted/10 p-6 text-center space-y-1.5">
                <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
                  <Activity className="size-4" />
                </div>
                <h3 className="text-xs font-bold text-foreground">
                  Therapy Queue is Clear
                </h3>
                <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                  No patients are waiting in the Physical Therapy queue right
                  now. Checked-in patients from reception will appear here in
                  real-time.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2">
                {filteredTherapyQueue.map((appointment) => (
                  <HandlerQueueCard
                    key={appointment.id}
                    appointment={appointment}
                    todayPlan={
                      data.todayPlansByPatientId?.[appointment.patientId]
                    }
                    performerId={selectedHandlerId}
                    selectedRoomId={selectedRoomId}
                    selectedRoomNumber={selectedRoom?.number}
                    handlers={data.handlerPerformers}
                    rooms={data.rooms}
                    onRefresh={() => refreshData(selectedDate)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* 2. Slot Booking Tab */}
          <TabsContent value="booking" className="space-y-2 outline-none">
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

          {/* 3. Extra Slots Monitor Tab */}
          <TabsContent value="extra-slots" className="space-y-2 outline-none">
            <HandlerExtraSlotsTab extraSlots={data.extraSlots} />
          </TabsContent>

          {/* 4. Patients Directory & Registration Tab */}
          <TabsContent value="patients" className="space-y-2 outline-none">
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

          {/* 5. Completed Today Tab */}
          <TabsContent value="completed" className="space-y-2 outline-none">
            {data.completedTherapy.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/80 bg-muted/10 p-6 text-center space-y-1.5">
                <CheckCircle2 className="size-5 text-muted-foreground/50 mx-auto" />
                <h3 className="text-xs font-bold text-foreground">
                  No Completed Therapy Sessions Yet
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Finished physical therapy sessions for today will be logged
                  here.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-2xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border/80 bg-muted/30 text-muted-foreground font-semibold">
                      <th className="py-2 px-3 text-[11px]">Patient</th>
                      <th className="py-2 px-2.5 text-[11px]">Gender</th>
                      <th className="py-2 px-2.5 text-[11px]">Phone</th>
                      <th className="py-2 px-2.5 text-[11px]">Slot / Room</th>
                      <th className="py-2 px-2.5 text-[11px]">Told / In</th>
                      <th className="py-2 px-3 text-right text-[11px]">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {data.completedTherapy.map((a) => (
                      <tr
                        key={a.id}
                        className="hover:bg-muted/20 transition-colors"
                      >
                        <td className="py-1.5 px-3 font-bold text-foreground">
                          {a.patient?.name || "Patient"}
                        </td>
                        <td className="py-1.5 px-2.5">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9.5px] font-bold border ${
                              a.gender === "MALE"
                                ? "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20"
                                : "bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/20"
                            }`}
                          >
                            {a.gender === "MALE" ? "M" : "F"}
                          </span>
                        </td>
                        <td className="py-1.5 px-2.5 font-mono text-[11px] text-muted-foreground">
                          {a.patient?.phone || "---"}
                        </td>
                        <td className="py-1.5 px-2.5 font-mono text-[11px]">
                          {a.therapySlot?.label || "Therapy"}{" "}
                          {a.room?.number ? `(R${a.room.number})` : ""}
                        </td>
                        <td className="py-1.5 px-2.5 font-mono text-[11px] text-muted-foreground">
                          {a.toldTime || "--"} / {formatTime12h(a.checkInTime)}
                        </td>
                        <td className="py-1.5 px-3 text-right">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                            <CheckCircle2 className="size-2.5" />
                            <span>Completed</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* 3. Modals for Patient Registration & Ticket Booking */}
      <CreatePatientDialog
        isOpen={isNewPatientOpen}
        onOpenChange={setIsNewPatientOpen}
        performers={
          data.handlerPerformers.length > 0
            ? data.handlerPerformers
            : data.receptionistPerformers
        }
        defaultPerformerId={selectedHandlerId}
        onPatientCreated={handlePatientCreated}
      />

      <BookTicketDialog
        isOpen={isBookTicketOpen}
        onOpenChange={setIsBookTicketOpen}
        slots={data.slots}
        selectedDate={selectedDate}
        preselectedSlotId={preselectedSlotId}
        preselectedPatient={preselectedPatient}
        performers={
          data.handlerPerformers.length > 0
            ? data.handlerPerformers
            : data.receptionistPerformers
        }
        activePerformerId={selectedHandlerId}
        onTicketBooked={handleTicketBooked}
        onOpenRegisterPatient={() => {
          setIsBookTicketOpen(false);
          setIsNewPatientOpen(true);
        }}
      />

      {/* 4. Global Send Patient Dialog (from Spotlight Banners) */}
      <HandlerSendPatientDialog
        isOpen={Boolean(spotlightSendAppointment)}
        onOpenChange={(open) => {
          if (!open) setSpotlightSendAppointment(null);
        }}
        appointment={spotlightSendAppointment}
        todayPlan={
          spotlightSendAppointment
            ? data.todayPlansByPatientId?.[
                spotlightSendAppointment.patientId
              ]
            : null
        }
        handlers={data.handlerPerformers}
        defaultHandlerId={selectedHandlerId}
        onSuccess={() => {
          setSpotlightSendAppointment(null);
          refreshData(selectedDate);
        }}
      />
    </div>
  );
}
