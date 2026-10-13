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
import {
  directAddToDoctorQueueAction,
} from "@/actions/doctor/doctor.action";
import { searchPatientsAction } from "@/actions/receptionist/patient.action";
import {
  Stethoscope,
  Search,
  UserPlus,
  Loader2,
  Clock,
  UserCheck,
  Banknote,
  Hash,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

export interface DirectAddToDoctorQueueDoctor {
  id: string;
  name: string | null;
  consultationFee?: number;
  consultationRoomId?: string | null;
  consultationRoom?: {
    id: string;
    number: string;
    purpose?: string | null;
  } | null;
}

export interface DirectAddPatientInfo {
  id: string;
  name: string;
  phone: string;
  gender: string;
  mrn?: string | null;
}

interface DirectAddToDoctorQueueDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedPatient?: DirectAddPatientInfo | null;
  doctors?: DirectAddToDoctorQueueDoctor[];
  defaultDoctorId?: string;
  onSuccess: () => void;
  onOpenCreatePatient?: () => void;
}

export function DirectAddToDoctorQueueDialog(
  props: DirectAddToDoctorQueueDialogProps,
) {
  if (!props.isOpen) return null;
  return (
    <DirectAddToDoctorQueueDialogBody
      key="direct-add-doctor-queue-dialog"
      {...props}
    />
  );
}

