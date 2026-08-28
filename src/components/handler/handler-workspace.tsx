"use client";

import { useState, useCallback, useTransition } from "react";
import { useRealtime } from "@/hooks/use-realtime";
import { formatBSTTime } from "@/lib/date";
import {
  getHandlerQueue,
  updateSerialTimings,
  updateSerialStatus,
} from "@/actions/serials";
import { saveTreatmentSession } from "@/actions/treatments";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Activity,
  Users,
  CheckCircle2,
  Play,
  ClipboardList,
  HeartPulse,
  RefreshCw,
  Stethoscope,
  DoorOpen,
} from "lucide-react";
import { SerialStatus, Gender } from "@/generated/prisma/enums";
import { RoomOccupancyDashboard } from "@/components/rooms/room-occupancy-dashboard";
import { useI18n } from "@/lib/i18n";

interface HandlerWorkspaceProps {
  initialQueue: Awaited<ReturnType<typeof getHandlerQueue>>;
  handlerId: string;
}

type HandlerQueueItem = NonNullable<
  Awaited<ReturnType<typeof getHandlerQueue>>
>[number];

export function HandlerWorkspace({
  initialQueue,
  handlerId,
}: HandlerWorkspaceProps) {
  const { t } = useI18n();
  const [queue, setQueue] = useState(initialQueue);
  const [activeTab, setActiveTab] = useState<"queue" | "chambers">("queue");
  const [selectedSerial, setSelectedSerial] = useState<HandlerQueueItem | null>(
    null,
  );
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Treatment Session Log Form (Page 2 of PDF 2)
  const [sessionForm, setSessionForm] = useState({
    bloodPressure: "120/80",
    complaint: "Lower lumbar stiffness",
    treatmentPlan: "SWD (20m), UST (10m), IFT (20m)",
    treatmentPerformed: "SWD, UST, IFT, Therapeutic Massage",
    notes: "Patient completed prescribed electrotherapy modalities",
  });

  const refreshData = useCallback(() => {
    startTransition(async () => {
      try {
        const updated = await getHandlerQueue();
        setQueue(updated);
      } catch (err) {
        console.error("Failed to refresh handler queue", err);
      }
    });
  }, []);

  useRealtime({
    onRefresh: refreshData,
  });

  // Stamp Live Timings (SD Time, In Time, T Time, Out Time, Rest Time)
  const handleStampTiming = async (
    serialId: string,
    field: "inTime" | "therapyStartTime" | "outTime" | "restTime",
  ) => {
    const nowIso = new Date().toISOString();
    await updateSerialTimings(serialId, {
      [field]: nowIso,
      handlerId,
    });
    if (field === "therapyStartTime") {
      await updateSerialStatus(serialId, SerialStatus.IN_THERAPY);
    } else if (field === "outTime") {
      await updateSerialStatus(serialId, SerialStatus.COMPLETED);
    }
    refreshData();
  };

  const handleOpenSessionModal = (serial: HandlerQueueItem) => {
    setSelectedSerial(serial);
    const doctorPlan =
      serial.assignedTreatmentPlan ||
      serial.patient.assessments?.[0]?.prescribedModalities ||
      "SWD (20m), UST (10m), IFT (20m)";
    setSessionForm({
      bloodPressure: "120/80",
      complaint: serial.patient.primaryCondition || "Pain & rehabilitation",
      treatmentPlan: doctorPlan,
      treatmentPerformed: doctorPlan,
      notes: "Therapy executed exactly as prescribed by doctor",
    });
    setIsSessionModalOpen(true);
  };

  const handleSaveSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSerial) return;

    await saveTreatmentSession({
      patientId: selectedSerial.patient.id,
      handlerId,
      ...sessionForm,
    });

    await updateSerialStatus(selectedSerial.id, SerialStatus.COMPLETED);
    setIsSessionModalOpen(false);
    refreshData();
  };

  const malePatients = queue.filter(
    (s) => s.gender === Gender.MALE || s.patient.gender === Gender.MALE,
  );
  const femalePatients = queue.filter(
    (s) => s.gender === Gender.FEMALE || s.patient.gender === Gender.FEMALE,
  );

  const activeTherapyCount = queue.filter(
    (s) => s.status === SerialStatus.IN_THERAPY,
  ).length;
  const completedCount = queue.filter(
    (s) => s.status === SerialStatus.COMPLETED,
  ).length;

  return (
    <div className="space-y-3 w-full max-w-full min-w-0">
      {/* Top Metrics Row (Compact) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5 min-w-0">
        <Card className="p-2 sm:p-2.5 shadow-xs border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase">
              Assigned Patients
            </span>
            <Users className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-lg sm:text-xl font-black mt-0.5 font-mono text-foreground">
            {queue.length}
          </p>
          <span className="text-[9px] sm:text-[10px] text-muted-foreground block">
            Rehabilitation sessions today
          </span>
        </Card>

        <Card className="p-2 sm:p-2.5 shadow-xs border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase">
              Active In Therapy
            </span>
            <Activity className="h-3.5 w-3.5 text-primary animate-pulse" />
          </div>
          <p className="text-lg sm:text-xl font-black mt-0.5 font-mono text-primary">
            {activeTherapyCount}
          </p>
          <span className="text-[9px] sm:text-[10px] text-muted-foreground block">
            Undergoing modalities
          </span>
        </Card>

        <Card className="p-2 sm:p-2.5 shadow-xs border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase">
              Male / Female Bays
            </span>
            <HeartPulse className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-lg sm:text-xl font-black mt-0.5 font-mono text-foreground">
            {malePatients.length}M / {femalePatients.length}F
          </p>
          <span className="text-[9px] sm:text-[10px] text-muted-foreground block">
            Chamber bay distribution
          </span>
        </Card>

        <Card className="p-2 sm:p-2.5 shadow-xs border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase">
              Completed Sessions
            </span>
            <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-lg sm:text-xl font-black mt-0.5 font-mono text-foreground">
            {completedCount}
          </p>
          <span className="text-[9px] sm:text-[10px] text-muted-foreground block">
            Therapy logs finalized
          </span>
        </Card>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-1 bg-card p-1.5 rounded-xl border border-border shadow-xs max-w-full min-w-0">
        <div className="flex items-center gap-1 bg-muted/70 p-0.5 rounded-lg">
          <button
            onClick={() => setActiveTab("queue")}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ${
              activeTab === "queue"
                ? "bg-card text-primary shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Activity className="h-3 w-3" />
            <span>{t("handler.active_queue", "Therapy Queue")}</span>
          </button>

          <button
            onClick={() => setActiveTab("chambers")}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ${
              activeTab === "chambers"
                ? "bg-card text-primary shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <DoorOpen className="h-3 w-3" />
            <span>{t("nav.chambers", "Chambers & Bays")}</span>
          </button>
        </div>
      </div>

      {activeTab === "chambers" ? (
        <RoomOccupancyDashboard />
      ) : (
        /* Therapy Execution Queue (Care Handler Hub) */
        <Card className="shadow-xs border-border bg-card">
          <CardHeader className="p-3 pb-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xs sm:text-sm font-bold flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-primary" />
                <span>Care Handler Execution Hub</span>
              </CardTitle>
              <CardDescription className="text-[11px]">
                Execute doctor-prescribed modalities, stamp 5-stage timings, and
                finalize treatment logs.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={refreshData}
              title="Refresh"
              className="h-7.5 w-7.5 cursor-pointer"
            >
              <RefreshCw
                className={`h-3 w-3 ${isPending ? "animate-spin text-primary" : ""}`}
              />
            </Button>
          </CardHeader>
          <CardContent className="p-0 px-2 sm:px-4 pb-3">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[700px]">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="pb-2 font-semibold w-12">Serial</th>
                    <th className="pb-2 font-semibold">Patient &amp; Bay</th>
                    <th className="pb-2 font-semibold">Told Time</th>
                    <th className="pb-2 font-semibold">In Time</th>
                    <th className="pb-2 font-semibold">Therapy Start Time</th>
                    <th className="pb-2 font-semibold">Out Time</th>
                    <th className="pb-2 font-semibold">
                      Doctor Prescribed Modalities
                    </th>
                    <th className="pb-2 font-semibold text-right">
                      Log Session
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {queue.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="py-8 text-center text-muted-foreground"
                      >
                        No patients assigned for therapy sessions today yet.
                      </td>
                    </tr>
                  ) : (
                    queue.map((s) => {
                      const doctorPlan =
                        s.assignedTreatmentPlan ||
                        s.patient.assessments?.[0]?.prescribedModalities ||
                        "SWD, UST, IFT";
                      return (
                        <tr
                          key={s.id}
                          className={`hover:bg-muted/30 transition-colors ${
                            s.status === SerialStatus.IN_THERAPY
                              ? "bg-primary/10 font-semibold"
                              : ""
                          }`}
                        >
                          <td className="py-3 font-mono font-black text-base text-primary">
                            #{s.serialNumber}
                          </td>
                          <td className="py-3">
                            <div className="font-bold text-foreground flex items-center gap-2">
                              <span>{s.patient.name}</span>
                              <Badge variant="outline" className="text-[10px]">
                                {s.patient.gender}
                              </Badge>
                            </div>
                            <div className="text-[11px] text-muted-foreground font-mono">
                              ID: #{s.patient.patientId} &bull;{" "}
                              <span className="text-primary font-bold">
                                {s.roomNo || "Physio Bay 1"}
                              </span>
                            </div>
                          </td>

                          {/* Told Arrival Time */}
                          <td className="py-3 font-medium text-foreground">
                            {s.toldTime
                              ? formatBSTTime(s.toldTime)
                              : s.timeSlot || "Scheduled"}
                          </td>

                          {/* In Time */}
                          <td className="py-3 font-mono">
                            {s.inTime ? (
                              <div className="flex items-center gap-1">
                                <span className="text-foreground font-bold">
                                  {formatBSTTime(s.inTime)}
                                </span>
                                {s.punctualityStatus === "SEVERE_LATE" && (
                                  <span className="text-[9px] text-destructive font-bold">
                                    (+{s.latenessMinutes}m)
                                  </span>
                                )}
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-[10px] cursor-pointer font-semibold text-primary"
                                onClick={() =>
                                  handleStampTiming(s.id, "inTime")
                                }
                              >
                                + Stamp In
                              </Button>
                            )}
                          </td>

                          {/* T Time (Therapy Start) */}
                          <td className="py-3 font-mono">
                            {s.therapyStartTime ? (
                              <span className="text-primary font-bold">
                                {formatBSTTime(s.therapyStartTime)}
                              </span>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-[10px] gap-1 cursor-pointer font-bold border-primary/40 text-primary"
                                onClick={() =>
                                  handleStampTiming(s.id, "therapyStartTime")
                                }
                              >
                                <Play className="h-2.5 w-2.5" />
                                <span>Start T.</span>
                              </Button>
                            )}
                          </td>

                          {/* Out Time */}
                          <td className="py-3 font-mono">
                            {s.outTime ? (
                              <span className="text-muted-foreground">
                                {formatBSTTime(s.outTime)}
                              </span>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-[10px] cursor-pointer"
                                onClick={() =>
                                  handleStampTiming(s.id, "outTime")
                                }
                              >
                                + Stamp Out
                              </Button>
                            )}
                          </td>

                          {/* Doctor Prescribed Modalities */}
                          <td className="py-3">
                            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-foreground font-medium text-xs space-y-0.5">
                              <div className="text-[10px] font-bold text-primary flex items-center gap-1 uppercase">
                                <Stethoscope className="h-3 w-3" />
                                <span>Doctor Prescribed Plan:</span>
                              </div>
                              <div className="font-semibold text-primary">
                                {doctorPlan}
                              </div>
                            </div>
                          </td>

                          {/* Action: Log Session Form */}
                          <td className="py-3 text-right">
                            <Button
                              size="sm"
                              variant="default"
                              className="h-7 text-[11px] gap-1 cursor-pointer font-bold"
                              onClick={() => handleOpenSessionModal(s)}
                            >
                              <ClipboardList className="h-3 w-3" />
                              <span>Log Session</span>
                            </Button>
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
      )}

      {/* DIALOG: Multi-Session Treatment Log Modal (Page 2 of PDF 2) */}
      <Dialog open={isSessionModalOpen} onOpenChange={setIsSessionModalOpen}>
        <DialogContent className="sm:max-w-lg bg-card">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <span>Multi-Session Treatment Log</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Record vitals, confirm doctor-prescribed modalities executed, and
              log handler notes.
            </DialogDescription>
          </DialogHeader>

          {selectedSerial && (
            <div className="p-3 rounded-xl bg-muted/60 border border-border text-xs space-y-1">
              <div className="font-bold text-foreground">
                {selectedSerial.patient.name} &bull;{" "}
                <span className="font-mono text-primary font-bold">
                  #{selectedSerial.patient.patientId}
                </span>{" "}
                &bull; {selectedSerial.patient.gender}
              </div>
              <div className="text-muted-foreground font-medium">
                Assigned Bay: {selectedSerial.roomNo || "Physio Bay 1"}
              </div>
            </div>
          )}

          <form onSubmit={handleSaveSession} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Blood Pressure (BP)
                </Label>
                <Input
                  value={sessionForm.bloodPressure}
                  onChange={(e) =>
                    setSessionForm({
                      ...sessionForm,
                      bloodPressure: e.target.value,
                    })
                  }
                  placeholder="120/80"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Primary Complaint
                </Label>
                <Input
                  value={sessionForm.complaint}
                  onChange={(e) =>
                    setSessionForm({
                      ...sessionForm,
                      complaint: e.target.value,
                    })
                  }
                  placeholder="Back pain, Knee stiffness"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-primary">
                Doctor Prescribed Treatment Plan
              </Label>
              <Input
                value={sessionForm.treatmentPlan}
                onChange={(e) =>
                  setSessionForm({
                    ...sessionForm,
                    treatmentPlan: e.target.value,
                  })
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Modalities Performed by Handler
              </Label>
              <Input
                value={sessionForm.treatmentPerformed}
                onChange={(e) =>
                  setSessionForm({
                    ...sessionForm,
                    treatmentPerformed: e.target.value,
                  })
                }
                placeholder="SWD (20m), UST (10m), IFT (20m), Exercise"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Care Handler Notes / Feedback
              </Label>
              <Input
                value={sessionForm.notes}
                onChange={(e) =>
                  setSessionForm({ ...sessionForm, notes: e.target.value })
                }
                placeholder="Patient responded well, pain reduced"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsSessionModalOpen(false)}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="font-bold cursor-pointer bg-primary text-primary-foreground"
              >
                Save &amp; Complete Session
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
