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
  ReceptionistPerformerSelect,
  type ReceptionistPerformer,
} from "@/components/receptionist/receptionist-performer-select";
import {
  type PatientWithCount,
  addPatientToQueueAction,
} from "@/actions/receptionist/appointment.action";
import { searchPatientsAction } from "@/actions/receptionist/patient.action";
import { QueueType } from "@/generated/prisma/enums";
import {
  Activity,
  Stethoscope,
  Search,
  UserPlus,
  Loader2,
  Clock,
  CheckCircle2,
  UserCheck,
  Banknote,
} from "lucide-react";
import { toast } from "sonner";

export interface AddToQueueDoctor {
  id: string;
  name: string | null;
  email: string | null;
  consultationFee: number;
}

interface AddToQueueDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  patients: PatientWithCount[];
  doctors?: AddToQueueDoctor[];
  performers: ReceptionistPerformer[];
  defaultPerformerId?: string;
  onSuccess: () => void;
  onOpenCreatePatient: () => void;
}

export function AddToQueueDialog(props: AddToQueueDialogProps) {
  if (!props.isOpen) return null;
  return <AddToQueueDialogBody key="add-to-queue-dialog-body" {...props} />;
}

function AddToQueueDialogBody({
  onOpenChange,
  patients,
  doctors = [],
  performers,
  defaultPerformerId = "",
  onSuccess,
  onOpenCreatePatient,
}: AddToQueueDialogProps) {
  const [selectedPatientId, setSelectedPatientId] = React.useState<string>("");
  const [patientSearchQuery, setPatientSearchQuery] =
    React.useState<string>("");
  const [selectedQueueType, setSelectedQueueType] = React.useState<QueueType>(
    QueueType.THERAPY,
  );
  const [selectedDoctorId, setSelectedDoctorId] = React.useState<string>("");
  const [consultationFee, setConsultationFee] = React.useState<string>("1000");

  const [toldTime, setToldTime] = React.useState<string>(() => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    const h12 = hours % 12 || 12;
    return `${String(h12).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${ampm}`;
  });
  const [notes, setNotes] = React.useState<string>("");
  const [selectedPerformerId, setSelectedPerformerId] = React.useState<string>(
    () =>
      defaultPerformerId || (performers.length === 1 ? performers[0].id : ""),
  );
  const [performerPin, setPerformerPin] = React.useState<string>("");
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);

  // When a doctor is selected, update fee to the doctor's preset fee
  const handleDoctorChange = (docId: string) => {
    setSelectedDoctorId(docId);
    if (docId) {
      const doc = doctors.find((d) => d.id === docId);
      if (doc) {
        setConsultationFee(String(doc.consultationFee ?? 1000));
      }
    } else {
      setConsultationFee("1000");
    }
  };

  const doctorSelectItems = React.useMemo(() => {
    return [
      { value: "GENERAL", label: "General Consultation (No Doctor Pre-assigned)" },
      ...doctors.map((doc) => ({
        value: doc.id,
        label: `${doc.name || "Doctor"} — Preset Fee: ৳${(doc.consultationFee ?? 1000).toLocaleString()}`,
      })),
    ];
  }, [doctors]);

  const [searchResults, setSearchResults] = React.useState<any[]>([]);
  const [isSearching, setIsSearching] = React.useState<boolean>(false);

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

  // Filter patients by search query (live search if query present, else initial recent list)
  const filteredPatients = React.useMemo(() => {
    if (patientSearchQuery.trim()) {
      return searchResults;
    }
    return patients.slice(0, 8);
  }, [patients, patientSearchQuery, searchResults]);

  const selectedPatient = React.useMemo(
    () =>
      patients.find((p) => p.id === selectedPatientId) ||
      searchResults.find((p) => p.id === selectedPatientId) ||
      null,
    [patients, searchResults, selectedPatientId],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPatientId) {
      toast.error("Please search and select a patient.");
      return;
    }

    if (!selectedPerformerId && performers.length > 0) {
      toast.error("Please select an authorizing receptionist.");
      return;
    }

    if (selectedPerformerId && performers.length > 0 && !performerPin) {
      toast.error("Please enter your 4-digit receptionist PIN.");
      return;
    }

    setIsSubmitting(true);
    try {
      const parsedFee =
        selectedQueueType === QueueType.CONSULTATION
          ? Math.max(0, parseFloat(consultationFee) || 0)
          : undefined;

      const res = await addPatientToQueueAction({
        patientId: selectedPatientId,
        queueType: selectedQueueType,
        doctorId: selectedDoctorId || undefined,
        feeAmount: parsedFee,
        toldTime: toldTime.trim() || undefined,
        notes: notes.trim() || undefined,
        performerId: selectedPerformerId || undefined,
        pin: performerPin || undefined,
      });

      if (res.success) {
        toast.success(res.message);
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      toast.error("Failed to add patient to queue.");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-4xl lg:max-w-5xl max-h-[min(90dvh,calc(100dvh-1.5rem))] flex flex-col p-0 overflow-hidden border-border/80 shadow-2xl rounded-2xl">
        <DialogHeader className="p-5 pb-4 pr-12 sm:pr-14 border-b border-border/60 shrink-0 bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <UserCheck className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Add Patient to Live Queue
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Check in a patient directly to the Therapy or Consultation
                queue.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-5 space-y-4 overflow-y-auto flex-1">
            {/* 1. Patient Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-foreground">
                  Select Patient <span className="text-destructive">*</span>
                </Label>
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
              </div>

              {selectedPatient ? (
                <div className="p-3 rounded-xl border border-primary/30 bg-primary/5 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">
                        {selectedPatient.name}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground font-semibold">
                        {selectedPatient.gender}
                      </span>
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
                      name="add_queue_patient_search_query"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      data-lpignore="true"
                      data-1p-ignore="true"
                      data-form-type="other"
                      placeholder="Search patient by name or phone..."
                      value={patientSearchQuery}
                      onChange={(e) => setPatientSearchQuery(e.target.value)}
                      className="pl-8 text-xs h-9"
                      autoFocus
                    />
                  </div>

                  <div className="max-h-36 overflow-y-auto rounded-xl border border-border/70 divide-y divide-border/50 bg-card">
                    {filteredPatients.length === 0 ? (
                      <div className="p-3 text-center text-xs text-muted-foreground">
                        No matching patients found.
                      </div>
                    ) : (
                      filteredPatients.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setSelectedPatientId(p.id)}
                          className="w-full px-3 py-2 text-left hover:bg-muted/50 flex items-center justify-between cursor-pointer transition-colors"
                        >
                          <div>
                            <span className="text-xs font-bold text-foreground block">
                              {p.name}
                            </span>
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
                </div>
              )}
            </div>

            {/* 2. Queue Selector */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-foreground">
                Select Destination Queue{" "}
                <span className="text-destructive">*</span>
              </Label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedQueueType(QueueType.THERAPY)}
                  className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                    selectedQueueType === QueueType.THERAPY
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-950 dark:text-emerald-200 ring-2 ring-emerald-500/20"
                      : "border-border/80 bg-card hover:bg-muted/50 text-foreground"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div
                      className={`p-1.5 rounded-lg ${
                        selectedQueueType === QueueType.THERAPY
                          ? "bg-emerald-500 text-white"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Activity className="size-4" />
                    </div>
                    {selectedQueueType === QueueType.THERAPY && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                        Selected
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-black">Therapy Queue</div>
                    <div className="text-[10.5px] text-muted-foreground leading-tight">
                      Physical therapy & rehabilitation
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedQueueType(QueueType.CONSULTATION)}
                  className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                    selectedQueueType === QueueType.CONSULTATION
                      ? "border-sky-500 bg-sky-500/10 text-sky-950 dark:text-sky-200 ring-2 ring-sky-500/20"
                      : "border-border/80 bg-card hover:bg-muted/50 text-foreground"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div
                      className={`p-1.5 rounded-lg ${
                        selectedQueueType === QueueType.CONSULTATION
                          ? "bg-sky-500 text-white"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Stethoscope className="size-4" />
                    </div>
                    {selectedQueueType === QueueType.CONSULTATION && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-700 dark:text-sky-300">
                        Selected
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-black">Consultation Queue</div>
                    <div className="text-[10.5px] text-muted-foreground leading-tight">
                      Doctor chambers & consultations
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* 2b. Doctor & Consultation Fee (Conditional on Consultation Queue) */}
            {selectedQueueType === QueueType.CONSULTATION && (
              <div className="p-3.5 rounded-xl border border-sky-500/30 bg-sky-500/5 space-y-3 transition-all">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-sky-700 dark:text-sky-300">
                      <Stethoscope className="size-3.5" />
                      <span>Assign Doctor (Optional)</span>
                    </span>
                    <span className="text-[10.5px] text-muted-foreground font-normal">
                      Doctor preset fee applies automatically
                    </span>
                  </Label>
                  <Select
                    items={doctorSelectItems}
                    value={selectedDoctorId || "GENERAL"}
                    onValueChange={(val) => handleDoctorChange(val === "GENERAL" || !val ? "" : val)}
                  >
                    <SelectTrigger className="w-full text-xs h-9 bg-background border-border/80 text-foreground font-medium">
                      <SelectValue placeholder="Select Doctor">
                        {(val: string | null) => {
                          const item = doctorSelectItems.find((i) => i.value === (val || "GENERAL"));
                          return item ? item.label : "General Consultation (No Doctor Pre-assigned)";
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="z-50 max-h-56">
                      {doctorSelectItems.map((item) => (
                        <SelectItem key={item.value} value={item.value} className="text-xs">
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Banknote className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Consultation Fee (৳ BDT)</span>
                    </span>
                    <span className="text-[10.5px] text-muted-foreground font-normal">
                      Preset or modify as needed
                    </span>
                  </Label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground font-mono">
                        ৳
                      </span>
                      <Input
                        type="number"
                        min="0"
                        step="50"
                        value={consultationFee}
                        onChange={(e) => setConsultationFee(e.target.value)}
                        placeholder="1000"
                        className="pl-7 text-xs h-9 font-mono font-bold"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setConsultationFee("0")}
                        className="h-9 px-2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
                      >
                        Free (৳0)
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const doc = doctors.find((d) => d.id === selectedDoctorId);
                          setConsultationFee(String(doc?.consultationFee ?? 1000));
                        }}
                        className="h-9 px-2 text-[10px] font-bold text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 cursor-pointer"
                      >
                        Reset Preset
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. Told Arrival Time */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground flex items-center justify-between">
                <span>Told Arrival Time</span>
                <span className="text-[10.5px] text-muted-foreground font-normal">
                  Used for arrival punctuality color tracking
                </span>
              </Label>
              <div className="relative">
                <Clock className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={toldTime}
                  onChange={(e) => setToldTime(e.target.value)}
                  placeholder="e.g. 10:30 AM"
                  className="pl-8 text-xs h-9 font-mono"
                />
              </div>
            </div>

            {/* 4. Authorizing Receptionist Performer */}
            <ReceptionistPerformerSelect
              performers={performers}
              selectedPerformerId={selectedPerformerId}
              onSelectPerformerId={setSelectedPerformerId}
              pin={performerPin}
              onPinChange={setPerformerPin}
              disabled={isSubmitting}
              label="Authorizing Receptionist"
            />

            {/* 5. Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">
                Notes (Optional)
              </Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Special instructions, handler preferences, etc."
                className="text-xs h-9"
              />
            </div>
          </div>

          <DialogFooter className="p-4 sm:px-6 py-3 border-t border-border/60 bg-muted/20 shrink-0 flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="cursor-pointer text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !selectedPatientId}
              className="cursor-pointer gap-1.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Adding to Queue...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3.5" />
                  <span>Confirm Add to Queue</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
