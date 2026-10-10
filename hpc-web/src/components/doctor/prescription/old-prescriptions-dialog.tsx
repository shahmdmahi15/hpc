"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Pill,
  Printer,
  Calendar,
  User,
  Plus,
  Loader2,
  Trash2,
  AlertCircle,
  Clock,
  Utensils,
} from "lucide-react";
import { toast } from "sonner";
import {
  getPatientPrescriptionsAction,
  deletePrescriptionAction,
  type PrescriptionMedicineItem,
} from "@/actions/doctor/prescription.action";
import { PrescriptionPrintDialog, type PrescriptionPrintRecord } from "./prescription-print-dialog";

interface OldPrescriptionsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  patient: {
    id: string;
    name: string;
    mrn?: string | null;
    phone?: string | null;
    age?: number | string | null;
    gender?: string | null;
  } | null;
  onNewPrescriptionRequested?: () => void;
}

export function OldPrescriptionsDialog({
  isOpen,
  onOpenChange,
  patient,
  onNewPrescriptionRequested,
}: OldPrescriptionsDialogProps) {
  const [prescriptions, setPrescriptions] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [selectedPrintRecord, setSelectedPrintRecord] =
    React.useState<PrescriptionPrintRecord | null>(null);
  const [isPrintOpen, setIsPrintOpen] = React.useState(false);

  const loadPrescriptions = React.useCallback(async () => {
    if (!patient?.id) return;
    setIsLoading(true);
    try {
      const res = await getPatientPrescriptionsAction(patient.id);
      if (res.success && res.data) {
        setPrescriptions(res.data);
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Failed to load historical prescriptions.");
    } finally {
      setIsLoading(false);
    }
  }, [patient?.id]);

  React.useEffect(() => {
    if (isOpen && patient?.id) {
      loadPrescriptions();
    }
  }, [isOpen, patient?.id, loadPrescriptions]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this prescription?")) return;
    try {
      const res = await deletePrescriptionAction(id);
      if (res.success) {
        toast.success("Prescription deleted.");
        loadPrescriptions();
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Failed to delete prescription.");
    }
  };

  const handlePrint = (p: any) => {
    setSelectedPrintRecord({
      id: p.id,
      diagnosis: p.diagnosis,
      medicines: p.medicines || [],
      advice: p.advice,
      followUpDate: p.followUpDate,
      createdAt: p.createdAt,
      doctor: p.doctor,
      patient: p.patient || patient,
    });
    setIsPrintOpen(true);
  };

  const formatSchedule = (times: ("MORNING" | "AFTERNOON" | "NIGHT")[] = []) => {
    const m = times.includes("MORNING") ? "1" : "0";
    const a = times.includes("AFTERNOON") ? "1" : "0";
    const n = times.includes("NIGHT") ? "1" : "0";
    return `${m} + ${a} + ${n}`;
  };

  if (!patient) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="w-[96vw] max-w-4xl max-h-[92dvh] flex flex-col p-0 overflow-hidden bg-background border-border shadow-2xl rounded-2xl">
          <DialogHeader className="p-4 sm:p-5 border-b border-border/70 bg-muted/30 flex flex-row items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-md bg-sky-600/10 text-sky-600 flex items-center justify-center border border-sky-600/20">
                <Pill className="size-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  <span>Prescription History</span>
                  <span className="text-xs font-mono font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border/60">
                    {patient.name} ({patient.mrn || "PT"})
                  </span>
                </DialogTitle>
                <p className="text-xs text-muted-foreground">
                  View and print previous medical prescriptions.
                </p>
              </div>
            </div>

            {onNewPrescriptionRequested && (
              <Button
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onNewPrescriptionRequested();
                }}
                className="h-8 text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white gap-1.5 cursor-pointer"
              >
                <Plus className="size-3.5" />
                <span>New Prescription</span>
              </Button>
            )}
          </DialogHeader>

          {/* List Content */}
          <div className="p-4 sm:p-5 flex-1 min-h-0 overflow-y-auto space-y-4">
            {isLoading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="size-6 animate-spin text-sky-600" />
                <span className="text-xs font-medium">Loading prescriptions...</span>
              </div>
            ) : prescriptions.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2.5 text-center border border-dashed rounded-xl p-6 bg-muted/20">
                <AlertCircle className="size-8 text-muted-foreground/50" />
                <div>
                  <h4 className="text-sm font-bold">No Prescriptions Found</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    No prescriptions have been recorded for this patient yet.
                  </p>
                </div>
                {onNewPrescriptionRequested && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onOpenChange(false);
                      onNewPrescriptionRequested();
                    }}
                    className="mt-2 text-xs font-semibold gap-1.5 cursor-pointer"
                  >
                    <Plus className="size-3.5" />
                    <span>Create First Prescription</span>
                  </Button>
                )}
              </div>
            ) : (
              prescriptions.map((p, pIdx) => (
                <div
                  key={p.id || pIdx}
                  className="rounded-xl border border-border bg-card p-4 space-y-3.5 shadow-xs"
                >
                  {/* Top Bar: Doctor, Date, Print Action */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                        <User className="size-3.5 text-sky-600" />
                        <span>Dr. {p.doctor?.name || "Consultant"}</span>
                      </div>
                      <span className="text-muted-foreground text-xs">•</span>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                        <Calendar className="size-3.5" />
                        <span>
                          {new Date(p.createdAt).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => handlePrint(p)}
                        className="h-7 text-xs font-semibold gap-1 border-sky-500/40 text-sky-700 dark:text-sky-300 hover:bg-sky-500/10 cursor-pointer"
                      >
                        <Printer className="size-3" />
                        <span>Print</span>
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(p.id)}
                        className="size-7 text-destructive hover:bg-destructive/10 rounded-md cursor-pointer"
                        title="Delete prescription"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Diagnosis */}
                  {p.diagnosis && (
                    <div className="text-xs">
                      <span className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider block mb-0.5">
                        Diagnosis
                      </span>
                      <p className="font-semibold text-foreground bg-muted/30 p-2 rounded-lg border border-border/60">
                        {p.diagnosis}
                      </p>
                    </div>
                  )}

                  {/* Medicines Grid */}
                  <div className="space-y-2">
                    <span className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider block">
                      Prescribed Medicines ({p.medicines?.length || 0})
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(p.medicines as PrescriptionMedicineItem[]).map((med, mIdx) => (
                        <div
                          key={med.id || mIdx}
                          className="p-2.5 rounded-lg border border-border/80 bg-muted/20 space-y-1 text-xs"
                        >
                          <div className="flex items-center justify-between font-bold text-foreground">
                            <span>
                              {mIdx + 1}. {med.name}
                            </span>
                            <span className="font-mono text-sky-600 dark:text-sky-400 font-bold text-[11px]">
                              {formatSchedule(med.times)}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-[10.5px] text-muted-foreground">
                            <span className="px-1.5 py-0.2 rounded bg-muted font-semibold text-foreground">
                              {med.mealTiming === "BEFORE" ? "Before Meal" : "After Meal"}
                            </span>
                            <span>•</span>
                            <span>Duration: {med.duration}</span>
                          </div>
                          {med.instructions && (
                            <p className="text-[10px] text-muted-foreground italic">
                              Note: {med.instructions}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Advice & Follow up */}
                  {(p.advice || p.followUpDate) && (
                    <div className="pt-1 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      {p.advice ? (
                        <p className="text-muted-foreground text-[11px] line-clamp-2">
                          <strong className="text-foreground">Advice:</strong> {p.advice}
                        </p>
                      ) : <div />}
                      {p.followUpDate && (
                        <div className="shrink-0 text-sky-700 dark:text-sky-300 font-semibold text-[11px] bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                          Follow-up:{" "}
                          {new Date(p.followUpDate).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Print Dialog */}
      <PrescriptionPrintDialog
        isOpen={isPrintOpen}
        onOpenChange={setIsPrintOpen}
        prescription={selectedPrintRecord}
      />
    </>
  );
}
