"use client";

import * as React from "react";
import {
  AdminTherapySlotsPageData,
  TherapySlotWithDetails,
  toggleTherapySlotActiveAction,
  updateTherapySlotStatusAction,
} from "@/actions/admin/slot.action";
import { SlotStatusBadge } from "@/components/admin/slots/slot-status-badge";
import { CreateSlotDialog } from "@/components/admin/slots/create-slot-dialog";
import { EditSlotDialog } from "@/components/admin/slots/edit-slot-dialog";
import { DeleteSlotDialog } from "@/components/admin/slots/delete-slot-dialog";
import { SeedSlotsDialog } from "@/components/admin/slots/seed-slots-dialog";
import {
  AuthorizeSlotActionDialog,
  type AuthorizeSlotActionConfig,
} from "@/components/admin/slots/authorize-slot-action-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Clock,
  Plus,
  Search,
  MoreVertical,
  Edit2,
  Trash2,
  Sparkles,
  RefreshCw,
  LayoutGrid,
  Table as TableIcon,
  Users,
  DoorOpen,
  CheckCircle2,
  ShieldAlert,
  RotateCcw,
  Copy,
  Check,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { SlotStatus } from "@/generated/prisma/enums";
import {
  WEEK_DAYS,
  formatWeekDays,
  isSlotActiveOnDay,
  type DayKey,
} from "@/lib/weekdays";
import { cn } from "@/lib/utils";

interface SlotManagementViewProps {
  initialData: AdminTherapySlotsPageData;
}

const STATUS_OPTIONS = [
  { value: "ALL", label: "All Statuses" },
  { value: SlotStatus.OPEN, label: "Open" },
  { value: SlotStatus.FULL, label: "Full" },
  { value: SlotStatus.BLOCKED, label: "Blocked" },
  { value: SlotStatus.CANCELLED, label: "Cancelled" },
] as const;

const STATE_OPTIONS = [
  { value: "ALL", label: "All States" },
  { value: "ACTIVE", label: "Active Daily" },
  { value: "INACTIVE", label: "Disabled" },
] as const;

const DAY_OPTIONS = [
  { value: "ALL", label: "All Week Days" },
  { value: "SATURDAY", label: "Saturday" },
  { value: "SUNDAY", label: "Sunday" },
  { value: "MONDAY", label: "Monday" },
  { value: "TUESDAY", label: "Tuesday" },
  { value: "WEDNESDAY", label: "Wednesday" },
  { value: "THURSDAY", label: "Thursday" },
  { value: "FRIDAY", label: "Friday" },
] as const;

