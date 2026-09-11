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
  ReceptionistPerformerSelect,
  type ReceptionistPerformer,
} from "@/components/receptionist/receptionist-performer-select";
import {
  type PatientWithCount,
  addPatientToQueueAction,
} from "@/actions/receptionist/appointment.action";
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
} from "lucide-react";
import { toast } from "sonner";

interface AddToQueueDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  patients: PatientWithCount[];
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
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);

  // Filter patients by search query
  const filteredPatients = React.useMemo(() => {
    if (!patientSearchQuery.trim()) return patients.slice(0, 8);
    const q = patientSearchQuery.toLowerCase();
    return patients
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.phone.includes(q) ||
          (p.mrn && p.mrn.toLowerCase().includes(q)),
      )
      .slice(0, 8);
  }, [patients, patientSearchQuery]);

  const selectedPatient = React.useMemo(
    () => patients.find((p) => p.id === selectedPatientId),
    [patients, selectedPatientId],
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

    setIsSubmitting(true);
    try {
      const res = await addPatientToQueueAction({
        patientId: selectedPatientId,
        queueType: selectedQueueType,
        toldTime: toldTime.trim() || undefined,
        notes: notes.trim() || undefined,
        performerId: selectedPerformerId || undefined,
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
      <DialogContent className="w-[95vw] sm:max-w-lg md:max-w-xl max-h-[min(92vh,700px)] flex flex-col p-0 overflow-hidden border-border/80 shadow-2xl rounded-2xl">
        <DialogHeader className="p-5 pb-4 border-b border-border/60 shrink-0 bg-muted/20">
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
