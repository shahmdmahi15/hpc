"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Stethoscope,
  Activity,
  UserCheck,
  Receipt,
  ArrowRightLeft,
  Plus,
  Loader2,
  Clock,
  User,
  ShieldAlert,
  Send,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import {
  getPatientVisitNotesAction,
  addPatientVisitNoteAction,
  type NoteCategory,
  type PatientVisitNoteRecord,
  type PatientNotesResponse,
} from "@/actions/notes/patient-notes.action";
import { useRealtimeEvents } from "@/hooks/use-realtime-events";

export interface PatientNotesDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  patientName: string;
  patientMrn?: string | null;
  visitId?: string | null;
  appointmentId?: string | null;
  defaultCategory?: NoteCategory;
  currentUserRole?: string;
  currentUserName?: string;
  currentUserId?: string;
  currentStation?: string;
}

const CATEGORY_CONFIG: Record<
  NoteCategory,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badgeClass: string;
    borderClass: string;
    bgClass: string;
  }
> = {
  FORWARDED: {
    label: "Forwarded",
    icon: ArrowRightLeft,
    badgeClass: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-200",
    borderClass: "border-l-indigo-500",
    bgClass: "bg-indigo-50/40 dark:bg-indigo-950/20",
  },
  DOCTOR: {
    label: "Doctor",
    icon: Stethoscope,
    badgeClass: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200",
    borderClass: "border-l-blue-500",
    bgClass: "bg-blue-50/40 dark:bg-blue-950/20",
  },
  HANDLER: {
    label: "Therapy / Handler",
    icon: Activity,
    badgeClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200",
    borderClass: "border-l-emerald-500",
    bgClass: "bg-emerald-50/40 dark:bg-emerald-950/20",
  },
  RECEPTIONIST: {
    label: "Receptionist",
    icon: UserCheck,
    badgeClass: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border-purple-200",
    borderClass: "border-l-purple-500",
    bgClass: "bg-purple-50/40 dark:bg-purple-950/20",
  },
  CASHIER: {
    label: "Cashier",
    icon: Receipt,
    badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-amber-200",
    borderClass: "border-l-amber-500",
    bgClass: "bg-amber-50/40 dark:bg-amber-950/20",
  },
  MEDICAL: {
    label: "Medical History",
    icon: FileText,
    badgeClass: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border-rose-200",
    borderClass: "border-l-rose-500",
    bgClass: "bg-rose-50/40 dark:bg-rose-950/20",
  },
};

