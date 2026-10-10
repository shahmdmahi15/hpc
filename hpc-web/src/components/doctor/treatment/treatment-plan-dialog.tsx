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
  ArrowUp,
  ArrowDown,
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
import type { ModalityConfigItem } from "@/schemas/doctor/treatment-plan.schema";
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
  currentDoctor?: { id: string; name: string } | null;
  readOnly?: boolean;
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
  currentDoctor,
  readOnly = false,
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
    <DialogContent className="w-[96vw] max-w-5xl lg:max-w-6xl max-h-[92dvh] flex flex-col p-0 overflow-hidden border-border/80 shadow-2xl rounded-2xl">
      {/* Header */}
      <DialogHeader className="p-5 pb-3.5 pr-12 sm:pr-14 border-b border-border/60 bg-muted/20 shrink-0">
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
      <div className="p-4 sm:p-5 flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-4">
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
                currentDoctor={currentDoctor}
                clinicalConfig={clinicalConfig}
                readOnly={readOnly}
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
                currentDoctor={currentDoctor}
                clinicalConfig={clinicalConfig}
                readOnly={readOnly}
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
  currentDoctor?: { id: string; name: string } | null;
  clinicalConfig: ActiveClinicalConfig | null;
  readOnly?: boolean;
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
  currentDoctor,
  clinicalConfig,
  readOnly = false,
  onStartEdit,
  onCancelEdit,
  onReload,
}: PlanTabPanelProps) {
  const isToday = planType === TreatmentPlanType.TODAY;

  const [isClearConfirmOpen, setIsClearConfirmOpen] = React.useState(false);
  const [isClearing, setIsClearing] = React.useState(false);

  // If readOnly and no plan prescribed
  if (!plan && readOnly) {
    return (
      <div className="p-8 text-center rounded-xl border border-dashed border-border/80 bg-muted/20 space-y-2">
        <Activity className="size-8 text-muted-foreground mx-auto" />
        <h4 className="text-xs font-bold text-foreground">No Treatment Plan Prescribed</h4>
        <p className="text-[11px] text-muted-foreground">
          The doctor has not prescribed a {isToday ? "today's" : "next visit"} treatment plan yet.
        </p>
      </div>
    );
  }

  // If a plan exists and we are not explicitly editing, show summary card
  if (plan && !isEditing) {
    const orderedItems: ModalityConfigItem[] =
      plan.modalityItems && plan.modalityItems.length > 0
        ? plan.modalityItems
        : plan.modalities.map((name, i) => ({
            name,
            durationMinutes: 15,
            order: i + 1,
          }));

    const totalMinutes = orderedItems.reduce((acc, m) => acc + m.durationMinutes, 0);

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

            {!readOnly && (
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
                  onClick={() => setIsClearConfirmOpen(true)}
                  className="h-7.5 text-xs text-destructive hover:bg-destructive/10 cursor-pointer gap-1 px-2"
                  title="Deactivate / clear plan"
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            )}
          </div>

          {/* Prescribed Modalities & Sequence */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-foreground uppercase tracking-wider text-[10.5px]">
                Prescribed Modality Sequence & Timers ({orderedItems.length})
              </Label>
              <span className="text-[10px] text-muted-foreground font-mono">
                Total Duration: {totalMinutes} mins
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {orderedItems.map((mod, idx) => (
                <div
                  key={`${mod.name}-${idx}`}
                  className="p-2.5 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between gap-2 shadow-2xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="size-5 rounded-full bg-primary/20 text-primary font-mono font-bold text-[10px] flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-bold text-foreground truncate" title={mod.name}>
                      {mod.name}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-background border border-border text-[11px] font-mono font-bold text-primary shrink-0 flex items-center gap-1">
                    <Clock className="size-3 text-primary" />
                    <span>{mod.durationMinutes}m</span>
                  </span>
                </div>
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

        {/* Shadcn UI Clear Treatment Plan Confirmation Dialog */}
        <Dialog open={isClearConfirmOpen} onOpenChange={setIsClearConfirmOpen}>
          <DialogContent className="w-[96vw] max-w-md p-0 overflow-hidden rounded-2xl border-border/80 shadow-2xl">
            <DialogHeader className="p-4 sm:p-5 pb-3 pr-12 border-b border-border/60 bg-muted/20">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive">
                  <Trash2 className="size-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-foreground">
                    Clear Treatment Plan
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Deactivate active physiotherapy prescription
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="p-4 sm:p-5 space-y-3 text-xs">
              <p className="text-muted-foreground leading-relaxed">
                Are you sure you want to clear this treatment plan? This will remove the active prescribed modalities for this patient.
              </p>
            </div>

            <DialogFooter className="p-3 sm:p-4 border-t border-border/60 bg-muted/20 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsClearConfirmOpen(false)}
                disabled={isClearing}
                className="text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={async () => {
                  setIsClearing(true);
                  try {
                    const res = await deleteTreatmentPlanAction(plan.id, doctorId);
                    if (res.success) {
                      toast.success(res.message);
                      setIsClearConfirmOpen(false);
                      await onReload();
                    } else {
                      toast.error(res.message);
                    }
                  } catch {
                    toast.error("Failed to delete treatment plan.");
                  } finally {
                    setIsClearing(false);
                  }
                }}
                disabled={isClearing}
                className="text-xs font-bold cursor-pointer shadow-xs"
              >
                {isClearing ? "Clearing..." : "Yes, Clear Plan"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
      currentDoctor={currentDoctor}
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
  currentDoctor?: { id: string; name: string } | null;
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
  currentDoctor,
  clinicalConfig,
  onCancel,
  onSaved,
}: PlanFormProps) {
  const isToday = planType === TreatmentPlanType.TODAY;

  const resolvedDoctor = currentDoctor || null;

  const [modalityItems, setModalityItems] = React.useState<ModalityConfigItem[]>(
    () => {
      if (existingPlan?.modalityItems && existingPlan.modalityItems.length > 0) {
        return existingPlan.modalityItems;
      }
      if (existingPlan?.modalities && existingPlan.modalities.length > 0) {
        return existingPlan.modalities.map((name, idx) => ({
          name,
          durationMinutes: 15,
          order: idx + 1,
        }));
      }
      return [];
    },
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
      resolvedDoctor?.id ||
      "",
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
    setModalityItems((prev) => {
      const exists = prev.some((m) => m.name === name);
      if (exists) {
        return prev
          .filter((m) => m.name !== name)
          .map((m, idx) => ({ ...m, order: idx + 1 }));
      } else {
        return [...prev, { name, durationMinutes: 15, order: prev.length + 1 }];
      }
    });
  };

  const handleAddCustomModality = () => {
    const trimmed = customModalityInput.trim();
    if (!trimmed) return;
    if (!modalityItems.some((m) => m.name.toLowerCase() === trimmed.toLowerCase())) {
      setModalityItems((prev) => [
        ...prev,
        { name: trimmed, durationMinutes: 15, order: prev.length + 1 },
      ]);
    }
    setCustomModalityInput("");
  };

  const changeDuration = (index: number, minutes: number) => {
    setModalityItems((prev) =>
      prev.map((item, idx) =>
        idx === index ? { ...item, durationMinutes: Math.max(1, Math.min(180, minutes)) } : item,
      ),
    );
  };

  const moveUp = (index: number) => {
    if (index <= 0) return;
    setModalityItems((prev) => {
      const next = [...prev];
      const temp = next[index - 1];
      next[index - 1] = next[index];
      next[index] = temp;
      return next.map((item, idx) => ({ ...item, order: idx + 1 }));
    });
  };

  const moveDown = (index: number) => {
    setModalityItems((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      const temp = next[index + 1];
      next[index + 1] = next[index];
      next[index] = temp;
      return next.map((item, idx) => ({ ...item, order: idx + 1 }));
    });
  };

  const removeItem = (index: number) => {
    setModalityItems((prev) =>
      prev.filter((_, idx) => idx !== index).map((item, idx) => ({ ...item, order: idx + 1 })),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (modalityItems.length === 0) {
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
          modalities: modalityItems,
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
          modalities: modalityItems,
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
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      data-lpignore="true"
      data-1p-ignore="true"
      data-bwignore="true"
      data-form-type="other"
      className="space-y-4 animate-in fade-in duration-200"
    >
      {/* Informational Guidance */}
      <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 flex items-start gap-2.5">
        <Info className="size-4 text-primary shrink-0 mt-0.5" />
        <div className="text-xs text-foreground leading-relaxed">
          <span className="font-bold">
            {isToday
              ? "Prescribe Today's Session Plan & Timers:"
              : "Prescribe Next Visit Recommendations & Timers:"}
          </span>{" "}
          Select modalities, configure the duration minutes in the box beside each treatment, and arrange their sequence (1st, 2nd, 3rd).
        </div>
      </div>

      {/* Dynamic Modality Chips */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-bold text-foreground">
            Available Modalities <span className="text-destructive">*</span>
          </Label>
          <span className="text-[11px] text-muted-foreground font-medium">
            {modalityItems.length} selected
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-muted/30 border border-border/70 max-h-40 overflow-y-auto">
          {availableModalities.map((name) => {
            const isSelected = modalityItems.some((m) => m.name === name);
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

        {/* Prescribed Sequence & Timers List */}
        {modalityItems.length > 0 && (
          <div className="space-y-2 p-3 rounded-xl bg-card border border-border/80 mt-2">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Clock className="size-3.5 text-primary" />
                <span>Prescribed Treatment Sequence & Per-Bed Timers</span>
              </Label>
              <span className="text-[10px] text-muted-foreground font-mono font-bold">
                Total: {modalityItems.reduce((acc, m) => acc + m.durationMinutes, 0)} mins
              </span>
            </div>

            <div className="space-y-1.5">
              {modalityItems.map((item, idx) => (
                <div
                  key={`${item.name}-${idx}`}
                  className="flex items-center justify-between gap-2 p-2 rounded-xl bg-muted/40 border border-border/70 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="size-5 rounded-full bg-primary/20 text-primary font-mono font-bold text-[10px] flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="font-bold text-foreground truncate" title={item.name}>
                      {item.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Duration input box beside treatment name */}
                    <div className="flex items-center gap-1 bg-background border border-border/80 px-1.5 py-0.5 rounded-lg shadow-2xs">
                      <Clock className="size-3 text-muted-foreground" />
                      <Input
                        type="number"
                        min={1}
                        max={180}
                        value={item.durationMinutes}
                        onChange={(e) => changeDuration(idx, Number(e.target.value) || 15)}
                        className="w-12 h-6 text-xs font-mono font-bold text-center bg-transparent border-0 p-0 focus-visible:ring-0"
                      />
                      <span className="text-[10.5px] font-mono text-muted-foreground">m</span>
                    </div>

                    {/* Sequence order Up/Down buttons */}
                    <div className="flex items-center gap-0.5">
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        disabled={idx === 0}
                        onClick={() => moveUp(idx)}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-30"
                        title="Move Up in sequence"
                      >
                        <ArrowUp className="size-3" />
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        disabled={idx === modalityItems.length - 1}
                        onClick={() => moveDown(idx)}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-30"
                        title="Move Down in sequence"
                      >
                        <ArrowDown className="size-3" />
                      </Button>
                    </div>

                    {/* Remove button */}
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      onClick={() => removeItem(idx)}
                      className="h-6 w-6 p-0 text-destructive/70 hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                      title="Remove modality"
                    >
                      <X className="size-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
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

      {/* Prescribing Doctor Attribution (Logged-in Doctor) */}
      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/40 border border-border/70 text-xs">
        <Stethoscope className="size-3.5 text-blue-500 shrink-0" />
        <span className="text-muted-foreground font-medium">Prescribing Doctor:</span>
        <span className="font-bold text-foreground">
          {resolvedDoctor?.name
            ? `Dr. ${resolvedDoctor.name.replace(/^Dr\.\s*/i, "")}`
            : "Attending Doctor"}
        </span>
        <span className="ml-auto text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
          Logged In
        </span>
      </div>

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
