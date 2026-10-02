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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FileSpreadsheet,
  Download,
  Calendar,
  CreditCard,
  Users,
  CalendarCheck,
  ShieldCheck,
  Layers,
  CheckCircle2,
  FileText,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

interface AdminExportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdminExportDialog({ isOpen, onOpenChange }: AdminExportDialogProps) {
  const [reportType, setReportType] = React.useState<"all" | "payments" | "patients" | "appointments" | "audit">("all");
  const [exportFormat, setExportFormat] = React.useState<"xlsx" | "csv">("xlsx");
  const [datePreset, setDatePreset] = React.useState<"today" | "yesterday" | "this_week" | "this_month" | "last_month" | "custom" | "all_time">("today");
  
  const todayStr = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = React.useState(todayStr);
  const [endDate, setEndDate] = React.useState(todayStr);
  const [isDownloading, setIsDownloading] = React.useState(false);

  const modularReports = [
    {
      id: "payments",
      label: "Payments & Cash Ledger",
      bangla: "পেমেন্ট ও ক্যাশ লেজার",
      desc: "Billings, collections, cash/MFS breakdown & due balances with formula totals",
      icon: CreditCard,
      color: "text-blue-600 bg-blue-500/10 border-blue-500/20",
    },
    {
      id: "patients",
      label: "Patient Directory",
      bangla: "রোগীদের তালিকা",
      desc: "MRN, demographics, contact details, total bills & outstanding balances",
      icon: Users,
      color: "text-violet-600 bg-violet-500/10 border-violet-500/20",
    },
    {
      id: "appointments",
      label: "Appointments & Queue",
      bangla: "অ্যাপয়েন্টমেন্ট ও টিকিট",
      desc: "Token serials, consultation & therapy schedules, rooms & doctor statuses",
      icon: CalendarCheck,
      color: "text-amber-600 bg-amber-500/10 border-amber-500/20",
    },
    {
      id: "audit",
      label: "Security Audit Logs",
      bangla: "নিরাপত্তা ও অডিট লগ",
      desc: "Login activity, clinical changes, cancellations & performer actions",
      icon: ShieldCheck,
      color: "text-slate-600 dark:text-slate-400 bg-slate-500/10 border-slate-500/20",
    },
  ] as const;

  const presetButtons = [
    { id: "today", label: "Today (আজ)" },
    { id: "yesterday", label: "Yesterday (গতকাল)" },
    { id: "this_week", label: "This Week (চলতি সপ্তাহ)" },
    { id: "this_month", label: "This Month (চলতি মাস)" },
    { id: "last_month", label: "Last Month (গত মাস)" },
    { id: "custom", label: "Custom Range (কাস্টম)" },
    { id: "all_time", label: "All Time (সর্বমোট)" },
  ] as const;

