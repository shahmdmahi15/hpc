"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { deleteTherapySlotAction } from "@/actions/admin/slot.action";
import type { TherapySlotWithDetails } from "@/actions/admin/slot.action";
import { toast } from "sonner";
import { Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { AdminPerformerSelect } from "@/components/admin/users/admin-performer-select";

interface DeleteSlotDialogProps {
  slot: TherapySlotWithDetails | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  adminPerformers: { id: string; name: string; phone: string }[];
}

export function DeleteSlotDialog({
  slot,
  isOpen,
  onOpenChange,
  adminPerformers,
}: DeleteSlotDialogProps) {
  const [adminPerformerId, setAdminPerformerId] = React.useState<string>(() =>
    adminPerformers.length === 1 ? adminPerformers[0].id : "",
  );
  const [isPending, startTransition] = React.useTransition();

  const handleOpenChange = (open: boolean) => {
    if (open && adminPerformers.length === 1) {
      setAdminPerformerId(adminPerformers[0].id);
    }
    onOpenChange(open);
  };

  if (!slot) return null;

  const totalBookings = slot._count?.appointments ?? 0;

  const handleDelete = (e: React.FormEvent) => {
    e.preventDefault();

    if (totalBookings > 0) {
      toast.error(
        `Cannot delete slot "${slot.label}" because it has ${totalBookings} existing ticket bookings. You can deactivate it instead.`,
      );
      return;
    }

    if (!adminPerformerId && adminPerformers.length > 0) {
      toast.error("Please select an authorizing administrator.");
      return;
    }

    startTransition(async () => {
      const result = await deleteTherapySlotAction({
        slotId: slot.id,
        adminPerformerId: adminPerformerId || undefined,
      });

      if (result.success) {
        toast.success(result.message);
        onOpenChange(false);
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-lg md:max-w-xl max-h-[min(90vh,760px)] flex flex-col p-0 overflow-hidden border-border/80 shadow-2xl rounded-2xl">
        <DialogHeader className="p-5 sm:p-6 pb-4 border-b border-border/60 shrink-0">
          <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
            <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                Delete Master Slot
              </DialogTitle>
              <DialogDescription className="text-xs">
                Are you sure you want to permanently remove this predefined
                master slot?
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form
          onSubmit={handleDelete}
          className="flex flex-col flex-1 min-h-0 overflow-hidden"
        >
          <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
            <div className="p-3.5 rounded-xl bg-muted/50 border border-border/80 text-xs space-y-1.5">
              <div className="font-semibold text-foreground text-sm">
                {slot.label}
              </div>
              <div className="text-muted-foreground flex items-center gap-3">
                <span>
                  Time:{" "}
                  <strong>
                    {slot.startTime} - {slot.endTime}
                  </strong>
                </span>
                <span>•</span>
                <span>
                  Regular:{" "}
                  <strong>
                    {slot.regularMaleCapacity}M / {slot.regularFemaleCapacity}F
                  </strong>
                </span>
                <span>•</span>
                <span>
                  Extra:{" "}
                  <strong>
                    {slot.extraMaleCapacity}M / {slot.extraFemaleCapacity}F
                  </strong>
                </span>
              </div>
              {totalBookings > 0 && (
                <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 font-semibold text-xs mt-2">
                  Warning: {totalBookings} booked ticket(s) are linked to this
                  slot. Deletion is blocked to preserve patient booking history.
                </div>
              )}
            </div>

            {/* Authorizing Administrator Attribution */}
            <div className="pt-2 border-t border-border/50">
              <AdminPerformerSelect
                adminPerformers={adminPerformers}
                selectedPerformerId={adminPerformerId}
                onSelectPerformerId={setAdminPerformerId}
                disabled={isPending}
                label="Authorizing Administrator"
              />
            </div>
          </div>

          <DialogFooter className="p-4 sm:px-6 py-3.5 border-t border-border/60 bg-muted/20 shrink-0 flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              className="gap-1.5 font-semibold px-4"
              disabled={isPending || totalBookings > 0}
            >
              {isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="size-3.5" />
                  Delete Master Slot
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
