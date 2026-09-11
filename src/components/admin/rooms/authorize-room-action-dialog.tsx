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
import { AdminPerformerSelect } from "@/components/admin/users/admin-performer-select";
import {
  RoomStatusBadge,
  RoomAccessBadge,
  RoomGenderBadge,
} from "@/components/admin/rooms/room-status-badge";
import { RoomStatus } from "@/generated/prisma/enums";
import type { Room } from "@/generated/prisma/client";
import { updateRoomStatusAction } from "@/actions/admin/room.action";
import { UserCheck, DoorOpen, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export interface AuthorizeRoomActionConfig {
  room: Room;
  targetStatus: RoomStatus;
}

interface AuthorizeRoomActionDialogProps {
  config: AuthorizeRoomActionConfig | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  adminPerformers: { id: string; name: string; phone: string }[];
  defaultPerformerId?: string;
  onSuccess?: (performerId: string) => void;
}

export function AuthorizeRoomActionDialog({
  config,
  isOpen,
  onOpenChange,
  adminPerformers,
  defaultPerformerId = "",
  onSuccess,
}: AuthorizeRoomActionDialogProps) {
  const router = useRouter();
  const [selectedPerformerId, setSelectedPerformerId] = React.useState<string>(
    () =>
      defaultPerformerId ||
      (adminPerformers.length === 1 ? adminPerformers[0].id : ""),
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [prevOpen, setPrevOpen] = React.useState(isOpen);
  if (isOpen !== prevOpen) {
    setPrevOpen(isOpen);
    if (isOpen) {
      setSelectedPerformerId(
        defaultPerformerId ||
          (adminPerformers.length === 1 ? adminPerformers[0].id : ""),
      );
    }
  }

  if (!config) return null;

  const { room, targetStatus } = config;

  const handleConfirm = async () => {
    if (!selectedPerformerId && adminPerformers.length > 1) {
      toast.error("Please select an authorizing administrator.");
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("id", room.id);
      formData.append("status", targetStatus);
      if (selectedPerformerId) {
        formData.append("performerId", selectedPerformerId);
      }

      const res = await updateRoomStatusAction(undefined, formData);
      if (res.success) {
        toast.success(res.message);
        if (selectedPerformerId) {
          onSuccess?.(selectedPerformerId);
        }
        router.refresh();
        onOpenChange(false);
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("An unexpected error occurred while updating room status.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-lg md:max-w-xl max-h-[min(90vh,620px)] flex flex-col p-0 overflow-hidden border-border/80 shadow-2xl rounded-2xl">
        {/* Header */}
        <DialogHeader className="p-5 pb-4 border-b border-border/60 shrink-0 bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <UserCheck className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                Authorize Room Status Change
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Select the acting administrator authorizing this operational
                update.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Room Preview Card */}
          <div className="p-3.5 rounded-xl bg-muted/30 border border-border/70 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center justify-center">
                  <DoorOpen className="size-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-foreground">
                    Room {room.number}
                  </h4>
                  <p className="text-[11px] text-muted-foreground truncate max-w-[240px]">
                    {room.purpose}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <RoomAccessBadge accessType={room.accessType} />
                <RoomGenderBadge gender={room.gender} />
              </div>
            </div>

            {/* Status Transition Preview */}
            <div className="pt-2.5 border-t border-border/50 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  Current Status
                </span>
                <RoomStatusBadge status={room.status} />
              </div>

              <div className="flex items-center justify-center p-1.5 rounded-full bg-muted text-muted-foreground">
                <ArrowRight className="size-3.5" />
              </div>

              <div className="space-y-0.5 text-right">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  Target Status
                </span>
                <RoomStatusBadge status={targetStatus} />
              </div>
            </div>
          </div>

          {/* Authorizing Admin Performer */}
          <div className="space-y-1.5">
            <AdminPerformerSelect
              adminPerformers={adminPerformers}
              selectedPerformerId={selectedPerformerId}
              onSelectPerformerId={setSelectedPerformerId}
              disabled={isSubmitting}
              label="Authorizing Administrator *"
            />
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t border-border/60 bg-muted/10 shrink-0 flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="cursor-pointer"
          >
            Cancel
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            disabled={
              isSubmitting ||
              (adminPerformers.length > 1 && !selectedPerformerId)
            }
            className="gap-1.5 font-semibold cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Updating...</span>
              </>
            ) : (
              <span>Confirm Status Change</span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
