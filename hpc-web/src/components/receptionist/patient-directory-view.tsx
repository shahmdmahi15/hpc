"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  Search,
  UserPlus,
  Ticket,
  Phone,
  Copy,
  Check,
  MapPin,
  Loader2,
  X,
  Edit3,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Gender } from "@/generated/prisma/enums";
import {
  getPatientsListAction,
  type PatientWithStats,
} from "@/actions/receptionist/patient.action";
import { EditPatientDialog } from "@/components/receptionist/edit-patient-dialog";
import { toast } from "sonner";

interface PatientDirectoryViewProps {
  initialPatients: PatientWithStats[];
  totalCount: number;
  onOpenNewPatient: () => void;
  onBookTicketForPatient: (patient: PatientWithStats) => void;
  performers?: { id: string; name: string; phone: string }[];
  defaultPerformerId?: string;
  onPatientUpdated?: (patient: PatientWithStats) => void;
}

const GENDER_FILTER_ITEMS = [
  { value: "ALL", label: "All Genders" },
  { value: Gender.MALE, label: "Male Patients" },
  { value: Gender.FEMALE, label: "Female Patients" },
] as const;

export function PatientDirectoryView({
  initialPatients,
  totalCount,
  onOpenNewPatient,
  onBookTicketForPatient,
  performers = [],
  defaultPerformerId = "",
  onPatientUpdated,
}: PatientDirectoryViewProps) {
  const [patients, setPatients] =
    React.useState<PatientWithStats[]>(initialPatients);
  const [prevInitial, setPrevInitial] =
    React.useState<PatientWithStats[]>(initialPatients);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [genderFilter, setGenderFilter] = React.useState<string>("ALL");
  const [copiedPhone, setCopiedPhone] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [editingPatient, setEditingPatient] =
    React.useState<PatientWithStats | null>(null);

  // Pagination states
  const [page, setPage] = React.useState<number>(1);
  const [pageSize, setPageSize] = React.useState<number>(50);
  const [totalCountState, setTotalCountState] = React.useState<number>(totalCount);
  const [totalPages, setTotalPages] = React.useState<number>(
    Math.ceil(totalCount / 50) || 1
  );
  const [pageInput, setPageInput] = React.useState<string>("1");

  const fetchFilteredPatients = React.useCallback(
    async (
      targetPage = page,
      targetPageSize = pageSize,
      targetQuery = searchQuery,
      targetGender = genderFilter
    ) => {
      setIsLoading(true);
      try {
        const res = await getPatientsListAction({
          query: targetQuery,
          gender: targetGender === "ALL" ? undefined : (targetGender as Gender),
          page: targetPage,
          limit: targetPageSize,
        });
        setPatients(res.patients);
        setTotalCountState(res.totalCount);
        setTotalPages(res.totalPages);
        setPage(res.page);
        setPageInput(String(res.page));
      } finally {
        setIsLoading(false);
      }
    },
    [page, pageSize, searchQuery, genderFilter]
  );

  // Sync initialPatients when updated by SSE or parent (only when no search/filter is active and on page 1)
  if (initialPatients !== prevInitial) {
    setPrevInitial(initialPatients);
    if (!searchQuery.trim() && genderFilter === "ALL" && page === 1) {
      setPatients(initialPatients);
      setTotalCountState(totalCount);
      setTotalPages(Math.ceil(totalCount / pageSize) || 1);
    } else {
      void fetchFilteredPatients(page, pageSize, searchQuery, genderFilter);
    }
  }

  // Debounced search & filtering (resets to page 1)
  React.useEffect(() => {
    const timer = setTimeout(() => {
      void fetchFilteredPatients(1, pageSize, searchQuery, genderFilter);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, genderFilter, pageSize, fetchFilteredPatients]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === page || isLoading) return;
    setPage(newPage);
    setPageInput(String(newPage));
    void fetchFilteredPatients(newPage, pageSize, searchQuery, genderFilter);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
    setPageInput("1");
    void fetchFilteredPatients(1, newSize, searchQuery, genderFilter);
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

  const handleCopyPhone = (phone: string) => {
    navigator.clipboard
      .writeText(phone)
      .then(() => {
        setCopiedPhone(phone);
        toast.success(`Phone "${phone}" copied to clipboard!`);
        setTimeout(() => setCopiedPhone(null), 2000);
      })
      .catch(() => {
        toast.error(`Unable to copy phone "${phone}" to clipboard.`);
      });
  };

  return (
    <div className="space-y-3">
      {/* Top Header & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-card border border-border/70 shadow-2xs">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px] sm:max-w-xs">
            <Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
            <Input
              type="search"
              name="patient_directory_search_query"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-lpignore="true"
              data-1p-ignore="true"
              data-form-type="other"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search patient, phone, or MRN..."
              className="pl-8 h-7.5 text-xs bg-background"
            />
            {isLoading ? (
              <Loader2 className="absolute right-2.5 top-2 size-3.5 animate-spin text-muted-foreground" />
            ) : searchQuery ? (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>

          {/* Gender Filter */}
          <Select
            items={GENDER_FILTER_ITEMS}
            value={genderFilter}
            onValueChange={(val) => setGenderFilter(val || "ALL")}
          >
            <SelectTrigger className="h-8 sm:h-7.5 text-xs w-full sm:w-[140px] bg-background">
              <SelectValue placeholder="Gender">
                {(val: string | null) => {
                  const item = GENDER_FILTER_ITEMS.find((i) => i.value === val);
                  return item ? item.label : "All Genders";
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="text-xs z-50">
              {GENDER_FILTER_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value} label={item.label} className="text-xs">
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="text-[11px] text-muted-foreground font-medium shrink-0">
            {totalCountState > 0 ? (
              <>
                Showing{" "}
                <strong className="text-foreground font-mono">
                  {(page - 1) * pageSize + 1}
                </strong>
                -
                <strong className="text-foreground font-mono">
                  {Math.min(page * pageSize, totalCountState).toLocaleString()}
                </strong>{" "}
                of{" "}
                <strong className="text-foreground font-mono">
                  {totalCountState.toLocaleString()}
                </strong>
              </>
            ) : (
              "0 patients"
            )}
          </span>
        </div>

        {/* Action: + Register New Patient */}
        <Button
          size="sm"
          onClick={onOpenNewPatient}
          className="h-8 sm:h-7.5 text-xs font-semibold gap-1.5 shadow-2xs cursor-pointer w-full sm:w-auto shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-2.5 justify-center"
        >
          <UserPlus className="size-3.5" />
          <span>Register Patient</span>
        </Button>
      </div>

      {/* Patients Table */}
      {patients.length === 0 ? (
        <Card className="p-10 text-center border-dashed border-border/80">
          <Users className="size-8 mx-auto text-muted-foreground mb-2" />
          <p className="font-bold text-sm text-foreground">
            {searchQuery ? "No Patients Found" : "No Registered Patients Yet"}
          </p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            {searchQuery
              ? "Try adjusting your search query or gender filter."
              : "Register your first patient profile to begin issuing therapy slot tickets."}
          </p>
          <Button
            size="sm"
            onClick={onOpenNewPatient}
            className="mt-4 gap-1.5 font-semibold"
          >
            <UserPlus className="size-3.5" />
            <span>Register First Patient</span>
          </Button>
        </Card>
      ) : (
        <Card className="border-border/80 bg-card/90 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="min-w-[760px]">
              <TableHeader className="bg-muted/40 sticky top-0 z-10">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[120px] font-bold text-[11px] py-2 px-3">
                    MRN
                  </TableHead>
                  <TableHead className="font-bold text-[11px] py-2 px-3">
                    Patient Name
                  </TableHead>
                  <TableHead className="font-bold text-[11px] py-2 px-3">
                    Gender
                  </TableHead>
                  <TableHead className="font-bold text-[11px] py-2 px-3">
                    Phone Number
                  </TableHead>
                  <TableHead className="font-bold text-[11px] py-2 px-3">
                    Age / Address
                  </TableHead>
                  <TableHead className="font-bold text-[11px] py-2 px-3 text-center">
                    Bookings
                  </TableHead>
                  <TableHead className="font-bold text-[11px] py-2 px-3">
                    Registered
                  </TableHead>
                  <TableHead className="w-[140px] text-right font-bold text-[11px] py-2 px-3">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patients.map((patient) => {
                  const isMale = patient.gender === Gender.MALE;
                  const bookingCount = patient._count?.appointments || 0;
                  const registeredDate = new Date(
                    patient.createdAt,
                  ).toLocaleDateString([], {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  });

                  return (
                    <TableRow
                      key={patient.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      {/* MRN */}
                      <TableCell className="font-mono text-xs font-bold text-foreground py-1.5 px-3">
                        <span className="px-1.5 py-0.2 rounded bg-muted border border-border text-[10.5px]">
                          {patient.mrn || "N/A"}
                        </span>
                      </TableCell>

                      {/* Name */}
                      <TableCell className="py-1.5 px-3">
                        <span className="font-semibold text-xs text-foreground block">
                          {patient.name}
                        </span>
                      </TableCell>

                      {/* Gender */}
                      <TableCell className="py-1.5 px-3">
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9.5px] font-bold inline-flex items-center gap-1 ${
                            isMale
                              ? "bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/20"
                              : "bg-pink-500/15 text-pink-700 dark:text-pink-300 border border-pink-500/20"
                          }`}
                        >
                          <span
                            className={`size-1 rounded-full ${
                              isMale ? "bg-sky-500" : "bg-pink-500"
                            }`}
                          />
                          {patient.gender}
                        </span>
                      </TableCell>

                      {/* Phone */}
                      <TableCell className="py-1.5 px-3">
                        <div className="flex items-center gap-1 text-xs font-mono">
                          <Phone className="size-2.5 text-muted-foreground" />
                          <span>{patient.phone}</span>
                          <button
                            onClick={() => handleCopyPhone(patient.phone)}
                            className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                            title="Copy Phone"
                          >
                            {copiedPhone === patient.phone ? (
                              <Check className="size-2.5 text-emerald-500" />
                            ) : (
                              <Copy className="size-2.5" />
                            )}
                          </button>
                        </div>
                      </TableCell>

                      {/* Age & Address */}
                      <TableCell className="py-1.5 px-3">
                        <div className="text-xs space-y-0.5">
                          {patient.age && (
                            <span className="text-foreground font-medium block text-[11px]">
                              {patient.age} yrs
                            </span>
                          )}
                          {patient.address && (
                            <span className="text-muted-foreground text-[10.5px] truncate max-w-[160px] flex items-center gap-1">
                              <MapPin className="size-2.5 shrink-0" />
                              <span className="truncate">
                                {patient.address}
                              </span>
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Bookings Count */}
                      <TableCell className="text-center font-mono font-bold text-xs py-1.5 px-3">
                        <span className="px-1.5 py-0.2 rounded-full bg-primary/10 text-primary border border-primary/20 text-[10.5px]">
                          {bookingCount}
                        </span>
                      </TableCell>

                      {/* Registered Date */}
                      <TableCell className="text-[11px] text-muted-foreground font-sans py-1.5 px-3">
                        {registeredDate}
                      </TableCell>

                      {/* Actions: Edit & Book Ticket */}
                      <TableCell className="text-right py-1.5 px-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingPatient(patient)}
                            className="h-6 text-[11px] px-2 gap-1 font-medium cursor-pointer shadow-2xs hover:border-primary/50 hover:bg-primary/5"
                            title="Edit Patient Profile"
                          >
                            <Edit3 className="size-2.5 text-muted-foreground" />
                            <span>Edit</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => onBookTicketForPatient(patient)}
                            className="h-6 text-[11px] px-2 gap-1 font-semibold cursor-pointer shadow-2xs"
                          >
                            <Ticket className="size-2.5" />
                            <span>Book</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Bar */}
          {totalCountState > 0 && (
            <div className="p-2 sm:p-2.5 border-t border-border/80 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                <span>
                  Showing <strong className="text-foreground font-mono">{(page - 1) * pageSize + 1}</strong> -{" "}
                  <strong className="text-foreground font-mono">{Math.min(page * pageSize, totalCountState).toLocaleString()}</strong> of{" "}
                  <strong className="text-foreground font-mono">{totalCountState.toLocaleString()}</strong> patients
                </span>

                <div className="flex items-center gap-1.5 pl-2 border-l border-border/60">
                  <span className="text-[11px]">Per Page:</span>
                  <Select
                    value={String(pageSize)}
                    onValueChange={(val) => handlePageSizeChange(Number(val))}
                  >
                    <SelectTrigger className="h-6.5 w-[70px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                      <SelectItem value="200">200</SelectItem>
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
                      className="h-6.5 w-11 text-center text-xs p-1 font-mono font-bold"
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
                    className="h-6.5 w-6.5 p-0 cursor-pointer"
                    title="First Page"
                  >
                    <ChevronsLeft className="size-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page <= 1 || isLoading}
                    className="h-6.5 w-6.5 p-0 cursor-pointer"
                    title="Previous Page"
                  >
                    <ChevronLeft className="size-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page >= totalPages || isLoading}
                    className="h-6.5 w-6.5 p-0 cursor-pointer"
                    title="Next Page"
                  >
                    <ChevronRight className="size-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(totalPages)}
                    disabled={page >= totalPages || isLoading}
                    className="h-6.5 w-6.5 p-0 cursor-pointer"
                    title="Last Page"
                  >
                    <ChevronsRight className="size-3" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Edit Patient Dialog */}
      <EditPatientDialog
        open={Boolean(editingPatient)}
        onOpenChange={(open) => {
          if (!open) setEditingPatient(null);
        }}
        patient={editingPatient}
        performers={performers}
        defaultPerformerId={defaultPerformerId}
        onSuccess={(updated: PatientWithStats) => {
          setPatients((prev) =>
            prev.map((p) =>
              p.id === updated.id
                ? {
                    ...p,
                    ...updated,
                    _count: p._count,
                  }
                : p,
            ),
          );
          if (onPatientUpdated) {
            onPatientUpdated(updated);
          }
        }}
      />
    </div>
  );
}
