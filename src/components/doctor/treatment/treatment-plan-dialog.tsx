"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Activity,
  CalendarCheck2,
  CheckCircle2,
  Edit3,
  Plus,
  Trash2,
  Clock,
  Sparkles,
  Loader2,
  Calendar,
  X,
  Stethoscope,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { TreatmentPlanType } from "@/generated/prisma/enums";
import type { AppointmentWithRelations } from "@/actions/receptionist/appointment.action";
import {
  getPatientTreatmentPlansAction,
  createTreatmentPlanAction,
  updateTreatmentPlanAction,
  deleteTreatmentPlanAction,
  type TreatmentPlanRecord,
  type PatientPlansResult,
} from "@/actions/doctor/treatment-plan.action";
import {
  getActiveClinicalConfigAction,
  type ActiveClinicalConfig,
} from "@/actions/doctor/medical-record.action";

interface TreatmentPlanDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  appointment?: AppointmentWithRelations | null;
  patientId?: string;
  patientName?: string;
  patientMrn?: string | null;
  defaultTab?: "today" | "next";
  doctorId?: string;
  doctors?: { id: string; name: string }[];
  onSuccess?: () => void;
}

export function TreatmentPlanDialog(props: TreatmentPlanDialogProps) {
  if (!props.isOpen) return null;

  const resolvedPatientId =
    props.appointment?.patientId || props.patientId || "patient";

  return (
    <Dialog open={props.isOpen} onOpenChange={props.onOpenChange}>
      <TreatmentPlanDialogInner
        key={`${resolvedPatientId}-${props.defaultTab || "today"}`}
        {...props}
      />
    </Dialog>
  );
}

