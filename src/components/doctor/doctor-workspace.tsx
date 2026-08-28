"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { useRealtime } from "@/hooks/use-realtime";
import {
  getDoctorQueue,
  callSerial,
  updateSerialStatus,
  assignToHandlerWithPlan,
} from "@/actions/serials";
import { saveClinicalAssessment } from "@/actions/assessments";
import { formatBSTTime } from "@/lib/date";
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
import { useI18n } from "@/lib/i18n";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Users,
  Clock,
  PhoneCall,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Stethoscope,
  FileCheck,
  Sparkles,
  RefreshCw,
  Send,
  HeartPulse,
} from "lucide-react";
import {
  SerialStatus,
  PainSide,
  PainType,
  RomStatus,
} from "@/generated/prisma/enums";
import { getAllRoomsWithOccupancy } from "@/actions/rooms";
import { RoomSelect } from "@/components/rooms/room-select";

interface DoctorWorkspaceProps {
  initialQueue: Awaited<ReturnType<typeof getDoctorQueue>>;
  doctorId: string;
}

const COMMON_MODALITIES = [
  "SWD (20 mins)",
  "UST (10 mins)",
  "IFT (20 mins)",
  "TENS (15 mins)",
  "Cervical Traction (15 mins)",
  "Lumbar Traction (15 mins)",
  "Therapeutic Massage & Manipulation",
  "Hot Moist Pack (15 mins)",
  "Cryotherapy / Cold Compression",
  "Strengthening & Mobilization Exercises",
];

type DoctorQueueItem = NonNullable<
  Awaited<ReturnType<typeof getDoctorQueue>>
>[number];

