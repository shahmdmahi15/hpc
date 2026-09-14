"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Save,
  Check,
  Plus,
  Flame,
  Activity,
  HeartPulse,
  Stethoscope,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import {
  getActiveClinicalConfigAction,
  createMedicalRecordAction,
  type ActiveClinicalConfig,
} from "@/actions/doctor/medical-record.action";
import { toast } from "sonner";
import type { AppointmentWithRelations } from "@/actions/receptionist/appointment.action";

interface CreateMedicalRecordDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  appointment?: AppointmentWithRelations | null;
  doctorId?: string;
  onSuccess?: () => void;
}

interface FormInnerProps {
  appointment?: AppointmentWithRelations | null;
  doctorId?: string;
  config: ActiveClinicalConfig;
  onClose: () => void;
  onSuccess?: () => void;
}

const COMMON_DIAGNOSES = [
  "Lumbar Spondylosis",
  "Cervical Radiculopathy",
  "OA Knee (Bilateral)",
  "OA Knee (Unilateral)",
  "Frozen Shoulder (Adhesive Capsulitis)",
  "Sciatica",
  "Mechanical Low Back Pain",
  "Plantar Fasciitis",
  "Tennis Elbow",
  "Ankle Sprain",
];

function CreateMedicalRecordForm({
  appointment,
  doctorId,
  config,
  onClose,
  onSuccess,
}: FormInnerProps) {
  const patient = appointment?.patient;

  // Personal Info
  const [age, setAge] = React.useState<string>(
    patient?.age ? String(patient.age) : "",
  );
  const [occupation, setOccupation] = React.useState("");

  // Section 2: Pain Details
  const [selectedPainAreas, setSelectedPainAreas] = React.useState<string[]>([
    "Back",
  ]);
  const [customPainArea, setCustomPainArea] = React.useState("");
  const [painSide, setPainSide] = React.useState<
    "Right" | "Left" | "Both" | "N/A"
  >("Both");
  const [duration, setDuration] = React.useState("");
  const [selectedPainTypes, setSelectedPainTypes] = React.useState<string[]>([
    "Dull",
  ]);

  // Section 3: Pain Scale & Triggers
  const [vasScore, setVasScore] = React.useState<number>(5);
  const [selectedAggravating, setSelectedAggravating] = React.useState<
    string[]
  >(["Movement", "Sitting"]);
  const [selectedRelieving, setSelectedRelieving] = React.useState<string[]>([
    "Rest",
  ]);

  // Section 4: History
  const [injuryAccident, setInjuryAccident] = React.useState<boolean>(false);
  const [injuryDetails, setInjuryDetails] = React.useState("");
  const [postureAdviceGiven, setPostureAdviceGiven] =
    React.useState<boolean>(false);
  const [surgeryHistory, setSurgeryHistory] = React.useState<boolean>(false);
  const [surgeryDetails, setSurgeryDetails] = React.useState("");
  const [previousTreatment, setPreviousTreatment] = React.useState<
    "Medicine" | "Physiotherapy" | "Both" | "None"
  >("None");

  // Section 5: Functional Limitations
  const [selectedLimitations, setSelectedLimitations] = React.useState<
    string[]
  >(["Bending", "Sitting"]);

  // Section 6: Physical Examination
  const [rom, setRom] = React.useState<"Normal" | "Restricted">("Normal");
  const [muscleSpasm, setMuscleSpasm] = React.useState<boolean>(false);
  const [tenderness, setTenderness] = React.useState<boolean>(false);
  const [swelling, setSwelling] = React.useState<boolean>(false);
  const [physicalExamNotes, setPhysicalExamNotes] = React.useState("");

  // Section 7: Diagnosis
  const [diagnosis, setDiagnosis] = React.useState("");

  // Section 8: Treatment Plan (Dynamic Admin Modalities)
  const [selectedTreatments, setSelectedTreatments] = React.useState<string[]>([
    "Hot pack",
    "IFT / TENS",
  ]);
  const [treatmentNotes, setTreatmentNotes] = React.useState("");

  // Section 9: Home Advice
  const [exerciseExplained, setExerciseExplained] =
    React.useState<boolean>(true);
  const [homePostureAdvice, setHomePostureAdvice] =
    React.useState<boolean>(true);

  // Follow-up & Progress
  const [followUpVasScore, setFollowUpVasScore] = React.useState<string>("");
  const [improvement, setImprovement] = React.useState("");
  const [doctorSignature, setDoctorSignature] = React.useState("");

  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const toggleArrayItem = (
    list: string[],
    setList: (items: string[]) => void,
    item: string,
  ) => {
    if (list.includes(item)) {
      setList(list.filter((x) => x !== item));
    } else {
      setList([...list, item]);
    }
  };

  const handleAddCustomPainArea = () => {
    if (!customPainArea.trim()) return;
    if (!selectedPainAreas.includes(customPainArea.trim())) {
      setSelectedPainAreas([...selectedPainAreas, customPainArea.trim()]);
    }
    setCustomPainArea("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patient) {
      toast.error("No active patient selected.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createMedicalRecordAction({
        patientId: patient.id,
        appointmentId: appointment?.id,
        doctorId: doctorId,
        age: age ? parseInt(age, 10) : undefined,
        occupation: occupation.trim() || undefined,

        // 2. Pain details
        painAreas: selectedPainAreas,
        painSide,
        duration: duration.trim() || undefined,
        painTypes: selectedPainTypes,

        // 3. Pain scale
        vasScore,
        aggravatingFactors: selectedAggravating,
        relievingFactors: selectedRelieving,

        // 4. History
        injuryAccident,
        injuryDetails: injuryAccident
          ? injuryDetails.trim() || undefined
          : undefined,
        postureAdviceGiven,
        surgeryHistory,
        surgeryDetails: surgeryHistory
          ? surgeryDetails.trim() || undefined
          : undefined,
        previousTreatment,

        // 5. Limitations
        functionalLimitations: selectedLimitations,

        // 6. Physical exam
        rom,
        muscleSpasm,
        tenderness,
        swelling,
        physicalExamNotes: physicalExamNotes.trim() || undefined,

        // 7. Diagnosis
        diagnosis: diagnosis.trim() || undefined,

        // 8. Treatment
        treatmentPlans: selectedTreatments,
        treatmentNotes: treatmentNotes.trim() || undefined,

        // 9. Home advice
        exerciseExplained,
        homePostureAdvice,

        // Follow up
        followUpVasScore: followUpVasScore
          ? parseInt(followUpVasScore, 10)
          : undefined,
        improvement: improvement.trim() || undefined,
        doctorSignature: doctorSignature.trim() || undefined,
      });

      if (res.success) {
        toast.success(res.message);
        onClose();
        onSuccess?.();
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Failed to save medical assessment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
      {/* Header matching physical assessment form */}
      <DialogHeader className="p-3.5 sm:p-4 bg-muted/40 border-b border-border space-y-2 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <FileText className="size-5" />
            </div>
            <div>
              <div className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <span>HEALTH AND PAIN CARE CENTER</span>
                <span className="text-muted-foreground font-normal">•</span>
                <span className="text-muted-foreground font-medium lowercase">
                  clinical file assessment
                </span>
              </div>
              <DialogTitle className="text-base sm:text-lg font-black tracking-tight text-foreground">
                PAIN PHYSIOTHERAPY ASSESSMENT
              </DialogTitle>
            </div>
          </div>

          {patient && (
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="outline"
                className="text-xs font-mono font-bold py-1 px-2.5 bg-background border-border shadow-2xs"
              >
                MRN: {patient.mrn || patient.id.slice(-6).toUpperCase()}
              </Badge>
              <Badge
                variant="secondary"
                className="text-xs font-bold py-1 px-2.5 uppercase"
              >
                {patient.gender}
              </Badge>
            </div>
          )}
        </div>

        {/* Patient Demographic Summary Strip */}
        {patient && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2 pt-2 text-xs font-mono border-t border-border/50 text-muted-foreground bg-background/50 p-2 rounded-lg">
            <div>
              <span className="text-foreground font-bold">Patient:</span>{" "}
              <span className="font-semibold text-foreground">
                {patient.name}
              </span>
            </div>
            <div>
              <span className="text-foreground font-bold">Phone:</span>{" "}
              {patient.phone}
            </div>
            <div>
              <span className="text-foreground font-bold">Age:</span>{" "}
              {age || "---"}
            </div>
            <div>
              <span className="text-foreground font-bold">Gender:</span>{" "}
              {patient.gender}
            </div>
            <div className="col-span-2 sm:col-span-1">
              <span className="text-foreground font-bold">Date:</span>{" "}
              {new Date().toLocaleDateString("en-GB")}
            </div>
          </div>
        )}
      </DialogHeader>

      {/* Main Wide Scrollable Content - 2 Column Balanced Layout on LG */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 text-xs">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 items-start">
          {/* ========================================= */}
          {/* LEFT COLUMN: Clinical Assessment & Exam   */}
          {/* ========================================= */}
          <div className="space-y-4">
            {/* Top Demographics Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-card border border-border shadow-2xs">
              <div className="space-y-1">
                <label className="font-bold text-foreground flex items-center justify-between">
                  <span>Patient Age</span>
                  <span className="text-[10px] text-muted-foreground">
                    Years
                  </span>
                </label>
                <Input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="e.g. 35"
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-foreground">
                  Occupation / Daily Activity
                </label>
                <Input
                  value={occupation}
                  onChange={(e) => setOccupation(e.target.value)}
                  placeholder="e.g. Desk Worker, Teacher, Driver..."
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Section 2: Pain Details */}
            <div className="p-3.5 rounded-xl bg-card border border-border shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <div className="flex items-center gap-1.5 font-bold text-sm text-foreground">
                  <Flame className="size-4 text-rose-500" />
                  <span>2. Pain Details</span>
                </div>
                <span className="text-[11px] text-muted-foreground font-mono">
                  {selectedPainAreas.length} selected
                </span>
              </div>

              {/* Pain Areas (Dynamic chips from Admin) */}
              <div className="space-y-1.5">
                <label className="font-bold text-foreground flex items-center justify-between">
                  <span>Pain Area(s):</span>
                  <span className="text-[10px] text-muted-foreground font-normal">
                    Select all that apply
                  </span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {config.painAreas.map((area) => {
                    const isSelected = selectedPainAreas.includes(area);
                    return (
                      <button
                        key={area}
                        type="button"
                        onClick={() =>
                          toggleArrayItem(
                            selectedPainAreas,
                            setSelectedPainAreas,
                            area,
                          )
                        }
                        className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                          isSelected
                            ? "bg-rose-500 text-white border-rose-600 shadow-2xs"
                            : "bg-background border-border text-foreground hover:bg-muted"
                        }`}
                      >
                        {isSelected && <Check className="size-3" />}
                        <span>{area}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Add Custom Area */}
                <div className="flex items-center gap-1.5 pt-1">
                  <Input
                    value={customPainArea}
                    onChange={(e) => setCustomPainArea(e.target.value)}
                    placeholder="Other pain area..."
                    className="h-7 text-xs max-w-xs"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddCustomPainArea();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={handleAddCustomPainArea}
                    className="h-7 text-xs cursor-pointer gap-1"
                  >
                    <Plus className="size-3" />
                    <span>Add Other</span>
                  </Button>
                </div>
              </div>

              {/* Side & Duration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="font-bold text-foreground">
                    Affected Side:
                  </label>
                  <div className="grid grid-cols-4 gap-1">
                    {(["Right", "Left", "Both", "N/A"] as const).map((side) => (
                      <button
                        key={side}
                        type="button"
                        onClick={() => setPainSide(side)}
                        className={`py-1 rounded-lg border text-xs font-semibold text-center transition-all cursor-pointer ${
                          painSide === side
                            ? "bg-sky-600 text-white border-sky-700 shadow-2xs"
                            : "bg-background border-border text-foreground hover:bg-muted"
                        }`}
                      >
                        {side}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-foreground">Duration:</label>
                  <Input
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="e.g. 3 days, 2 weeks, 6 months"
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              {/* Pain Types */}
              <div className="space-y-1.5 pt-1">
                <label className="font-bold text-foreground">
                  Pain Type / Character:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {config.painTypes.map((ptype) => {
                    const isSelected = selectedPainTypes.includes(ptype);
                    return (
                      <button
                        key={ptype}
                        type="button"
                        onClick={() =>
                          toggleArrayItem(
                            selectedPainTypes,
                            setSelectedPainTypes,
                            ptype,
                          )
                        }
                        className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                          isSelected
                            ? "bg-amber-600 text-white border-amber-700 shadow-2xs"
                            : "bg-background border-border text-foreground hover:bg-muted"
                        }`}
                      >
                        {isSelected && <Check className="size-3" />}
                        <span>{ptype}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Section 3: Pain Scale & Triggers */}
            <div className="p-3.5 rounded-xl bg-card border border-border shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <div className="flex items-center gap-1.5 font-bold text-sm text-foreground">
                  <Activity className="size-4 text-amber-500" />
                  <span>3. Pain Scale &amp; Factors</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-muted-foreground">
                    VAS:
                  </span>
                  <span
                    className={`font-mono font-black text-sm px-2 py-0.5 rounded-md ${
                      vasScore <= 3
                        ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                        : vasScore <= 6
                          ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                          : "bg-rose-500/20 text-rose-700 dark:text-rose-300"
                    }`}
                  >
                    {vasScore} / 10
                  </span>
                </div>
              </div>

              {/* Interactive VAS 0-10 Buttons */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[10px] text-muted-foreground font-semibold">
                  <span>0 - No Pain</span>
                  <span>5 - Moderate</span>
                  <span>10 - Worst Possible</span>
                </div>
                <div className="grid grid-cols-11 gap-1">
                  {Array.from({ length: 11 }, (_, i) => i).map((score) => {
                    const isSelected = vasScore === score;
                    let colorClass =
                      "hover:bg-emerald-50 dark:hover:bg-emerald-950/30";
                    if (score > 3 && score <= 6)
                      colorClass =
                        "hover:bg-amber-50 dark:hover:bg-amber-950/30";
                    if (score > 6)
                      colorClass = "hover:bg-rose-50 dark:hover:bg-rose-950/30";

                    return (
                      <button
                        key={score}
                        type="button"
                        onClick={() => setVasScore(score)}
                        className={`h-8 rounded-md border font-mono font-bold text-xs transition-all cursor-pointer ${
                          isSelected
                            ? score <= 3
                              ? "bg-emerald-600 text-white border-emerald-700 shadow-xs ring-2 ring-emerald-500/30"
                              : score <= 6
                                ? "bg-amber-600 text-white border-amber-700 shadow-xs ring-2 ring-amber-500/30"
                                : "bg-rose-600 text-white border-rose-700 shadow-xs ring-2 ring-rose-500/30"
                            : `bg-background border-border text-foreground ${colorClass}`
                        }`}
                      >
                        {score}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Aggravating & Relieving Factors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="space-y-1.5">
                  <label className="font-bold text-foreground">
                    Pain Increases With:
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {config.aggravatingFactors.map((factor) => {
                      const isSelected = selectedAggravating.includes(factor);
                      return (
                        <button
                          key={factor}
                          type="button"
                          onClick={() =>
                            toggleArrayItem(
                              selectedAggravating,
                              setSelectedAggravating,
                              factor,
                            )
                          }
                          className={`px-2 py-0.5 rounded-md border text-xs transition-all cursor-pointer ${
                            isSelected
                              ? "bg-rose-500/20 text-rose-800 dark:text-rose-200 border-rose-500/50 font-bold"
                              : "bg-background border-border text-foreground hover:bg-muted"
                          }`}
                        >
                          {factor}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-foreground">
                    Pain Reduces With:
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {config.relievingFactors.map((factor) => {
                      const isSelected = selectedRelieving.includes(factor);
                      return (
                        <button
                          key={factor}
                          type="button"
                          onClick={() =>
                            toggleArrayItem(
                              selectedRelieving,
                              setSelectedRelieving,
                              factor,
                            )
                          }
                          className={`px-2 py-0.5 rounded-md border text-xs transition-all cursor-pointer ${
                            isSelected
                              ? "bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 border-emerald-500/50 font-bold"
                              : "bg-background border-border text-foreground hover:bg-muted"
                          }`}
                        >
                          {factor}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 4: History & Section 5: Functional Limitations */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Medical History */}
              <div className="p-3.5 rounded-xl bg-card border border-border shadow-2xs space-y-2.5">
                <div className="font-bold text-sm text-foreground border-b border-border/60 pb-1.5">
                  4. Medical History
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span>Injury / Accident:</span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setInjuryAccident(true)}
                        className={`px-2.5 py-0.5 rounded text-xs font-bold border cursor-pointer ${
                          injuryAccident
                            ? "bg-rose-500 text-white border-rose-600"
                            : "bg-muted"
                        }`}
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => setInjuryAccident(false)}
                        className={`px-2.5 py-0.5 rounded text-xs font-bold border cursor-pointer ${
                          !injuryAccident
                            ? "bg-muted-foreground/20 text-foreground border-border"
                            : "bg-muted"
                        }`}
                      >
                        No
                      </button>
                    </div>
                  </div>
                  {injuryAccident && (
                    <Input
                      value={injuryDetails}
                      onChange={(e) => setInjuryDetails(e.target.value)}
                      placeholder="Details of accident / injury..."
                      className="h-7 text-xs"
                    />
                  )}

                  <div className="flex items-center justify-between">
                    <span>Surgery History:</span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setSurgeryHistory(true)}
                        className={`px-2.5 py-0.5 rounded text-xs font-bold border cursor-pointer ${
                          surgeryHistory
                            ? "bg-rose-500 text-white border-rose-600"
                            : "bg-muted"
                        }`}
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => setSurgeryHistory(false)}
                        className={`px-2.5 py-0.5 rounded text-xs font-bold border cursor-pointer ${
                          !surgeryHistory
                            ? "bg-muted-foreground/20 text-foreground border-border"
                            : "bg-muted"
                        }`}
                      >
                        No
                      </button>
                    </div>
                  </div>
                  {surgeryHistory && (
                    <Input
                      value={surgeryDetails}
                      onChange={(e) => setSurgeryDetails(e.target.value)}
                      placeholder="Details of surgery..."
                      className="h-7 text-xs"
                    />
                  )}

                  <div className="flex items-center justify-between">
                    <span>Posture Advice (Past):</span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setPostureAdviceGiven(true)}
                        className={`px-2.5 py-0.5 rounded text-xs font-bold border cursor-pointer ${
                          postureAdviceGiven
                            ? "bg-sky-600 text-white border-sky-700"
                            : "bg-muted"
                        }`}
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => setPostureAdviceGiven(false)}
                        className={`px-2.5 py-0.5 rounded text-xs font-bold border cursor-pointer ${
                          !postureAdviceGiven
                            ? "bg-muted-foreground/20 text-foreground border-border"
                            : "bg-muted"
                        }`}
                      >
                        No
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1 pt-1">
                    <label className="font-bold text-foreground">
                      Previous Treatment:
                    </label>
                    <div className="grid grid-cols-2 gap-1">
                      {(
                        ["Medicine", "Physiotherapy", "Both", "None"] as const
                      ).map((prev) => (
                        <button
                          key={prev}
                          type="button"
                          onClick={() => setPreviousTreatment(prev)}
                          className={`py-1 rounded border text-xs font-semibold cursor-pointer text-center ${
                            previousTreatment === prev
                              ? "bg-sky-600 text-white border-sky-700 shadow-2xs"
                              : "bg-background border-border text-foreground hover:bg-muted"
                          }`}
                        >
                          {prev}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Functional Limitation */}
              <div className="p-3.5 rounded-xl bg-card border border-border shadow-2xs space-y-2.5">
                <div className="font-bold text-sm text-foreground border-b border-border/60 pb-1.5">
                  5. Functional Limitation
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Difficulty in everyday movements:
                </p>

                <div className="flex flex-wrap gap-1.5">
                  {config.functionalLimitations.map((limit) => {
                    const isSelected = selectedLimitations.includes(limit);
                    return (
                      <button
                        key={limit}
                        type="button"
                        onClick={() =>
                          toggleArrayItem(
                            selectedLimitations,
                            setSelectedLimitations,
                            limit,
                          )
                        }
                        className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                          isSelected
                            ? "bg-amber-600 text-white border-amber-700 shadow-2xs"
                            : "bg-background border-border text-foreground hover:bg-muted"
                        }`}
                      >
                        {isSelected && <Check className="size-3" />}
                        <span>{limit}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Section 6: Physical Examination */}
            <div className="p-3.5 rounded-xl bg-card border border-border shadow-2xs space-y-2.5">
              <div className="flex items-center gap-1.5 font-bold text-sm text-foreground border-b border-border/60 pb-1.5">
                <HeartPulse className="size-4 text-teal-500" />
                <span>6. Physical Examination</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="space-y-1">
                  <label className="font-bold text-foreground">ROM:</label>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setRom("Normal")}
                      className={`flex-1 py-1 rounded border text-xs font-bold cursor-pointer ${
                        rom === "Normal"
                          ? "bg-emerald-600 text-white border-emerald-700"
                          : "bg-muted"
                      }`}
                    >
                      Normal
                    </button>
                    <button
                      type="button"
                      onClick={() => setRom("Restricted")}
                      className={`flex-1 py-1 rounded border text-xs font-bold cursor-pointer ${
                        rom === "Restricted"
                          ? "bg-rose-500 text-white border-rose-600"
                          : "bg-muted"
                      }`}
                    >
                      Restricted
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-foreground">
                    Muscle Spasm:
                  </label>
                  <button
                    type="button"
                    onClick={() => setMuscleSpasm(!muscleSpasm)}
                    className={`w-full py-1 rounded border text-xs font-bold cursor-pointer ${
                      muscleSpasm
                        ? "bg-rose-500 text-white border-rose-600"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {muscleSpasm ? "Yes (Spasm)" : "No Spasm"}
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-foreground">
                    Tenderness:
                  </label>
                  <button
                    type="button"
                    onClick={() => setTenderness(!tenderness)}
                    className={`w-full py-1 rounded border text-xs font-bold cursor-pointer ${
                      tenderness
                        ? "bg-rose-500 text-white border-rose-600"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {tenderness ? "Yes (Tender)" : "No"}
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-foreground">Swelling:</label>
                  <button
                    type="button"
                    onClick={() => setSwelling(!swelling)}
                    className={`w-full py-1 rounded border text-xs font-bold cursor-pointer ${
                      swelling
                        ? "bg-rose-500 text-white border-rose-600"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {swelling ? "Yes (Swollen)" : "No"}
                  </button>
                </div>
              </div>

              <Input
                value={physicalExamNotes}
                onChange={(e) => setPhysicalExamNotes(e.target.value)}
                placeholder="Physical exam findings (e.g. SLR test, spinal curvature, gait notes, posture deviations)..."
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* ========================================= */}
          {/* RIGHT COLUMN: Diagnosis, Treatment & Plan */}
          {/* ========================================= */}
          <div className="space-y-4">
            {/* Section 7: Physiotherapy Diagnosis */}
            <div className="p-3.5 rounded-xl bg-card border border-border shadow-2xs space-y-3">
              <div className="flex items-center gap-1.5 font-bold text-sm text-foreground border-b border-border/60 pb-1.5">
                <Stethoscope className="size-4 text-sky-500" />
                <span>7. Physiotherapy Diagnosis</span>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-foreground">
                  Clinical Diagnosis / Impression:
                </label>
                <Input
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  placeholder="e.g. Lumbar Spondylosis with Radiculopathy, Cervical Strain, OA Knee..."
                  className="h-9 text-xs font-semibold"
                />
              </div>

              {/* Quick Clinical Diagnosis Presets */}
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-[10.5px] text-muted-foreground">
                  <Sparkles className="size-3 text-sky-500" />
                  <span>Quick Diagnosis Presets:</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {COMMON_DIAGNOSES.map((diag) => (
                    <button
                      key={diag}
                      type="button"
                      onClick={() => setDiagnosis(diag)}
                      className="px-2 py-0.5 rounded-md bg-muted/60 hover:bg-sky-500/15 hover:text-sky-700 dark:hover:text-sky-300 text-[10.5px] border border-border/60 transition-colors cursor-pointer"
                    >
                      {diag}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Section 8: Treatment Plan (Dynamic Modalities from Admin) */}
            <div className="p-3.5 rounded-xl bg-card border border-border shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <div className="flex items-center gap-1.5 font-bold text-sm text-foreground">
                  <CheckCircle2 className="size-4 text-emerald-500" />
                  <span>8. Treatment Plan &amp; Modalities</span>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  Configured from Admin Panel
                </span>
              </div>

              <div className="space-y-2">
                <label className="font-bold text-foreground flex items-center justify-between">
                  <span>Prescribed Modalities:</span>
                  <span className="text-[10px] text-muted-foreground">
                    {selectedTreatments.length} selected
                  </span>
                </label>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {config.treatmentPlans.map((plan) => {
                    const isSelected = selectedTreatments.includes(plan.name);
                    return (
                      <button
                        key={plan.name}
                        type="button"
                        onClick={() =>
                          toggleArrayItem(
                            selectedTreatments,
                            setSelectedTreatments,
                            plan.name,
                          )
                        }
                        className={`p-2 rounded-lg border text-left transition-all cursor-pointer flex items-center justify-between gap-1.5 ${
                          isSelected
                            ? "bg-sky-600 text-white border-sky-700 shadow-xs ring-1 ring-sky-500/40"
                            : "bg-background border-border text-foreground hover:bg-muted"
                        }`}
                      >
                        <span className="font-bold text-xs truncate">
                          {plan.name}
                        </span>
                        {isSelected && (
                          <CheckCircle2 className="size-3.5 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-1 pt-1">
                  <label className="font-bold text-foreground">
                    Dosage &amp; Protocol Notes:
                  </label>
                  <Input
                    value={treatmentNotes}
                    onChange={(e) => setTreatmentNotes(e.target.value)}
                    placeholder="e.g. 15 mins IFT, 10 reps quadriceps sets, lumbar traction 18kg, ultrasound 3 mins..."
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Section 9: Home Advice */}
            <div className="p-3.5 rounded-xl bg-card border border-border shadow-2xs space-y-3">
              <div className="font-bold text-sm text-foreground border-b border-border/60 pb-1.5">
                9. Home Advice &amp; Ergonomics
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border">
                  <div>
                    <div className="font-bold text-foreground">
                      Exercise Explained
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Home exercise program demonstrated
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={exerciseExplained}
                    onChange={(e) => setExerciseExplained(e.target.checked)}
                    className="size-4 accent-emerald-600 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border">
                  <div>
                    <div className="font-bold text-foreground">
                      Posture Advice Given
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Ergonomics &amp; daily lifting care
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={homePostureAdvice}
                    onChange={(e) => setHomePostureAdvice(e.target.checked)}
                    className="size-4 accent-emerald-600 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Follow-up & Progress */}
            <div className="p-3.5 rounded-xl bg-card border border-border shadow-2xs space-y-3">
              <div className="font-bold text-sm text-foreground border-b border-border/60 pb-1.5">
                Follow-Up &amp; Assessment Sign-off
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-foreground">
                    Post-Treatment VAS (0–10):
                  </label>
                  <Input
                    type="number"
                    min="0"
                    max="10"
                    value={followUpVasScore}
                    onChange={(e) => setFollowUpVasScore(e.target.value)}
                    placeholder="e.g. 3"
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="font-bold text-foreground">
                    Improvement / Session Observation:
                  </label>
                  <Input
                    value={improvement}
                    onChange={(e) => setImprovement(e.target.value)}
                    placeholder="Patient reports 50% relief, improved lumbar flexion..."
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1 pt-1">
                <label className="font-bold text-foreground">
                  Therapist / Doctor Signature &amp; Title:
                </label>
                <Input
                  value={doctorSignature}
                  onChange={(e) => setDoctorSignature(e.target.value)}
                  placeholder="e.g. Dr. M. Rahman, PT (Consultant Physiotherapist)"
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Action Footer */}
      <DialogFooter className="sticky bottom-0 bg-background/95 backdrop-blur-md px-4 py-3 border-t border-border flex items-center justify-between gap-3 shrink-0">
        <div className="text-xs text-muted-foreground hidden sm:block">
          All data is saved to the patient&apos;s medical file and can be viewed
          in chronological history.
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-xs h-9 cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={isSubmitting}
            className="text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer gap-2 px-4 shadow-sm"
          >
            <Save className="size-4" />
            <span>
              {isSubmitting
                ? "Saving Assessment File..."
                : "Save Assessment File"}
            </span>
          </Button>
        </div>
      </DialogFooter>
    </form>
  );
}

export function CreateMedicalRecordDialog({
  isOpen,
  onOpenChange,
  appointment,
  doctorId,
  onSuccess,
}: CreateMedicalRecordDialogProps) {
  const [config, setConfig] = React.useState<ActiveClinicalConfig>({
    painAreas: [
      "Neck",
      "Shoulder",
      "Back",
      "Knee",
      "Heel",
      "Elbow",
      "Wrist",
      "Hip",
      "Ankle",
    ],
    painTypes: ["Sharp", "Dull", "Burning", "Radiating", "Aching", "Throbbing"],
    aggravatingFactors: [
      "Movement",
      "Sitting",
      "Standing",
      "Walking",
      "Lifting",
      "Bending",
    ],
    relievingFactors: ["Rest", "Medicine", "Heat", "Ice", "Position Change"],
    functionalLimitations: [
      "Bending",
      "Sitting",
      "Standing",
      "Walking",
      "Lifting",
      "Climbing Stairs",
      "Overhead Reaching",
    ],
    treatmentPlans: [
      { name: "Hot pack", description: null },
      { name: "IFT / TENS", description: null },
      { name: "Ultrasound", description: null },
      { name: "Stretching", description: null },
      { name: "Strengthening", description: null },
      { name: "Posture correction", description: null },
    ],
  });

  // Fetch admin clinical config when opened
  React.useEffect(() => {
    let ignore = false;
    if (isOpen) {
      getActiveClinicalConfigAction().then((res) => {
        if (!ignore && res.success) {
          setConfig(res.config);
        }
      });
    }
    return () => {
      ignore = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] sm:max-w-5xl md:max-w-6xl lg:max-w-7xl max-h-[94vh] flex flex-col p-0 overflow-hidden shadow-2xl rounded-2xl border border-border/80">
        <CreateMedicalRecordForm
          key={appointment?.patient?.id || appointment?.id || "form"}
          appointment={appointment}
          doctorId={doctorId}
          config={config}
          onClose={() => onOpenChange(false)}
          onSuccess={onSuccess}
        />
      </DialogContent>
    </Dialog>
  );
}
