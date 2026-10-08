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
import { Role } from "@/generated/prisma/enums";
import { createUserAccountAction } from "@/actions/admin/user.action";
import { toast } from "sonner";
import {
  UserPlus,
  Mail,
  Phone,
  Lock,
  User as UserIcon,
  Loader2,
  Stethoscope,
  Shield,
  Eye,
  EyeOff,
} from "lucide-react";

import {
  DoorClosed,
  Building2,
  XCircle,
  Sparkles,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RoomAccessType } from "@/generated/prisma/enums";

export interface CreateAccountRoomOption {
  id: string;
  number: string;
  purpose?: string | null;
  accessType: string;
  status: string;
}

interface CreateAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultRole?: typeof Role.ADMIN | typeof Role.DOCTOR;
  rooms?: CreateAccountRoomOption[];
}

export function CreateAccountDialog({
  open,
  onOpenChange,
  defaultRole = Role.DOCTOR,
  rooms = [],
}: CreateAccountDialogProps) {
  const [role, setRole] = React.useState<typeof Role.ADMIN | typeof Role.DOCTOR>(defaultRole);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [whatsapp, setWhatsapp] = React.useState("");
  const [consultationFee, setConsultationFee] = React.useState("1000");
  const [consultationRoomId, setConsultationRoomId] = React.useState("none");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<
    Record<string, string[] | undefined>
  >({});
  const [generalError, setGeneralError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) {
      setRole(defaultRole);
    }
  }, [open, defaultRole]);

  const handleClose = (newOpen: boolean) => {
    if (!newOpen) {
      setName("");
      setEmail("");
      setWhatsapp("");
      setConsultationFee("1000");
      setConsultationRoomId("none");
      setPassword("");
      setFieldErrors({});
      setGeneralError(null);
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    setFieldErrors({});

    const formData = new FormData();
    formData.set("role", role);
    formData.set("name", name.trim());
    formData.set("email", email.trim().toLowerCase());
    formData.set("whatsapp", whatsapp.trim());
    formData.set("password", password);
    if (role === Role.DOCTOR) {
      formData.set("consultationFee", consultationFee.trim());
      if (consultationRoomId && consultationRoomId !== "none") {
        formData.set("consultationRoomId", consultationRoomId);
      }
    }

    startTransition(async () => {
      const res = await createUserAccountAction(undefined, formData);
      if (res.success) {
        toast.success(res.message);
        handleClose(false);
      } else {
        if (res.fieldErrors) {
          setFieldErrors(res.fieldErrors);
        }
        setGeneralError(res.message || "Failed to create user account.");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[96vw] max-w-xl sm:max-w-2xl max-h-[92dvh] flex flex-col p-0 overflow-hidden rounded-2xl border bg-card shadow-2xl">
        {/* Header - Pinned at top */}
        <div className="shrink-0 p-4 sm:p-5 pr-12 sm:pr-14 border-b border-border/60 bg-muted/20">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <UserPlus className="size-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  Create {role === Role.DOCTOR ? "Doctor" : "Administrator"} Account
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Register an isolated individual account with direct credentials
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Form Container - flex column with scrollable body */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 min-h-0 overflow-hidden"
        >
          {/* Scrollable Form Body */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4">
            {generalError && (
              <div className="p-2.5 rounded-xl border border-destructive/30 bg-destructive/10 text-xs text-destructive font-medium">
                {generalError}
              </div>
            )}

            {/* Role Switcher */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">
                Account Role
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRole(Role.DOCTOR)}
                  className={`p-2.5 rounded-xl border flex items-center gap-2 text-left cursor-pointer transition-all ${
                    role === Role.DOCTOR
                      ? "border-sky-500 bg-sky-500/10 text-sky-900 dark:text-sky-200 ring-1 ring-sky-500/40 font-bold"
                      : "border-border/80 bg-background text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  <div className="size-7 rounded-lg bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                    <Stethoscope className="size-3.5" />
                  </div>
                  <div>
                    <div className="text-xs">Doctor</div>
                    <div className="text-[10px] opacity-75 font-normal">
                      Clinical Practitioner
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setRole(Role.ADMIN)}
                  className={`p-2.5 rounded-xl border flex items-center gap-2 text-left cursor-pointer transition-all ${
                    role === Role.ADMIN
                      ? "border-rose-500 bg-rose-500/10 text-rose-900 dark:text-rose-200 ring-1 ring-rose-500/40 font-bold"
                      : "border-border/80 bg-background text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  <div className="size-7 rounded-lg bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                    <Shield className="size-3.5" />
                  </div>
                  <div>
                    <div className="text-xs">Administrator</div>
                    <div className="text-[10px] opacity-75 font-normal">
                      System Operations
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* 2-Column Responsive Inputs on sm+ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
              {/* Full Name */}
              <div className="space-y-1">
                <Label htmlFor="name" className="text-xs font-bold text-foreground">
                  Full Name <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={
                      role === Role.DOCTOR
                        ? "e.g. Dr. Sabrina Akhter, PT"
                        : "e.g. Mahfuzur Rahman"
                    }
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

              {/* Email */}
              <div className="space-y-1">
                <Label htmlFor="email" className="text-xs font-bold text-foreground">
                  Email Address <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. doctor@hpc.com"
                    required
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

              {/* WhatsApp Phone */}
              <div className="space-y-1">
                <Label htmlFor="whatsapp" className="text-xs font-bold text-foreground">
                  WhatsApp Number <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    id="whatsapp"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="e.g. +8801700000005"
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

              {/* Initial Password */}
              <div className="space-y-1">
                <Label htmlFor="password" className="text-xs font-bold text-foreground">
                  Account Password <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters..."
                    required
                    minLength={6}
                    disabled={isPending}
                    className="pl-9 pr-9 h-9 text-xs rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="size-3.5" />
                    ) : (
                      <Eye className="size-3.5" />
                    )}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p className="text-[11px] text-destructive font-medium">
                    {fieldErrors.password[0]}
                  </p>
                )}
              </div>
            </div>

            {/* Doctor Default Consultation Fee & Chamber (Only when role is DOCTOR) */}
            {role === Role.DOCTOR && (
              <div className="space-y-3 p-3.5 rounded-xl border border-sky-500/20 bg-sky-500/5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                  {/* Fee Input & Presets */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="doctor-fee" className="text-xs font-bold text-foreground">
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
                        id="doctor-fee"
                        type="number"
                        min="0"
                        step="50"
                        value={consultationFee}
                        onChange={(e) => setConsultationFee(e.target.value)}
                        placeholder="1000"
                        required
                        disabled={isPending}
                        className="pl-8 h-9 text-xs font-mono font-bold rounded-xl bg-background"
                      />
                    </div>
                    <div className="flex items-center gap-1 pt-0.5 flex-wrap">
                      {[500, 800, 1000, 1200, 1500].map((preset) => (
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
                  </div>

                  {/* Consultation Chamber Assignment */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor="doctor-chamber-select"
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
                        id="doctor-chamber-select"
                        className="h-9 text-xs rounded-xl bg-background border-border/80 w-full"
                      >
                        <SelectValue placeholder="Select chamber room..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-56">
                        <SelectItem value="none">
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
                          return (
                            <SelectItem key={room.id} value={room.id}>
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
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sticky Pinned Footer - ALWAYS VISIBLE */}
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
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <UserPlus className="size-3.5" />
                  <span>Create Account</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
