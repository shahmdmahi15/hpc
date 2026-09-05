"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  RoomAccessType,
  RoomGender,
  RoomStatus,
} from "@/generated/prisma/enums";
import type { Room } from "@/generated/prisma/client";
import type { AdminRoomsPageData } from "@/actions/admin/room.action";
import { updateRoomStatusAction } from "@/actions/admin/room.action";
import {
  RoomStatusBadge,
  RoomAccessBadge,
  RoomGenderBadge,
} from "@/components/admin/rooms/room-status-badge";
import { CreateRoomDialog } from "@/components/admin/rooms/create-room-dialog";
import { EditRoomDialog } from "@/components/admin/rooms/edit-room-dialog";
import { DeleteRoomDialog } from "@/components/admin/rooms/delete-room-dialog";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DoorOpen,
  Plus,
  Search,
  RotateCcw,
  MoreVertical,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  LayoutGrid,
  Table as TableIcon,
  Copy,
  Check,
} from "lucide-react";

interface RoomManagementViewProps {
  initialData: AdminRoomsPageData;
}

const STATUS_OPTIONS = [
  { value: "ALL", label: "All Statuses" },
  { value: RoomStatus.AVAILABLE, label: "Available" },
  { value: RoomStatus.OCCUPIED, label: "Occupied" },
  { value: RoomStatus.MAINTENANCE, label: "Maintenance" },
] as const;

const ACCESS_OPTIONS = [
  { value: "ALL", label: "All Access" },
  { value: RoomAccessType.PUBLIC, label: "Public" },
  { value: RoomAccessType.STAFF, label: "Staff Only" },
  { value: RoomAccessType.DOCTOR, label: "Doctor" },
] as const;

const GENDER_OPTIONS = [
  { value: "ALL", label: "All Genders" },
  { value: RoomGender.COMMON, label: "Common" },
  { value: RoomGender.MALE, label: "Male" },
  { value: RoomGender.FEMALE, label: "Female" },
] as const;

