"use client";

import * as React from "react";
import { useActionState } from "react";
import { resetUserPasswordAction } from "@/actions/admin/user.action";
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
import { Label } from "@/components/ui/label";
import { KeyRound, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

interface ResetPasswordModalProps {
  user: {
    id: string;
    name: string;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ResetPasswordModal({
  user,
  open,
  onOpenChange,
}: ResetPasswordModalProps) {
  const [state, formAction, isPending] = useActionState(
    resetUserPasswordAction,
    undefined,
  );

  React.useEffect(() => {
    if (state?.success) {
      const timer = setTimeout(() => {
        onOpenChange(false);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [state, onOpenChange]);

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary font-semibold text-sm">
            <KeyRound className="h-5 w-5" />
            <span>Security Credential Override</span>
          </div>
          <DialogTitle className="text-xl">Reset Staff Password</DialogTitle>
          <DialogDescription>
            Assign a new secure password for <strong>{user.name}</strong>. This
            will revoke all existing sessions.
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
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              )}
              <span>{state.message}</span>
            </div>
          )}

          <div className="space-y-2 pb-2">
            <Label htmlFor="reset-password">New Security Password</Label>
            <Input
              id="reset-password"
              name="password"
              type="password"
              placeholder="Minimum 6 characters..."
              required
              disabled={isPending}
            />
            {state?.fieldErrors?.password && (
              <p className="text-xs text-destructive font-medium">
                {state.fieldErrors.password[0]}
              </p>
            )}
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
            <Button type="submit" variant="default" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating Credential...
                </>
              ) : (
                "Reset Password"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
