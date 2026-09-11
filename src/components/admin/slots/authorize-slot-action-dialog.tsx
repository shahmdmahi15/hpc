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
import { SlotStatusBadge } from "@/components/admin/slots/slot-status-badge";
import { SlotStatus } from "@/generated/prisma/enums";
import type { TherapySlotWithDetails } from "@/actions/admin/slot.action";
import { UserCheck, Clock, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

export interface AuthorizeSlotActionConfig {
  slot: TherapySlotWithDetails;
  actionType: "TOGGLE_ACTIVE" | "CHANGE_STATUS";
  targetActive?: boolean;
  targetStatus?: SlotStatus;
}

interface AuthorizeSlotActionDialogProps {
  config: AuthorizeSlotActionConfig | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  adminPerformers: { id: string; name: string; phone: string }[];
  defaultPerformerId?: string;
  onConfirm: (
    config: AuthorizeSlotActionConfig,
    adminPerformerId: string,
  ) => Promise<boolean>;
}

export function AuthorizeSlotActionDialog({
  config,
  isOpen,
  onOpenChange,
  adminPerformers,
  defaultPerformerId = "",
  onConfirm,
}: AuthorizeSlotActionDialogProps) {
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

  const { slot, actionType, targetActive, targetStatus } = config;

  const handleConfirm = async () => {
    if (!selectedPerformerId && adminPerformers.length > 0) {
      toast.error("Please select an authorizing administrator.");
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await onConfirm(config, selectedPerformerId);
      if (success) {
        onOpenChange(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-lg md:max-w-xl max-h-[min(90vh,620px)] flex flex-col p-0 overflow-hidden border-border/80 shadow-2xl rounded-2xl">
        {/* Header */}
        <DialogHeader className="p-5 pb-4 border-b border-border/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <UserCheck className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                Authorize Schedule Change
              </DialogTitle>
              <DialogDescription className="text-xs">
                Select the administrator authorizer for the audit and compliance
                trail.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Action Preview Card */}
          <div className="p-3.5 rounded-xl border border-border/70 bg-muted/20 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Clock className="size-3 text-primary" />
                Target Master Slot
              </span>
              <span className="font-mono text-xs font-bold text-foreground">
                {slot.startTime} — {slot.endTime}
              </span>
            </div>

            <p className="text-xs font-semibold text-foreground">
              {slot.label}
            </p>

            {/* Change summary */}
            <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">
                {actionType === "TOGGLE_ACTIVE"
                  ? "Operational Status:"
                  : "State Transition:"}
              </span>

              {actionType === "TOGGLE_ACTIVE" ? (
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                      slot.isActive
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                        : "bg-muted text-muted-foreground border-border"
                    }`}
                  >
                    {slot.isActive ? "Active" : "Disabled"}
                  </span>
                  <ArrowRight className="size-3 text-muted-foreground" />
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                      targetActive
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                        : "bg-muted text-muted-foreground border-border"
                    }`}
                  >
                    {targetActive ? "Active" : "Disabled"}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <SlotStatusBadge status={slot.status} />
                  <ArrowRight className="size-3 text-muted-foreground" />
                  {targetStatus && <SlotStatusBadge status={targetStatus} />}
                </div>
              )}
            </div>
          </div>

          {/* Authorizing Administrator Performer Selection */}
          <AdminPerformerSelect
            adminPerformers={adminPerformers}
            selectedPerformerId={selectedPerformerId}
            onSelectPerformerId={setSelectedPerformerId}
            disabled={isSubmitting}
            label="Authorizing Administrator"
          />
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 sm:px-6 py-3.5 border-t border-border/60 bg-muted/20 shrink-0 flex items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="cursor-pointer text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            disabled={
              isSubmitting ||
              (!selectedPerformerId && adminPerformers.length > 0)
            }
            className="cursor-pointer gap-1.5 text-xs font-semibold"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Applying...</span>
              </>
            ) : (
              <span>Confirm &amp; Apply</span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