export function PatientNotesDialog({
  isOpen,
  onOpenChange,
  patientId,
  patientName,
  patientMrn,
  visitId,
  appointmentId,
  defaultCategory,
  currentUserRole,
  currentUserName,
  currentUserId,
  currentStation,
}: PatientNotesDialogProps) {
  const [activeTab, setActiveTab] = React.useState<string>("ALL");
  const [loading, setLoading] = React.useState<boolean>(false);
  const [notesData, setNotesData] = React.useState<PatientNotesResponse | null>(null);

  // New Note Form State
  const [newNoteText, setNewNoteText] = React.useState("");
  const [newNoteCategory, setNewNoteCategory] = React.useState<NoteCategory>(
    defaultCategory ||
      (currentUserRole === "DOCTOR"
        ? "DOCTOR"
        : currentUserRole === "HANDLER"
          ? "HANDLER"
          : currentUserRole === "CASHIER"
            ? "CASHIER"
            : currentUserRole === "RECEPTIONIST"
              ? "RECEPTIONIST"
              : "FORWARDED"),
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showAddForm, setShowAddForm] = React.useState(false);

  // Load notes
  const fetchNotes = React.useCallback(async () => {
    if (!patientId || !isOpen) return;
    setLoading(true);
    try {
      const res = await getPatientVisitNotesAction({
        patientId,
        visitId: visitId || undefined,
        appointmentId: appointmentId || undefined,
      });
      if (res.success) {
        setNotesData(res);
      } else {
        toast.error(res.message || "Failed to load patient notes.");
      }
    } catch (err) {
      console.error("[PatientNotesDialog Fetch Error]:", err);
    } finally {
      setLoading(false);
    }
  }, [patientId, visitId, appointmentId, isOpen]);

  React.useEffect(() => {
    if (isOpen) {
      fetchNotes();
      if (defaultCategory) {
        setNewNoteCategory(defaultCategory);
      }
    }
  }, [isOpen, fetchNotes, defaultCategory]);

  // Realtime synchronization on PATIENT_NOTE_ADDED
  useRealtimeEvents({
    onEvent: (event) => {
      if (
        event.type === "PATIENT_NOTE_ADDED" &&
        event.data?.patientId === patientId &&
        isOpen
      ) {
        fetchNotes();
      }
    },
  });

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newNoteText.trim();
    if (!trimmed) {
      toast.error("Please enter note content.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await addPatientVisitNoteAction({
        patientId,
        visitId: visitId || undefined,
        appointmentId: appointmentId || undefined,
        category: newNoteCategory,
        note: trimmed,
        authorName: currentUserName,
        authorRole: currentUserRole,
        authorId: currentUserId,
        originStation: currentStation,
      });

      if (res.success) {
        toast.success(res.message);
        setNewNoteText("");
        setShowAddForm(false);
        await fetchNotes();
      } else {
        toast.error(res.message || "Failed to add note.");
      }
    } catch (err) {
      console.error("[Add Note Error]:", err);
      toast.error("Error saving note.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getFilteredNotes = (): PatientVisitNoteRecord[] => {
    if (!notesData) return [];
    if (activeTab === "ALL") return notesData.notes;
    return notesData.notes.filter((n) => n.category === activeTab);
  };

  const filteredNotes = getFilteredNotes();
  const counts = notesData?.counts || {
    all: 0,
    forwarded: 0,
    doctor: 0,
    handler: 0,
    receptionist: 0,
    cashier: 0,
    medical: 0,
  };

  const formatTimestamp = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-5 border-b bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                Patient Visit Notes & Department Communications
              </DialogTitle>
              <DialogDescription className="text-sm font-medium text-foreground/80">
                <span className="font-semibold text-primary">{patientName}</span>
                {patientMrn && (
                  <span className="ml-2 font-mono text-xs bg-muted px-2 py-0.5 rounded border">
                    {patientMrn}
                  </span>
                )}
                {currentStation && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    • Current Station: <strong className="text-foreground">{currentStation}</strong>
                  </span>
                )}
              </DialogDescription>
            </div>
            <Button
              variant={showAddForm ? "secondary" : "default"}
              size="sm"
              onClick={() => setShowAddForm(!showAddForm)}
              className="gap-1.5"
            >
              {showAddForm ? (
                "Cancel"
              ) : (
                <>
                  <Plus className="w-4 h-4" /> Add Note
                </>
              )}
            </Button>
          </div>
        </DialogHeader>

        {/* Collapsible Add Note Form */}
        {showAddForm && (
          <form
            onSubmit={handleAddNote}
            className="p-4 border-b bg-card/80 space-y-3 animate-in fade-in slide-in-from-top-2 duration-150"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Department:
                </span>
                <Select
                  value={newNoteCategory}
                  onValueChange={(val) => setNewNoteCategory(val as NoteCategory)}
                >
                  <SelectTrigger className="w-[200px] h-8 text-xs font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FORWARDED">
                      <span className="flex items-center gap-1.5 text-xs">
                        <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-500" /> Forwarded Note
                      </span>
                    </SelectItem>
                    <SelectItem value="DOCTOR">
                      <span className="flex items-center gap-1.5 text-xs">
                        <Stethoscope className="w-3.5 h-3.5 text-blue-500" /> Doctor Note
                      </span>
                    </SelectItem>
                    <SelectItem value="HANDLER">
                      <span className="flex items-center gap-1.5 text-xs">
                        <Activity className="w-3.5 h-3.5 text-emerald-500" /> Therapy / Handler Note
                      </span>
                    </SelectItem>
                    <SelectItem value="RECEPTIONIST">
                      <span className="flex items-center gap-1.5 text-xs">
                        <UserCheck className="w-3.5 h-3.5 text-purple-500" /> Receptionist Note
                      </span>
                    </SelectItem>
                    <SelectItem value="CASHIER">
                      <span className="flex items-center gap-1.5 text-xs">
                        <Receipt className="w-3.5 h-3.5 text-amber-500" /> Cashier Note
                      </span>
                    </SelectItem>
                    <SelectItem value="MEDICAL">
                      <span className="flex items-center gap-1.5 text-xs">
                        <FileText className="w-3.5 h-3.5 text-rose-500" /> Medical History
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Author:{" "}
                <span className="font-medium text-foreground">
                  {currentUserName || "Staff"} ({currentUserRole || "USER"})
                </span>
              </div>
            </div>

            <Textarea
              placeholder={`Write ${CATEGORY_CONFIG[newNoteCategory].label} note for this patient visit...`}
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              rows={3}
              className="resize-none text-sm"
              autoFocus
            />

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowAddForm(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting || !newNoteText.trim()}
                className="gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" /> Save Note
                  </>
                )}
              </Button>
            </div>
          </form>
        )}

        {/* Tabs Filter Bar */}
        <div className="border-b bg-background px-4 pt-2">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="h-9 w-full justify-start overflow-x-auto bg-transparent p-0 gap-1.5 scrollbar-none">
              <TabsTrigger
                value="ALL"
                className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-md px-3 text-xs"
              >
                All Notes
                <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-[10px]">
                  {counts.all}
                </Badge>
              </TabsTrigger>

              <TabsTrigger
                value="FORWARDED"
                className="data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 dark:data-[state=active]:bg-indigo-950/40 dark:data-[state=active]:text-indigo-300 rounded-md px-2.5 text-xs"
              >
                <ArrowRightLeft className="w-3 h-3 mr-1 text-indigo-500" />
                Forwarded
                <Badge variant="outline" className="ml-1.5 px-1.5 py-0 text-[10px]">
                  {counts.forwarded}
                </Badge>
              </TabsTrigger>

              <TabsTrigger
                value="DOCTOR"
                className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 dark:data-[state=active]:bg-blue-950/40 dark:data-[state=active]:text-blue-300 rounded-md px-2.5 text-xs"
              >
                <Stethoscope className="w-3 h-3 mr-1 text-blue-500" />
                Doctor
                <Badge variant="outline" className="ml-1.5 px-1.5 py-0 text-[10px]">
                  {counts.doctor}
                </Badge>
              </TabsTrigger>

              <TabsTrigger
                value="HANDLER"
                className="data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 dark:data-[state=active]:bg-emerald-950/40 dark:data-[state=active]:text-emerald-300 rounded-md px-2.5 text-xs"
              >
                <Activity className="w-3 h-3 mr-1 text-emerald-500" />
                Therapy
                <Badge variant="outline" className="ml-1.5 px-1.5 py-0 text-[10px]">
                  {counts.handler}
                </Badge>
              </TabsTrigger>

              <TabsTrigger
                value="RECEPTIONIST"
                className="data-[state=active]:bg-purple-50 data-[state=active]:text-purple-700 dark:data-[state=active]:bg-purple-950/40 dark:data-[state=active]:text-purple-300 rounded-md px-2.5 text-xs"
              >
                <UserCheck className="w-3 h-3 mr-1 text-purple-500" />
                Reception
                <Badge variant="outline" className="ml-1.5 px-1.5 py-0 text-[10px]">
                  {counts.receptionist}
                </Badge>
              </TabsTrigger>

              <TabsTrigger
                value="CASHIER"
                className="data-[state=active]:bg-amber-50 data-[state=active]:text-amber-700 dark:data-[state=active]:bg-amber-950/40 dark:data-[state=active]:text-amber-300 rounded-md px-2.5 text-xs"
              >
                <Receipt className="w-3 h-3 mr-1 text-amber-500" />
                Cashier
                <Badge variant="outline" className="ml-1.5 px-1.5 py-0 text-[10px]">
                  {counts.cashier}
                </Badge>
              </TabsTrigger>

              <TabsTrigger
                value="MEDICAL"
                className="data-[state=active]:bg-rose-50 data-[state=active]:text-rose-700 dark:data-[state=active]:bg-rose-950/40 dark:data-[state=active]:text-rose-300 rounded-md px-2.5 text-xs"
              >
                <FileText className="w-3 h-3 mr-1 text-rose-500" />
                Medical
                <Badge variant="outline" className="ml-1.5 px-1.5 py-0 text-[10px]">
                  {counts.medical}
                </Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Notes Scrollable List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[280px] max-h-[50vh]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <p className="text-sm">Loading visit notes...</p>
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <MessageSquare className="w-10 h-10 stroke-[1.2] text-muted-foreground/40 mb-2" />
              <p className="text-sm font-medium">No notes recorded in this category</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Click &quot;Add Note&quot; above to add a department or forwarded note.
              </p>
            </div>
          ) : (
            filteredNotes.map((note) => {
              const catCfg = CATEGORY_CONFIG[note.category] || CATEGORY_CONFIG.FORWARDED;
              const Icon = catCfg.icon;

              return (
                <Card
                  key={note.id}
                  className={`border-l-4 ${catCfg.borderClass} ${catCfg.bgClass} shadow-sm overflow-hidden`}
                >
                  <CardContent className="p-3.5 space-y-2">
                    {/* Top Row: Category Badge + Author + Station Transition + Time */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className={`${catCfg.badgeClass} gap-1 py-0 px-2`}>
                          <Icon className="w-3 h-3" />
                          {catCfg.label}
                        </Badge>

                        {note.originStation && note.targetStation && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-background px-1.5 py-0.5 rounded border text-muted-foreground">
                            <span>{note.originStation}</span>
                            <ArrowRightLeft className="w-2.5 h-2.5 text-primary" />
                            <span>{note.targetStation}</span>
                          </span>
                        )}

                        <span className="font-semibold text-foreground/90">
                          {note.authorName || "Staff"}
                        </span>
                        {note.authorRole && (
                          <span className="text-[10px] text-muted-foreground uppercase font-mono">
                            • {note.authorRole}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {formatTimestamp(note.createdAt)}
                      </div>
                    </div>

                    {/* Note Content */}
                    <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed font-normal bg-background/60 p-2.5 rounded border border-border/50">
                      {note.note}
                    </p>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 border-t bg-muted/10 text-xs text-muted-foreground flex items-center justify-between">
          <span>
            Total: <strong>{counts.all}</strong> notes recorded across all clinic stations
          </span>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Quick button component to trigger the PatientNotesDialog
 */
export function PatientNotesTriggerButton({
  patientId,
  patientName,
  patientMrn,
  visitId,
  appointmentId,
  defaultCategory,
  currentUserRole,
  currentUserName,
  currentUserId,
  currentStation,
  noteCount,
  variant = "outline",
  size = "sm",
  className,
}: {
  patientId: string;
  patientName: string;
  patientMrn?: string | null;
  visitId?: string | null;
  appointmentId?: string | null;
  defaultCategory?: NoteCategory;
  currentUserRole?: string;
  currentUserName?: string;
  currentUserId?: string;
  currentStation?: string;
  noteCount?: number;
  variant?: "outline" | "default" | "secondary" | "ghost";
  size?: "sm" | "default" | "icon";
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={className}
        title="View & Add Patient Notes"
      >
        <MessageSquare className="w-3.5 h-3.5 mr-1 text-primary" />
        Notes
        {typeof noteCount === "number" && noteCount > 0 && (
          <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px] font-bold">
            {noteCount}
          </Badge>
        )}
      </Button>

      <PatientNotesDialog
        isOpen={open}
        onOpenChange={setOpen}
        patientId={patientId}
        patientName={patientName}
        patientMrn={patientMrn}
        visitId={visitId}
        appointmentId={appointmentId}
        defaultCategory={defaultCategory}
        currentUserRole={currentUserRole}
        currentUserName={currentUserName}
        currentUserId={currentUserId}
        currentStation={currentStation}
      />
    </>
  );
}
