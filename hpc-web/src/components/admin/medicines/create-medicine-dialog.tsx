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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pill, Plus, Loader2, Utensils, Clock } from "lucide-react";
import { toast } from "sonner";
import { createMedicineAction } from "@/actions/admin/medicine.action";

interface CreateMedicineDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const DOSAGE_FORMS = [
  "Tablet",
  "Capsule",
  "Gel",
  "Spray",
  "Injection",
  "Syrup",
  "Cream",
  "Ointment",
  "Suspension",
  "Powder",
  "Patch",
  "Other",
];

export function CreateMedicineDialog({
  isOpen,
  onOpenChange,
  onSuccess,
}: CreateMedicineDialogProps) {
  const [name, setName] = React.useState("");
  const [genericName, setGenericName] = React.useState("");
  const [strength, setStrength] = React.useState("");
  const [form, setForm] = React.useState("Tablet");
  const [company, setCompany] = React.useState("");
  const [defaultMealTiming, setDefaultMealTiming] = React.useState<"BEFORE" | "AFTER">("AFTER");
  const [defaultTimes, setDefaultTimes] = React.useState<string[]>(["MORNING", "NIGHT"]);
  const [defaultDuration, setDefaultDuration] = React.useState("7 days");
  const [instructions, setInstructions] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setName("");
      setGenericName("");
      setStrength("");
      setForm("Tablet");
      setCompany("");
      setDefaultMealTiming("AFTER");
      setDefaultTimes(["MORNING", "NIGHT"]);
      setDefaultDuration("7 days");
      setInstructions("");
    }
  }, [isOpen]);

  const toggleTime = (t: string) => {
    setDefaultTimes((prev) =>
      prev.includes(t)
        ? prev.length > 1
          ? prev.filter((x) => x !== t)
          : prev
        : [...prev, t],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Medicine Name is mandatory.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createMedicineAction({
        name: name.trim(),
        genericName: genericName.trim() || undefined,
        strength: strength.trim() || undefined,
        form: form || "Tablet",
        company: company.trim() || undefined,
        defaultMealTiming,
        defaultTimes,
        defaultDuration: defaultDuration.trim() || "7 days",
        instructions: instructions.trim() || undefined,
      });

      if (res.success) {
        toast.success(res.message);
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("An error occurred while adding medicine.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-xl max-h-[92dvh] flex flex-col p-0 overflow-hidden bg-background border-border shadow-2xl rounded-2xl">
        <DialogHeader className="p-4 sm:p-5 border-b border-border/70 bg-muted/30 flex flex-row items-center gap-2.5 shrink-0">
          <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
            <Pill className="size-4" />
          </div>
          <div>
            <DialogTitle className="text-base font-bold">
              Add New Medicine to Directory
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Medicine Name is mandatory. Clinical details &amp; defaults are optional.
            </p>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="p-4 sm:p-5 flex-1 min-h-0 overflow-y-auto space-y-4 text-xs">
            {/* Mandatory Name */}
            <div className="space-y-1.5">
              <Label className="font-bold flex items-center gap-1 text-foreground">
                <span>Medicine Name (Trade / Brand)</span>
                <span className="text-rose-500 font-bold">*</span>
              </Label>
              <Input
                placeholder="e.g. Tab. Aceclofenac 100mg, Cap. Maxpro 20mg, Gel Fast Relief..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-8.5 text-xs font-semibold rounded-lg"
              />
              <p className="text-[11px] text-muted-foreground">
                Doctors will search and select this exact name when writing prescriptions.
              </p>
            </div>

            {/* Generic Name & Strength */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-semibold text-muted-foreground">
                  Generic Name (Optional)
                </Label>
                <Input
                  placeholder="e.g. Aceclofenac, Esomeprazole..."
                  value={genericName}
                  onChange={(e) => setGenericName(e.target.value)}
                  className="h-8.5 text-xs rounded-lg"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="font-semibold text-muted-foreground">
                  Strength / Dosage (Optional)
                </Label>
                <Input
                  placeholder="e.g. 100mg, 500mg, 1%..."
                  value={strength}
                  onChange={(e) => setStrength(e.target.value)}
                  className="h-8.5 text-xs rounded-lg"
                />
              </div>
            </div>

            {/* Dosage Form & Company */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-semibold text-muted-foreground">
                  Dosage Form (Optional)
                </Label>
                <Select value={form} onValueChange={(val) => setForm(val || "")}>
                  <SelectTrigger className="w-full min-w-0 h-8.5 text-xs rounded-lg">
                    <SelectValue placeholder="Select form" />
                  </SelectTrigger>
                  <SelectContent>
                    {DOSAGE_FORMS.map((f) => (
                      <SelectItem key={f} value={f} className="text-xs">
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="font-semibold text-muted-foreground">
                  Manufacturer / Brand (Optional)
                </Label>
                <Input
                  placeholder="e.g. Square, Beximco, Incepta..."
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="h-8.5 text-xs rounded-lg"
                />
              </div>
            </div>

            {/* Clinical Defaults Section */}
            <div className="p-3 rounded-xl border border-border/70 bg-muted/20 space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <span>Default Prescribing Suggestions (Optional)</span>
              </span>

              {/* Meal Timing */}
              <div className="space-y-1.5">
                <Label className="font-bold flex items-center gap-1 text-muted-foreground text-[11px]">
                  <Utensils className="size-3 text-amber-600" />
                  <span>Default Meal Timing</span>
                </Label>
                <RadioGroup
                  value={defaultMealTiming}
                  onValueChange={(val) => setDefaultMealTiming(val as "BEFORE" | "AFTER")}
                  className="flex items-center gap-4 pt-0.5"
                >
                  <div className="flex items-center gap-1.5 cursor-pointer">
                    <RadioGroupItem value="BEFORE" id="create-meal-before" />
                    <Label htmlFor="create-meal-before" className="text-xs cursor-pointer font-medium">
                      Before Meal (খাওয়ার আগে)
                    </Label>
                  </div>
                  <div className="flex items-center gap-1.5 cursor-pointer">
                    <RadioGroupItem value="AFTER" id="create-meal-after" />
                    <Label htmlFor="create-meal-after" className="text-xs cursor-pointer font-medium">
                      After Meal (খাওয়ার পরে)
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Default Schedule (Morning, Afternoon, Night) */}
              <div className="space-y-1.5">
                <Label className="font-bold flex items-center gap-1 text-muted-foreground text-[11px]">
                  <Clock className="size-3 text-sky-600" />
                  <span>Default Taking Schedule</span>
                </Label>
                <div className="flex items-center gap-3.5 pt-0.5">
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium">
                    <Checkbox
                      checked={defaultTimes.includes("MORNING")}
                      onCheckedChange={() => toggleTime("MORNING")}
                    />
                    <span>Morning (সকাল)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium">
                    <Checkbox
                      checked={defaultTimes.includes("AFTERNOON")}
                      onCheckedChange={() => toggleTime("AFTERNOON")}
                    />
                    <span>Afternoon (দুপুর)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium">
                    <Checkbox
                      checked={defaultTimes.includes("NIGHT")}
                      onCheckedChange={() => toggleTime("NIGHT")}
                    />
                    <span>Night (রাত)</span>
                  </label>
                </div>
              </div>

              {/* Default Duration */}
              <div className="space-y-1.5">
                <Label className="font-semibold text-muted-foreground text-[11px]">
                  Default Duration (Optional)
                </Label>
                <Input
                  placeholder="e.g. 7 days, 14 days, 1 month..."
                  value={defaultDuration}
                  onChange={(e) => setDefaultDuration(e.target.value)}
                  className="h-8 text-xs rounded-lg"
                />
              </div>
            </div>

            {/* Special Instructions */}
            <div className="space-y-1.5">
              <Label className="font-semibold text-muted-foreground">
                Special Clinical Instructions / Advice (Optional)
              </Label>
              <Textarea
                placeholder="e.g. Take with a full glass of water. Do not crush..."
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={2}
                className="text-xs rounded-lg resize-none"
              />
            </div>
          </div>

          <DialogFooter className="p-3 sm:p-4 border-t border-border/70 bg-muted/20 flex flex-row items-center justify-end gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="text-xs font-semibold cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !name.trim()}
              className="text-xs font-bold gap-1.5 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Plus className="size-3.5" />
                  <span>Save Medicine</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
