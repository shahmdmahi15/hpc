"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getPatientMedicalHistoryAction } from "@/actions/doctor/medical-record.action";
import {
  FolderOpen,
  Calendar,
  Activity,
  Stethoscope,
  Flame,
  Printer,
  ChevronDown,
  ChevronUp,
  HeartPulse,
  PlusCircle,
  FileText,
  UserCheck,
  Eye,
  LayoutList,
  Download,
  Phone,
  CheckCircle2,
} from "lucide-react";
import { VasRecoveryTimeline } from "@/components/doctor/medical/vas-recovery-timeline";
import { downloadElementAsPdf, printElementIsolated } from "@/lib/pdf-generator";
import { CLINIC_CONFIG } from "@/lib/clinic-config";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface HistoryPatientInfo {
  id: string;
  name: string;
  phone?: string | null;
  mrn?: string | null;
  age?: number | null;
  gender: string;
}

interface PatientMedicalHistoryDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  patient: HistoryPatientInfo | null;
  onNewRecordRequested?: () => void;
}

interface ParsedRecord {
  id: string;
  assessmentDate: Date;
  age: number | null;
  occupation: string | null;
  painSide: string | null;
  duration: string | null;
  vasScore: number | null;
  injuryAccident: boolean | null;
  injuryDetails: string | null;
  postureAdviceGiven: boolean | null;
  surgeryHistory: boolean | null;
  surgeryDetails: string | null;
  previousTreatment: string | null;
  rom: string | null;
  muscleSpasm: boolean | null;
  tenderness: boolean | null;
  swelling: boolean | null;
  physicalExamNotes: string | null;
  diagnosis: string | null;
  treatmentNotes: string | null;
  exerciseExplained: boolean | null;
  homePostureAdvice: boolean | null;
  followUpVasScore: number | null;
  improvement: string | null;
  doctorSignature: string | null;
  painAreasList: string[];
  painTypesList: string[];
  aggravatingFactorsList: string[];
  relievingFactorsList: string[];
  functionalLimitationsList: string[];
  treatmentPlansList: string[];
  doctor: { name: string } | null;
}

