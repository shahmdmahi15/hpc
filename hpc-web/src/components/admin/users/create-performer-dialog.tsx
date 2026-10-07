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
import { ROLES, type RoleConfig } from "@/components/login/role-config";
import { createPerformerAction } from "@/actions/admin/performer.action";
import { Role } from "@/generated/prisma/enums";
import { toast } from "sonner";
import {
  UserPlus,
  Phone,
  Mail,
  KeyRound,
  User as UserIcon,
  Building2,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface RoleUserOption {
  id: string;
  role: Role;
}

interface CreatePerformerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: RoleUserOption[];
  defaultUserId?: string | null;
}

export function CreatePerformerDialog({
  open,
  onOpenChange,
  users,
  defaultUserId,
}: CreatePerformerDialogProps) {
  // Only desk roles can have performers
  const deskUsers = React.useMemo(() => {
    return users.filter(
      (u) =>
        u.role === Role.RECEPTIONIST ||
        u.role === Role.HANDLER ||
        u.role === Role.CASHIER,
    );
  }, [users]);

  const [selectedUserId, setSelectedUserId] = React.useState<string>(
    () => defaultUserId || deskUsers[0]?.id || "",
  );
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [whatsapp, setWhatsapp] = React.useState("");
  const [pin, setPin] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<
    Record<string, string[] | undefined>
  >({});
  const [generalError, setGeneralError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (defaultUserId) {
      setSelectedUserId(defaultUserId);
    } else if (deskUsers.length > 0 && !selectedUserId) {
      setSelectedUserId(deskUsers[0].id);
    }
  }, [defaultUserId, deskUsers, selectedUserId]);

  const handleClose = (newOpen: boolean) => {
    if (!newOpen) {
      setName("");
      setEmail("");
      setWhatsapp("");
      setPin("");
      setFieldErrors({});
      setGeneralError(null);
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    setFieldErrors({});

    if (!selectedUserId) {
      setGeneralError("Please choose a station desk.");
      return;
    }

    if (!name.trim()) {
      setFieldErrors((prev) => ({
        ...prev,
        name: ["Please enter the staff member's name."],
      }));
      return;
    }

    if (!whatsapp.trim()) {
      setFieldErrors((prev) => ({
        ...prev,
        whatsapp: ["Please enter the staff member's WhatsApp number."],
      }));
      return;
    }

    if (!/^\d{4}$/.test(pin.trim())) {
      setFieldErrors((prev) => ({
        ...prev,
        pin: ["PIN must be exactly 4 digits (e.g. 1234)."],
      }));
      return;
    }

    const formData = new FormData();
    formData.append("userId", selectedUserId);
    formData.append("name", name.trim());
    if (email.trim()) formData.append("email", email.trim().toLowerCase());
    formData.append("whatsapp", whatsapp.trim());
    formData.append("phone", whatsapp.trim());
    formData.append("pin", pin.trim());

    startTransition(async () => {
      const result = await createPerformerAction(undefined, formData);

      if (result.success) {
        toast.success(result.message);
        handleClose(false);
      } else {
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
        }
        if (result.message) {
          setGeneralError(result.message);
          toast.error(result.message);
        }
      }
    });
  };

  const selectedUser = deskUsers.find((u) => u.id === selectedUserId);
  const selectedRoleConfig: RoleConfig | undefined = selectedUser
    ? ROLES.find((r) => r.value === selectedUser.role)
    : undefined;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[96vw] max-w-3xl lg:max-w-4xl max-h-[86vh] flex flex-col p-0 overflow-hidden border-border/80 shadow-2xl rounded-2xl">
        <form onSubmit={handleSubmit} className="flex flex-col">
          {/* Header */}
          <div className="bg-muted/40 p-4 sm:p-5 border-b border-border/60">
            <DialogHeader className="pr-10 sm:pr-12">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                  <UserPlus className="size-4" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-foreground">
                    Register Desk Staff Member
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Add a staff performer with a 4-digit PIN for desk action verification
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="p-4 sm:p-5 space-y-3.5">
            {generalError && (
              <div className="p-2.5 rounded-xl border border-destructive/30 bg-destructive/10 text-xs text-destructive flex items-center gap-2 font-medium">
                <AlertCircle className="size-3.5 shrink-0" />
                <span>{generalError}</span>
              </div>
            )}

            {/* Target Desk Selection */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Building2 className="size-3.5 text-primary" />
                <span>Station Desk</span>
                <span className="text-destructive">*</span>
              </Label>
              <div className="grid grid-cols-3 gap-1.5">
                {deskUsers.map((u) => {
                  const isSelected = selectedUserId === u.id;
                  const cfg = ROLES.find((r) => r.value === u.role);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setSelectedUserId(u.id)}
                      className={`p-2 rounded-xl border text-center cursor-pointer transition-all ${
                        isSelected
                          ? "border-primary bg-primary/10 ring-1 ring-primary/40 font-bold text-primary shadow-xs"
                          : "border-border/70 hover:bg-muted/50 text-muted-foreground"
                      }`}
                    >
                      <div className="text-xs">{cfg?.defaultLabel || u.role}</div>
                      <div className="text-[9.5px] opacity-75 font-normal">Desk</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Staff Name */}
            <div className="space-y-1">
              <Label htmlFor="perfName" className="text-xs font-bold text-foreground">
                Staff Full Name <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  id="perfName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ayesha Siddiqua"
                  required
                  disabled={isPending}
                  className="pl-9 h-9 text-xs rounded-xl"
                />
              </div>
              {fieldErrors.name && (
                <p className="text-[11px] text-destructive font-medium">
                  {fieldErrors.name[0]}
                </p>
              )}
            </div>

            {/* Email (Optional) */}
            <div className="space-y-1">
              <Label htmlFor="perfEmail" className="text-xs font-bold text-foreground">
                Email Address <span className="text-[10px] text-muted-foreground font-normal">(optional)</span>
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  id="perfEmail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. staff@hpc.com"
                  disabled={isPending}
                  className="pl-9 h-9 text-xs rounded-xl"
                />
              </div>
              {fieldErrors.email && (
                <p className="text-[11px] text-destructive font-medium">
                  {fieldErrors.email[0]}
                </p>
              )}
            </div>

            {/* WhatsApp Number */}
            <div className="space-y-1">
              <Label htmlFor="perfWhatsapp" className="text-xs font-bold text-foreground">
                WhatsApp / Phone Number <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  id="perfWhatsapp"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="e.g. 01811111101 or +8801811111101"
                  required
                  disabled={isPending}
                  className="pl-9 h-9 text-xs rounded-xl"
                />
              </div>
              {fieldErrors.whatsapp && (
                <p className="text-[11px] text-destructive font-medium">
                  {fieldErrors.whatsapp[0]}
                </p>
              )}
            </div>

            {/* 4-Digit Security PIN */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="perfPin" className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <KeyRound className="size-3.5 text-amber-500" />
                  <span>4-Digit Authorization PIN</span>
                  <span className="text-destructive">*</span>
                </Label>
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono font-bold">
                  Strictly 4 Digits
                </span>
              </div>
              <Input
                id="perfPin"
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                name="new_performer_auth_pin"
                data-lpignore="true"
                data-1p-ignore="true"
                data-form-type="other"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                placeholder="e.g. 1234"
                required
                disabled={isPending}
                className="h-9 text-xs font-mono tracking-widest text-center rounded-xl bg-amber-500/5 border-amber-500/30"
              />
              <p className="text-[10px] text-muted-foreground">
                Staff member will enter this 4-digit PIN whenever authorizing bookings, therapies, or cash transactions.
              </p>
              {fieldErrors.pin && (
                <p className="text-[11px] text-destructive font-medium">
                  {fieldErrors.pin[0]}
                </p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 sm:p-5 pt-3 border-t border-border/60 bg-muted/20 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => handleClose(false)}
              className="rounded-xl h-8.5 text-xs cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isPending}
              className="rounded-xl h-8.5 text-xs font-bold cursor-pointer"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  <span>Saving Performer...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3.5 mr-1.5" />
                  <span>Register Performer</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
