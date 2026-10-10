"use client";

import * as React from "react";
import type { DoctorDashboardData } from "@/actions/doctor/doctor.action";
import { getDoctorDashboardDataAction } from "@/actions/doctor/doctor.action";
import type { PatientWithCount } from "@/actions/receptionist/appointment.action";
import { updateAppointmentStatusAction } from "@/actions/receptionist/appointment.action";
import {
  AppointmentStatus,
  QueueType,
  Role,
  RoomAccessType,
} from "@/generated/prisma/enums";
import { DoctorHeader } from "@/components/doctor/doctor-header";
import { DoctorQueueCard } from "@/components/doctor/doctor-queue-card";
import { HandlerQueueCard } from "@/components/handler/handler-queue-card";
import { SlotScheduleBoard } from "@/components/receptionist/slot-schedule-board";
import { DashboardDateSelector } from "@/components/ui/dashboard-date-selector";
import { PatientDirectoryView } from "@/components/receptionist/patient-directory-view";
import { CreatePatientDialog } from "@/components/receptionist/create-patient-dialog";
import { BookTicketDialog } from "@/components/receptionist/book-ticket-dialog";
import { ExtraSlotsApprovalTab } from "@/components/doctor/extra-slots-approval-tab";
import { CreateMedicalRecordDialog } from "@/components/doctor/medical/create-medical-record-dialog";
import {
  PatientMedicalHistoryDialog,
  type HistoryPatientInfo,
} from "@/components/doctor/medical/patient-medical-history-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ConsultationTimer } from "@/components/doctor/consultation-timer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Stethoscope,
  Activity,
  Search,
  CheckCircle2,
  DoorOpen,
  Phone,
  AlertCircle,
  Clock,
  Users,
  FilePlus2,
  FolderOpen,
  Send,
  CalendarCheck2,
  Printer,
  Compass,
  MessageSquare,
  Pill,
} from "lucide-react";
import { useRealtimeEvents } from "@/hooks/use-realtime-events";
import { toast } from "sonner";
import { formatTime12h } from "@/lib/queue-punctuality";
import { PatientJourneyTrackerView } from "@/components/tracking/patient-journey-tracker-view";
import { SendPatientDialog } from "@/components/doctor/send-patient-dialog";
import { TreatmentPlanDialog } from "@/components/doctor/treatment/treatment-plan-dialog";
import { ClinicChatView } from "@/components/chat/clinic-chat-view";
import { useChatNotifications } from "@/hooks/use-chat-notifications";
import { playChatChime } from "@/lib/chat-chime";
import {
  DoctorPrescriptionDialog,
  type DoctorPrescriptionData,
} from "@/components/print/doctor-prescription-dialog";
import { NewPrescriptionDialog } from "@/components/doctor/prescription/new-prescription-dialog";
import { OldPrescriptionsDialog } from "@/components/doctor/prescription/old-prescriptions-dialog";

interface DoctorDashboardViewProps {
  initialData: DoctorDashboardData;
  currentUserRole?: Role;
  currentUserId?: string;
}

