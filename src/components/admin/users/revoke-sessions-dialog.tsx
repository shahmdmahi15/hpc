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
import { revokeAllUserSessionsAction } from "@/actions/admin/user.action";
import { AdminPerformerSelect, type AdminPerformer } from "@/components/admin/users/admin-performer-select";
import type { Role } from "@/generated/prisma/enums";
import { toast } from "sonner";
import { ShieldAlert, Loader2, LogOut } from "lucide-react";

interface RevokeSessionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: string;
    role: Role;
    activeSessionCount: number;
  } | null;
  adminPerformers?: AdminPerformer[];
}

export function RevokeSessionsDialog({
  open,
  onOpenChange,
  user,
  adminPerformers = [],
}: RevokeSessionsDialogProps) {
  const [selectedPerformerId, setSelectedPerformerId] = React.useState("");
  const [isPending, startTransition] = React.useTransition();

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSelectedPerformerId("");
    }
    onOpenChange(nextOpen);
  };

  if (!user) return null;

  const isRevokeDisabled =
    isPending ||
    user.activeSessionCount === 0 ||
    (adminPerformers && adminPerformers.length > 1 && !selectedPerformerId);

  const handleRevoke = () => {
    if (adminPerformers && adminPerformers.length > 1 && !selectedPerformerId) {
      toast.error("Please select which administrator staff member is authorizing this session revocation.");
      return;
    }

    startTransition(async () => {
      const res = await revokeAllUserSessionsAction(user.id, selectedPerformerId);
      if (res.success) {
        toast.success(res.message);
        handleOpenChange(false);
      } else {
        toast.error(res.message);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg md:max-w-xl max-h-[min(90vh,600px)] flex flex-col p-0 overflow-hidden rounded-2xl shadow-2xl border-border/80">
        {/* Header Banner */}
        <div className="shrink-0 bg-muted/40 p-5 pb-4 border-b border-border/60">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive shrink-0">
                <ShieldAlert className="size-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  Revoke Active Sessions
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Force terminate active logins for{" "}
                  <span className="font-bold text-foreground">{user.role}</span>.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Content Body - Scrollable */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {/* Mandatory Admin Performer Selection */}
          <AdminPerformerSelect
            adminPerformers={adminPerformers}
            selectedPerformerId={selectedPerformerId}
            onSelectPerformerId={setSelectedPerformerId}
            disabled={isPending}
            label="Authorizing Administrator"
          />

          <div className="p-3.5 rounded-xl border border-border/80 bg-muted/30 text-xs text-muted-foreground space-y-1.5">
            <p>
              This action will invalidate all current session tokens for{" "}
              <span className="font-bold text-foreground">{user.role}</span> ({user.activeSessionCount} active session{user.activeSessionCount === 1 ? "" : "s"}).
            </p>
            <p className="text-[11px] text-muted-foreground/80">
              Staff at this station will immediately be prompted to authenticate again.
            </p>
          </div>
        </div>

        {/* Fixed Footer */}
        <div className="shrink-0 px-6 py-3.5 bg-muted/30 border-t border-border/60 flex items-center justify-between sm:justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
            className="rounded-xl text-xs font-semibold h-9 px-4 border-border/80 hover:bg-muted cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleRevoke}
            disabled={isRevokeDisabled}
            className="rounded-xl text-xs font-semibold gap-1.5 shadow-sm h-9 px-4 cursor-pointer"
          >
            {isPending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Terminating Sessions...</span>
              </>
            ) : (
              <>
                <LogOut className="size-3.5" />
                <span>Terminate All Sessions</span>
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
