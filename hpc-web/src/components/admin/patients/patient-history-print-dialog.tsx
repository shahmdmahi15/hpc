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
import { Printer, X, Download, ShieldCheck } from "lucide-react";
import { CLINIC_CONFIG } from "@/lib/clinic-config";
import { formatTime12h } from "@/lib/queue-punctuality";
import { getPatientCompleteHistoryAction } from "@/actions/admin/patient-history.action";

interface PatientHistoryPrintDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  patientData?: any;
  patientId?: string | null;
}

export function PatientHistoryPrintDialog({
  isOpen,
  onOpenChange,
  patientData,
  patientId,
}: PatientHistoryPrintDialogProps) {
  const [data, setData] = React.useState<any>(patientData || null);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const printRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (patientData) {
      setData(patientData);
    } else if (isOpen && patientId) {
      setIsLoading(true);
      getPatientCompleteHistoryAction(patientId)
        .then((res) => setData(res.patient))
        .catch((err) => console.error("Error loading patient history:", err))
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, patientId, patientData]);

  if (!isOpen) return null;
  if (!data) return null;

  const handlePrint = () => {
    window.print();
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

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-background">
        <DialogHeader className="p-4 border-b border-border/80 bg-muted/30 flex flex-row items-center justify-between shrink-0">
          <div>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Printer className="size-4 text-primary" />
              <span>Print Complete Patient Medical Dossier &amp; History</span>
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Official Comprehensive Medical &amp; Financial History for {p.name} (MRN: {p.mrn})
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handlePrint}
              className="h-8 gap-1.5 text-xs bg-primary text-primary-foreground font-semibold shadow-xs"
            >
              <Printer className="size-3.5" />
              <span>Print Document (Ctrl+P)</span>
            </Button>
          </div>
        </DialogHeader>

        {/* Scrollable Printable Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50 dark:bg-slate-950/40 print:p-0 print:bg-white print:overflow-visible">
          <div
            ref={printRef}
            className="hpc-print-document max-w-[800px] mx-auto bg-white dark:bg-card p-6 sm:p-8 rounded-xl border border-border shadow-xs print:border-none print:shadow-none print:p-0 print:max-w-none text-slate-900 dark:text-slate-100"
          >
            {/* 1. Official HPC Clinic Letterhead Header */}
            <div className="border-b-2 border-slate-900 dark:border-slate-100 pb-4 mb-4 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="size-8 rounded-lg bg-emerald-600 text-white font-bold flex items-center justify-center text-sm font-mono">
                    HPC
                  </div>
                  <div>
                    <h1 className="text-lg font-black tracking-tight text-emerald-800 dark:text-emerald-400 uppercase">
                      Health &amp; Pain Care Center
                    </h1>
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                      Center of Excellence for Physical Medicine &amp; Rehabilitation
                    </p>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground leading-tight pt-1">
                  128/1 East Tejturi Bazar, Tejgaon, Dhaka-1215 • Hotline: 01711-223344 • Email: info@hpc.com.bd
                </p>
              </div>

              <div className="text-right shrink-0">
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-[10px] font-bold uppercase tracking-wider mb-1">
                  Patient Health Dossier
                </span>
                <p className="text-[10px] text-muted-foreground font-mono">
                  Printed: {printTimestamp}
                </p>
              </div>
            </div>

            {/* 2. Patient Identity & Demographics Bar */}
            <div className="bg-slate-100 dark:bg-muted/50 p-3.5 rounded-lg border border-slate-200 dark:border-border/80 mb-5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-muted-foreground font-semibold uppercase block">
                  Patient Name
                </span>
                <span className="font-bold text-sm text-foreground">
                  {p.name}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground font-semibold uppercase block">
                  MRN (Hospital ID)
                </span>
                <span className="font-mono font-bold text-sm text-primary">
                  {p.mrn}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground font-semibold uppercase block">
                  Phone / Contact
                </span>
                <span className="font-mono font-medium text-foreground">
                  {p.phone}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground font-semibold uppercase block">
                  Gender / Blood
                </span>
                <span className="font-semibold text-foreground uppercase">
                  {p.gender} {p.bloodGroup ? `• ${p.bloodGroup}` : ""}
                </span>
              </div>
            </div>

            {/* 3. Executive Lifetime Summary */}
            <div className="grid grid-cols-4 gap-2.5 mb-5 text-center">
              <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <span className="text-[10px] text-muted-foreground font-medium block">Total Visits</span>
                <span className="text-base font-bold font-mono text-blue-700 dark:text-blue-300">
                  {Math.max(p.visits?.length || 0, p.appointments?.length || 0)}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-[10px] text-muted-foreground font-medium block">Lifetime Billed</span>
                <span className="text-base font-bold font-mono text-emerald-700 dark:text-emerald-300">
                  ৳{(p.totalBill || 0).toLocaleString()}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                <span className="text-[10px] text-muted-foreground font-medium block">Total Paid</span>
                <span className="text-base font-bold font-mono text-purple-700 dark:text-purple-300">
                  ৳{(p.totalPaid || 0).toLocaleString()}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
                <span className="text-[10px] text-muted-foreground font-medium block">Current Due</span>
                <span className="text-base font-bold font-mono text-rose-700 dark:text-rose-300">
                  ৳{(p.totalDue || 0).toLocaleString()}
                </span>
              </div>
            </div>

            {/* 4. SECTION: Doctor Consultation History */}
            {p.consultationSerials && p.consultationSerials.length > 0 && (
              <div className="mb-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 border-b border-border pb-1 mb-2 flex items-center justify-between">
                  <span>Doctor Consultations &amp; Clinical Evaluations</span>
                  <span className="text-[10px] font-normal text-muted-foreground">
                    ({p.consultationSerials.length} Sessions)
                  </span>
                </h3>
                <div className="space-y-2">
                  {p.consultationSerials.map((s: any, idx: number) => {
                    const dateStr = new Date(s.appointmentDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    });
                    return (
                      <div
                        key={s.id || idx}
                        className="p-2.5 rounded-lg border border-border/80 text-xs flex items-start justify-between gap-3 bg-card/50"
                      >
                        <div className="space-y-0.5">
                          <div className="font-semibold text-foreground flex items-center gap-2">
                            <span>Serial #{s.serialNumber}</span>
                            <span className="text-muted-foreground font-normal">• {dateStr}</span>
                            <span className="px-1.5 py-0.2 rounded bg-primary/10 text-primary font-mono text-[10px]">
                              {s.status}
                            </span>
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            Attending: <strong className="text-foreground">{s.doctor?.name || "Dr. Farhan Ahmed"}</strong>
                            {s.toldTime && ` • Told Time: ${s.toldTime}`}
                          </div>
                          {s.notes && (
                            <div className="text-[11px] italic text-slate-600 dark:text-slate-300 pt-0.5">
                              Clinical Note: {s.notes}
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0 font-mono text-[11px]">
                          <div>Fee: ৳{s.feeAmount}</div>
                          <div className={s.dueAmount > 0 ? "text-rose-600 font-bold" : "text-emerald-600"}>
                            {s.dueAmount > 0 ? `Due: ৳${s.dueAmount}` : "Paid"}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 5. SECTION: Clinical Prescriptions & Medication Protocols */}
            {p.prescriptions && p.prescriptions.length > 0 && (
              <div className="mb-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 border-b border-border pb-1 mb-2 flex items-center justify-between">
                  <span>Prescriptions &amp; Medication History</span>
                  <span className="text-[10px] font-normal text-muted-foreground">
                    ({p.prescriptions.length} Records)
                  </span>
                </h3>
                <div className="space-y-3">
                  {p.prescriptions.map((pr: any, idx: number) => {
                    const prDate = new Date(pr.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    });
                    return (
                      <div key={pr.id || idx} className="p-3 rounded-lg border border-border text-xs bg-card/40 space-y-2">
                        <div className="flex items-center justify-between border-b border-border/50 pb-1.5">
                          <span className="font-semibold text-foreground">
                            Prescription • {prDate}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            Doctor: {pr.doctor?.name || "Doctor"}
                          </span>
                        </div>
                        {pr.diagnosis && (
                          <div className="text-[11px]">
                            <strong className="text-foreground">Clinical Diagnosis:</strong>{" "}
                            <span className="text-muted-foreground">{pr.diagnosis}</span>
                          </div>
                        )}
                        {Array.isArray(pr.medicines) && pr.medicines.length > 0 && (
                          <div className="overflow-x-auto">
                            <table className="w-full text-[11px] text-left border-collapse">
                              <thead>
                                <tr className="border-b border-border/60 text-muted-foreground font-semibold">
                                  <th className="py-1">#</th>
                                  <th className="py-1">Medicine Name</th>
                                  <th className="py-1">Meal Timing</th>
                                  <th className="py-1">Schedule (M-A-N)</th>
                                  <th className="py-1">Duration</th>
                                </tr>
                              </thead>
                              <tbody>
                                {pr.medicines.map((m: any, mIdx: number) => (
                                  <tr key={mIdx} className="border-b border-border/30">
                                    <td className="py-1 text-muted-foreground">{mIdx + 1}</td>
                                    <td className="py-1 font-semibold text-foreground">{m.name || "Medicine"}</td>
                                    <td className="py-1">{m.mealTiming === "BEFORE" ? "Before Meal (খাওয়ার আগে)" : "After Meal (খাওয়ার পরে)"}</td>
                                    <td className="py-1 font-mono">{Array.isArray(m.times) ? m.times.join(" • ") : m.times || "1-0-1"}</td>
                                    <td className="py-1 text-muted-foreground">{m.duration || "---"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                        {pr.advice && (
                          <div className="text-[10.5px] italic text-muted-foreground pt-1">
                            Advice / Guidelines: {pr.advice}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 6. SECTION: Treatment Plans & Physical Therapy Sessions */}
            {p.treatmentPlans && p.treatmentPlans.length > 0 && (
              <div className="mb-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 border-b border-border pb-1 mb-2 flex items-center justify-between">
                  <span>Physical Therapy &amp; Rehabilitation Protocols</span>
                  <span className="text-[10px] font-normal text-muted-foreground">
                    ({p.treatmentPlans.length} Clinical Protocols)
                  </span>
                </h3>
                <div className="space-y-2.5">
                  {p.treatmentPlans.map((tp: any, idx: number) => {
                    const tpDate = new Date(tp.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    });
                    return (
                      <div key={tp.id || idx} className="p-2.5 rounded-lg border border-border text-xs bg-card/40 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground">
                            {tp.planType === "TODAY" ? "Today's Therapy Plan" : "Next Session Plan"} • {tpDate}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            Prescribed by: {tp.doctor?.name || "Dr. Farhan Ahmed"}
                          </span>
                        </div>
                        {Array.isArray(tp.modalities) && tp.modalities.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {tp.modalities.map((mod: any, mIdx: number) => {
                              const name = typeof mod === "string" ? mod : mod.name || mod.id;
                              const mins = typeof mod === "object" && mod.durationMinutes ? `${mod.durationMinutes} min` : null;
                              return (
                                <span
                                  key={mIdx}
                                  className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-700 dark:text-purple-300 font-semibold border border-purple-500/20 text-[10.5px]"
                                >
                                  {mIdx + 1}. {name} {mins ? `(${mins})` : ""}
                                </span>
                              );
                            })}
                          </div>
                        )}
                        {tp.instructions && (
                          <p className="text-[11px] text-muted-foreground italic pt-0.5">
                            Instructions: {tp.instructions}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 7. SECTION: Itemized Invoices & Billing Ledger */}
            {p.invoices && p.invoices.length > 0 && (
              <div className="mb-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 border-b border-border pb-1 mb-2 flex items-center justify-between">
                  <span>Itemized Invoices &amp; Payment Statement</span>
                  <span className="text-[10px] font-normal text-muted-foreground">
                    ({p.invoices.length} Invoices Issued)
                  </span>
                </h3>
                <div className="space-y-2">
                  {p.invoices.map((inv: any) => {
                    const invDate = new Date(inv.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    });
                    return (
                      <div key={inv.id} className="p-2.5 rounded-lg border border-border text-xs bg-card/40 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-foreground">
                              {inv.invoiceNumber}
                            </span>
                            <span className="text-muted-foreground">• {invDate}</span>
                            <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-muted">
                              {inv.paymentMethod}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 font-mono text-[11px]">
                            <span>Total: <strong>৳{inv.totalAmount}</strong></span>
                            <span className="text-emerald-600">Paid: ৳{inv.paidAmount}</span>
                            <span className={inv.dueAmount > 0 ? "text-rose-600 font-bold" : "text-muted-foreground"}>
                              Due: ৳{inv.dueAmount}
                            </span>
                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                              inv.status === "PAID"
                                ? "bg-emerald-500/15 text-emerald-700"
                                : "bg-rose-500/15 text-rose-700"
                            }`}>
                              {inv.status}
                            </span>
                          </div>
                        </div>

                        {/* Itemized Line Items */}
                        {Array.isArray(inv.payments) && inv.payments.length > 0 && (
                          <div className="pt-1 border-t border-border/40 pl-2 space-y-0.5 text-[10.5px]">
                            {inv.payments.map((pm: any, pmIdx: number) => (
                              <div key={pm.id || pmIdx} className="flex items-center justify-between text-muted-foreground">
                                <span>
                                  • {pm.serviceType === "THERAPY" ? "Physical Therapy Session" : pm.serviceType === "CONSULTATION" ? "Doctor Consultation" : "Previous Outstanding Due Clearance"}
                                  {pm.notes ? ` (${pm.notes})` : ""}
                                </span>
                                <span className="font-mono font-semibold text-foreground">
                                  ৳{pm.amount}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 8. SECTION: Multi-Department Clinical Notes */}
            {p.visitNotes && p.visitNotes.length > 0 && (
              <div className="mb-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 border-b border-border pb-1 mb-2">
                  Departmental Clinical Notes
                </h3>
                <div className="space-y-1.5">
                  {p.visitNotes.map((vn: any) => {
                    const vnDate = new Date(vn.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    });
                    return (
                      <div key={vn.id} className="p-2 rounded-lg bg-muted/40 border border-border/60 text-[11px] flex items-start gap-2">
                        <span className="font-bold uppercase text-[9.5px] px-1.5 py-0.2 rounded bg-primary/10 text-primary shrink-0">
                          {vn.category}
                        </span>
                        <div className="flex-1 space-y-0.5">
                          <span className="text-foreground">{vn.note}</span>
                          <div className="text-[10px] text-muted-foreground">
                            By {vn.authorName || "Staff"} ({vn.authorRole}) • {vnDate}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 9. Official Verification & Sign-off Footer */}
            <div className="pt-8 mt-6 border-t border-slate-300 dark:border-slate-800 grid grid-cols-2 gap-8 text-center text-xs">
              <div className="space-y-1">
                <div className="border-b border-slate-400 dark:border-slate-700 w-48 mx-auto h-10" />
                <span className="font-semibold text-foreground block">Attending Physician / Physiotherapist</span>
                <span className="text-[10px] text-muted-foreground block">Health &amp; Pain Care Center</span>
              </div>
              <div className="space-y-1">
                <div className="border-b border-slate-400 dark:border-slate-700 w-48 mx-auto h-10" />
                <span className="font-semibold text-foreground block">Authorized Medical Director / Administrator</span>
                <span className="text-[10px] text-muted-foreground block">Health &amp; Pain Care Center, Dhaka</span>
              </div>
            </div>

            <div className="text-center text-[9.5px] text-muted-foreground pt-6">
              This document is an electronically verified record generated from the HPC Clinical System. For inquiries or verification, contact +880-1711-223344.
            </div>
          </div>
        </div>

        <DialogFooter className="p-3 border-t border-border/80 bg-muted/20 flex items-center justify-between shrink-0">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button size="sm" onClick={handlePrint} className="gap-1.5 bg-primary text-primary-foreground">
            <Printer className="size-3.5" />
            <span>Print Medical Dossier</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
