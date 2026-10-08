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
import {
  UserPlus,
  Phone,
  User,
  Calendar,
  MapPin,
  HeartHandshake,
  Loader2,
  Ticket,
  Mail,
  Briefcase,
  Droplet,
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
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [gender, setGender] = React.useState<Gender>(Gender.MALE);
  const [age, setAge] = React.useState<string>("");
  const [email, setEmail] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [emergencyPhone, setEmergencyPhone] = React.useState("");
  const [profession, setProfession] = React.useState("");
  const [bloodGroup, setBloodGroup] = React.useState("");
  const [performerId, setPerformerId] = React.useState(defaultPerformerId);
  const [performerPin, setPerformerPin] = React.useState("");
  const [proceedToBooking, setProceedToBooking] = React.useState(true);
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
    setEmail("");
    setAddress("");
    setEmergencyPhone("");
    setProfession("");
    setBloodGroup("");
    setPerformerPin("");
    setProceedToBooking(true);
    setErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    if (performerId && performers.length > 0 && !performerPin) {
      toast.error("Please enter your 4-digit receptionist PIN.");
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await createPatientAction({
        name,
        phone,
        gender,
        age: age ? parseInt(age, 10) : undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        emergencyPhone: emergencyPhone.trim() || undefined,
        profession: profession.trim() || undefined,
        bloodGroup: bloodGroup.trim() || undefined,
        performerId: performerId || undefined,
        pin: performerPin || undefined,
        checkInNow: false,
      });

      if (res.success && res.patient) {
        toast.success(res.message);
        onPatientCreated?.(res.patient, proceedToBooking, performerId);
        resetForm();
        onOpenChange(false);
      } else {
        if (res.fieldErrors) {
          setErrors(res.fieldErrors);
        }
        toast.error(res.message);
      }
    } catch {
      toast.error("An unexpected error occurred while creating patient.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-3xl lg:max-w-4xl max-h-[92dvh] flex flex-col p-0 overflow-hidden border-border/80 shadow-2xl rounded-2xl">
        <DialogHeader className="p-4 sm:p-5 pr-12 sm:pr-14 border-b border-border/60 shrink-0 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <UserPlus className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                Register New Patient
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Register patient profile and automatically assign Medical Record
                Number (MRN).
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

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
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Column: Demographics & Contact */}
              <div className="space-y-3.5">
                {/* Full Name */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <User className="size-3.5 text-primary" />
                    <span>Patient Full Name *</span>
                  </Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Mohammad Rahim"
                    required
                    className="h-9 text-xs"
                    disabled={isSubmitting}
                  />
                  {errors.name && (
                    <p className="text-[11px] text-destructive">{errors.name[0]}</p>
                  )}
                </div>

                {/* Phone & Age row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <Phone className="size-3.5 text-primary" />
                      <span>Contact Phone *</span>
                    </Label>
                    <Input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. 01712345678"
                      required
                      className="h-9 text-xs font-mono"
                      disabled={isSubmitting}
                    />
                    {errors.phone && (
                      <p className="text-[11px] text-destructive">
                        {errors.phone[0]}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <Calendar className="size-3.5 text-primary" />
                      <span>Age (Years)</span>
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      max={120}
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      placeholder="e.g. 35"
                      className="h-9 text-xs font-mono"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                {/* Emergency Phone */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <HeartHandshake className="size-3.5 text-muted-foreground" />
                    <span>Emergency / Guardian Phone</span>
                  </Label>
                  <Input
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)}
                    placeholder="e.g. 01812345678"
                    className="h-9 text-xs font-mono"
                    disabled={isSubmitting}
                  />
                </div>

                {/* Email Address */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Mail className="size-3.5 text-muted-foreground" />
                    <span>Email Address (Optional)</span>
                  </Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. patient@example.com"
                    className="h-9 text-xs"
                    disabled={isSubmitting}
                  />
                </div>

                {/* Profession */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Briefcase className="size-3.5 text-muted-foreground" />
                    <span>Profession (Optional)</span>
                  </Label>
                  <Input
                    value={profession}
                    onChange={(e) => setProfession(e.target.value)}
                    placeholder="e.g. Teacher, Business, Engineer, Homemaker"
                    className="h-9 text-xs"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* Right Column: Gender Quota, Address, Blood Group & Attribution */}
              <div className="space-y-3.5">
                {/* Gender Selection */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Patient Gender *{" "}
                    <span className="text-[10.5px] font-normal text-muted-foreground">
                      (Required for slot quota matching)
                    </span>
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setGender(Gender.MALE)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                        gender === Gender.MALE
                          ? "border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-300 ring-1 ring-sky-500"
                          : "border-border/70 bg-card hover:bg-muted/40 text-foreground"
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-sky-500" />
                        Male
                      </span>
                      <span className="text-[10px] font-mono font-normal text-muted-foreground">
                        Quota
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setGender(Gender.FEMALE)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                        gender === Gender.FEMALE
                          ? "border-pink-500 bg-pink-500/10 text-pink-700 dark:text-pink-300 ring-1 ring-pink-500"
                          : "border-border/70 bg-card hover:bg-muted/40 text-foreground"
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-pink-500" />
                        Female
                      </span>
                      <span className="text-[10px] font-mono font-normal text-muted-foreground">
                        Quota
                      </span>
                    </button>
                  </div>
                </div>

                {/* Blood Group */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Droplet className="size-3.5 text-rose-500" />
                    <span>Blood Group (Optional)</span>
                  </Label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(
                      (bg) => (
                        <button
                          key={bg}
                          type="button"
                          onClick={() =>
                            setBloodGroup(bloodGroup === bg ? "" : bg)
                          }
                          className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                            bloodGroup === bg
                              ? "bg-rose-500 text-white border-rose-600 shadow-xs"
                              : "bg-background border-border text-foreground hover:bg-muted"
                          }`}
                        >
                          {bg}
                        </button>
                      ),
                    )}
                  </div>
                </div>

                {/* Address */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <MapPin className="size-3.5 text-muted-foreground" />
                    <span>Area / Address</span>
                  </Label>
                  <Input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. Chanchra, Jashore"
                    className="h-9 text-xs"
                    disabled={isSubmitting}
                  />
                </div>

                {/* Performer Attribution */}
                {performers && performers.length > 0 && (
                  <ReceptionistPerformerSelect
                    performers={performers}
                    selectedPerformerId={performerId}
                    onSelectPerformerId={setPerformerId}
                    pin={performerPin}
                    onPinChange={setPerformerPin}
                    disabled={isSubmitting}
                    label="Authorizing Desk Performer"
                  />
                )}
              </div>
            </div>

            {/* Checkbox: Immediately proceed to book ticket */}
            <div className="pt-2 border-t border-border/50">
              <label className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={proceedToBooking}
                  onChange={(e) => setProceedToBooking(e.target.checked)}
                  className="size-4 rounded text-primary accent-primary cursor-pointer"
                />
                <span className="flex items-center gap-1.5 font-medium">
                  <Ticket className="size-3.5 text-primary" />
                  Immediately open ticket booking for this patient
                </span>
              </label>
            </div>
          </div>

          <DialogFooter className="shrink-0 p-3 sm:p-4 border-t border-border/60 bg-muted/20 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="rounded-xl h-9 text-xs cursor-pointer"
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
                Boolean(performers && performers.length > 0 && !performerId)
              }
              className="rounded-xl h-9 text-xs font-bold gap-2 cursor-pointer shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Registering...</span>
                </>
              ) : (
                <>
                  <UserPlus className="size-3.5" />
                  <span>Register Patient</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
