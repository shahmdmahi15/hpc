"use client";

import * as React from "react";
import { useActionState } from "react";
import { deleteUserAction } from "@/actions/admin/user.action";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { Role } from "@/generated/prisma/enums";

interface DeleteUserModalProps {
  user: {
    id: string;
    name: string;
    role: Role;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteUserModal({
  user,
  open,
  onOpenChange,
}: DeleteUserModalProps) {
  const [state, formAction, isPending] = useActionState(
    deleteUserAction,
    undefined,
  );

  React.useEffect(() => {
    if (state?.success) {
      const timer = setTimeout(() => {
        onOpenChange(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [state, onOpenChange]);

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-destructive/30">
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
            <Trash2 className="h-5 w-5" />
            <span>Permanent Account Removal</span>
          </div>
          <DialogTitle className="text-xl text-destructive">
            Delete Staff Account
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete the account for{" "}
            <strong>{user.name}</strong> ({user.role})? This will permanently
            erase their access credentials and active sessions.
          </DialogDescription>
        </DialogHeader>

        <form
          action={formAction}
          suppressHydrationWarning
          className="space-y-4 pt-1"
        >
          <input type="hidden" name="userId" value={user.id} />

          {state?.message && (
            <div
              className={`flex items-start gap-3 rounded-xl border p-3.5 text-xs ${
                state.success
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                  : "border-destructive/30 bg-destructive/10 text-destructive"
              }`}
            >
              {state.success ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              )}
              <span>{state.message}</span>
            </div>
          )}

          <div className="p-3 rounded-xl border border-destructive/20 bg-destructive/5 text-xs text-muted-foreground">
            <p className="font-semibold text-destructive mb-1">Warning:</p>
            <p>
              This action cannot be undone. Active login sessions for this
              account will be terminated immediately.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting Account...
                </>
              ) : (
                "Delete Account"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
