"use client";

import * as React from "react";
import {
  type DoctorDashboardData,
  getDoctorDashboardDataAction,
} from "@/actions/doctor/doctor.action";
import {
  updateAppointmentStatusAction,
  switchQueueAction,
  type PatientWithCount,
} from "@/actions/receptionist/appointment.action";
import {
  AppointmentStatus,
  QueueType,
  Role,
  RoomAccessType,
} from "@/generated/prisma/enums";
import { DoctorHeader } from "@/components/doctor/doctor-header";
import { DoctorQueueCard } from "@/components/doctor/doctor-queue-card";
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
} from "lucide-react";
import { useRealtimeEvents } from "@/hooks/use-realtime-events";
import { toast } from "sonner";
import { formatTime12h } from "@/lib/queue-punctuality";
import { SendPatientDialog } from "@/components/doctor/send-patient-dialog";
import { TreatmentPlanDialog } from "@/components/doctor/treatment/treatment-plan-dialog";

interface DoctorDashboardViewProps {
  initialData: DoctorDashboardData;
  currentUserRole?: Role;
}

export function DoctorDashboardView({
  initialData,
  currentUserRole,
}: DoctorDashboardViewProps) {
  const [data, setData] = React.useState<DoctorDashboardData>(initialData);
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

  // Selected Doctor Performer & Chamber Room
  const selectedDoctorId = React.useMemo(() => {
    return (
      initialData.currentDoctor?.id || initialData.doctorPerformers[0]?.id || ""
    );
  }, [initialData.currentDoctor, initialData.doctorPerformers]);

  // Strictly default to first doctor consultation chamber
  const selectedRoomId = React.useMemo(() => {
    const consultationRoom = data.rooms.find((r) => {
      return (
        r.accessType === RoomAccessType.DOCTOR ||
        r.purpose?.toLowerCase().includes("consultation")
      );
    });
    return consultationRoom?.id || "";
  }, [data.rooms]);

  const selectedRoom = React.useMemo(() => {
    return data.rooms.find((r) => r.id === selectedRoomId);
  }, [data.rooms, selectedRoomId]);

  // Search filter
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isFinishingSession, setIsFinishingSession] = React.useState(false);

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
      if (
        event.type === "APPOINTMENT_CREATED" ||
        event.type === "APPOINTMENT_UPDATED" ||
        event.type === "APPOINTMENT_CANCELLED" ||
        event.type === "PATIENT_CREATED" ||
        event.type === "DOCTOR_CALLED" ||
        event.type === "SLOT_UPDATED"
      ) {
        refreshData(selectedDateRef.current);
      }
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
        selectedDoctorId,
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
        selectedDoctorId,
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

  // Active consultation patient (if currently in session)
  const activeConsultation = data.activeConsultation;
  const callingAppointment = data.callingAppointment;

  // Mark Calling Patient in Consultation when patient enters the chamber
  const handleStartCallingConsultation = async () => {
    if (!callingAppointment) return;
    setIsFinishingSession(true);
    try {
      const res = await updateAppointmentStatusAction(
        callingAppointment.id,
        AppointmentStatus.IN_CONSULTATION,
        selectedDoctorId,
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

  // Complete Active Consultation Session
  const handleCompleteActiveSession = async () => {
    if (!activeConsultation) return;
    setIsFinishingSession(true);
    try {
      const res = await updateAppointmentStatusAction(
        activeConsultation.id,
        AppointmentStatus.COMPLETED,
        selectedDoctorId,
        QueueType.CONSULTATION,
      );
      if (res.success) {
        toast.success(
          `Consultation completed for ${activeConsultation.patient?.name}.`,
        );
        refreshData(selectedDate);
      } else {
        toast.error(res.message);
      }
    } finally {
      setIsFinishingSession(false);
    }
  };

  // Transfer Active Consultation to Therapy
  const handleTransferActiveToTherapy = async () => {
    if (!activeConsultation) return;
    setIsFinishingSession(true);
    try {
      const res = await switchQueueAction(
        activeConsultation.id,
        QueueType.THERAPY,
        selectedDoctorId,
      );
      if (res.success) {
        toast.success(
          `${activeConsultation.patient?.name} transferred to Therapy Queue.`,
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
                    Mark In Consultation.
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

        {/* Top Control Bar: Search & Counts */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-card/60 backdrop-blur-xl p-2 px-3 rounded-xl border border-border/80 shadow-xs">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by patient name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-7.5 text-xs rounded-lg bg-background border-border/80 focus-visible:ring-sky-500"
            />
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground flex-wrap">
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-700 dark:text-sky-300 font-bold text-[11px]">
              <Stethoscope className="size-3" />
              <span>Consultation Waiting: {data.consultationQueue.length}</span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold text-[11px]">
              <CheckCircle2 className="size-3" />
              <span>Completed: {data.completedConsultations.length}</span>
            </div>

            {data.pendingExtraSlots.length > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 font-bold text-[11px] animate-pulse">
                <AlertCircle className="size-3" />
                <span>Extra Requests: {data.pendingExtraSlots.length}</span>
              </div>
            )}
          </div>
        </div>

        {/* Tabs for Doctor Navigation */}
        <Tabs defaultValue="consultation" className="w-full space-y-2.5">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2.5 pb-1 border-b border-border/50">
            <div className="flex flex-wrap items-center gap-2">
              <DashboardDateSelector
                selectedDate={selectedDate}
                dayOfWeek={data.dayOfWeek}
                onSelectDate={handleSelectDate}
                onRefresh={() => refreshData(selectedDate)}
                isRefreshing={isPending}
              />

              <TabsList className="bg-muted/50 p-0.5 rounded-lg h-8.5 border border-border/60 flex-wrap">
                <TabsTrigger
                  value="consultation"
                  className="rounded-md text-xs font-bold gap-1 px-3 py-1 data-[state=active]:bg-background data-[state=active]:shadow-xs cursor-pointer"
                >
                  <Stethoscope className="size-3 text-sky-500" />
                  <span>Consultation Queue</span>
                  <span className="ml-1 px-1.5 py-0.2 rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-300 text-[10px] font-mono">
                    {data.consultationQueue.length}
                  </span>
                </TabsTrigger>

                <TabsTrigger
                  value="therapy"
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
                  value="extra-slots"
                  className="rounded-md text-xs font-bold gap-1 px-3 py-1 data-[state=active]:bg-background data-[state=active]:shadow-xs cursor-pointer"
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
                  className="rounded-md text-xs font-bold gap-1 px-3 py-1 data-[state=active]:bg-background data-[state=active]:shadow-xs cursor-pointer"
                >
                  <CheckCircle2 className="size-3 text-primary" />
                  <span>Today&apos;s Completed</span>
                  <span className="ml-1 px-1.5 py-0.2 rounded-full bg-primary/15 text-primary text-[10px] font-mono">
                    {data.completedConsultations.length}
                  </span>
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
                    selectedRoomId={selectedRoomId}
                    selectedRoomNumber={selectedRoom?.number}
                    rooms={data.rooms}
                    doctors={data.doctorPerformers}
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
                  <DoctorQueueCard
                    key={appointment.id}
                    appointment={appointment}
                    performerId={selectedDoctorId}
                    selectedRoomId={selectedRoomId}
                    selectedRoomNumber={selectedRoom?.number}
                    rooms={data.rooms}
                    doctors={data.doctorPerformers}
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
              onSelectDate={handleSelectDate}
              onBookSlot={handleBookSlot}
              onCheckIn={handleCheckIn}
              onCancelAppointment={handleCancelAppointment}
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
        onSuccess={() => refreshData(selectedDate)}
        onComplete={handleCompleteActiveSession}
        onTransferToTherapy={handleTransferActiveToTherapy}
      />

      {/* 6. Treatment Plan Dialog */}
      <TreatmentPlanDialog
        isOpen={isTreatmentPlanOpen}
        onOpenChange={setIsTreatmentPlanOpen}
        appointment={activeConsultation}
        defaultTab={treatmentPlanTab}
        doctorId={selectedDoctorId}
        doctors={data.doctorPerformers}
        onSuccess={() => {
          refreshData(selectedDate);
        }}
      />
    </div>
  );
}
