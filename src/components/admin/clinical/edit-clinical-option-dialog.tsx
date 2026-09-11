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
import type { ClinicalOptionModel } from "@/generated/prisma/models";
import {
  updateClinicalOptionAction,
  deleteClinicalOptionAction,
} from "@/actions/admin/clinical.action";
import { toast } from "sonner";
import { Edit3, Trash2, Check } from "lucide-react";

interface EditClinicalOptionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  option: ClinicalOptionModel | null;
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

interface EditClinicalOptionFormProps {
  option: ClinicalOptionModel;
  onClose: () => void;
  onSuccess: () => void;
}

function EditClinicalOptionForm({
  option,
  onClose,
  onSuccess,
}: EditClinicalOptionFormProps) {
  const [category, setCategory] = React.useState<ClinicalOptionCategory>(
    option.category,
  );
  const [name, setName] = React.useState(option.name);
  const [description, setDescription] = React.useState(
    option.description || "",
  );
  const [order, setOrder] = React.useState(String(option.order));
  const [isActive, setIsActive] = React.useState(option.isActive);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Option name is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await updateClinicalOptionAction({
        id: option.id,
        category,
        name: name.trim(),
        description: description.trim() || undefined,
        order: parseInt(order, 10) || 0,
        isActive,
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

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${option.name}"?`)) return;

    setIsDeleting(true);
    try {
      const res = await deleteClinicalOptionAction(option.id);
      if (res.success) {
        toast.success(res.message);
        onClose();
        onSuccess();
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Failed to delete option.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <DialogHeader className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
            <Edit3 className="size-4" />
          </div>
          <div>
            <DialogTitle className="text-sm sm:text-base font-bold text-foreground">
              Edit Clinical Option
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Update naming, display sequence, or category assignment.
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-3.5">
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
              <SelectValue placeholder="Select Category">
                {(val: string | null) =>
                  val
                    ? CATEGORY_LABELS[String(val)] || String(val)
                    : "Select Category"
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
            Option Name <span className="text-destructive">*</span>
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Cervical Traction, Knee Pain, Sharp..."
            className="text-xs h-9"
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-foreground">
            Description / Clinical Notes (Optional)
          </label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short details or instructions for this modality..."
            className="text-xs h-9"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">
              Display Sequence
            </label>
            <Input
              type="number"
              value={order}
              onChange={(e) => setOrder(e.target.value)}
              placeholder="0"
              className="text-xs h-9 font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">
              Status
            </label>
            <div className="flex items-center gap-2 h-9">
              <Button
                type="button"
                size="sm"
                variant={isActive ? "default" : "outline"}
                className={`text-xs flex-1 cursor-pointer ${
                  isActive
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : ""
                }`}
                onClick={() => setIsActive(!isActive)}
              >
                {isActive ? (
                  <>
                    <Check className="size-3 mr-1" /> Active
                  </>
                ) : (
                  "Disabled"
                )}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-3 border-t border-border flex flex-row items-center justify-between gap-2">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting || isSubmitting}
            className="text-xs cursor-pointer gap-1.5"
          >
            <Trash2 className="size-3" />
            <span>{isDeleting ? "Deleting..." : "Delete"}</span>
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="text-xs bg-sky-600 hover:bg-sky-700 text-white font-semibold cursor-pointer"
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogFooter>
      </form>
    </div>
  );
}

export function EditClinicalOptionDialog({
  isOpen,
  onOpenChange,
  option,
  onSuccess,
}: EditClinicalOptionDialogProps) {
  if (!isOpen || !option) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-xl md:max-w-2xl p-5 space-y-4 rounded-2xl border-border/80 shadow-2xl">
        <EditClinicalOptionForm
          key={option.id}
          option={option}
          onClose={() => onOpenChange(false)}
          onSuccess={onSuccess}
        />
      </DialogContent>
    </Dialog>
  );
}
