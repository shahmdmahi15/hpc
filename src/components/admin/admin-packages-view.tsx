"use client";

import { useState, useCallback, useTransition, useEffect } from "react";
import { useRealtime } from "@/hooks/use-realtime";
import { getAllPackages, createOrUpdatePackage } from "@/actions/billing";
import { Card, CardContent } from "@/components/ui/card";
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
  Package,
  Plus,
  RefreshCw,
  DollarSign,
  CreditCard,
  Users,
} from "lucide-react";
import { formatBSTDate } from "@/lib/date";

export function AdminPackagesView({
  initialPackages = [],
}: {
  initialPackages?: Awaited<ReturnType<typeof getAllPackages>>;
}) {
  const [packages, setPackages] = useState(initialPackages);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Package Form
  const [form, setForm] = useState({
    patientId: "",
    packageName: "21-30 Days Comprehensive Pain Rehabilitation Package",
    totalDays: 30,
    totalAmount: 13000,
    paidAmount: 10000,
    notes: "21-30 Days comprehensive physiotherapy package course",
  });

  const refreshData = useCallback(() => {
    startTransition(async () => {
      try {
        const updated = await getAllPackages();
        setPackages(updated);
      } catch (err) {
        console.error("Failed to refresh packages", err);
      }
    });
  }, []);

  useEffect(() => {
    if (packages.length === 0) {
      refreshData();
    }
  }, [packages.length, refreshData]);

  useRealtime({
    onRefresh: refreshData,
  });

  const handleCreatePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.patientId) return;

    await createOrUpdatePackage({
      patientId: form.patientId,
      packageName: form.packageName,
      totalDays: Number(form.totalDays),
      totalAmount: Number(form.totalAmount),
      paidAmount: Number(form.paidAmount),
      notes: form.notes,
    });

    setIsModalOpen(false);
    setForm({
      patientId: "",
      packageName: "21-30 Days Comprehensive Pain Rehabilitation Package",
      totalDays: 30,
      totalAmount: 13000,
      paidAmount: 10000,
      notes: "",
    });
    refreshData();
  };

  const totalPaid = packages.reduce(
    (acc, curr) => acc + (curr.paidAmount || 0),
    0,
  );
  const totalDues = packages.reduce((acc, p) => acc + (p.dueAmount || 0), 0);
  const activePackagesCount = packages.filter(
    (p) => p.status === "ACTIVE",
  ).length;

  return (
    <div className="space-y-3 w-full max-w-full min-w-0">
      {/* Metrics Row (Compact & High Density) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5 min-w-0">
        <Card className="p-2 sm:p-2.5 shadow-xs border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase">
              Total Packages
            </span>
            <Package className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-lg sm:text-xl font-black mt-0.5 font-mono text-foreground">
            {packages.length}
          </p>
          <span className="text-[9px] sm:text-[10px] text-muted-foreground block">
            Long-term care plans
          </span>
        </Card>

        <Card className="p-2 sm:p-2.5 shadow-xs border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase">
              Active Packages
            </span>
            <Users className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-lg sm:text-xl font-black mt-0.5 font-mono text-foreground">
            {activePackagesCount}
          </p>
          <span className="text-[9px] sm:text-[10px] text-muted-foreground block">
            Attending daily sessions
          </span>
        </Card>

        <Card className="p-2 sm:p-2.5 shadow-xs border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-semibold text-primary uppercase">
              Paid Advance
            </span>
            <DollarSign className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-lg sm:text-xl font-black mt-0.5 font-mono text-primary">
            ৳{totalPaid.toLocaleString()}
          </p>
          <span className="text-[9px] sm:text-[10px] text-muted-foreground block">
            Collected package installments
          </span>
        </Card>

        <Card className="p-2 sm:p-2.5 shadow-xs border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-semibold text-destructive uppercase">
              Remaining Dues
            </span>
            <CreditCard className="h-3.5 w-3.5 text-destructive" />
          </div>
          <p className="text-lg sm:text-xl font-black mt-0.5 font-mono text-destructive">
            ৳{totalDues.toLocaleString()}
          </p>
          <span className="text-[9px] sm:text-[10px] text-muted-foreground block">
            To be collected during course
          </span>
        </Card>
      </div>

      {/* Control Header & Add Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-card p-1.5 sm:p-2 rounded-xl border border-border shadow-xs max-w-full min-w-0">
        <div>
          <h2 className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5 text-primary" />
            <span>21–30 Days Rehabilitation Package Master</span>
          </h2>
          <p className="text-[11px] text-muted-foreground">
            Manage comprehensive pain treatment packages and installment
            schedules.
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={refreshData}
            className="text-xs h-7 px-2.5 cursor-pointer gap-1"
          >
            <RefreshCw
              className={`h-3 w-3 ${isPending ? "animate-spin text-primary" : ""}`}
            />
            <span>Refresh</span>
          </Button>

          <Button
            size="sm"
            onClick={() => setIsModalOpen(true)}
            className="text-xs h-7 px-2.5 cursor-pointer font-bold bg-primary text-primary-foreground gap-1 shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create Package</span>
          </Button>
        </div>
      </div>

      {/* Packages Table */}
      <Card className="shadow-xs border-border bg-card">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[700px]">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                  <th className="p-2">Patient Name &amp; ID</th>
                  <th className="p-2">Package Program</th>
                  <th className="p-2 text-center">Days / Sessions</th>
                  <th className="p-2 text-right">Total Deal</th>
                  <th className="p-2 text-right">Paid Amount</th>
                  <th className="p-2 text-right">Due Balance</th>
                  <th className="p-2 text-center">Status</th>
                  <th className="p-2 text-right">Created Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {packages.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-12 text-center text-muted-foreground"
                    >
                      No rehabilitation packages created yet. Click &quot;Create
                      21-30 Day Package&quot; above.
                    </td>
                  </tr>
                ) : (
                  packages.map((pkg) => (
                    <tr
                      key={pkg.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="p-3.5">
                        <div className="font-bold text-foreground">
                          {pkg.patient.name}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          ID: #{pkg.patient.patientId} &bull;{" "}
                          {pkg.patient.phone}
                        </div>
                      </td>

                      <td className="p-3.5">
                        <div className="font-semibold text-foreground">
                          {pkg.packageName}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {pkg.notes || "Comprehensive Physiotherapy Course"}
                        </div>
                      </td>

                      <td className="p-3.5 text-center">
                        <Badge
                          variant="outline"
                          className="font-mono text-[10px] border-primary/30 text-primary"
                        >
                          {pkg.totalDays} Days Course
                        </Badge>
                      </td>

                      <td className="p-3.5 text-right font-mono font-medium text-foreground">
                        ৳{pkg.totalAmount.toLocaleString()}
                      </td>

                      <td className="p-3.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        ৳{pkg.paidAmount.toLocaleString()}
                      </td>

                      <td className="p-3.5 text-right font-mono font-bold text-destructive">
                        ৳{pkg.dueAmount.toLocaleString()}
                      </td>

                      <td className="p-3.5 text-center">
                        <Badge
                          variant={
                            pkg.status === "ACTIVE" ? "default" : "secondary"
                          }
                          className="text-[10px] font-bold"
                        >
                          {pkg.status}
                        </Badge>
                      </td>

                      <td className="p-3.5 text-right text-muted-foreground font-mono">
                        {formatBSTDate(pkg.createdAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* DIALOG: Create 21-30 Day Rehabilitation Package */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md bg-card w-[95vw] sm:w-full p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <span>Enroll Patient in 21-30 Day Package</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure long-term physical therapy package with advance payment
              and installment tracking.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreatePackage} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Patient Card ID *</Label>
              <Input
                placeholder="e.g. 1800, 1806, HPC-1800"
                value={form.patientId}
                onChange={(e) =>
                  setForm({ ...form, patientId: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Package Title</Label>
              <Input
                value={form.packageName}
                onChange={(e) =>
                  setForm({ ...form, packageName: e.target.value })
                }
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Total Days</Label>
                <Input
                  type="number"
                  value={form.totalDays}
                  onChange={(e) =>
                    setForm({ ...form, totalDays: Number(e.target.value) })
                  }
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Total Deal (৳)</Label>
                <Input
                  type="number"
                  value={form.totalAmount}
                  onChange={(e) =>
                    setForm({ ...form, totalAmount: Number(e.target.value) })
                  }
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Paid Advance Today (৳)
              </Label>
              <Input
                type="number"
                value={form.paidAmount}
                onChange={(e) =>
                  setForm({ ...form, paidAmount: Number(e.target.value) })
                }
                required
              />
              <span className="text-[10px] text-muted-foreground">
                Calculated Due: ৳
                {Math.max(
                  0,
                  form.totalAmount - form.paidAmount,
                ).toLocaleString()}
              </span>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Prescription Notes
              </Label>
              <Input
                placeholder="SWD, UST, IFT, Massage daily"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="font-bold cursor-pointer bg-primary text-primary-foreground"
              >
                Enroll Package
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