function TreatmentPlanDialogInner({
  appointment,
  patientId: propPatientId,
  patientName: propPatientName,
  patientMrn: propPatientMrn,
  defaultTab = "today",
  doctorId = "",
  doctors = [],
  onSuccess,
}: TreatmentPlanDialogProps) {
  const patientId = appointment?.patientId || propPatientId || "";
  const patientName =
    appointment?.patient?.name || propPatientName || "Patient";
  const patientMrn = appointment?.patient?.mrn || propPatientMrn || null;
  const appointmentId = appointment?.id;

  const [activeTab, setActiveTab] = React.useState<"today" | "next">(
    defaultTab,
  );
  const [plans, setPlans] = React.useState<PatientPlansResult>({
    todayPlan: null,
    nextPlan: null,
    historyPlans: [],
  });
  const [clinicalConfig, setClinicalConfig] =
    React.useState<ActiveClinicalConfig | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(Boolean(patientId));
  const [editingPlanType, setEditingPlanType] = React.useState<
    "today" | "next" | null
  >(null);

  React.useEffect(() => {
    let active = true;
    if (!patientId) {
      return;
    }

    Promise.all([
      getPatientTreatmentPlansAction(patientId, appointmentId),
      getActiveClinicalConfigAction(),
    ])
      .then(([plansRes, configRes]) => {
        if (!active) return;
        setPlans(plansRes);
        if (configRes.success) {
          setClinicalConfig(configRes.config);
        }
        setIsLoading(false);
      })
      .catch((error) => {
        if (!active) return;
        console.error("[Load Treatment Plans Error]:", error);
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [patientId, appointmentId]);

  const handleReload = async () => {
    if (!patientId) return;
    setIsLoading(true);
    try {
      const [plansRes, configRes] = await Promise.all([
        getPatientTreatmentPlansAction(patientId, appointmentId),
        getActiveClinicalConfigAction(),
      ]);
      setPlans(plansRes);
      if (configRes.success) {
        setClinicalConfig(configRes.config);
      }
    } catch (error) {
      console.error("[Load Treatment Plans Error]:", error);
    } finally {
      setIsLoading(false);
      setEditingPlanType(null);
      onSuccess?.();
    }
  };

  return (
    <DialogContent className="w-[95vw] sm:max-w-3xl md:max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden border-border/80 shadow-2xl rounded-2xl">
      {/* Header */}
      <DialogHeader className="p-5 pb-3.5 border-b border-border/60 bg-muted/20 shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <Activity className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Physiotherapy Treatment Plan
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Prescribe and monitor active modalities and session guidelines
                for this patient.
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-foreground">
                {patientName}
              </div>
              {patientMrn && (
                <div className="text-[10.5px] font-mono text-muted-foreground">
                  MRN: {patientMrn}
                </div>
              )}
            </div>
            {patientMrn && (
              <span className="sm:hidden font-mono text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-primary">
                {patientMrn}
              </span>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="pt-3">
          <Tabs
            value={activeTab}
            onValueChange={(val) => {
              setActiveTab(val as "today" | "next");
              setEditingPlanType(null);
            }}
            className="w-full"
          >
            <TabsList className="grid grid-cols-2 h-9 p-1 bg-muted/60 border border-border/60 rounded-xl">
              <TabsTrigger
                value="today"
                className="text-xs font-semibold gap-1.5 rounded-lg data-[state=active]:shadow-xs"
              >
                <Activity className="size-3.5" />
                <span>Today&apos;s Treatment Plan</span>
                {plans.todayPlan ? (
                  <span className="ml-1 size-2 rounded-full bg-emerald-500" />
                ) : (
                  <span className="ml-1 text-[10px] text-muted-foreground">
                    (Not Set)
                  </span>
                )}
              </TabsTrigger>

              <TabsTrigger
                value="next"
                className="text-xs font-semibold gap-1.5 rounded-lg data-[state=active]:shadow-xs"
              >
                <CalendarCheck2 className="size-3.5" />
                <span>Next Treatment Plan</span>
                {plans.nextPlan ? (
                  <span className="ml-1 size-2 rounded-full bg-sky-500" />
                ) : (
                  <span className="ml-1 text-[10px] text-muted-foreground">
                    (Not Set)
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </DialogHeader>

      {/* Content Body */}
      <div className="p-5 flex-1 overflow-y-auto space-y-4">
        {isLoading ? (
          <div className="py-14 text-center space-y-2">
            <Loader2 className="size-6 animate-spin mx-auto text-primary" />
            <p className="text-xs text-muted-foreground">
              Loading treatment plans...
            </p>
          </div>
        ) : (
          <>
            {activeTab === "today" ? (
              <PlanTabPanel
                key={`today-${plans.todayPlan?.id || "empty"}`}
                planType={TreatmentPlanType.TODAY}
                plan={plans.todayPlan}
                isEditing={editingPlanType === "today"}
                patientId={patientId}
                appointmentId={appointment?.id}
                doctorId={doctorId}
                doctors={doctors}
                clinicalConfig={clinicalConfig}
                onStartEdit={() => setEditingPlanType("today")}
                onCancelEdit={() => setEditingPlanType(null)}
                onReload={handleReload}
              />
            ) : (
              <PlanTabPanel
                key={`next-${plans.nextPlan?.id || "empty"}`}
                planType={TreatmentPlanType.NEXT}
                plan={plans.nextPlan}
                isEditing={editingPlanType === "next"}
                patientId={patientId}
                appointmentId={appointment?.id}
                doctorId={doctorId}
                doctors={doctors}
                clinicalConfig={clinicalConfig}
                onStartEdit={() => setEditingPlanType("next")}
                onCancelEdit={() => setEditingPlanType(null)}
                onReload={handleReload}
              />
            )}
          </>
        )}
      </div>
    </DialogContent>
  );
}

// ----------------------------------------------------------------------------
// PlanTabPanel: Displays existing plan OR creation/edit form
// ----------------------------------------------------------------------------

interface PlanTabPanelProps {
  planType: TreatmentPlanType;
  plan: TreatmentPlanRecord | null;
  isEditing: boolean;
  patientId: string;
  appointmentId?: string;
  doctorId: string;
  doctors: { id: string; name: string }[];
  clinicalConfig: ActiveClinicalConfig | null;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onReload: () => Promise<void>;
}

function PlanTabPanel({
  planType,
  plan,
  isEditing,
  patientId,
  appointmentId,
  doctorId,
  doctors,
  clinicalConfig,
  onStartEdit,
  onCancelEdit,
  onReload,
}: PlanTabPanelProps) {
  const isToday = planType === TreatmentPlanType.TODAY;

  // If a plan exists and we are not explicitly editing, show summary card
  if (plan && !isEditing) {
    return (
      <div className="space-y-4 animate-in fade-in duration-200">
        <div className="p-4 rounded-xl border border-border/80 bg-card shadow-xs space-y-3.5">
          {/* Top banner: Status & Action buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded-md text-xs font-bold inline-flex items-center gap-1.5 ${
                  isToday
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                    : "bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30"
                }`}
              >
                <CheckCircle2 className="size-3.5" />
                <span>
                  {isToday ? "Today's Active Plan" : "Next Session Plan"}
                </span>
              </span>

              {plan.targetDate && (
                <span className="text-[11px] text-muted-foreground font-mono flex items-center gap-1">
                  <Calendar className="size-3" />
                  <span>
                    Scheduled:{" "}
                    {new Date(plan.targetDate).toLocaleDateString([], {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                onClick={onStartEdit}
                className="h-7.5 text-xs font-semibold gap-1.5 cursor-pointer border-border/80 hover:bg-muted"
              >
                <Edit3 className="size-3" />
                <span>Edit Plan</span>
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  if (
                    confirm(
                      "Are you sure you want to clear this treatment plan?",
                    )
                  ) {
                    const res = await deleteTreatmentPlanAction(
                      plan.id,
                      doctorId,
                    );
                    if (res.success) {
                      toast.success(res.message);
                      await onReload();
                    } else {
                      toast.error(res.message);
                    }
                  }
                }}
                className="h-7.5 text-xs text-destructive hover:bg-destructive/10 cursor-pointer gap-1 px-2"
                title="Deactivate / clear plan"
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          </div>

          {/* Prescribed Modalities */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground uppercase tracking-wider text-[10.5px]">
              Prescribed Modalities ({plan.modalities.length})
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {plan.modalities.map((mod) => (
                <span
                  key={mod}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-primary/10 border border-primary/25 text-primary flex items-center gap-1.5 shadow-2xs"
                >
                  <Sparkles className="size-3 text-primary/80" />
                  <span>{mod}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Clinical Instructions / Notes */}
          {plan.instructions && (
            <div className="space-y-1 pt-1">
              <Label className="text-xs font-bold text-foreground uppercase tracking-wider text-[10.5px]">
                Protocol & Guidelines
              </Label>
              <div className="p-3 rounded-lg bg-muted/40 border border-border/70 text-xs text-foreground leading-relaxed whitespace-pre-wrap font-sans">
                {plan.instructions}
              </div>
            </div>
          )}

          {/* Footer Metadata */}
          <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
            <div className="flex items-center gap-1.5">
              <Stethoscope className="size-3" />
              <span>Attending Doctor: {plan.doctorName || "Consultant"}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="size-3" />
              <span>
                Updated:{" "}
                {new Date(plan.updatedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Otherwise, render PlanForm (creation or editing mode)
  return (
    <PlanForm
      planType={planType}
      existingPlan={plan}
      patientId={patientId}
      appointmentId={appointmentId}
      doctorId={doctorId}
      doctors={doctors}
      clinicalConfig={clinicalConfig}
      onCancel={plan ? onCancelEdit : undefined}
      onSaved={onReload}
    />
  );
}

// ----------------------------------------------------------------------------
// PlanForm: Interactive creation and modification interface
// ----------------------------------------------------------------------------

interface PlanFormProps {
  planType: TreatmentPlanType;
  existingPlan: TreatmentPlanRecord | null;
  patientId: string;
  appointmentId?: string;
  doctorId: string;
  doctors: { id: string; name: string }[];
  clinicalConfig: ActiveClinicalConfig | null;
  onCancel?: () => void;
  onSaved: () => Promise<void>;
}

function PlanForm({
  planType,
  existingPlan,
  patientId,
  appointmentId,
  doctorId,
  doctors,
  clinicalConfig,
  onCancel,
  onSaved,
}: PlanFormProps) {
  const isToday = planType === TreatmentPlanType.TODAY;

  const [selectedModalities, setSelectedModalities] = React.useState<string[]>(
    () => (existingPlan ? existingPlan.modalities : []),
  );
  const [customModalityInput, setCustomModalityInput] = React.useState("");
  const [instructions, setInstructions] = React.useState(
    existingPlan?.instructions || "",
  );
  const [targetDate, setTargetDate] = React.useState<string>(() => {
    if (existingPlan?.targetDate) {
      return existingPlan.targetDate.split("T")[0];
    }
    if (!isToday) {
      // Default next plan target to tomorrow
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return d.toISOString().split("T")[0];
    }
    return new Date().toISOString().split("T")[0];
  });
  const [selectedDoctorId, setSelectedDoctorId] = React.useState<string>(
    () =>
      existingPlan?.doctorId ||
      doctorId ||
      (doctors.length === 1 ? doctors[0].id : ""),
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});

  // Dynamic available options from Admin Clinical Configuration
  const availableModalities = React.useMemo(() => {
    const list = (clinicalConfig?.treatmentPlans || []).map((t) => t.name);
    if (list.length === 0) {
      return [
        "Hot pack",
        "IFT / TENS",
        "Ultrasound Therapy (UST)",
        "Traction (Cervical/Lumbar)",
        "Stretching Exercises",
        "Strengthening Exercises",
        "Manual Mobilization",
        "Posture Correction",
        "Dry Needling",
      ];
    }
    return list;
  }, [clinicalConfig]);

  const toggleModality = (name: string) => {
    setSelectedModalities((prev) =>
      prev.includes(name) ? prev.filter((m) => m !== name) : [...prev, name],
    );
  };

  const handleAddCustomModality = () => {
    const trimmed = customModalityInput.trim();
    if (!trimmed) return;
    if (!selectedModalities.includes(trimmed)) {
      setSelectedModalities((prev) => [...prev, trimmed]);
    }
    setCustomModalityInput("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedModalities.length === 0) {
      toast.error("Please select or add at least one treatment modality.");
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      if (existingPlan) {
        // Update existing plan
        const res = await updateTreatmentPlanAction({
          id: existingPlan.id,
          modalities: selectedModalities,
          instructions: instructions.trim() || undefined,
          targetDate: targetDate
            ? new Date(targetDate).toISOString()
            : undefined,
          doctorId: selectedDoctorId || undefined,
        });

        if (res.success) {
          toast.success(res.message);
          await onSaved();
        } else {
          if (res.fieldErrors) setErrors(res.fieldErrors);
          toast.error(res.message);
        }
      } else {
        // Create new plan
        const res = await createTreatmentPlanAction({
          patientId,
          appointmentId,
          planType,
          modalities: selectedModalities,
          instructions: instructions.trim() || undefined,
          targetDate: targetDate
            ? new Date(targetDate).toISOString()
            : undefined,
          doctorId: selectedDoctorId || undefined,
        });

        if (res.success) {
          toast.success(res.message);
          await onSaved();
        } else {
          if (res.fieldErrors) setErrors(res.fieldErrors);
          toast.error(res.message);
        }
      }
    } catch {
      toast.error(
        "An unexpected error occurred while saving the treatment plan.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 animate-in fade-in duration-200"
    >
      {/* Informational Guidance */}
      <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 flex items-start gap-2.5">
        <Info className="size-4 text-primary shrink-0 mt-0.5" />
        <div className="text-xs text-foreground leading-relaxed">
          <span className="font-bold">
            {isToday
              ? "Prescribe Today's Session Plan:"
              : "Prescribe Next Visit Recommendations:"}
          </span>{" "}
          Select modalities configured dynamically in the Admin panel, or add
          custom ones. Handlers and therapists will follow this prescription.
        </div>
      </div>

      {/* Dynamic Modality Chips */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-bold text-foreground">
            Treatment Modalities <span className="text-destructive">*</span>
          </Label>
          <span className="text-[11px] text-muted-foreground font-medium">
            {selectedModalities.length} selected
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-muted/30 border border-border/70 max-h-48 overflow-y-auto">
          {availableModalities.map((name) => {
            const isSelected = selectedModalities.includes(name);
            return (
              <button
                type="button"
                key={name}
                onClick={() => toggleModality(name)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-2xs font-semibold ring-2 ring-primary/30"
                    : "bg-background border border-border/80 text-foreground hover:bg-muted"
                }`}
              >
                {isSelected && <CheckCircle2 className="size-3 shrink-0" />}
                <span>{name}</span>
              </button>
            );
          })}
        </div>

        {/* Custom Modality Input */}
        <div className="flex items-center gap-2 pt-1">
          <Input
            value={customModalityInput}
            onChange={(e) => setCustomModalityInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddCustomModality();
              }
            }}
            placeholder="Type custom modality and press Enter..."
            className="h-8 text-xs bg-background"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleAddCustomModality}
            className="h-8 text-xs px-2.5 gap-1 font-semibold cursor-pointer shrink-0"
          >
            <Plus className="size-3" />
            <span>Add</span>
          </Button>
        </div>

        {/* Selected Modalities Chips List */}
        {selectedModalities.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {selectedModalities.map((mod) => (
              <span
                key={mod}
                className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-primary/10 border border-primary/20 text-primary flex items-center gap-1"
              >
                <span>{mod}</span>
                <button
                  type="button"
                  onClick={() => toggleModality(mod)}
                  className="hover:text-destructive cursor-pointer"
                >
                  <X className="size-2.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Target Date for Next Plan (Optional for today) */}
      {!isToday && (
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Calendar className="size-3.5 text-primary" />
            <span>Next Visit Target Date</span>
          </Label>
          <Input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="h-8.5 text-xs bg-background max-w-xs"
          />
        </div>
      )}

      {/* Protocol & Clinical Guidelines */}
      <div className="space-y-1.5">
        <Label className="text-xs font-bold text-foreground">
          Instructions, Duration & Clinical Notes
        </Label>
        <Textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="e.g., 15 mins Hot Pack, TENS on lower lumbar (continuous mode, 20 mins), gentle manual stretching of hamstrings..."
          rows={3}
          className="text-xs bg-background resize-none"
        />
        {errors.instructions && (
          <p className="text-[11px] text-destructive">
            {errors.instructions[0]}
          </p>
        )}
      </div>

      {/* Attending Doctor Attribution */}
      {doctors.length > 1 && (
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-foreground">
            Prescribing Doctor
          </Label>
          <select
            value={selectedDoctorId}
            onChange={(e) => setSelectedDoctorId(e.target.value)}
            className="h-8 text-xs rounded-lg border border-border bg-background px-2.5 text-foreground w-full max-w-xs"
          >
            <option value="">Select Doctor</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                Dr. {d.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isSubmitting}
            className="h-8 text-xs cursor-pointer"
          >
            Cancel
          </Button>
        )}

        <Button
          type="submit"
          size="sm"
          disabled={isSubmitting}
          className="h-8 text-xs font-semibold gap-1.5 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {isSubmitting ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="size-3.5" />
          )}
          <span>
            {existingPlan
              ? "Update Treatment Plan"
              : `Save ${isToday ? "Today's" : "Next"} Plan`}
          </span>
        </Button>
      </div>
    </form>
  );
}
