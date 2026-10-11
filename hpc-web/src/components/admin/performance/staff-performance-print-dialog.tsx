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
  Printer,
  Download,
  Award,
  Stethoscope,
  Activity,
  Users,
  CreditCard,
  Pill,
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { CLINIC_CONFIG } from "@/lib/clinic-config";
import {
  printElementIsolated,
  downloadElementAsPdf,
} from "@/lib/pdf-generator";
import type { StaffPerformanceReportData } from "@/actions/admin/performance.action";
import { toast } from "sonner";

interface StaffPerformancePrintDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  data: StaffPerformanceReportData;
}

export function StaffPerformancePrintDialog({
  isOpen,
  onOpenChange,
  data,
}: StaffPerformancePrintDialogProps) {
  const printRef = React.useRef<HTMLDivElement>(null);
  const [isExportingPdf, setIsExportingPdf] = React.useState(false);

  const printTimestamp = React.useMemo(() => {
    return new Date().toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }, []);

  const handlePrint = () => {
    if (printRef.current) {
      printElementIsolated(printRef.current, {
        title: `HPC_Staff_Performance_${data.summary.filter}_${new Date().toISOString().slice(0, 10)}`,
        paperSize: "a4",
      });
    } else {
      window.print();
    }
  };

  const handleDownloadPdf = async () => {
    if (!printRef.current) return;
    setIsExportingPdf(true);
    try {
      const filename = `HPC_Staff_Performance_${data.summary.filter}_${new Date().toISOString().slice(0, 10)}.pdf`;
      const success = await downloadElementAsPdf(printRef.current, {
        filename,
        format: "a4",
        orientation: "portrait",
        quality: 0.98,
      });
      if (success) {
        toast.success("Performance dossier PDF downloaded successfully.");
      } else {
        toast.error("Failed to generate PDF dossier.");
      }
    } catch (err: any) {
      console.error("[Performance Print] PDF export failed:", err);
      toast.error(err?.message || "Failed to generate PDF.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  const { summary, doctors, handlers, receptionists, cashiers } = data;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-background">
        <DialogHeader className="p-4 border-b border-border/80 bg-muted/30 flex flex-row items-center justify-between shrink-0">
          <div>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Award className="size-4 text-emerald-600" />
              <span>Staff &amp; Performer Performance Dossier (A4 Executive Print)</span>
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Official Executive Performance Telemetry • Filter: {summary.dateRangeLabel}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={isExportingPdf}
              onClick={handleDownloadPdf}
              className="h-8 gap-1.5 text-xs font-semibold shadow-xs"
            >
              <Download className="size-3.5 text-emerald-600" />
              <span>{isExportingPdf ? "Exporting..." : "Download PDF"}</span>
            </Button>

            <Button
              size="sm"
              onClick={handlePrint}
              className="h-8 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
            >
              <Printer className="size-3.5" />
              <span>Print A4 Dossier (Ctrl+P)</span>
            </Button>
          </div>
        </DialogHeader>

        {/* Scrollable Printable Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100 dark:bg-slate-950/60 print:p-0 print:bg-white print:overflow-visible">
          <div
            ref={printRef}
            className="no-outer-border max-w-[820px] mx-auto bg-white text-slate-900 p-6 sm:p-8 rounded-lg border border-slate-200 shadow-sm print:border-none print:shadow-none print:p-0 print:max-w-none text-xs leading-normal"
          >
            {/* 1. Official HPC Clinic Letterhead Header */}
            <div className="border-b-2 border-slate-900 pb-3 mb-4 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="size-9 rounded-lg bg-emerald-700 text-white font-extrabold flex items-center justify-center text-sm font-mono tracking-wider">
                    HPC
                  </div>
                  <div>
                    <h1 className="text-base font-black tracking-tight text-emerald-900 uppercase">
                      {CLINIC_CONFIG.name}
                    </h1>
                    <p className="text-[10px] text-slate-600 font-semibold uppercase tracking-wider">
                      {CLINIC_CONFIG.tagline}
                    </p>
                  </div>
                </div>
                <p className="text-[10px] text-slate-600 leading-tight pt-1">
                  {CLINIC_CONFIG.addressEnglish} • Hotline: {CLINIC_CONFIG.hotline} • Email: {CLINIC_CONFIG.email}
                </p>
              </div>

              <div className="text-right shrink-0">
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider mb-1">
                  Executive Performance Dossier
                </span>
                <p className="text-[10.5px] font-semibold text-slate-800">
                  Period: <span className="font-bold text-emerald-800">{summary.dateRangeLabel}</span>
                </p>
                <p className="text-[10px] text-slate-500 font-mono">
                  Generated: {printTimestamp}
                </p>
              </div>
            </div>

            {/* 2. Executive Overview KPI Grid */}
            <div className="mb-5 bg-slate-50 border border-slate-200 rounded-lg p-3">
              <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-800 mb-2 flex items-center gap-1.5">
                <TrendingUp className="size-3 text-emerald-700" />
                Clinic-Wide Key Performance Indicators (KPIs)
              </h2>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
                <div className="p-2 bg-white rounded border border-slate-200">
                  <span className="text-[9.5px] text-slate-500 font-semibold block uppercase">Total Revenue</span>
                  <span className="text-xs font-black text-emerald-800">
                    ৳{summary.totalCashierCollectedBDT.toLocaleString()}
                  </span>
                </div>

                <div className="p-2 bg-white rounded border border-slate-200">
                  <span className="text-[9.5px] text-slate-500 font-semibold block uppercase">Consultations</span>
                  <span className="text-xs font-black text-slate-900">
                    {summary.totalDoctorConsultations}
                  </span>
                </div>

                <div className="p-2 bg-white rounded border border-slate-200">
                  <span className="text-[9.5px] text-slate-500 font-semibold block uppercase">Therapy Sessions</span>
                  <span className="text-xs font-black text-blue-800">
                    {summary.totalHandlerTherapySessions}
                  </span>
                </div>

                <div className="p-2 bg-white rounded border border-slate-200">
                  <span className="text-[9.5px] text-slate-500 font-semibold block uppercase">Prescriptions</span>
                  <span className="text-xs font-black text-purple-800">
                    {summary.totalPrescriptions}
                  </span>
                </div>

                <div className="p-2 bg-white rounded border border-slate-200">
                  <span className="text-[9.5px] text-slate-500 font-semibold block uppercase">Check-Ins</span>
                  <span className="text-xs font-black text-amber-800">
                    {summary.totalReceptionCheckIns}
                  </span>
                </div>

                <div className="p-2 bg-white rounded border border-slate-200">
                  <span className="text-[9.5px] text-slate-500 font-semibold block uppercase">Total Due Marked</span>
                  <span className="text-xs font-black text-rose-800">
                    ৳{summary.totalCashierDueMarkedBDT.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Section 1: Doctor Consultation Performance */}
            <div className="mb-5">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-300 mb-2">
                <h3 className="text-xs font-extrabold uppercase text-slate-900 flex items-center gap-1.5">
                  <Stethoscope className="size-3.5 text-emerald-700" />
                  1. Doctor Consultation &amp; Clinical Revenue Telemetry ({doctors.length} Doctors)
                </h3>
              </div>

              {doctors.length === 0 ? (
                <p className="text-[11px] text-slate-500 italic py-1">No doctor activity recorded for this period.</p>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded">
                  <table className="w-full text-[10.5px] border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200 text-left">
                        <th className="p-1.5 pl-2">Doctor Name</th>
                        <th className="p-1.5 text-center">Fee</th>
                        <th className="p-1.5 text-center">Consults (Done/Total)</th>
                        <th className="p-1.5 text-center">Avg Time</th>
                        <th className="p-1.5 text-center">Total Time</th>
                        <th className="p-1.5 text-center">Prescriptions</th>
                        <th className="p-1.5 text-center">Unique Pts</th>
                        <th className="p-1.5 text-right pr-2">Earnings (BDT)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {doctors.map((doc) => (
                        <tr key={doc.doctorId} className="hover:bg-slate-50">
                          <td className="p-1.5 pl-2 font-bold text-slate-900">
                            {doc.name}
                            {doc.whatsapp && (
                              <span className="block text-[9px] font-normal text-slate-500">
                                WhatsApp: {doc.whatsapp}
                              </span>
                            )}
                          </td>
                          <td className="p-1.5 text-center font-mono">৳{doc.consultationFee}</td>
                          <td className="p-1.5 text-center font-semibold">
                            {doc.completedConsultations} / {doc.totalConsultations}
                          </td>
                          <td className="p-1.5 text-center font-mono">
                            {doc.avgConsultationMinutes > 0 ? `${doc.avgConsultationMinutes}m` : "—"}
                          </td>
                          <td className="p-1.5 text-center font-mono">
                            {doc.totalTimeSpentMinutes > 0
                              ? `${Math.floor(doc.totalTimeSpentMinutes / 60)}h ${doc.totalTimeSpentMinutes % 60}m`
                              : "—"}
                          </td>
                          <td className="p-1.5 text-center font-semibold text-purple-700">
                            {doc.prescriptionsWritten}
                          </td>
                          <td className="p-1.5 text-center">{doc.uniquePatientsCount}</td>
                          <td className="p-1.5 text-right pr-2 font-mono font-bold text-emerald-800">
                            ৳{doc.totalEarningsBDT.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 font-extrabold text-slate-900 border-t border-slate-300">
                        <td className="p-1.5 pl-2">Total / Average</td>
                        <td className="p-1.5 text-center">—</td>
                        <td className="p-1.5 text-center">
                          {doctors.reduce((sum, d) => sum + d.completedConsultations, 0)} / {summary.totalDoctorConsultations}
                        </td>
                        <td className="p-1.5 text-center">
                          {Math.round(
                            doctors.reduce((sum, d) => sum + d.avgConsultationMinutes, 0) /
                              (doctors.filter((d) => d.avgConsultationMinutes > 0).length || 1),
                          )}m
                        </td>
                        <td className="p-1.5 text-center">
                          {Math.floor(
                            doctors.reduce((sum, d) => sum + d.totalTimeSpentMinutes, 0) / 60,
                          )}h {doctors.reduce((sum, d) => sum + d.totalTimeSpentMinutes, 0) % 60}m
                        </td>
                        <td className="p-1.5 text-center">
                          {doctors.reduce((sum, d) => sum + d.prescriptionsWritten, 0)}
                        </td>
                        <td className="p-1.5 text-center">
                          {doctors.reduce((sum, d) => sum + d.uniquePatientsCount, 0)}
                        </td>
                        <td className="p-1.5 text-right pr-2 font-mono text-emerald-800">
                          ৳{doctors.reduce((sum, d) => sum + d.totalEarningsBDT, 0).toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* 4. Section 2: Physical Therapy Handler Performance */}
            <div className="mb-5">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-300 mb-2">
                <h3 className="text-xs font-extrabold uppercase text-slate-900 flex items-center gap-1.5">
                  <Activity className="size-3.5 text-blue-700" />
                  2. Physical Therapy &amp; Machine Bed Utilization ({handlers.length} Handlers)
                </h3>
              </div>

              {handlers.length === 0 ? (
                <p className="text-[11px] text-slate-500 italic py-1">No therapy handler activity recorded.</p>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded">
                  <table className="w-full text-[10.5px] border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200 text-left">
                        <th className="p-1.5 pl-2">Handler Name</th>
                        <th className="p-1.5 text-center">Completed Sessions</th>
                        <th className="p-1.5 text-center">Active Now</th>
                        <th className="p-1.5 text-center">Total Bed Time</th>
                        <th className="p-1.5 text-center">Avg Session Time</th>
                        <th className="p-1.5 text-center">Unique Pts</th>
                        <th className="p-1.5 text-left pr-2">Top Modalities Executed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {handlers.map((h) => (
                        <tr key={h.performerId} className="hover:bg-slate-50">
                          <td className="p-1.5 pl-2 font-bold text-slate-900">
                            {h.name}
                            <span className="block text-[9px] text-slate-500 font-normal">
                              Role: {h.role} • Rooms: {h.roomsCovered?.join(", ") || "All"}
                            </span>
                          </td>
                          <td className="p-1.5 text-center font-bold text-blue-800">
                            {h.therapySessionsCompleted}
                          </td>
                          <td className="p-1.5 text-center font-mono">
                            {h.inTherapyActive > 0 ? `${h.inTherapyActive} running` : "0"}
                          </td>
                          <td className="p-1.5 text-center font-mono">
                            {h.totalBedMinutes > 0
                              ? `${Math.floor(h.totalBedMinutes / 60)}h ${h.totalBedMinutes % 60}m`
                              : "—"}
                          </td>
                          <td className="p-1.5 text-center font-mono">
                            {h.avgSessionMinutes > 0 ? `${h.avgSessionMinutes}m` : "—"}
                          </td>
                          <td className="p-1.5 text-center">{h.uniquePatientsTreated}</td>
                          <td className="p-1.5 pr-2 text-slate-700">
                            {h.modalitiesHandled?.length > 0
                              ? h.modalitiesHandled.slice(0, 3).map((m) => `${m.name} (${m.count})`).join(", ")
                              : "Standard Therapy"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 font-extrabold text-slate-900 border-t border-slate-300">
                        <td className="p-1.5 pl-2">Total / Overall</td>
                        <td className="p-1.5 text-center text-blue-800">
                          {handlers.reduce((sum, h) => sum + h.therapySessionsCompleted, 0)}
                        </td>
                        <td className="p-1.5 text-center">
                          {handlers.reduce((sum, h) => sum + h.inTherapyActive, 0)}
                        </td>
                        <td className="p-1.5 text-center">
                          {Math.floor(
                            handlers.reduce((sum, h) => sum + h.totalBedMinutes, 0) / 60,
                          )}h {handlers.reduce((sum, h) => sum + h.totalBedMinutes, 0) % 60}m
                        </td>
                        <td className="p-1.5 text-center">
                          {Math.round(
                            handlers.reduce((sum, h) => sum + h.avgSessionMinutes, 0) /
                              (handlers.filter((h) => h.avgSessionMinutes > 0).length || 1),
                          )}m
                        </td>
                        <td className="p-1.5 text-center">
                          {handlers.reduce((sum, h) => sum + h.uniquePatientsTreated, 0)}
                        </td>
                        <td className="p-1.5 pr-2">—</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* 5. Section 3: Receptionist Patient Flow Telemetry */}
            <div className="mb-5">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-300 mb-2">
                <h3 className="text-xs font-extrabold uppercase text-slate-900 flex items-center gap-1.5">
                  <Users className="size-3.5 text-amber-700" />
                  3. Reception Desk &amp; Patient Check-In Flow ({receptionists.length} Staff)
                </h3>
              </div>

              {receptionists.length === 0 ? (
                <p className="text-[11px] text-slate-500 italic py-1">No reception desk activity recorded.</p>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded">
                  <table className="w-full text-[10.5px] border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200 text-left">
                        <th className="p-1.5 pl-2">Staff Name</th>
                        <th className="p-1.5 text-center">Arrival Check-Ins</th>
                        <th className="p-1.5 text-center">Serials Issued</th>
                        <th className="p-1.5 text-center">Regular Bookings</th>
                        <th className="p-1.5 text-center">Standby Bookings</th>
                        <th className="p-1.5 text-center">Unique Pts</th>
                        <th className="p-1.5 text-right pr-2">Step Logs</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {receptionists.map((r) => (
                        <tr key={r.performerId} className="hover:bg-slate-50">
                          <td className="p-1.5 pl-2 font-bold text-slate-900">
                            {r.name}
                            <span className="block text-[9px] text-slate-500 font-normal">
                              {r.phone || r.whatsapp}
                            </span>
                          </td>
                          <td className="p-1.5 text-center font-bold text-amber-800">{r.totalCheckIns}</td>
                          <td className="p-1.5 text-center font-semibold">{r.consultationSerialsIssued}</td>
                          <td className="p-1.5 text-center font-mono">{r.regularBookingsCount}</td>
                          <td className="p-1.5 text-center font-mono">{r.extraBookingsCount}</td>
                          <td className="p-1.5 text-center font-semibold">{r.uniquePatientsHandled}</td>
                          <td className="p-1.5 text-right pr-2 font-mono text-slate-600">{r.stepLogsCount}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 font-extrabold text-slate-900 border-t border-slate-300">
                        <td className="p-1.5 pl-2">Total Reception Volume</td>
                        <td className="p-1.5 text-center text-amber-800">
                          {receptionists.reduce((sum, r) => sum + r.totalCheckIns, 0)}
                        </td>
                        <td className="p-1.5 text-center">
                          {receptionists.reduce((sum, r) => sum + r.consultationSerialsIssued, 0)}
                        </td>
                        <td className="p-1.5 text-center">
                          {receptionists.reduce((sum, r) => sum + r.regularBookingsCount, 0)}
                        </td>
                        <td className="p-1.5 text-center">
                          {receptionists.reduce((sum, r) => sum + r.extraBookingsCount, 0)}
                        </td>
                        <td className="p-1.5 text-center">
                          {receptionists.reduce((sum, r) => sum + r.uniquePatientsHandled, 0)}
                        </td>
                        <td className="p-1.5 text-right pr-2">
                          {receptionists.reduce((sum, r) => sum + r.stepLogsCount, 0)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* 6. Section 4: Cashier Collections & Revenue Realization */}
            <div className="mb-5">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-300 mb-2">
                <h3 className="text-xs font-extrabold uppercase text-slate-900 flex items-center gap-1.5">
                  <CreditCard className="size-3.5 text-emerald-700" />
                  4. Cashier Payment Collections &amp; Realized Revenue ({cashiers.length} Cashiers)
                </h3>
              </div>

              {cashiers.length === 0 ? (
                <p className="text-[11px] text-slate-500 italic py-1">No cashier transaction activity recorded.</p>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded">
                  <table className="w-full text-[10.5px] border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200 text-left">
                        <th className="p-1.5 pl-2">Cashier Name</th>
                        <th className="p-1.5 text-center">Invoices (Paid / Due)</th>
                        <th className="p-1.5 text-right">Cash (BDT)</th>
                        <th className="p-1.5 text-right">Card POS</th>
                        <th className="p-1.5 text-right">MFS (bKash/Nagad)</th>
                        <th className="p-1.5 text-right">Total Due Marked</th>
                        <th className="p-1.5 text-right pr-2">Total Collected (BDT)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {cashiers.map((c) => (
                        <tr key={c.performerId} className="hover:bg-slate-50">
                          <td className="p-1.5 pl-2 font-bold text-slate-900">
                            {c.name}
                            <span className="block text-[9px] text-slate-500 font-normal">
                              Txns: {c.totalTransactionsCount} • Unique Pts: {c.uniquePatientsBilled}
                            </span>
                          </td>
                          <td className="p-1.5 text-center font-semibold">
                            {c.invoicesCleared} / {c.invoicesDue}
                          </td>
                          <td className="p-1.5 text-right font-mono">৳{c.cashBDT.toLocaleString()}</td>
                          <td className="p-1.5 text-right font-mono">৳{c.cardBDT.toLocaleString()}</td>
                          <td className="p-1.5 text-right font-mono">৳{c.mfsBDT.toLocaleString()}</td>
                          <td className="p-1.5 text-right font-mono font-semibold text-rose-700">
                            ৳{c.totalDueMarkedBDT.toLocaleString()}
                          </td>
                          <td className="p-1.5 text-right pr-2 font-mono font-bold text-emerald-800">
                            ৳{c.totalCollectedBDT.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 font-extrabold text-slate-900 border-t border-slate-300">
                        <td className="p-1.5 pl-2">Total Realized Cash Flow</td>
                        <td className="p-1.5 text-center">
                          {cashiers.reduce((sum, c) => sum + c.invoicesCleared, 0)} / {cashiers.reduce((sum, c) => sum + c.invoicesDue, 0)}
                        </td>
                        <td className="p-1.5 text-right font-mono">
                          ৳{cashiers.reduce((sum, c) => sum + c.cashBDT, 0).toLocaleString()}
                        </td>
                        <td className="p-1.5 text-right font-mono">
                          ৳{cashiers.reduce((sum, c) => sum + c.cardBDT, 0).toLocaleString()}
                        </td>
                        <td className="p-1.5 text-right font-mono">
                          ৳{cashiers.reduce((sum, c) => sum + c.mfsBDT, 0).toLocaleString()}
                        </td>
                        <td className="p-1.5 text-right font-mono text-rose-700">
                          ৳{cashiers.reduce((sum, c) => sum + c.totalDueMarkedBDT, 0).toLocaleString()}
                        </td>
                        <td className="p-1.5 text-right pr-2 font-mono text-emerald-800">
                          ৳{summary.totalCashierCollectedBDT.toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* 7. Section 5: Top Prescribed Medicines & Top Modalities */}
            <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Top Medicines */}
              <div className="border border-slate-200 rounded p-2.5">
                <h4 className="text-[11px] font-extrabold uppercase text-slate-800 mb-1.5 flex items-center gap-1">
                  <Pill className="size-3 text-purple-700" />
                  Top Prescribed Medicines ({summary.topMedicinesClinicWide?.length || 0})
                </h4>
                {summary.topMedicinesClinicWide?.length === 0 ? (
                  <p className="text-[10px] text-slate-500 italic">No medicine prescription data recorded.</p>
                ) : (
                  <table className="w-full text-[10px] border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                        <th className="p-1 text-left">#</th>
                        <th className="p-1 text-left">Medicine Name</th>
                        <th className="p-1 text-right">Count</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {summary.topMedicinesClinicWide.slice(0, 10).map((med, idx) => (
                        <tr key={med.name}>
                          <td className="p-1 font-mono text-slate-500">{idx + 1}</td>
                          <td className="p-1 font-semibold text-slate-800">{med.name}</td>
                          <td className="p-1 text-right font-bold text-purple-800">{med.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Top Modalities */}
              <div className="border border-slate-200 rounded p-2.5">
                <h4 className="text-[11px] font-extrabold uppercase text-slate-800 mb-1.5 flex items-center gap-1">
                  <Activity className="size-3 text-blue-700" />
                  Top Therapy Modalities ({summary.topModalitiesClinicWide?.length || 0})
                </h4>
                {summary.topModalitiesClinicWide?.length === 0 ? (
                  <p className="text-[10px] text-slate-500 italic">No modality execution data recorded.</p>
                ) : (
                  <table className="w-full text-[10px] border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                        <th className="p-1 text-left">#</th>
                        <th className="p-1 text-left">Therapy Modality</th>
                        <th className="p-1 text-right">Count</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {summary.topModalitiesClinicWide.slice(0, 10).map((mod, idx) => (
                        <tr key={mod.name}>
                          <td className="p-1 font-mono text-slate-500">{idx + 1}</td>
                          <td className="p-1 font-semibold text-slate-800">{mod.name}</td>
                          <td className="p-1 text-right font-bold text-blue-800">{mod.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* 8. Section 6: Official Audit Signatures */}
            <div className="pt-6 border-t border-slate-300 mt-6">
              <div className="grid grid-cols-3 gap-6 text-center">
                <div className="space-y-1">
                  <div className="border-b border-slate-400 w-32 mx-auto mb-1"></div>
                  <p className="text-[10px] font-bold text-slate-800 uppercase">Prepared By</p>
                  <p className="text-[9px] text-slate-500">Executive Administrative Officer</p>
                </div>

                <div className="space-y-1">
                  <div className="border-b border-slate-400 w-32 mx-auto mb-1"></div>
                  <p className="text-[10px] font-bold text-slate-800 uppercase">Verified By</p>
                  <p className="text-[9px] text-slate-500">Chief Medical Officer (CMO)</p>
                </div>

                <div className="space-y-1">
                  <div className="border-b border-slate-400 w-32 mx-auto mb-1"></div>
                  <p className="text-[10px] font-bold text-slate-800 uppercase">Approved By</p>
                  <p className="text-[9px] text-slate-500">Managing Director / Board</p>
                </div>
              </div>

              <div className="mt-6 text-center text-[9px] text-slate-400 uppercase tracking-widest border-t border-slate-100 pt-2 font-mono">
                CONFIDENTIAL CLINICAL DOCUMENT • HEALTH &amp; PAIN CARE CENTER (HPC) • SYSTEM TELEMETRY AUDIT TRAIL
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
