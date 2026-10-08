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
import { Gender } from "@/generated/prisma/enums";
import {
  updatePatientAction,
  type PatientWithStats,
} from "@/actions/receptionist/patient.action";
import { ReceptionistPerformerSelect } from "@/components/receptionist/receptionist-performer-select";
import {
  UserCheck,
  Phone,
  User,
  MapPin,
  HeartHandshake,
  Loader2,
  Edit3,
  Mail,
  Briefcase,
  Droplet,
} from "lucide-react";
import { toast } from "sonner";
import { BLOOD_GROUPS } from "@/schemas/receptionist/patient.schema";

interface EditPatientDialogProps {
  open?: boolean;
  isOpen?: boolean;
  onOpenChange: (open: boolean) => void;
  patient: PatientWithStats | null;
  performers?: { id: string; name: string; phone: string }[];
  defaultPerformerId?: string;
  onPatientUpdated?: (patient: PatientWithStats) => void;
  onSuccess?: (patient: PatientWithStats) => void;
}

const GENDER_OPTIONS = [
  { value: Gender.MALE, label: "Male" },
  { value: Gender.FEMALE, label: "Female" },
] as const;

export function EditPatientDialog({
  open,
  isOpen,
  onOpenChange,
  patient,
  performers = [],
  defaultPerformerId = "",
  onPatientUpdated,
  onSuccess,
}: EditPatientDialogProps) {
  const dialogOpen = open !== undefined ? open : (isOpen ?? false);
  if (!patient) return null;

  return (
    <Dialog open={dialogOpen} onOpenChange={onOpenChange}>
      <EditPatientForm
        key={patient.id}
        patient={patient}
        performers={performers}
        defaultPerformerId={defaultPerformerId}
        onClose={() => onOpenChange(false)}
        onPatientUpdated={(p) => {
          onPatientUpdated?.(p);
          onSuccess?.(p);
        }}
      />
    </Dialog>
  );
}

interface EditPatientFormProps {
  patient: PatientWithStats;
  performers: { id: string; name: string; phone: string }[];
  defaultPerformerId: string;
  onClose: () => void;
  onPatientUpdated?: (patient: PatientWithStats) => void;
}

