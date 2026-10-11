"use client";

import * as React from "react";
import {
  Pill,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Edit,
  Trash2,
  CheckCircle2,
  XCircle,
  Database,
  Building2,
  Clock,
  Utensils,
  Sparkles,
  Layers,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  getAdminMedicinesListAction,
  toggleMedicineStatusAction,
  seedDefaultMedicinesAction,
} from "@/actions/admin/medicine.action";
import { CreateMedicineDialog } from "./create-medicine-dialog";
import { EditMedicineDialog } from "./edit-medicine-dialog";
import { DeleteMedicineDialog } from "./delete-medicine-dialog";
import { DgdaSeedDialog } from "./dgda-seed-dialog";
import { useRealtimeEvents } from "@/hooks/use-realtime-events";

interface MedicineItem {
  id: string;
  name: string;
  genericName: string | null;
  strength: string | null;
  form: string | null;
  company: string | null;
  defaultMealTiming: string | null;
  defaultTimes: string | null;
  defaultDuration: string | null;
  instructions: string | null;
  isActive: boolean;
  order: number;
  createdAt: Date;
}

interface MedicineManagementViewProps {
  initialMedicines: MedicineItem[];
  totalCount: number;
  activeCount: number;
  inactiveCount: number;
  initialPage?: number;
  initialTotalPages?: number;
}

