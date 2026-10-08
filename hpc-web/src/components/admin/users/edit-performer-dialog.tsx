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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROLES } from "@/components/login/role-config";
import { updatePerformerAction } from "@/actions/admin/performer.action";
import { Role } from "@/generated/prisma/enums";
import { toast } from "sonner";
import {
  UserCheck,
  User as UserIcon,
  Phone,
  Mail,
  KeyRound,
  Building2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface EditPerformerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  performer: {
    id: string;
    name: string;
    phone: string;
    whatsapp?: string;
    email?: string | null;
    pin: string;
    userId: string;
    role?: Role;
  } | null;
  desks: {
    id: string;
    role: Role;
  }[];
  onSuccess?: () => void;
}

export function EditPerformerDialog({
  open,
  onOpenChange,
  performer,
  desks,
  onSuccess,
}: EditPerformerDialogProps) {
  // Only desk roles can have performers
  const eligibleDesks = React.useMemo(() => {
    return desks.filter(
      (d) =>
        d.role === Role.RECEPTIONIST ||
        d.role === Role.HANDLER ||
        d.role === Role.CASHIER,
    );
  }, [desks]);

  const [selectedUserId, setSelectedUserId] = React.useState<string>(
    () => performer?.userId || eligibleDesks[0]?.id || "",
  );
  const [name, setName] = React.useState<string>(() => performer?.name || "");
  const [phone, setPhone] = React.useState<string>(
    () => performer?.whatsapp || performer?.phone || "",
  );
  const [email, setEmail] = React.useState<string>(() => performer?.email || "");
  const [pin, setPin] = React.useState<string>(() => performer?.pin || "");
  const [showPin, setShowPin] = React.useState<boolean>(false);

  const [fieldErrors, setFieldErrors] = React.useState<
    Record<string, string[] | undefined>
  >({});
  const [generalError, setGeneralError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  // Reset or synchronize form fields whenever the selected performer or dialog open state updates
  React.useEffect(() => {
    if (performer && open) {
      setSelectedUserId(performer.userId || eligibleDesks[0]?.id || "");
      setName(performer.name || "");
      setPhone(performer.whatsapp || performer.phone || "");
      setEmail(performer.email || "");
      setPin(performer.pin || "");
      setShowPin(false);
      setFieldErrors({});
      setGeneralError(null);
    }
  }, [performer, open, eligibleDesks]);

  const handleClose = (newOpen: boolean) => {
    if (!newOpen) {
      setFieldErrors({});
      setGeneralError(null);
      setShowPin(false);
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    setFieldErrors({});

    if (!performer?.id) {
      setGeneralError("No staff performer selected for editing.");
      return;
    }

    if (!selectedUserId) {
      setGeneralError("Please select a target station desk.");
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setFieldErrors((prev) => ({
        ...prev,
        name: ["Staff full name must be at least 2 characters."],
      }));
      return;
    }

    const trimmedPhone = phone.trim();
    if (!trimmedPhone || trimmedPhone.length < 6) {
      setFieldErrors((prev) => ({
        ...prev,
        whatsapp: ["Please provide a valid WhatsApp / phone number."],
      }));
      return;
    }

    const trimmedPin = pin.trim();
    if (!/^\d{4}$/.test(trimmedPin)) {
      setFieldErrors((prev) => ({
        ...prev,
        pin: ["Security PIN must be exactly 4 digits (e.g., 1234)."],
      }));
      return;
    }

    const formData = new FormData();
    formData.append("performerId", performer.id);
    formData.append("userId", selectedUserId);
    formData.append("name", trimmedName);
    if (email.trim()) {
      formData.append("email", email.trim().toLowerCase());
    }
    formData.append("whatsapp", trimmedPhone);
    formData.append("phone", trimmedPhone);
    formData.append("pin", trimmedPin);

    startTransition(async () => {
      const result = await updatePerformerAction(undefined, formData);

      if (result.success) {
        toast.success(result.message);
        onSuccess?.();
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

  if (!performer) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[96vw] max-w-xl max-h-[85vh] flex flex-col p-0 overflow-hidden border-border/80 shadow-2xl rounded-2xl">
        <form
          onSubmit={handleSubmit}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-lpignore="true"
          data-1p-ignore="true"
          data-bwignore="true"
          data-form-type="other"
          className="flex flex-col flex-1 min-h-0 overflow-hidden"
        >
          {/* Tier 1: Pinned DialogHeader */}
          <div className="shrink-0 bg-muted/40 p-4 sm:p-5 border-b border-border/60">
            <DialogHeader className="pr-10 sm:pr-12 text-left">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                  <UserCheck className="size-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-foreground">
                    Edit Staff Performer
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Update staff profile, contact number, station desk, or 4-digit security PIN
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          {/* Tier 2: Scrollable Form Body */}
          <div className="flex-1 min-h-0 max-h-[85vh] overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4">
            {/* Hidden Performer ID */}
            <input type="hidden" name="performerId" value={performer.id} />
            <input type="hidden" name="userId" value={selectedUserId} />

            {generalError && (
              <div className="p-2.5 rounded-xl border border-destructive/30 bg-destructive/10 text-xs text-destructive flex items-center gap-2 font-medium">
                <AlertCircle className="size-3.5 shrink-0" />
                <span>{generalError}</span>
              </div>
            )}

            {/* Target Station Desk Select */}
            <div className="space-y-1.5">
              <Label
                htmlFor="edit-station-desk-select"
                className="text-xs font-bold text-foreground flex items-center gap-1.5"
              >
                <Building2 className="size-3.5 text-primary" />
                <span>Target Station Desk</span>
                <span className="text-destructive">*</span>
              </Label>
              <Select
                value={selectedUserId}
                onValueChange={(val) => {
                  if (val) setSelectedUserId(val);
                }}
                disabled={isPending}
              >
                <SelectTrigger
                  id="edit-station-desk-select"
                  className="h-10 text-xs rounded-xl bg-background border-border/80 w-full"
                >
                  <SelectValue placeholder="Select target station desk..." />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {eligibleDesks.map((desk) => {
                    const cfg = ROLES.find((r) => r.value === desk.role);
                    const Icon = cfg?.icon || Building2;
                    return (
                      <SelectItem key={desk.id} value={desk.id}>
                        <div className="flex items-center gap-2.5">
                          <div
                            className={cn(
                              "size-5 rounded-md flex items-center justify-center shrink-0 border text-[10px]",
                              cfg?.color || "bg-muted text-muted-foreground border-border",
                            )}
                          >
                            <Icon className="size-3" />
                          </div>
                          <span className="font-semibold text-xs text-foreground">
                            {cfg?.defaultLabel || desk.role} Desk
                          </span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {fieldErrors.userId && (
                <p className="text-[11px] text-destructive font-medium mt-1">
                  {fieldErrors.userId[0]}
                </p>
              )}
            </div>

            {/* Responsive 2-Col Grid: Name and Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
              {/* Staff Full Name */}
              <div className="space-y-1">
                <Label
                  htmlFor="edit-perf-name"
                  className="text-xs font-bold text-foreground flex items-center gap-1"
                >
                  <UserIcon className="size-3 text-muted-foreground" />
                  <span>Staff Full Name</span>
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="edit-perf-name"
                  name="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ayesha Siddiqua"
                  required
                  disabled={isPending}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-bwignore="true"
                  data-form-type="other"
                  className="h-9.5 text-xs rounded-xl bg-background"
                />
                {fieldErrors.name && (
                  <p className="text-[11px] text-destructive font-medium mt-1">
                    {fieldErrors.name[0]}
                  </p>
                )}
              </div>

              {/* Staff Email (Optional) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="edit-perf-email"
                    className="text-xs font-bold text-foreground flex items-center gap-1"
                  >
                    <Mail className="size-3 text-muted-foreground" />
                    <span>Email Address</span>
                  </Label>
                  <span className="text-[10px] text-muted-foreground font-normal">
                    (optional)
                  </span>
                </div>
                <Input
                  id="edit-perf-email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. staff@hpc.com"
                  disabled={isPending}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-bwignore="true"
                  data-form-type="other"
                  className="h-9.5 text-xs rounded-xl bg-background"
                />
                {fieldErrors.email && (
                  <p className="text-[11px] text-destructive font-medium mt-1">
                    {fieldErrors.email[0]}
                  </p>
                )}
              </div>
            </div>

            {/* Responsive 2-Col Grid: Phone/WhatsApp and 4-Digit Security PIN */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
              {/* WhatsApp / Phone */}
              <div className="space-y-1">
                <Label
                  htmlFor="edit-perf-phone"
                  className="text-xs font-bold text-foreground flex items-center gap-1"
                >
                  <Phone className="size-3 text-muted-foreground" />
                  <span>WhatsApp / Phone</span>
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="edit-perf-phone"
                  name="whatsapp"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 01811111101"
                  required
                  disabled={isPending}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-bwignore="true"
                  data-form-type="other"
                  className="h-9.5 text-xs rounded-xl bg-background"
                />
                {fieldErrors.whatsapp && (
                  <p className="text-[11px] text-destructive font-medium mt-1">
                    {fieldErrors.whatsapp[0]}
                  </p>
                )}
              </div>

              {/* 4-Digit Security PIN */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="edit-perf-pin"
                    className="text-xs font-bold text-foreground flex items-center gap-1.5"
                  >
                    <KeyRound className="size-3.5 text-amber-500" />
                    <span>4-Digit Security PIN</span>
                    <span className="text-destructive">*</span>
                  </Label>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono font-bold">
                    4 Digits
                  </span>
                </div>
                <div className="relative">
                  <Input
                    id="edit-perf-pin"
                    name="pin"
                    type={showPin ? "text" : "password"}
                    inputMode="numeric"
                    maxLength={4}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                    placeholder="e.g. 1234"
                    required
                    disabled={isPending}
                    autoComplete="one-time-code"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-bwignore="true"
                    data-form-type="other"
                    className="h-9.5 text-xs font-mono tracking-widest text-center rounded-xl bg-amber-500/5 border-amber-500/30 pr-10 focus-visible:ring-amber-500/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin((prev) => !prev)}
                    tabIndex={-1}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
                    title={showPin ? "Hide PIN" : "Show PIN"}
                    aria-label={showPin ? "Hide PIN" : "Show PIN"}
                  >
                    {showPin ? (
                      <EyeOff className="size-3.5" />
                    ) : (
                      <Eye className="size-3.5" />
                    )}
                  </button>
                </div>
                {fieldErrors.pin && (
                  <p className="text-[11px] text-destructive font-medium mt-1">
                    {fieldErrors.pin[0]}
                  </p>
                )}
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground bg-muted/30 p-2.5 rounded-lg border border-border/50 leading-relaxed">
              Staff members use this 4-digit PIN whenever verifying client intake, therapy sessions, or issuing receipts at the designated desk.
            </p>
          </div>

          {/* Tier 3: Pinned DialogFooter */}
          <DialogFooter className="shrink-0 p-3 sm:p-4 border-t border-border/60 bg-muted/20 flex flex-row items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => handleClose(false)}
              className="rounded-xl h-9 px-4 text-xs cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isPending}
              className="rounded-xl h-9 px-4 text-xs font-bold cursor-pointer"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3.5 mr-1.5" />
                  <span>Save Changes</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
