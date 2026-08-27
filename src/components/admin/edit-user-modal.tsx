"use client";

import * as React from "react";
import { useActionState } from "react";
import { updateUserAction } from "@/actions/admin/user.action";
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

function EditUserForm({
  user,
  onClose,
}: {
  user: { id: string; name: string; role: Role };
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState(
    updateUserAction,
    undefined,
  );
  const [selectedRole, setSelectedRole] = React.useState<Role>(user.role);

  React.useEffect(() => {
    if (state?.success) {
      const timer = setTimeout(() => {
        onClose();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [state, onClose]);

  return (
    <form
      action={formAction}
      suppressHydrationWarning
      className="space-y-4 pt-1"
    >
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

      {/* Staff Name */}
      <div className="space-y-1.5">
        <Label htmlFor="edit-name">Staff Name</Label>
        <Input
          id="edit-name"
          name="name"
          defaultValue={user.name}
          placeholder="e.g. Dr. Jane Smith"
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
      <div className="space-y-2">
        <Label>Departmental Role</Label>
        <div className="grid grid-cols-1 gap-2">
          {ROLE_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = selectedRole === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setSelectedRole(option.value)}
                className={`flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? "border-primary bg-primary/10 ring-1 ring-primary"
                    : "border-border bg-background/50 hover:bg-muted/40"
                }`}
              >
                <div
                  className={`p-1.5 rounded-lg border shrink-0 ${option.badgeColor}`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-foreground">
                    {option.label}
                  </div>
                </div>
                {isSelected && (
                  <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                )}
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

      <DialogFooter className="pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isPending}
          className="cursor-pointer"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isPending}
          className="cursor-pointer font-semibold"
        >
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
  );
}

export function EditUserModal({
  user,
  open,
  onOpenChange,
}: EditUserModalProps) {
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

        <EditUserForm
          key={user.id}
          user={user}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
