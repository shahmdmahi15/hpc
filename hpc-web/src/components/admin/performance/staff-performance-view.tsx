"use client";

import * as React from "react";
import {
  Award,
  Stethoscope,
  UserCheck,
  Receipt,
  Activity,
  TrendingUp,
  Clock,
  CircleDollarSign,
  Pill,
  Calendar,
  Printer,
  Download,
  RefreshCw,
  Search,
  Wallet,
  CreditCard,
  Layers,
  ArrowUpRight,
  CheckCircle2,
  Phone,
  Mail,
  Flame,
  FileSpreadsheet,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  getStaffPerformanceReportAction,
  type StaffPerformanceReportData,
  type PerformanceFilter,
  type DoctorPerformanceMetric,
  type ReceptionistPerformanceMetric,
  type CashierPerformanceMetric,
  type HandlerPerformanceMetric,
} from "@/actions/admin/performance.action";
import { StaffPerformancePrintDialog } from "./staff-performance-print-dialog";

interface StaffPerformanceViewProps {
  initialData: StaffPerformanceReportData;
}

export function StaffPerformanceView({ initialData }: StaffPerformanceViewProps) {
  const [data, setData] = React.useState<StaffPerformanceReportData>(initialData);
  const [filter, setFilter] = React.useState<PerformanceFilter>(
    initialData.summary.filter || "today",
  );
  const [customStart, setCustomStart] = React.useState<string>(
    initialData.summary.startDateStr !== "All Time"
      ? initialData.summary.startDateStr
      : "",
  );
  const [customEnd, setCustomEnd] = React.useState<string>(
    initialData.summary.endDateStr || "",
  );
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [activeTab, setActiveTab] = React.useState<string>("all");
  const [isRefreshing, setIsRefreshing] = React.useState<boolean>(false);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = React.useState<boolean>(false);

  // Fetch report
  const fetchReport = React.useCallback(
    async (
      selectedFilter: PerformanceFilter,
      startDate?: string,
      endDate?: string,
    ) => {
      setIsRefreshing(true);
      try {
        const res = await getStaffPerformanceReportAction({
          filter: selectedFilter,
          startDate: selectedFilter === "custom" ? startDate : undefined,
          endDate: selectedFilter === "custom" ? endDate : undefined,
        });

        if (res.success && res.data) {
          setData(res.data);
          toast.success(`Performance telemetry updated: ${res.data.summary.dateRangeLabel}`);
        } else {
          toast.error(res.error || "Failed to load performance metrics.");
        }
      } catch (err: any) {
        toast.error(err?.message || "Error fetching performance report.");
      } finally {
        setIsRefreshing(false);
      }
    },
    [],
  );

  // Quick filter buttons
  const handleFilterClick = (newFilter: PerformanceFilter) => {
    setFilter(newFilter);
    void fetchReport(newFilter);
  };

  const handleApplyCustomFilter = () => {
    if (!customStart || !customEnd) {
      toast.error("Please specify both start and end date.");
      return;
    }
    setFilter("custom");
    void fetchReport("custom", customStart, customEnd);
  };

  // Export report to JSON / CSV
  const handleExportCSV = () => {
    try {
      const rows: string[] = [
        "Department,Staff Name,Role,Metric 1,Metric 2,Metric 3,Earnings / BDT,Unique Patients",
      ];

      // Doctors
      data.doctors.forEach((doc) => {
        rows.push(
          `"Doctor","${doc.name}","Doctor","Consultations: ${doc.totalConsultations}","Prescriptions: ${doc.prescriptionsWritten}","Avg Time: ${doc.avgConsultationMinutes}m","৳${doc.totalEarningsBDT}","${doc.uniquePatientsCount}"`,
        );
      });

      // Receptionists
      data.receptionists.forEach((rec) => {
        rows.push(
          `"Reception","${rec.name}","Receptionist","Check-ins: ${rec.totalCheckIns}","Bookings: ${rec.totalBookings}","Serials: ${rec.consultationSerialsIssued}","৳0","${rec.uniquePatientsHandled}"`,
        );
      });

      // Cashiers
      data.cashiers.forEach((cash) => {
        rows.push(
          `"Cashier","${cash.name}","Cashier","Invoices: ${cash.invoicesCleared}","Tx: ${cash.totalTransactionsCount}","Due Marked: ৳${cash.totalDueMarkedBDT}","৳${cash.totalCollectedBDT}","${cash.uniquePatientsBilled}"`,
        );
      });

      // Handlers
      data.handlers.forEach((h) => {
        rows.push(
          `"Handler","${h.name}","Handler","Sessions: ${h.therapySessionsCompleted}","Bed Minutes: ${h.totalBedMinutes}","Avg Time: ${h.avgSessionMinutes}m","৳0","${h.uniquePatientsTreated}"`,
        );
      });

      const csvContent =
        "data:text/csv;charset=utf-8," + encodeURIComponent(rows.join("\n"));
      const link = document.createElement("a");
      link.setAttribute("href", csvContent);
      link.setAttribute(
        "download",
        `HPC_Staff_Performance_${data.summary.startDateStr}_${data.summary.endDateStr}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Staff performance CSV downloaded!");
    } catch {
      toast.error("Failed to export performance CSV.");
    }
  };

  // Filtered staff list by query
  const q = searchQuery.toLowerCase().trim();

  const filteredDoctors = data.doctors.filter(
    (d) =>
      !q ||
      d.name.toLowerCase().includes(q) ||
      (d.email && d.email.toLowerCase().includes(q)) ||
      (d.whatsapp && d.whatsapp.includes(q)),
  );

  const filteredReceptionists = data.receptionists.filter(
    (r) =>
      !q ||
      r.name.toLowerCase().includes(q) ||
      r.phone.includes(q) ||
      r.whatsapp.includes(q),
  );

  const filteredCashiers = data.cashiers.filter(
    (c) =>
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      c.whatsapp.includes(q),
  );

  const filteredHandlers = data.handlers.filter(
    (h) =>
      !q ||
      h.name.toLowerCase().includes(q) ||
      h.phone.includes(q) ||
      h.whatsapp.includes(q),
  );

  return (
    <div className="space-y-4 print:space-y-3">
      {/* ---------------------------------------------------- */}
      {/* Print-Only Clinic Header                             */}
      {/* ---------------------------------------------------- */}
      <div className="hidden print:block border-b border-black pb-3 text-center">
        <h1 className="text-xl font-bold uppercase tracking-wider text-black">
          Health &amp; Pain Care Center
        </h1>
        <p className="text-xs text-gray-700">
          Executive Staff &amp; Performer Performance Telemetry Report
        </p>
        <p className="text-xs text-gray-800 font-semibold mt-1">
          Period: {data.summary.dateRangeLabel} • Generated:{" "}
          {new Date().toLocaleString("en-BD", { timeZone: "Asia/Dhaka" })}
        </p>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 1. Interactive Control Header                        */}
      {/* ---------------------------------------------------- */}
      <div className="print:hidden rounded-2xl border border-border/80 bg-gradient-to-r from-card via-card/95 to-primary/5 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold">
                <Award className="size-3.5" />
                Performance Telemetry
              </span>
              <span className="text-xs text-muted-foreground font-mono font-semibold">
                {data.summary.dateRangeLabel}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">
              Clinical Staff &amp; Performer Analytics
            </h1>
            <p className="text-xs text-muted-foreground max-w-2xl">
              Comprehensive doctor earnings, consultation durations, top prescribed medicines, front desk bookings, cashier payment collections, and handler bed utilization.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPrintDialogOpen(true)}
              className="gap-1.5 text-xs font-semibold shadow-xs cursor-pointer"
            >
              <Printer className="size-3.5 text-primary" />
              <span>Print Dossier</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="gap-1.5 text-xs font-semibold shadow-xs cursor-pointer"
            >
              <FileSpreadsheet className="size-3.5 text-emerald-600" />
              <span>Export CSV</span>
            </Button>

            <Button
              variant="default"
              size="sm"
              disabled={isRefreshing}
              onClick={() => fetchReport(filter, customStart, customEnd)}
              className="gap-1.5 text-xs font-semibold shadow-xs cursor-pointer"
            >
              <RefreshCw
                className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`}
              />
              <span>Refresh</span>
            </Button>
          </div>
        </div>

        {/* Date Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border/50">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-muted-foreground flex items-center gap-1 mr-1">
              <Calendar className="size-3.5" />
              Preset:
            </span>
            {(
              [
                { id: "today", label: "Today" },
                { id: "yesterday", label: "Yesterday" },
                { id: "7d", label: "Last 7 Days" },
                { id: "30d", label: "Last 30 Days" },
                { id: "this_month", label: "This Month" },
                { id: "all", label: "All Time" },
              ] as const
            ).map((p) => (
              <Button
                key={p.id}
                variant={filter === p.id ? "default" : "outline"}
                size="xs"
                onClick={() => handleFilterClick(p.id)}
                className="h-7 text-xs font-semibold rounded-lg cursor-pointer"
              >
                {p.label}
              </Button>
            ))}
          </div>

          {/* Custom Date Form */}
          <div className="flex items-center gap-1.5">
            <Input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="h-7 w-32 text-xs font-mono"
            />
            <span className="text-xs text-muted-foreground font-semibold">to</span>
            <Input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="h-7 w-32 text-xs font-mono"
            />
            <Button
              size="xs"
              variant="secondary"
              onClick={handleApplyCustomFilter}
              className="h-7 text-xs font-semibold cursor-pointer"
            >
              Apply
            </Button>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 2. Four Department Executive KPI Cards               */}
      {/* ---------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Doctors */}
        <Card className="border-border/80 bg-card shadow-xs border-l-4 border-l-sky-500">
          <CardHeader className="pb-1.5 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Stethoscope className="size-3.5 text-sky-500" />
              <span>Doctors Console</span>
            </CardTitle>
            <div className="size-7 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-600 dark:text-sky-400">
              <Award className="size-3.5" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-black text-foreground">
              ৳{data.summary.totalDoctorEarningsBDT.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground flex items-center justify-between font-medium pt-1">
              <span>{data.summary.totalDoctorConsultations} Consultations</span>
              <span>{data.summary.totalPrescriptions} Prescriptions</span>
            </div>
            <p className="text-[11px] text-muted-foreground font-medium text-sky-600 dark:text-sky-400">
              {data.summary.totalDoctorsActive} Doctors Active in Period
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Reception */}
        <Card className="border-border/80 bg-card shadow-xs border-l-4 border-l-blue-500">
          <CardHeader className="pb-1.5 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <UserCheck className="size-3.5 text-blue-500" />
              <span>Reception Desk</span>
            </CardTitle>
            <div className="size-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <CheckCircle2 className="size-3.5" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-black text-foreground">
              {data.summary.totalReceptionCheckIns.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground flex items-center justify-between font-medium pt-1">
              <span>{data.summary.totalReceptionBookings} Bookings</span>
              <span>Front Desk Speed</span>
            </div>
            <p className="text-[11px] text-muted-foreground font-medium text-blue-600 dark:text-blue-400">
              Patient Check-ins Handled
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Cashier */}
        <Card className="border-border/80 bg-card shadow-xs border-l-4 border-l-amber-500">
          <CardHeader className="pb-1.5 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Receipt className="size-3.5 text-amber-500" />
              <span>Cashier Register</span>
            </CardTitle>
            <div className="size-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <CircleDollarSign className="size-3.5" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-black text-foreground">
              ৳{data.summary.totalCashierCollectedBDT.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground flex items-center justify-between font-medium pt-1">
              <span>{data.summary.totalCashierInvoicesCleared} Cleared</span>
              <span className="text-amber-600 font-bold">
                ৳{data.summary.totalCashierDueMarkedBDT.toLocaleString()} Due
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground font-medium text-amber-600 dark:text-amber-400">
              Total Revenue Collected
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Handler */}
        <Card className="border-border/80 bg-card shadow-xs border-l-4 border-l-emerald-500">
          <CardHeader className="pb-1.5 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="size-3.5 text-emerald-500" />
              <span>Therapy Floor</span>
            </CardTitle>
            <div className="size-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Clock className="size-3.5" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-black text-foreground">
              {data.summary.totalHandlerTherapySessions.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground flex items-center justify-between font-medium pt-1">
              <span>{data.summary.totalHandlerBedMinutes} Bed Minutes</span>
              <span>Machine Runs</span>
            </div>
            <p className="text-[11px] text-muted-foreground font-medium text-emerald-600 dark:text-emerald-400">
              Therapy Sessions Completed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 3. Clinic-Wide Top Insights (Medicines & Modalities) */}
      {/* ---------------------------------------------------- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* Top Medicines */}
        <Card className="border-border/80 bg-card shadow-xs">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="size-7 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-600">
                <Pill className="size-3.5" />
              </div>
              <div>
                <CardTitle className="text-xs font-bold text-foreground">
                  Top Prescribed Medicines Clinic-Wide
                </CardTitle>
                <CardDescription className="text-[11px]">
                  Most frequently prescribed pharmaceuticals in this period
                </CardDescription>
              </div>
            </div>
            <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-muted border border-border">
              {data.summary.topMedicinesClinicWide.length} Items
            </span>
          </CardHeader>
          <CardContent className="pt-1">
            {data.summary.topMedicinesClinicWide.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3 text-center">
                No prescription medicines recorded in this timeframe.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {data.summary.topMedicinesClinicWide.map((med, idx) => (
                  <div
                    key={med.name}
                    className="p-2 rounded-xl border border-border/60 bg-muted/20 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="size-5 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-300 font-bold text-[10px] flex items-center justify-center shrink-0">
                        #{idx + 1}
                      </span>
                      <span className="font-semibold text-foreground truncate">
                        {med.name}
                      </span>
                    </div>
                    <span className="px-1.5 py-0.2 rounded-md bg-purple-500/10 text-purple-700 dark:text-purple-300 font-bold font-mono text-[10px] shrink-0">
                      {med.count}x
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Modalities */}
        <Card className="border-border/80 bg-card shadow-xs">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="size-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                <Flame className="size-3.5" />
              </div>
              <div>
                <CardTitle className="text-xs font-bold text-foreground">
                  Top Utilized Therapy Modalities
                </CardTitle>
                <CardDescription className="text-[11px]">
                  Most frequent physical therapy machines and clinical procedures
                </CardDescription>
              </div>
            </div>
            <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-muted border border-border">
              {data.summary.topModalitiesClinicWide.length} Modalities
            </span>
          </CardHeader>
          <CardContent className="pt-1">
            {data.summary.topModalitiesClinicWide.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3 text-center">
                No therapy modalities recorded in this timeframe.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {data.summary.topModalitiesClinicWide.map((mod, idx) => (
                  <div
                    key={mod.name}
                    className="p-2 rounded-xl border border-border/60 bg-muted/20 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="size-5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] flex items-center justify-center shrink-0">
                        #{idx + 1}
                      </span>
                      <span className="font-semibold text-foreground truncate">
                        {mod.name}
                      </span>
                    </div>
                    <span className="px-1.5 py-0.2 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold font-mono text-[10px] shrink-0">
                      {mod.count}x
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 4. Detailed Department Performance Tabs             */}
      {/* ---------------------------------------------------- */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 print:hidden">
          <TabsList className="bg-muted/50 p-1 rounded-xl h-auto border border-border/60 inline-flex items-center gap-1">
            <TabsTrigger
              value="all"
              className="text-xs font-bold h-7 px-3 gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-xs cursor-pointer"
            >
              <Layers className="size-3.5" />
              <span>All Staff</span>
            </TabsTrigger>

            <TabsTrigger
              value="doctors"
              className="text-xs font-bold h-7 px-3 gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-xs cursor-pointer"
            >
              <Stethoscope className="size-3.5 text-sky-500" />
              <span>Doctors ({data.doctors.length})</span>
            </TabsTrigger>

            <TabsTrigger
              value="reception"
              className="text-xs font-bold h-7 px-3 gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-xs cursor-pointer"
            >
              <UserCheck className="size-3.5 text-blue-500" />
              <span>Reception ({data.receptionists.length})</span>
            </TabsTrigger>

            <TabsTrigger
              value="cashier"
              className="text-xs font-bold h-7 px-3 gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-xs cursor-pointer"
            >
              <Receipt className="size-3.5 text-amber-500" />
              <span>Cashier ({data.cashiers.length})</span>
            </TabsTrigger>

            <TabsTrigger
              value="handlers"
              className="text-xs font-bold h-7 px-3 gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-xs cursor-pointer"
            >
              <Activity className="size-3.5 text-emerald-500" />
              <span>Handlers ({data.handlers.length})</span>
            </TabsTrigger>
          </TabsList>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search staff by name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs rounded-xl"
            />
          </div>
        </div>

        {/* ---------------------------------------------------- */}
        {/* TAB 1: ALL STAFF OVERVIEW                            */}
        {/* ---------------------------------------------------- */}
        <TabsContent value="all" className="space-y-4">
          {/* Doctors Section in All */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Stethoscope className="size-3.5 text-sky-500" />
              <span>Physicians &amp; Consulting Doctors</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredDoctors.map((doc) => (
                <DoctorPerformanceCard key={doc.doctorId} doctor={doc} />
              ))}
            </div>
          </div>

          {/* Cashiers Section in All */}
          <div className="space-y-2 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Receipt className="size-3.5 text-amber-500" />
              <span>Cashier Desk Performers</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredCashiers.map((c) => (
                <CashierPerformanceCard key={c.performerId} cashier={c} />
              ))}
            </div>
          </div>

          {/* Handlers Section in All */}
          <div className="space-y-2 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Activity className="size-3.5 text-emerald-500" />
              <span>Therapy Handlers &amp; Assistants</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredHandlers.map((h) => (
                <HandlerPerformanceCard key={h.performerId} handler={h} />
              ))}
            </div>
          </div>

          {/* Receptionists Section in All */}
          <div className="space-y-2 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <UserCheck className="size-3.5 text-blue-500" />
              <span>Front Desk Receptionists</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredReceptionists.map((r) => (
                <ReceptionistPerformanceCard key={r.performerId} receptionist={r} />
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ---------------------------------------------------- */}
        {/* TAB 2: DOCTORS ONLY                                  */}
        {/* ---------------------------------------------------- */}
        <TabsContent value="doctors" className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredDoctors.map((doc) => (
              <DoctorPerformanceCard key={doc.doctorId} doctor={doc} />
            ))}
          </div>
        </TabsContent>

        {/* ---------------------------------------------------- */}
        {/* TAB 3: RECEPTION ONLY                                */}
        {/* ---------------------------------------------------- */}
        <TabsContent value="reception" className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredReceptionists.map((r) => (
              <ReceptionistPerformanceCard key={r.performerId} receptionist={r} />
            ))}
          </div>
        </TabsContent>

        {/* ---------------------------------------------------- */}
        {/* TAB 4: CASHIER ONLY                                  */}
        {/* ---------------------------------------------------- */}
        <TabsContent value="cashier" className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredCashiers.map((c) => (
              <CashierPerformanceCard key={c.performerId} cashier={c} />
            ))}
          </div>
        </TabsContent>

        {/* ---------------------------------------------------- */}
        {/* TAB 5: HANDLERS ONLY                                 */}
        {/* ---------------------------------------------------- */}
        <TabsContent value="handlers" className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredHandlers.map((h) => (
              <HandlerPerformanceCard key={h.performerId} handler={h} />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <StaffPerformancePrintDialog
        isOpen={isPrintDialogOpen}
        onOpenChange={setIsPrintDialogOpen}
        data={data}
      />
    </div>
  );
}

// --------------------------------------------------------
// SUB-CARD: DOCTOR PERFORMANCE
// --------------------------------------------------------
function DoctorPerformanceCard({ doctor }: { doctor: DoctorPerformanceMetric }) {
  return (
    <Card className="border-border/80 bg-card shadow-xs hover:border-sky-500/40 transition-all">
      <CardHeader className="pb-2 border-b border-border/50">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-bold text-foreground">
              Dr. {doctor.name}
            </CardTitle>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
              {doctor.whatsapp && (
                <span className="flex items-center gap-1 font-mono">
                  <Phone className="size-3 text-emerald-500" />
                  {doctor.whatsapp}
                </span>
              )}
              {doctor.email && (
                <span className="flex items-center gap-1 truncate max-w-[140px]">
                  <Mail className="size-3 text-sky-500" />
                  {doctor.email}
                </span>
              )}
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-700 dark:text-sky-300 font-bold text-[10px] shrink-0 border border-sky-500/20">
            ৳{doctor.consultationFee} Fee
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-3 space-y-3">
        {/* Telemetry Matrix */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 rounded-xl border border-border/50 bg-muted/20">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase">
              Total Earnings
            </span>
            <p className="text-base font-extrabold text-foreground">
              ৳{doctor.totalEarningsBDT.toLocaleString()}
            </p>
          </div>

          <div className="p-2 rounded-xl border border-border/50 bg-muted/20">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase">
              Consultations
            </span>
            <p className="text-base font-extrabold text-foreground">
              {doctor.totalConsultations}{" "}
              <span className="text-[10px] text-muted-foreground font-normal">
                ({doctor.completedConsultations} done)
              </span>
            </p>
          </div>

          <div className="p-2 rounded-xl border border-border/50 bg-muted/20">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase">
              Avg Time / Patient
            </span>
            <p className="text-base font-extrabold text-foreground">
              {doctor.avgConsultationMinutes} mins
            </p>
          </div>

          <div className="p-2 rounded-xl border border-border/50 bg-muted/20">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase">
              Prescriptions &amp; Plans
            </span>
            <p className="text-base font-extrabold text-foreground">
              {doctor.prescriptionsWritten} rx • {doctor.treatmentPlansCreated} tp
            </p>
          </div>
        </div>

        {/* Most Used Medicines */}
        {doctor.mostUsedMedicines.length > 0 && (
          <div className="space-y-1.5 pt-1 border-t border-border/40">
            <span className="text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Pill className="size-3 text-purple-500" />
              <span>Top Prescribed Medicines</span>
            </span>
            <div className="flex flex-wrap gap-1">
              {doctor.mostUsedMedicines.map((m) => (
                <span
                  key={m.name}
                  className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 text-[10px] font-semibold"
                >
                  {m.name} <span className="font-mono font-bold">({m.count}x)</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Top Diagnoses */}
        {doctor.topDiagnoses.length > 0 && (
          <div className="space-y-1.5 pt-1 border-t border-border/40">
            <span className="text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Stethoscope className="size-3 text-sky-500" />
              <span>Frequent Diagnoses</span>
            </span>
            <div className="flex flex-wrap gap-1">
              {doctor.topDiagnoses.map((d) => (
                <span
                  key={d.diagnosis}
                  className="px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20 text-[10px] font-semibold"
                >
                  {d.diagnosis} ({d.count})
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --------------------------------------------------------
// SUB-CARD: RECEPTIONIST PERFORMANCE
// --------------------------------------------------------
function ReceptionistPerformanceCard({
  receptionist,
}: {
  receptionist: ReceptionistPerformanceMetric;
}) {
  return (
    <Card className="border-border/80 bg-card shadow-xs hover:border-blue-500/40 transition-all">
      <CardHeader className="pb-2 border-b border-border/50">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-bold text-foreground">
              {receptionist.name}
            </CardTitle>
            <p className="text-[11px] text-muted-foreground font-mono mt-0.5 flex items-center gap-1">
              <Phone className="size-3 text-emerald-500" />
              {receptionist.phone || receptionist.whatsapp || "No phone"}
            </p>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 font-bold text-[10px] border border-blue-500/20">
            Front Desk
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-3 space-y-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 rounded-xl border border-border/50 bg-muted/20">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase">
              Patient Check-ins
            </span>
            <p className="text-base font-extrabold text-foreground">
              {receptionist.totalCheckIns}
            </p>
          </div>

          <div className="p-2 rounded-xl border border-border/50 bg-muted/20">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase">
              Total Bookings
            </span>
            <p className="text-base font-extrabold text-foreground">
              {receptionist.totalBookings}
            </p>
          </div>

          <div className="p-2 rounded-xl border border-border/50 bg-muted/20">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase">
              Consultation Serials
            </span>
            <p className="text-base font-extrabold text-foreground">
              {receptionist.consultationSerialsIssued}
            </p>
          </div>

          <div className="p-2 rounded-xl border border-border/50 bg-muted/20">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase">
              Unique Patients
            </span>
            <p className="text-base font-extrabold text-foreground">
              {receptionist.uniquePatientsHandled}
            </p>
          </div>
        </div>

        <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-1 border-t border-border/40">
          <span>Regular Slots: {receptionist.regularBookingsCount}</span>
          <span>Extra Slots: {receptionist.extraBookingsCount}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// --------------------------------------------------------
// SUB-CARD: CASHIER PERFORMANCE
// --------------------------------------------------------
function CashierPerformanceCard({ cashier }: { cashier: CashierPerformanceMetric }) {
  return (
    <Card className="border-border/80 bg-card shadow-xs hover:border-amber-500/40 transition-all">
      <CardHeader className="pb-2 border-b border-border/50">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-bold text-foreground">
              {cashier.name}
            </CardTitle>
            <p className="text-[11px] text-muted-foreground font-mono mt-0.5 flex items-center gap-1">
              <Phone className="size-3 text-emerald-500" />
              {cashier.phone || cashier.whatsapp || "No phone"}
            </p>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold text-[10px] border border-amber-500/20">
            Cashier Desk
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-3 space-y-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 rounded-xl border border-border/50 bg-muted/20">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase">
              Total Collected
            </span>
            <p className="text-base font-extrabold text-foreground">
              ৳{cashier.totalCollectedBDT.toLocaleString()}
            </p>
          </div>

          <div className="p-2 rounded-xl border border-border/50 bg-muted/20">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase">
              Invoices Cleared
            </span>
            <p className="text-base font-extrabold text-foreground">
              {cashier.invoicesCleared} / {cashier.totalInvoicesHandled}
            </p>
          </div>

          <div className="p-2 rounded-xl border border-border/50 bg-muted/20">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase">
              Due Marked
            </span>
            <p className="text-base font-extrabold text-amber-600">
              ৳{cashier.totalDueMarkedBDT.toLocaleString()}
            </p>
          </div>

          <div className="p-2 rounded-xl border border-border/50 bg-muted/20">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase">
              Transactions
            </span>
            <p className="text-base font-extrabold text-foreground">
              {cashier.totalTransactionsCount}{" "}
              <span className="text-[10px] font-normal text-muted-foreground">
                (avg ৳{cashier.avgTransactionBDT})
              </span>
            </p>
          </div>
        </div>

        {/* Method Breakdown */}
        <div className="space-y-1.5 pt-1 border-t border-border/40 text-[11px]">
          <span className="text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Wallet className="size-3 text-amber-500" />
            <span>Payment Methods Breakdown</span>
          </span>
          <div className="grid grid-cols-3 gap-1.5 text-center">
            <div className="p-1 rounded-lg bg-muted/40 border border-border/50">
              <span className="font-bold block text-[10px] text-muted-foreground">
                CASH
              </span>
              <span className="font-extrabold text-foreground text-xs">
                ৳{cashier.cashBDT.toLocaleString()}
              </span>
            </div>
            <div className="p-1 rounded-lg bg-muted/40 border border-border/50">
              <span className="font-bold block text-[10px] text-muted-foreground">
                CARD
              </span>
              <span className="font-extrabold text-foreground text-xs">
                ৳{cashier.cardBDT.toLocaleString()}
              </span>
            </div>
            <div className="p-1 rounded-lg bg-muted/40 border border-border/50">
              <span className="font-bold block text-[10px] text-muted-foreground">
                MFS
              </span>
              <span className="font-extrabold text-foreground text-xs">
                ৳{cashier.mfsBDT.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// --------------------------------------------------------
// SUB-CARD: HANDLER PERFORMANCE
// --------------------------------------------------------
function HandlerPerformanceCard({ handler }: { handler: HandlerPerformanceMetric }) {
  return (
    <Card className="border-border/80 bg-card shadow-xs hover:border-emerald-500/40 transition-all">
      <CardHeader className="pb-2 border-b border-border/50">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-bold text-foreground">
              {handler.name}
            </CardTitle>
            <p className="text-[11px] text-muted-foreground font-mono mt-0.5 flex items-center gap-1">
              <Phone className="size-3 text-emerald-500" />
              {handler.phone || handler.whatsapp || "No phone"}
            </p>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] border border-emerald-500/20">
            Therapy Handler
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-3 space-y-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 rounded-xl border border-border/50 bg-muted/20">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase">
              Sessions Completed
            </span>
            <p className="text-base font-extrabold text-foreground">
              {handler.therapySessionsCompleted}
            </p>
          </div>

          <div className="p-2 rounded-xl border border-border/50 bg-muted/20">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase">
              Total Bed Minutes
            </span>
            <p className="text-base font-extrabold text-foreground">
              {handler.totalBedMinutes} mins
            </p>
          </div>

          <div className="p-2 rounded-xl border border-border/50 bg-muted/20">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase">
              Avg Session Time
            </span>
            <p className="text-base font-extrabold text-foreground">
              {handler.avgSessionMinutes} mins
            </p>
          </div>

          <div className="p-2 rounded-xl border border-border/50 bg-muted/20">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase">
              Patients Served
            </span>
            <p className="text-base font-extrabold text-foreground">
              {handler.uniquePatientsTreated}
            </p>
          </div>
        </div>

        {/* Modalities Handled */}
        {handler.modalitiesHandled.length > 0 && (
          <div className="space-y-1.5 pt-1 border-t border-border/40 text-[11px]">
            <span className="text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Activity className="size-3 text-emerald-500" />
              <span>Modalities Administered</span>
            </span>
            <div className="flex flex-wrap gap-1">
              {handler.modalitiesHandled.map((m) => (
                <span
                  key={m.name}
                  className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-[10px] font-semibold"
                >
                  {m.name} ({m.count}x • {m.totalMinutes}m)
                </span>
              ))}
            </div>
          </div>
        )}

        {handler.roomsCovered.length > 0 && (
          <div className="text-[10.5px] text-muted-foreground pt-1 border-t border-border/40 flex items-center gap-1">
            <span className="font-semibold">Rooms Conducted:</span>
            <span>Room {handler.roomsCovered.join(", Room ")}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
