"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Compass, Clock, MapPin, User, CheckCircle2 } from "lucide-react";
import { formatTime12h } from "@/lib/queue-punctuality";
import { getPatientCompleteHistoryAction } from "@/actions/admin/patient-history.action";
import { printElementIsolated } from "@/lib/pdf-generator";

interface PatientJourneyPrintDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  patientData?: any;
  patientId?: string | null;
}

export function PatientJourneyPrintDialog({
  isOpen,
  onOpenChange,
  patientData,
  patientId,
}: PatientJourneyPrintDialogProps) {
  const [data, setData] = React.useState<any>(patientData || null);
  const printRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (patientData) {
      setData(patientData);
    } else if (isOpen && patientId) {
      getPatientCompleteHistoryAction(patientId)
        .then((res) => setData(res.patient))
        .catch((err) => console.error("Error loading patient journey:", err));
    }
  }, [isOpen, patientId, patientData]);

  if (!isOpen) return null;
  if (!data) return null;

  const handlePrint = () => {
    if (printRef.current) {
      printElementIsolated(printRef.current, {
        title: `Patient_Journey_${data.mrn || data.name || "Audit"}`,
        paperSize: "a4",
      });
    } else {
      window.print();
    }
  };

  const p = data;
  const printTimestamp = new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const stepLogs = p.stepLogs || [];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-background">
        <DialogHeader className="p-4 border-b border-border/80 bg-muted/30 flex flex-row items-center justify-between shrink-0">
          <div>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Compass className="size-4 text-indigo-600" />
              <span>Print Patient Journey Timeline Report</span>
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Station Movement Trail &amp; Station Audit Logs for {p.name} ({p.mrn})
            </p>
          </div>
          <Button
            size="sm"
            onClick={handlePrint}
            className="h-8 gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
          >
            <Printer className="size-3.5" />
            <span>Print Report</span>
          </Button>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50 dark:bg-slate-950/40 print:p-0 print:bg-white">
          <div ref={printRef} className="max-w-[700px] mx-auto bg-white dark:bg-card p-6 sm:p-8 rounded-xl border border-border shadow-xs print:border-none print:shadow-none print:p-0 text-slate-900 dark:text-slate-100">
            {/* Header */}
            <div className="border-b-2 border-indigo-600 pb-3 mb-4 flex items-start justify-between">
              <div>
                <h1 className="text-lg font-black text-indigo-900 dark:text-indigo-300 uppercase">
                  Health &amp; Pain Care Center
                </h1>
                <p className="text-xs text-muted-foreground font-semibold">
                  Patient Journey &amp; Workflow Audit Trail
                </p>
              </div>
              <div className="text-right text-[10.5px] font-mono text-muted-foreground">
                Printed: {printTimestamp}
              </div>
            </div>

            {/* Patient Bar */}
            <div className="bg-indigo-50 dark:bg-indigo-950/20 p-3 rounded-lg border border-indigo-200 dark:border-indigo-800/40 mb-5 flex items-center justify-between text-xs">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Patient Name</span>
                <span className="font-bold text-sm text-foreground">{p.name}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase block font-semibold">MRN</span>
                <span className="font-mono font-bold text-sm text-indigo-600">{p.mrn}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Phone</span>
                <span className="font-mono">{p.phone}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Total Steps</span>
                <span className="font-bold font-mono">{stepLogs.length} Events</span>
              </div>
            </div>

            {/* Step Logs Timeline */}
            <div className="space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">
                Chronological Station Movements
              </h2>

              {stepLogs.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground italic border border-dashed rounded-lg">
                  No step logs recorded for this patient yet.
                </div>
              ) : (
                <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-indigo-200 dark:before:bg-indigo-900">
                  {stepLogs.map((log: any, idx: number) => {
                    const timeStr = new Date(log.timestamp).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    });

                    return (
                      <div key={log.id || idx} className="relative space-y-1">
                        <span className="absolute -left-6 top-1.5 size-3 rounded-full bg-indigo-600 ring-4 ring-indigo-100 dark:ring-indigo-950" />
                        <div className="p-2.5 rounded-lg border border-border/80 bg-card/60 text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-foreground">
                              {log.step.replace(/_/g, " ")}
                            </span>
                            <span className="text-[10.5px] font-mono text-muted-foreground">
                              {timeStr}
                            </span>
                          </div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap">
                            <span className="px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-mono text-[10px]">
                              📍 {log.station.replace(/_/g, " ")}
                            </span>
                            {log.roomNumber && (
                              <span>• Room: {log.roomNumber}</span>
                            )}
                            {log.performerId && (
                              <span>• Staff ID: {log.performerId.slice(-6)}</span>
                            )}
                          </div>
                          {log.details && (
                            <p className="text-[11px] text-foreground/80 italic pt-0.5">
                              {log.details}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-8 mt-6 border-t text-center text-[10px] text-muted-foreground">
              Official HPC Patient Journey Report • Health &amp; Pain Care Center • Electronic Audit Record
            </div>
          </div>
        </div>

        <DialogFooter className="p-3 border-t border-border/80 bg-muted/20 flex items-center justify-between shrink-0">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button size="sm" onClick={handlePrint} className="gap-1.5 bg-indigo-600 text-white">
            <Printer className="size-3.5" />
            <span>Print Report</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
