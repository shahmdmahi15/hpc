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
import {
  Calculator,
  Printer,
  Download,
  Loader2,
} from "lucide-react";
import { CLINIC_CONFIG } from "@/lib/clinic-config";
import { downloadElementAsPdf, printElementIsolated } from "@/lib/pdf-generator";
import { toast } from "sonner";

export interface DailyClosingFinancialData {
  todayAppointmentsCount: number;
  todayConsultationCount: number;
  todayTherapyCount: number;
  todayCollected: number;
  todayDue: number;
  totalLifetimeRevenue: number;
  userCount: number;
  activeSessionCount: number;
  todayCash?: number;
  todayCard?: number;
  todayMfs?: number;
}

interface AdminDailyClosingDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  dateStr?: string;
  data: DailyClosingFinancialData;
}

export function AdminDailyClosingDialog({
  isOpen,
  onOpenChange,
  dateStr = new Date().toISOString().split("T")[0],
  data,
}: AdminDailyClosingDialogProps) {
  const [isGeneratingPdf, setIsGeneratingPdf] = React.useState(false);

  const reportDate = new Date(dateStr).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const totalGross = data.todayCollected + data.todayDue;
  const card = data.todayCard ?? 0;
  const mfs = data.todayMfs ?? 0;
  const cash = data.todayCash ?? Math.max(0, data.todayCollected - (card + mfs));

  const handlePrint = () => {
    printElementIsolated("admin-z-report-print", {
      title: `Daily Financial Z-Report - ${dateStr}`,
      paperSize: "5.5in 8.27in",
    });
  };

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    const filename = `HPC-ZReport-${dateStr}.pdf`;

    try {
      const success = await downloadElementAsPdf("admin-z-report-print", {
        filename,
        format: "custom-5.5x8.125",
        orientation: "portrait",
      });

      if (success) {
        toast.success("Daily Z-Report PDF downloaded successfully!");
      } else {
        toast.error("Failed to generate Z-Report PDF.");
      }
    } catch (err) {
      console.error("[Z-Report PDF] Error:", err);
      toast.error("Error creating Z-Report PDF.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-5xl lg:max-w-6xl max-h-[86vh] flex flex-col p-0 overflow-hidden bg-background border-border shadow-2xl rounded-2xl">
        <DialogHeader className="p-4 sm:p-5 pr-12 sm:pr-14 border-b border-border/60 bg-muted/20 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Calculator className="size-4 text-emerald-600" />
              <span>Daily Financial Closing (Z-Report)</span>
            </DialogTitle>
            <span className="text-[11px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border self-start sm:self-auto">
              5.5″ × 8.27″ (Thermal/A5 Paper)
            </span>
          </div>
        </DialogHeader>

        {/* Scrollable Printable Area */}
        <div className="p-3 sm:p-6 flex-1 overflow-y-auto overflow-x-hidden flex justify-center bg-neutral-200/70 dark:bg-neutral-950">
          <div
            id="admin-z-report-print"
            className="w-full max-w-[500px] min-h-[750px] p-4 sm:p-5 bg-white text-black font-sans text-xs leading-normal border border-black rounded-xs shadow-xl flex flex-col justify-between"
          >
            {/* Top Section */}
            <div className="space-y-2.5">
              {/* Header Letterhead with Official Logo */}
              <div className="flex items-start justify-between border-b-2 border-black pb-2.5 mb-2.5">
                <div className="flex items-center gap-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/logo.jpg"
                    alt="Health & Pain Care Center Logo"
                    className="size-13 object-contain shrink-0"
                  />
                  <div>
                    <h1 className="font-black text-base tracking-tight uppercase text-black leading-tight">
                      {CLINIC_CONFIG.name}
                    </h1>
                    <p className="text-[10px] font-bold text-neutral-800 tracking-wide">
                      {CLINIC_CONFIG.nameBangla}
                    </p>
                    <p className="text-[9px] font-medium text-neutral-600 pt-0.5">
                      {CLINIC_CONFIG.tagline}
                    </p>
                  </div>
                </div>

                <div className="text-right text-[9px] text-neutral-800 space-y-0.5">
                  <p className="font-bold text-black">Hotline: {CLINIC_CONFIG.phone}</p>
                  <p className="max-w-[170px] truncate text-[8.5px]">{CLINIC_CONFIG.addressBangla}</p>
                  <p className="text-[8px] text-neutral-600 font-mono">
                    {CLINIC_CONFIG.city}, Bangladesh
                  </p>
                </div>
              </div>

              {/* Document Header Bar */}
              <div className="flex items-center justify-between border-y border-black py-1 mb-2.5 bg-neutral-50 print:bg-white">
                <div className="flex items-center gap-2">
                  <span className="bg-black text-white font-black text-[9.5px] tracking-wider uppercase px-2 py-0.5 rounded-xs">
                    DAILY Z-REPORT CLOSING
                  </span>
                  <span className="text-[10.5px] font-bold text-black">
                    দৈনিক আর্থিক ও হিসাব ক্লোজিং
                  </span>
                </div>
                <div className="text-[9.5px] text-right font-mono font-bold text-black">
                  {dateStr}
                </div>
              </div>

              <p className="text-[9px] font-mono text-neutral-600 mb-2">
                Generated: {reportDate} • Time: {new Date().toLocaleTimeString()}
              </p>

              {/* Shift & Operational Key Metrics */}
              <div className="grid grid-cols-3 gap-2 my-2.5 p-2 bg-white rounded-xs border border-neutral-800 text-center">
                <div>
                  <span className="text-[9.5px] text-neutral-600 uppercase font-medium block">Total Visits</span>
                  <span className="text-lg font-black text-black font-mono">
                    {data.todayAppointmentsCount}
                  </span>
                </div>
                <div>
                  <span className="text-[9.5px] text-neutral-600 uppercase font-medium block">Consultations</span>
                  <span className="text-lg font-black text-black font-mono">
                    {data.todayConsultationCount}
                  </span>
                </div>
                <div>
                  <span className="text-[9.5px] text-neutral-600 uppercase font-medium block">Therapies</span>
                  <span className="text-lg font-black text-black font-mono">
                    {data.todayTherapyCount}
                  </span>
                </div>
              </div>

              {/* Financial Summary Breakdown Table */}
              <div className="border border-black rounded-xs overflow-hidden mb-2.5 text-[10.5px]">
                <div className="bg-neutral-100 px-3 py-1.5 font-black uppercase text-[9.5px] text-black border-b border-black">
                  Daily Revenue Reconciliation (আর্থিক স্থিতি বিবরণী)
                </div>
                <div className="p-2.5 space-y-1.5 bg-white">
                  <div className="flex justify-between">
                    <span className="text-neutral-700">Gross Billed Value (Total Revenue):</span>
                    <span className="font-sans font-bold text-black">৳ {totalGross.toLocaleString()} BDT</span>
                  </div>

                  <div className="border-t border-neutral-300 pt-1.5 space-y-1">
                    <div className="flex justify-between font-bold text-black">
                      <span>Total Collections (আদায়কৃত):</span>
                      <span className="font-sans text-sm font-black text-emerald-800">৳ {data.todayCollected.toLocaleString()} BDT</span>
                    </div>

                    {/* Breakdown by Payment Channel */}
                    <div className="pl-3 space-y-0.5 text-[9.5px] text-neutral-600 border-l-2 border-neutral-300 ml-1">
                      <div className="flex justify-between">
                        <span>• Cash in Counter (নগদ):</span>
                        <span className="font-mono font-semibold text-black">৳ {cash.toLocaleString()} BDT</span>
                      </div>
                      <div className="flex justify-between">
                        <span>• Card / POS Terminal (কার্ড):</span>
                        <span className="font-mono font-semibold text-black">৳ {card.toLocaleString()} BDT</span>
                      </div>
                      <div className="flex justify-between">
                        <span>• MFS (bKash / Nagad):</span>
                        <span className="font-mono font-semibold text-black">৳ {mfs.toLocaleString()} BDT</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between text-black font-bold border-t border-neutral-300 pt-1.5">
                    <span>Outstanding Patient Dues (বকেয়া):</span>
                    <span className="font-sans font-bold text-amber-900">৳ {data.todayDue.toLocaleString()} BDT</span>
                  </div>

                  <div className="flex justify-between text-neutral-600 text-[10px] border-t border-neutral-300 pt-1">
                    <span>Cumulative Clinic Lifetime Revenue:</span>
                    <span className="font-sans font-semibold">৳ {data.totalLifetimeRevenue.toLocaleString()} BDT</span>
                  </div>
                </div>
              </div>

              {/* System Security & Integrity Audit Strip */}
              <div className="p-2 bg-white rounded-xs border border-neutral-700 text-[9.5px] space-y-1 mb-3">
                <div className="flex justify-between">
                  <span className="text-neutral-600 font-medium">System Operating Mode:</span>
                  <span className="font-bold text-black">100% Offline Local LAN Safe Mode</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600 font-medium">Database Engine:</span>
                  <span className="font-mono font-semibold text-black">SQLite 3 (WAL Mode + Checkpoint)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600 font-medium">Active Staff Sessions:</span>
                  <span className="font-mono font-bold text-black">{data.activeSessionCount} Local Terminals</span>
                </div>
              </div>
            </div>

            {/* Flexible Spacer */}
            <div className="flex-1 min-h-6"></div>

            {/* Bottom Signatures Section */}
            <div className="pt-2">
              <div className="grid grid-cols-2 gap-6 pt-3 border-t border-black text-[9.5px]">
                <div>
                  <div className="h-8"></div>
                  <div className="border-t border-black pt-1">
                    <p className="font-bold text-black">Chief Cashier / Staff</p>
                    <p className="text-neutral-600 text-[8.5px]">Register Closing Sign</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="h-8"></div>
                  <div className="border-t border-black pt-1">
                    <p className="font-bold text-black">Clinic Administrator / Director</p>
                    <p className="text-neutral-600 text-[8.5px]">Verified &amp; Reconciled</p>
                  </div>
                </div>
              </div>

              <p className="text-[8px] text-neutral-500 text-center mt-3 font-mono">
                Printed on {CLINIC_CONFIG.name} Terminal • Standard 5.5″ × 8.27″ HPC Paper
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="p-3.5 sm:p-4 border-t border-border/60 bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="cursor-pointer w-full sm:w-auto"
          >
            Close
          </Button>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isGeneratingPdf}
              onClick={handleDownloadPdf}
              className="gap-1 font-semibold cursor-pointer flex-1 sm:flex-initial"
            >
              {isGeneratingPdf ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
              <span>Download PDF</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handlePrint}
              className="gap-1.5 font-semibold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-xs flex-1 sm:flex-initial"
            >
              <Printer className="size-3.5" />
              <span>Print Z-Report (5.5″ × 8.27″)</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
