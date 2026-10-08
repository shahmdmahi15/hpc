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
import { Role, RoomAccessType } from "@/generated/prisma/enums";
import { updateUserAccountAction } from "@/actions/admin/user.action";
import { toast } from "sonner";
import {
  Pencil,
  Mail,
  Phone,
  Lock,
  User as UserIcon,
  Loader2,
  Stethoscope,
  Shield,
  Eye,
  EyeOff,
  DoorClosed,
  XCircle,
  KeyRound,
  Wand2,
  Copy,
  Check,
  CheckCircle2,
} from "lucide-react";

export interface EditAccountRoomOption {
  id: string;
  number: string;
  purpose?: string | null;
  accessType: string;
  status: string;
}

export interface EditAccountTargetUser {
  id: string;
  role: Role;
  name?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  consultationFee?: number | null;
  consultationRoomId?: string | null;
}

export interface EditAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: EditAccountTargetUser | null;
  rooms?: EditAccountRoomOption[];
  onSuccess?: () => void;
}

const COMMON_FEE_PRESETS = [500, 800, 1000, 1200, 1500, 2000];

/**
 * Generates a high-entropy, 14-character secure random password.
 */
function generateRandomPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const numbers = "23456789";
  const symbols = "@#%&*+!?";
  const all = upper + lower + numbers + symbols;

  let pwd = "";
  pwd += upper[Math.floor(Math.random() * upper.length)];
  pwd += lower[Math.floor(Math.random() * lower.length)];
  pwd += numbers[Math.floor(Math.random() * numbers.length)];
  pwd += symbols[Math.floor(Math.random() * symbols.length)];

  for (let i = 4; i < 14; i++) {
    pwd += all[Math.floor(Math.random() * all.length)];
  }

  return pwd
    .split("")
    .sort(() => 0.5 - Math.random())
    .join("");
}

