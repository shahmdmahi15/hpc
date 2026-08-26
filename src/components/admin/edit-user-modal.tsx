"use client";

import * as React from "react";
import { useActionState } from "react";
import {
  updateUserAction,
  type AdminActionState,
} from "@/actions/admin/user.action";
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
import { Role } from "@/generated/prisma/enums";
import {
  UserCheck,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
  Stethoscope,
  Headphones,
} from "lucide-react";

const ROLE_OPTIONS = [
  {
    value: Role.DOCTOR,
    label: "Pain Care Specialist (Doctor)",
    icon: Stethoscope,
    badgeColor: "text-cyan-500 bg-cyan-500/10 border-cyan-500/20",
  },
  {
    value: Role.RECEPTIONIST,
    label: "Front Desk Receptionist",
    icon: Headphones,
    badgeColor: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
  },
  {
    value: Role.HANDLER,
    label: "Therapy & Care Handler",
    icon: UserCheck,
    badgeColor: "text-amber-500 bg-amber-500/10 border-amber-500/20",
  },
  {
    value: Role.ADMIN,
    label: "System Administrator",
    icon: ShieldAlert,
    badgeColor: "text-red-500 bg-red-500/10 border-red-500/20",
  },
];

interface EditUserModalProps {
  user: {
    id: string;
    name: string;
    role: Role;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditUserModal({
  user,
  open,
  onOpenChange,
}: EditUserModalProps) {
  const [state, formAction, isPending] = useActionState(
    updateUserAction,
    undefined,
  );
  const [selectedRole, setSelectedRole] = React.useState<Role>(
    user?.role || Role.DOCTOR,
  );

  React.useEffect(() => {
    if (user) {
      setSelectedRole(user.role);
    }
  }, [user]);

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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary font-semibold text-sm">
            <UserCheck className="h-5 w-5" />
            <span>Staff Account Details</span>
          </div>
          <DialogTitle className="text-xl">Edit Staff Member</DialogTitle>
          <DialogDescription>
            Update display name and role authorization for {user.name}.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4 pt-1">
          <input type="hidden" name="userId" value={user.id} />
          <input type="hidden" name="role" value={selectedRole} />

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

          {/* Full Name */}
          <div className="space-y-2">
            <Label htmlFor="edit-name">Display Name</Label>
            <Input
              id="edit-name"
              name="name"
              defaultValue={user.name}
              required
              disabled={isPending}
            />
            {state?.fieldErrors?.name && (
              <p className="text-xs text-destructive font-medium">
                {state.fieldErrors.name[0]}
              </p>
            )}
          </div>

          {/* Role Selection */}
          <div className="space-y-2 pb-2">
            <Label>Assigned Role</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ROLE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = selectedRole === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSelectedRole(opt.value)}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                        : "border-border bg-muted/30 hover:bg-muted/60"
                    }`}
                  >
                    <div
                      className={`p-1.5 rounded-lg border shrink-0 ${opt.badgeColor}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="text-xs font-semibold text-foreground truncate">
                      {opt.value}
                    </div>
                  </button>
                );
              })}
            </div>
            {state?.fieldErrors?.role && (
              <p className="text-xs text-destructive font-medium">
                {state.fieldErrors.role[0]}
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
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving Changes...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
