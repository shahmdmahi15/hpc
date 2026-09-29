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
    window.print();
  };

  const handleFinalize = () => {
    toast.success("Shift register reconciled and closed successfully!");
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-2xl md:max-w-3xl p-0 overflow-hidden bg-background border-border/80 shadow-2xl rounded-2xl">
        <DialogHeader className="p-4 sm:p-5 border-b border-border/60 bg-muted/20">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Calculator className="size-4 text-amber-500" />
              <span>Daily Shift Closeout &amp; Cash Reconciliation</span>
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="p-4 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Printable Register Sheet */}
          <div
            id="register-closeout-print"
            className="p-4 sm:p-5 rounded-xl border border-border/80 bg-card space-y-4 text-xs"
          >
            {/* Header */}
            <div className="text-center pb-3 border-b border-border/60">
              <h3 className="font-extrabold text-sm uppercase text-foreground">
                Daily Register Closeout Report
              </h3>
              <p className="text-[10.5px] text-muted-foreground mt-0.5 font-mono">
                Date: {selectedDate} • Shift Cashier: {cashierName}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Column: System Breakdown */}
              <div className="space-y-2 py-1 text-xs bg-muted/20 p-3.5 rounded-xl border border-border/60">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  System Recorded Collections
                </p>
                <div className="flex justify-between items-center text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Banknote className="size-3.5 text-emerald-500" />
                    <span>Cash Collections:</span>
                  </span>
                  <span className="font-bold text-foreground font-mono">
                    ৳{stats.cashCollected.toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between items-center text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <CreditCard className="size-3.5 text-blue-500" />
                    <span>Card POS:</span>
                  </span>
                  <span className="font-bold text-foreground font-mono">
                    ৳{stats.cardCollected.toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between items-center text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Smartphone className="size-3.5 text-purple-500" />
                    <span>MFS (bKash/Nagad):</span>
                  </span>
                  <span className="font-bold text-foreground font-mono">
                    ৳{stats.mfsCollected.toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-border/60 font-bold text-sm">
                  <span>Total Settled:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                    ৳{stats.totalCollected.toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between items-center text-[10.5px] text-muted-foreground pt-1">
                  <span>Settled Tickets:</span>
                  <span className="font-semibold">{stats.paidCount} receipts</span>
                </div>
              </div>

              {/* Right Column: Cash Drawer Counting & Handover Notes */}
              <div className="space-y-3.5">
                {/* Cash Drawer Counting Input */}
                <div className="p-3.5 rounded-xl bg-muted/30 border border-border/70 space-y-2.5">
                  <Label className="text-xs font-bold text-foreground flex items-center gap-1.5 font-sans">
                    <Banknote className="size-3.5 text-amber-500" />
                    <span>Counted Physical Cash in Drawer (BDT)</span>
                  </Label>

                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
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
                      className="pl-7 h-9 text-xs font-mono font-bold"
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
                    <span className="text-muted-foreground font-medium">Reconciliation:</span>
                    <span
                      className={`font-bold flex items-center gap-1 ${
                        isBalanced
                          ? "text-emerald-600 dark:text-emerald-400"
                          : diff > 0
                            ? "text-sky-600 dark:text-sky-400"
                            : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {isBalanced ? (
                        <>
                          <CheckCircle2 className="size-3.5 text-emerald-500" />
                          <span>Exact Match (৳0)</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="size-3.5" />
                          <span>{diff > 0 ? `+৳${diff} (Over)` : `-৳${Math.abs(diff)} (Short)`}</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>

                {/* Handover Notes */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground font-sans">
                    Shift Handover Notes (Optional)
                  </Label>
                  <Input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. 500 BDT cash kept in float for next shift"
                    className="h-9 text-xs font-sans"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="p-3 border-t border-border/60 bg-muted/20 flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="gap-1.5 text-xs cursor-pointer"
          >
            <Printer className="size-3.5" />
            <span>Print Report</span>
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleFinalize}
              className="text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white gap-1.5 cursor-pointer shadow-xs"
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
