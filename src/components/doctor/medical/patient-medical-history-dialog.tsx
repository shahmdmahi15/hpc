"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
} from "lucide-react";

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

  React.useEffect(() => {
    let ignore = false;
    if (isOpen && patient?.id) {
      getPatientMedicalHistoryAction(patient.id)
        .then((res) => {
          if (ignore) return;
          if (res.success && res.records) {
            setRecords(res.records as unknown as ParsedRecord[]);
            if (res.records.length > 0) {
              setExpandedRecordId(res.records[0].id);
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

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] sm:max-w-5xl md:max-w-6xl lg:max-w-7xl max-h-[92vh] flex flex-col p-0 overflow-hidden shadow-2xl rounded-2xl border border-border/80">
        {/* Header */}
        <DialogHeader className="p-3.5 sm:p-4 bg-muted/40 border-b border-border space-y-2 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                <FolderOpen className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-black tracking-tight text-foreground">
                  Patient Medical Checkup History &amp; Files
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Complete timeline of clinical evaluations, pain progression, and prescribed treatment modalities.
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Button
                size="sm"
                variant="outline"
                onClick={handlePrint}
                className="text-xs h-8 cursor-pointer gap-1.5"
              >
                <Printer className="size-3.5" />
                <span>Print File</span>
              </Button>

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
                  <span>Create New File</span>
                </Button>
              )}
            </div>
          </div>

          {/* Patient Quick Details */}
          {patient && (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2 pt-2 text-xs font-mono text-muted-foreground border-t border-border/50 bg-background/50 p-2 rounded-lg">
              <div>
                <strong className="text-foreground">Patient:</strong> {patient.name}
              </div>
              <div>
                <strong className="text-foreground">ID / MRN:</strong>{" "}
                {patient.mrn || patient.id.slice(-6).toUpperCase()}
              </div>
              <div>
                <strong className="text-foreground">Gender:</strong> {patient.gender}
              </div>
              <div>
                <strong className="text-foreground">Phone:</strong> {patient.phone || "---"}
              </div>
              <div className="col-span-2 sm:col-span-1 flex items-center gap-1.5">
                <strong className="text-foreground">Total Files:</strong>
                <Badge variant="secondary" className="text-[10px] font-bold px-2 py-0">
                  {records.length} {records.length === 1 ? "Record" : "Records"}
                </Badge>
              </div>
            </div>
          )}
        </DialogHeader>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
          {isLoading ? (
            <div className="py-16 text-center text-xs text-muted-foreground space-y-3">
              <div className="size-7 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="font-semibold">Loading medical assessment history...</p>
            </div>
          ) : records.length === 0 ? (
            <div className="py-16 text-center space-y-3 border-2 border-dashed border-border/80 rounded-2xl p-6 max-w-lg mx-auto">
              <div className="size-12 rounded-2xl bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                <FileText className="size-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-foreground">No previous medical files found</p>
                <p className="text-xs text-muted-foreground">
                  This patient does not have any saved physiotherapy assessments or checkups yet.
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
          ) : (
            <div className="space-y-3.5">
              {records.map((rec, index) => {
                const isExpanded = expandedRecordId === rec.id;
                const recDate = new Date(rec.assessmentDate).toLocaleDateString("en-GB", {
                  weekday: "short",
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                });

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
                      onClick={() => setExpandedRecordId(isExpanded ? null : rec.id)}
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
                              <Badge variant="outline" className="text-xs font-bold py-0.5 bg-background border-border">
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
                              <span>• Area: {rec.painAreasList.join(", ")}</span>
                            )}
                            {rec.occupation && (
                              <span>• {rec.occupation}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
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
                                  <span className="text-muted-foreground block text-[10px]">Areas:</span>
                                  <span className="font-bold text-foreground">
                                    {rec.painAreasList.join(", ") || "None"}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground block text-[10px]">Side:</span>
                                  <span className="font-bold text-foreground">{rec.painSide || "---"}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground block text-[10px]">Duration:</span>
                                  <span className="font-bold text-foreground">{rec.duration || "---"}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground block text-[10px]">Character:</span>
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
                                    {rec.aggravatingFactorsList.join(", ") || "None recorded"}
                                  </span>
                                </div>
                                <div className="p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                                  <span className="text-emerald-600 font-bold block text-[10px] uppercase">
                                    Reduces with:
                                  </span>
                                  <span className="text-foreground">
                                    {rec.relievingFactorsList.join(", ") || "None recorded"}
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
                                      {rec.injuryAccident ? `Yes (${rec.injuryDetails || "Documented"})` : "No"}
                                    </strong>
                                  </div>
                                  <div>
                                    Surgery:{" "}
                                    <strong className="text-foreground">
                                      {rec.surgeryHistory ? `Yes (${rec.surgeryDetails || "Documented"})` : "No"}
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
                                    <span className="text-muted-foreground text-xs">None noted</span>
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
                                  <span className="text-[10px] text-muted-foreground block">ROM</span>
                                  <strong className="text-foreground">{rec.rom || "Normal"}</strong>
                                </div>
                                <div className="p-1.5 rounded-lg bg-muted/40 border border-border/40 text-center">
                                  <span className="text-[10px] text-muted-foreground block">Spasm</span>
                                  <strong className="text-foreground">{rec.muscleSpasm ? "Yes" : "No"}</strong>
                                </div>
                                <div className="p-1.5 rounded-lg bg-muted/40 border border-border/40 text-center">
                                  <span className="text-[10px] text-muted-foreground block">Tenderness</span>
                                  <strong className="text-foreground">{rec.tenderness ? "Yes" : "No"}</strong>
                                </div>
                                <div className="p-1.5 rounded-lg bg-muted/40 border border-border/40 text-center">
                                  <span className="text-[10px] text-muted-foreground block">Swelling</span>
                                  <strong className="text-foreground">{rec.swelling ? "Yes" : "No"}</strong>
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
                                  <strong>Protocol:</strong> {rec.treatmentNotes}
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
                                  <span className="text-muted-foreground">Improvement:</span>{" "}
                                  <strong className="text-foreground">{rec.improvement}</strong>
                                </div>
                              )}

                              {rec.doctorSignature && (
                                <div className="text-[11px] font-mono text-muted-foreground pt-1 border-t border-border/40">
                                  Signed by: <strong className="text-foreground">{rec.doctorSignature}</strong>
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
      </DialogContent>
    </Dialog>
  );
}
