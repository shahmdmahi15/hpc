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
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Pill,
  Plus,
  Trash2,
  Calendar,
  Loader2,
  Printer,
  CheckCircle2,
  Clock,
  Utensils,
} from "lucide-react";
import { toast } from "sonner";
import {
  createPrescriptionAction,
  type PrescriptionMedicineItem,
} from "@/actions/doctor/prescription.action";
import { PrescriptionPrintDialog, type PrescriptionPrintRecord } from "./prescription-print-dialog";

interface NewPrescriptionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  patient: {
    id: string;
    name: string;
    mrn?: string | null;
    phone?: string | null;
    age?: number | string | null;
    gender?: string | null;
  } | null;
  doctorId?: string;
  doctorName?: string;
  appointmentId?: string;
  onSuccess?: () => void;
}

const DEFAULT_MEDICINE = (): PrescriptionMedicineItem => ({
  id: `med-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
  name: "",
  mealTiming: "AFTER",
  times: ["MORNING", "NIGHT"],
  duration: "7 days",
  instructions: "",
});

export function NewPrescriptionDialog({
  isOpen,
  onOpenChange,
  patient,
  doctorId,
  doctorName,
  appointmentId,
  onSuccess,
}: NewPrescriptionDialogProps) {
  const [medicines, setMedicines] = React.useState<PrescriptionMedicineItem[]>([
    DEFAULT_MEDICINE(),
  ]);
  const [diagnosis, setDiagnosis] = React.useState("");
  const [advice, setAdvice] = React.useState("");
  const [followUpDate, setFollowUpDate] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Print Dialog State
  const [printRecord, setPrintRecord] = React.useState<PrescriptionPrintRecord | null>(null);
  const [isPrintOpen, setIsPrintOpen] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setMedicines([DEFAULT_MEDICINE()]);
      setDiagnosis("");
      setAdvice("");
      setFollowUpDate("");
    }
  }, [isOpen]);

  const handleAddMedicine = () => {
    setMedicines((prev) => [...prev, DEFAULT_MEDICINE()]);
  };

  const handleRemoveMedicine = (index: number) => {
    if (medicines.length <= 1) {
      toast.warning("Prescription must have at least one medicine.");
      return;
    }
    setMedicines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMedicineChange = (
    index: number,
    field: keyof PrescriptionMedicineItem,
    value: any
  ) => {
    setMedicines((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleToggleTime = (
    index: number,
    time: "MORNING" | "AFTERNOON" | "NIGHT"
  ) => {
    setMedicines((prev) => {
      const copy = [...prev];
      const current = copy[index].times;
      if (current.includes(time)) {
        if (current.length === 1) {
          toast.warning("Select at least one taking time.");
          return prev;
        }
        copy[index].times = current.filter((t) => t !== time);
      } else {
        copy[index].times = [...current, time];
      }
      return copy;
    });
  };

  const handleSubmit = async (andPrint = false) => {
    if (!patient?.id) {
      toast.error("No active patient selected.");
      return;
    }

    // Validate medicines
    const validMedicines = medicines.filter((m) => m.name.trim().length > 0);
    if (validMedicines.length === 0) {
      toast.error("Please add at least one medicine with a name.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createPrescriptionAction({
        patientId: patient.id,
        doctorId,
        appointmentId,
        diagnosis,
        medicines: validMedicines,
        advice,
        followUpDate: followUpDate || null,
      });

      if (res.success) {
        toast.success("Prescription saved successfully!");
        onSuccess?.();

        if (andPrint && res.data) {
          setPrintRecord({
            id: res.data.id,
            diagnosis,
            medicines: validMedicines,
            advice,
            followUpDate,
            createdAt: new Date(),
            doctor: { name: doctorName || "Doctor" },
            patient,
          });
          setIsPrintOpen(true);
        }
        onOpenChange(false);
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Failed to save prescription.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!patient) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="w-[96vw] max-w-4xl max-h-[92dvh] flex flex-col p-0 overflow-hidden bg-background border-border shadow-2xl rounded-2xl">
          <DialogHeader className="p-4 sm:p-5 border-b border-border/70 bg-muted/30 flex flex-row items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-md bg-sky-600/10 text-sky-600 flex items-center justify-center border border-sky-600/20">
                <Pill className="size-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  <span>New Medical Prescription</span>
                  <span className="text-xs font-mono font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border/60">
                    {patient.name} ({patient.mrn || "PT"})
                  </span>
                </DialogTitle>
                <p className="text-xs text-muted-foreground">
                  Prescribe medications with meal timing, taking schedules, and duration.
                </p>
              </div>
            </div>
          </DialogHeader>

          {/* Form Scrollable Content */}
          <div className="p-4 sm:p-5 flex-1 min-h-0 overflow-y-auto space-y-5">
            {/* Chief Complaint / Diagnosis */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold flex items-center gap-1.5">
                <span>Clinical Diagnosis / Chief Complaint</span>
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                placeholder="e.g. Cervical Spondylosis with Radiculopathy, LBA..."
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                className="h-8.5 text-xs rounded-lg"
              />
            </div>

            {/* Medicines List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Pill className="size-3.5 text-sky-600" />
                  <span>Prescribed Medicines ({medicines.length})</span>
                </Label>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={handleAddMedicine}
                  className="h-7 px-2 text-xs font-semibold border-sky-500/40 text-sky-700 dark:text-sky-300 hover:bg-sky-500/10 cursor-pointer gap-1"
                >
                  <Plus className="size-3" />
                  <span>Add Medicine</span>
                </Button>
              </div>

              <div className="space-y-3.5">
                {medicines.map((med, idx) => (
                  <div
                    key={med.id || idx}
                    className="p-3.5 rounded-xl border border-border bg-card/70 space-y-3 relative shadow-2xs"
                  >
                    {/* Header Row: Index + Name + Delete */}
                    <div className="flex items-center gap-2">
                      <span className="size-5 rounded-full bg-sky-600/10 text-sky-600 font-bold text-[11px] flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <Input
                        placeholder="Medicine Name (e.g. Tab. Ace Plus 500mg, Cap. Maxpro 20mg)..."
                        value={med.name}
                        onChange={(e) =>
                          handleMedicineChange(idx, "name", e.target.value)
                        }
                        className="h-8.5 text-xs font-semibold flex-1 rounded-lg"
                      />
                      {medicines.length > 1 && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => handleRemoveMedicine(idx)}
                          className="size-8 text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer shrink-0"
                          title="Remove medicine"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>

                    {/* Parameters Grid: Meal Timing (RadioGroup), Taking Time (3 Checkboxes), Duration */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1">
                      {/* Meal Timing: Shadcn RadioGroup */}
                      <div className="md:col-span-4 p-2.5 rounded-lg border border-border/70 bg-muted/20 space-y-1.5">
                        <Label className="text-[11px] font-bold flex items-center gap-1 text-muted-foreground">
                          <Utensils className="size-3 text-amber-600" />
                          <span>Meal Timing</span>
                        </Label>
                        <RadioGroup
                          value={med.mealTiming}
                          onValueChange={(val) =>
                            handleMedicineChange(idx, "mealTiming", val)
                          }
                          className="flex items-center gap-4 pt-0.5"
                        >
                          <div className="flex items-center gap-1.5 cursor-pointer">
                            <RadioGroupItem value="BEFORE" id={`meal-before-${idx}`} />
                            <Label
                              htmlFor={`meal-before-${idx}`}
                              className="text-xs cursor-pointer font-medium"
                            >
                              Before Meal (আগে)
                            </Label>
                          </div>
                          <div className="flex items-center gap-1.5 cursor-pointer">
                            <RadioGroupItem value="AFTER" id={`meal-after-${idx}`} />
                            <Label
                              htmlFor={`meal-after-${idx}`}
                              className="text-xs cursor-pointer font-medium"
                            >
                              After Meal (পরে)
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>

                      {/* Taking Time: 3 Checkboxes (Morning, Afternoon, Night) */}
                      <div className="md:col-span-5 p-2.5 rounded-lg border border-border/70 bg-muted/20 space-y-1.5">
                        <Label className="text-[11px] font-bold flex items-center gap-1 text-muted-foreground">
                          <Clock className="size-3 text-sky-600" />
                          <span>Taking Schedule (সময়সূচী)</span>
                        </Label>
                        <div className="flex items-center gap-3.5 pt-0.5">
                          <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium">
                            <Checkbox
                              checked={med.times.includes("MORNING")}
                              onCheckedChange={() =>
                                handleToggleTime(idx, "MORNING")
                              }
                            />
                            <span>Morning (সকাল)</span>
                          </label>

                          <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium">
                            <Checkbox
                              checked={med.times.includes("AFTERNOON")}
                              onCheckedChange={() =>
                                handleToggleTime(idx, "AFTERNOON")
                              }
                            />
                            <span>Afternoon (দুপুর)</span>
                          </label>

                          <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium">
                            <Checkbox
                              checked={med.times.includes("NIGHT")}
                              onCheckedChange={() =>
                                handleToggleTime(idx, "NIGHT")
                              }
                            />
                            <span>Night (রাত)</span>
                          </label>
                        </div>
                      </div>

                      {/* Duration Input & Quick Chips */}
                      <div className="md:col-span-3 p-2.5 rounded-lg border border-border/70 bg-muted/20 space-y-1.5">
                        <Label className="text-[11px] font-bold flex items-center gap-1 text-muted-foreground">
                          <Calendar className="size-3 text-emerald-600" />
                          <span>Duration (মেয়াদ)</span>
                        </Label>
                        <div className="space-y-1">
                          <Input
                            placeholder="e.g. 7 days, 14 days..."
                            value={med.duration}
                            onChange={(e) =>
                              handleMedicineChange(idx, "duration", e.target.value)
                            }
                            className="h-7 text-xs rounded-md"
                          />
                          <div className="flex items-center gap-1">
                            {["3d", "5d", "7d", "14d", "1m"].map((dur) => (
                              <button
                                key={dur}
                                type="button"
                                onClick={() =>
                                  handleMedicineChange(
                                    idx,
                                    "duration",
                                    dur === "1m"
                                      ? "1 month"
                                      : `${dur.replace("d", "")} days`
                                  )
                                }
                                className="px-1.5 py-0.2 text-[9.5px] rounded bg-muted hover:bg-muted/80 text-muted-foreground font-semibold border border-border/50 cursor-pointer"
                              >
                                {dur}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Extra Instructions / Dose notes */}
                    <div className="pt-0.5">
                      <Input
                        placeholder="Additional instruction (optional, e.g. ১টি করে ট্যাবলেট ভরা পেটে খাবেন)..."
                        value={med.instructions || ""}
                        onChange={(e) =>
                          handleMedicineChange(idx, "instructions", e.target.value)
                        }
                        className="h-7 text-[11px] text-muted-foreground rounded-md"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Advice & Special Instructions */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">
                Doctor&apos;s Advice &amp; Instructions (উপদেশ ও করণীয়)
              </Label>
              <Textarea
                placeholder="e.g. ভারি জিনিস তুলবেন না, নরম বিছানায় শোবেন, গরম সেক দিবেন..."
                value={advice}
                onChange={(e) => setAdvice(e.target.value)}
                className="text-xs rounded-lg min-h-[70px] resize-y"
              />
            </div>

            {/* Next Follow Up Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Next Follow-Up Date</Label>
                <Input
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="h-8.5 text-xs rounded-lg"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="p-3.5 sm:p-4 border-t border-border/70 bg-muted/30 flex flex-row items-center justify-between gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="h-8 text-xs cursor-pointer"
            >
              Cancel
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleSubmit(false)}
                disabled={isSubmitting}
                className="h-8 text-xs font-semibold gap-1.5 cursor-pointer"
              >
                {isSubmitting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-3.5 text-emerald-600" />
                )}
                <span>Save Only</span>
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={() => handleSubmit(true)}
                disabled={isSubmitting}
                className="h-8 text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white gap-1.5 shadow-xs cursor-pointer"
              >
                {isSubmitting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Printer className="size-3.5" />
                )}
                <span>Save &amp; Print</span>
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Auto-Triggered Print Dialog */}
      <PrescriptionPrintDialog
        isOpen={isPrintOpen}
        onOpenChange={setIsPrintOpen}
        prescription={printRecord}
      />
    </>
  );
}