export function MedicineManagementView({
  initialMedicines,
  totalCount: initialTotal,
  activeCount: initialActive,
  inactiveCount: initialInactive,
  initialPage = 1,
  initialTotalPages,
}: MedicineManagementViewProps) {
  const [medicines, setMedicines] = React.useState<MedicineItem[]>(initialMedicines);
  const [counts, setCounts] = React.useState({
    total: initialTotal,
    active: initialActive,
    inactive: initialInactive,
  });

  const [page, setPage] = React.useState<number>(initialPage);
  const [pageSize, setPageSize] = React.useState<number>(100);
  const [totalPages, setTotalPages] = React.useState<number>(
    initialTotalPages || Math.ceil(initialTotal / 100) || 1
  );
  const [pageInput, setPageInput] = React.useState<string>(String(initialPage));

  const [searchQuery, setSearchQuery] = React.useState("");
  const [formFilter, setFormFilter] = React.useState("ALL");
  const [statusFilter, setStatusFilter] = React.useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSeeding, setIsSeeding] = React.useState(false);

  // Dialogs
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [editingMedicine, setEditingMedicine] = React.useState<MedicineItem | null>(null);
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [deletingMedicine, setDeletingMedicine] = React.useState<MedicineItem | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
  const [isDgdaSeedOpen, setIsDgdaSeedOpen] = React.useState(false);

  // Load Data
  const loadMedicines = React.useCallback(
    async (targetPage = page, targetLimit = pageSize) => {
      setIsLoading(true);
      try {
        const res = await getAdminMedicinesListAction({
          query: searchQuery,
          form: formFilter !== "ALL" ? formFilter : undefined,
          isActive:
            statusFilter === "ACTIVE"
              ? true
              : statusFilter === "INACTIVE"
                ? false
                : undefined,
          page: targetPage,
          limit: targetLimit,
        });

        if (res.success) {
          setMedicines(res.medicines as MedicineItem[]);
          setCounts({
            total: res.totalCount,
            active: res.activeCount,
            inactive: res.inactiveCount,
          });
          setPage(res.page);
          setTotalPages(res.totalPages || 1);
          setPageInput(String(res.page));
        } else {
          toast.error(res.message);
        }
      } catch {
        toast.error("Failed to refresh medicines list.");
      } finally {
        setIsLoading(false);
      }
    },
    [searchQuery, formFilter, statusFilter, page, pageSize]
  );

  // Real-time synchronization
  useRealtimeEvents({
    onEvent: (event) => {
      const type = (event?.type || "").toUpperCase();
      if (
        type === "MEDICINE_CREATED" ||
        type === "MEDICINE_UPDATED" ||
        type === "MEDICINE_DELETED"
      ) {
        void loadMedicines(page, pageSize);
      }
    },
  });

  // Debounced search - resets to page 1
  React.useEffect(() => {
    const timer = setTimeout(() => {
      void loadMedicines(1, pageSize);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, formFilter, statusFilter, pageSize]);

  // Page handlers
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === page) return;
    setPage(newPage);
    void loadMedicines(newPage, pageSize);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
    void loadMedicines(1, newSize);
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

  // Toggle active
  const handleToggleActive = async (id: string, current: boolean) => {
    try {
      const res = await toggleMedicineStatusAction(id, !current);
      if (res.success) {
        toast.success(res.message);
        void loadMedicines();
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Failed to update status.");
    }
  };

  // Seed default medicines
  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      const res = await seedDefaultMedicinesAction();
      if (res.success) {
        toast.success(res.message);
        void loadMedicines();
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Failed to seed default catalog.");
    } finally {
      setIsSeeding(false);
    }
  };

  const parseSchedule = (defaultTimesStr: string | null) => {
    try {
      if (!defaultTimesStr) return "M-N";
      const parsed = JSON.parse(defaultTimesStr);
      if (Array.isArray(parsed)) {
        return parsed
          .map((t: string) => t.charAt(0).toUpperCase())
          .join("-");
      }
      return "M-N";
    } catch {
      return "M-N";
    }
  };

  return (
    <div className="space-y-4">
      {/* ---------------------------------------------------- */}
      {/* 1. Header Banner & Action Bar                        */}
      {/* ---------------------------------------------------- */}
      <div className="rounded-2xl border border-border/80 bg-gradient-to-r from-card via-card/95 to-primary/5 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold">
                <Pill className="size-3.5" />
                Clinic Master Catalog
              </span>
              <span className="text-xs text-muted-foreground font-mono font-semibold">
                {counts.active} Active • {counts.total} Total
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">
              Medicine Directory Management
            </h1>
            <p className="text-xs text-muted-foreground max-w-2xl">
              Admin-controlled master medicine directory. Only verified medicines in this catalog can be prescribed by doctors, ensuring 100% data integrity and robust clinical analytics.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDgdaSeedOpen(true)}
              className="gap-1.5 text-xs font-semibold border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 shadow-xs cursor-pointer"
            >
              <Database className="size-3.5 text-emerald-600" />
              <span>DGDA Seeding</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => loadMedicines()}
              disabled={isLoading}
              className="gap-1.5 text-xs font-semibold shadow-xs cursor-pointer"
            >
              <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </Button>

            <Button
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              className="gap-1.5 text-xs font-bold shadow-xs cursor-pointer"
            >
              <Plus className="size-3.5" />
              <span>Add Medicine</span>
            </Button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-border/50">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by brand name, generic name, strength, company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs rounded-xl"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Form filter */}
            <Select value={formFilter} onValueChange={(val) => setFormFilter(val || "ALL")}>
              <SelectTrigger className="h-8 w-32 text-xs rounded-xl">
                <SelectValue placeholder="All Forms" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">
                  All Forms
                </SelectItem>
                <SelectItem value="Tablet" className="text-xs">
                  Tablet
                </SelectItem>
                <SelectItem value="Capsule" className="text-xs">
                  Capsule
                </SelectItem>
                <SelectItem value="Gel" className="text-xs">
                  Gel
                </SelectItem>
                <SelectItem value="Spray" className="text-xs">
                  Spray
                </SelectItem>
                <SelectItem value="Injection" className="text-xs">
                  Injection
                </SelectItem>
                <SelectItem value="Syrup" className="text-xs">
                  Syrup
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Status filter */}
            <Select
              value={statusFilter}
              onValueChange={(val) => setStatusFilter((val || "ALL") as "ALL" | "ACTIVE" | "INACTIVE")}
            >
              <SelectTrigger className="h-8 w-32 text-xs rounded-xl">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">
                  All ({counts.total})
                </SelectItem>
                <SelectItem value="ACTIVE" className="text-xs">
                  Active ({counts.active})
                </SelectItem>
                <SelectItem value="INACTIVE" className="text-xs">
                  Disabled ({counts.inactive})
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 2. Medicine Directory Table / Cards Grid             */}
      {/* ---------------------------------------------------- */}
      <Card className="border-border/80 bg-card shadow-xs">
        <CardHeader className="p-3.5 sm:p-4 pb-2 border-b border-border/60 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Layers className="size-3.5" />
            </div>
            <div className="space-y-0.5">
              <CardTitle className="text-xs font-bold text-foreground flex items-center gap-2">
                <span>Verified Medicines Catalog</span>
                <Badge variant="outline" className="font-mono text-[10px] font-bold bg-muted/60">
                  {counts.total.toLocaleString()} Total Items
                </Badge>
              </CardTitle>
              <CardDescription className="text-[11px]">
                Showing {counts.total > 0 ? (page - 1) * pageSize + 1 : 0} -{" "}
                {Math.min(page * pageSize, counts.total).toLocaleString()} on Page {page} of{" "}
                {totalPages.toLocaleString()} • Active items are instantly searchable by doctors in the prescription drawer
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {medicines.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <div className="size-12 rounded-full bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto">
                <Pill className="size-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-foreground">
                  No medicines found
                </p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  {searchQuery
                    ? `No medicines matching "${searchQuery}". Add this medicine to allow doctors to prescribe it.`
                    : "No medicines registered in directory yet. Add a medicine or click 'Seed Standard Medicines'."}
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={() => setIsCreateOpen(true)}
                  className="text-xs font-semibold gap-1.5"
                >
                  <Plus className="size-3.5" />
                  <span>Add First Medicine</span>
                </Button>
                {counts.total === 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSeed}
                    disabled={isSeeding}
                    className="text-xs font-semibold gap-1.5"
                  >
                    <Sparkles className="size-3.5 text-purple-500" />
                    <span>Seed Catalog</span>
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {medicines.map((med) => (
                <div
                  key={med.id}
                  className="p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-muted/30 transition-colors text-xs"
                >
                  {/* Left: Brand name, generic, form, company */}
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-foreground text-sm tracking-tight">
                        {med.name}
                      </span>
                      {med.form && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] font-semibold px-2 py-0"
                        >
                          {med.form}
                        </Badge>
                      )}
                      {med.strength && (
                        <span className="text-[10.5px] font-mono font-bold text-muted-foreground px-1.5 py-0.2 rounded bg-muted">
                          {med.strength}
                        </span>
                      )}
                      {!med.isActive && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-600 border border-rose-500/20">
                          Disabled
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                      {med.genericName && (
                        <span>
                          <strong className="text-foreground/80">Generic:</strong>{" "}
                          {med.genericName}
                        </span>
                      )}
                      {med.company && (
                        <span className="flex items-center gap-1">
                          <Building2 className="size-3 text-sky-500" />
                          <span>{med.company}</span>
                        </span>
                      )}
                    </div>

                    {med.instructions && (
                      <p className="text-[10.5px] text-muted-foreground italic line-clamp-1">
                        Advice: {med.instructions}
                      </p>
                    )}
                  </div>

                  {/* Middle: Clinical Defaults Badge */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0 md:px-3 text-[11px]">
                    <div className="p-1.5 px-2.5 rounded-lg border border-border/60 bg-muted/20 flex items-center gap-2 font-mono">
                      <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold">
                        <Utensils className="size-3" />
                        {med.defaultMealTiming || "AFTER"}
                      </span>
                      <span className="text-muted-foreground">•</span>
                      <span className="flex items-center gap-1 text-sky-600 dark:text-sky-400 font-bold">
                        <Clock className="size-3" />
                        {parseSchedule(med.defaultTimes)}
                      </span>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-muted-foreground">
                        {med.defaultDuration || "7d"}
                      </span>
                    </div>
                  </div>

                  {/* Right: Active Toggle + Edit / Delete */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    <div className="flex items-center gap-1.5 pr-2 border-r border-border/60">
                      <Switch
                        checked={med.isActive}
                        onCheckedChange={() => handleToggleActive(med.id, med.isActive)}
                        title={med.isActive ? "Deactivate medicine" : "Activate medicine"}
                      />
                    </div>

                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setEditingMedicine(med);
                        setIsEditOpen(true);
                      }}
                      className="size-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                      title="Edit medicine details"
                    >
                      <Edit className="size-3.5" />
                    </Button>

                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setDeletingMedicine(med);
                        setIsDeleteOpen(true);
                      }}
                      className="size-8 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive cursor-pointer"
                      title="Delete medicine"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>

        {/* Pagination Bar */}
        {counts.total > 0 && (
          <div className="p-3 sm:p-4 border-t border-border/80 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
              <span>
                Showing <strong className="text-foreground font-mono">{(page - 1) * pageSize + 1}</strong> -{" "}
                <strong className="text-foreground font-mono">{Math.min(page * pageSize, counts.total).toLocaleString()}</strong> of{" "}
                <strong className="text-foreground font-mono">{counts.total.toLocaleString()}</strong> medicines
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
      </Card>

      {/* Dialogs */}
      <CreateMedicineDialog
        isOpen={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSuccess={loadMedicines}
      />

      <EditMedicineDialog
        isOpen={isEditOpen}
        onOpenChange={setIsEditOpen}
        medicine={editingMedicine}
        onSuccess={loadMedicines}
      />

      <DeleteMedicineDialog
        isOpen={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        medicine={deletingMedicine}
        onSuccess={loadMedicines}
      />

      <DgdaSeedDialog
        isOpen={isDgdaSeedOpen}
        onOpenChange={setIsDgdaSeedOpen}
        currentCount={counts.total}
        onSuccess={loadMedicines}
      />
    </div>
  );
}
