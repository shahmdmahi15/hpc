"use client";

import * as React from "react";
import Link from "next/link";
import {
  Search,
  Users,
  RefreshCw,
  Download,
  Printer,
  Compass,
  FileText,
  Eye,
  Phone,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  DollarSign,
  Calendar,
  Layers,
  ArrowUpDown,
  Filter,
  Sparkles,
  UserCheck,
  Stethoscope,
  Activity,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRealtimeEvents } from "@/hooks/use-realtime-events";
import {
  getAdminPatientsListAction,
  type PatientListItem,
  type PatientListResult,
} from "@/actions/admin/patient-history.action";
import { PatientWholeHistoryDialog } from "./patient-whole-history-dialog";
import { PatientHistoryPrintDialog } from "./patient-history-print-dialog";
import { PatientJourneyPrintDialog } from "./patient-journey-print-dialog";
import { AdminExportDialog } from "../admin-export-dialog";

interface PatientDirectoryViewProps {
  initialData: PatientListResult;
}

export function PatientDirectoryView({ initialData }: PatientDirectoryViewProps) {
  const [data, setData] = React.useState<PatientListResult>(initialData);
  const [page, setPage] = React.useState<number>(initialData.page || 1);
  const [pageSize, setPageSize] = React.useState<number>(initialData.pageSize || 50);
  const [pageInput, setPageInput] = React.useState<string>(String(initialData.page || 1));
  const [search, setSearch] = React.useState<string>("");
  const [filter, setFilter] = React.useState<"ALL" | "DUE" | "TODAY" | "FEMALE" | "MALE">("ALL");
  const [sortBy, setSortBy] = React.useState<"recent" | "due" | "bill" | "name">("recent");
  const [isLoading, setIsLoading] = React.useState<boolean>(false);

  // Modal states
  const [selectedPatientId, setSelectedPatientId] = React.useState<string | null>(null);
  const [isWholeHistoryOpen, setIsWholeHistoryOpen] = React.useState<boolean>(false);
  const [isPrintHistoryOpen, setIsPrintHistoryOpen] = React.useState<boolean>(false);
  const [isPrintJourneyOpen, setIsPrintJourneyOpen] = React.useState<boolean>(false);
  const [isExportAllOpen, setIsExportAllOpen] = React.useState<boolean>(false);

  const totalPages = data.totalPages || Math.ceil(data.totalCount / pageSize) || 1;

  // Debounced search / filter fetch with full pagination
  const fetchPatients = React.useCallback(
    async (
      searchQuery = search,
      activeFilter = filter,
      activeSort = sortBy,
      targetPage = page,
      targetPageSize = pageSize,
      silent = false
    ) => {
      try {
        if (!silent) setIsLoading(true);
        const res = await getAdminPatientsListAction({
          search: searchQuery,
          filter: activeFilter,
          sortBy: activeSort,
          limit: targetPageSize,
          offset: (targetPage - 1) * targetPageSize,
        });
        setData(res);
        setPage(res.page || targetPage);
        setPageInput(String(res.page || targetPage));
      } catch (err: any) {
        console.error("[Fetch Patients Error]:", err);
        if (!silent) {
          toast.error(err?.message || "Failed to load patients list.");
        }
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [search, filter, sortBy, page, pageSize]
  );

  // Search/filter input handler with debounce - resets to page 1
  React.useEffect(() => {
    const timer = setTimeout(() => {
      fetchPatients(search, filter, sortBy, 1, pageSize, true);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, filter, sortBy, pageSize, fetchPatients]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === page || isLoading) return;
    setPage(newPage);
    setPageInput(String(newPage));
    fetchPatients(search, filter, sortBy, newPage, pageSize, false);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
    setPageInput("1");
    fetchPatients(search, filter, sortBy, 1, newSize, false);
  };

  const handlePageJump = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(pageInput, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= totalPages) {
      handlePageChange(parsed);
    } else {
      setPageInput(String(page));
    }
  };

  // Real-time synchronization: silently refresh on patient events
  useRealtimeEvents({
    onEvent: (event) => {
      const relevantTypes = [
        "PATIENT_REGISTERED",
        "PATIENT_UPDATED",
        "PATIENT_CHECKED_IN",
        "PATIENT_CHECKED_OUT",
        "PATIENT_FORWARDED",
        "PAYMENT_COLLECTED",
        "INVOICE_UPDATED",
        "CONSULTATION_QUEUED",
        "THERAPY_QUEUED",
        "STATION_CHANGED",
        "TREATMENT_PLAN_CREATED",
        "PRESCRIPTION_SAVED",
      ];
      if (relevantTypes.includes(event.type)) {
        fetchPatients(search, filter, sortBy, page, pageSize, true);
      }
    },
  });

  const handleOpenWholeHistory = (patientId: string) => {
    setSelectedPatientId(patientId);
    setIsWholeHistoryOpen(true);
  };

  const handleOpenPrintHistory = (patientId: string) => {
    setSelectedPatientId(patientId);
    setIsPrintHistoryOpen(true);
  };

  const handleOpenPrintJourney = (patientId: string) => {
    setSelectedPatientId(patientId);
    setIsPrintJourneyOpen(true);
  };

  const kpis = data.kpis;

  return (
    <div className="space-y-6">
      {/* Header & Main Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-5 rounded-2xl border border-border/70 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="size-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold">
              <Users className="size-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Patients & Clinical History Hub
                <Badge variant="outline" className="text-xs font-mono font-bold bg-primary/5 text-primary border-primary/20">
                  {data.totalCount.toLocaleString()} Registered
                </Badge>
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Inspect whole clinical histories, consultations, prescriptions, therapy sequences, station journeys, and print or export data.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchPatients(search, filter, sortBy, page, pageSize, false)}
            disabled={isLoading}
            className="h-9 gap-1.5 text-xs font-medium cursor-pointer shadow-xs"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin text-primary" : ""}`} />
            <span>Refresh</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExportAllOpen(true)}
            className="h-9 gap-1.5 text-xs font-medium cursor-pointer text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/10 shadow-xs"
          >
            <Download className="size-3.5" />
            <span>Export Center</span>
          </Button>

          <Link href="/admin/tracking">
            <Button
              variant="default"
              size="sm"
              className="h-9 gap-1.5 text-xs font-semibold cursor-pointer shadow-xs"
            >
              <Compass className="size-3.5" />
              <span>Live Journey Board</span>
              <ArrowUpRight className="size-3" />
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Telemetry Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-card p-4 rounded-xl border border-border/80 shadow-xs flex items-center gap-3.5">
          <div className="size-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 flex items-center justify-center shrink-0">
            <Users className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Total Patients
            </p>
            <p className="text-xl font-bold text-foreground truncate">
              {kpis.totalPatients}
            </p>
          </div>
        </div>

        <div className="bg-card p-4 rounded-xl border border-border/80 shadow-xs flex items-center gap-3.5">
          <div className="size-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0">
            <UserCheck className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Active In Clinic Today
            </p>
            <p className="text-xl font-bold text-emerald-600 truncate">
              {kpis.activeTodayCount}
            </p>
          </div>
        </div>

        <div className="bg-card p-4 rounded-xl border border-border/80 shadow-xs flex items-center gap-3.5">
          <div className="size-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 flex items-center justify-center shrink-0">
            <AlertCircle className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              With Due Balance
            </p>
            <div className="flex items-baseline gap-1.5 truncate">
              <span className="text-xl font-bold text-rose-600">
                {kpis.patientsWithDue}
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                (৳{kpis.totalDueAmount.toLocaleString()})
              </span>
            </div>
          </div>
        </div>

        <div className="bg-card p-4 rounded-xl border border-border/80 shadow-xs flex items-center gap-3.5">
          <div className="size-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center shrink-0">
            <TrendingUp className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Lifetime Revenue
            </p>
            <p className="text-xl font-bold text-amber-700 dark:text-amber-400 font-mono truncate">
              ৳{kpis.totalLifetimeRevenue.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-card p-4 rounded-xl border border-border/80 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Patient Name, Phone Number, MRN (e.g. HPC-2026-0001), or Address..."
              className="pl-9 h-9.5 text-xs bg-background"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>

          {/* Sort Menu */}
          <div className="flex items-center gap-2 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5 font-medium cursor-pointer">
                    <ArrowUpDown className="size-3.5 text-muted-foreground" />
                    <span>
                      Sort:{" "}
                      {sortBy === "recent"
                        ? "Recently Updated"
                        : sortBy === "due"
                        ? "Highest Due"
                        : sortBy === "bill"
                        ? "Highest Billed"
                        : "Name (A-Z)"}
                    </span>
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-48 text-xs">
                <DropdownMenuLabel>Sort Patients</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setSortBy("recent")} className="cursor-pointer">
                  Recently Updated
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy("due")} className="cursor-pointer">
                  Highest Outstanding Due
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy("bill")} className="cursor-pointer">
                  Highest Total Billed
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy("name")} className="cursor-pointer">
                  Name (Alphabetical)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 text-xs">
          <span className="text-muted-foreground font-medium shrink-0 flex items-center gap-1 pl-1">
            <Filter className="size-3" /> Filter:
          </span>
          <button
            onClick={() => setFilter("ALL")}
            className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all shrink-0 ${
              filter === "ALL"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            All Patients ({kpis.totalPatients})
          </button>
          <button
            onClick={() => setFilter("TODAY")}
            className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all shrink-0 ${
              filter === "TODAY"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Active Today ({kpis.activeTodayCount})
          </button>
          <button
            onClick={() => setFilter("DUE")}
            className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all shrink-0 ${
              filter === "DUE"
                ? "bg-rose-600 text-white shadow-xs"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            With Due Balance ({kpis.patientsWithDue})
          </button>
          <button
            onClick={() => setFilter("FEMALE")}
            className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all shrink-0 ${
              filter === "FEMALE"
                ? "bg-purple-600 text-white shadow-xs"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Female
          </button>
          <button
            onClick={() => setFilter("MALE")}
            className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all shrink-0 ${
              filter === "MALE"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Male
          </button>
        </div>
      </div>

      {/* Patient Directory Table / Cards */}
      <div className="bg-card rounded-xl border border-border/80 shadow-xs overflow-hidden">
        {isLoading && (
          <div className="p-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <RefreshCw className="size-4 animate-spin text-primary" />
            <span>Loading patient records...</span>
          </div>
        )}

        {!isLoading && data.patients.length === 0 && (
          <div className="p-12 text-center space-y-3">
            <div className="size-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
              <Users className="size-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">No patient records found</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {search ? "No patients matching your search criteria." : "No patients have been registered yet."}
              </p>
            </div>
            {search && (
              <Button size="sm" variant="outline" onClick={() => setSearch("")} className="text-xs h-8">
                Clear Search
              </Button>
            )}
          </div>
        )}

        {!isLoading && data.patients.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 border-b border-border/80 text-muted-foreground font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Patient & MRN</th>
                  <th className="py-3 px-3">Contact & Gender</th>
                  <th className="py-3 px-3 text-center">Visits & Services</th>
                  <th className="py-3 px-3 text-right">Billed / Paid</th>
                  <th className="py-3 px-3 text-right">Outstanding Due</th>
                  <th className="py-3 px-3">Last Visit</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {data.patients.map((patient: PatientListItem) => {
                  const hasDue = patient.totalDue > 0;
                  return (
                    <tr
                      key={patient.id}
                      className="hover:bg-muted/30 transition-colors group"
                    >
                      {/* Name & MRN */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <button
                            onClick={() => handleOpenWholeHistory(patient.id)}
                            className="size-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold hover:bg-primary hover:text-white transition-colors cursor-pointer shrink-0"
                            title="Inspect Whole Medical Dossier"
                          >
                            <Eye className="size-4" />
                          </button>
                          <div>
                            <button
                              onClick={() => handleOpenWholeHistory(patient.id)}
                              className="font-bold text-foreground hover:text-primary transition-colors text-left text-xs cursor-pointer block"
                            >
                              {patient.name}
                            </button>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Badge
                                variant="outline"
                                className="font-mono text-[9px] uppercase font-bold py-0 px-1 bg-muted/50"
                              >
                                {patient.mrn}
                              </Badge>
                              {patient.hasActiveVisitToday && (
                                <Badge className="bg-emerald-600 text-white text-[9px] py-0 px-1">
                                  In Clinic
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Contact & Demographics */}
                      <td className="py-3 px-3">
                        <div className="space-y-0.5">
                          <p className="font-mono text-muted-foreground flex items-center gap-1">
                            <Phone className="size-3 text-muted-foreground/70" />
                            <span>{patient.phone}</span>
                          </p>
                          <p className="text-[10px] text-muted-foreground/80">
                            {patient.gender}
                            {patient.bloodGroup ? ` • ${patient.bloodGroup}` : ""}
                            {patient.address ? ` • ${patient.address}` : ""}
                          </p>
                        </div>
                      </td>

                      {/* Activity Metrics */}
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex items-center gap-2 bg-muted/40 px-2 py-1 rounded-md border border-border/50">
                          <span title="Appointments" className="text-muted-foreground">
                            📅 {patient.appointmentCount}
                          </span>
                          <span className="text-muted-foreground/40">•</span>
                          <span title="Doctor Consultations" className="text-muted-foreground">
                            🩺 {patient.consultationCount}
                          </span>
                          <span className="text-muted-foreground/40">•</span>
                          <span title="Invoices" className="text-muted-foreground">
                            🧾 {patient.invoiceCount}
                          </span>
                        </div>
                      </td>

                      {/* Billed & Paid */}
                      <td className="py-3 px-3 text-right">
                        <div className="font-mono">
                          <p className="font-semibold text-foreground">
                            ৳{patient.totalBill.toLocaleString()}
                          </p>
                          <p className="text-[10px] text-emerald-600 font-medium">
                            Paid: ৳{patient.totalPaid.toLocaleString()}
                          </p>
                        </div>
                      </td>

                      {/* Due */}
                      <td className="py-3 px-3 text-right">
                        {hasDue ? (
                          <div className="font-mono">
                            <Badge className="bg-rose-600 text-white font-mono font-bold text-[11px] py-0.5 px-2">
                              ৳{patient.totalDue.toLocaleString()}
                            </Badge>
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-emerald-600 border-emerald-500/30 text-[10px] py-0">
                            Settled
                          </Badge>
                        )}
                      </td>

                      {/* Last Visit */}
                      <td className="py-3 px-3 text-muted-foreground text-[11px]">
                        {patient.lastVisitDate ? (
                          <div>
                            <p>{new Date(patient.lastVisitDate).toLocaleDateString()}</p>
                            <p className="text-[10px] text-muted-foreground/70">
                              {new Date(patient.lastVisitDate).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                        ) : (
                          <span>Never</span>
                        )}
                      </td>

                      {/* Action Menu */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenWholeHistory(patient.id)}
                            className="h-7.5 px-2.5 text-xs font-semibold gap-1 text-primary border-primary/20 hover:bg-primary/10 cursor-pointer"
                            title="Open whole interactive medical and journey history"
                          >
                            <Eye className="size-3.5" />
                            <span className="hidden sm:inline">Dossier</span>
                          </Button>

                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7.5 w-7.5 p-0 text-xs font-semibold cursor-pointer"
                                >
                                  •••
                                </Button>
                              }
                            />
                            <DropdownMenuContent align="end" className="w-56 text-xs">
                              <DropdownMenuLabel className="font-bold flex items-center justify-between">
                                <span>{patient.name}</span>
                                <span className="font-mono text-[10px] text-muted-foreground">
                                  {patient.mrn}
                                </span>
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator />

                              <DropdownMenuItem
                                onClick={() => handleOpenWholeHistory(patient.id)}
                                className="cursor-pointer gap-2"
                              >
                                <Eye className="size-3.5 text-primary" />
                                <span>View Whole History Dossier</span>
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                onClick={() => handleOpenPrintHistory(patient.id)}
                                className="cursor-pointer gap-2 text-primary"
                              >
                                <Printer className="size-3.5" />
                                <span>Print Medical History (A4)</span>
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                onClick={() => handleOpenPrintJourney(patient.id)}
                                className="cursor-pointer gap-2 text-indigo-600"
                              >
                                <Compass className="size-3.5" />
                                <span>Print Station Journey Timeline</span>
                              </DropdownMenuItem>

                              <DropdownMenuSeparator />

                              <DropdownMenuItem
                                onClick={() => {
                                  window.location.assign(
                                    `/api/admin/export?type=patient_history&patientId=${patient.id}&format=xlsx`
                                  );
                                }}
                                className="cursor-pointer gap-2 text-emerald-700 dark:text-emerald-400"
                              >
                                <Download className="size-3.5" />
                                <span>Export Multi-Sheet Excel (.xlsx)</span>
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                onClick={() => {
                                  window.location.assign(
                                    `/api/admin/export?type=patient_history&patientId=${patient.id}&format=json`
                                  );
                                }}
                                className="cursor-pointer gap-2 text-blue-700 dark:text-blue-400"
                              >
                                <Download className="size-3.5" />
                                <span>Export Raw Machine JSON</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {data.totalCount > 0 && (
          <div className="p-3 sm:p-4 border-t border-border/80 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
              <span>
                Showing <strong className="text-foreground font-mono">{(page - 1) * pageSize + 1}</strong> -{" "}
                <strong className="text-foreground font-mono">{Math.min(page * pageSize, data.totalCount).toLocaleString()}</strong> of{" "}
                <strong className="text-foreground font-mono">{data.totalCount.toLocaleString()}</strong> registered patients
              </span>

              <div className="flex items-center gap-1.5 pl-2 border-l border-border/60">
                <span className="text-[11px]">Per Page:</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(val) => handlePageSizeChange(Number(val))}
                >
                  <SelectTrigger className="h-7 w-[75px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="200">200</SelectItem>
                    <SelectItem value="500">500</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-muted-foreground mr-1">
                <span>Page</span>
                <form onSubmit={handlePageJump} className="inline-flex">
                  <Input
                    value={pageInput}
                    onChange={(e) => setPageInput(e.target.value)}
                    onBlur={handlePageJump}
                    className="h-7 w-12 text-center text-xs p-1 font-mono font-bold"
                  />
                </form>
                <span>of <strong className="text-foreground font-mono">{totalPages.toLocaleString()}</strong></span>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(1)}
                  disabled={page <= 1 || isLoading}
                  className="h-7 w-7 p-0 cursor-pointer"
                  title="First Page"
                >
                  <ChevronsLeft className="size-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page <= 1 || isLoading}
                  className="h-7 w-7 p-0 cursor-pointer"
                  title="Previous Page"
                >
                  <ChevronLeft className="size-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page >= totalPages || isLoading}
                  className="h-7 w-7 p-0 cursor-pointer"
                  title="Next Page"
                >
                  <ChevronRight className="size-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(totalPages)}
                  disabled={page >= totalPages || isLoading}
                  className="h-7 w-7 p-0 cursor-pointer"
                  title="Last Page"
                >
                  <ChevronsRight className="size-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals & Dialogs */}
      <PatientWholeHistoryDialog
        patientId={selectedPatientId}
        isOpen={isWholeHistoryOpen}
        onOpenChange={(open) => {
          setIsWholeHistoryOpen(open);
          if (!open) setSelectedPatientId(null);
        }}
      />

      <PatientHistoryPrintDialog
        patientId={selectedPatientId}
        isOpen={isPrintHistoryOpen}
        onOpenChange={(open) => {
          setIsPrintHistoryOpen(open);
          if (!open) setSelectedPatientId(null);
        }}
      />

      <PatientJourneyPrintDialog
        patientId={selectedPatientId}
        isOpen={isPrintJourneyOpen}
        onOpenChange={(open) => {
          setIsPrintJourneyOpen(open);
          if (!open) setSelectedPatientId(null);
        }}
      />

      <AdminExportDialog
        isOpen={isExportAllOpen}
        onOpenChange={setIsExportAllOpen}
      />
    </div>
  );
}
