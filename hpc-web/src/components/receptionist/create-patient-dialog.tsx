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
import { Gender } from "@/generated/prisma/enums";
import { createPatientAction } from "@/actions/receptionist/patient.action";
import { ReceptionistPerformerSelect } from "@/components/receptionist/receptionist-performer-select";
import { BLOOD_GROUPS } from "@/schemas/receptionist/patient.schema";
import {
  UserPlus,
  Phone,
  User,
  Calendar,
  MapPin,
  HeartHandshake,
  Loader2,
  Mail,
  Briefcase,
  Droplet,
  CheckCircle2,
  DoorOpen,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

interface CreatePatientDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  performers?: { id: string; name: string; phone: string }[];
  defaultPerformerId?: string;
  onPatientCreated?: (
    patient: any,
    proceedToBooking: boolean,
    performerId?: string,
  ) => void;
}

export function CreatePatientDialog({
  isOpen,
  onOpenChange,
  performers = [],
  defaultPerformerId = "",
  onPatientCreated,
}: CreatePatientDialogProps) {
  // Mandatory fields
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [gender, setGender] = React.useState<Gender>(Gender.MALE);

  // Optional fields
  const [age, setAge] = React.useState<string>("");
  const [address, setAddress] = React.useState("");
  const [emergencyPhone, setEmergencyPhone] = React.useState("");
  const [bloodGroup, setBloodGroup] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [profession, setProfession] = React.useState("");

  // Check-In now into Waiting Room 200 (Default: true)
  const [checkInNow, setCheckInNow] = React.useState(true);

  // Staff Authorization (Performer & PIN)
  const [performerId, setPerformerId] = React.useState(defaultPerformerId);
  const [performerPin, setPerformerPin] = React.useState("");

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});

  React.useEffect(() => {
    if (isOpen) {
      if (defaultPerformerId) {
        setPerformerId(defaultPerformerId);
      } else if (performers.length === 1) {
        setPerformerId(performers[0].id);
      }
      setPerformerPin("");
    }
  }, [isOpen, defaultPerformerId, performers]);

  const resetForm = () => {
    setName("");
    setPhone("");
    setGender(Gender.MALE);
    setAge("");
    setAddress("");
    setEmergencyPhone("");
    setBloodGroup("");
    setEmail("");
    setProfession("");
    setPerformerPin("");
    setCheckInNow(true);
    setErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    // Client validation for mandatory fields
    if (!name.trim()) {
      toast.error("Patient full name is mandatory.");
      setIsSubmitting(false);
      return;
    }

    const cleanPhone = phone.replace(/^(\+880|880)/, "0").replace(/[\s-]/g, "");
    if (!/^01[3-9]\d{8}$/.test(cleanPhone)) {
      toast.error(
        "Please enter a valid 11-digit Bangladeshi mobile number starting with 01 (e.g. 01712345678).",
      );
      setIsSubmitting(false);
      return;
    }

    // PIN validation if staff performer is assigned or checkInNow is requested
    if (performers.length > 0 && !performerId) {
      toast.error("Please select an authorizing receptionist staff member.");
      setIsSubmitting(false);
      return;
    }

    if (performerId && (!performerPin || performerPin.trim().length !== 4)) {
      toast.error("Please enter your 4-digit receptionist security PIN.");
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await createPatientAction({
        name: name.trim(),
        phone: cleanPhone,
        gender,
        age: age ? parseInt(age, 10) : undefined,
        address: address.trim() || undefined,
        emergencyPhone: emergencyPhone.trim() || undefined,
        bloodGroup: bloodGroup.trim() || undefined,
        email: email.trim() || undefined,
        profession: profession.trim() || undefined,
        performerId: performerId || undefined,
        pin: performerPin.trim() || undefined,
        checkInNow,
      });

      if (res.success && res.patient) {
        toast.success(res.message);
        onPatientCreated?.(res.patient, !checkInNow, performerId);
        resetForm();
        onOpenChange(false);
      } else {
        if (res.fieldErrors) {
          setErrors(res.fieldErrors);
        }
        toast.error(res.message || "Failed to register patient.");
      }
    } catch {
      toast.error("An unexpected error occurred while creating patient.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-2xl lg:max-w-3xl max-h-[92dvh] flex flex-col p-0 overflow-hidden border-border/80 shadow-2xl rounded-2xl bg-card text-card-foreground">
        {/* Pinned Header */}
        <DialogHeader className="p-4 sm:p-5 pr-12 sm:pr-14 border-b border-border/60 shrink-0 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <UserPlus className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-base sm:text-lg font-black tracking-tight text-foreground">
                  Register New Patient
                </DialogTitle>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  MRN Auto-Gen
                </span>
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Register profile and optionally place into Waiting Room 200 immediately.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Form Body */}
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
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-5">
            {/* 1. MANDATORY CLINICAL FIELDS */}
            <div className="space-y-3 p-3.5 sm:p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  <Sparkles className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Mandatory Information (Required)</span>
                </div>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.2 rounded bg-emerald-500/20 text-emerald-800 dark:text-emerald-200">
                  3 Required Fields
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Full Name */}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-bold flex items-center justify-between text-foreground">
                    <span className="flex items-center gap-1.5">
                      <User className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Full Name *</span>
                    </span>
                    <span className="text-[10px] text-muted-foreground font-normal">
                      Min 2 letters
                    </span>
                  </Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Mohammad Rahim"
                    required
                    className="h-9.5 text-xs bg-background border-border/80 text-foreground font-medium"
                    disabled={isSubmitting}
                  />
                  {errors.name && (
                    <p className="text-[11px] text-destructive font-medium">{errors.name[0]}</p>
                  )}
                </div>

                {/* Mobile Number */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold flex items-center justify-between text-foreground">
                    <span className="flex items-center gap-1.5">
                      <Phone className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Mobile Number *</span>
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono font-normal">
                      11 digits (01...)
                    </span>
                  </Label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 01712345678"
                    required
                    className="h-9.5 text-xs font-mono bg-background border-border/80 text-foreground font-medium"
                    disabled={isSubmitting}
                  />
                  {errors.phone && (
                    <p className="text-[11px] text-destructive font-medium">{errors.phone[0]}</p>
                  )}
                </div>

                {/* Gender */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold flex items-center justify-between text-foreground">
                    <span>Patient Gender *</span>
                    <span className="text-[10px] text-muted-foreground font-normal">
                      Quota assignment
                    </span>
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setGender(Gender.MALE)}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        gender === Gender.MALE
                          ? "border-sky-500 bg-sky-500/15 text-sky-900 dark:text-sky-200 ring-2 ring-sky-500/20 shadow-2xs"
                          : "border-border/80 bg-background hover:bg-muted/50 text-foreground"
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-sky-500" />
                        Male
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground font-normal">
                        পুরুষ
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setGender(Gender.FEMALE)}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        gender === Gender.FEMALE
                          ? "border-pink-500 bg-pink-500/15 text-pink-900 dark:text-pink-200 ring-2 ring-pink-500/20 shadow-2xs"
                          : "border-border/80 bg-background hover:bg-muted/50 text-foreground"
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-pink-500" />
                        Female
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground font-normal">
                        মহিলা
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. OPTIONAL DEMOGRAPHIC FIELDS */}
            <div className="space-y-3.5 p-3.5 sm:p-4 rounded-xl border border-border/80 bg-card">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">
                  Optional Demographics &amp; Profile Details
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">
                  Optional (Can add later)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* Age */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                    <Calendar className="size-3.5 text-muted-foreground" />
                    <span>Age (Years)</span>
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={120}
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="e.g. 35"
                    className="h-9 text-xs font-mono bg-background"
                    disabled={isSubmitting}
                  />
                </div>

                {/* Blood Group */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                    <Droplet className="size-3.5 text-rose-500" />
                    <span>Blood Group</span>
                  </Label>
                  <div className="grid grid-cols-4 gap-1">
                    {BLOOD_GROUPS.map((bg) => (
                      <button
                        key={bg}
                        type="button"
                        onClick={() => setBloodGroup(bloodGroup === bg ? "" : bg)}
                        className={`h-9 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          bloodGroup === bg
                            ? "bg-rose-500 text-white border-rose-600 shadow-2xs"
                            : "bg-background border-border text-foreground hover:bg-muted"
                        }`}
                      >
                        {bg}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Emergency Contact */}
                <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                  <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                    <HeartHandshake className="size-3.5 text-muted-foreground" />
                    <span>Emergency Contact</span>
                  </Label>
                  <Input
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)}
                    placeholder="e.g. 01812345678"
                    className="h-9 text-xs font-mono bg-background"
                    disabled={isSubmitting}
                  />
                </div>

                {/* Address */}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                    <MapPin className="size-3.5 text-muted-foreground" />
                    <span>Area / Address</span>
                  </Label>
                  <Input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. Chanchra, Jashore"
                    className="h-9 text-xs bg-background"
                    disabled={isSubmitting}
                  />
                </div>

                {/* Profession */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                    <Briefcase className="size-3.5 text-muted-foreground" />
                    <span>Profession</span>
                  </Label>
                  <Input
                    value={profession}
                    onChange={(e) => setProfession(e.target.value)}
                    placeholder="e.g. Teacher, Homemaker"
                    className="h-9 text-xs bg-background"
                    disabled={isSubmitting}
                  />
                </div>

                {/* Email */}
                <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
                  <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                    <Mail className="size-3.5 text-muted-foreground" />
                    <span>Email Address</span>
                  </Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. patient@example.com"
                    className="h-9 text-xs bg-background"
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </div>

            {/* 3. CHECK-IN NOW (WAITING ROOM 200) & RECEPTIONIST PIN */}
            <div className="space-y-3.5 p-3.5 sm:p-4 rounded-xl border border-indigo-500/30 bg-indigo-500/5">
              {/* Checkbox: Mark checkin now */}
              <label className="flex items-start gap-3 text-xs text-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={checkInNow}
                  onChange={(e) => setCheckInNow(e.target.checked)}
                  className="size-4.5 mt-0.5 rounded text-emerald-600 accent-emerald-600 cursor-pointer shrink-0"
                />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-foreground flex items-center gap-1.5">
                      <DoorOpen className="size-4 text-emerald-600 dark:text-emerald-400" />
                      Mark check-in now (Waiting Room 200)
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 font-bold">
                      Automated Room 200
                    </span>
                  </div>
                  <p className="text-[11.5px] text-muted-foreground">
                    Automatically checks in patient to Waiting Room 200. No doctor or therapy queue assigned yet.
                  </p>
                </div>
              </label>

              {/* Authorizing Receptionist Performer Select & 4-Digit PIN */}
              {performers && performers.length > 0 && (
                <div className="pt-2 border-t border-indigo-500/20 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                    <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Receptionist Security Authorization</span>
                  </div>
                  <ReceptionistPerformerSelect
                    performers={performers}
                    selectedPerformerId={performerId}
                    onSelectPerformerId={setPerformerId}
                    pin={performerPin}
                    onPinChange={setPerformerPin}
                    disabled={isSubmitting}
                    label="Authorizing Receptionist Staff *"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Pinned Footer */}
          <DialogFooter className="shrink-0 p-3 sm:p-4 border-t border-border/60 bg-muted/20 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="rounded-xl h-9.5 px-4 text-xs font-semibold cursor-pointer border-border hover:bg-muted"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              size="sm"
              disabled={
                isSubmitting ||
                !name.trim() ||
                !phone.trim() ||
                Boolean(performers && performers.length > 0 && (!performerId || performerPin.length !== 4))
              }
              className="rounded-xl h-9.5 px-4 text-xs font-bold gap-2 cursor-pointer shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Registering...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3.5" />
                  <span>
                    {checkInNow
                      ? "Register & Check In (Room 200)"
                      : "Register Patient"}
                  </span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