export function DoctorWorkspace({
  doctorId,
  initialQueue,
}: DoctorWorkspaceProps) {
  const { t } = useI18n();
  const [queue, setQueue] = useState(initialQueue);
  const [selectedSerial, setSelectedSerial] = useState<DoctorQueueItem | null>(
    null,
  );
  const [isExamOpen, setIsExamOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Route to Handler Modal State
  const [isRouteHandlerOpen, setIsRouteHandlerOpen] = useState(false);
  const [routeSerial, setRouteSerial] = useState<DoctorQueueItem | null>(null);
  const [prescribedPlan, setPrescribedPlan] = useState(
    "SWD (20 mins), UST (10 mins), IFT (20 mins), Manual Therapy",
  );
  const [selectedBay, setSelectedBay] = useState("207");
  const [roomsData, setRoomsData] = useState<Awaited<
    ReturnType<typeof getAllRoomsWithOccupancy>
  > | null>(null);
  const [routeError, setRouteError] = useState("");

  // Clinical Assessment Form State (Matching Page 1 of PDF 2)
  const [examForm, setExamForm] = useState<{
    painArea: string;
    side: PainSide;
    duration: string;
    painType: PainType;
    vasScore: number;
    painIncreasesWith: string;
    painReducesWith: string;
    hasInjury: boolean;
    hasSurgery: boolean;
    postureAdviceGiven: boolean;
    previousTreatment: string;
    difficultyIn: string;
    rom: RomStatus;
    hasMuscleSpasm: boolean;
    hasTenderness: boolean;
    hasSwelling: boolean;
    diagnosis: string;
    prescribedModalities: string;
    exerciseExplained: boolean;
    homePostureAdvice: boolean;
    postTreatmentVas: number;
    improvement: string;
    clinicalNotes: string;
  }>({
    painArea: "Back",
    side: PainSide.BOTH,
    duration: "2 weeks",
    painType: PainType.DULL,
    vasScore: 6,
    painIncreasesWith: "Sitting, Bending",
    painReducesWith: "Rest, Heat",
    hasInjury: false,
    hasSurgery: false,
    postureAdviceGiven: true,
    previousTreatment: "Medicine",
    difficultyIn: "Bending, Sitting",
    rom: RomStatus.RESTRICTED,
    hasMuscleSpasm: true,
    hasTenderness: true,
    hasSwelling: false,
    diagnosis: "Chronic Lumbar Spondylosis with Muscle Spasm",
    prescribedModalities: "SWD (20m), UST (10m), IFT (20m), Manual Therapy",
    exerciseExplained: true,
    homePostureAdvice: true,
    postTreatmentVas: 3,
    improvement: "Significant relief post electrotherapy",
    clinicalNotes: "",
  });

  const refreshData = useCallback(() => {
    startTransition(async () => {
      try {
        const [updated, rooms] = await Promise.all([
          getDoctorQueue(doctorId),
          getAllRoomsWithOccupancy(),
        ]);
        setQueue(updated);
        setRoomsData(rooms);
      } catch (err) {
        console.error("Failed to refresh doctor queue", err);
      }
    });
  }, [doctorId]);

  useEffect(() => {
    getAllRoomsWithOccupancy()
      .then(setRoomsData)
      .catch(() => {});
  }, []);

  useRealtime({
    onRefresh: refreshData,
  });

  const handleCallPatient = async (serial: DoctorQueueItem) => {
    await callSerial(
      serial.id,
      serial.roomNo || "205",
      SerialStatus.IN_CONSULTATION,
    );
    refreshData();
  };

  const handleOpenRouteToHandler = (serial: DoctorQueueItem) => {
    setRouteSerial(serial);
    setRouteError("");
    setPrescribedPlan(
      serial.assignedTreatmentPlan ||
        serial.patient.assessments?.[0]?.prescribedModalities ||
        "SWD (20 mins), UST (10 mins), IFT (20 mins)",
    );
    setSelectedBay(
      (serial.roomNo || "").replace(/[^0-9]/g, "") ||
        (serial.patient.gender === "FEMALE" ? "209" : "207"),
    );
    setIsRouteHandlerOpen(true);
  };

  const handleToggleModalityChip = (modality: string) => {
    if (prescribedPlan.includes(modality)) {
      setPrescribedPlan(
        prescribedPlan
          .replace(modality, "")
          .replace(/,\s*,/g, ",")
          .replace(/^,\s*|,\s*$/g, "")
          .trim(),
      );
    } else {
      setPrescribedPlan(
        prescribedPlan ? `${prescribedPlan}, ${modality}` : modality,
      );
    }
  };

  const handleSubmitRouteToHandler = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routeSerial) return;
    if (!prescribedPlan.trim()) {
      setRouteError("Please prescribe at least one treatment modality.");
      return;
    }

    const res = await assignToHandlerWithPlan(
      routeSerial.id,
      selectedBay,
      prescribedPlan.trim(),
    );

    if (res.error) {
      setRouteError(res.error);
      return;
    }

    setIsRouteHandlerOpen(false);
    setRouteSerial(null);
    refreshData();
  };

  const handleOpenExam = (serial: DoctorQueueItem) => {
    setSelectedSerial(serial);
    const prevExam = serial.patient.assessments?.[0];
    if (prevExam) {
      setExamForm({
        painArea: prevExam.painArea || "Back",
        side: prevExam.side || PainSide.BOTH,
        duration: prevExam.duration || "2 weeks",
        painType: prevExam.painType || PainType.DULL,
        vasScore: prevExam.vasScore ?? 6,
        painIncreasesWith: prevExam.painIncreasesWith || "",
        painReducesWith: prevExam.painReducesWith || "",
        hasInjury: !!prevExam.hasInjury,
        hasSurgery: !!prevExam.hasSurgery,
        postureAdviceGiven: !!prevExam.postureAdviceGiven,
        previousTreatment: prevExam.previousTreatment || "",
        difficultyIn: prevExam.difficultyIn || "",
        rom: prevExam.rom || RomStatus.RESTRICTED,
        hasMuscleSpasm: !!prevExam.hasMuscleSpasm,
        hasTenderness: !!prevExam.hasTenderness,
        hasSwelling: !!prevExam.hasSwelling,
        diagnosis: prevExam.diagnosis || "",
        prescribedModalities: prevExam.prescribedModalities || "",
        exerciseExplained: !!prevExam.exerciseExplained,
        homePostureAdvice: !!prevExam.homePostureAdvice,
        postTreatmentVas: prevExam.postTreatmentVas ?? 3,
        improvement: prevExam.improvement || "",
        clinicalNotes: prevExam.clinicalNotes || "",
      });
    }
    setIsExamOpen(true);
  };

  const handleSaveAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSerial) return;

    await saveClinicalAssessment({
      patientId: selectedSerial.patient.id,
      ...examForm,
    });

    setIsExamOpen(false);
    refreshData();
  };

  const handleCompleteSerial = async (serialId: string) => {
    await updateSerialStatus(serialId, SerialStatus.COMPLETED);
    refreshData();
  };

  // Metrics
  const activeConsultation = queue.find(
    (s) => s.status === SerialStatus.IN_CONSULTATION,
  );
  const waitingCount = queue.filter(
    (s) =>
      s.status === SerialStatus.WAITING || s.status === SerialStatus.CHECKED_IN,
  ).length;
  const completedCount = queue.filter(
    (s) => s.status === SerialStatus.COMPLETED,
  ).length;

  return (
    <div className="space-y-3 w-full max-w-full min-w-0">
      {/* Top Clinical Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5 min-w-0">
        <Card className="p-2 sm:p-2.5 shadow-xs border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase">
              {t("rec.scheduled_today", "Today's Patients")}
            </span>
            <Users className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-lg sm:text-xl font-black mt-0.5 font-mono text-foreground">
            {queue.length}
          </p>
          <span className="text-[9px] sm:text-[10px] text-muted-foreground block">
            {t("rec.total_registered", "Total assigned patients")}
          </span>
        </Card>

        <Card className="p-2 sm:p-2.5 shadow-xs border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase">
              {t("rec.waiting_room", "Waiting in Lounge")}
            </span>
            <Clock className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-lg sm:text-xl font-black mt-0.5 font-mono text-foreground">
            {waitingCount}
          </p>
          <span className="text-[9px] sm:text-[10px] text-muted-foreground block">
            {t("status.waiting", "Ready for consultation")}
          </span>
        </Card>

        <Card className="p-2 sm:p-2.5 shadow-xs border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase">
              {t("status.in_consultation", "Active In Chamber")}
            </span>
            <Activity className="h-3.5 w-3.5 text-primary animate-pulse" />
          </div>
          <p className="text-lg sm:text-xl font-black mt-0.5 font-mono text-primary">
            {activeConsultation
              ? `#${activeConsultation.serialNumber}`
              : "None"}
          </p>
          <span className="text-[9px] sm:text-[10px] text-muted-foreground block truncate">
            {activeConsultation?.patient.name || "Chamber available"}
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
            {t("status.completed", "Care plans issued")}
          </span>
        </Card>
      </div>

      {/* Active Consultation Spotlight Banner (Compact) */}
      {activeConsultation && (
        <Card className="p-3 sm:p-3.5 border border-primary/50 bg-primary/5 shadow-xs rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary text-primary-foreground font-black text-lg font-mono shadow-xs shrink-0">
              #{activeConsultation.serialNumber}
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-primary flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                <span>Currently In Chamber</span>
              </div>
              <h2 className="text-base font-black text-foreground leading-tight">
                {activeConsultation.patient.name}
              </h2>
              <p className="text-[11px] text-muted-foreground font-mono">
                ID: #{activeConsultation.patient.patientId} &bull;{" "}
                {activeConsultation.patient.gender} (
                {activeConsultation.patient.age || "-"}y) &bull;{" "}
                {activeConsultation.patient.phone}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              size="sm"
              onClick={() => handleOpenRouteToHandler(activeConsultation)}
              className="h-7.5 text-xs gap-1 font-bold cursor-pointer bg-primary text-primary-foreground"
            >
              <Send className="h-3 w-3" />
              <span>Send to Handler</span>
            </Button>

            <Button
              size="sm"
              onClick={() => handleOpenExam(activeConsultation)}
              variant="outline"
              className="h-7.5 text-xs gap-1 font-bold cursor-pointer"
            >
              <FileCheck className="h-3 w-3 text-primary" />
              <span>Exam Form</span>
            </Button>

            <Button
              size="sm"
              onClick={() => handleCompleteSerial(activeConsultation.id)}
              variant="outline"
              className="h-7.5 text-xs cursor-pointer"
            >
              Complete Visit
            </Button>
          </div>
        </Card>
      )}

      {/* Main Doctor Queue Table */}
      <Card className="shadow-xs border-border bg-card">
        <CardHeader className="p-3 pb-2 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xs sm:text-sm font-bold flex items-center gap-1.5">
              <Stethoscope className="h-3.5 w-3.5 text-primary" />
              <span>Doctor Queue &amp; Patient Triage</span>
            </CardTitle>
            <CardDescription className="text-[11px]">
              Review arrivals in priority order, call to chamber, or prescribe
              treatment plans.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={refreshData}
            title="Refresh Queue"
            className="h-7.5 w-7.5 cursor-pointer"
          >
            <RefreshCw
              className={`h-3 w-3 ${isPending ? "animate-spin text-primary" : ""}`}
            />
          </Button>
        </CardHeader>
        <CardContent className="p-0 px-2 sm:px-4 pb-3">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[650px]">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="pb-2 font-semibold w-12">
                    {t("col.serial", "Serial")}
                  </th>
                  <th className="pb-2 font-semibold">
                    {t("col.patient_details", "Patient Details")}
                  </th>
                  <th className="pb-2 font-semibold">
                    {t("col.told_time", "Told Time")}
                  </th>
                  <th className="pb-2 font-semibold">
                    {t("col.arrival_status", "Arrival Time")}
                  </th>
                  <th className="pb-2 font-semibold">Chief Complaint / VAS</th>
                  <th className="pb-2 font-semibold">
                    {t("col.queue_status", "Status")}
                  </th>
                  <th className="pb-2 font-semibold text-right">
                    {t("col.action", "Actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {queue.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No patients in queue for today yet.
                    </td>
                  </tr>
                ) : (
                  queue.map((s) => {
                    const latestVas = s.patient.assessments?.[0]?.vasScore;
                    return (
                      <tr
                        key={s.id}
                        className={`hover:bg-muted/30 transition-colors ${
                          s.status === SerialStatus.IN_CONSULTATION
                            ? "bg-primary/10 font-semibold"
                            : ""
                        }`}
                      >
                        <td className="py-3 font-mono font-black text-base text-primary">
                          #{s.serialNumber}
                        </td>
                        <td className="py-3">
                          <div className="font-bold text-foreground">
                            {s.patient.name}
                          </div>
                          <div className="text-[11px] text-muted-foreground font-mono">
                            ID: #{s.patient.patientId} &bull; {s.patient.gender}{" "}
                            ({s.patient.age || "-"}y)
                          </div>
                        </td>
                        <td className="py-3 font-medium text-foreground">
                          {s.toldTime
                            ? formatBSTTime(s.toldTime)
                            : s.timeSlot || "Scheduled"}
                        </td>
                        <td className="py-3">
                          {s.inTime ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono text-[11px] font-semibold text-foreground">
                                {formatBSTTime(s.inTime)}
                              </span>
                              {s.punctualityStatus === "ON_TIME" && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                  On-Time
                                </span>
                              )}
                              {s.punctualityStatus === "MODERATE_LATE" && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                  +{s.latenessMinutes}m
                                </span>
                              )}
                              {s.punctualityStatus === "SEVERE_LATE" && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-destructive/15 text-destructive border border-destructive/30">
                                  +{s.latenessMinutes}m (-5 Pos)
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-[11px] italic">
                              En route
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <span>
                              {s.patient.primaryCondition ||
                                "Pain Rehabilitation"}
                            </span>
                            {latestVas !== undefined && latestVas !== null && (
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  latestVas >= 7
                                    ? "bg-destructive/10 text-destructive border border-destructive/20"
                                    : "bg-primary/10 text-primary border border-primary/20"
                                }`}
                              >
                                VAS {latestVas}/10
                              </span>
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
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {/* Call Button */}
                            {s.status !== SerialStatus.COMPLETED &&
                              s.status !== SerialStatus.CANCELLED && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-[11px] cursor-pointer gap-1"
                                  onClick={() => handleCallPatient(s)}
                                >
                                  <PhoneCall className="h-3 w-3 text-primary" />
                                  <span>Call Chamber</span>
                                </Button>
                              )}

                            {/* Direct Route to Handler with Plan */}
                            <Button
                              size="sm"
                              variant="default"
                              className="h-7 text-[11px] cursor-pointer gap-1 bg-primary text-primary-foreground"
                              onClick={() => handleOpenRouteToHandler(s)}
                            >
                              <Send className="h-3 w-3" />
                              <span>Send to Handler</span>
                            </Button>

                            {/* Clinical Assessment Form Button */}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px] cursor-pointer gap-1"
                              onClick={() => handleOpenExam(s)}
                            >
                              <FileCheck className="h-3 w-3 text-primary" />
                              <span>Exam</span>
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

      {/* DIALOG 1: Route to Care Handler with Prescribed Treatment Plan */}
      <Dialog open={isRouteHandlerOpen} onOpenChange={setIsRouteHandlerOpen}>
        <DialogContent className="sm:max-w-lg bg-card">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <HeartPulse className="h-5 w-5 text-primary" />
              <span>Prescribe Treatment Plan &amp; Route to Handler</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Doctor must specify required physiotherapy modalities so the Care
              Handler executes the exact prescribed protocol.
            </DialogDescription>
          </DialogHeader>

          {routeSerial && (
            <div className="p-3 rounded-xl bg-muted/60 border border-border text-xs space-y-1">
              <div className="font-bold text-foreground">
                Patient: {routeSerial.patient.name} &bull;{" "}
                <span className="font-mono text-primary font-bold">
                  #{routeSerial.patient.patientId}
                </span>{" "}
                &bull; {routeSerial.patient.gender}
              </div>
              <div className="text-muted-foreground">
                Primary Complaint:{" "}
                {routeSerial.patient.primaryCondition || "Rehabilitation"}
              </div>
            </div>
          )}

          {routeError && (
            <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{routeError}</span>
            </div>
          )}

          <form onSubmit={handleSubmitRouteToHandler} className="space-y-4">
            {/* Quick Modality Selection Chips */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-primary">
                Quick Select Modalities:
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_MODALITIES.map((modality) => {
                  const isSelected = prescribedPlan.includes(modality);
                  return (
                    <button
                      type="button"
                      key={modality}
                      onClick={() => handleToggleModalityChip(modality)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary font-bold shadow-xs"
                          : "bg-muted text-muted-foreground border-border hover:text-foreground"
                      }`}
                    >
                      {isSelected ? "✓ " : "+ "}
                      {modality}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Prescribed Plan Textarea */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Doctor Prescribed Plan / Modality Instructions *
              </Label>
              <textarea
                value={prescribedPlan}
                onChange={(e) => setPrescribedPlan(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-input bg-background p-2.5 text-xs shadow-xs focus:ring-1 focus:ring-primary outline-none"
                placeholder="e.g. SWD 20m, UST 10m on lumbar area, IFT 20m channel 1-2, Therapeutic massage"
                required
              />
            </div>

            {/* Enhanced Room Selection from 201 to 220 with Multi-Patient Live Status */}
            <RoomSelect
              value={selectedBay}
              onChange={setSelectedBay}
              genderFilter={
                routeSerial?.patient?.gender === "FEMALE" ? "FEMALE" : "MALE"
              }
              roomsOccupancy={roomsData?.rooms}
              label="Assigned Therapy Chamber / Bay"
            />

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsRouteHandlerOpen(false)}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="font-bold cursor-pointer bg-primary text-primary-foreground"
              >
                Dispatch to Handler Hub
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG 2: Pain Physiotherapy Clinical Assessment Form (Matching Page 1 of PDF 2) */}
      <Dialog open={isExamOpen} onOpenChange={setIsExamOpen}>
        <DialogContent className="sm:max-w-3xl bg-card max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-primary" />
              <span>HPC Pain Physiotherapy Assessment Form</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Complete clinical diagnostic profile matching physical assessment
              sheet.
            </DialogDescription>
          </DialogHeader>

          {selectedSerial && (
            <div className="p-3 rounded-xl bg-muted/60 border border-border text-xs flex items-center justify-between">
              <div>
                <span className="font-bold text-foreground">
                  {selectedSerial.patient.name}
                </span>{" "}
                &bull;{" "}
                <span className="font-mono text-primary font-bold">
                  #{selectedSerial.patient.patientId}
                </span>{" "}
                &bull; {selectedSerial.patient.gender} (
                {selectedSerial.patient.age || "-"}y)
              </div>
              <div className="text-muted-foreground">
                Phone: {selectedSerial.patient.phone}
              </div>
            </div>
          )}

          <form onSubmit={handleSaveAssessment} className="space-y-4">
            {/* Section 1: Pain Assessment */}
            <div className="p-3 rounded-xl border border-border bg-card/50 space-y-3">
              <div className="text-xs font-bold text-primary uppercase tracking-wider">
                1. Pain Assessment &amp; History
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Pain Area</Label>
                  <Input
                    value={examForm.painArea}
                    onChange={(e) =>
                      setExamForm({ ...examForm, painArea: e.target.value })
                    }
                    placeholder="Back, Knee, Neck, Shoulder"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Side</Label>
                  <select
                    value={examForm.side}
                    onChange={(e) =>
                      setExamForm({
                        ...examForm,
                        side: e.target.value as PainSide,
                      })
                    }
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs"
                  >
                    <option value={PainSide.BOTH}>Both</option>
                    <option value={PainSide.LEFT}>Left</option>
                    <option value={PainSide.RIGHT}>Right</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Duration</Label>
                  <Input
                    value={examForm.duration}
                    onChange={(e) =>
                      setExamForm({ ...examForm, duration: e.target.value })
                    }
                    placeholder="2 weeks, 3 months"
                  />
                </div>
              </div>

              {/* VAS Scale 0 to 10 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <Label className="font-semibold">
                    VAS Pain Score (0-10 Scale):
                  </Label>
                  <span className="font-bold font-mono text-primary text-sm">
                    {examForm.vasScore} / 10
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={examForm.vasScore}
                  onChange={(e) =>
                    setExamForm({
                      ...examForm,
                      vasScore: Number(e.target.value),
                    })
                  }
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>
            </div>

            {/* Section 2: Physical Exam */}
            <div className="p-3 rounded-xl border border-border bg-card/50 space-y-3">
              <div className="text-xs font-bold text-primary uppercase tracking-wider">
                2. Physical Examination
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    ROM (Range of Motion)
                  </Label>
                  <select
                    value={examForm.rom}
                    onChange={(e) =>
                      setExamForm({
                        ...examForm,
                        rom: e.target.value as RomStatus,
                      })
                    }
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs"
                  >
                    <option value={RomStatus.NORMAL}>Normal</option>
                    <option value={RomStatus.RESTRICTED}>Restricted</option>
                  </select>
                </div>

                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs font-semibold">
                    Clinical Findings
                  </Label>
                  <div className="flex items-center gap-4 pt-1">
                    <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={examForm.hasMuscleSpasm}
                        onChange={(e) =>
                          setExamForm({
                            ...examForm,
                            hasMuscleSpasm: e.target.checked,
                          })
                        }
                        className="h-4 w-4 rounded text-primary"
                      />
                      <span>Muscle Spasm</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={examForm.hasTenderness}
                        onChange={(e) =>
                          setExamForm({
                            ...examForm,
                            hasTenderness: e.target.checked,
                          })
                        }
                        className="h-4 w-4 rounded text-primary"
                      />
                      <span>Tenderness</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Diagnosis & Prescribed Modalities */}
            <div className="p-3 rounded-xl border border-border bg-card/50 space-y-3">
              <div className="text-xs font-bold text-primary uppercase tracking-wider">
                3. Diagnosis &amp; Prescribed Treatment Plan
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Clinical Diagnosis
                </Label>
                <Input
                  value={examForm.diagnosis}
                  onChange={(e) =>
                    setExamForm({ ...examForm, diagnosis: e.target.value })
                  }
                  placeholder="e.g. Lumbar Spondylosis with Radiculopathy"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Prescribed Modalities / Care Plan
                </Label>
                <Input
                  value={examForm.prescribedModalities}
                  onChange={(e) =>
                    setExamForm({
                      ...examForm,
                      prescribedModalities: e.target.value,
                    })
                  }
                  placeholder="SWD (20m), UST (10m), IFT (20m), Massage"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsExamOpen(false)}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button type="submit" className="font-bold cursor-pointer">
                Save Clinical Assessment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
