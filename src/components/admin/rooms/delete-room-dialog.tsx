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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Room } from "@/generated/prisma/client";
import { deleteRoomAction } from "@/actions/admin/room.action";
import {
  AdminPerformerSelect,
  type AdminPerformer,
} from "@/components/admin/users/admin-performer-select";
import { toast } from "sonner";
import { Trash2, AlertTriangle, Loader2 } from "lucide-react";

interface DeleteRoomDialogProps {
  room: Room | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  adminPerformers: AdminPerformer[];
  onRoomDeleted?: () => void;
}

export function DeleteRoomDialog({
  room,
  open,
  onOpenChange,
  adminPerformers = [],
  onRoomDeleted,
}: DeleteRoomDialogProps) {
  const [confirmNumber, setConfirmNumber] = React.useState("");
  const [selectedAdminPerformerId, setSelectedAdminPerformerId] =
    React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const handleClose = (newOpen: boolean) => {
    if (!newOpen) {
      setConfirmNumber("");
      setSelectedAdminPerformerId("");
      setError(null);
    }
    onOpenChange(newOpen);
  };

  const handleDelete = (e: React.FormEvent) => {
    e.preventDefault();
    if (!room) return;

    if (confirmNumber.trim() !== room.number.trim()) {
      setError(`Please type "${room.number}" exactly to confirm deletion.`);
      return;
    }

    setError(null);
    const formData = new FormData();
    formData.append("id", room.id);
    if (selectedAdminPerformerId) {
      formData.append("performerId", selectedAdminPerformerId);
    }

    startTransition(async () => {
      try {
        const result = await deleteRoomAction(undefined, formData);
        if (result.success) {
          toast.success(result.message || `Room "${room.number}" deleted.`);
          handleClose(false);
          onRoomDeleted?.();
        } else {
          setError(result.message || "Failed to delete room.");
        }
      } catch (err) {
        console.error("Delete room exception:", err);
        setError("An unexpected error occurred. Please try again.");
      }
    });
  };

  if (!room) return null;

  const isMatch = confirmNumber.trim() === room.number.trim();

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px] p-0 gap-0 border-destructive/30 shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-border/60 bg-destructive/5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive border border-destructive/20 shrink-0">
              <Trash2 className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-destructive">
                Delete Room {room.number}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                This action is permanent and cannot be undone.
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleDelete} className="p-6 space-y-4">
          <div className="p-3.5 rounded-xl bg-muted/40 border border-border/70 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Room Purpose:</span>
              <span className="font-semibold text-foreground">
                {room.purpose}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Access Type:</span>
              <span className="font-semibold text-foreground">
                {room.accessType}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status:</span>
              <span className="font-semibold text-foreground">
                {room.status}
              </span>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <p className="font-medium">{error}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label
              htmlFor="confirm-room-number"
              className="text-xs font-semibold"
            >
              Type{" "}
              <span className="font-mono font-bold text-destructive">
                {room.number}
              </span>{" "}
              to confirm:
            </Label>
            <Input
              id="confirm-room-number"
              placeholder={`Type "${room.number}"`}
              value={confirmNumber}
              onChange={(e) => setConfirmNumber(e.target.value)}
              disabled={isPending}
              className="font-mono"
              autoFocus
            />
          </div>

          {/* Mandatory Admin Performer Selection */}
          <div className="pt-2 border-t border-border/50">
            <AdminPerformerSelect
              adminPerformers={adminPerformers}
              selectedPerformerId={selectedAdminPerformerId}
              onSelectPerformerId={setSelectedAdminPerformerId}
              disabled={isPending}
              label="Authorizing Administrator"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleClose(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              disabled={
                isPending ||
                !isMatch ||
                (adminPerformers.length > 1 && !selectedAdminPerformerId)
              }
              className="gap-1.5"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="size-3.5" />
                  <span>Permanently Delete</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