export function PatientMedicalHistoryDialog({
  isOpen,
  onOpenChange,
  patient,
  onNewRecordRequested,
}: PatientMedicalHistoryDialogProps) {
  const [records, setRecords] = React.useState<ParsedRecord[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [expandedRecordId, setExpandedRecordId] = React.useState<string | null>(null);
  const [selectedVoucherRecordId, setSelectedVoucherRecordId] = React.useState<string | null>(null);
  const [viewMode, setViewMode] = React.useState<"timeline" | "voucher">("timeline");
  const [isGeneratingPdf, setIsGeneratingPdf] = React.useState(false);

  React.useEffect(() => {
    let ignore = false;
    if (isOpen && patient?.id) {
      setIsLoading(true);
      getPatientMedicalHistoryAction(patient.id)
        .then((res) => {
          if (ignore) return;
          if (res.success && res.records) {
            const parsed = res.records as unknown as ParsedRecord[];
            setRecords(parsed);
            if (parsed.length > 0) {
              setExpandedRecordId(parsed[0].id);
              setSelectedVoucherRecordId(parsed[0].id);
            }
          } else {
            setRecords([]);
          }
        })
        .finally(() => {
          if (!ignore) {
            setIsLoading(false);
          }
        });
    }
    return () => {
      ignore = true;
    };
  }, [isOpen, patient?.id]);

  const activeRecord =
    records.find((r) => r.id === (selectedVoucherRecordId || expandedRecordId)) ||
    records[0] ||
    null;

  const handlePrint = (recordToPrint?: ParsedRecord) => {
    const target = recordToPrint || activeRecord;
    if (!target) {
      toast.error("No assessment record available to print.");
      return;
    }
    if (target.id !== selectedVoucherRecordId) {
      setSelectedVoucherRecordId(target.id);
    }
    setTimeout(() => {
      printElementIsolated(
        "patient-medical-checkup-print",
        `Medical File - ${patient?.name || "Patient"}`
      );
    }, 50);
  };

  const handleDownloadPdf = async (recordToPrint?: ParsedRecord) => {
    const target = recordToPrint || activeRecord;
    if (!target) {
      toast.error("No assessment record available to download.");
      return;
    }
    if (target.id !== selectedVoucherRecordId) {
      setSelectedVoucherRecordId(target.id);
    }
    setIsGeneratingPdf(true);
    try {
      const patientSlug = (patient?.name || "Patient").replace(/[^a-zA-Z0-9]/g, "_");
      const dateStr = new Date(target.assessmentDate).toISOString().slice(0, 10);
      const filename = `HPC_Medical_File_${patientSlug}_${dateStr}.pdf`;
      const success = await downloadElementAsPdf("patient-medical-checkup-print", {
        filename,
        format: "custom-5.5x8.125",
        orientation: "portrait",
      });
      if (success) {
        toast.success("Medical File PDF downloaded successfully!");
      } else {
        toast.error("Failed to generate PDF. Please try again.");
      }
    } catch (error) {
      console.error("[Medical File PDF] Error:", error);
      toast.error("PDF generation encountered an error.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-6xl lg:max-w-7xl max-h-[92dvh] flex flex-col p-0 overflow-hidden shadow-2xl rounded-2xl border border-border/80">
        {/* Header */}
        <DialogHeader className="p-3.5 sm:p-4 pr-12 sm:pr-14 bg-muted/40 border-b border-border space-y-2 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                <FolderOpen className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-black tracking-tight text-foreground">
                  Patient Medical Checkup History &amp; Files
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Complete clinical evaluations, pain trajectory, and prescribed therapy records.
                </DialogDescription>
              </div>
            </div>

            {/* View Mode Switch & Actions */}
            <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
              {records.length > 0 && (
                <div className="flex items-center bg-muted/80 p-0.5 rounded-lg border border-border/70 text-xs">
                  <Button
                    size="sm"
                    variant={viewMode === "timeline" ? "default" : "ghost"}
                    onClick={() => setViewMode("timeline")}
                    className="h-7 px-2.5 text-xs font-semibold gap-1.5 cursor-pointer"
                  >
                    <LayoutList className="size-3.5" />
                    <span>Timeline</span>
                  </Button>
                  <Button
                    size="sm"
                    variant={viewMode === "voucher" ? "default" : "ghost"}
                    onClick={() => setViewMode("voucher")}
                    className="h-7 px-2.5 text-xs font-semibold gap-1.5 cursor-pointer"
                  >
                    <Eye className="size-3.5" />
                    <span>5.5″ × 8.27″ Voucher</span>
                  </Button>
                </div>
              )}

              {records.length > 0 && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handlePrint()}
                    className="text-xs h-8 cursor-pointer gap-1.5 font-bold"
                  >
                    <Printer className="size-3.5" />
                    <span>Print File</span>
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownloadPdf()}
                    disabled={isGeneratingPdf}
                    className="text-xs h-8 cursor-pointer gap-1.5"
                  >
                    <Download className="size-3.5" />
                    <span>{isGeneratingPdf ? "Generating..." : "PDF"}</span>
                  </Button>
                </>
              )}

              {onNewRecordRequested && (
                <Button
                  size="sm"
                  onClick={() => {
                    onOpenChange(false);
                    onNewRecordRequested();
                  }}
                  className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer gap-1.5 shadow-2xs"
                >
                  <PlusCircle className="size-3.5" />
                  <span>New File</span>
                </Button>
              )}
            </div>
          </div>

          {/* Patient Quick Details */}
          {patient && (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2 pt-2 text-xs font-mono text-muted-foreground border-t border-border/50 bg-background/50 p-2 rounded-lg">
              <div>
                <strong className="text-foreground">Patient:</strong>{" "}
                {patient.name}
              </div>
              <div>
                <strong className="text-foreground">ID / MRN:</strong>{" "}
                {patient.mrn || patient.id.slice(-6).toUpperCase()}
              </div>
              <div>
                <strong className="text-foreground">Gender:</strong>{" "}
                {patient.gender}
              </div>
              <div>
                <strong className="text-foreground">Phone:</strong>{" "}
                {patient.phone || "---"}
              </div>
              <div className="col-span-2 sm:col-span-1 flex items-center gap-1.5">
                <strong className="text-foreground">Total Files:</strong>
                <Badge
                  variant="secondary"
                  className="text-[10px] font-bold px-2 py-0"
                >
                  {records.length} {records.length === 1 ? "Record" : "Records"}
                </Badge>
              </div>
            </div>
          )}
        </DialogHeader>

        {/* Body Content */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4 text-xs">
          {isLoading ? (
            <div className="py-16 text-center text-xs text-muted-foreground space-y-3">
              <div className="size-7 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="font-semibold">
                Loading medical assessment history...
              </p>
            </div>
          ) : records.length === 0 ? (
            <div className="py-16 text-center space-y-3 border-2 border-dashed border-border/80 rounded-2xl p-6 max-w-lg mx-auto">
              <div className="size-12 rounded-2xl bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                <FileText className="size-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-foreground">
                  No previous medical files found
                </p>
                <p className="text-xs text-muted-foreground">
                  This patient does not have any saved physiotherapy assessments
                  or checkups yet.
                </p>
              </div>
              {onNewRecordRequested && (
                <Button
                  size="sm"
                  onClick={() => {
                    onOpenChange(false);
                    onNewRecordRequested();
                  }}
                  className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer gap-2 mt-2 shadow-2xs"
                >
                  <PlusCircle className="size-4" />
                  <span>Create First Assessment File</span>
                </Button>
              )}
            </div>
          ) : viewMode === "voucher" ? (
            /* ========================================================== */
            /* 5.5" x 8.27" HPC VOUCHER LIVE PREVIEW VIEW                 */
            /* ========================================================== */
            <div className="space-y-3">
              {/* Record Selector Bar if multiple assessments exist */}
              {records.length > 1 && (
                <div className="flex items-center justify-between gap-3 bg-muted/40 p-2.5 rounded-xl border border-border/70">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-foreground">Viewing Record:</span>
                    <Select
                      value={activeRecord?.id || records[0].id}
                      onValueChange={(val) => {
                        setSelectedVoucherRecordId(val);
                        setExpandedRecordId(val);
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs font-mono font-bold bg-background min-w-[240px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {records.map((r, i) => {
                          const d = new Date(r.assessmentDate).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          });
                          return (
                            <SelectItem key={r.id} value={r.id}>
                              #{records.length - i} • {d} (VAS: {r.vasScore ?? "N/A"}{i === 0 ? " - Latest" : ""})
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => handlePrint()}
                      className="h-8 text-xs font-bold gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Printer className="size-3.5" />
                      <span>Print Voucher</span>
                    </Button>
                  </div>
                </div>
              )}

              {/* Centered Scrollable Document Preview Container */}
              <div className="p-3 sm:p-5 rounded-xl bg-neutral-200/80 dark:bg-neutral-950 flex justify-center items-start overflow-x-auto">
                {activeRecord && (
                  <MedicalRecordVoucher
                    patient={patient}
                    record={activeRecord}
                    allRecords={records}
                    containerId="patient-medical-checkup-print"
                  />
                )}
              </div>
            </div>
          ) : (
            /* ========================================================== */
            /* TIMELINE & COLLAPSIBLE HISTORY VIEW                        */
            /* ========================================================== */
            <div className="space-y-3.5">
              {/* Clinical VAS Pain Score Recovery Trajectory */}
              <VasRecoveryTimeline records={records} />

              {records.map((rec, index) => {
                const isExpanded = expandedRecordId === rec.id;
                const recDate = new Date(rec.assessmentDate).toLocaleDateString(
                  "en-GB",
                  {
                    weekday: "short",
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  },
                );

                return (
                  <div
                    key={rec.id}
                    className={`rounded-2xl border transition-all overflow-hidden ${
                      isExpanded
                        ? "bg-card border-sky-500/50 shadow-md ring-1 ring-sky-500/20"
                        : "bg-card/70 border-border/80 hover:bg-card"
                    }`}
                  >
                    {/* Collapsible Record Summary Header */}
                    <div
                      onClick={() =>
                        setExpandedRecordId(isExpanded ? null : rec.id)
                      }
                      className="p-3.5 sm:p-4 flex items-center justify-between gap-3 cursor-pointer select-none bg-muted/20 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="size-8 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 font-mono font-black text-xs flex items-center justify-center shrink-0 border border-sky-500/20">
                          #{records.length - index}
                        </span>

                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                              <Calendar className="size-3.5 text-muted-foreground" />
                              <span>{recDate}</span>
                            </span>

                            {rec.diagnosis && (
                              <Badge
                                variant="outline"
                                className="text-xs font-bold py-0.5 bg-background border-border"
                              >
                                {rec.diagnosis}
                              </Badge>
                            )}

                            {index === 0 && (
                              <Badge className="bg-emerald-600 text-white text-[10px] font-bold py-0">
                                Latest
                              </Badge>
                            )}
                          </div>

                          <div className="text-[11px] text-muted-foreground flex items-center gap-2 truncate">
                            {rec.doctor?.name && (
                              <span className="flex items-center gap-1">
                                <UserCheck className="size-3 text-muted-foreground" />
                                <span>{rec.doctor.name}</span>
                              </span>
                            )}
                            {rec.painAreasList.length > 0 && (
                              <span>
                                • Area: {rec.painAreasList.join(", ")}
                              </span>
                            )}
                            {rec.occupation && <span>• {rec.occupation}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* VAS Score Pill */}
                        {rec.vasScore !== null && (
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-black font-mono border flex items-center gap-1.5 ${
                              rec.vasScore >= 7
                                ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30"
                                : rec.vasScore >= 4
                                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                                  : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                            }`}
                          >
                            <span>VAS: {rec.vasScore}/10</span>
                            {rec.followUpVasScore !== null && (
                              <span className="text-muted-foreground font-semibold">
                                → Post: {rec.followUpVasScore}/10
                              </span>
                            )}
                          </span>
                        )}

                        {/* Quick Print Button for this specific record */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePrint(rec);
                          }}
                          title="Print this assessment file"
                          className="h-7 px-2 text-[11px] gap-1 cursor-pointer hover:bg-muted"
                        >
                          <Printer className="size-3" />
                          <span>Print</span>
                        </Button>

                        <div className="p-1 text-muted-foreground hover:text-foreground">
                          {isExpanded ? (
                            <ChevronUp className="size-4" />
                          ) : (
                            <ChevronDown className="size-4" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Detailed Record Body (Wide Multi-Column Grid) */}
                    {isExpanded && (
                      <div className="p-4 sm:p-5 space-y-4 border-t border-border/60 bg-background/50">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {/* Left Column in Detailed View */}
                          <div className="space-y-3">
                            {/* 2. Pain Details */}
                            <div className="space-y-1.5 p-3 rounded-xl bg-card border border-border/60">
                              <span className="font-bold text-xs text-foreground uppercase tracking-wider flex items-center gap-1.5">
                                <Flame className="size-3.5 text-rose-500" />
                                <span>2. Pain Details</span>
                              </span>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                                <div>
                                  <span className="text-muted-foreground block text-[10px]">
                                    Areas:
                                  </span>
                                  <span className="font-bold text-foreground">
                                    {rec.painAreasList.join(", ") || "None"}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground block text-[10px]">
                                    Side:
                                  </span>
                                  <span className="font-bold text-foreground">
                                    {rec.painSide || "---"}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground block text-[10px]">
                                    Duration:
                                  </span>
                                  <span className="font-bold text-foreground">
                                    {rec.duration || "---"}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground block text-[10px]">
                                    Character:
                                  </span>
                                  <span className="font-bold text-foreground">
                                    {rec.painTypesList.join(", ") || "---"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* 3. Pain Scale & Triggers */}
                            <div className="space-y-1.5 p-3 rounded-xl bg-card border border-border/60">
                              <span className="font-bold text-xs text-foreground uppercase tracking-wider flex items-center gap-1.5">
                                <Activity className="size-3.5 text-amber-500" />
                                <span>3. Triggers &amp; Relief</span>
                              </span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                                <div className="p-2 rounded-lg bg-rose-500/5 border border-rose-500/20">
                                  <span className="text-rose-600 font-bold block text-[10px] uppercase">
                                    Increases with:
                                  </span>
                                  <span className="text-foreground">
                                    {rec.aggravatingFactorsList.join(", ") ||
                                      "None recorded"}
                                  </span>
                                </div>
                                <div className="p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                                  <span className="text-emerald-600 font-bold block text-[10px] uppercase">
                                    Reduces with:
                                  </span>
                                  <span className="text-foreground">
                                    {rec.relievingFactorsList.join(", ") ||
                                      "None recorded"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* 4. History & 5. Limitations */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="p-3 rounded-xl bg-card border border-border/60 space-y-1.5 text-xs">
                                <span className="font-bold text-xs text-foreground block">
                                  4. Medical History
                                </span>
                                <div className="space-y-1 text-muted-foreground text-[11px]">
                                  <div>
                                    Injury/Accident:{" "}
                                    <strong className="text-foreground">
                                      {rec.injuryAccident
                                        ? `Yes (${rec.injuryDetails || "Documented"})`
                                        : "No"}
                                    </strong>
                                  </div>
                                  <div>
                                    Surgery:{" "}
                                    <strong className="text-foreground">
                                      {rec.surgeryHistory
                                        ? `Yes (${rec.surgeryDetails || "Documented"})`
                                        : "No"}
                                    </strong>
                                  </div>
                                  <div>
                                    Previous Care:{" "}
                                    <strong className="text-foreground">
                                      {rec.previousTreatment || "None"}
                                    </strong>
                                  </div>
                                </div>
                              </div>

                              <div className="p-3 rounded-xl bg-card border border-border/60 space-y-1.5 text-xs">
                                <span className="font-bold text-xs text-foreground block">
                                  5. Functional Limitations
                                </span>
                                <div className="flex flex-wrap gap-1 pt-0.5">
                                  {rec.functionalLimitationsList.length > 0 ? (
                                    rec.functionalLimitationsList.map((lim) => (
                                      <span
                                        key={lim}
                                        className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 text-[10px] font-bold"
                                      >
                                        {lim}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-muted-foreground text-xs">
                                      None noted
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Right Column in Detailed View */}
                          <div className="space-y-3">
                            {/* 6. Physical Examination */}
                            <div className="p-3 rounded-xl bg-card border border-border/60 space-y-2 text-xs">
                              <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                                <HeartPulse className="size-3.5 text-teal-500" />
                                <span>6. Physical Examination</span>
                              </span>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-0.5">
                                <div className="p-1.5 rounded-lg bg-muted/40 border border-border/40 text-center">
                                  <span className="text-[10px] text-muted-foreground block">
                                    ROM
                                  </span>
                                  <strong className="text-foreground">
                                    {rec.rom || "Normal"}
                                  </strong>
                                </div>
                                <div className="p-1.5 rounded-lg bg-muted/40 border border-border/40 text-center">
                                  <span className="text-[10px] text-muted-foreground block">
                                    Spasm
                                  </span>
                                  <strong className="text-foreground">
                                    {rec.muscleSpasm ? "Yes" : "No"}
                                  </strong>
                                </div>
                                <div className="p-1.5 rounded-lg bg-muted/40 border border-border/40 text-center">
                                  <span className="text-[10px] text-muted-foreground block">
                                    Tenderness
                                  </span>
                                  <strong className="text-foreground">
                                    {rec.tenderness ? "Yes" : "No"}
                                  </strong>
                                </div>
                                <div className="p-1.5 rounded-lg bg-muted/40 border border-border/40 text-center">
                                  <span className="text-[10px] text-muted-foreground block">
                                    Swelling
                                  </span>
                                  <strong className="text-foreground">
                                    {rec.swelling ? "Yes" : "No"}
                                  </strong>
                                </div>
                              </div>
                              {rec.physicalExamNotes && (
                                <p className="text-muted-foreground italic text-[11px] pt-1">
                                  Note: {rec.physicalExamNotes}
                                </p>
                              )}
                            </div>

                            {/* 7 & 8. Diagnosis & Treatment Plan */}
                            <div className="p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/20 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-xs text-sky-900 dark:text-sky-200 flex items-center gap-1.5">
                                  <Stethoscope className="size-4" />
                                  <span>Prescribed Treatment Plan</span>
                                </span>
                                {rec.diagnosis && (
                                  <Badge className="bg-sky-600 text-white font-bold text-xs">
                                    Dx: {rec.diagnosis}
                                  </Badge>
                                )}
                              </div>

                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {rec.treatmentPlansList.map((plan) => (
                                  <span
                                    key={plan}
                                    className="px-2.5 py-1 rounded-lg bg-sky-600 text-white font-bold text-xs shadow-2xs"
                                  >
                                    {plan}
                                  </span>
                                ))}
                              </div>

                              {rec.treatmentNotes && (
                                <p className="text-xs text-foreground pt-1 bg-background/60 p-2 rounded-lg border border-border/40">
                                  <strong>Protocol:</strong>{" "}
                                  {rec.treatmentNotes}
                                </p>
                              )}
                            </div>

                            {/* 9. Home Advice & Progress */}
                            <div className="p-3 rounded-xl bg-card border border-border/60 space-y-2 text-xs">
                              <span className="font-bold text-xs text-foreground block">
                                9. Home Advice &amp; Progress
                              </span>
                              <div className="grid grid-cols-2 gap-2 text-[11px]">
                                <div>
                                  Exercise Explained:{" "}
                                  <strong className="text-foreground">
                                    {rec.exerciseExplained ? "Yes" : "No"}
                                  </strong>
                                </div>
                                <div>
                                  Posture Advice:{" "}
                                  <strong className="text-foreground">
                                    {rec.homePostureAdvice ? "Yes" : "No"}
                                  </strong>
                                </div>
                              </div>

                              {rec.improvement && (
                                <div className="text-[11px] pt-1">
                                  <span className="text-muted-foreground">
                                    Improvement:
                                  </span>{" "}
                                  <strong className="text-foreground">
                                    {rec.improvement}
                                  </strong>
                                </div>
                              )}

                              {rec.doctorSignature && (
                                <div className="text-[11px] font-mono text-muted-foreground pt-1 border-t border-border/40">
                                  Signed by:{" "}
                                  <strong className="text-foreground">
                                    {rec.doctorSignature}
                                  </strong>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Hidden Printable Voucher Container Mounted for Isolated Print Support */}
        {activeRecord && (
          <div className="fixed -left-[9999px] top-0 pointer-events-none opacity-0" aria-hidden="true">
            <MedicalRecordVoucher
              patient={patient}
              record={activeRecord}
              allRecords={records}
              containerId="patient-medical-checkup-print"
            />
          </div>
        )}

        <DialogFooter className="shrink-0 p-3 sm:p-4 border-t border-border/60 bg-muted/20 flex items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            {records.length > 0 && activeRecord && (
              <span>
                Selected: <strong>{new Date(activeRecord.assessmentDate).toLocaleDateString("en-GB")}</strong> (5.5″ × 8.27″ HPC Format)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {records.length > 0 && (
              <Button
                type="button"
                size="sm"
                onClick={() => handlePrint()}
                className="h-8 text-xs font-bold gap-1.5 cursor-pointer shadow-xs"
              >
                <Printer className="size-3.5" />
                <span>Print Document</span>
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs cursor-pointer"
            >
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * High-resolution Clinical Medical Checkup File formatted for 5.5″ × 8.27″ HPC standard cut paper
 */
function MedicalRecordVoucher({
  patient,
  record,
  allRecords,
  containerId = "patient-medical-checkup-print",
}: {
  patient: HistoryPatientInfo | null;
  record: ParsedRecord;
  allRecords: ParsedRecord[];
  containerId?: string;
}) {
  const recDateFormatted = new Date(record.assessmentDate).toLocaleDateString(
    "en-GB",
    { day: "2-digit", month: "short", year: "numeric" },
  );

  const diagnosis =
    record.diagnosis || "Physiotherapy & Rehabilitation Evaluation";

  return (
    <div
      id={containerId}
      className="w-full max-w-[500px] min-h-[750px] bg-white text-black p-4 sm:p-5 rounded-xs border border-black shadow-xl font-sans text-xs leading-normal flex flex-col justify-between"
    >
      {/* Top Section */}
      <div className="space-y-2">
        {/* Formal Letterhead with Official Logo */}
        <div className="flex items-start justify-between border-b-2 border-black pb-2 mb-1.5">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.jpg"
              alt="Health & Pain Care Center Logo"
              className="size-13 sm:size-14 object-contain shrink-0"
            />
            <div>
              <h1 className="font-black text-sm sm:text-base tracking-tight uppercase text-black leading-tight">
                {CLINIC_CONFIG.name}
              </h1>
              <p className="text-[10px] font-bold text-neutral-800 tracking-wide">
                {CLINIC_CONFIG.nameBangla}
              </p>
              <p className="text-[8.5px] font-medium text-neutral-600 pt-0.5">
                {CLINIC_CONFIG.tagline}
              </p>
            </div>
          </div>

          <div className="text-right text-[9px] text-neutral-800 space-y-0.5">
            <p className="font-bold text-black flex items-center justify-end gap-1">
              <Phone className="size-2.5 text-black" />
              <span>Hotline: {CLINIC_CONFIG.phone}</span>
            </p>
            <p className="text-neutral-700 max-w-[170px] text-right text-[8.5px] leading-tight">
              {CLINIC_CONFIG.addressBangla}
            </p>
            <p className="text-neutral-600 font-mono text-[8px]">
              {CLINIC_CONFIG.city}, Bangladesh
            </p>
          </div>
        </div>

        {/* Document Title & Voucher Bar */}
        <div className="flex items-center justify-between border-y border-black py-1 mb-1.5 bg-neutral-50 print:bg-white">
          <div className="flex items-center gap-2">
            <span className="bg-black text-white font-black text-[9px] tracking-wider uppercase px-2 py-0.5 rounded-xs">
              MEDICAL CHECKUP FILE
            </span>
            <span className="text-[10px] font-bold text-black">
              চিকিৎসা মূল্যায়ন ও ফাইল
            </span>
          </div>
          <div className="text-[9.5px] text-right font-mono">
            <span className="text-neutral-600 mr-1 font-medium">Date:</span>
            <span className="font-black text-black">{recDateFormatted}</span>
          </div>
        </div>

        {/* Patient Demographics Strip */}
        <div className="grid grid-cols-4 gap-1.5 p-2 bg-white border border-neutral-800 rounded-xs mb-1.5 text-[10px]">
          <div>
            <span className="text-neutral-600 block text-[8px] font-medium">Patient Name:</span>
            <span className="font-bold text-black uppercase truncate block">
              {patient?.name || "Patient"}
            </span>
          </div>
          <div>
            <span className="text-neutral-600 block text-[8px] font-medium">MRN (ID):</span>
            <span className="font-mono font-bold text-black block">
              {patient?.mrn || patient?.id.slice(-6).toUpperCase() || "N/A"}
            </span>
          </div>
          <div>
            <span className="text-neutral-600 block text-[8px] font-medium">Age / Gender:</span>
            <span className="font-semibold text-black block">
              {record.age ? `${record.age} Yrs` : patient?.age ? `${patient.age} Yrs` : "N/A"} • {patient?.gender || "N/A"}
            </span>
          </div>
          <div>
            <span className="text-neutral-600 block text-[8px] font-medium">Contact Phone:</span>
            <span className="font-mono font-bold text-black block">
              {patient?.phone || "N/A"}
            </span>
          </div>
        </div>

        {/* Provisional Clinical Diagnosis Banner */}
        <div className="border border-black rounded-xs p-1.5 mb-1.5 bg-neutral-50 print:bg-white">
          <span className="text-[8.5px] font-black text-black uppercase tracking-wider block">
            PROVISIONAL CLINICAL DIAGNOSIS / রোগ নির্ণয়:
          </span>
          <p className="text-xs font-black text-black mt-0.5 leading-snug">
            {diagnosis}
          </p>
        </div>

        {/* Clinical Findings & Pain Assessment (2-column layout) */}
        <div className="grid grid-cols-2 gap-1.5 mb-1.5">
          {/* Left Column: Complaints & Pain Profile */}
          <div className="border border-neutral-800 rounded-xs p-1.5 space-y-1 bg-white text-[9px]">
            <h3 className="font-black text-[9.5px] uppercase tracking-wide text-black border-b border-black pb-0.5 flex items-center justify-between">
              <span>Clinical Pain Profile</span>
              <Activity className="size-2.5 text-black" />
            </h3>

            <div>
              <span className="text-neutral-600 text-[8px] block font-medium">Chief Areas:</span>
              <span className="font-bold text-black">
                {record.painAreasList.join(", ") || "None recorded"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1 text-[8.5px]">
              <div>
                <span className="text-neutral-600 block text-[7.5px]">Side:</span>
                <span className="font-bold text-black">{record.painSide || "---"}</span>
              </div>
              <div>
                <span className="text-neutral-600 block text-[7.5px]">Duration:</span>
                <span className="font-bold text-black">{record.duration || "---"}</span>
              </div>
            </div>

            {/* VAS Score Box */}
            <div className="p-1 bg-neutral-50 rounded-xs flex items-center justify-between border border-neutral-600">
              <span className="font-bold text-[8.5px] text-black">VAS Score (0-10):</span>
              <span className="font-black font-mono text-[10px] text-black">
                {record.vasScore !== null ? `${record.vasScore}/10` : "N/A"}
                {record.followUpVasScore !== null && (
                  <span className="text-[8.5px] font-normal text-neutral-700 ml-1">
                    → Post: {record.followUpVasScore}/10
                  </span>
                )}
              </span>
            </div>

            <div className="text-[8px] space-y-0.5 pt-0.5">
              <div>
                <span className="text-neutral-600 font-semibold">Increases with: </span>
                <span className="text-black">{record.aggravatingFactorsList.join(", ") || "---"}</span>
              </div>
              <div>
                <span className="text-neutral-600 font-semibold">Reduces with: </span>
                <span className="text-black">{record.relievingFactorsList.join(", ") || "---"}</span>
              </div>
            </div>
          </div>

          {/* Right Column: Physical Examination */}
          <div className="border border-neutral-800 rounded-xs p-1.5 space-y-1 bg-white text-[9px]">
            <h3 className="font-black text-[9.5px] uppercase tracking-wide text-black border-b border-black pb-0.5 flex items-center justify-between">
              <span>Physical Examination</span>
              <HeartPulse className="size-2.5 text-black" />
            </h3>

            <div className="grid grid-cols-2 gap-1 text-[8.5px]">
              <div>
                <span className="text-neutral-600 block text-[7.5px]">ROM:</span>
                <span className="font-bold text-black">{record.rom || "Normal"}</span>
              </div>
              <div>
                <span className="text-neutral-600 block text-[7.5px]">Spasm:</span>
                <span className="font-bold text-black">{record.muscleSpasm ? "Present (+)" : "Absent (-)"}</span>
              </div>
              <div>
                <span className="text-neutral-600 block text-[7.5px]">Tenderness:</span>
                <span className="font-bold text-black">{record.tenderness ? "Present (+)" : "Absent (-)"}</span>
              </div>
              <div>
                <span className="text-neutral-600 block text-[7.5px]">Swelling:</span>
                <span className="font-bold text-black">{record.swelling ? "Present (+)" : "Absent (-)"}</span>
              </div>
            </div>

            {record.physicalExamNotes && (
              <div className="pt-0.5 border-t border-neutral-200">
                <span className="text-neutral-600 text-[7.5px] block">Notes:</span>
                <p className="italic text-neutral-800 text-[8px] leading-tight">
                  {record.physicalExamNotes}
                </p>
              </div>
            )}

            <div className="pt-0.5 border-t border-neutral-200 text-[8px]">
              <span className="text-neutral-600 block text-[7.5px]">Past History:</span>
              <span>
                Injury: <strong>{record.injuryAccident ? (record.injuryDetails || "Yes") : "No"}</strong> •
                Surgery: <strong>{record.surgeryHistory ? (record.surgeryDetails || "Yes") : "No"}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Prescribed Physical Therapy Modalities */}
        <div className="border border-black rounded-xs p-1.5 mb-1.5 bg-white">
          <div className="flex items-center justify-between border-b border-black pb-0.5 mb-1">
            <h3 className="font-black text-[10px] uppercase tracking-wide text-black">
              ℞ Prescribed Physical Therapy Modalities (থেরাপি প্রেসক্রিপশন)
            </h3>
            <span className="text-[8px] font-mono font-bold text-neutral-600">
              {record.treatmentPlansList.length} Modalities
            </span>
          </div>

          <div className="flex flex-wrap gap-1">
            {record.treatmentPlansList.length > 0 ? (
              record.treatmentPlansList.map((modality, idx) => (
                <span
                  key={modality}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-neutral-100 text-black border border-neutral-800 rounded-xs text-[9px] font-bold"
                >
                  <span className="size-3 rounded-full bg-black text-white font-bold flex items-center justify-center text-[7.5px]">
                    {idx + 1}
                  </span>
                  <span>{modality}</span>
                </span>
              ))
            ) : (
              <p className="text-[9px] text-neutral-600 italic">
                Standard Conservative Physiotherapy Protocol prescribed.
              </p>
            )}
          </div>

          {record.treatmentNotes && (
            <div className="mt-1 pt-0.5 border-t border-neutral-300 text-[8.5px]">
              <span className="font-bold text-black">Therapist Protocol: </span>
              <span className="text-neutral-800">{record.treatmentNotes}</span>
            </div>
          )}
        </div>

        {/* Home Advice & Posture Guidelines */}
        <div className="border border-neutral-800 rounded-xs p-1.5 mb-1 bg-white text-[8.5px]">
          <span className="font-black text-black block text-[9px] uppercase tracking-wide">
            Home Advice &amp; Posture Care (গৃহ নির্দেশিকা):
          </span>
          <div className="grid grid-cols-2 gap-1 text-[8px] text-neutral-800 pt-0.5">
            <div>
              • Exercise Explained: <strong>{record.exerciseExplained ? "Yes" : "No"}</strong>
            </div>
            <div>
              • Posture Advice: <strong>{record.homePostureAdvice ? "Yes" : "No"}</strong>
            </div>
          </div>
          <p className="text-[7.5px] text-neutral-600 pt-0.5">
            Avoid prolonged sitting, forward bending, and heavy lifting. Perform gentle stretches daily.
          </p>
        </div>

        {/* Multi-Visit Trajectory Strip if multiple assessments exist */}
        {allRecords.length > 1 && (
          <div className="border border-neutral-300 rounded-xs p-1 bg-neutral-50 text-[7.5px]">
            <span className="font-bold text-neutral-700">Assessment Trajectory: </span>
            <span className="text-neutral-600">
              {allRecords
                .slice()
                .reverse()
                .map((r, i) => {
                  const d = new Date(r.assessmentDate).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                  });
                  return `Visit #${i + 1} (${d}, VAS: ${r.vasScore ?? "N/A"})`;
                })
                .join(" → ")}
            </span>
          </div>
        )}
      </div>

      {/* Bottom Footer & Signature */}
      <div className="pt-1.5 border-t border-black mt-1">
        <div className="flex justify-between items-end pb-1">
          <div className="text-[7.5px] text-neutral-600 space-y-0.5">
            <p className="font-bold text-black">{CLINIC_CONFIG.name} Medical Desk</p>
            <p>{CLINIC_CONFIG.fullLocation}</p>
            <p>Official Patient Assessment Record • Valid with Specialist Signature</p>
          </div>

          <div className="text-center w-36">
            <div className="border-b border-black pb-0.5 mb-0.5">
              <p className="font-bold text-[9px] text-black">
                {record.doctorSignature || record.doctor?.name || "Consultant Physiotherapist"}
              </p>
            </div>
            <p className="text-[7px] text-neutral-600 uppercase tracking-wider font-semibold">
              Authorized Specialist Signature
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
