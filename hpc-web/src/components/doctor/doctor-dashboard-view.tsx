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
  User,
  UserPlus,
  FileText,
  Sparkles,
} from "lucide-react";
import { useRealtimeEvents } from "@/hooks/use-realtime-events";
import { toast } from "sonner";
import { formatTime12h } from "@/lib/queue-punctuality";
import { PatientJourneyTrackerView } from "@/components/tracking/patient-journey-tracker-view";
import { SendPatientDialog } from "@/components/doctor/send-patient-dialog";
import { TreatmentPlanDialog } from "@/components/doctor/treatment/treatment-plan-dialog";
import { ClinicChatView } from "@/components/chat/clinic-chat-view";
import { ModalityTimersWidget } from "@/components/handler/modality-timers-widget";
import { useChatNotifications } from "@/hooks/use-chat-notifications";
import { playChatChime, showPersistentRealtimeAlert } from "@/lib/chat-chime";
import {
  DoctorPrescriptionDialog,
  type DoctorPrescriptionData,
} from "@/components/print/doctor-prescription-dialog";
import { NewPrescriptionDialog } from "@/components/doctor/prescription/new-prescription-dialog";
import { OldPrescriptionsDialog } from "@/components/doctor/prescription/old-prescriptions-dialog";
import { PatientNotesTriggerButton } from "@/components/notes/patient-notes-dialog";
import { DirectAddToDoctorQueueDialog } from "@/components/doctor/direct-add-to-doctor-queue-dialog";

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
  const [selectedClinicalAppointment, setSelectedClinicalAppointment] =
    React.useState<any | null>(null);
  const [isDirectAddToDoctorQueueOpen, setIsDirectAddToDoctorQueueOpen] =
    React.useState(false);
  const [directAddPreselectedPatient, setDirectAddPreselectedPatient] =
    React.useState<any | null>(null);


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
          showPersistentRealtimeAlert({
            title: `New Patient in Consultation Queue: ${event.data?.patientName || "Patient"}`,
            description: `Serial #${event.data?.serialNumber || ""} • Room: ${event.data?.roomNumber || "Cabin"}`,
            isUrgent: false,
            id: `queue-consult-${event.data?.serialId || Date.now()}`,
          });
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

  // Running Therapy Appointments (all active therapy sessions: on bed, calling, or checked in today)
  const runningTherapyAppointments = React.useMemo(() => {
    return data.appointments.filter(
      (a) =>
        a.status === AppointmentStatus.IN_THERAPY ||
        (a.queueType === QueueType.THERAPY &&
          (a.status === AppointmentStatus.CALLING ||
            a.status === AppointmentStatus.CHECKED_IN)),
    );
  }, [data.appointments]);

  const inTherapyAppointments = React.useMemo(() => {
    return runningTherapyAppointments.filter(
      (a) => a.status === AppointmentStatus.IN_THERAPY,
    );
  }, [runningTherapyAppointments]);

  const filteredRunningTherapy = React.useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return runningTherapyAppointments.filter((item) => {
      if (!q) return true;
      const name = (item.patient?.name || "").toLowerCase();
      const phone = (item.patient?.phone || "").toLowerCase();
      const mrn = (item.patient?.mrn || "").toLowerCase();
      return name.includes(q) || phone.includes(q) || mrn.includes(q);
    });
  }, [runningTherapyAppointments, searchQuery]);

  // Clinical action handlers for running therapy & active consultation
  const handleOpenNewPrescription = (appointment: any) => {
    setSelectedClinicalAppointment(appointment);
    setSelectedHistoryPatient(appointment?.patient || null);
    setIsNewPrescriptionOpen(true);
  };

  const handleOpenOldPrescriptions = (appointment: any) => {
    setSelectedClinicalAppointment(appointment);
    setSelectedHistoryPatient(appointment?.patient || null);
    setIsOldPrescriptionsOpen(true);
  };

  const handleOpenMedicalHistory = (appointment: any) => {
    setSelectedClinicalAppointment(appointment);
    setSelectedHistoryPatient(appointment?.patient || null);
    setIsHistoryOpen(true);
  };

  const handleOpenCreateRecord = (appointment: any) => {
    setSelectedClinicalAppointment(appointment);
    setSelectedHistoryPatient(appointment?.patient || null);
    setIsCreateRecordOpen(true);
  };

  const handleOpenTreatmentPlan = (
    appointment: any,
    tab: "today" | "next" = "today",
  ) => {
    setSelectedClinicalAppointment(appointment);
    setSelectedHistoryPatient(appointment?.patient || null);
    setTreatmentPlanTab(tab);
    setIsTreatmentPlanOpen(true);
  };

  const handleOpenSendPatient = (appointment: any) => {
    setSelectedClinicalAppointment(appointment);
    setSelectedHistoryPatient(appointment?.patient || null);
    setIsSendPatientOpen(true);
  };

  const handlePrintReport = (appointment: any) => {
    if (!appointment?.patient) return;
    const plan = data.todayPlansByPatientId?.[appointment.patientId];
    setPrescriptionPrintData({
      patient: appointment.patient,
      doctor: data.currentDoctor,
      treatmentPlans: plan?.modalities || [],
      notes: plan?.instructions || undefined,
    });
  };

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
                      notes: plan?.instructions || undefined,
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-1.5 w-full min-w-0">
            <div className="overflow-x-auto scrollbar-none min-w-0 flex-1">
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
                  value="completed"
                  className="rounded-md text-xs font-bold gap-1 px-3 py-1 data-[state=active]:bg-background data-[state=active]:shadow-xs cursor-pointer shrink-0 whitespace-nowrap"
                >
                  <CheckCircle2 className="size-3 text-primary" />
                  <span>Completed</span>
                  <span className="ml-1 px-1.5 py-0.2 rounded-full bg-primary/15 text-primary text-[10px] font-mono">
                    {data.completedConsultations.length}
                  </span>
                </TabsTrigger>

                <TabsTrigger
                  value="running-therapy"
                  className="rounded-md text-xs font-bold gap-1 px-3 py-1 data-[state=active]:bg-background data-[state=active]:shadow-xs cursor-pointer shrink-0 whitespace-nowrap"
                >
                  <Activity className="size-3 text-emerald-500" />
                  <span>Running Therapy</span>
                  <span className="ml-1 px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-mono">
                    {runningTherapyAppointments.length}
                  </span>
                </TabsTrigger>

                <TabsTrigger
                  value="tracking"
                  className="rounded-md text-xs font-bold gap-1 px-3 py-1 data-[state=active]:bg-background data-[state=active]:shadow-xs cursor-pointer shrink-0 whitespace-nowrap"
                >
                  <Compass className="size-3 text-indigo-500" />
                  <span>Journey</span>
                </TabsTrigger>

                <TabsTrigger
                  value="patients"
                  className="rounded-md text-xs font-bold gap-1 px-3 py-1 data-[state=active]:bg-background data-[state=active]:shadow-xs cursor-pointer shrink-0 whitespace-nowrap"
                >
                  <Users className="size-3 text-indigo-500" />
                  <span>Patients</span>
                  <span className="ml-1 px-1.5 py-0.2 rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 text-[10px] font-mono">
                    {data.patients.length}
                  </span>
                </TabsTrigger>

                <TabsTrigger
                  value="extra-slots"
                  className="rounded-md text-xs font-bold gap-1 px-3 py-1 data-[state=active]:bg-background data-[state=active]:shadow-xs cursor-pointer shrink-0 whitespace-nowrap"
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
                  value="chat"
                  className="rounded-md text-xs font-bold gap-1 px-3 py-1 data-[state=active]:bg-background data-[state=active]:shadow-xs cursor-pointer shrink-0 whitespace-nowrap"
                >
                  <MessageSquare className="size-3 text-primary" />
                  <span>Chat</span>
                  {unreadChatCount > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-bold font-mono animate-pulse shadow-xs">
                      {unreadChatCount}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                size="sm"
                onClick={() => {
                  setDirectAddPreselectedPatient(null);
                  setIsDirectAddToDoctorQueueOpen(true);
                }}
                className="h-8 px-2.5 sm:px-3 text-xs font-bold gap-1.5 bg-sky-600 hover:bg-sky-700 text-white cursor-pointer shadow-xs"
              >
                <Stethoscope className="size-3.5" />
                <span>+ Add to Queue</span>
              </Button>
            </div>
          </div>

          {/* 1. Consultation Queue Tab */}
          <TabsContent value="consultation" className="space-y-2 outline-none">
            {filteredConsultationQueue.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/80 bg-muted/10 p-5 text-center space-y-2">
                <div className="size-8 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center mx-auto border border-sky-500/20">
                  <Stethoscope className="size-4" />
                </div>
                <h3 className="text-xs font-bold text-foreground">
                  Consultation Queue is Clear
                </h3>
                <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                  No patients are waiting in the Doctor Consultation Queue right
                  now. You can add any patient directly to your queue at any time.
                </p>
                <Button
                  size="sm"
                  onClick={() => {
                    setDirectAddPreselectedPatient(null);
                    setIsDirectAddToDoctorQueueOpen(true);
                  }}
                  className="h-7.5 px-3 text-xs font-bold gap-1.5 bg-sky-600 hover:bg-sky-700 text-white cursor-pointer shadow-xs mt-1"
                >
                  <UserPlus className="size-3" />
                  <span>+ Add Patient to Queue</span>
                </Button>
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

          {/* 2. Running Therapy Tab */}
          <TabsContent value="running-therapy" className="space-y-3 outline-none">
            {/* Active Performing Beds Quick Bar */}
            {inTherapyAppointments.length > 0 && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-gradient-to-r from-emerald-500/15 via-emerald-500/5 to-sky-500/10 border border-emerald-500/30 overflow-x-auto shadow-2xs">
                <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider shrink-0 flex items-center gap-1.5">
                  <Activity className="size-3.5 text-emerald-600 animate-pulse" />
                  <span>Currently Performing Beds ({inTherapyAppointments.length}):</span>
                </span>
                {inTherapyAppointments.map((b) => {
                  const roomNum = b.room?.number || b.therapySlot?.room?.number || "Bed";
                  const timer = data.activeTherapyTimersByAppointmentId?.[b.id];
                  const currMod = timer?.modalities?.[timer?.currentStepIndex]?.name;
                  return (
                    <div
                      key={b.id}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 text-white border border-emerald-700 shadow-2xs flex items-center gap-1.5 shrink-0"
                    >
                      <DoorOpen className="size-3" />
                      <span>Room {roomNum}:</span>
                      <span className="font-normal opacity-95">{b.patient?.name}</span>
                      {currMod && (
                        <span className="text-[10px] font-mono bg-black/25 px-1.5 py-0.2 rounded font-bold">
                          • {currMod}
                        </span>
                      )}
                      <span className="size-1.5 rounded-full bg-white animate-pulse" />
                    </div>
                  );
                })}
              </div>
            )}
            {filteredRunningTherapy.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/80 bg-muted/10 p-8 text-center space-y-2">
                <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
                  <Activity className="size-5" />
                </div>
                <h3 className="text-sm font-bold text-foreground">
                  No Active Therapy Sessions Running
                </h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Patients receiving physical therapy on bed or waiting in the therapy queue will appear here in real-time. You can view their modalities, add prescriptions, and manage treatment plans directly.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {filteredRunningTherapy.map((apt) => {
                  const plan = data.todayPlansByPatientId?.[apt.patientId];
                  const modalities = (plan?.modalityItems && plan.modalityItems.length > 0)
                    ? plan.modalityItems
                    : (plan?.modalities && plan.modalities.length > 0)
                      ? plan.modalities.map((m: any, idx: number) =>
                          typeof m === "string"
                            ? { name: m, durationMinutes: 15, order: idx + 1 }
                            : { name: m.name || `Modality ${idx + 1}`, durationMinutes: m.durationMinutes || 15, order: m.order || idx + 1 }
                        )
                      : [];

                  const isOnBed = apt.status === AppointmentStatus.IN_THERAPY;
                  const isCalling = apt.status === AppointmentStatus.CALLING;

                  return (
                    <div
                      key={apt.id}
                      className={`rounded-xl border bg-card/80 backdrop-blur-xs p-3.5 space-y-3 transition-all shadow-xs ${
                        isOnBed
                          ? "border-emerald-500/40 ring-1 ring-emerald-500/20 shadow-emerald-500/5"
                          : isCalling
                          ? "border-sky-500/40 ring-1 ring-sky-500/20"
                          : "border-border/80 hover:border-border"
                      }`}
                    >
                      {/* Top Header: Patient identity & Status */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-foreground">
                              {apt.patient?.name || "Patient"}
                            </span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${
                                apt.gender === "MALE"
                                  ? "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20"
                                  : "bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/20"
                              }`}
                            >
                              {apt.gender === "MALE" ? "Male" : "Female"}
                              {apt.patient?.age ? ` • ${apt.patient.age}y` : ""}
                            </span>
                            {apt.patient?.mrn && (
                              <span className="font-mono text-[11px] text-muted-foreground bg-muted/40 px-1.5 py-0.2 rounded border border-border/50">
                                {apt.patient.mrn}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                            {apt.patient?.phone && (
                              <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                                <Phone className="size-3" />
                                {apt.patient.phone}
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1">
                              <DoorOpen className="size-3 text-primary" />
                              <strong className="text-foreground">
                                {apt.room?.number
                                  ? `Room ${apt.room.number}`
                                  : apt.therapySlot?.room?.number
                                  ? `Room ${apt.therapySlot.room.number}`
                                  : "Therapy Floor"}
                              </strong>
                            </span>
                            {apt.performer?.name && (
                              <span className="inline-flex items-center gap-1 text-[11px]">
                                <User className="size-3 text-muted-foreground" />
                                <span>Handler: {apt.performer.name}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div>
                          {isOnBed ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[10.5px] font-bold animate-pulse">
                              <span className="size-1.5 rounded-full bg-emerald-500" />
                              <span>On Bed • In Therapy</span>
                            </span>
                          ) : isCalling ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30 text-[10.5px] font-bold">
                              <Clock className="size-3" />
                              <span>Calling to Bed</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[10.5px] font-bold">
                              <Clock className="size-3" />
                              <span>Waiting in Queue</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Middle: Currently Running Therapy by Handler vs Standby Modalities */}
                      {isOnBed ? (
                        <div className="space-y-2">
                          <ModalityTimersWidget
                            appointmentId={apt.id}
                            patientId={apt.patientId}
                            bedNumber={apt.room?.number ? `Room ${apt.room.number}` : "Bed"}
                            roomNumber={apt.room?.number || apt.therapySlot?.room?.number}
                            handlers={data.handlerPerformers}
                            isDoctorView={true}
                            doctorId={selectedDoctorId}
                            initialTimerState={data.activeTherapyTimersByAppointmentId?.[apt.id]}
                            initialModalityItems={modalities}
                          />

                          {plan?.instructions && (
                            <p className="text-[10.5px] text-muted-foreground p-2 rounded-lg bg-muted/40 border border-border/60">
                              <strong className="text-foreground">Specialist Protocol Instructions:</strong> {plan.instructions}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="rounded-lg bg-muted/30 border border-border/60 p-2.5 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
                              <Activity className="size-3 text-emerald-500" />
                              <span>Prescribed Modalities &amp; Treatment Plan</span>
                            </span>
                            {apt.inTherapyTime ? (
                              <span className="text-[10px] font-mono text-muted-foreground">
                                Started: {formatTime12h(apt.inTherapyTime)}
                              </span>
                            ) : (
                              <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 font-bold">
                                Standby in Queue
                              </span>
                            )}
                          </div>

                          {modalities.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                              {modalities.map((m: any, idx: number) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-background border border-emerald-500/30 text-foreground text-[11px] font-medium shadow-2xs"
                                >
                                  <span className="size-1.5 rounded-full bg-emerald-500" />
                                  <span>{m.name}</span>
                                  {m.durationMinutes && (
                                    <span className="text-[9.5px] font-mono text-muted-foreground">
                                      ({m.durationMinutes}m)
                                    </span>
                                  )}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <div className="flex items-center justify-between text-xs text-muted-foreground py-0.5">
                              <span className="text-[11px] italic">No active modalities prescribed yet for today.</span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleOpenTreatmentPlan(apt, "today")}
                                className="h-6 px-2 text-[10px] font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 cursor-pointer"
                              >
                                + Prescribe Today&apos;s Plan
                              </Button>
                            </div>
                          )}

                          {plan?.instructions && (
                            <p className="text-[10.5px] text-muted-foreground line-clamp-1 border-t border-border/40 pt-1">
                              <strong className="text-foreground">Instructions:</strong> {plan.instructions}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Bottom Clinical Actions: Prescriptions, Files, Plans, Notes, Routing */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/50">
                        {/* New Prescription */}
                        <Button
                          size="sm"
                          onClick={() => handleOpenNewPrescription(apt)}
                          title="Prescribe new medications with master directory"
                          className="h-7 px-2.5 rounded-lg font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer gap-1"
                        >
                          <Pill className="size-3" />
                          <span>New Prescription</span>
                        </Button>

                        {/* Old Prescriptions */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenOldPrescriptions(apt)}
                          title="View patient previous prescriptions"
                          className="h-7 px-2 rounded-lg font-semibold text-xs border-indigo-500/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/10 cursor-pointer gap-1"
                        >
                          <FileText className="size-3" />
                          <span>Old Prescriptions</span>
                        </Button>

                        {/* View Files */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenMedicalHistory(apt)}
                          title="View clinical history & past assessment files"
                          className="h-7 px-2 rounded-lg font-semibold text-xs border-sky-500/30 text-sky-700 dark:text-sky-300 hover:bg-sky-500/10 cursor-pointer gap-1"
                        >
                          <FolderOpen className="size-3" />
                          <span>View Files</span>
                        </Button>

                        {/* Upload File */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenCreateRecord(apt)}
                          title="Upload new assessment file or clinical document"
                          className="h-7 px-2 rounded-lg font-semibold text-xs border-sky-500/30 text-sky-700 dark:text-sky-300 hover:bg-sky-500/10 cursor-pointer gap-1"
                        >
                          <FilePlus2 className="size-3" />
                          <span>Upload File</span>
                        </Button>

                        {/* Today's Plan */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenTreatmentPlan(apt, "today")}
                          title="Prescribe or review today's therapy plan"
                          className="h-7 px-2 rounded-lg font-semibold text-xs border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 cursor-pointer gap-1"
                        >
                          <Activity className="size-3" />
                          <span>Today&apos;s Plan</span>
                        </Button>

                        {/* Next Plan */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenTreatmentPlan(apt, "next")}
                          title="Prescribe next session treatment recommendations"
                          className="h-7 px-2 rounded-lg font-semibold text-xs border-purple-500/30 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10 cursor-pointer gap-1"
                        >
                          <CalendarCheck2 className="size-3" />
                          <span>Next Plan</span>
                        </Button>

                        {/* Patient Clinical Notes */}
                        <PatientNotesTriggerButton
                          patientId={apt.patientId}
                          patientName={apt.patient?.name || "Patient"}
                          patientMrn={apt.patient?.mrn}
                          appointmentId={apt.id}
                          defaultCategory="DOCTOR"
                          currentUserRole="DOCTOR"
                          currentUserName={data.currentDoctor?.name || "Doctor"}
                          currentUserId={selectedDoctorId}
                          currentStation={
                            apt.room?.number
                              ? `Room ${apt.room.number}`
                              : "Therapy Floor"
                          }
                          className="h-7 px-2 text-xs font-semibold border-purple-500/40 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10 cursor-pointer gap-1"
                        />

                        {/* Print Report */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePrintReport(apt)}
                          title="Print official clinical report & prescription"
                          className="h-7 px-2 rounded-lg font-semibold text-xs border-border/80 text-foreground hover:bg-muted cursor-pointer gap-1"
                        >
                          <Printer className="size-3" />
                          <span>Print</span>
                        </Button>

                        {/* Send Patient */}
                        <Button
                          size="sm"
                          onClick={() => handleOpenSendPatient(apt)}
                          className="h-7 px-2.5 rounded-lg font-bold text-xs bg-sky-600 hover:bg-sky-700 text-white shadow-xs cursor-pointer gap-1 ml-auto"
                        >
                          <Send className="size-3" />
                          <span>Send Patient</span>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
              onAddToDoctorQueue={(patient) => {
                setDirectAddPreselectedPatient(patient);
                setIsDirectAddToDoctorQueueOpen(true);
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
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[580px] text-left border-collapse text-xs">
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
                            {a.room?.number && a.room.number !== "200"
                              ? `R${a.room.number}`
                              : "Chamber"}
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
                                  const plan = data.todayPlansByPatientId?.[a.patientId];
                                  setPrescriptionPrintData({
                                    patient: a.patient,
                                    doctor: a.doctor || data.currentDoctor,
                                    treatmentPlans: plan?.modalities || [],
                                    notes: plan?.instructions || undefined,
                                  });
                                }}
                                className="h-6 px-2 text-[10.5px] font-semibold gap-1 text-sky-700 dark:text-sky-300 border-sky-500/30 hover:bg-sky-500/10 cursor-pointer"
                                title="Print A4 Clinical Assessment & Prescription"
                              >
                                <Printer className="size-2.5" />
                                <span>A4 Report</span>
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
        onOpenChange={(open) => {
          setIsCreateRecordOpen(open);
          if (!open) setSelectedClinicalAppointment(null);
        }}
        appointment={selectedClinicalAppointment || activeConsultation}
        doctorId={selectedDoctorId}
        onSuccess={() => {
          refreshData(selectedDate);
          toast.success("Medical assessment recorded successfully.");
        }}
      />

      <PatientMedicalHistoryDialog
        isOpen={isHistoryOpen}
        onOpenChange={(open) => {
          setIsHistoryOpen(open);
          if (!open) {
            setSelectedHistoryPatient(null);
            setSelectedClinicalAppointment(null);
          }
        }}
        patient={selectedHistoryPatient || (selectedClinicalAppointment || activeConsultation)?.patient || null}
        onNewRecordRequested={() => setIsCreateRecordOpen(true)}
      />

      {/* 5. Send Patient Routing Dialog */}
      <SendPatientDialog
        isOpen={isSendPatientOpen}
        onOpenChange={(open) => {
          setIsSendPatientOpen(open);
          if (!open) setSelectedClinicalAppointment(null);
        }}
        appointment={selectedClinicalAppointment || activeConsultation}
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
        onOpenChange={(open) => {
          setIsTreatmentPlanOpen(open);
          if (!open) setSelectedClinicalAppointment(null);
        }}
        appointment={selectedClinicalAppointment || activeConsultation}
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
        onOpenChange={(open) => {
          setIsNewPrescriptionOpen(open);
          if (!open) {
            setSelectedClinicalAppointment(null);
            setSelectedHistoryPatient(null);
          }
        }}
        patient={(selectedClinicalAppointment || activeConsultation)?.patient || selectedHistoryPatient || null}
        doctorId={selectedDoctorId}
        doctorName={data.currentDoctor?.name || "Doctor"}
        appointmentId={(selectedClinicalAppointment || activeConsultation)?.id}
        onSuccess={() => refreshData(selectedDate)}
      />

      {/* 9. Old Prescriptions History Modal */}
      <OldPrescriptionsDialog
        isOpen={isOldPrescriptionsOpen}
        onOpenChange={(open) => {
          setIsOldPrescriptionsOpen(open);
          if (!open) {
            setSelectedClinicalAppointment(null);
            setSelectedHistoryPatient(null);
          }
        }}
        patient={(selectedClinicalAppointment || activeConsultation)?.patient || selectedHistoryPatient || null}
        onNewPrescriptionRequested={() => setIsNewPrescriptionOpen(true)}
      />

      {/* 10. Direct Add to Doctor Consultation Queue Modal */}
      <DirectAddToDoctorQueueDialog
        isOpen={isDirectAddToDoctorQueueOpen}
        onOpenChange={setIsDirectAddToDoctorQueueOpen}
        preselectedPatient={directAddPreselectedPatient}
        doctors={data.doctorPerformers.map((doc: any) => ({
          id: doc.id,
          name: doc.name,
          consultationFee: doc.consultationFee ?? 1000,
          consultationRoomId: doc.consultationRoomId,
          consultationRoom: doc.consultationRoom,
        }))}
        defaultDoctorId={selectedDoctorId}
        onSuccess={() => refreshData(selectedDate)}
        onOpenCreatePatient={() => setIsNewPatientOpen(true)}
      />
    </div>
  );
}
