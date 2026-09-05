"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { deletePerformerAction } from "@/actions/admin/performer.action";
import { toast } from "sonner";
import { Trash2, Loader2, AlertTriangle, UserX } from "lucide-react";
import {
  AdminPerformerSelect,
  type AdminPerformer,
} from "@/components/admin/users/admin-performer-select";

interface PerformerToDelete {
  id: string;
  name: string;
  phone: string;
  roleLabel?: string;
}

interface DeletePerformerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  performer: PerformerToDelete | null;
  adminPerformers?: AdminPerformer[];
}

export function DeletePerformerDialog({
  open,
  onOpenChange,
  performer,
  adminPerformers = [],
}: DeletePerformerDialogProps) {
  const [selectedAdminPerformerId, setSelectedAdminPerformerId] =
    React.useState("");
  const [isPending, startTransition] = React.useTransition();

  const handleClose = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedAdminPerformerId("");
    }
    onOpenChange(newOpen);
  };

  const handleDelete = () => {
    if (!performer) return;

    if (adminPerformers.length > 1 && !selectedAdminPerformerId) {
      toast.error("Administrator selection required", {
        description:
          "Please select the administrator authorizing this removal.",
      });
      return;
    }

    startTransition(async () => {
      const res = await deletePerformerAction(
        performer.id,
        selectedAdminPerformerId || undefined,
      );
      if (res.success) {
        toast.success("Performer removed", {
          description: res.message,
        });
        handleClose(false);
      } else {
        toast.error("Failed to remove performer", {
          description: res.message,
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg md:max-w-xl max-h-[min(90vh,600px)] flex flex-col p-0 overflow-hidden rounded-2xl border-border/80 shadow-2xl">
        {/* Header Banner */}
        <div className="shrink-0 bg-muted/40 p-5 pb-4 border-b border-border/60">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive shrink-0">
                <UserX className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  Remove Staff Performer
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  This will remove the performer profile from the department
                  desk.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Content Body - Scrollable */}
        {performer && (
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
            <div className="p-3 rounded-xl bg-muted/40 border border-border/70 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Staff Member:</span>
                <span className="font-bold text-foreground">
                  {performer.name}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Phone Number:</span>
                <span className="font-mono font-semibold text-foreground">
                  {performer.phone}
                </span>
              </div>
              {performer.roleLabel && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Station Desk:</span>
                  <span className="font-semibold text-foreground">
                    {performer.roleLabel}
                  </span>
                </div>
              )}
            </div>

            {/* Authorizing Admin Staff Selector */}
            <AdminPerformerSelect
              adminPerformers={adminPerformers}
              selectedPerformerId={selectedAdminPerformerId}
              onSelectPerformerId={setSelectedAdminPerformerId}
              disabled={isPending}
              label="Removal Authorized By"
            />

            <p className="text-[11.5px] text-muted-foreground flex items-center gap-1.5 leading-relaxed">
              <AlertTriangle className="size-3.5 text-amber-500 shrink-0" />
              Existing audit logs and historical records referencing this
              performer remain intact.
            </p>
          </div>
        )}

        {/* Fixed Footer */}
        <div className="shrink-0 px-6 py-3.5 bg-muted/30 border-t border-border/60 flex items-center justify-between sm:justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleClose(false)}
            disabled={isPending}
            className="rounded-xl text-xs font-semibold cursor-pointer h-9 px-4 border-border/80 hover:bg-muted"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={
              isPending ||
              !performer ||
              (adminPerformers.length > 1 && !selectedAdminPerformerId)
            }
            className="rounded-xl text-xs font-semibold gap-1.5 cursor-pointer shadow-sm h-9 px-4"
          >
            {isPending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Removing...</span>
              </>
            ) : (
              <>
                <Trash2 className="size-3.5" />
                <span>Confirm Remove</span>
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
