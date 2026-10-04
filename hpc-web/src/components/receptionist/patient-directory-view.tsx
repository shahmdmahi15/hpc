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

  // Sync initialPatients when updated by SSE or parent without triggering effect cascading renders
  if (initialPatients !== prevInitial) {
    setPrevInitial(initialPatients);
    setPatients(initialPatients);
  }

  // Debounced search & filtering
  React.useEffect(() => {
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await getPatientsListAction({
          query: searchQuery,
          gender: genderFilter === "ALL" ? undefined : (genderFilter as Gender),
          limit: 50,
        });
        setPatients(res);
      } finally {
        setIsLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, genderFilter]);

  const handleCopyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone).then(() => {
      setCopiedPhone(phone);
      toast.success(`Phone "${phone}" copied to clipboard!`);
      setTimeout(() => setCopiedPhone(null), 2000);
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
            <SelectTrigger className="h-7.5 text-xs w-[120px] bg-background">
              <SelectValue placeholder="Gender">
                {(val: string | null) => {
                  const item = GENDER_FILTER_ITEMS.find((i) => i.value === val);
                  return item ? item.label : "Gender";
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="text-xs">
              {GENDER_FILTER_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="text-[11px] text-muted-foreground font-medium">
            Showing {patients.length} of {totalCount}
          </span>
        </div>

        {/* Action: + Register New Patient */}
        <Button
          size="sm"
          onClick={onOpenNewPatient}
          className="h-7.5 text-xs font-semibold gap-1.5 shadow-2xs cursor-pointer shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-2.5"
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
            <Table>
              <TableHeader className="bg-muted/40">
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
