"use client";

import { useState, useCallback, useTransition } from "react";
import { useRealtime } from "@/hooks/use-realtime";
import { getDailyCashLedger, createOrUpdatePackage } from "@/actions/billing";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ShieldCheck,
  DollarSign,
  Package,
  CheckCircle2,
  CreditCard,
  Plus,
  RefreshCw,
  DoorOpen,
} from "lucide-react";
import { RoomManagementPanel } from "@/components/admin/room-management-panel";

interface AdminWorkspaceProps {
  initialLedger: Awaited<ReturnType<typeof getDailyCashLedger>>;
}

export function AdminWorkspace({ initialLedger }: AdminWorkspaceProps) {
  const [ledger, setLedger] = useState(initialLedger);
  const [activeTab, setActiveTab] = useState<"ledger" | "rooms">("ledger");
  const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Package Form (Pages 3 & 4 of PDF 2)
  const [pkgForm, setPkgForm] = useState({
    patientId: "",
    packageName: "21-30 Days Comprehensive Pain Rehabilitation Package",
    totalDays: 30,
    totalAmount: 13000,
    paidAmount: 10000,
    notes: "21-30 Days therapy course with SWD, UST, IFT, Massage",
  });

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

  const handleCreatePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pkgForm.patientId) return;

    await createOrUpdatePackage({
      patientId: pkgForm.patientId,
      packageName: pkgForm.packageName,
      totalDays: Number(pkgForm.totalDays),
      totalAmount: Number(pkgForm.totalAmount),
      paidAmount: Number(pkgForm.paidAmount),
      notes: pkgForm.notes,
    });

    setIsPackageModalOpen(false);
    setPkgForm({
      patientId: "",
      packageName: "21-30 Days Comprehensive Pain Rehabilitation Package",
      totalDays: 30,
      totalAmount: 13000,
      paidAmount: 10000,
      notes: "",
    });
    refreshData();
  };

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
    <div className="space-y-6">
      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-4 shadow-sm border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase">
              Net Desk Cash
            </span>
            <DollarSign className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-bold mt-2 font-mono text-primary">
            ৳{netCashCollected.toLocaleString()}
          </p>
          <span className="text-[11px] text-muted-foreground mt-1">
            Gross ৳{totalGrossCollected.toLocaleString()}
          </span>
        </Card>

        <Card className="p-4 shadow-sm border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase">
              Total Refunded
            </span>
            <RefreshCw className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          </div>
          <p className="text-2xl font-bold mt-2 font-mono text-rose-600 dark:text-rose-400">
            ৳{totalRefunded.toLocaleString()}
          </p>
          <span className="text-[11px] text-muted-foreground mt-1">
            Returned to patients
          </span>
        </Card>

        <Card className="p-4 shadow-sm border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase">
              Assessed Bill
            </span>
            <CreditCard className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-bold mt-2 font-mono text-foreground">
            ৳{totalActualBill.toLocaleString()}
          </p>
          <span className="text-[11px] text-muted-foreground mt-1">
            Total procedures &amp; visits
          </span>
        </Card>

        <Card className="p-4 shadow-sm border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase">
              Non-Payment Visits (N.P)
            </span>
            <Package className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-bold mt-2 font-mono text-foreground">
            {packageVisits}
          </p>
          <span className="text-[11px] text-muted-foreground mt-1">
            Package covered visits
          </span>
        </Card>

        <Card className="p-4 shadow-sm border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase">
              Outstanding Dues
            </span>
            <CreditCard className="h-4 w-4 text-destructive" />
          </div>
          <p className="text-2xl font-bold mt-2 font-mono text-destructive">
            ৳{totalDues.toLocaleString()}
          </p>
          <span className="text-[11px] text-muted-foreground mt-1">
            Receivable balances
          </span>
        </Card>
      </div>

      {/* Navigation Tab Bar */}
      <div className="flex items-center gap-2 bg-card p-2 rounded-2xl border border-border shadow-xs">
        <button
          onClick={() => setActiveTab("ledger")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === "ledger"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground bg-muted/60"
          }`}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Daily Cash Ledger &amp; Packages</span>
        </button>

        <button
          onClick={() => setActiveTab("rooms")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === "rooms"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground bg-muted/60"
          }`}
        >
          <DoorOpen className="h-3.5 w-3.5" />
          <span>Chambers &amp; Rooms Management</span>
        </button>
      </div>

      {activeTab === "rooms" ? (
        <RoomManagementPanel />
      ) : (
        /* CEO Audit Daily Cash Ledger */
        <Card className="shadow-md border-border bg-card">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span>CEO Daily Cash Ledger Audit &amp; Sign-off</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Review and grant CEO audit approval on daily cashier receipts
                matching the physical ledger.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setIsPackageModalOpen(true)}
                className="h-8 text-xs font-bold gap-1.5 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create 21-30 Day Package</span>
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={refreshData}
                title="Refresh Ledger"
                className="h-8 w-8 cursor-pointer"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isPending ? "animate-spin text-primary" : ""}`}
                />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="pb-3 font-semibold w-12">SL NO</th>
                    <th className="pb-3 font-semibold">
                      PATIENT NAME &amp; ID
                    </th>
                    <th className="pb-3 font-semibold">A. BILL</th>
                    <th className="pb-3 font-semibold">PAY. BILL</th>
                    <th className="pb-3 font-semibold">DUE</th>
                    <th className="pb-3 font-semibold">CASHIER</th>
                    <th className="pb-3 font-semibold text-right">METHOD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {ledger.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-8 text-center text-muted-foreground"
                      >
                        No cashier billing records for today yet.
                      </td>
                    </tr>
                  ) : (
                    ledger.map((item, idx) => (
                      <tr
                        key={item.id}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-3 font-mono font-bold text-muted-foreground">
                          {String(idx + 1).padStart(2, "0")}.
                        </td>
                        <td className="py-3">
                          <div className="font-bold text-foreground">
                            {item.patient.name}
                          </div>
                          <div className="text-[11px] text-muted-foreground font-mono">
                            ID: #{item.patient.patientId}
                          </div>
                        </td>
                        <td className="py-3 font-mono text-muted-foreground">
                          ৳{item.actualBill}
                        </td>
                        <td className="py-3 font-mono font-bold">
                          {item.isPackageCovered ? (
                            <Badge variant="secondary" className="text-[10px]">
                              N.P (Package Covered)
                            </Badge>
                          ) : (item as any).refundedAmount > 0 ? (
                            <div>
                              <div className="text-muted-foreground line-through text-[11px]">
                                ৳{item.paidAmount}
                              </div>
                              <div className="text-[11px] font-black text-rose-600 dark:text-rose-400">
                                -৳{(item as any).refundedAmount} (Refund)
                              </div>
                              <div className="text-xs font-black text-primary">
                                Net: ৳
                                {Math.max(
                                  0,
                                  item.paidAmount -
                                    ((item as any).refundedAmount || 0),
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-primary text-sm font-bold">
                              ৳{item.paidAmount}
                            </span>
                          )}
                        </td>
                        <td className="py-3 font-mono text-destructive font-semibold">
                          {item.dueAmount > 0 ? `৳${item.dueAmount}` : "-"}
                        </td>
                        <td className="py-3 text-muted-foreground">
                          {item.cashier?.name || "Front Desk"}
                        </td>
                        <td className="py-3 text-right">
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
      )}

      {/* DIALOG: Create 21-30 Day Rehabilitation Package */}
      <Dialog open={isPackageModalOpen} onOpenChange={setIsPackageModalOpen}>
        <DialogContent className="sm:max-w-lg bg-card">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <span>Create 21–30 Day Patient Package</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Matching HPC Physical Package Billing Card (e.g. 10,000/- or
              20,000/- for 21-30 days).
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={handleCreatePackage}
            className="space-y-4 pt-1 text-xs"
          >
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Patient 4-Digit ID * (e.g. 1800)
              </Label>
              <Input
                required
                value={pkgForm.patientId}
                onChange={(e) =>
                  setPkgForm({ ...pkgForm, patientId: e.target.value })
                }
                placeholder="1800"
                className="font-mono font-bold"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Package Name</Label>
              <Input
                value={pkgForm.packageName}
                onChange={(e) =>
                  setPkgForm({ ...pkgForm, packageName: e.target.value })
                }
                placeholder="21-30 Days Pain Care Rehabilitation"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Total Days</Label>
                <Input
                  type="number"
                  value={pkgForm.totalDays}
                  onChange={(e) =>
                    setPkgForm({
                      ...pkgForm,
                      totalDays: parseInt(e.target.value),
                    })
                  }
                  placeholder="30"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Total Bill (৳)</Label>
                <Input
                  type="number"
                  value={pkgForm.totalAmount}
                  onChange={(e) =>
                    setPkgForm({
                      ...pkgForm,
                      totalAmount: parseFloat(e.target.value),
                    })
                  }
                  placeholder="13000"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Advance Paid (৳)
                </Label>
                <Input
                  type="number"
                  value={pkgForm.paidAmount}
                  onChange={(e) =>
                    setPkgForm({
                      ...pkgForm,
                      paidAmount: parseFloat(e.target.value),
                    })
                  }
                  placeholder="10000"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Package Modalities &amp; Notes
              </Label>
              <Input
                value={pkgForm.notes}
                onChange={(e) =>
                  setPkgForm({ ...pkgForm, notes: e.target.value })
                }
                placeholder="Includes daily SWD, UST, IFT &amp; Manual Therapy"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsPackageModalOpen(false)}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button type="submit" className="font-bold cursor-pointer">
                Issue Package Card
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
