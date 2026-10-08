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
import { seedDefaultRoomsAction } from "@/actions/admin/room.action";
import { DEFAULT_ROOM_PRESETS } from "@/schemas/admin/room.schema";
import {
  RoomAccessBadge,
  RoomGenderBadge,
} from "@/components/admin/rooms/room-status-badge";
import {
  Sparkles,
  DoorOpen,
  Users2,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  Building2,
} from "lucide-react";
import { toast } from "sonner";

interface SeedRoomsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  adminPerformers: { id: string; name: string; phone: string }[];
  defaultPerformerId?: string;
  onSuccess?: (performerId: string) => void;
}

export function SeedRoomsDialog({
  isOpen,
  onOpenChange,
  adminPerformers,
  defaultPerformerId = "",
  onSuccess,
}: SeedRoomsDialogProps) {
  const [selectedPerformerId, setSelectedPerformerId] = React.useState<string>(
    () =>
      defaultPerformerId ||
      (adminPerformers.length === 1 ? adminPerformers[0].id : ""),
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setSelectedPerformerId(
        defaultPerformerId ||
          (adminPerformers.length === 1 ? adminPerformers[0].id : ""),
      );
    }
  }, [isOpen, defaultPerformerId, adminPerformers]);

  const handleSeed = async () => {
    if (!selectedPerformerId && adminPerformers.length > 1) {
      toast.error("Please select an authorizing administrator.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await seedDefaultRoomsAction(
        selectedPerformerId || undefined,
      );
      if (res.success) {
        toast.success(res.message);
        if (selectedPerformerId) {
          onSuccess?.(selectedPerformerId);
        }
        onOpenChange(false);
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("An unexpected error occurred while seeding default rooms.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-xl max-h-[92dvh] flex flex-col p-0 overflow-hidden border-border/80 shadow-2xl rounded-2xl">
        {/* Header */}
        <DialogHeader className="p-4 sm:p-5 pr-12 sm:pr-14 border-b border-border/60 shrink-0 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <Sparkles className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                Seed Standard Facility Rooms
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Generate 16 standard clinic rooms (Rooms 200 - 215) with predefined
                functions and Common gender access.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Body Content */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4">
          {/* Key Parameters Cards */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-2.5 rounded-xl bg-muted/30 border border-border/60 text-center">
              <div className="flex items-center justify-center text-primary mb-1">
                <DoorOpen className="size-4" />
              </div>
              <p className="text-xs font-bold text-foreground">16 Rooms</p>
              <p className="text-[10px] text-muted-foreground">
                Rooms 200 — 215
              </p>
            </div>

            <div className="p-2.5 rounded-xl bg-muted/30 border border-border/60 text-center">
              <div className="flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-1">
                <Users2 className="size-4" />
              </div>
              <p className="text-xs font-bold text-foreground">Common Gender</p>
              <p className="text-[10px] text-muted-foreground">
                All 16 Chambers
              </p>
            </div>

            <div className="p-2.5 rounded-xl bg-muted/30 border border-border/60 text-center">
              <div className="flex items-center justify-center text-sky-600 dark:text-sky-400 mb-1">
                <Building2 className="size-4" />
              </div>
              <p className="text-xs font-bold text-foreground">Full Setup</p>
              <p className="text-[10px] text-muted-foreground">
                Doctor, Cashier, Therapy
              </p>
            </div>
          </div>

          {/* Preset Preview List */}
          <div className="p-3 rounded-xl bg-background border border-border/70 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-foreground">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-emerald-500" />
                Rooms Preset Specification:
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                16 Total Spaces
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
              {DEFAULT_ROOM_PRESETS.map((room) => (
                <div
                  key={room.number}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/40 border border-border/50 text-xs gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-xs font-bold text-primary px-1.5 py-0.5 rounded bg-primary/10 shrink-0">
                      #{room.number}
                    </span>
                    <span className="font-medium text-foreground text-[11px] truncate">
                      {room.purpose}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <RoomAccessBadge accessType={room.accessType} />
                    <RoomGenderBadge gender={room.gender} />
                  </div>
                </div>
              ))}
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

          {/* Non-destructive Note */}
          <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-xs flex items-start gap-2">
            <ShieldAlert className="size-4 shrink-0 mt-0.5 text-blue-500" />
            <div className="text-[11px] leading-relaxed">
              <span className="font-semibold">Safe &amp; Idempotent: </span>
              Existing rooms with identical room numbers will NOT be duplicated.
              Only missing rooms will be created, preserving all existing
              consultation and therapy associations.
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 sm:p-5 border-t border-border/60 shrink-0 bg-muted/20 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="w-full sm:w-auto text-xs cursor-pointer"
          >
            Cancel
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleSeed}
            disabled={
              isSubmitting || (!selectedPerformerId && adminPerformers.length > 1)
            }
            className="w-full sm:w-auto gap-1.5 text-xs font-semibold cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Seeding Standard Rooms...</span>
              </>
            ) : (
              <>
                <Sparkles className="size-3.5" />
                <span>Confirm &amp; Seed 16 Rooms</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
