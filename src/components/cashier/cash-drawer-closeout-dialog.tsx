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
  Banknote,
  CreditCard,
  Smartphone,
  Printer,
  Calculator,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  FileCheck,
} from "lucide-react";
import { CLINIC_CONFIG } from "@/lib/clinic-config";
import { printElementIsolated } from "@/lib/pdf-generator";
import { toast } from "sonner";

interface CashDrawerCloseoutDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: string;
  cashierName: string;
  stats: {
    totalCollected: number;
    pendingCollection: number;
    paidCount: number;
    pendingCount: number;
    cashCollected: number;
    cardCollected: number;
    mfsCollected: number;
  };
}

export function CashDrawerCloseoutDialog({
  isOpen,
  onOpenChange,
  selectedDate,
  cashierName,
  stats,
}: CashDrawerCloseoutDialogProps) {
  const [actualCash, setActualCash] = React.useState<number>(stats.cashCollected);
  const [notes, setNotes] = React.useState("");

  // Sync default when opening
  React.useEffect(() => {
    if (isOpen) {
      setActualCash(stats.cashCollected);
      setNotes("");
    }
  }, [isOpen, stats.cashCollected]);

  const diff = actualCash - stats.cashCollected;
  const isBalanced = diff === 0;

  const handlePrint = () => {
    printElementIsolated(
      "register-closeout-print",
      `Shift Register Closeout - ${selectedDate}`
    );
  };

  const handleFinalize = () => {
    toast.success("Shift register reconciled and closed successfully!");
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-5xl lg:max-w-6xl max-h-[86vh] flex flex-col p-0 overflow-hidden bg-background border-border shadow-2xl rounded-2xl">
        <DialogHeader className="p-4 sm:p-5 pr-12 sm:pr-14 border-b border-border/60 bg-muted/20 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Calculator className="size-4 text-amber-500" />
              <span>Daily Shift Closeout &amp; Cash Reconciliation</span>
            </DialogTitle>
            <span className="text-[11px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border self-start sm:self-auto">
              5.5″ × 8.27″ (HPC Paper)
            </span>
          </div>
        </DialogHeader>

        <div className="p-3 sm:p-6 flex-1 overflow-y-auto overflow-x-hidden flex justify-center bg-neutral-200/70 dark:bg-neutral-950">
          {/* Printable Register Sheet (Formatted for 5.5" x 8.27" custom paper) */}
          <div
            id="register-closeout-print"
            className="w-full max-w-[500px] min-h-[750px] p-4 sm:p-5 rounded-xs border border-black bg-white text-black space-y-3 text-xs shadow-xl font-sans flex flex-col justify-between"
          >
            {/* Top Section */}
            <div className="space-y-3">
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
              <div className="flex items-center justify-between border-y border-black py-1 mb-2 bg-neutral-50 print:bg-white">
                <div className="flex items-center gap-2">
                  <span className="bg-black text-white font-black text-[9.5px] tracking-wider uppercase px-2 py-0.5 rounded-xs">
                    SHIFT CASH CLOSEOUT
                  </span>
                  <span className="text-[10.5px] font-bold text-black">
                    ক্যাশিয়ার শিফট ক্লোজিং ও ক্যাশ মেলানো
                  </span>
                </div>
                <div className="text-[9.5px] text-right font-mono font-bold text-black">
                  {selectedDate}
                </div>
              </div>

              {/* Shift Cashier & Reconciled Time Strip */}
              <div className="flex justify-between items-center text-[10px] p-2 bg-white rounded-xs border border-neutral-700">
                <div>
                  <span className="text-neutral-600 font-medium">Shift Cashier: </span>
                  <span className="font-bold text-black uppercase">{cashierName}</span>
                </div>
                <div>
                  <span className="text-neutral-600 font-medium">Closeout Time: </span>
                  <span className="font-mono font-bold text-black">{new Date().toLocaleTimeString()}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {/* Left Column: System Breakdown */}
                <div className="space-y-2 text-xs bg-white p-3 rounded-xs border border-black">
                  <p className="text-[10px] font-black uppercase tracking-wider text-black border-b border-black pb-1 mb-2">
                    System Recorded Collections
                  </p>
                  <div className="flex justify-between items-center text-neutral-700">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Banknote className="size-3.5 text-black" />
                      <span>Cash Collections:</span>
                    </span>
                    <span className="font-bold text-black font-sans">
                      ৳ {stats.cashCollected.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-neutral-700">
                    <span className="flex items-center gap-1.5 font-medium">
                      <CreditCard className="size-3.5 text-black" />
                      <span>Card POS:</span>
                    </span>
                    <span className="font-bold text-black font-sans">
                      ৳ {stats.cardCollected.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-neutral-700">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Smartphone className="size-3.5 text-black" />
                      <span>MFS (bKash/Nagad):</span>
                    </span>
                    <span className="font-bold text-black font-sans">
                      ৳ {stats.mfsCollected.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t-2 border-black font-bold text-xs text-black">
                    <span>Total Settled:</span>
                    <span className="font-sans font-black text-sm">
                      ৳ {stats.totalCollected.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-[10px] text-neutral-600 pt-1 border-t border-neutral-300">
                    <span>Settled Invoices:</span>
                    <span className="font-bold text-black">{stats.paidCount} vouchers</span>
                  </div>
                </div>

                {/* Right Column: Cash Drawer Counting & Handover Notes */}
                <div className="space-y-3">
                  {/* Cash Drawer Counting Input */}
                  <div className="p-3 rounded-xs bg-white border border-black space-y-2">
                    <Label className="text-xs font-bold text-black flex items-center gap-1.5 font-sans">
                      <Banknote className="size-3.5 text-black" />
                      <span>Counted Physical Cash in Drawer (BDT)</span>
                    </Label>

                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-700 font-sans">
                        ৳
                      </span>
                      <Input
                        type="number"
                        min={0}
                        step={10}
                        value={isNaN(actualCash) ? "" : actualCash}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setActualCash(isNaN(val) ? 0 : val);
                        }}
                        className="pl-7 h-8.5 text-xs font-sans font-bold border-neutral-700"
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1.5 border-t border-neutral-400">
                      <span className="text-neutral-700 font-medium">Reconciliation:</span>
                      <span
                        className={`font-black flex items-center gap-1 px-1.5 py-0.5 rounded-xs border text-[11px] ${
                          isBalanced
                            ? "border-black bg-white text-black"
                            : diff > 0
                              ? "border-black bg-neutral-100 text-black"
                              : "border-black bg-neutral-200 text-black font-black"
                        }`}
                      >
                        {isBalanced ? (
                          <>
                            <CheckCircle2 className="size-3 text-black" />
                            <span>Exact Match (৳0)</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="size-3 text-black" />
                            <span>{diff > 0 ? `+৳ ${diff} (Over)` : `-৳ ${Math.abs(diff)} (Short)`}</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Handover Notes */}
                  <div className="space-y-1 bg-white p-2.5 rounded-xs border border-neutral-700">
                    <Label className="text-[10.5px] font-semibold text-neutral-700 font-sans">
                      Shift Handover Notes (যদি থাকে)
                    </Label>
                    <Input
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. 500 BDT float kept for next cashier"
                      className="h-8 text-xs font-sans border-neutral-400"
                    />
                  </div>
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
                    <p className="font-bold text-black">{cashierName}</p>
                    <p className="text-neutral-600 text-[8.5px]">Shift Cashier / গ্রহণকারী</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="h-8"></div>
                  <div className="border-t border-black pt-1">
                    <p className="font-bold text-black">Clinic Supervisor / Manager</p>
                    <p className="text-neutral-600 text-[8.5px]">Verified &amp; Reconciled</p>
                  </div>
                </div>
              </div>

              <p className="text-[8px] text-neutral-500 text-center mt-2 font-mono">
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
            onClick={handlePrint}
            className="gap-1.5 text-xs cursor-pointer w-full sm:w-auto"
          >
            <Printer className="size-3.5" />
            <span>Print Report (5.5″ × 8.125″)</span>
          </Button>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs cursor-pointer flex-1 sm:flex-initial"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleFinalize}
              className="text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white gap-1.5 cursor-pointer shadow-xs flex-1 sm:flex-initial"
            >
              <FileCheck className="size-3.5" />
              <span>Confirm &amp; Close Register</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
