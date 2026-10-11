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
import { Trash2, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { deleteMedicineAction } from "@/actions/admin/medicine.action";

interface DeleteMedicineDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  medicine: {
    id: string;
    name: string;
  } | null;
  onSuccess?: () => void;
}

export function DeleteMedicineDialog({
  isOpen,
  onOpenChange,
  medicine,
  onSuccess,
}: DeleteMedicineDialogProps) {
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleDelete = async () => {
    if (!medicine?.id) return;
    setIsDeleting(true);
    try {
      const res = await deleteMedicineAction(medicine.id);
      if (res.success) {
        toast.success(res.message);
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Failed to delete medicine.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (!medicine) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-md p-0 overflow-hidden bg-background border-border shadow-2xl rounded-2xl">
        <DialogHeader className="p-4 sm:p-5 border-b border-border/70 bg-rose-500/10 flex flex-row items-center gap-2.5">
          <div className="size-8 rounded-lg bg-rose-500/20 text-rose-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="size-4" />
          </div>
          <div>
            <DialogTitle className="text-base font-bold text-foreground">
              Delete Medicine
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Confirm permanent removal from the directory
            </p>
          </div>
        </DialogHeader>

        <div className="p-4 sm:p-5 space-y-3 text-xs">
          <p className="text-foreground">
            Are you sure you want to delete the medicine entry{" "}
            <span className="font-bold text-rose-600 dark:text-rose-400">
              "{medicine.name}"
            </span>
            ?
          </p>
          <p className="text-muted-foreground text-[11px]">
            Doctors will no longer be able to select this medicine for new prescriptions. Past prescriptions will retain their historical records.
          </p>
        </div>

        <DialogFooter className="p-3 sm:p-4 border-t border-border/70 bg-muted/20 flex flex-row items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
            className="text-xs font-semibold cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting}
            className="text-xs font-bold gap-1.5 cursor-pointer"
          >
            {isDeleting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="size-3.5" />
                <span>Delete Medicine</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
