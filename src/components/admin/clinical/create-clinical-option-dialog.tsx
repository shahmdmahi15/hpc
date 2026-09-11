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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClinicalOptionCategory } from "@/generated/prisma/enums";
import { createClinicalOptionAction } from "@/actions/admin/clinical.action";
import { toast } from "sonner";
import { PlusCircle, Sparkles } from "lucide-react";

interface CreateClinicalOptionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCategory?: ClinicalOptionCategory;
  onSuccess: () => void;
}

const CATEGORY_OPTIONS = [
  {
    value: ClinicalOptionCategory.TREATMENT_PLAN,
    label: "Treatment Plan / Modality",
  },
  { value: ClinicalOptionCategory.PAIN_AREA, label: "Pain Area / Body Region" },
  {
    value: ClinicalOptionCategory.PAIN_TYPE,
    label: "Pain Type / Characteristic",
  },
  {
    value: ClinicalOptionCategory.AGGRAVATING_FACTOR,
    label: "Aggravating Factor (Increases with)",
  },
  {
    value: ClinicalOptionCategory.RELIEVING_FACTOR,
    label: "Relieving Factor (Reduces with)",
  },
  {
    value: ClinicalOptionCategory.FUNCTIONAL_LIMITATION,
    label: "Functional Limitation (Difficulty in)",
  },
] as const;

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  CATEGORY_OPTIONS.map((opt) => [opt.value, opt.label]),
);

interface CreateFormProps {
  defaultCategory: ClinicalOptionCategory;
  onClose: () => void;
  onSuccess: () => void;
}

function CreateClinicalOptionForm({
  defaultCategory,
  onClose,
  onSuccess,
}: CreateFormProps) {
  const [category, setCategory] =
    React.useState<ClinicalOptionCategory>(defaultCategory);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [order, setOrder] = React.useState("0");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Option name is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createClinicalOptionAction({
        category,
        name: name.trim(),
        description: description.trim() || undefined,
        order: parseInt(order, 10) || 0,
      });

      if (res.success) {
        toast.success(res.message);
        onClose();
        onSuccess();
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <DialogHeader className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
            <PlusCircle className="size-4" />
          </div>
          <div>
            <DialogTitle className="text-sm sm:text-base font-bold text-foreground">
              Add Clinical Option
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Add a new dynamic treatment modality, pain region, or assessment
              factor.
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-3.5 pt-1">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-foreground">
            Category
          </label>
          <Select
            items={CATEGORY_OPTIONS}
            value={category}
            onValueChange={(val) =>
              val && setCategory(val as ClinicalOptionCategory)
            }
          >
            <SelectTrigger className="w-full text-xs h-9">
              <SelectValue placeholder="Select category">
                {(val: string | null) =>
                  val
                    ? CATEGORY_LABELS[String(val)] || String(val)
                    : "Select category"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map((opt) => (
                <SelectItem
                  key={opt.value}
                  value={opt.value}
                  className="text-xs"
                >
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-foreground">
            Option Name <span className="text-rose-500">*</span>
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Dry Needling, Heel, Burning..."
            className="text-xs h-9"
            required
            autoFocus
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-foreground">
            Description{" "}
            <span className="text-muted-foreground text-[10px] font-normal">
              (Optional)
            </span>
          </label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description or clinical instruction..."
            className="text-xs h-9"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-foreground">
            Display Order{" "}
            <span className="text-muted-foreground text-[10px] font-normal">
              (Lower numbers appear first)
            </span>
          </label>
          <Input
            type="number"
            value={order}
            onChange={(e) => setOrder(e.target.value)}
            min="0"
            className="text-xs h-9 font-mono"
          />
        </div>

        <DialogFooter className="pt-3 border-t border-border flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-xs h-8 cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={isSubmitting}
            className="text-xs h-8 bg-sky-600 hover:bg-sky-700 text-white font-bold cursor-pointer gap-1.5 shadow-2xs"
          >
            <Sparkles className="size-3.5" />
            <span>{isSubmitting ? "Creating..." : "Create Option"}</span>
          </Button>
        </DialogFooter>
      </form>
    </div>
  );
}

export function CreateClinicalOptionDialog({
  isOpen,
  onOpenChange,
  defaultCategory = ClinicalOptionCategory.TREATMENT_PLAN,
  onSuccess,
}: CreateClinicalOptionDialogProps) {
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-xl md:max-w-2xl p-5 space-y-4 rounded-2xl border-border/80 shadow-2xl">
        <CreateClinicalOptionForm
          key={defaultCategory}
          defaultCategory={defaultCategory}
          onClose={() => onOpenChange(false)}
          onSuccess={onSuccess}
        />
      </DialogContent>
    </Dialog>
  );
}
