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
  const [address, setAddress] = React.useState("");
  const [emergencyPhone, setEmergencyPhone] = React.useState("");
  const [performerId, setPerformerId] = React.useState(defaultPerformerId);
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
    }
  }, [isOpen, defaultPerformerId, performers]);

  const resetForm = () => {
    setName("");
    setPhone("");
    setGender(Gender.MALE);
    setAge("");
    setAddress("");
    setEmergencyPhone("");
    setProceedToBooking(true);
    setErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    try {
      const res = await createPatientAction({
        name,
        phone,
        gender,
        age: age ? parseInt(age, 10) : undefined,
        address: address || undefined,
        emergencyPhone: emergencyPhone || undefined,
        performerId: performerId || undefined,
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
      <DialogContent className="w-[95vw] sm:max-w-lg md:max-w-xl max-h-[min(92vh,720px)] flex flex-col p-0 overflow-hidden border-border/80 shadow-2xl rounded-2xl">
        <DialogHeader className="p-5 pb-4 border-b border-border/60 shrink-0 bg-muted/20">
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
          className="flex flex-col flex-1 overflow-hidden"
        >
          <div className="p-5 overflow-y-auto space-y-4 flex-1">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

            {/* Gender Selection (Crucial for therapy slot quotas) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Patient Gender *{" "}
                <span className="text-[10.5px] font-normal text-muted-foreground">
                  (Used for slot quotas)
                </span>
              </Label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setGender(Gender.MALE)}
                  className={`flex items-center justify-between p-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                    gender === Gender.MALE
                      ? "border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-300 ring-1 ring-sky-500"
                      : "border-border/70 bg-card hover:bg-muted/40 text-foreground"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-sky-500" />
                    Male Patient
                  </span>
                  <span className="text-[10px] font-mono font-normal text-muted-foreground">
                    Male Quota
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setGender(Gender.FEMALE)}
                  className={`flex items-center justify-between p-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                    gender === Gender.FEMALE
                      ? "border-pink-500 bg-pink-500/10 text-pink-700 dark:text-pink-300 ring-1 ring-pink-500"
                      : "border-border/70 bg-card hover:bg-muted/40 text-foreground"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-pink-500" />
                    Female Patient
                  </span>
                  <span className="text-[10px] font-mono font-normal text-muted-foreground">
                    Female Quota
                  </span>
                </button>
              </div>
            </div>

            {/* Address & Emergency Contact */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <MapPin className="size-3.5 text-muted-foreground" />
                  <span>Area / Address</span>
                </Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Dhanmondi, Dhaka"
                  className="h-9 text-xs"
                  disabled={isSubmitting}
                />
              </div>

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
            </div>

            {/* Receptionist Performer Attribution */}
            {performers && performers.length > 0 && (
              <ReceptionistPerformerSelect
                performers={performers}
                selectedPerformerId={performerId}
                onSelectPerformerId={setPerformerId}
                disabled={isSubmitting}
                label="Authorizing Receptionist / Desk Staff"
              />
            )}

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

          <DialogFooter className="p-4 border-t border-border/60 bg-muted/10 shrink-0 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="cursor-pointer"
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
              className="gap-2 font-semibold cursor-pointer shadow-sm"
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
