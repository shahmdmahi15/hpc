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
} from "lucide-react";
import { toast } from "sonner";

interface AdminExportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdminExportDialog({ isOpen, onOpenChange }: AdminExportDialogProps) {
  const [reportType, setReportType] = React.useState<"all" | "payments" | "patients" | "appointments" | "audit">("all");
  const [datePreset, setDatePreset] = React.useState<"today" | "yesterday" | "this_week" | "this_month" | "last_month" | "custom" | "all_time">("today");
  
  const todayStr = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = React.useState(todayStr);
  const [endDate, setEndDate] = React.useState(todayStr);
  const [isDownloading, setIsDownloading] = React.useState(false);

  const reportOptions = [
    {
      id: "all",
      label: "Master Report (All-in-One)",
      bangla: "সার্বিক মাস্টার রিপোর্ট",
      desc: "Complete financial, patient, appointment, and performer activity report",
      icon: Layers,
      color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800",
    },
    {
      id: "payments",
      label: "Payments & Cash Ledger",
      bangla: "পেমেন্ট ও ক্যাশ লেজার",
      desc: "Detailed billings, collections, cash/bKash breakdown and due balances",
      icon: CreditCard,
      color: "text-blue-600 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800",
    },
    {
      id: "patients",
      label: "Patient Directory",
      bangla: "রোগীদের তালিকা",
      desc: "MRN, demographics, contact details, total bills, and outstanding balance",
      icon: Users,
      color: "text-violet-600 bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-800",
    },
    {
      id: "appointments",
      label: "Appointments & Queue",
      bangla: "অ্যাপয়েন্টমেন্ট ও টিকিট",
      desc: "Token serials, consultation & therapy schedules, rooms, and doctor status",
      icon: CalendarCheck,
      color: "text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800",
    },
    {
      id: "audit",
      label: "Security Audit Logs",
      bangla: "নিরাপত্তা ও অডিট লগ",
      desc: "Login activity, clinical changes, cancellations, and performer actions",
      icon: ShieldCheck,
      color: "text-slate-600 bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800",
    },
  ] as const;

  const presetButtons = [
    { id: "today", label: "Today (আজ)" },
    { id: "yesterday", label: "Yesterday (গতকাল)" },
    { id: "this_week", label: "This Week (চলতি সপ্তাহ)" },
    { id: "this_month", label: "This Month (চলতি মাস)" },
    { id: "last_month", label: "Last Month (গত মাস)" },
    { id: "custom", label: "Custom Range (কাস্টম তারিখ)" },
    { id: "all_time", label: "All Time (সর্বমোট)" },
  ] as const;

  const handleDownload = () => {
    setIsDownloading(true);
    let url = `/api/admin/export?type=${reportType}`;

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
    link.setAttribute("download", `HPC_${reportType}_report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("CSV Report download initiated! Check your downloads folder.");
    setTimeout(() => {
      setIsDownloading(false);
      onOpenChange(false);
    }, 1200);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-2xl md:max-w-3xl p-0 overflow-hidden bg-background border-border/80 shadow-2xl rounded-2xl">
        <DialogHeader className="p-4 sm:p-5 border-b border-border/70 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-emerald-600/10 text-emerald-600 flex items-center justify-center border border-emerald-600/20 shadow-xs">
              <FileSpreadsheet className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                <span>Download Comprehensive CSV Reports</span>
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Export financial ledgers, patient directories, payments, and appointments formatted for Microsoft Excel
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="p-4 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* 1. Report Category Selector */}
          <div>
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
              1. Select Report Category (রিপোর্টের ধরন)
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {reportOptions.map((opt) => {
                const isSelected = reportType === opt.id;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setReportType(opt.id as any)}
                    className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? "border-emerald-600 bg-emerald-500/5 ring-1 ring-emerald-600/40 shadow-xs"
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
                      <p className="text-[10.5px] font-medium text-emerald-700 dark:text-emerald-400">{opt.bangla}</p>
                      <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{opt.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Date Filter Presets */}
          <div>
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
              2. Select Date Period (তারিখ নির্বাচন)
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {presetButtons.map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => setDatePreset(btn.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                    datePreset === btn.id
                      ? "bg-foreground text-background border-foreground shadow-xs"
                      : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border-border/60"
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Custom Date Range Inputs (Shown when custom is picked) */}
          {datePreset === "custom" && (
            <div className="p-4 rounded-xl bg-muted/30 border border-border/80 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in duration-200">
              <div className="space-y-1.5">
                <Label htmlFor="start-date" className="text-xs font-semibold flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-emerald-600" />
                  <span>Start Date (শুরুর তারিখ)</span>
                </Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-background text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="end-date" className="text-xs font-semibold flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-emerald-600" />
                  <span>End Date (শেষ তারিখ)</span>
                </Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-background text-xs"
                />
              </div>
            </div>
          )}

          {/* Excel Formatting Note */}
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
            <span>
              Pre-encoded with UTF-8 Byte Order Mark (BOM). Bengali names, addresses, and currency symbols display perfectly in Microsoft Excel, Google Sheets, and LibreOffice.
            </span>
          </div>
        </div>

        <DialogFooter className="p-4 border-t border-border/70 bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="cursor-pointer w-full sm:w-auto"
          >
            Cancel
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleDownload}
            disabled={isDownloading}
            className="gap-2 font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-sm w-full sm:w-auto"
          >
            <Download className="size-4" />
            <span>{isDownloading ? "Preparing CSV..." : "Download CSV Report"}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