function DirectAddToDoctorQueueDialogBody({
  onOpenChange,
  preselectedPatient = null,
  doctors = [],
  defaultDoctorId = "",
  onSuccess,
  onOpenCreatePatient,
}: DirectAddToDoctorQueueDialogProps) {
  const [selectedPatientId, setSelectedPatientId] = React.useState<string>(
    () => preselectedPatient?.id || "",
  );
  const [patientSearchQuery, setPatientSearchQuery] = React.useState<string>("");
  const [searchResults, setSearchResults] = React.useState<any[]>([]);
  const [isSearching, setIsSearching] = React.useState<boolean>(false);

  const [selectedDoctorId, setSelectedDoctorId] = React.useState<string>(
    () => defaultDoctorId || (doctors.length === 1 ? doctors[0].id : ""),
  );

  const [consultationFee, setConsultationFee] = React.useState<string>(() => {
    if (defaultDoctorId) {
      const doc = doctors.find((d) => d.id === defaultDoctorId);
      if (doc) return String(doc.consultationFee ?? 1000);
    }
    return "1000";
  });

  const [toldTime, setToldTime] = React.useState<string>(() => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    const h12 = hours % 12 || 12;
    return `${String(h12).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${ampm}`;
  });

  const [notes, setNotes] = React.useState<string>("");
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);

  // Live Patient Search
  React.useEffect(() => {
    let active = true;
    if (!patientSearchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchPatientsAction(patientSearchQuery);
        if (active) setSearchResults(results);
      } finally {
        if (active) setIsSearching(false);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [patientSearchQuery]);

  const selectedPatient = React.useMemo(() => {
    if (preselectedPatient && preselectedPatient.id === selectedPatientId) {
      return preselectedPatient;
    }
    return searchResults.find((p) => p.id === selectedPatientId) || null;
  }, [preselectedPatient, searchResults, selectedPatientId]);

  const handleDoctorChange = (docId: string) => {
    setSelectedDoctorId(docId);
    if (docId && docId !== "GENERAL") {
      const doc = doctors.find((d) => d.id === docId);
      if (doc) {
        setConsultationFee(String(doc.consultationFee ?? 1000));
      }
    } else {
      setConsultationFee("1000");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPatientId) {
      toast.error("Please search and select a patient.");
      return;
    }

    setIsSubmitting(true);
    try {
      const parsedFee = Math.max(0, parseFloat(consultationFee) || 0);

      const res = await directAddToDoctorQueueAction({
        patientId: selectedPatientId,
        doctorId: selectedDoctorId || undefined,
        feeAmount: parsedFee,
        toldTime: toldTime.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      if (res.success) {
        toast.success(res.message);
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      toast.error("Failed to add patient to doctor consultation queue.");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-2xl max-h-[92dvh] flex flex-col p-0 overflow-hidden border-border/80 shadow-2xl rounded-2xl">
        <DialogHeader className="p-4 sm:p-5 pr-12 sm:pr-14 border-b border-border/60 shrink-0 bg-sky-500/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/20 border border-sky-500/30 text-sky-700 dark:text-sky-300">
              <Stethoscope className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground flex items-center gap-1.5">
                <span>Add to Doctor Consultation Queue</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-700 dark:text-sky-300 font-bold uppercase tracking-wider">
                  Direct Queue
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Add any patient immediately into the Doctor Queue without
                prior serial booking or payment clearance.
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
          className="flex flex-col flex-1 min-h-0 overflow-hidden"
        >
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4">
            {/* Direct Queue Instant Info Badge */}
            <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-start gap-2.5 text-xs text-sky-950 dark:text-sky-200">
              <Sparkles className="size-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
              <div>
                <strong>Zero Serial Requirement:</strong> The patient will be
                immediately queued in the Doctor Chamber, live Waiting Room, and
                TV screens. The system automatically issues the next daily serial
                token.
              </div>
            </div>

            {/* 1. Patient Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-foreground">
                  Select Patient <span className="text-destructive">*</span>
                </Label>
                {onOpenCreatePatient && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenChange(false);
                      onOpenCreatePatient();
                    }}
                    className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <UserPlus className="size-3" />
                    <span>Register New Patient</span>
                  </button>
                )}
              </div>

              {selectedPatient ? (
                <div className="p-3 rounded-xl border border-sky-500/40 bg-sky-500/5 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">
                        {selectedPatient.name}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground font-semibold">
                        {selectedPatient.gender}
                      </span>
                      {selectedPatient.mrn && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-700 dark:text-sky-300 font-bold">
                          {selectedPatient.mrn}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">
                      {selectedPatient.phone}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedPatientId("")}
                    className="h-7 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="search"
                      name="direct_queue_patient_search"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      placeholder="Search patient by name, phone, or MRN..."
                      value={patientSearchQuery}
                      onChange={(e) => setPatientSearchQuery(e.target.value)}
                      className="pl-8 text-xs h-9"
                      autoFocus
                    />
                    {isSearching && (
                      <Loader2 className="size-3.5 absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />
                    )}
                  </div>

                  {patientSearchQuery.trim() && (
                    <div className="max-h-36 overflow-y-auto rounded-xl border border-border/70 divide-y divide-border/50 bg-card shadow-sm">
                      {searchResults.length === 0 && !isSearching ? (
                        <div className="p-3 text-center text-xs text-muted-foreground">
                          No matching patients found.
                        </div>
                      ) : (
                        searchResults.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setSelectedPatientId(p.id)}
                            className="w-full px-3 py-2 text-left hover:bg-muted/50 flex items-center justify-between cursor-pointer transition-colors"
                          >
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-foreground">
                                  {p.name}
                                </span>
                                {p.mrn && (
                                  <span className="text-[10px] font-mono text-muted-foreground">
                                    • {p.mrn}
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-muted-foreground font-mono">
                                {p.phone}
                              </span>
                            </div>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              {p.gender}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2. Doctor Assignment */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sky-700 dark:text-sky-300">
                  <Stethoscope className="size-3.5" />
                  <span>Assign Doctor (Optional)</span>
                </span>
                <span className="text-[10.5px] text-muted-foreground font-normal">
                  Chamber preset fee applies automatically
                </span>
              </Label>
              <Select
                value={selectedDoctorId || "GENERAL"}
                onValueChange={(val) => handleDoctorChange(val || "")}
              >
                <SelectTrigger className="h-9 text-xs bg-background">
                  <SelectValue placeholder="Select doctor..." />
                </SelectTrigger>
                <SelectContent className="text-xs">
                  <SelectItem value="GENERAL">
                    General Consultation (Any Available Doctor)
                  </SelectItem>
                  {doctors.map((doc) => (
                    <SelectItem key={doc.id} value={doc.id}>
                      {doc.name || "Doctor"}
                      {doc.consultationRoom
                        ? ` (Room ${doc.consultationRoom.number})`
                        : ""}
                      {" — ৳"}
                      {(doc.consultationFee ?? 1000).toLocaleString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 3. Consultation Fee & Told Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Banknote className="size-3.5 text-emerald-600" />
                  <span>Consultation Fee (৳)</span>
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="50"
                  value={consultationFee}
                  onChange={(e) => setConsultationFee(e.target.value)}
                  placeholder="1000"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Clock className="size-3.5 text-sky-600" />
                  <span>Told Time / Arrival Time</span>
                </Label>
                <Input
                  type="text"
                  value={toldTime}
                  onChange={(e) => setToldTime(e.target.value)}
                  placeholder="e.g. 10:30 AM"
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>

            {/* 4. Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">
                Queue Note / Chief Complaint (Optional)
              </Label>
              <Input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Follow-up consultation, severe acute pain, etc."
                className="h-9 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="p-3 sm:p-4 border-t border-border/60 bg-muted/20 shrink-0 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="h-8 text-xs cursor-pointer"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !selectedPatientId}
              className="h-8 text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white cursor-pointer gap-1.5 shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Adding to Queue...</span>
                </>
              ) : (
                <>
                  <UserCheck className="size-3.5" />
                  <span>Add to Doctor Queue</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