function EditPatientForm({
  patient,
  performers,
  defaultPerformerId,
  onClose,
  onPatientUpdated,
}: EditPatientFormProps) {
  const [name, setName] = React.useState(patient.name);
  const [phone, setPhone] = React.useState(patient.phone);
  const [gender, setGender] = React.useState<Gender>(patient.gender);
  const [age, setAge] = React.useState<string>(
    patient.age !== null && patient.age !== undefined
      ? String(patient.age)
      : "",
  );
  const [email, setEmail] = React.useState((patient as any).email || "");
  const [address, setAddress] = React.useState(patient.address || "");
  const [emergencyPhone, setEmergencyPhone] = React.useState(
    patient.emergencyPhone || "",
  );
  const [profession, setProfession] = React.useState(
    (patient as any).profession || "",
  );
  const [bloodGroup, setBloodGroup] = React.useState(
    (patient as any).bloodGroup || "",
  );
  const [performerId, setPerformerId] = React.useState<string>(
    () =>
      defaultPerformerId || (performers.length === 1 ? performers[0].id : ""),
  );
  const [performerPin, setPerformerPin] = React.useState<string>("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});

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
      const res = await updatePatientAction({
        id: patient.id,
        name: name.trim(),
        phone: phone.trim(),
        gender,
        age: age.trim() ? parseInt(age.trim(), 10) : undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        emergencyPhone: emergencyPhone.trim() || undefined,
        profession: profession.trim() || undefined,
        bloodGroup: bloodGroup.trim() || undefined,
        performerId: performerId || undefined,
        pin: performerPin || undefined,
      });

      if (res.success && res.patient) {
        toast.success(res.message);
        onPatientUpdated?.(res.patient as PatientWithStats);
        onClose();
      } else {
        if (res.fieldErrors) {
          setErrors(res.fieldErrors);
        }
        toast.error(res.message);
      }
    } catch {
      toast.error("An unexpected error occurred while updating patient.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DialogContent className="w-[96vw] max-w-2xl lg:max-w-3xl max-h-[92dvh] flex flex-col p-0 overflow-hidden border-border/80 shadow-2xl rounded-2xl">
      <DialogHeader className="p-4 sm:p-5 pb-3 sm:pb-4 pr-12 sm:pr-14 border-b border-border/60 shrink-0 bg-muted/20">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <Edit3 className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                Edit Patient Profile
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Update demographic, contact, and personal details for this
                patient.
              </DialogDescription>
            </div>
          </div>

          {patient.mrn && (
            <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 text-primary shrink-0">
              MRN: {patient.mrn}
            </span>
          )}
        </div>
      </DialogHeader>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col flex-1 min-h-0 overflow-hidden"
      >
        <div className="p-4 sm:p-5 overflow-y-auto overscroll-contain space-y-4 flex-1 min-h-0">
          {/* Full Name & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
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
              />
              {errors.name && (
                <p className="text-[11px] text-destructive font-medium">
                  {errors.name[0]}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Phone className="size-3.5 text-primary" />
                <span>Contact Phone *</span>
              </Label>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 01712345678"
                required
                className="h-9 text-xs font-mono"
              />
              {errors.phone && (
                <p className="text-[11px] text-destructive font-medium">
                  {errors.phone[0]}
                </p>
              )}
            </div>
          </div>

          {/* Gender & Age */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Gender Designation *
              </Label>
              <Select
                items={GENDER_OPTIONS}
                value={gender}
                onValueChange={(val) => val && setGender(val as Gender)}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select gender">
                    {(val: string | null) =>
                      val === Gender.FEMALE ? "Female" : "Male"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={Gender.MALE} className="text-xs">
                    Male
                  </SelectItem>
                  <SelectItem value={Gender.FEMALE} className="text-xs">
                    Female
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Age (Years)</Label>
              <Input
                type="number"
                min={0}
                max={130}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="e.g. 45"
                className="h-9 text-xs"
              />
            </div>
          </div>

          {/* Living Address */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <MapPin className="size-3.5 text-muted-foreground" />
              <span>Residential Address (Optional)</span>
            </Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. House 12, Road 4, Sector 7, Uttara, Dhaka"
              className="h-9 text-xs"
            />
          </div>

          {/* Emergency Contact Phone */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <HeartHandshake className="size-3.5 text-muted-foreground" />
              <span>Emergency Contact Phone (Optional)</span>
            </Label>
            <Input
              type="tel"
              value={emergencyPhone}
              onChange={(e) => setEmergencyPhone(e.target.value)}
              placeholder="e.g. 01812345678 (Spouse/Relative)"
              className="h-9 text-xs font-mono"
            />
          </div>

          {/* Email Address & Profession */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
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
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Briefcase className="size-3.5 text-muted-foreground" />
                <span>Profession (Optional)</span>
              </Label>
              <Input
                value={profession}
                onChange={(e) => setProfession(e.target.value)}
                placeholder="e.g. Teacher, Engineer, Homemaker"
                className="h-9 text-xs"
              />
            </div>
          </div>

          {/* Blood Group */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <Droplet className="size-3.5 text-rose-500" />
              <span>Blood Group (Optional)</span>
            </Label>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
              {BLOOD_GROUPS.map((bg) => (
                <button
                  key={bg}
                  type="button"
                  onClick={() => setBloodGroup(bloodGroup === bg ? "" : bg)}
                  className={`py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                    bloodGroup === bg
                      ? "bg-rose-500 text-white border-rose-600 shadow-xs"
                      : "bg-background border-border text-foreground hover:bg-muted"
                  }`}
                >
                  {bg}
                </button>
              ))}
            </div>
          </div>

          {/* Authorizing Performer Selection */}
          {performers.length > 0 && (
            <div className="pt-2 border-t border-border/60">
              <ReceptionistPerformerSelect
                performers={performers}
                selectedPerformerId={performerId}
                onSelectPerformerId={setPerformerId}
                pin={performerPin}
                onPinChange={setPerformerPin}
                disabled={isSubmitting}
                label="Authorizing Staff"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 sm:px-6 py-3 border-t border-border/60 bg-muted/20 shrink-0 flex items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-8.5 text-xs font-semibold rounded-lg"
          >
            Cancel
          </Button>

          <Button
            type="submit"
            size="sm"
            disabled={isSubmitting}
            className="h-8.5 text-xs font-bold gap-1.5 shadow-xs rounded-lg px-4"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <UserCheck className="size-3.5" />
                <span>Save Changes</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
