"use client";

import { useState, useCallback, useTransition } from "react";
import { useRealtime } from "@/hooks/use-realtime";
import { getDailyCashLedger } from "@/actions/billing";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  Package,
  Receipt,
  CreditCard,
  RefreshCw,
} from "lucide-react";
import { formatBSTTime } from "@/lib/date";

interface AdminLedgerViewProps {
  initialLedger: Awaited<ReturnType<typeof getDailyCashLedger>>;
}

export function AdminLedgerView({ initialLedger }: AdminLedgerViewProps) {
  const [ledger, setLedger] = useState(initialLedger);
  const [isPending, startTransition] = useTransition();

  const refreshData = useCallback(() => {
    startTransition(async () => {
      try {
        const updated = await getDailyCashLedger();
        setLedger(updated);
      } catch (err) {
        console.error("Failed to refresh admin billing ledger", err);
      }
    });
  }, []);

  useRealtime({
    onRefresh: refreshData,
  });

  const totalGrossCollected = ledger.reduce(
    (acc, curr) => acc + (curr.paidAmount || 0),
    0,
  );
  const totalRefunded = ledger.reduce(
    (acc, curr) => acc + ((curr as any).refundedAmount || 0),
    0,
  );
  const netCashCollected = Math.max(0, totalGrossCollected - totalRefunded);
  const totalActualBill = ledger.reduce(
    (acc, curr) => acc + (curr.actualBill || 0),
    0,
  );
  const totalDues = ledger.reduce(
    (acc, curr) => acc + (curr.dueAmount || 0),
    0,
  );
  const packageVisits = ledger.filter((item) => item.isPackageCovered).length;

  return (
    <div className="space-y-3 w-full max-w-full min-w-0">
      {/* Financial Overview Cards (Compact & High Density) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-2.5 min-w-0">
        <Card className="p-2 sm:p-2.5 shadow-xs border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase">
              Net Desk Cash
            </span>
            <DollarSign className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-lg sm:text-xl font-black mt-0.5 font-mono text-primary">
            ৳{netCashCollected.toLocaleString()}
          </p>
          <span className="text-[9px] sm:text-[10px] text-muted-foreground block">
            Gross ৳{totalGrossCollected.toLocaleString()}
          </span>
        </Card>

        <Card className="p-2 sm:p-2.5 shadow-xs border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-semibold text-rose-600 dark:text-rose-400 uppercase">
              Total Refunded
            </span>
            <RefreshCw className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
          </div>
          <p className="text-lg sm:text-xl font-black mt-0.5 font-mono text-rose-600 dark:text-rose-400">
            ৳{totalRefunded.toLocaleString()}
          </p>
          <span className="text-[9px] sm:text-[10px] text-muted-foreground block">
            Returned to patients
          </span>
        </Card>

        <Card className="p-2 sm:p-2.5 shadow-xs border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase">
              Assessed Bill
            </span>
            <CreditCard className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-lg sm:text-xl font-black mt-0.5 font-mono text-foreground">
            ৳{totalActualBill.toLocaleString()}
          </p>
          <span className="text-[9px] sm:text-[10px] text-muted-foreground block">
            Total procedures &amp; visits
          </span>
        </Card>

        <Card className="p-2 sm:p-2.5 shadow-xs border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase">
              Non-Payment (N.P)
            </span>
            <Package className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-lg sm:text-xl font-black mt-0.5 font-mono text-foreground">
            {packageVisits}
          </p>
          <span className="text-[9px] sm:text-[10px] text-muted-foreground block">
            Package covered visits
          </span>
        </Card>

        <Card className="p-2 sm:p-2.5 shadow-xs border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase">
              Outstanding Dues
            </span>
            <CreditCard className="h-3.5 w-3.5 text-destructive" />
          </div>
          <p className="text-lg sm:text-xl font-black mt-0.5 font-mono text-destructive">
            ৳{totalDues.toLocaleString()}
          </p>
          <span className="text-[9px] sm:text-[10px] text-muted-foreground block">
            Receivable balances
          </span>
        </Card>
      </div>

      {/* Daily Cash Ledger */}
      <Card className="shadow-xs border-border bg-card">
        <CardHeader className="p-3 pb-2 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xs sm:text-sm font-bold flex items-center gap-1.5">
              <Receipt className="h-4 w-4 text-primary" />
              <span>
                Daily Cash &amp; Payment Ledger (দৈনিক ক্যাশ ও বিলিং লেজার)
              </span>
            </CardTitle>
            <CardDescription className="text-[11px]">
              Realtime record of desk receipts, payment methods, package claims,
              and refunds.
            </CardDescription>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={refreshData}
              className="h-7 text-xs cursor-pointer gap-1 px-2.5"
            >
              <RefreshCw
                className={`h-3 w-3 ${isPending ? "animate-spin text-primary" : ""}`}
              />
              <span>Refresh</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 px-2 sm:px-4 pb-3">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[700px]">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                  <th className="p-2">Time &amp; Token</th>
                  <th className="p-2">Patient Name &amp; ID</th>
                  <th className="p-2">Service / Modality</th>
                  <th className="p-2 text-right">Actual Bill</th>
                  <th className="p-2 text-right">Cash Received</th>
                  <th className="p-2 text-right">Due / N.P Status</th>
                  <th className="p-2">Cashier</th>
                  <th className="p-2 text-right">Payment Method</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {ledger.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-12 text-center text-muted-foreground"
                    >
                      No billing entries recorded for today yet.
                    </td>
                  </tr>
                ) : (
                  ledger.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="p-3 font-mono">
                        <div className="font-semibold text-foreground">
                          {item.serial?.serialNumber
                            ? `#${item.serial.serialNumber}`
                            : "Direct Desk"}
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {formatBSTTime(item.createdAt)}
                        </span>
                      </td>

                      <td className="p-3">
                        <div className="font-bold text-foreground">
                          {item.patient.name}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          ID: #{item.patient.patientId} &bull;{" "}
                          {item.patient.phone}
                        </div>
                      </td>

                      <td className="p-3">
                        <span className="text-muted-foreground">
                          {item.notes || "Physiotherapy Session"}
                        </span>
                        {item.package && (
                          <Badge
                            variant="outline"
                            className="ml-1 text-[9px] border-primary/30 text-primary"
                          >
                            Package
                          </Badge>
                        )}
                      </td>

                      <td className="p-3 text-right font-mono font-medium text-foreground">
                        ৳{item.actualBill.toLocaleString()}
                      </td>

                      <td className="p-3 text-right font-mono">
                        {(item as any).refundedAmount > 0 ? (
                          <div>
                            <div className="text-muted-foreground line-through text-[11px]">
                              ৳{item.paidAmount.toLocaleString()}
                            </div>
                            <div className="text-[11px] font-black text-rose-600 dark:text-rose-400">
                              -৳{(item as any).refundedAmount.toLocaleString()}{" "}
                              (Refund)
                            </div>
                            <div className="text-xs font-black text-primary">
                              Net: ৳
                              {Math.max(
                                0,
                                item.paidAmount -
                                  ((item as any).refundedAmount || 0),
                              ).toLocaleString()}
                            </div>
                          </div>
                        ) : (
                          <span className="font-bold text-primary">
                            ৳{item.paidAmount.toLocaleString()}
                          </span>
                        )}
                      </td>

                      <td className="p-3 text-right">
                        {(item as any).paymentStatus === "REFUNDED" ? (
                          <Badge
                            variant="destructive"
                            className="text-[10px] font-bold"
                          >
                            REFUNDED
                          </Badge>
                        ) : (item as any).paymentStatus ===
                          "PARTIALLY_REFUNDED" ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-bold border-amber-500/40 text-amber-600"
                          >
                            PART. REFUND
                          </Badge>
                        ) : item.isPackageCovered ? (
                          <Badge
                            variant="secondary"
                            className="text-[10px] font-bold bg-muted"
                          >
                            N.P (Package Covered)
                          </Badge>
                        ) : item.dueAmount > 0 ? (
                          <span className="font-mono font-bold text-destructive">
                            ৳{item.dueAmount.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                            PAID
                          </span>
                        )}
                      </td>

                      <td className="p-3 text-muted-foreground">
                        {item.cashier?.name || "Reception Desk"}
                      </td>

                      <td className="p-3 text-right">
                        <Badge
                          variant="outline"
                          className="text-[10px] font-mono font-semibold"
                        >
                          {item.paymentMethod || "CASH"}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