export function SlotManagementView({ initialData }: SlotManagementViewProps) {
  const { slots, rooms, adminPerformers, stats } = initialData;

  // View state: 'table' or 'grid' (matching rooms page default 'table')
  const [viewMode, setViewMode] = React.useState<"table" | "grid">("table");

  // Filtering states
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");
  const [stateFilter, setStateFilter] = React.useState<string>("ALL");
  const [dayFilter, setDayFilter] = React.useState<string>("ALL");
  const [roomFilter, setRoomFilter] = React.useState<string>("ALL");

  // Modal dialog states
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [isSeedOpen, setIsSeedOpen] = React.useState(false);
  const [editingSlot, setEditingSlot] =
    React.useState<TherapySlotWithDetails | null>(null);
  const [deletingSlot, setDeletingSlot] =
    React.useState<TherapySlotWithDetails | null>(null);
  const [pendingAction, setPendingAction] =
    React.useState<AuthorizeSlotActionConfig | null>(null);
  const [lastPerformerId, setLastPerformerId] = React.useState<string>(() =>
    adminPerformers.length === 1 ? adminPerformers[0].id : "",
  );
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  // Transitions
  const [, startTransition] = React.useTransition();

  // Reset all filters
  const handleResetFilters = () => {
    setSearchQuery("");
    setStatusFilter("ALL");
    setStateFilter("ALL");
    setDayFilter("ALL");
    setRoomFilter("ALL");
  };

  const activeFiltersCount =
    (statusFilter !== "ALL" ? 1 : 0) +
    (stateFilter !== "ALL" ? 1 : 0) +
    (dayFilter !== "ALL" ? 1 : 0) +
    (roomFilter !== "ALL" ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0);

  // Quick Seed Handler
  const handleSeedDefaultSlots = () => {
    setIsSeedOpen(true);
  };

  // Core execution: Toggle active
  const executeToggleActive = async (
    slot: TherapySlotWithDetails,
    nextActive: boolean,
    adminPerformerId?: string,
  ): Promise<boolean> => {
    const res = await toggleTherapySlotActiveAction({
      slotId: slot.id,
      isActive: nextActive,
      adminPerformerId,
    });
    if (res.success) {
      toast.success(res.message);
      return true;
    } else {
      toast.error(res.message);
      return false;
    }
  };

  // Core execution: Change status
  const executeStatusChange = async (
    slot: TherapySlotWithDetails,
    newStatus: SlotStatus,
    adminPerformerId?: string,
  ): Promise<boolean> => {
    const res = await updateTherapySlotStatusAction({
      slotId: slot.id,
      status: newStatus,
      adminPerformerId,
    });
    if (res.success) {
      toast.success(res.message);
      return true;
    } else {
      toast.error(res.message);
      return false;
    }
  };

  // User trigger: Toggle active (prompts performer if multiple admins exist)
  const handleRequestToggleActive = (
    slot: TherapySlotWithDetails,
    nextActive: boolean,
  ) => {
    if (adminPerformers.length > 1) {
      setPendingAction({
        slot,
        actionType: "TOGGLE_ACTIVE",
        targetActive: nextActive,
      });
    } else {
      startTransition(async () => {
        await executeToggleActive(slot, nextActive, adminPerformers[0]?.id);
      });
    }
  };

  // User trigger: Change status (prompts performer if multiple admins exist)
  const handleRequestStatusChange = (
    slot: TherapySlotWithDetails,
    newStatus: SlotStatus,
  ) => {
    if (slot.status === newStatus) return;
    if (adminPerformers.length > 1) {
      setPendingAction({
        slot,
        actionType: "CHANGE_STATUS",
        targetStatus: newStatus,
      });
    } else {
      startTransition(async () => {
        await executeStatusChange(slot, newStatus, adminPerformers[0]?.id);
      });
    }
  };

  // Dialog confirmation callback
  const handleConfirmAuthorize = async (
    config: AuthorizeSlotActionConfig,
    adminPerformerId: string,
  ): Promise<boolean> => {
    setLastPerformerId(adminPerformerId);
    if (
      config.actionType === "TOGGLE_ACTIVE" &&
      config.targetActive !== undefined
    ) {
      return await executeToggleActive(
        config.slot,
        config.targetActive,
        adminPerformerId,
      );
    }
    if (config.actionType === "CHANGE_STATUS" && config.targetStatus) {
      return await executeStatusChange(
        config.slot,
        config.targetStatus,
        adminPerformerId,
      );
    }
    return false;
  };

  const handleCopySlotTiming = (timing: string) => {
    navigator.clipboard.writeText(timing).then(() => {
      setCopiedId(timing);
      toast.success(`Timing "${timing}" copied!`);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  // Filter options for rooms
  const roomFilterOptions = React.useMemo(
    () => [
      { value: "ALL", label: "All Rooms" },
      { value: "NONE", label: "General (No Room)" },
      ...rooms.map((r) => ({
        value: r.id,
        label: `Room ${r.number} (${r.purpose})`,
      })),
    ],
    [rooms],
  );

  // Filtered slots
  const filteredSlots = React.useMemo(() => {
    return slots.filter((slot) => {
      // Room match
      const roomMatches =
        slot.room &&
        (slot.room.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
          slot.room.purpose.toLowerCase().includes(searchQuery.toLowerCase()));

      // Search match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesSearch =
          slot.label.toLowerCase().includes(q) ||
          slot.startTime.includes(q) ||
          slot.endTime.includes(q) ||
          Boolean(roomMatches);
        if (!matchesSearch) return false;
      }

      // Status match
      if (statusFilter !== "ALL" && slot.status !== statusFilter) {
        return false;
      }

      // State match (Active / Inactive)
      if (stateFilter !== "ALL") {
        if (stateFilter === "ACTIVE" && !slot.isActive) return false;
        if (stateFilter === "INACTIVE" && slot.isActive) return false;
      }

      // Day of Week match
      if (dayFilter !== "ALL") {
        if (!isSlotActiveOnDay(slot.weekDays, dayFilter as DayKey)) {
          return false;
        }
      }

      // Room filter match
      if (roomFilter !== "ALL") {
        if (roomFilter === "NONE" && slot.roomId) return false;
        if (roomFilter !== "NONE" && slot.roomId !== roomFilter) return false;
      }

      return true;
    });
  }, [slots, searchQuery, statusFilter, stateFilter, dayFilter, roomFilter]);

  return (
    <div className="space-y-3">
      {/* ---------------------------------------------------- */}
      {/* 1. Header & Quick Actions                            */}
      {/* ---------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold">
              <Clock className="size-3.5" />
              Master Schedules
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10.5px] font-bold">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {stats.activeSlots} Active
            </span>
            {stats.totalSlots - stats.activeSlots > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/80 text-[10.5px] font-bold">
                {stats.totalSlots - stats.activeSlots} Disabled
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Therapy Slot Management
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Manage clinical therapy schedules, patient session quotas, and room
            assignments.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSeedDefaultSlots}
            className="gap-1.5 border-primary/40 hover:bg-primary/10 text-xs font-semibold cursor-pointer"
          >
            <Sparkles className="size-3.5 text-primary" />
            <span>Seed Standard Slots</span>
          </Button>

          <Button
            onClick={() => setIsCreateOpen(true)}
            size="sm"
            className="gap-1.5 shadow-sm font-semibold cursor-pointer"
          >
            <Plus className="size-4" />
            <span>Add Master Slot</span>
          </Button>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 2. KPI Telemetry Cards                               */}
      {/* ---------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Master Slots */}
        <Card className="border-border/80 bg-card/80 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Master Slots
            </CardTitle>
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Clock className="size-3.5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {stats.totalSlots}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Configured master time windows
            </p>
          </CardContent>
        </Card>

        {/* Ready / Active */}
        <Card className="border-border/80 bg-card/80 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Ready / Operating
            </CardTitle>
            <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="size-3.5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {stats.activeSlots}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {stats.totalSlots > 0
                ? `${Math.round((stats.activeSlots / stats.totalSlots) * 100)}% daily schedule operational`
                : "No slots configured"}
            </p>
          </CardContent>
        </Card>

        {/* Standard Capacity */}
        <Card className="border-border/80 bg-card/80 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Standard Capacity
            </CardTitle>
            <div className="flex size-7 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600">
              <Users className="size-3.5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {stats.totalRegularCapacity}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {stats.totalRegularMale} Male • {stats.totalRegularFemale} Female
              standard
            </p>
          </CardContent>
        </Card>

        {/* Standby Capacity */}
        <Card className="border-border/80 bg-card/80 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Standby Extra Quota
            </CardTitle>
            <div className="flex size-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
              <ShieldAlert className="size-3.5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              +{stats.totalExtraCapacity}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Emergency extra approval quota
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 3. Search, Filter Bar & View Mode Toggle             */}
      {/* ---------------------------------------------------- */}
      <Card className="border-border/80 bg-card/80 shadow-xs">
        <CardContent className="p-3.5 sm:p-4">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search slot label, timing, or room..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs h-9 bg-muted/20"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Dropdown Filters */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Status Filter */}
              <Select
                items={STATUS_OPTIONS}
                value={statusFilter}
                onValueChange={(val) => setStatusFilter(val || "ALL")}
              >
                <SelectTrigger className="w-[130px] h-9 text-xs rounded-xl border-border/80 bg-background shadow-xs">
                  <SelectValue placeholder="Status">
                    {(val: string | null) => {
                      const item = STATUS_OPTIONS.find((i) => i.value === val);
                      return item ? item.label : "All Status";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* State Filter (Active / Disabled) */}
              <Select
                items={STATE_OPTIONS}
                value={stateFilter}
                onValueChange={(val) => setStateFilter(val || "ALL")}
              >
                <SelectTrigger className="w-[125px] h-9 text-xs rounded-xl border-border/80 bg-background shadow-xs">
                  <SelectValue placeholder="State">
                    {(val: string | null) => {
                      const item = STATE_OPTIONS.find((i) => i.value === val);
                      return item ? item.label : "All State";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {STATE_OPTIONS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Week Day Filter */}
              <Select
                items={DAY_OPTIONS}
                value={dayFilter}
                onValueChange={(val) => setDayFilter(val || "ALL")}
              >
                <SelectTrigger className="w-[135px] h-9 text-xs rounded-xl border-border/80 bg-background shadow-xs">
                  <SelectValue placeholder="Week Day">
                    {(val: string | null) => {
                      const item = DAY_OPTIONS.find((i) => i.value === val);
                      return item ? item.label : "All Days";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {DAY_OPTIONS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Room Filter */}
              <Select
                items={roomFilterOptions}
                value={roomFilter}
                onValueChange={(val) => setRoomFilter(val || "ALL")}
              >
                <SelectTrigger className="w-[140px] h-9 text-xs rounded-xl border-border/80 bg-background shadow-xs">
                  <SelectValue placeholder="Room">
                    {(val: string | null) => {
                      const item = roomFilterOptions.find(
                        (i) => i.value === val,
                      );
                      return item ? item.label : "All Rooms";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {roomFilterOptions.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Reset Filters Button */}
              {activeFiltersCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetFilters}
                  className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1"
                >
                  <RotateCcw className="size-3" />
                  <span>Reset ({activeFiltersCount})</span>
                </Button>
              )}

              {/* View Toggle (Table / Grid) */}
              <div className="flex items-center border border-border/80 rounded-lg p-0.5 bg-muted/30 ml-auto sm:ml-0">
                <Button
                  variant={viewMode === "table" ? "secondary" : "ghost"}
                  size="icon"
                  className="size-7 rounded-md"
                  onClick={() => setViewMode("table")}
                  title="Table View"
                >
                  <TableIcon className="size-3.5" />
                </Button>
                <Button
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  size="icon"
                  className="size-7 rounded-md"
                  onClick={() => setViewMode("grid")}
                  title="Grid Cards View"
                >
                  <LayoutGrid className="size-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ---------------------------------------------------- */}
      {/* 4. Slots Presentation: Table View or Grid View       */}
      {/* ---------------------------------------------------- */}
      {filteredSlots.length === 0 ? (
        <Card className="border-dashed border-border/80 p-8 text-center bg-card/40">
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="size-12 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground">
              <Clock className="size-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-foreground">
                {slots.length === 0
                  ? "No Therapy Slots Configured Yet"
                  : "No Slots Match Your Filters"}
              </p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {slots.length === 0
                  ? "Predefine master hourly therapy slots once with standard quotas to power clinical scheduling."
                  : "Try loosening your search terms or resetting the status and room filters."}
              </p>
            </div>
            {slots.length === 0 ? (
              <div className="flex items-center gap-2 mt-2">
                <Button
                  onClick={handleSeedDefaultSlots}
                  variant="outline"
                  size="sm"
                  className="gap-1.5 cursor-pointer"
                >
                  <Sparkles className="size-3.5 text-primary" />
                  <span>Seed Standard Slots</span>
                </Button>
                <Button
                  onClick={() => setIsCreateOpen(true)}
                  size="sm"
                  className="gap-1.5"
                >
                  <Plus className="size-3.5" />
                  <span>Add First Slot</span>
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
                className="gap-1.5 mt-2"
              >
                <RotateCcw className="size-3.5" />
                <span>Clear All Filters</span>
              </Button>
            )}
          </div>
        </Card>
      ) : viewMode === "table" ? (
        /* TABLE VIEW (Default, styled like rooms table) */
        <Card className="border-border/80 bg-card/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[90px] font-bold text-xs">
                    Slot #
                  </TableHead>
                  <TableHead className="font-bold text-xs">
                    Timing &amp; Window
                  </TableHead>
                  <TableHead className="font-bold text-xs">
                    Operating Days
                  </TableHead>
                  <TableHead className="font-bold text-xs">
                    Assigned Room
                  </TableHead>
                  <TableHead className="font-bold text-xs">
                    Standard Quota
                  </TableHead>
                  <TableHead className="font-bold text-xs">
                    Standby Extra
                  </TableHead>
                  <TableHead className="font-bold text-xs">Status</TableHead>
                  <TableHead className="w-[100px] font-bold text-xs text-center">
                    Daily Active
                  </TableHead>
                  <TableHead className="w-[110px] font-bold text-xs text-center">
                    Quick Switch
                  </TableHead>
                  <TableHead className="w-[60px] text-right font-bold text-xs">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSlots.map((slot, idx) => {
                  const slotIndex = String(slot.order || idx + 1).padStart(
                    2,
                    "0",
                  );
                  return (
                    <TableRow
                      key={slot.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      {/* Slot Order / Number */}
                      <TableCell className="font-mono font-bold text-foreground">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-muted border border-border text-xs">
                            {slotIndex}
                          </span>
                          <button
                            onClick={() =>
                              handleCopySlotTiming(
                                `${slot.startTime} - ${slot.endTime}`,
                              )
                            }
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            title="Copy Slot Timing"
                          >
                            {copiedId ===
                            `${slot.startTime} - ${slot.endTime}` ? (
                              <Check className="size-3 text-emerald-500" />
                            ) : (
                              <Copy className="size-3" />
                            )}
                          </button>
                        </div>
                      </TableCell>

                      {/* Timing & Window */}
                      <TableCell>
                        <div className="space-y-0.5">
                          <span className="font-medium text-xs text-foreground block">
                            {slot.label}
                          </span>
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
                            <Clock className="size-3 text-primary/70" />
                            <span>
                              {slot.startTime} — {slot.endTime}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      {/* Operating Week Days */}
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                            <Calendar className="size-3 text-primary/80" />
                            <span>{formatWeekDays(slot.weekDays)}</span>
                          </div>
                          <div className="flex items-center gap-0.5">
                            {WEEK_DAYS.map((d) => {
                              const active = isSlotActiveOnDay(
                                slot.weekDays,
                                d.value,
                              );
                              return (
                                <span
                                  key={d.value}
                                  className={cn(
                                    "size-4 rounded text-[9px] flex items-center justify-center font-bold select-none",
                                    active
                                      ? "bg-primary/15 text-primary border border-primary/30"
                                      : "text-muted-foreground/30 bg-muted/20 border border-transparent",
                                  )}
                                  title={`${d.label}: ${active ? "Active" : "Off"}`}
                                >
                                  {d.short[0]}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </TableCell>

                      {/* Assigned Room */}
                      <TableCell>
                        {slot.room ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                            <DoorOpen className="size-3 text-blue-500" />
                            Room {slot.room.number}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-muted text-muted-foreground border border-border">
                            General / Any
                          </span>
                        )}
                      </TableCell>

                      {/* Regular Capacity */}
                      <TableCell>
                        <div className="flex items-center gap-2 text-xs font-semibold">
                          <span className="text-sky-600 dark:text-sky-400">
                            {slot.regularMaleCapacity} Male
                          </span>
                          <span className="text-muted-foreground font-normal">
                            •
                          </span>
                          <span className="text-pink-600 dark:text-pink-400">
                            {slot.regularFemaleCapacity} Female
                          </span>
                        </div>
                      </TableCell>

                      {/* Standby Extra Quota */}
                      <TableCell>
                        <span className="text-[11px] font-mono text-muted-foreground font-medium">
                          +{slot.extraMaleCapacity} M • +
                          {slot.extraFemaleCapacity} F
                        </span>
                      </TableCell>

                      {/* Status Badge */}
                      <TableCell>
                        <SlotStatusBadge status={slot.status} />
                      </TableCell>

                      {/* Daily Active Switch */}
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Switch
                            checked={slot.isActive}
                            onCheckedChange={(checked) =>
                              handleRequestToggleActive(slot, checked)
                            }
                            className="scale-75 cursor-pointer"
                          />
                          <span className="text-[11px] text-muted-foreground">
                            {slot.isActive ? "Active" : "Off"}
                          </span>
                        </div>
                      </TableCell>

                      {/* Quick Status Switch */}
                      <TableCell className="text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-[11px] px-2 gap-1 font-medium bg-background cursor-pointer"
                              >
                                <span>Change</span>
                              </Button>
                            }
                          />
                          <DropdownMenuContent
                            align="center"
                            className="text-xs"
                          >
                            <DropdownMenuGroup>
                              <DropdownMenuLabel className="text-[10px] uppercase font-bold text-muted-foreground">
                                Update Operational State
                              </DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() =>
                                  handleRequestStatusChange(
                                    slot,
                                    SlotStatus.OPEN,
                                  )
                                }
                                disabled={slot.status === SlotStatus.OPEN}
                                className="gap-2 cursor-pointer"
                              >
                                <span className="size-2 rounded-full bg-emerald-500" />
                                <span>Mark Open</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  handleRequestStatusChange(
                                    slot,
                                    SlotStatus.BLOCKED,
                                  )
                                }
                                disabled={slot.status === SlotStatus.BLOCKED}
                                className="gap-2 cursor-pointer"
                              >
                                <span className="size-2 rounded-full bg-rose-500" />
                                <span>Mark Blocked</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  handleRequestStatusChange(
                                    slot,
                                    SlotStatus.CANCELLED,
                                  )
                                }
                                disabled={slot.status === SlotStatus.CANCELLED}
                                className="gap-2 cursor-pointer"
                              >
                                <span className="size-2 rounded-full bg-zinc-500" />
                                <span>Mark Cancelled</span>
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>

                      {/* Actions Menu */}
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-muted-foreground hover:text-foreground cursor-pointer"
                              >
                                <MoreVertical className="size-4" />
                              </Button>
                            }
                          />
                          <DropdownMenuContent
                            align="end"
                            className="w-44 text-xs"
                          >
                            <DropdownMenuGroup>
                              <DropdownMenuItem
                                onClick={() => setEditingSlot(slot)}
                                className="gap-2 cursor-pointer"
                              >
                                <Edit2 className="size-3.5 text-primary" />
                                <span>Edit Slot</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  handleRequestToggleActive(
                                    slot,
                                    !slot.isActive,
                                  )
                                }
                                className="gap-2 cursor-pointer"
                              >
                                <RefreshCw className="size-3.5" />
                                <span>
                                  {slot.isActive ? "Deactivate" : "Activate"}
                                </span>
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeletingSlot(slot)}
                              className="gap-2 text-rose-600 focus:text-rose-600 cursor-pointer"
                            >
                              <Trash2 className="size-3.5" />
                              <span>Delete Slot</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      ) : (
        /* GRID CARDS VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredSlots.map((slot) => {
            return (
              <Card
                key={slot.id}
                className="border-border/80 bg-card/80 shadow-xs hover:border-border transition-all flex flex-col justify-between overflow-hidden"
              >
                {/* Card Header */}
                <CardHeader className="p-4 sm:p-5 pb-3 border-b border-border/60 flex flex-row items-start justify-between space-y-0 gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm sm:text-base font-bold text-foreground">
                        {slot.label}
                      </h3>
                      {!slot.isActive && (
                        <span className="px-1.5 py-0.2 rounded-md bg-muted text-muted-foreground border border-border text-[10px] font-medium">
                          Disabled
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                      <Clock className="size-3 text-primary/80" />
                      <span>
                        {slot.startTime} — {slot.endTime}
                      </span>
                      {slot.room && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-foreground font-sans">
                            <DoorOpen className="size-3 text-muted-foreground" />
                            Room {slot.room.number}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <SlotStatusBadge status={slot.status} />

                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            <MoreVertical className="size-4" />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end" className="w-44 text-xs">
                        <DropdownMenuLabel className="text-[10px] uppercase font-bold text-muted-foreground">
                          Slot Actions
                        </DropdownMenuLabel>
                        <DropdownMenuItem
                          onClick={() => setEditingSlot(slot)}
                          className="gap-2 cursor-pointer"
                        >
                          <Edit2 className="size-3.5" />
                          <span>Edit Slot</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            handleRequestToggleActive(slot, !slot.isActive)
                          }
                          className="gap-2 cursor-pointer"
                        >
                          <RefreshCw className="size-3.5" />
                          <span>
                            {slot.isActive ? "Deactivate" : "Activate"}
                          </span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setDeletingSlot(slot)}
                          className="gap-2 text-rose-600 focus:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="size-3.5" />
                          <span>Delete Slot</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>

                {/* Quota & Schedule Section */}
                <CardContent className="p-4 sm:p-5 space-y-3 flex-1">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-sky-600 dark:text-sky-400 font-semibold flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-sky-500" />
                        Male Quota
                      </span>
                      <span className="font-mono text-xs font-bold text-foreground">
                        {slot.regularMaleCapacity} regular
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-pink-600 dark:text-pink-400 font-semibold flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-pink-500" />
                        Female Quota
                      </span>
                      <span className="font-mono text-xs font-bold text-foreground">
                        {slot.regularFemaleCapacity} regular
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1 font-medium">
                      <ShieldAlert className="size-3 text-amber-500" />
                      Standby Extra Quota:
                    </span>
                    <span className="font-mono font-medium">
                      +{slot.extraMaleCapacity} M • +{slot.extraFemaleCapacity}{" "}
                      F
                    </span>
                  </div>

                  {/* Operating Days Mini Bar */}
                  <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Calendar className="size-3 text-primary/80" />
                      <span>{formatWeekDays(slot.weekDays)}</span>
                    </span>
                    <div className="flex items-center gap-0.5">
                      {WEEK_DAYS.map((d) => {
                        const active = isSlotActiveOnDay(
                          slot.weekDays,
                          d.value,
                        );
                        return (
                          <span
                            key={d.value}
                            className={cn(
                              "size-4 rounded text-[9px] flex items-center justify-center font-bold select-none",
                              active
                                ? "bg-primary/20 text-primary border border-primary/30"
                                : "text-muted-foreground/30 bg-muted/20",
                            )}
                            title={`${d.label}: ${active ? "Active" : "Off"}`}
                          >
                            {d.short[0]}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>

                {/* Card Footer */}
                <div className="px-4 sm:px-5 py-2.5 bg-muted/20 border-t border-border/60 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                    <Switch
                      checked={slot.isActive}
                      onCheckedChange={(checked) =>
                        handleRequestToggleActive(slot, checked)
                      }
                      className="scale-75 cursor-pointer"
                    />
                    <span>{slot.isActive ? "Active Daily" : "Disabled"}</span>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingSlot(slot)}
                    className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1 cursor-pointer"
                  >
                    <Edit2 className="size-3" />
                    <span>Edit</span>
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 5. Modals                                            */}
      {/* ---------------------------------------------------- */}
      <CreateSlotDialog
        isOpen={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        rooms={rooms}
        adminPerformers={adminPerformers}
      />

      <EditSlotDialog
        slot={editingSlot}
        isOpen={!!editingSlot}
        onOpenChange={(open) => !open && setEditingSlot(null)}
        rooms={rooms}
        adminPerformers={adminPerformers}
      />

      <DeleteSlotDialog
        slot={deletingSlot}
        isOpen={!!deletingSlot}
        onOpenChange={(open) => !open && setDeletingSlot(null)}
        adminPerformers={adminPerformers}
      />

      <AuthorizeSlotActionDialog
        config={pendingAction}
        isOpen={!!pendingAction}
        onOpenChange={(open) => !open && setPendingAction(null)}
        adminPerformers={adminPerformers}
        defaultPerformerId={lastPerformerId}
        onConfirm={handleConfirmAuthorize}
      />

      <SeedSlotsDialog
        isOpen={isSeedOpen}
        onOpenChange={setIsSeedOpen}
        adminPerformers={adminPerformers}
        defaultPerformerId={lastPerformerId}
        onSuccess={(performerId) => setLastPerformerId(performerId)}
      />
    </div>
  );
}
