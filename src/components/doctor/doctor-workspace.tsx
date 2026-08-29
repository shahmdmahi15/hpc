"use client";

import {
  useState,
  useEffect,
  useCallback,
  useTransition,
  useMemo,
} from "react";
import { useRealtime } from "@/hooks/use-realtime";
import {
  getDoctorQueue,
  callSerial,
  stopCallSerial,
  startDoctorConsultation,
  updateSerialStatus,
  assignToHandlerWithPlan,
} from "@/actions/serials";
import { saveClinicalAssessment } from "@/actions/assessments";
import { formatBSTTime } from "@/lib/date";
import { toast } from "sonner";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Volume2,
  VolumeX,
  DoorOpen,
  Search,
  X,
  Play,
  Square,
  Radio,
  Zap,
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

  // Active Calling State (5-second countdown with instant stop capability)
  const [callingSerialId, setCallingSerialId] = useState<string | null>(null);
  const [callingSecondsRemaining, setCallingSecondsRemaining] =
    useState<number>(0);
  const [doctorChamberRoom, setDoctorChamberRoom] = useState<string>("205");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "IN_CHAMBER_WAITING" | "IN_THERAPY" | "NOT_CHECKED_IN" | "COMPLETED"
  >("ALL");

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

  // Dynamically filter ONLY active, non-staff doctor consultation chamber rooms
  const doctorRooms = useMemo(() => {
    if (!roomsData?.rooms || roomsData.rooms.length === 0) {
      return [
        {
          roomNumber: "205",
          name: "Room 205",
          purpose: "Doctor Room",
        },
      ];
    }
    const docList = roomsData.rooms.filter(
      (r) =>
        r.isActive &&
        !r.isStaffOnly &&
        (r.type === "DOCTOR" ||
          (r.purpose && r.purpose.toLowerCase().includes("doctor")) ||
          (r.name && r.name.toLowerCase().includes("doctor"))),
    );
    if (docList.length > 0) return docList;
    return roomsData.rooms.filter((r) => r.isActive && !r.isStaffOnly);
  }, [roomsData]);

  // Sync selected chamber room with available doctor rooms
  useEffect(() => {
    if (doctorRooms.length > 0) {
      const exists = doctorRooms.some(
        (r) => r.roomNumber === doctorChamberRoom,
      );
      if (!exists) {
        setDoctorChamberRoom(doctorRooms[0].roomNumber);
      }
    }
  }, [doctorRooms, doctorChamberRoom]);

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

  // 5-second countdown interval timer for active call
  useEffect(() => {
    if (!callingSerialId || callingSecondsRemaining <= 0) return;

    const timer = setInterval(() => {
      setCallingSecondsRemaining((prev) => {
        if (prev <= 1) {
          setCallingSerialId(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [callingSerialId, callingSecondsRemaining]);

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

  // Call Patient to Chamber (Broadcasts event & rings kiosk with sound for 5s)
  const handleCallPatient = async (serial: DoctorQueueItem) => {
    const chamber = serial.roomNo || doctorChamberRoom || "201";
    setCallingSerialId(serial.id);
    setCallingSecondsRemaining(5);

    try {
      await callSerial(serial.id, chamber, SerialStatus.CALLING);
      toast.success(
        `Calling Serial #${serial.serialNumber} (${serial.patient.name}) to Chamber ${chamber}...`,
      );
      refreshData();
    } catch (err) {
      console.error("Failed to call patient", err);
      toast.error("Failed to call patient to chamber.");
      setCallingSerialId(null);
      setCallingSecondsRemaining(0);
    }
  };

  // Stop Calling immediately
  const handleStopCall = async (serialId: string) => {
    setCallingSerialId(null);
    setCallingSecondsRemaining(0);
    try {
      await stopCallSerial(serialId);
      toast.info("Call stopped.");
      refreshData();
    } catch (err) {
      console.error("Failed to stop call", err);
    }
  };

  // Patient Entered Room: Start Consultation
  const handleStartConsultation = async (serial: DoctorQueueItem) => {
    setCallingSerialId(null);
    setCallingSecondsRemaining(0);
    const chamber = serial.roomNo || doctorChamberRoom || "201";
    try {
      await startDoctorConsultation(serial.id, chamber);
      toast.success(
        `Consultation started for Serial #${serial.serialNumber} (${serial.patient.name})`,
      );
      refreshData();
    } catch (err) {
      console.error("Failed to start consultation", err);
      toast.error("Failed to update status to consulting.");
    }
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

  // Metrics & Counters
  const activeConsultation = queue.find(
    (s) => s.status === SerialStatus.IN_CONSULTATION,
  );
  const callingCount = queue.filter(
    (s) => s.status === SerialStatus.CALLING || callingSerialId === s.id,
  ).length;
  const consultingCount = queue.filter(
    (s) => s.status === SerialStatus.IN_CONSULTATION,
  ).length;
  const inTherapyCount = queue.filter(
    (s) => s.status === SerialStatus.IN_THERAPY,
  ).length;
  // Patient is checked in and present in the waiting lounge
  const waitingInLoungeCount = queue.filter(
    (s) =>
      (s.status === SerialStatus.WAITING ||
        s.status === SerialStatus.CHECKED_IN) &&
      !!s.inTime,
  ).length;
  // Patient is NOT checked in yet (Pending arrival / En route)
  const notCheckedInCount = queue.filter(
    (s) =>
      (s.status === SerialStatus.PENDING || !s.inTime) &&
      s.status !== SerialStatus.CALLING &&
      s.status !== SerialStatus.IN_CONSULTATION &&
      s.status !== SerialStatus.IN_THERAPY &&
      s.status !== SerialStatus.COMPLETED &&
      s.status !== SerialStatus.CANCELLED,
  ).length;
  const completedCount = queue.filter(
    (s) => s.status === SerialStatus.COMPLETED,
  ).length;
  const inChamberAndWaitingCount =
    consultingCount + waitingInLoungeCount + callingCount;

  // Filtered Queue by Status & Multi-Field Search with Hierarchical Priority Sorting
  const filteredQueue = useMemo(() => {
    let list = queue;
    if (statusFilter === "IN_CHAMBER_WAITING") {
      list = list.filter(
        (s) =>
          s.status === SerialStatus.IN_CONSULTATION ||
          s.status === SerialStatus.CALLING ||
          callingSerialId === s.id ||
          ((s.status === SerialStatus.WAITING ||
            s.status === SerialStatus.CHECKED_IN) &&
            !!s.inTime),
      );
    } else if (statusFilter === "IN_THERAPY") {
      list = list.filter((s) => s.status === SerialStatus.IN_THERAPY);
    } else if (statusFilter === "NOT_CHECKED_IN") {
      list = list.filter(
        (s) =>
          (s.status === SerialStatus.PENDING || !s.inTime) &&
          s.status !== SerialStatus.CALLING &&
          s.status !== SerialStatus.IN_CONSULTATION &&
          s.status !== SerialStatus.IN_THERAPY &&
          s.status !== SerialStatus.COMPLETED &&
          s.status !== SerialStatus.CANCELLED,
      );
    } else if (statusFilter === "COMPLETED") {
      list = list.filter(
        (s) =>
          s.status === SerialStatus.COMPLETED ||
          s.status === SerialStatus.CANCELLED,
      );
    }

    if (searchQuery.trim()) {
      const rawQ = searchQuery.trim().toLowerCase();
      const cleanQ = rawQ.replace(/^[#\s]+/, "");
      const numOnlyQ = rawQ.replace(/[^0-9]/g, "");

      list = list.filter((s) => {
        const patName = (s.patient.name || "").toLowerCase();
        const patPhone = (s.patient.phone || "").toLowerCase();
        const patId = String(s.patient.patientId || "").toLowerCase();
        const serialNum = String(s.serialNumber || "");
        const paddedSerial = serialNum.padStart(2, "0");
        const roomNo = (s.roomNo || "").toLowerCase();

        const matchesSerial =
          rawQ === serialNum ||
          rawQ === `#${serialNum}` ||
          rawQ === paddedSerial ||
          rawQ === `#${paddedSerial}` ||
          cleanQ === serialNum ||
          cleanQ === paddedSerial ||
          rawQ === `serial ${serialNum}` ||
          rawQ === `sl ${serialNum}`;

        const matchesPhone =
          patPhone.includes(rawQ) ||
          (numOnlyQ && patPhone.replace(/[^0-9]/g, "").includes(numOnlyQ));

        const matchesPatId =
          patId.includes(rawQ) ||
          patId.includes(cleanQ) ||
          (numOnlyQ && patId.replace(/[^0-9]/g, "").includes(numOnlyQ));

        return (
          patName.includes(rawQ) ||
          matchesPhone ||
          matchesPatId ||
          matchesSerial ||
          roomNo.includes(rawQ)
        );
      });
    }

    // Systematic clinical sort order:
    // 1. In Chamber / In Consultation (top)
    // 2. Calling buzzer (right at top with chamber)
    // 3. Waiting in Lounge (checked-in)
    // 4. In Therapy (modalities active in therapy bays)
    // 5. Not Checked In yet (en route / pending)
    // 6. Completed / Cancelled (at the very bottom / last)
    const getPriorityRank = (s: DoctorQueueItem): number => {
      if (s.status === SerialStatus.IN_CONSULTATION) return 1;
      if (s.status === SerialStatus.CALLING || callingSerialId === s.id)
        return 2;
      if (
        (s.status === SerialStatus.WAITING ||
          s.status === SerialStatus.CHECKED_IN) &&
        !!s.inTime
      )
        return 3;
      if (s.status === SerialStatus.IN_THERAPY) return 4;
      if (s.status === SerialStatus.PENDING || !s.inTime) return 5;
      if (
        s.status === SerialStatus.COMPLETED ||
        s.status === SerialStatus.CANCELLED
      )
        return 6;
      return 7;
    };

    return [...list].sort((a, b) => {
      const rankA = getPriorityRank(a);
      const rankB = getPriorityRank(b);
      if (rankA !== rankB) {
        return rankA - rankB;
      }
      return (a.serialNumber || 0) - (b.serialNumber || 0);
    });
  }, [queue, statusFilter, searchQuery, callingSerialId]);

  return (
    <div className="space-y-3 w-full max-w-full min-w-0">
      {/* Top Clinical Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-2.5 min-w-0">
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
            {t("rec.total_registered", "Assigned patients")}
          </span>
        </Card>

        <Card className="p-2 sm:p-2.5 shadow-xs border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase">
              Waiting in Lounge
            </span>
            <Clock className="h-3.5 w-3.5 text-blue-500" />
          </div>
          <p className="text-lg sm:text-xl font-black mt-0.5 font-mono text-blue-600 dark:text-blue-400">
            {waitingInLoungeCount}
          </p>
          <span className="text-[9px] sm:text-[10px] text-muted-foreground block">
            Checked in &amp; ready
          </span>
        </Card>

        <Card className="p-2 sm:p-2.5 shadow-xs border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase">
              Not Checked In
            </span>
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <p className="text-lg sm:text-xl font-black mt-0.5 font-mono text-amber-600 dark:text-amber-400">
            {notCheckedInCount}
          </p>
          <span className="text-[9px] sm:text-[10px] text-muted-foreground block">
            En route / Pending
          </span>
        </Card>

        <Card className="p-2 sm:p-2.5 shadow-xs border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase">
              Calling Now
            </span>
            <Volume2
              className={`h-3.5 w-3.5 ${callingCount > 0 ? "text-destructive animate-pulse" : "text-muted-foreground"}`}
            />
          </div>
          <p className="text-lg sm:text-xl font-black mt-0.5 font-mono text-amber-600 dark:text-amber-400">
            {callingCount}
          </p>
          <span className="text-[9px] sm:text-[10px] text-muted-foreground block">
            Ringing buzzer
          </span>
        </Card>

        <Card className="p-2 sm:p-2.5 shadow-xs border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase">
              {t("status.in_consultation", "In Chamber")}
            </span>
            <Activity className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />
          </div>
          <p className="text-lg sm:text-xl font-black mt-0.5 font-mono text-emerald-600 dark:text-emerald-400">
            {consultingCount}
          </p>
          <span className="text-[9px] sm:text-[10px] text-muted-foreground block truncate">
            {activeConsultation?.patient.name || "Chamber available"}
          </span>
        </Card>

        <Card className="p-2 sm:p-2.5 shadow-xs border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase">
              In Therapy
            </span>
            <Zap className="h-3.5 w-3.5 text-purple-500 animate-pulse" />
          </div>
          <p className="text-lg sm:text-xl font-black mt-0.5 font-mono text-purple-600 dark:text-purple-400">
            {inTherapyCount}
          </p>
          <span className="text-[9px] sm:text-[10px] text-muted-foreground block">
            Modalities active
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
            {t("status.completed", "Visits completed")}
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
                <span>Currently In Consultation Chamber</span>
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
              <span>Prescribe &amp; Route</span>
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
              className="h-7.5 text-xs cursor-pointer font-semibold"
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
              <span>Doctor Patient Queue &amp; Chamber Calls</span>
            </CardTitle>
            <CardDescription className="text-[11px]">
              Call patients to doctor chamber with audio buzzer, manage
              consults, and prescribe therapy protocols.
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

        {/* Filter and Control Bar */}
        <div className="p-2 sm:p-3 pb-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-border bg-muted/20">
          <div className="flex items-center gap-1 flex-wrap">
            <Button
              size="sm"
              variant={statusFilter === "ALL" ? "default" : "outline"}
              onClick={() => setStatusFilter("ALL")}
              className="text-xs h-7 px-2.5 cursor-pointer font-semibold"
            >
              All ({queue.length})
            </Button>
            <Button
              size="sm"
              variant={
                statusFilter === "IN_CHAMBER_WAITING" ? "default" : "outline"
              }
              onClick={() => setStatusFilter("IN_CHAMBER_WAITING")}
              className="text-xs h-7 px-2.5 cursor-pointer font-semibold gap-1.5 text-emerald-600 dark:text-emerald-400"
            >
              <Activity className="h-3 w-3" />
              <span>In Chamber &amp; Waiting ({inChamberAndWaitingCount})</span>
            </Button>
            <Button
              size="sm"
              variant={statusFilter === "IN_THERAPY" ? "default" : "outline"}
              onClick={() => setStatusFilter("IN_THERAPY")}
              className="text-xs h-7 px-2.5 cursor-pointer font-semibold gap-1 text-purple-600 dark:text-purple-400"
            >
              <Zap className="h-3 w-3" />
              <span>In Therapy ({inTherapyCount})</span>
            </Button>
            <Button
              size="sm"
              variant={
                statusFilter === "NOT_CHECKED_IN" ? "default" : "outline"
              }
              onClick={() => setStatusFilter("NOT_CHECKED_IN")}
              className="text-xs h-7 px-2.5 cursor-pointer font-semibold gap-1 text-amber-600 dark:text-amber-400"
            >
              <AlertTriangle className="h-3 w-3" />
              <span>Not Checked In ({notCheckedInCount})</span>
            </Button>
            <Button
              size="sm"
              variant={statusFilter === "COMPLETED" ? "default" : "outline"}
              onClick={() => setStatusFilter("COMPLETED")}
              className="text-xs h-7 px-2.5 cursor-pointer font-semibold"
            >
              Completed ({completedCount})
            </Button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Select
              value={doctorChamberRoom}
              onValueChange={(val: string | null) => {
                if (val) setDoctorChamberRoom(val);
              }}
            >
              <SelectTrigger className="h-7.5 text-xs bg-background border-border shadow-xs px-2.5 gap-2 font-medium min-w-[130px] sm:min-w-[155px] cursor-pointer rounded-lg shrink-0">
                <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1 shrink-0">
                  <Stethoscope className="h-3 w-3 text-primary" />
                  Chamber:
                </span>
                <SelectValue placeholder="Select Chamber">
                  <span className="font-mono font-bold text-foreground">
                    #{doctorChamberRoom}
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-60" align="end">
                {doctorRooms.map((r) => {
                  const label =
                    r.purpose && r.purpose !== `Room ${r.roomNumber}`
                      ? r.purpose
                      : r.name && r.name !== `Room ${r.roomNumber}`
                        ? r.name
                        : "Doctor Chamber";
                  return (
                    <SelectItem
                      key={r.roomNumber}
                      value={r.roomNumber}
                      className="text-xs font-medium cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-primary">
                          #{r.roomNumber}
                        </span>
                        <span className="truncate text-foreground">
                          {label}
                        </span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            <div className="relative flex-1 sm:w-52">
              <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search name, phone, serial #..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-7.5 pr-7 h-7.5 text-xs bg-background"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        <CardContent className="p-0 pb-3">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[680px]">
              <thead>
                <tr className="border-b border-border text-muted-foreground bg-muted/10">
                  <th className="py-2.5 pl-3.5 sm:pl-4 pr-2 font-semibold w-16">
                    {t("col.serial", "Serial")}
                  </th>
                  <th className="py-2.5 px-2.5 font-semibold">
                    {t("col.patient_details", "Patient Details")}
                  </th>
                  <th className="py-2.5 px-2.5 font-semibold">
                    {t("col.told_time", "Told Time")}
                  </th>
                  <th className="py-2.5 px-2.5 font-semibold">
                    {t("col.arrival_status", "Arrival Time")}
                  </th>
                  <th className="py-2.5 px-2.5 font-semibold">
                    Chief Complaint / VAS
                  </th>
                  <th className="py-2.5 px-2.5 font-semibold">
                    {t("col.queue_status", "Status")}
                  </th>
                  <th className="py-2.5 pl-2 pr-3.5 sm:pr-4 font-semibold text-right">
                    {t("col.action", "Actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredQueue.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-8 text-center text-muted-foreground pl-3.5 pr-3.5 sm:pl-4 sm:pr-4"
                    >
                      {searchQuery
                        ? "No matching patients found."
                        : "No patients in queue for today yet."}
                    </td>
                  </tr>
                ) : (
                  filteredQueue.map((s) => {
                    const latestVas = s.patient.assessments?.[0]?.vasScore;
                    const isCalling =
                      s.status === SerialStatus.CALLING ||
                      callingSerialId === s.id;
                    const isConsulting =
                      s.status === SerialStatus.IN_CONSULTATION;

                    return (
                      <tr
                        key={s.id}
                        className={`hover:bg-muted/30 transition-colors ${
                          isCalling
                            ? "bg-amber-500/10 font-medium"
                            : isConsulting
                              ? "bg-primary/10 font-semibold"
                              : ""
                        }`}
                      >
                        <td className="py-3 pl-3.5 sm:pl-4 pr-2 font-mono font-black text-base text-primary whitespace-nowrap">
                          #{s.serialNumber}
                        </td>
                        <td className="py-3 px-2.5 min-w-[160px]">
                          <div className="font-bold text-foreground truncate">
                            {s.patient.name}
                          </div>
                          <div className="text-[11px] text-muted-foreground font-mono whitespace-nowrap">
                            ID: #{s.patient.patientId} &bull; {s.patient.gender}{" "}
                            ({s.patient.age || "-"}y) &bull; {s.patient.phone}
                          </div>
                        </td>
                        <td className="py-3 px-2.5 font-medium text-foreground whitespace-nowrap">
                          {s.toldTime
                            ? formatBSTTime(s.toldTime)
                            : s.timeSlot || "Scheduled"}
                        </td>
                        <td className="py-3 px-2.5 whitespace-nowrap">
                          {s.inTime ? (
                            <div className="flex items-center gap-1.5 flex-nowrap">
                              <span className="font-mono text-[11px] font-semibold text-foreground">
                                {formatBSTTime(s.inTime)}
                              </span>
                              {s.punctualityStatus === "ON_TIME" && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                                  On-Time
                                </span>
                              )}
                              {s.punctualityStatus === "MODERATE_LATE" && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 whitespace-nowrap">
                                  +{s.latenessMinutes}m
                                </span>
                              )}
                              {s.punctualityStatus === "SEVERE_LATE" && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-destructive/15 text-destructive border border-destructive/30 whitespace-nowrap">
                                  +{s.latenessMinutes}m
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-[11px] font-medium italic flex items-center gap-1">
                              <Clock className="h-3 w-3 text-muted-foreground/60" />
                              En route
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-2.5 text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground/90">
                              {s.patient.primaryCondition ||
                                "Pain Rehabilitation"}
                            </span>
                            {latestVas !== undefined && latestVas !== null && (
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
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
                        <td className="py-3 px-2.5 whitespace-nowrap">
                          {isCalling ? (
                            <Badge className="bg-amber-500 text-white font-bold text-[10px] gap-1 px-2.5 py-0.5 rounded-full animate-pulse shadow-xs whitespace-nowrap">
                              <Volume2 className="h-3 w-3" />
                              <span>Calling Chamber</span>
                            </Badge>
                          ) : isConsulting ? (
                            <Badge className="bg-emerald-600 text-white font-bold text-[10px] gap-1 px-2.5 py-0.5 rounded-full shadow-xs whitespace-nowrap">
                              <Activity className="h-3 w-3 animate-pulse" />
                              <span>Consulting</span>
                            </Badge>
                          ) : s.status === SerialStatus.IN_THERAPY ? (
                            <Badge className="bg-purple-600 dark:bg-purple-700 text-white font-bold text-[10px] gap-1 px-2.5 py-0.5 rounded-full shadow-xs whitespace-nowrap">
                              <Zap className="h-3 w-3 animate-pulse" />
                              <span>In Therapy</span>
                            </Badge>
                          ) : !s.inTime || s.status === SerialStatus.PENDING ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-bold text-amber-500 border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 rounded-full whitespace-nowrap gap-1"
                            >
                              <Clock className="h-3 w-3" />
                              <span>Not Checked In</span>
                            </Badge>
                          ) : s.status === SerialStatus.WAITING ||
                            s.status === SerialStatus.CHECKED_IN ? (
                            <Badge
                              variant="secondary"
                              className="text-[10px] font-bold text-blue-500 bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 rounded-full whitespace-nowrap gap-1"
                            >
                              <Users className="h-3 w-3" />
                              <span>Waiting</span>
                            </Badge>
                          ) : s.status === SerialStatus.COMPLETED ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 rounded-full whitespace-nowrap gap-1"
                            >
                              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                              <span>Completed</span>
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-bold whitespace-nowrap px-2.5 py-0.5 rounded-full"
                            >
                              {s.status.replace("_", " ")}
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 pl-2 pr-3.5 sm:pr-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5 flex-nowrap">
                            {/* Calling State Action Buttons */}
                            {isCalling ? (
                              <div className="flex items-center gap-1.5 flex-nowrap">
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-7 text-xs cursor-pointer gap-1 font-bold animate-pulse px-2.5 whitespace-nowrap"
                                  onClick={() => handleStopCall(s.id)}
                                  title="Stop buzzer call early"
                                >
                                  <VolumeX className="h-3.5 w-3.5" />
                                  <span>
                                    Stop Call (
                                    {callingSerialId === s.id &&
                                    callingSecondsRemaining > 0
                                      ? `${callingSecondsRemaining}s`
                                      : "5s"}
                                    )
                                  </span>
                                </Button>

                                <Button
                                  size="sm"
                                  className="h-7 text-xs cursor-pointer gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 shadow-xs whitespace-nowrap"
                                  onClick={() => handleStartConsultation(s)}
                                  title="Patient arrived inside doctor chamber"
                                >
                                  <DoorOpen className="h-3.5 w-3.5" />
                                  <span>Patient Entered</span>
                                </Button>
                              </div>
                            ) : isConsulting ? (
                              <div className="flex items-center gap-1.5 flex-nowrap">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs font-semibold px-2.5 gap-1.5 cursor-pointer border-border hover:bg-muted/50 whitespace-nowrap"
                                  onClick={() => handleOpenExam(s)}
                                  title="Fill / Edit Clinical Assessment"
                                >
                                  <FileCheck className="h-3.5 w-3.5 text-primary" />
                                  <span>Exam</span>
                                </Button>

                                <Button
                                  size="sm"
                                  className="h-7 text-xs font-bold px-2.5 gap-1.5 cursor-pointer bg-primary text-primary-foreground shadow-xs hover:opacity-90 whitespace-nowrap"
                                  onClick={() => handleOpenRouteToHandler(s)}
                                  title="Prescribe & Route to Therapy Handler"
                                >
                                  <Send className="h-3.5 w-3.5" />
                                  <span>Therapy</span>
                                </Button>

                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs font-semibold px-2.5 gap-1.5 cursor-pointer text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10 whitespace-nowrap"
                                  onClick={() => handleCompleteSerial(s.id)}
                                  title="Mark consultation completed"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                  <span>Complete</span>
                                </Button>
                              </div>
                            ) : s.status === SerialStatus.IN_THERAPY ? (
                              <div className="flex items-center gap-1.5 flex-nowrap">
                                <Badge
                                  variant="outline"
                                  className="text-[10px] font-medium text-purple-600 dark:text-purple-400 border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 gap-1 whitespace-nowrap"
                                >
                                  <Zap className="h-3 w-3 text-purple-500" />
                                  <span>Bay {s.roomNo || "Assigned"}</span>
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs font-semibold px-2.5 gap-1 cursor-pointer border-border hover:bg-muted/50 whitespace-nowrap"
                                  onClick={() => handleOpenExam(s)}
                                  title="View / Edit Clinical Assessment"
                                >
                                  <FileCheck className="h-3.5 w-3.5 text-primary" />
                                  <span>Exam</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs font-semibold px-2.5 gap-1 cursor-pointer text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10 whitespace-nowrap"
                                  onClick={() => handleCompleteSerial(s.id)}
                                  title="Mark consultation completed"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                  <span>Complete</span>
                                </Button>
                              </div>
                            ) : !s.inTime ||
                              s.status === SerialStatus.PENDING ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] font-normal text-muted-foreground border-border/40 bg-muted/20 px-2.5 py-0.5 gap-1 whitespace-nowrap"
                              >
                                <Clock className="h-3 w-3 text-muted-foreground/60" />
                                <span>Awaiting Check-in</span>
                              </Badge>
                            ) : s.status !== SerialStatus.COMPLETED &&
                              s.status !== SerialStatus.CANCELLED ? (
                              <div className="flex items-center gap-1.5 flex-nowrap">
                                <Button
                                  size="sm"
                                  className="h-7 text-xs cursor-pointer gap-1.5 font-bold bg-primary text-primary-foreground shadow-xs px-2.5 whitespace-nowrap"
                                  onClick={() => handleCallPatient(s)}
                                >
                                  <PhoneCall className="h-3.5 w-3.5" />
                                  <span>Call to Chamber</span>
                                </Button>

                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs cursor-pointer gap-1.5 font-medium px-2.5 whitespace-nowrap"
                                  onClick={() => handleStartConsultation(s)}
                                  title="Directly mark consulting"
                                >
                                  <DoorOpen className="h-3.5 w-3.5 text-emerald-600" />
                                  <span>Consulting</span>
                                </Button>
                              </div>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 gap-1 whitespace-nowrap"
                              >
                                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                <span>Completed</span>
                              </Badge>
                            )}
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