  const handleDownload = () => {
    setIsDownloading(true);
    let url = `/api/admin/export?type=${reportType}&format=${exportFormat}`;

    if (datePreset === "custom") {
      if (!startDate || !endDate) {
        toast.error("Please specify both start and end dates.");
        setIsDownloading(false);
        return;
      }
      url += `&startDate=${startDate}&endDate=${endDate}`;
    } else {
      url += `&preset=${datePreset}`;
    }

    // Trigger download
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `HPC_${reportType}_report.${exportFormat}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(`${exportFormat.toUpperCase()} Report download initiated! Check your downloads folder.`);
    setTimeout(() => {
      setIsDownloading(false);
      onOpenChange(false);
    }, 1200);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-5xl lg:max-w-6xl max-h-[86vh] flex flex-col p-0 overflow-hidden bg-background border-border/80 shadow-2xl rounded-2xl">
        {/* Compact, Wide Header */}
        <DialogHeader className="p-4 sm:p-5 pr-12 sm:pr-14 border-b border-border/70 bg-muted/20 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-emerald-600/10 text-emerald-600 flex items-center justify-center border border-emerald-600/20 shadow-xs shrink-0">
                <FileSpreadsheet className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle className="text-base sm:text-lg font-bold">
                    Export Executive Clinic Reports
                  </DialogTitle>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                    Excel & Google Sheets Compatible
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Multi-sheet workbooks with `=SUM()` formulas, styled clinic letterheads, and audit-grade ledgers
                </p>
              </div>
            </div>

            {/* Quick Format Badge */}
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-muted/40 border border-border/60 text-xs">
              <span className="text-muted-foreground text-[11px]">Format:</span>
              <span className="font-bold text-foreground uppercase">{exportFormat}</span>
            </div>
          </div>
        </DialogHeader>

        {/* Responsive 2-Column Wide Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start">
            
            {/* ──────── LEFT COLUMN: Format, Date Range & Compatibility (5 of 12 cols) ──────── */}
            <div className="lg:col-span-5 space-y-4">
              {/* 1. Format Choice */}
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
                  1. Choose File Format (ফরম্যাট)
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5">
                  {/* Excel (.xlsx) */}
                  <button
                    type="button"
                    onClick={() => setExportFormat("xlsx")}
                    className={`relative flex items-start gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      exportFormat === "xlsx"
                        ? "border-emerald-600 bg-emerald-500/10 ring-2 ring-emerald-600/40 shadow-xs"
                        : "border-border/70 hover:border-border hover:bg-muted/30"
                    }`}
                  >
                    <div className="size-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <FileSpreadsheet className="size-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-foreground">Microsoft Excel (.xlsx)</span>
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-600 text-white">
                          <Sparkles className="size-2.5" /> Best
                        </span>
                      </div>
                      <p className="text-[10.5px] text-muted-foreground mt-0.5 leading-snug">
                        Multi-sheet tabs, formulas (`=SUM`), color-coded headers & auto-fit columns.
                      </p>
                    </div>
                    {exportFormat === "xlsx" && (
                      <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                    )}
                  </button>

                  {/* Standard CSV */}
                  <button
                    type="button"
                    onClick={() => setExportFormat("csv")}
                    className={`relative flex items-start gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      exportFormat === "csv"
                        ? "border-emerald-600 bg-emerald-500/10 ring-2 ring-emerald-600/40 shadow-xs"
                        : "border-border/70 hover:border-border hover:bg-muted/30"
                    }`}
                  >
                    <div className="size-8 rounded-lg bg-slate-700 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <FileText className="size-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-foreground">Standard CSV (.csv)</span>
                        <span className="text-[10px] text-muted-foreground font-mono">BOM</span>
                      </div>
                      <p className="text-[10.5px] text-muted-foreground mt-0.5 leading-snug">
                        Single tabular sheet with UTF-8 BOM encoding for external imports.
                      </p>
                    </div>
                    {exportFormat === "csv" && (
                      <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                    )}
                  </button>
                </div>
              </div>

              {/* 2. Date Presets */}
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
                  2. Select Date Period (তারিখ)
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {presetButtons.map((btn) => (
                    <button
                      key={btn.id}
                      type="button"
                      onClick={() => setDatePreset(btn.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                        datePreset === btn.id
                          ? "bg-foreground text-background border-foreground shadow-xs"
                          : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border-border/60"
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>

                {/* Custom Date Pickers */}
                {datePreset === "custom" && (
                  <div className="mt-2.5 p-3 rounded-xl bg-muted/30 border border-border/80 grid grid-cols-2 gap-2.5 animate-in fade-in duration-200">
                    <div className="space-y-1">
                      <Label htmlFor="start-date" className="text-[11px] font-semibold flex items-center gap-1 text-muted-foreground">
                        <Calendar className="size-3 text-emerald-600" />
                        <span>Start Date</span>
                      </Label>
                      <Input
                        id="start-date"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="bg-background text-xs h-8"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="end-date" className="text-[11px] font-semibold flex items-center gap-1 text-muted-foreground">
                        <Calendar className="size-3 text-emerald-600" />
                        <span>End Date</span>
                      </Label>
                      <Input
                        id="end-date"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="bg-background text-xs h-8"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Offline Compatibility Guarantee Notice */}
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-900 dark:text-emerald-200 flex items-start gap-2.5">
                <CheckCircle2 className="size-4 shrink-0 text-emerald-600 mt-0.5" />
                <p className="text-emerald-800/90 dark:text-emerald-300/90 leading-relaxed text-[11px]">
                  Generated 100% locally on your LAN server without internet. Pre-formatted for Microsoft Excel, Google Sheets, and LibreOffice with full Bengali Unicode support.
                </p>
              </div>
            </div>

            {/* ──────── RIGHT COLUMN: Report Scope Selection (7 of 12 cols) ──────── */}
            <div className="lg:col-span-7 space-y-3">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                3. Select Report Scope (রিপোর্টের ধরন)
              </Label>

              {/* Master Report (All-in-One Multi-Sheet) - Featured Hero Card */}
              <button
                type="button"
                onClick={() => setReportType("all")}
                className={`w-full relative flex items-start gap-3.5 p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                  reportType === "all"
                    ? "border-emerald-600 bg-emerald-500/10 ring-2 ring-emerald-600/50 shadow-sm"
                    : "border-border/70 hover:border-border hover:bg-muted/30"
                }`}
              >
                <div className="size-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs border border-emerald-500">
                  <Layers className="size-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-foreground">
                        Master Report (All-in-One Multi-Sheet)
                      </span>
                      <span className="px-2 py-0.2 rounded-full text-[9px] font-bold bg-emerald-600 text-white">
                        All 5 Sheets Included
                      </span>
                    </div>
                    {reportType === "all" && (
                      <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mt-0.5">
                    সার্বিক মাস্টার রিপোর্ট (মাল্টি-শীট এক্সেল ফাইল)
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                    Generates a complete workbook with 5 dedicated sheets: Executive Summary, Financial Ledger, Patient Directory, Queue Schedule, and Audit Event Trail.
                  </p>
                </div>
              </button>

              {/* 4 Modular Sub-Reports in 2x2 Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {modularReports.map((opt) => {
                  const isSelected = reportType === opt.id;
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setReportType(opt.id as any)}
                      className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? "border-emerald-600 bg-emerald-500/10 ring-2 ring-emerald-600/40 shadow-xs"
                          : "border-border/70 hover:border-border hover:bg-muted/30"
                      }`}
                    >
                      <div className={`size-8 rounded-lg flex items-center justify-center shrink-0 border ${opt.color}`}>
                        <Icon className="size-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-foreground truncate">{opt.label}</p>
                          {isSelected && <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0 ml-1" />}
                        </div>
                        <p className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400">{opt.bangla}</p>
                        <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{opt.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>
        </div>

        {/* Pinned Bottom Footer */}
        <DialogFooter className="p-4 border-t border-border/70 bg-muted/20 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <span>Selected:</span>
            <span className="font-semibold text-foreground">
              {reportType === "all" ? "Master Report (5 Sheets)" : modularReports.find(r => r.id === reportType)?.label}
            </span>
            <span>•</span>
            <span className="font-bold text-emerald-600 uppercase">{exportFormat}</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="cursor-pointer flex-1 sm:flex-initial"
            >
              Cancel
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleDownload}
              disabled={isDownloading}
              className="gap-2 font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-sm flex-1 sm:flex-initial"
            >
              <Download className="size-4" />
              <span>
                {isDownloading
                  ? `Preparing ${exportFormat.toUpperCase()}...`
                  : `Download ${exportFormat.toUpperCase()} Workbook`}
              </span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
