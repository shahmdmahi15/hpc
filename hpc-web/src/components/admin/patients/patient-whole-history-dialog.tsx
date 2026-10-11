"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Printer,
  Download,
  Stethoscope,
  Pill,
  Activity,
  Receipt,
  Compass,
  FileText,
  Clock,
  Phone,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Layers,
  MapPin,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { getPatientCompleteHistoryAction } from "@/actions/admin/patient-history.action";
import { PatientHistoryPrintDialog } from "./patient-history-print-dialog";
import { PatientJourneyPrintDialog } from "./patient-journey-print-dialog";

interface PatientWholeHistoryDialogProps {
  patientId: string | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PatientWholeHistoryDialog({
  patientId,
  isOpen,
  onOpenChange,
}: PatientWholeHistoryDialogProps) {
  const [data, setData] = React.useState<any>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [isPrintHistoryOpen, setIsPrintHistoryOpen] = React.useState<boolean>(false);
  const [isPrintJourneyOpen, setIsPrintJourneyOpen] = React.useState<boolean>(false);

  const loadData = React.useCallback(async (id: string) => {
    try {
      setIsLoading(true);
      const res = await getPatientCompleteHistoryAction(id);
      setData(res.patient);
    } catch (err: any) {
      console.error("[Load Patient Whole History Error]:", err);
      toast.error(err?.message || "Failed to load patient whole history.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (isOpen && patientId) {
      loadData(patientId);
    } else {
      setData(null);
    }
  }, [isOpen, patientId, loadData]);

  if (!isOpen) return null;

  const p = data;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-background">
          {/* Header */}
          <DialogHeader className="p-4 border-b border-border/80 bg-muted/30 shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold">
                  <User className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <DialogTitle className="text-base font-bold text-foreground">
                      {p?.name || "Loading Patient..."}
                    </DialogTitle>
                    {p?.mrn && (
                      <Badge variant="outline" className="font-mono text-[10px] uppercase font-bold py-0">
                        {p.mrn}
                      </Badge>
                    )}
                    {p?.gender && (
                      <Badge variant="secondary" className="text-[10px] py-0 uppercase">
                        {p.gender}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-2 pt-0.5">
                    <span>Phone: {p?.phone || "---"}</span>
                    {p?.bloodGroup && <span>• Blood: {p.bloodGroup}</span>}
                    {p?.address && <span>• {p.address}</span>}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              {p && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsPrintHistoryOpen(true)}
                    className="h-8 gap-1.5 text-xs font-semibold cursor-pointer border-primary/30 text-primary hover:bg-primary/10"
                  >
                    <Printer className="size-3.5" />
                    <span>Print Dossier</span>
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsPrintJourneyOpen(true)}
                    className="h-8 gap-1.5 text-xs font-semibold cursor-pointer border-indigo-500/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/10"
                  >
                    <Compass className="size-3.5" />
                    <span>Print Journey</span>
                  </Button>

                  <a
                    href={`/api/admin/export?type=patient_history&patientId=${p.id}&format=xlsx`}
                    download
                    className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold shadow-xs transition-colors"
                  >
                    <Download className="size-3" />
                    <span>Excel (.xlsx)</span>
                  </a>

                  <a
                    href={`/api/admin/export?type=patient_history&patientId=${p.id}&format=json`}
                    download
                    className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 text-xs font-semibold shadow-xs transition-colors"
                  >
                    <Download className="size-3" />
                    <span>JSON</span>
                  </a>
                </div>
              )}
            </div>
          </DialogHeader>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {isLoading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <RefreshCw className="size-6 animate-spin text-primary" />
                <span className="text-xs font-medium">Loading comprehensive patient record...</span>
              </div>
            ) : !p ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                Unable to load patient record.
              </div>
            ) : (
              <div className="space-y-4">
                {/* 1. Lifetime Financial & Visit Banner */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 rounded-xl border border-blue-500/20 bg-blue-500/10">
                    <span className="text-[10.5px] text-muted-foreground font-semibold uppercase block">
                      Total Visits
                    </span>
                    <span className="text-xl font-bold font-mono text-blue-700 dark:text-blue-300">
                      {Math.max(p.visits?.length || 0, p.appointments?.length || 0)}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10">
                    <span className="text-[10.5px] text-muted-foreground font-semibold uppercase block">
                      Lifetime Billed
                    </span>
                    <span className="text-xl font-bold font-mono text-emerald-700 dark:text-emerald-300">
                      ৳{(p.totalBill || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl border border-purple-500/20 bg-purple-500/10">
                    <span className="text-[10.5px] text-muted-foreground font-semibold uppercase block">
                      Total Paid
                    </span>
                    <span className="text-xl font-bold font-mono text-purple-700 dark:text-purple-300">
                      ৳{(p.totalPaid || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl border border-rose-500/20 bg-rose-500/10">
                    <span className="text-[10.5px] text-muted-foreground font-semibold uppercase block">
                      Outstanding Due
                    </span>
                    <span className="text-xl font-bold font-mono text-rose-700 dark:text-rose-300">
                      ৳{(p.totalDue || 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* 2. Multi-Tab Dossier */}
                <Tabs defaultValue="consultations" className="w-full">
                  <TabsList className="w-full justify-start overflow-x-auto no-scrollbar h-9 p-1 bg-muted/60 border border-border">
                    <TabsTrigger value="consultations" className="text-xs h-7 gap-1.5 font-semibold">
                      <Stethoscope className="size-3 text-sky-500" />
                      <span>Consultations ({p.consultationSerials?.length || 0})</span>
                    </TabsTrigger>
                    <TabsTrigger value="prescriptions" className="text-xs h-7 gap-1.5 font-semibold">
                      <Pill className="size-3 text-emerald-500" />
                      <span>Prescriptions ({p.prescriptions?.length || 0})</span>
                    </TabsTrigger>
                    <TabsTrigger value="therapy" className="text-xs h-7 gap-1.5 font-semibold">
                      <Activity className="size-3 text-purple-500" />
                      <span>Therapy Plans ({p.treatmentPlans?.length || 0})</span>
                    </TabsTrigger>
                    <TabsTrigger value="invoices" className="text-xs h-7 gap-1.5 font-semibold">
                      <Receipt className="size-3 text-amber-500" />
                      <span>Invoices &amp; Payments ({p.invoices?.length || 0})</span>
                    </TabsTrigger>
                    <TabsTrigger value="journey" className="text-xs h-7 gap-1.5 font-semibold">
                      <Compass className="size-3 text-indigo-500" />
                      <span>Journey Steps ({p.stepLogs?.length || 0})</span>
                    </TabsTrigger>
                    <TabsTrigger value="notes" className="text-xs h-7 gap-1.5 font-semibold">
                      <FileText className="size-3 text-rose-500" />
                      <span>Department Notes ({p.visitNotes?.length || 0})</span>
                    </TabsTrigger>
                  </TabsList>

                  {/* TAB: CONSULTATIONS */}
                  <TabsContent value="consultations" className="mt-3 space-y-2.5">
                    {p.consultationSerials?.length === 0 ? (
                      <div className="p-8 text-center text-xs text-muted-foreground border rounded-xl">
                        No doctor consultation records found.
                      </div>
                    ) : (
                      p.consultationSerials?.map((s: any) => {
                        const dateStr = new Date(s.appointmentDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        });
                        return (
                          <div
                            key={s.id}
                            className="p-3 rounded-xl border border-border/80 bg-card hover:border-primary/40 transition-colors text-xs flex items-start justify-between gap-3"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-foreground">
                                  Consultation Serial #{s.serialNumber}
                                </span>
                                <span className="text-muted-foreground">• {dateStr}</span>
                                <Badge variant="outline" className="text-[10px] font-mono py-0">
                                  {s.status}
                                </Badge>
                              </div>
                              <p className="text-muted-foreground">
                                Doctor: <strong className="text-foreground">{s.doctor?.name || "Dr. Farhan Ahmed"}</strong>
                                {s.toldTime && ` • Told Time: ${s.toldTime}`}
                              </p>
                              {s.notes && (
                                <p className="italic text-muted-foreground text-[11px] bg-muted/40 p-1.5 rounded">
                                  Notes: {s.notes}
                                </p>
                              )}
                            </div>
                            <div className="text-right shrink-0 font-mono text-[11px]">
                              <div>Fee: ৳{s.feeAmount}</div>
                              <div className={s.dueAmount > 0 ? "text-rose-600 font-bold" : "text-emerald-600"}>
                                {s.dueAmount > 0 ? `Due: ৳${s.dueAmount}` : "Settled"}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </TabsContent>

                  {/* TAB: PRESCRIPTIONS */}
                  <TabsContent value="prescriptions" className="mt-3 space-y-3">
                    {p.prescriptions?.length === 0 ? (
                      <div className="p-8 text-center text-xs text-muted-foreground border rounded-xl">
                        No prescription records found.
                      </div>
                    ) : (
                      p.prescriptions?.map((pr: any) => {
                        const prDate = new Date(pr.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        });
                        return (
                          <div key={pr.id} className="p-3.5 rounded-xl border border-border/80 bg-card space-y-2 text-xs">
                            <div className="flex items-center justify-between border-b pb-2">
                              <div className="font-bold text-foreground flex items-center gap-2">
                                <Pill className="size-4 text-emerald-600" />
                                <span>Prescription • {prDate}</span>
                              </div>
                              <span className="text-muted-foreground text-[11px]">
                                Attending: {pr.doctor?.name || "Doctor"}
                              </span>
                            </div>
                            {pr.diagnosis && (
                              <div className="text-[11.5px]">
                                <strong className="text-foreground">Diagnosis:</strong>{" "}
                                <span className="text-muted-foreground">{pr.diagnosis}</span>
                              </div>
                            )}
                            {Array.isArray(pr.medicines) && pr.medicines.length > 0 && (
                              <div className="space-y-1.5 pt-1">
                                <span className="text-[10px] font-bold uppercase text-muted-foreground">Medications List:</span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {pr.medicines.map((m: any, mIdx: number) => (
                                    <div key={mIdx} className="p-2 rounded-lg bg-muted/40 border border-border/50 text-xs space-y-0.5">
                                      <div className="font-semibold text-foreground">{m.name}</div>
                                      <div className="text-[10.5px] text-muted-foreground">
                                        Timing: {m.mealTiming === "BEFORE" ? "Before Meal" : "After Meal"} • {Array.isArray(m.times) ? m.times.join(" • ") : m.times}
                                      </div>
                                      {m.duration && <div className="text-[10px] font-mono text-muted-foreground">Duration: {m.duration}</div>}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {pr.advice && (
                              <p className="text-[11px] text-muted-foreground italic pt-1 border-t">
                                Advice: {pr.advice}
                              </p>
                            )}
                          </div>
                        );
                      })
                    )}
                  </TabsContent>

                  {/* TAB: THERAPY */}
                  <TabsContent value="therapy" className="mt-3 space-y-3">
                    {p.treatmentPlans?.length === 0 ? (
                      <div className="p-8 text-center text-xs text-muted-foreground border rounded-xl">
                        No physical therapy plans found.
                      </div>
                    ) : (
                      p.treatmentPlans?.map((tp: any) => {
                        const tpDate = new Date(tp.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        });
                        return (
                          <div key={tp.id} className="p-3.5 rounded-xl border border-border/80 bg-card space-y-2 text-xs">
                            <div className="flex items-center justify-between border-b pb-2">
                              <span className="font-bold text-foreground">
                                {tp.planType === "TODAY" ? "Today's Modality Protocol" : "Next Session Plan"} • {tpDate}
                              </span>
                              <span className="text-muted-foreground text-[11px]">
                                Prescribed by: {tp.doctor?.name || "Doctor"}
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
                                      className="px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-700 dark:text-purple-300 font-semibold border border-purple-500/20 text-xs"
                                    >
                                      {mIdx + 1}. {name} {mins ? `(${mins})` : ""}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                            {tp.instructions && (
                              <p className="text-[11.5px] text-muted-foreground italic pt-1">
                                Instructions: {tp.instructions}
                              </p>
                            )}
                          </div>
                        );
                      })
                    )}
                  </TabsContent>

                  {/* TAB: INVOICES */}
                  <TabsContent value="invoices" className="mt-3 space-y-2.5">
                    {p.invoices?.length === 0 ? (
                      <div className="p-8 text-center text-xs text-muted-foreground border rounded-xl">
                        No invoices issued for this patient.
                      </div>
                    ) : (
                      p.invoices?.map((inv: any) => {
                        const invDate = new Date(inv.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        });
                        return (
                          <div key={inv.id} className="p-3 rounded-xl border border-border/80 bg-card text-xs space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-sm text-foreground">
                                  {inv.invoiceNumber}
                                </span>
                                <span className="text-muted-foreground">• {invDate}</span>
                                <Badge variant="outline" className="text-[10px] uppercase font-bold py-0">
                                  {inv.paymentMethod}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2.5 font-mono">
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

                            {/* Itemized Payments */}
                            {Array.isArray(inv.payments) && inv.payments.length > 0 && (
                              <div className="pt-1.5 border-t border-border/50 space-y-1 pl-2 text-[11px]">
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
                      })
                    )}
                  </TabsContent>

                  {/* TAB: JOURNEY STEPS */}
                  <TabsContent value="journey" className="mt-3 space-y-2">
                    {p.stepLogs?.length === 0 ? (
                      <div className="p-8 text-center text-xs text-muted-foreground border rounded-xl">
                        No journey logs recorded.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {p.stepLogs?.map((log: any, idx: number) => {
                          const timeStr = new Date(log.timestamp).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true,
                          });
                          return (
                            <div key={log.id || idx} className="p-2.5 rounded-xl border border-border/70 bg-card/60 text-xs flex items-start justify-between gap-3">
                              <div className="space-y-0.5">
                                <div className="font-bold text-foreground">
                                  {log.step.replace(/_/g, " ")}
                                </div>
                                <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                                  <span className="px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-mono text-[10px]">
                                    📍 {log.station.replace(/_/g, " ")}
                                  </span>
                                  {log.roomNumber && <span>• Room: {log.roomNumber}</span>}
                                  {log.performerId && <span>• Performer: {log.performerId.slice(-6)}</span>}
                                </div>
                                {log.details && (
                                  <p className="text-[11px] text-foreground/80 italic pt-0.5">{log.details}</p>
                                )}
                              </div>
                              <span className="font-mono text-[10.5px] text-muted-foreground shrink-0">{timeStr}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </TabsContent>

                  {/* TAB: DEPARTMENT NOTES */}
                  <TabsContent value="notes" className="mt-3 space-y-2">
                    {p.visitNotes?.length === 0 ? (
                      <div className="p-8 text-center text-xs text-muted-foreground border rounded-xl">
                        No clinical or departmental notes recorded.
                      </div>
                    ) : (
                      p.visitNotes?.map((vn: any) => {
                        const vnDate = new Date(vn.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        });
                        return (
                          <div key={vn.id} className="p-2.5 rounded-xl border border-border bg-card/50 text-xs flex items-start gap-2.5">
                            <span className="font-bold uppercase text-[9.5px] px-1.5 py-0.2 rounded bg-primary/10 text-primary shrink-0">
                              {vn.category}
                            </span>
                            <div className="flex-1 space-y-0.5">
                              <p className="text-foreground">{vn.note}</p>
                              <div className="text-[10px] text-muted-foreground">
                                By {vn.authorName || "Staff"} ({vn.authorRole}) • {vnDate}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Printable Modals */}
      <PatientHistoryPrintDialog
        isOpen={isPrintHistoryOpen}
        onOpenChange={setIsPrintHistoryOpen}
        patientData={p}
      />
      <PatientJourneyPrintDialog
        isOpen={isPrintJourneyOpen}
        onOpenChange={setIsPrintJourneyOpen}
        patientData={p}
      />
    </>
  );
}