export function DoctorDashboardView({
  initialData,
  currentUserRole,
  currentUserId: propUserId,
}: DoctorDashboardViewProps) {
  const [data, setData] = React.useState<DoctorDashboardData>(initialData);
  const [selectedDate, setSelectedDate] = React.useState<string>(
    initialData.selectedDate,
  );
  const [activeTab, setActiveTab] = React.useState<string>("consultation");

  // Selected Doctor & Chamber Room
  const selectedDoctorId = React.useMemo(() => {
    return (
      propUserId ||
      data.currentDoctor?.id ||
      initialData.currentDoctor?.id ||
      ""
    );
  }, [propUserId, data.currentDoctor, initialData.currentDoctor]);

  // Real-time Chat Notifications & Chime at the Doctor Console Root Level
  const { unreadCount: unreadChatCount } = useChatNotifications({
    isChatTabActive: activeTab === "chat",
    currentUserId: selectedDoctorId,
    onOpenChatTab: () => setActiveTab("chat"),
  });

  // Modals for ticket booking and registering patients
  const [isNewPatientOpen, setIsNewPatientOpen] = React.useState(false);
  const [isBookTicketOpen, setIsBookTicketOpen] = React.useState(false);
  const [preselectedSlotId, setPreselectedSlotId] = React.useState<
    string | undefined
  >();
  const [preselectedPatient, setPreselectedPatient] =
    React.useState<PatientWithCount | null>(null);

  // Medical Record & History Dialog states
  const [isCreateRecordOpen, setIsCreateRecordOpen] = React.useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = React.useState(false);
  const [selectedHistoryPatient, setSelectedHistoryPatient] =
    React.useState<HistoryPatientInfo | null>(null);
  const [isSendPatientOpen, setIsSendPatientOpen] = React.useState(false);
  const [isTreatmentPlanOpen, setIsTreatmentPlanOpen] = React.useState(false);
  const [treatmentPlanTab, setTreatmentPlanTab] = React.useState<
    "today" | "next"
  >("today");
  const [isNewPrescriptionOpen, setIsNewPrescriptionOpen] = React.useState(false);
  const [isOldPrescriptionsOpen, setIsOldPrescriptionsOpen] = React.useState(false);


  // Priority: 1. Doctor's assigned chamber from admin panel (strictly DOCTOR type), 2. First doctor consultation room
  const selectedRoomId = React.useMemo(() => {
    if (data.currentDoctor?.consultationRoomId) {
      const assignedRoom = data.rooms.find(
        (r) => r.id === data.currentDoctor?.consultationRoomId,
      );
      if (assignedRoom && assignedRoom.accessType === RoomAccessType.DOCTOR) {
        return assignedRoom.id;
      }
    }
    const consultationRoom = data.rooms.find(
      (r) => r.accessType === RoomAccessType.DOCTOR,
    );
    return consultationRoom?.id || "";
  }, [data.rooms, data.currentDoctor]);

  const selectedRoom = React.useMemo(() => {
    return data.rooms.find((r) => r.id === selectedRoomId);
  }, [data.rooms, selectedRoomId]);

  // Search filter
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isFinishingSession, setIsFinishingSession] = React.useState(false);
  const [prescriptionPrintData, setPrescriptionPrintData] =
    React.useState<DoctorPrescriptionData | null>(null);

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
          const fresh = await getDoctorDashboardDataAction(dateToFetch);
          setData(fresh);
        } catch (err) {
          console.error("[Doctor Dashboard Refresh Error]:", err);
        }
      });
    },
    [],
  );

  // 100% Offline Real-Time SSE Subscription
  const { connectionStatus } = useRealtimeEvents({
    onEvent: (event) => {
      const type = (event?.type || "").toUpperCase();
      if (type !== "CHAT_MESSAGE_SENT" && type !== "CHAT_MESSAGE_DELETED") {
        refreshData(selectedDateRef.current);
        if (type === "CONSULTATION_QUEUED") {
          playChatChime(false);
          toast.info(
            `New Patient in Consultation Queue: ${event.data?.patientName || "Patient"} (Serial #${event.data?.serialNumber || ""})`,
            { id: `queue-consult-${event.data?.serialId || Date.now()}` },
          );
        }
      }
    },
    onReconnect: () => {
      refreshData(selectedDateRef.current);
    },
  });

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

  // Patient Check In from schedule board
  const handleCheckIn = async (appointmentId: string) => {
    try {
      const res = await updateAppointmentStatusAction(
        appointmentId,
        AppointmentStatus.CHECKED_IN,
        undefined,
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
        undefined,
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

  // Filtered consultation queue
  const filteredConsultationQueue = React.useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return data.consultationQueue.filter((item) => {
      if (!q) return true;
      const name = (item.patient?.name || "").toLowerCase();
      const phone = (item.patient?.phone || "").toLowerCase();
      return name.includes(q) || phone.includes(q);
    });
  }, [data.consultationQueue, searchQuery]);

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

  // Active consultation patient (if currently in session, strictly for consultation queue)
  const activeConsultation =
    data.activeConsultation?.queueType === QueueType.CONSULTATION
      ? data.activeConsultation
      : null;
  const callingAppointment =
    data.callingAppointment?.queueType === QueueType.CONSULTATION
      ? data.callingAppointment
      : null;

  // Mark Calling Patient in Consultation when patient enters the chamber
  const handleStartCallingConsultation = async () => {
    if (!callingAppointment) return;
    setIsFinishingSession(true);
    try {
      const res = await updateAppointmentStatusAction(
        callingAppointment.id,
        AppointmentStatus.IN_CONSULTATION,
        undefined,
        QueueType.CONSULTATION,
        undefined,
        undefined,
        selectedDoctorId || undefined,
      );
      if (res.success) {
        toast.success(
          `${callingAppointment.patient?.name} is now in consultation.`,
        );
        refreshData(selectedDate);
      } else {
        toast.error(res.message);
      }
    } finally {
      setIsFinishingSession(false);
    }
  };

  // Cancel call and put patient back in checked-in queue
  const handleCancelCall = async () => {
    if (!callingAppointment) return;
    setIsFinishingSession(true);
    try {
      const res = await updateAppointmentStatusAction(
        callingAppointment.id,
        AppointmentStatus.CHECKED_IN,
        undefined,
        QueueType.CONSULTATION,
        "",
        undefined,
        selectedDoctorId || undefined,
      );
      if (res.success) {
        toast.info(
          `Call cancelled. ${callingAppointment.patient?.name} returned to waiting queue.`,
        );
        refreshData(selectedDate);
      } else {
        toast.error(res.message);
      }
    } finally {
      setIsFinishingSession(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col bg-background text-foreground selection:bg-sky-500/20">
      {/* 1. Full-Width Doctor Header (NO SIDEBAR) */}
      <DoctorHeader
        connectionStatus={connectionStatus}
        currentUserRole={currentUserRole}
        currentDoctor={data.currentDoctor}
      />

      {/* 2. Main Workspace */}
      <main className="flex-1 w-full max-w-[1700px] mx-auto px-3 sm:px-5 py-2.5 space-y-2.5">
        {/* Calling Spotlight Banner (If a patient is being called right now) */}
        {!activeConsultation && callingAppointment && (
          <div className="relative overflow-hidden rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-sky-500/10 p-3 px-4 shadow-sm backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500 text-white text-[10.5px] font-black uppercase tracking-wider shadow-xs animate-pulse">
                    <span className="size-1.5 rounded-full bg-white" />
                    Now Calling Patient
                  </span>

                  {callingAppointment.room?.number && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-md bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/30 text-[11px] font-bold font-mono">
                      <DoorOpen className="size-3" />
                      <span>Room {callingAppointment.room.number}</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-black tracking-tight text-foreground">
                    {callingAppointment.patient?.name || "Patient"}
                  </h2>
                  <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-muted text-muted-foreground border border-border">
                    {callingAppointment.gender === "MALE" ? "Male" : "Female"}
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1">
                    <Phone className="size-2.5 opacity-60" />
                    <span>
                      {callingAppointment.patient?.phone || "No phone"}
                    </span>
                  </span>
                  <span className="text-muted-foreground text-xs">•</span>
                  <span className="text-xs text-amber-700 dark:text-amber-300 font-semibold">
                    Announced on TV. When patient arrives in your room, click
                    Mark In Consultation, or click Cancel Call if patient is late.
                  </span>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-2 w-full md:w-auto shrink-0 flex-wrap">
                <Button
                  size="sm"
                  onClick={handleStartCallingConsultation}
                  disabled={isFinishingSession}
                  className="h-7.5 px-3 rounded-lg font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer gap-1.5"
                >
                  <Stethoscope className="size-3.5" />
                  <span>Mark In Consultation</span>
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancelCall}
                  disabled={isFinishingSession}
                  title="Patient is late — cancel call and keep in queue so you can call another patient"
                  className="h-7.5 px-2.5 rounded-lg text-xs font-bold border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20 cursor-pointer gap-1.5"
                >
                  <span>Cancel Call (Keep in Queue)</span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Active Consultation Spotlight Banner (If a patient is in session right now) */}
        {activeConsultation && (
          <div className="relative overflow-hidden rounded-xl border border-emerald-500/40 bg-gradient-to-r from-emerald-500/15 via-emerald-500/5 to-sky-500/10 p-3 px-4 shadow-sm backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500 text-white text-[10.5px] font-black uppercase tracking-wider shadow-xs">
                    <span className="size-1.5 rounded-full bg-white animate-pulse" />
                    Now Consulting
                  </span>

                  {activeConsultation.room?.number && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-md bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 border border-emerald-500/30 text-[11px] font-bold font-mono">
                      <DoorOpen className="size-3" />
                      <span>Room {activeConsultation.room.number}</span>
                    </span>
                  )}

                  <ConsultationTimer
                    startTime={
                      activeConsultation.inConsultationTime ||
                      activeConsultation.checkInTime
                    }
                  />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-black tracking-tight text-foreground">
                    {activeConsultation.patient?.name || "Patient"}
                  </h2>
                  <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-muted text-muted-foreground border border-border">
                    {activeConsultation.gender === "MALE" ? "Male" : "Female"}
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1">
                    <Phone className="size-2.5 opacity-60" />
                    <span>
                      {activeConsultation.patient?.phone || "No phone"}
                    </span>
                  </span>
                  <span className="text-muted-foreground text-xs">•</span>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    In: {formatTime12h(activeConsultation.checkInTime)}
                  </span>
                  {activeConsultation.willCallTime && (
                    <>
                      <span className="text-muted-foreground text-xs">•</span>
                      <span className="text-[11px] font-mono text-sky-600 dark:text-sky-400 font-bold">
                        Call: {activeConsultation.willCallTime}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Consultation Quick Actions */}
              <div className="flex items-center gap-2 w-full md:w-auto shrink-0 flex-wrap">
                {/* View Old Files / Medical History */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedHistoryPatient(
                      activeConsultation.patient || null,
                    );
                    setIsHistoryOpen(true);
                  }}
                  title="View previous medical checkup files & history for this patient"
                  className="h-7.5 px-2.5 rounded-lg font-bold text-xs border-sky-500/40 text-sky-700 dark:text-sky-300 hover:bg-sky-500/10 cursor-pointer gap-1.5"
                >
                  <FolderOpen className="size-3.5" />
                  <span>View Old Files</span>
                </Button>

                {/* Create New File / Physiotherapy Assessment */}
                <Button
                  size="sm"
                  onClick={() => setIsCreateRecordOpen(true)}
                  title="Create a new physiotherapy assessment file"
                  className="h-7.5 px-2.5 rounded-lg font-bold text-xs bg-sky-600 hover:bg-sky-700 text-white shadow-xs cursor-pointer gap-1.5"
                >
                  <FilePlus2 className="size-3.5" />
                  <span>Create New File</span>
                </Button>

                {/* Old Prescriptions */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsOldPrescriptionsOpen(true)}
                  title="View previous prescriptions for this patient"
                  className="h-7.5 px-2.5 rounded-lg font-bold text-xs border-indigo-500/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/10 cursor-pointer gap-1.5"
                >
                  <Pill className="size-3.5" />
                  <span>Old Prescriptions</span>
                </Button>

                {/* New Prescription */}
                <Button
                  size="sm"
                  onClick={() => setIsNewPrescriptionOpen(true)}
                  title="Prescribe new medications with meal timing & schedule"
                  className="h-7.5 px-2.5 rounded-lg font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer gap-1.5"
                >
                  <Pill className="size-3.5" />
                  <span>New Prescription</span>
                </Button>

                {/* Today's Treatment Plan */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setTreatmentPlanTab("today");
                    setIsTreatmentPlanOpen(true);
                  }}
                  title="Prescribe or review today's therapy treatment plan"
                  className="h-7.5 px-2.5 rounded-lg font-bold text-xs border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 cursor-pointer gap-1.5"
                >
                  <Activity className="size-3.5" />
                  <span>Today&apos;s Plan</span>
                </Button>

                {/* Next Treatment Plan */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setTreatmentPlanTab("next");
                    setIsTreatmentPlanOpen(true);
                  }}
                  title="Prescribe or review next session treatment recommendations"
                  className="h-7.5 px-2.5 rounded-lg font-bold text-xs border-purple-500/40 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10 cursor-pointer gap-1.5"
                >
                  <CalendarCheck2 className="size-3.5" />
                  <span>Next Plan</span>
                </Button>

                {/* Print Prescription / Clinical Report */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (!activeConsultation.patient) return;
                    const plan =
                      data.todayPlansByPatientId?.[activeConsultation.patientId];
                    setPrescriptionPrintData({
                      patient: activeConsultation.patient,
                      doctor: data.currentDoctor,
                      treatmentPlans: plan?.modalities || [],
                    });
                  }}
                  title="Print official A4 clinical assessment report & prescription"
                  className="h-7.5 px-2.5 rounded-lg font-bold text-xs border-sky-500/40 text-sky-700 dark:text-sky-300 hover:bg-sky-500/10 cursor-pointer gap-1.5"
                >
                  <Printer className="size-3.5" />
                  <span>Print Report</span>
                </Button>

                {/* Send Patient */}
                <Button
                  size="sm"
                  onClick={() => setIsSendPatientOpen(true)}
                  disabled={isFinishingSession}
                  className="h-7.5 px-3 rounded-lg font-bold text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs cursor-pointer gap-1.5"
                  title="Send patient to next destination"
                >
                  <Send className="size-3.5" />
                  <span>Send Patient</span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Top Control Bar: Date Selector, Search & Status Badges */}
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
                name="doctor_queue_search_query"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
                data-1p-ignore="true"
                data-form-type="other"
                placeholder="Search queue by patient name or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs rounded-lg bg-background border-border/80 focus-visible:ring-sky-500"
              />
            </div>
          </div>

          {/* Right: Status Badges */}
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground flex-wrap">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-700 dark:text-sky-300 font-bold text-[11px]">
              <Stethoscope className="size-3.5" />
              <span>Consultation Waiting: {data.consultationQueue.length}</span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold text-[11px]">
              <CheckCircle2 className="size-3.5" />
              <span>Completed: {data.completedConsultations.length}</span>
            </div>

            {data.pendingExtraSlots.length > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 font-bold text-[11px] animate-pulse">
                <AlertCircle className="size-3.5" />
                <span>Extra Requests: {data.pendingExtraSlots.length}</span>
              </div>
            )}
          </div>
        </div>

        {/* Tabs for Doctor Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-2.5">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2 border-b border-border/50 pb-1.5 w-full min-w-0">
            <div className="w-full overflow-x-auto scrollbar-none min-w-0">
              <TabsList className="bg-muted/50 p-1 rounded-xl h-auto min-h-9 border border-border/60 inline-flex items-center gap-1 shrink-0">
                <TabsTrigger
                  value="consultation"
                  className="rounded-md text-xs font-bold gap-1 px-3 py-1 data-[state=active]:bg-background data-[state=active]:shadow-xs cursor-pointer shrink-0 whitespace-nowrap"
                >
                  <Stethoscope className="size-3 text-sky-500" />
                  <span>Consultation Queue</span>
                  <span className="ml-1 px-1.5 py-0.2 rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-300 text-[10px] font-mono">
                    {data.consultationQueue.length}
                  </span>
                </TabsTrigger>

              <TabsTrigger
                value="therapy"
                className="rounded-md text-xs font-bold gap-1 px-3 py-1 data-[state=active]:bg-background data-[state=active]:shadow-xs cursor-pointer shrink-0"
              >
                <Activity className="size-3 text-emerald-500" />
                <span>Therapy Queue</span>
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-mono">
                  {data.therapyQueue.length}
                </span>
              </TabsTrigger>

              <TabsTrigger
                value="booking"
                className="rounded-md text-xs font-bold gap-1 px-3 py-1 data-[state=active]:bg-background data-[state=active]:shadow-xs cursor-pointer shrink-0"
              >
                <Clock className="size-3 text-primary" />
                <span>Book Slots</span>
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-primary/15 text-primary text-[10px] font-mono">
                  {data.slots.length}
                </span>
              </TabsTrigger>

              <TabsTrigger
                value="tracking"
                className="rounded-md text-xs font-bold gap-1 px-3 py-1 data-[state=active]:bg-background data-[state=active]:shadow-xs cursor-pointer shrink-0"
              >
                <Compass className="size-3 text-indigo-500" />
                <span>Patient Journey</span>
              </TabsTrigger>

              <TabsTrigger
                value="patients"
                className="rounded-md text-xs font-bold gap-1 px-3 py-1 data-[state=active]:bg-background data-[state=active]:shadow-xs cursor-pointer shrink-0"
              >
                <Users className="size-3 text-indigo-500" />
                <span>Patients</span>
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 text-[10px] font-mono">
                  {data.patients.length}
                </span>
              </TabsTrigger>

              <TabsTrigger
                value="extra-slots"
                className="rounded-md text-xs font-bold gap-1 px-3 py-1 data-[state=active]:bg-background data-[state=active]:shadow-xs cursor-pointer shrink-0"
              >
                <AlertCircle className="size-3 text-amber-500" />
                <span>Extra Slots</span>
                {data.pendingExtraSlots.length > 0 ? (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px] font-mono font-bold animate-pulse">
                    {data.pendingExtraSlots.length}
                  </span>
                ) : (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full bg-muted text-muted-foreground text-[10px] font-mono">
                    0
                  </span>
                )}
              </TabsTrigger>

              <TabsTrigger
                value="completed"
                className="rounded-md text-xs font-bold gap-1 px-3 py-1 data-[state=active]:bg-background data-[state=active]:shadow-xs cursor-pointer shrink-0"
              >
                <CheckCircle2 className="size-3 text-primary" />
                <span>Today&apos;s Completed</span>
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-primary/15 text-primary text-[10px] font-mono">
                  {data.completedConsultations.length}
                </span>
              </TabsTrigger>

              <TabsTrigger
                value="chat"
                className="rounded-md text-xs font-bold gap-1 px-3 py-1 data-[state=active]:bg-background data-[state=active]:shadow-xs cursor-pointer shrink-0"
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

          {/* 1. Consultation Queue Tab */}
          <TabsContent value="consultation" className="space-y-2 outline-none">
            {filteredConsultationQueue.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/80 bg-muted/10 p-5 text-center space-y-1.5">
                <div className="size-8 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center mx-auto border border-sky-500/20">
                  <Stethoscope className="size-4" />
                </div>
                <h3 className="text-xs font-bold text-foreground">
                  Consultation Queue is Clear
                </h3>
                <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                  No patients are waiting in the Doctor Consultation Queue right
                  now.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2">
                {filteredConsultationQueue.map((appointment) => (
                  <DoctorQueueCard
                    key={appointment.id}
                    appointment={appointment}
                    performerId={selectedDoctorId}
                    currentDoctor={data.currentDoctor}
                    selectedRoomId={selectedRoomId}
                    selectedRoomNumber={selectedRoom?.number}
                    rooms={data.rooms}
                    onRefresh={() => refreshData(selectedDate)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* 2. Therapy Queue Tab */}
          <TabsContent value="therapy" className="space-y-2 outline-none">
            {filteredTherapyQueue.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/80 bg-muted/10 p-5 text-center space-y-1.5">
                <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
                  <Activity className="size-4" />
                </div>
                <h3 className="text-xs font-bold text-foreground">
                  Therapy Queue is Clear
                </h3>
                <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                  No patients are currently in the Physical Therapy queue.
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
                    performerId={selectedDoctorId}
                    selectedRoomId={selectedRoomId}
                    selectedRoomNumber={selectedRoom?.number}
                    handlers={data.handlerPerformers || []}
                    rooms={data.rooms}
                    onRefresh={() => refreshData(selectedDate)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* 3. Slot Booking Tab */}
          <TabsContent value="booking" className="space-y-2 outline-none">
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

          {/* 3B. Patient Journey Tracking Tab */}
          <TabsContent value="tracking" className="space-y-2 outline-none">
            <PatientJourneyTrackerView
              defaultDate={selectedDate}
              showDateSelector={false}
            />
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

          {/* 5. Extra Slots Approval Tab */}
          <TabsContent value="extra-slots" className="space-y-2 outline-none">
            <ExtraSlotsApprovalTab
              pendingExtraSlots={data.pendingExtraSlots}
              decidedExtraSlots={data.decidedExtraSlots}
              performerId={selectedDoctorId}
              onRefresh={() => refreshData(selectedDate)}
            />
          </TabsContent>

          {/* 6. Today's Completed Tab */}
          <TabsContent value="completed" className="space-y-2 outline-none">
            {data.completedConsultations.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/80 bg-muted/10 p-5 text-center space-y-1.5">
                <CheckCircle2 className="size-5 text-muted-foreground/50 mx-auto" />
                <h3 className="text-xs font-bold text-foreground">
                  No Completed Consultations Yet
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Completed consultations for today will be logged here.
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
                      <th className="py-2 px-2.5 text-[11px]">Room</th>
                      <th className="py-2 px-2.5 text-[11px]">Told / In</th>
                      <th className="py-2 px-3 text-right text-[11px]">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {data.completedConsultations.map((a) => (
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
                          {a.room?.number ? `R${a.room.number}` : "Chamber"}
                        </td>
                        <td className="py-1.5 px-2.5 font-mono text-[11px] text-muted-foreground">
                          {a.toldTime || "--"} / {formatTime12h(a.checkInTime)}
                        </td>
                        <td className="py-1.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() => {
                                if (!a.patient) return;
                                setPrescriptionPrintData({
                                  patient: a.patient,
                                  doctor: a.doctor || data.currentDoctor,
                                });
                              }}
                              className="h-6 px-2 text-[10.5px] font-semibold gap-1 text-sky-700 dark:text-sky-300 border-sky-500/30 hover:bg-sky-500/10 cursor-pointer"
                              title="Print A4 Clinical Assessment & Prescription"
                            >
                              <Printer className="size-2.5" />
                              <span>Prescription</span>
                            </Button>
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                              <CheckCircle2 className="size-2.5" />
                              <span>Completed</span>
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* 7. Clinic Real-time Internal Chat Tab */}
          <TabsContent value="chat" className="space-y-2 outline-none">
            <ClinicChatView
              currentUserRole={Role.DOCTOR}
              currentUserId={selectedDoctorId}
              initialDate={selectedDate}
              showDateSelector={false}
              rooms={data.rooms}
              onDateChange={handleSelectDate}
            />
          </TabsContent>
        </Tabs>
      </main>

      {/* 3. Modals for Patient Registration & Ticket Booking */}
      <CreatePatientDialog
        isOpen={isNewPatientOpen}
        onOpenChange={setIsNewPatientOpen}
        performers={
          data.doctorPerformers.length > 0
            ? data.doctorPerformers
            : data.receptionistPerformers
        }
        defaultPerformerId={selectedDoctorId}
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
          data.doctorPerformers.length > 0
            ? data.doctorPerformers
            : data.receptionistPerformers
        }
        activePerformerId={selectedDoctorId}
        onTicketBooked={handleTicketBooked}
        onOpenRegisterPatient={() => {
          setIsBookTicketOpen(false);
          setIsNewPatientOpen(true);
        }}
      />

      {/* 4. Modals for Medical Records & Clinical History */}
      <CreateMedicalRecordDialog
        isOpen={isCreateRecordOpen}
        onOpenChange={setIsCreateRecordOpen}
        appointment={activeConsultation}
        doctorId={selectedDoctorId}
        onSuccess={() => {
          refreshData(selectedDate);
          toast.success("Medical assessment recorded successfully.");
        }}
      />

      <PatientMedicalHistoryDialog
        isOpen={isHistoryOpen}
        onOpenChange={setIsHistoryOpen}
        patient={selectedHistoryPatient || activeConsultation?.patient || null}
        onNewRecordRequested={() => setIsCreateRecordOpen(true)}
      />

      {/* 5. Send Patient Routing Dialog */}
      <SendPatientDialog
        isOpen={isSendPatientOpen}
        onOpenChange={setIsSendPatientOpen}
        appointment={activeConsultation}
        doctorId={selectedDoctorId}
        onSuccess={() => refreshData(selectedDate)}
        onOpenTreatmentPlan={(tab) => {
          setTreatmentPlanTab(tab);
          setIsTreatmentPlanOpen(true);
        }}
      />

      {/* 6. Treatment Plan Dialog */}
      <TreatmentPlanDialog
        isOpen={isTreatmentPlanOpen}
        onOpenChange={setIsTreatmentPlanOpen}
        appointment={activeConsultation}
        defaultTab={treatmentPlanTab}
        doctorId={selectedDoctorId}
        currentDoctor={data.currentDoctor}
        onSuccess={() => {
          refreshData(selectedDate);
        }}
      />

      {/* 7. Official Clinical Prescription & Assessment A4 Print Modal */}
      <DoctorPrescriptionDialog
        isOpen={Boolean(prescriptionPrintData)}
        onOpenChange={(open) => {
          if (!open) setPrescriptionPrintData(null);
        }}
        data={prescriptionPrintData}
      />

      {/* 8. New Medication Prescription Modal */}
      <NewPrescriptionDialog
        isOpen={isNewPrescriptionOpen}
        onOpenChange={setIsNewPrescriptionOpen}
        patient={activeConsultation?.patient || null}
        doctorId={selectedDoctorId}
        doctorName={data.currentDoctor?.name || "Doctor"}
        appointmentId={activeConsultation?.id}
        onSuccess={() => refreshData(selectedDate)}
      />

      {/* 9. Old Prescriptions History Modal */}
      <OldPrescriptionsDialog
        isOpen={isOldPrescriptionsOpen}
        onOpenChange={setIsOldPrescriptionsOpen}
        patient={activeConsultation?.patient || null}
        onNewPrescriptionRequested={() => setIsNewPrescriptionOpen(true)}
      />
    </div>
  );
}