export function EditAccountDialog({
  open,
  onOpenChange,
  user,
  rooms = [],
  onSuccess,
}: EditAccountDialogProps) {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [whatsapp, setWhatsapp] = React.useState("");
  const [consultationFee, setConsultationFee] = React.useState("1000");
  const [consultationRoomId, setConsultationRoomId] = React.useState("none");
  const [changePassword, setChangePassword] = React.useState(false);
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [copiedPassword, setCopiedPassword] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<
    Record<string, string[] | undefined>
  >({});
  const [generalError, setGeneralError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  // Populate state when dialog opens with target user
  React.useEffect(() => {
    if (open && user) {
      setName(user.name || "");
      setEmail(user.email || "");
      setWhatsapp(user.whatsapp || "");
      setConsultationFee(
        typeof user.consultationFee === "number" && !isNaN(user.consultationFee)
          ? String(user.consultationFee)
          : "1000",
      );
      setConsultationRoomId(user.consultationRoomId || "none");
      setPassword("");
      setChangePassword(false);
      setShowPassword(false);
      setCopiedPassword(false);
      setFieldErrors({});
      setGeneralError(null);
    }
  }, [open, user]);

  if (!user) return null;

  const isDoctor = user.role === Role.DOCTOR;

  const handleGeneratePassword = () => {
    const generated = generateRandomPassword();
    setPassword(generated);
    setShowPassword(true);
    navigator.clipboard.writeText(generated).then(() => {
      setCopiedPassword(true);
      toast.info("Generated secure password & copied to clipboard!");
      setTimeout(() => setCopiedPassword(false), 2500);
    });
  };

  const handleClose = (newOpen: boolean) => {
    if (!newOpen) {
      setFieldErrors({});
      setGeneralError(null);
      setChangePassword(false);
      setPassword("");
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    setFieldErrors({});

    // Client-side pre-flight validation
    const errors: Record<string, string[]> = {};
    if (!name.trim()) {
      errors.name = ["Full name is required."];
    }
    if (!email.trim() || !email.includes("@")) {
      errors.email = ["Please provide a valid email address."];
    }
    if (!whatsapp.trim()) {
      errors.whatsapp = ["WhatsApp number is required."];
    }
    if (changePassword && password.trim().length > 0 && password.trim().length < 6) {
      errors.password = ["New password must be at least 6 characters."];
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    const formData = new FormData();
    formData.set("userId", user.id);
    formData.set("name", name.trim());
    formData.set("email", email.trim().toLowerCase());
    formData.set("whatsapp", whatsapp.trim());

    if (isDoctor) {
      formData.set("consultationFee", consultationFee.trim());
      formData.set(
        "consultationRoomId",
        consultationRoomId && consultationRoomId !== "none"
          ? consultationRoomId
          : "none",
      );
    }

    if (changePassword && password.trim().length >= 6) {
      formData.set("newPassword", password.trim());
      formData.set("password", password.trim());
    }

    startTransition(async () => {
      const res = await updateUserAccountAction(undefined, formData);
      if (res.success) {
        toast.success(res.message);
        onSuccess?.();
        handleClose(false);
      } else {
        if (res.fieldErrors) {
          setFieldErrors(res.fieldErrors);
        }
        setGeneralError(res.message || "Failed to update account.");
        toast.error(res.message || "Failed to update account.");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[96vw] max-w-xl sm:max-w-2xl max-h-[92dvh] flex flex-col p-0 overflow-hidden rounded-2xl border bg-card shadow-2xl">
        {/* ========================================================= */}
        {/* 1. PINNED HEADER                                          */}
        {/* ========================================================= */}
        <div className="shrink-0 p-4 sm:p-5 pr-12 sm:pr-14 border-b border-border/60 bg-muted/20">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div
                className={`size-9 rounded-xl flex items-center justify-center shrink-0 ${
                  isDoctor
                    ? "bg-sky-500/15 text-sky-600 dark:text-sky-400"
                    : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                }`}
              >
                <Pencil className="size-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  Edit {isDoctor ? "Doctor" : "Administrator"} Account
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Update credentials, contact information, and consultation chamber settings
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* ========================================================= */}
        {/* 2. SCROLLABLE FORM BODY                                    */}
        {/* ========================================================= */}
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
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain max-h-[85vh] p-4 sm:p-5 space-y-4">
            {/* Hidden User Identifier */}
            <input type="hidden" name="userId" value={user.id} />

            {/* General Banner Error */}
            {generalError && (
              <div className="p-2.5 rounded-xl border border-destructive/30 bg-destructive/10 text-xs text-destructive font-medium">
                {generalError}
              </div>
            )}

            {/* Read-Only Role Indicator Badge */}
            <div
              className={`p-3 rounded-xl border flex items-center gap-2.5 transition-all ${
                isDoctor
                  ? "border-sky-500/30 bg-sky-500/10 text-sky-950 dark:text-sky-100"
                  : "border-rose-500/30 bg-rose-500/10 text-rose-950 dark:text-rose-100"
              }`}
            >
              <div
                className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${
                  isDoctor
                    ? "bg-sky-500/20 text-sky-600 dark:text-sky-400"
                    : "bg-rose-500/20 text-rose-600 dark:text-rose-400"
                }`}
              >
                {isDoctor ? (
                  <Stethoscope className="size-4" />
                ) : (
                  <Shield className="size-4" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground">
                    {isDoctor ? "Doctor Account" : "Administrator Account"}
                  </span>
                  <span
                    className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                      isDoctor
                        ? "bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-500/30"
                        : "bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/30"
                    }`}
                  >
                    {user.role}
                  </span>
                </div>
                <p className="text-[10.5px] text-muted-foreground mt-0.5">
                  {isDoctor
                    ? "Clinical practitioner with consultation queue & chamber privileges"
                    : "Root system administrator with audit, security, and desk oversight access"}
                </p>
              </div>
            </div>

            {/* Account Contact Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
              {/* Full Name */}
              <div className="space-y-1">
                <Label htmlFor="edit-name" className="text-xs font-bold text-foreground">
                  Full Name <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    id="edit-name"
                    name="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={
                      isDoctor ? "e.g. Dr. Sabrina Akhter, PT" : "e.g. Mahfuzur Rahman"
                    }
                    required
                    disabled={isPending}
                    autoComplete="off"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    className="pl-9 h-9 text-xs rounded-xl"
                  />
                </div>
                {fieldErrors.name && (
                  <p className="text-[11px] text-destructive font-medium">
                    {fieldErrors.name[0]}
                  </p>
                )}
              </div>

              {/* Email Address */}
              <div className="space-y-1">
                <Label htmlFor="edit-email" className="text-xs font-bold text-foreground">
                  Email Address <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    id="edit-email"
                    name="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. user@hpc.com"
                    required
                    disabled={isPending}
                    autoComplete="off"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    className="pl-9 h-9 text-xs rounded-xl font-mono"
                  />
                </div>
                {fieldErrors.email && (
                  <p className="text-[11px] text-destructive font-medium">
                    {fieldErrors.email[0]}
                  </p>
                )}
              </div>

              {/* WhatsApp / Phone */}
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="edit-whatsapp" className="text-xs font-bold text-foreground">
                  WhatsApp Number <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    id="edit-whatsapp"
                    name="whatsapp"
                    type="tel"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="e.g. +8801700000005"
                    required
                    disabled={isPending}
                    autoComplete="off"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    className="pl-9 h-9 text-xs rounded-xl font-mono"
                  />
                </div>
                {fieldErrors.whatsapp && (
                  <p className="text-[11px] text-destructive font-medium">
                    {fieldErrors.whatsapp[0]}
                  </p>
                )}
              </div>
            </div>

            {/* Doctor Configuration Section (Fee & Chamber) */}
            {isDoctor && (
              <div className="space-y-3 p-3.5 rounded-xl border border-sky-500/20 bg-sky-500/5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                  {/* Fee Input & Presets */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor="edit-doctor-fee"
                        className="text-xs font-bold text-foreground"
                      >
                        Default Consultation Fee (৳)
                      </Label>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        Per visit
                      </span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">
                        ৳
                      </span>
                      <Input
                        id="edit-doctor-fee"
                        name="consultationFee"
                        type="number"
                        min="0"
                        step="50"
                        value={consultationFee}
                        onChange={(e) => setConsultationFee(e.target.value)}
                        placeholder="1000"
                        required
                        disabled={isPending}
                        autoComplete="off"
                        data-lpignore="true"
                        data-1p-ignore="true"
                        className="pl-8 h-9 text-xs font-mono font-bold rounded-xl bg-background"
                      />
                    </div>
                    {/* Quick Preset Buttons */}
                    <div className="flex items-center gap-1 pt-0.5 flex-wrap">
                      {COMMON_FEE_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setConsultationFee(String(preset))}
                          className={`py-0.5 px-2 rounded-lg text-[10.5px] font-mono font-bold transition-all border cursor-pointer ${
                            consultationFee === String(preset)
                              ? "bg-sky-600 text-white border-sky-700 shadow-2xs"
                              : "bg-background border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                          }`}
                        >
                          ৳{preset}
                        </button>
                      ))}
                    </div>
                    {fieldErrors.consultationFee && (
                      <p className="text-[11px] text-destructive font-medium">
                        {fieldErrors.consultationFee[0]}
                      </p>
                    )}
                  </div>

                  {/* Consultation Chamber Assignment */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor="edit-doctor-chamber-select"
                        className="text-xs font-bold text-foreground flex items-center gap-1.5"
                      >
                        <DoorClosed className="size-3.5 text-indigo-500" />
                        <span>Assigned Chamber</span>
                      </Label>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        Optional
                      </span>
                    </div>
                    <Select
                      value={consultationRoomId}
                      onValueChange={(val) => setConsultationRoomId(val ?? "none")}
                    >
                      <SelectTrigger
                        id="edit-doctor-chamber-select"
                        className="h-9 text-xs rounded-xl bg-background border-border/80 w-full"
                      >
                        <SelectValue placeholder="Select chamber room..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-56">
                        <SelectItem value="none" label="-- Unassigned (Can be set later) --">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <XCircle className="size-3.5" />
                            <span>-- Unassigned (Can be set later) --</span>
                          </div>
                        </SelectItem>
                        {rooms.map((room) => {
                          const isDoctorType =
                            room.accessType === RoomAccessType.DOCTOR ||
                            (room.purpose &&
                              room.purpose.toLowerCase().includes("consultation"));
                          const roomLabel = `Room ${room.number}${room.purpose ? ` - ${room.purpose}` : ` (${room.accessType})`}`;
                          return (
                            <SelectItem key={room.id} value={room.id} label={roomLabel}>
                              <div className="flex items-center justify-between gap-3 w-full">
                                <span className="font-mono font-bold">
                                  Room {room.number}
                                </span>
                                <span className="text-muted-foreground text-[11px] truncate max-w-[140px]">
                                  {room.purpose || room.accessType}
                                </span>
                                {isDoctorType && (
                                  <span className="text-[9.5px] px-1 py-0.2 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold">
                                    Chamber
                                  </span>
                                )}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground">
                      Chamber will be pre-selected when calling patients into consultation.
                    </p>
                    {fieldErrors.consultationRoomId && (
                      <p className="text-[11px] text-destructive font-medium">
                        {fieldErrors.consultationRoomId[0]}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Optional Password Update Section */}
            <div className="p-3.5 rounded-xl border border-border/80 bg-muted/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <KeyRound className="size-3.5" />
                  </div>
                  <div>
                    <Label
                      htmlFor="toggle-change-password"
                      className="text-xs font-bold text-foreground cursor-pointer"
                    >
                      Update Password (Optional)
                    </Label>
                    <p className="text-[10.5px] text-muted-foreground">
                      Set a new direct password for this account if needed
                    </p>
                  </div>
                </div>
                <Button
                  id="toggle-change-password"
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => {
                    const nextState = !changePassword;
                    setChangePassword(nextState);
                    if (!nextState) {
                      setPassword("");
                    }
                  }}
                  className={`h-7 px-2.5 text-[11px] rounded-lg font-medium cursor-pointer transition-all ${
                    changePassword
                      ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                      : "border-border/80 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {changePassword ? "Cancel Password Change" : "Set New Password"}
                </Button>
              </div>

              {changePassword && (
                <div className="pt-2 border-t border-border/40 space-y-2.5 animate-in fade-in-50 duration-150">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor="new-account-password"
                        className="text-xs font-bold text-foreground"
                      >
                        New Account Password <span className="text-destructive">*</span>
                      </Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={handleGeneratePassword}
                        className="h-6 px-1.5 text-[10.5px] text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 gap-1 cursor-pointer"
                      >
                        <Wand2 className="size-3" />
                        <span>Generate Strong</span>
                      </Button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                      <Input
                        id="new-account-password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter minimum 6 characters..."
                        minLength={6}
                        disabled={isPending}
                        autoComplete="new-password"
                        data-lpignore="true"
                        data-1p-ignore="true"
                        className="pl-9 pr-16 h-9 text-xs rounded-xl font-mono"
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        {password && (
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(password).then(() => {
                                setCopiedPassword(true);
                                toast.success("Password copied!");
                                setTimeout(() => setCopiedPassword(false), 2000);
                              });
                            }}
                            className="text-muted-foreground hover:text-foreground p-1 cursor-pointer"
                            title="Copy password"
                          >
                            {copiedPassword ? (
                              <Check className="size-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="size-3.5" />
                            )}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="text-muted-foreground hover:text-foreground p-1 cursor-pointer"
                          title={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? (
                            <EyeOff className="size-3.5" />
                          ) : (
                            <Eye className="size-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                    {fieldErrors.password && (
                      <p className="text-[11px] text-destructive font-medium">
                        {fieldErrors.password[0]}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      Must be at least 6 characters. Leave field unexpanded to keep existing password unchanged.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ========================================================= */}
          {/* 3. PINNED FOOTER                                          */}
          {/* ========================================================= */}
          <DialogFooter className="shrink-0 p-3 sm:p-4 border-t border-border/60 bg-muted/20 flex flex-row items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => handleClose(false)}
              className="rounded-xl h-9 px-4 text-xs cursor-pointer font-medium"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isPending}
              className="rounded-xl h-9 px-5 text-xs font-bold cursor-pointer gap-1.5"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3.5" />
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