export function RoomManagementView({ initialData }: RoomManagementViewProps) {
  const router = useRouter();
  const { rooms, adminPerformers, stats } = initialData;

  // View Mode: 'table' or 'grid'
  const [viewMode, setViewMode] = React.useState<"table" | "grid">("table");

  // Filtering states
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");
  const [accessFilter, setAccessFilter] = React.useState<string>("ALL");
  const [genderFilter, setGenderFilter] = React.useState<string>("ALL");

  // Modals
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [editingRoom, setEditingRoom] = React.useState<Room | null>(null);
  const [deletingRoom, setDeletingRoom] = React.useState<Room | null>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  // Filtered rooms
  const filteredRooms = React.useMemo(() => {
    return rooms.filter((r) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesSearch =
          r.number.toLowerCase().includes(q) ||
          r.purpose.toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }

      // Status
      if (statusFilter !== "ALL" && r.status !== statusFilter) {
        return false;
      }

      // Access Type
      if (accessFilter !== "ALL" && r.accessType !== accessFilter) {
        return false;
      }

      // Gender
      if (genderFilter !== "ALL" && r.gender !== genderFilter) {
        return false;
      }

      return true;
    });
  }, [rooms, searchQuery, statusFilter, accessFilter, genderFilter]);

  const activeFiltersCount =
    (statusFilter !== "ALL" ? 1 : 0) +
    (accessFilter !== "ALL" ? 1 : 0) +
    (genderFilter !== "ALL" ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0);

  const handleResetFilters = () => {
    setSearchQuery("");
    setStatusFilter("ALL");
    setAccessFilter("ALL");
    setGenderFilter("ALL");
  };

  const handleCopyNumber = (num: string) => {
    navigator.clipboard.writeText(num).then(() => {
      setCopiedId(num);
      toast.success(`Room "${num}" copied to clipboard!`);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleQuickStatusChange = async (room: Room, newStatus: RoomStatus) => {
    if (room.status === newStatus) return;

    // If multiple admin performers exist, notify user to use Edit dialog for authorization attribution
    if (adminPerformers.length > 1) {
      toast.info(
        "Multiple administrators exist. Please use 'Edit Room' to specify authorizer.",
      );
      setEditingRoom(room);
      return;
    }

    const formData = new FormData();
    formData.append("id", room.id);
    formData.append("status", newStatus);
    if (adminPerformers.length === 1) {
      formData.append("performerId", adminPerformers[0].id);
    }

    const res = await updateRoomStatusAction(undefined, formData);
    if (res.success) {
      toast.success(res.message);
      router.refresh();
    } else {
      toast.error(res.message);
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* ---------------------------------------------------- */}
      {/* 1. Header & Quick Actions                            */}
      {/* ---------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold">
              <DoorOpen className="size-3.5" />
              Facility Inventory
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10.5px] font-bold">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {stats.available} Available
            </span>
            {stats.occupied > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[10.5px] font-bold">
                {stats.occupied} In Use
              </span>
            )}
            {stats.maintenance > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-[10.5px] font-bold">
                {stats.maintenance} Offline
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Room &amp; Station Management
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Manage hospital consultation rooms, clinical stations, and physical
            facility inventory.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            onClick={() => setCreateDialogOpen(true)}
            size="sm"
            className="gap-1.5 shadow-sm font-semibold cursor-pointer"
          >
            <Plus className="size-4" />
            <span>Register Room</span>
          </Button>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 2. KPI Telemetry Cards                               */}
      {/* ---------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Rooms */}
        <Card className="border-border/80 bg-card/80 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Facility Rooms
            </CardTitle>
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <DoorOpen className="size-3.5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {stats.total}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Registered clinical &amp; public spaces
            </p>
          </CardContent>
        </Card>

        {/* Available Rooms */}
        <Card className="border-border/80 bg-card/80 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Ready / Available
            </CardTitle>
            <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="size-3.5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {stats.available}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {stats.total > 0
                ? `${Math.round((stats.available / stats.total) * 100)}% facility capacity available`
                : "No rooms registered"}
            </p>
          </CardContent>
        </Card>

        {/* Occupied Rooms */}
        <Card className="border-border/80 bg-card/80 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Active / In-Use
            </CardTitle>
            <div className="flex size-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
              <Clock className="size-3.5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {stats.occupied}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Ongoing consultation &amp; services
            </p>
          </CardContent>
        </Card>

        {/* Maintenance / Service */}
        <Card className="border-border/80 bg-card/80 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Maintenance / Offline
            </CardTitle>
            <div className="flex size-7 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600">
              <AlertTriangle className="size-3.5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
              {stats.maintenance}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Sanitation or technical repairs
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
                placeholder="Search by room number, purpose, or title..."
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
                <SelectTrigger className="w-[140px] h-9 text-xs rounded-xl border-border/80 bg-background shadow-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Access Type Filter */}
              <Select
                items={ACCESS_OPTIONS}
                value={accessFilter}
                onValueChange={(val) => setAccessFilter(val || "ALL")}
              >
                <SelectTrigger className="w-[135px] h-9 text-xs rounded-xl border-border/80 bg-background shadow-xs">
                  <SelectValue placeholder="Access Type" />
                </SelectTrigger>
                <SelectContent>
                  {ACCESS_OPTIONS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Gender Filter */}
              <Select
                items={GENDER_OPTIONS}
                value={genderFilter}
                onValueChange={(val) => setGenderFilter(val || "ALL")}
              >
                <SelectTrigger className="w-[130px] h-9 text-xs rounded-xl border-border/80 bg-background shadow-xs">
                  <SelectValue placeholder="Gender" />
                </SelectTrigger>
                <SelectContent>
                  {GENDER_OPTIONS.map((item) => (
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
      {/* 4. Rooms Presentation: Table View or Grid View       */}
      {/* ---------------------------------------------------- */}
      {filteredRooms.length === 0 ? (
        <Card className="border-dashed border-border/80 p-8 text-center bg-card/40">
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="size-12 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground">
              <DoorOpen className="size-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-foreground">
                {rooms.length === 0
                  ? "No Rooms Registered Yet"
                  : "No Rooms Match Your Filters"}
              </p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {rooms.length === 0
                  ? "Get started by registering your hospital's consultation rooms, labs, or administrative spaces."
                  : "Try loosening your search terms or resetting the status and access filters."}
              </p>
            </div>
            {rooms.length === 0 ? (
              <Button
                onClick={() => setCreateDialogOpen(true)}
                size="sm"
                className="gap-1.5 mt-2"
              >
                <Plus className="size-3.5" />
                <span>Register First Room</span>
              </Button>
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
        /* TABLE VIEW */
        <Card className="border-border/80 bg-card/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[120px] font-bold text-xs">
                    Room #
                  </TableHead>
                  <TableHead className="font-bold text-xs">
                    Purpose / Service
                  </TableHead>
                  <TableHead className="font-bold text-xs">
                    Access Type
                  </TableHead>
                  <TableHead className="font-bold text-xs">Gender</TableHead>
                  <TableHead className="font-bold text-xs">Status</TableHead>
                  <TableHead className="w-[140px] font-bold text-xs text-center">
                    Quick Switch
                  </TableHead>
                  <TableHead className="w-[80px] text-right font-bold text-xs">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRooms.map((room) => (
                  <TableRow
                    key={room.id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    {/* Room Number */}
                    <TableCell className="font-mono font-bold text-foreground">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-muted border border-border text-xs">
                          {room.number}
                        </span>
                        <button
                          onClick={() => handleCopyNumber(room.number)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          title="Copy Room Number"
                        >
                          {copiedId === room.number ? (
                            <Check className="size-3 text-emerald-500" />
                          ) : (
                            <Copy className="size-3" />
                          )}
                        </button>
                      </div>
                    </TableCell>

                    {/* Purpose */}
                    <TableCell>
                      <span className="font-medium text-xs text-foreground">
                        {room.purpose}
                      </span>
                    </TableCell>

                    {/* Access Type */}
                    <TableCell>
                      <RoomAccessBadge accessType={room.accessType} />
                    </TableCell>

                    {/* Gender */}
                    <TableCell>
                      <RoomGenderBadge gender={room.gender} />
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      <RoomStatusBadge status={room.status} />
                    </TableCell>

                    {/* Quick Status Dropdown */}
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
                        <DropdownMenuContent align="center" className="text-xs">
                          <DropdownMenuGroup>
                            <DropdownMenuLabel className="text-[10px] uppercase font-bold text-muted-foreground">
                              Update Operational State
                            </DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() =>
                                handleQuickStatusChange(
                                  room,
                                  RoomStatus.AVAILABLE,
                                )
                              }
                              disabled={room.status === RoomStatus.AVAILABLE}
                              className="gap-2"
                            >
                              <span className="size-2 rounded-full bg-emerald-500" />
                              <span>Mark Available</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                handleQuickStatusChange(
                                  room,
                                  RoomStatus.OCCUPIED,
                                )
                              }
                              disabled={room.status === RoomStatus.OCCUPIED}
                              className="gap-2"
                            >
                              <span className="size-2 rounded-full bg-amber-500" />
                              <span>Mark Occupied</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                handleQuickStatusChange(
                                  room,
                                  RoomStatus.MAINTENANCE,
                                )
                              }
                              disabled={room.status === RoomStatus.MAINTENANCE}
                              className="gap-2 text-destructive focus:text-destructive"
                            >
                              <span className="size-2 rounded-full bg-rose-500" />
                              <span>Mark Maintenance</span>
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
                              className="size-8 cursor-pointer"
                            >
                              <MoreVertical className="size-4" />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end" className="text-xs">
                          <DropdownMenuItem
                            onClick={() => setEditingRoom(room)}
                            className="gap-2"
                          >
                            <Edit3 className="size-3.5 text-primary" />
                            <span>Edit Room Details</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setDeletingRoom(room)}
                            className="gap-2 text-destructive focus:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                            <span>Delete Room</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      ) : (
        /* GRID / CARDS VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRooms.map((room) => (
            <Card
              key={room.id}
              className="border-border/80 bg-card/80 shadow-xs hover:border-primary/40 transition-all group flex flex-col justify-between"
            >
              <CardHeader className="p-4 pb-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="size-8 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-mono font-bold text-xs">
                      {room.number}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground leading-tight">
                        Room {room.number}
                      </h3>
                      <p className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                        {room.purpose}
                      </p>
                    </div>
                  </div>

                  <RoomStatusBadge status={room.status} />
                </div>
              </CardHeader>

              <CardContent className="p-4 pt-0 space-y-3">
                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/60">
                  <RoomAccessBadge accessType={room.accessType} />
                  <RoomGenderBadge gender={room.gender} />
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-between pt-3 border-t border-border/60 gap-2">
                  <div className="flex items-center gap-1">
                    <Button
                      variant={
                        room.status === RoomStatus.AVAILABLE
                          ? "secondary"
                          : "ghost"
                      }
                      size="sm"
                      onClick={() =>
                        handleQuickStatusChange(room, RoomStatus.AVAILABLE)
                      }
                      className="h-6 text-[10px] px-1.5 rounded"
                      title="Set Available"
                    >
                      Avail
                    </Button>
                    <Button
                      variant={
                        room.status === RoomStatus.OCCUPIED
                          ? "secondary"
                          : "ghost"
                      }
                      size="sm"
                      onClick={() =>
                        handleQuickStatusChange(room, RoomStatus.OCCUPIED)
                      }
                      className="h-6 text-[10px] px-1.5 rounded"
                      title="Set Occupied"
                    >
                      In-Use
                    </Button>
                    <Button
                      variant={
                        room.status === RoomStatus.MAINTENANCE
                          ? "secondary"
                          : "ghost"
                      }
                      size="sm"
                      onClick={() =>
                        handleQuickStatusChange(room, RoomStatus.MAINTENANCE)
                      }
                      className="h-6 text-[10px] px-1.5 rounded"
                      title="Set Maintenance"
                    >
                      Maint
                    </Button>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-foreground"
                      onClick={() => setEditingRoom(room)}
                      title="Edit Room"
                    >
                      <Edit3 className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeletingRoom(room)}
                      title="Delete Room"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 5. Modals & Dialogs                                  */}
      {/* ---------------------------------------------------- */}
      <CreateRoomDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        adminPerformers={adminPerformers}
        onRoomCreated={() => router.refresh()}
      />

      <EditRoomDialog
        room={editingRoom}
        open={!!editingRoom}
        onOpenChange={(open) => !open && setEditingRoom(null)}
        adminPerformers={adminPerformers}
        onRoomUpdated={() => {
          setEditingRoom(null);
          router.refresh();
        }}
      />

      <DeleteRoomDialog
        room={deletingRoom}
        open={!!deletingRoom}
        onOpenChange={(open) => !open && setDeletingRoom(null)}
        adminPerformers={adminPerformers}
        onRoomDeleted={() => {
          setDeletingRoom(null);
          router.refresh();
        }}
      />
    </div>
  );
}
