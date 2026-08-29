"use client";

import * as React from "react";
import { useRealtime } from "@/hooks/use-realtime";
import {
  getAdminRooms,
  createRoom,
  updateRoom,
  deleteRoom,
  toggleRoomStatus,
  toggleRoomStaffOnly,
} from "@/actions/rooms";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DoorOpen,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Users,
  BedDouble,
  RefreshCw,
  Lock,
  Unlock,
  Stethoscope,
} from "lucide-react";

import { compareRoomNumbers } from "@/lib/rooms";
import { toast } from "sonner";

type AdminRoom = NonNullable<Awaited<ReturnType<typeof getAdminRooms>>>[number];

export function RoomManagementPanel({
  initialRooms = [],
}: {
  initialRooms?: Awaited<ReturnType<typeof getAdminRooms>>;
}) {
  const [rooms, setRooms] = React.useState(initialRooms);
  const [filterView, setFilterView] = React.useState<
    "ALL" | "THERAPY" | "DOCTOR_ONLY" | "STAFF_ONLY" | "INACTIVE"
  >("ALL");
  const [isPending, startTransition] = React.useTransition();
  const [errorMessage, setErrorMessage] = React.useState("");
  const [successMessage, setSuccessMessage] = React.useState("");

  // Modals
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [editingRoom, setEditingRoom] = React.useState<AdminRoom | null>(null);

  // Create Form State
  const [createForm, setCreateForm] = React.useState<{
    roomNumber: string;
    name: string;
    purpose: string;
    type: string;
    capacity: number;
    genderPreference: "ALL" | "MALE" | "FEMALE";
    floor: string;
    notes: string;
    accessLevel: "PUBLIC" | "DOCTOR_ONLY" | "STAFF_ONLY";
  }>({
    roomNumber: "",
    name: "",
    purpose: "Physiotherapy & Modalities",
    type: "THERAPY_BAY",
    capacity: 2,
    genderPreference: "ALL",
    floor: "2nd Floor",
    notes: "",
    accessLevel: "PUBLIC",
  });

  // Edit Form State
  const [editForm, setEditForm] = React.useState<{
    roomNumber: string;
    name: string;
    purpose: string;
    type: string;
    capacity: number;
    genderPreference: "ALL" | "MALE" | "FEMALE";
    floor: string;
    notes: string;
    isActive: boolean;
    accessLevel: "PUBLIC" | "DOCTOR_ONLY" | "STAFF_ONLY";
  }>({
    roomNumber: "",
    name: "",
    purpose: "",
    type: "THERAPY_BAY",
    capacity: 2,
    genderPreference: "ALL",
    floor: "2nd Floor",
    notes: "",
    isActive: true,
    accessLevel: "PUBLIC",
  });

  const loadRooms = React.useCallback(() => {
    startTransition(async () => {
      try {
        const res = await getAdminRooms();
        setRooms(res);
      } catch (err) {
        console.error("Failed to load rooms", err);
      }
    });
  }, []);

  React.useEffect(() => {
    if (rooms.length === 0) {
      loadRooms();
    }
  }, [rooms.length, loadRooms]);

  useRealtime({
    onRefresh: loadRooms,
  });

  // Handle Create Room
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!createForm.roomNumber || !createForm.name) {
      setErrorMessage("Room Number and Room Name are required.");
      return;
    }

    const isStaffOnly = createForm.accessLevel === "STAFF_ONLY";
    const type =
      createForm.accessLevel === "DOCTOR_ONLY"
        ? "DOCTOR"
        : createForm.accessLevel === "STAFF_ONLY"
          ? "STAFF_ONLY"
          : "THERAPY_BAY";
    const purpose =
      createForm.accessLevel === "DOCTOR_ONLY" &&
      (!createForm.purpose ||
        createForm.purpose === "Physiotherapy & Modalities")
        ? "Doctor Consultation"
        : createForm.purpose;

    const res = await createRoom({
      roomNumber: createForm.roomNumber,
      name: createForm.name,
      purpose,
      type,
      capacity: Number(createForm.capacity) || 0,
      genderPreference: createForm.genderPreference,
      floor: createForm.floor,
      notes: createForm.notes,
      isStaffOnly,
    });

    if (res.error) {
      setErrorMessage(res.error);
      return;
    }

    setSuccessMessage(`Room "${createForm.roomNumber}" created successfully!`);
    setIsCreateOpen(false);
    setCreateForm({
      roomNumber: "",
      name: "",
      purpose: "Physiotherapy & Modalities",
      type: "THERAPY_BAY",
      capacity: 2,
      genderPreference: "ALL",
      floor: "2nd Floor",
      notes: "",
      accessLevel: "PUBLIC",
    });
    loadRooms();
  };

  // Open Edit Modal
  const handleOpenEdit = (room: AdminRoom) => {
    setEditingRoom(room);
    const isDoc =
      room.type === "DOCTOR" ||
      room.type === "CONSULTATION" ||
      (room.purpose && room.purpose.toLowerCase().includes("doctor")) ||
      (room.purpose && room.purpose.toLowerCase().includes("consultation"));
    const accessLevel = room.isStaffOnly
      ? "STAFF_ONLY"
      : isDoc
        ? "DOCTOR_ONLY"
        : "PUBLIC";

    setEditForm({
      roomNumber: room.roomNumber,
      name: room.name,
      purpose: room.purpose || "Physiotherapy & Modalities",
      type: room.type || "THERAPY_BAY",
      capacity: room.capacity !== undefined ? room.capacity : 2,
      genderPreference:
        (room.genderPreference as "ALL" | "MALE" | "FEMALE") || "ALL",
      floor: room.floor || "2nd Floor",
      notes: room.notes || "",
      isActive: room.isActive,
      accessLevel,
    });
    setErrorMessage("");
    setIsEditOpen(true);
  };

  // Handle Update Room
  const handleUpdateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoom) return;
    setErrorMessage("");
    setSuccessMessage("");

    const isStaffOnly = editForm.accessLevel === "STAFF_ONLY";
    const type =
      editForm.accessLevel === "DOCTOR_ONLY"
        ? "DOCTOR"
        : editForm.accessLevel === "STAFF_ONLY"
          ? "STAFF_ONLY"
          : "THERAPY_BAY";

    const res = await updateRoom(editingRoom.id, {
      roomNumber: editForm.roomNumber,
      name: editForm.name,
      purpose: editForm.purpose,
      type,
      capacity: Number(editForm.capacity) || 0,
      genderPreference: editForm.genderPreference,
      floor: editForm.floor,
      notes: editForm.notes,
      isActive: editForm.isActive,
      isStaffOnly,
    });

    if (res.error) {
      setErrorMessage(res.error);
      return;
    }

    setSuccessMessage(`Room "${editForm.roomNumber}" updated successfully!`);
    setIsEditOpen(false);
    setEditingRoom(null);
    loadRooms();
  };

  // Handle Delete Room
  const handleDeleteRoom = async (room: AdminRoom) => {
    const res = await deleteRoom(room.id);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`Room "${room.roomNumber}" deleted successfully.`);
    loadRooms();
  };

  // Handle Toggle Status (Active / Inactive)
  const handleToggleStatus = async (room: AdminRoom) => {
    await toggleRoomStatus(room.id, !room.isActive);
    toast.success(`Room "${room.roomNumber}" status updated.`);
    loadRooms();
  };

  // Handle Toggle Staff Only
  const handleToggleStaffOnly = async (room: AdminRoom) => {
    await toggleRoomStaffOnly(room.id, !room.isStaffOnly);
    loadRooms();
  };

  const isDoctorRoom = (r: AdminRoom) =>
    r.type === "DOCTOR" ||
    r.type === "CONSULTATION" ||
    (r.purpose && r.purpose.toLowerCase().includes("doctor")) ||
    (r.purpose && r.purpose.toLowerCase().includes("consultation"));

  const totalRooms = rooms.length;
  const doctorRoomsCount = rooms.filter(
    (r) => r.isActive && isDoctorRoom(r),
  ).length;
  const staffOnlyCount = rooms.filter((r) => r.isStaffOnly).length;
  const therapyRoomsCount = rooms.filter(
    (r) => r.isActive && !r.isStaffOnly && !isDoctorRoom(r),
  ).length;
  const totalBeds = rooms.reduce((acc, r) => acc + (r.capacity || 0), 0);

  const filteredRooms = React.useMemo(() => {
    let list = rooms;
    if (filterView === "THERAPY") {
      list = rooms.filter(
        (r) => r.isActive && !r.isStaffOnly && !isDoctorRoom(r),
      );
    } else if (filterView === "DOCTOR_ONLY") {
      list = rooms.filter((r) => r.isActive && isDoctorRoom(r));
    } else if (filterView === "STAFF_ONLY") {
      list = rooms.filter((r) => r.isStaffOnly);
    } else if (filterView === "INACTIVE") {
      list = rooms.filter((r) => !r.isActive);
    }

    return list
      .slice()
      .sort((a, b) => compareRoomNumbers(a.roomNumber, b.roomNumber));
  }, [rooms, filterView]);

  return (
    <div className="space-y-3 w-full max-w-full min-w-0">
      {/* Top Admin Summary Row (Compact & High Density) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 min-w-0">
        <Card className="p-2 sm:p-2.5 shadow-xs border-border bg-card">
          <div className="flex items-center justify-between text-muted-foreground text-[10px] sm:text-[11px] font-semibold uppercase">
            <span>Total Rooms</span>
            <DoorOpen className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-lg sm:text-xl font-black mt-0.5 font-mono text-foreground">
            {totalRooms}
          </p>
          <span className="text-[9px] sm:text-[10px] text-muted-foreground">
            All registered
          </span>
        </Card>

        <Card className="p-2 sm:p-2.5 shadow-xs border-border bg-card">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-[10px] sm:text-[11px] font-semibold uppercase">
            <span>Therapy Bays</span>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <p className="text-lg sm:text-xl font-black mt-0.5 font-mono text-emerald-600 dark:text-emerald-400">
            {therapyRoomsCount}
          </p>
          <span className="text-[9px] sm:text-[10px] text-muted-foreground">
            Public rehab bays
          </span>
        </Card>

        <Card className="p-2 sm:p-2.5 shadow-xs border-border bg-card">
          <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 text-[10px] sm:text-[11px] font-semibold uppercase">
            <span>Doctor Chambers</span>
            <Stethoscope className="h-3.5 w-3.5 text-blue-500" />
          </div>
          <p className="text-lg sm:text-xl font-black mt-0.5 font-mono text-blue-600 dark:text-blue-400">
            {doctorRoomsCount}
          </p>
          <span className="text-[9px] sm:text-[10px] text-muted-foreground">
            Consultation rooms
          </span>
        </Card>

        <Card className="p-2 sm:p-2.5 shadow-xs border-border bg-card">
          <div className="flex items-center justify-between text-purple-600 dark:text-purple-400 text-[10px] sm:text-[11px] font-semibold uppercase">
            <span>Staff Only</span>
            <Lock className="h-3.5 w-3.5 text-purple-500" />
          </div>
          <p className="text-lg sm:text-xl font-black mt-0.5 font-mono text-purple-600 dark:text-purple-400">
            {staffOnlyCount}
          </p>
          <span className="text-[9px] sm:text-[10px] text-muted-foreground">
            Staff &amp; prep bays
          </span>
        </Card>

        <Card className="p-2 sm:p-2.5 shadow-xs border-border bg-card col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-primary text-[10px] sm:text-[11px] font-semibold uppercase">
            <span>Clinic Beds</span>
            <BedDouble className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-lg sm:text-xl font-black mt-0.5 font-mono text-primary">
            {totalBeds}
          </p>
          <span className="text-[9px] sm:text-[10px] text-muted-foreground">
            Across active bays
          </span>
        </Card>
      </div>

      {/* Control Header & Add Room Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-card p-1.5 sm:p-2 rounded-xl border border-border shadow-xs max-w-full min-w-0">
        <div className="flex items-center gap-1 flex-wrap">
          <Button
            size="sm"
            variant={filterView === "ALL" ? "default" : "outline"}
            onClick={() => setFilterView("ALL")}
            className="text-xs h-7 px-2.5 cursor-pointer font-semibold"
          >
            All ({rooms.length})
          </Button>
          <Button
            size="sm"
            variant={filterView === "THERAPY" ? "default" : "outline"}
            onClick={() => setFilterView("THERAPY")}
            className="text-xs h-7 px-2.5 cursor-pointer font-semibold"
          >
            Therapy Bays ({therapyRoomsCount})
          </Button>
          <Button
            size="sm"
            variant={filterView === "DOCTOR_ONLY" ? "default" : "outline"}
            onClick={() => setFilterView("DOCTOR_ONLY")}
            className="text-xs h-7 px-2.5 cursor-pointer font-semibold gap-1 text-blue-600 dark:text-blue-400"
          >
            <Stethoscope className="h-3 w-3" />
            <span>Doctor Chambers ({doctorRoomsCount})</span>
          </Button>
          <Button
            size="sm"
            variant={filterView === "STAFF_ONLY" ? "default" : "outline"}
            onClick={() => setFilterView("STAFF_ONLY")}
            className="text-xs h-7 px-2.5 cursor-pointer font-semibold gap-1"
          >
            <Lock className="h-3 w-3" />
            <span>Staff Only ({staffOnlyCount})</span>
          </Button>
          <Button
            size="sm"
            variant={filterView === "INACTIVE" ? "default" : "outline"}
            onClick={() => setFilterView("INACTIVE")}
            className="text-xs h-7.5 cursor-pointer font-semibold"
          >
            Inactive ({rooms.filter((r) => !r.isActive).length})
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={loadRooms}
            className="text-xs h-8 cursor-pointer gap-1.5"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isPending ? "animate-spin text-primary" : ""}`}
            />
            <span>Refresh</span>
          </Button>

          <Button
            size="sm"
            onClick={() => {
              setErrorMessage("");
              setIsCreateOpen(true);
            }}
            className="text-xs h-8 cursor-pointer font-bold bg-primary text-primary-foreground gap-1.5 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Add New Room</span>
          </Button>
        </div>
      </div>

      {/* Feedback Messages */}
      {successMessage && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Rooms Table */}
      <Card className="shadow-md border-border bg-card">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                  <th className="p-3.5 w-20">Room No</th>
                  <th className="p-3.5">Chamber Name &amp; Purpose</th>
                  <th className="p-3.5">Bed Capacity</th>
                  <th className="p-3.5">Floor / Location</th>
                  <th className="p-3.5">Gender Filter</th>
                  <th className="p-3.5">Access Permission</th>
                  <th className="p-3.5">Active Status</th>
                  <th className="p-3.5 text-right">Admin Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredRooms.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No rooms found matching this filter.
                    </td>
                  </tr>
                ) : (
                  filteredRooms.map((room) => (
                    <tr
                      key={room.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      {/* Room Number */}
                      <td className="p-3.5 font-mono font-black text-sm text-foreground">
                        <span className="flex items-center justify-center h-8 w-10 rounded-lg bg-primary/10 text-primary border border-primary/20">
                          {room.roomNumber}
                        </span>
                      </td>

                      {/* Name & Purpose */}
                      <td className="p-3.5">
                        <div className="font-bold text-foreground text-sm flex items-center gap-1.5">
                          <span>{room.name}</span>
                          {room.isStaffOnly && (
                            <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-[9px] px-1.5 py-0 h-4">
                              🔒 Staff Only
                            </Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {room.purpose} {room.notes ? `• ${room.notes}` : ""}
                        </div>
                      </td>

                      {/* Bed Capacity */}
                      <td className="p-3.5">
                        {room.capacity === 0 ? (
                          <>
                            <div className="font-bold font-mono text-muted-foreground flex items-center gap-1.5">
                              <Users className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>0 Beds</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                              Chair / Consultation Only
                            </span>
                          </>
                        ) : (
                          <>
                            <div className="font-bold font-mono text-foreground flex items-center gap-1.5">
                              <BedDouble className="h-3.5 w-3.5 text-primary" />
                              <span>{room.capacity} Bed(s)</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                              Max concurrent
                            </span>
                          </>
                        )}
                      </td>

                      {/* Floor */}
                      <td className="p-3.5 text-muted-foreground font-medium">
                        {room.floor}
                      </td>

                      {/* Gender Filter */}
                      <td className="p-3.5">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold ${
                            room.genderPreference === "MALE"
                              ? "border-blue-500/40 text-blue-500 bg-blue-500/5"
                              : room.genderPreference === "FEMALE"
                                ? "border-pink-500/40 text-pink-500 bg-pink-500/5"
                                : "border-border text-muted-foreground"
                          }`}
                        >
                          {room.genderPreference === "MALE"
                            ? "Male Only"
                            : room.genderPreference === "FEMALE"
                              ? "Female Only"
                              : "All (Unisex)"}
                        </Badge>
                      </td>

                      {/* Access Permission Toggle: Staff Only vs Public */}
                      <td className="p-3.5">
                        <button
                          type="button"
                          onClick={() => handleToggleStaffOnly(room)}
                          className="cursor-pointer transition-transform hover:scale-105 active:scale-95"
                          title="Click to toggle Staff Only vs Public Patient access"
                        >
                          {room.isStaffOnly ? (
                            <Badge className="bg-purple-600 text-white font-bold text-[10px] flex items-center gap-1">
                              <Lock className="h-2.5 w-2.5" />
                              <span>Staff Only</span>
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-medium text-muted-foreground border-border hover:border-foreground"
                            >
                              <Unlock className="h-2.5 w-2.5 mr-1" />
                              <span>Public Patient</span>
                            </Badge>
                          )}
                        </button>
                      </td>

                      {/* Active / Inactive Status */}
                      <td className="p-3.5">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(room)}
                          className="cursor-pointer transition-transform hover:scale-105 active:scale-95"
                          title="Click to toggle active status"
                        >
                          <Badge
                            variant={room.isActive ? "default" : "secondary"}
                            className="text-[10px] font-bold cursor-pointer"
                          >
                            {room.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-right space-x-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleOpenEdit(room)}
                          className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer"
                          title="Edit Room"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDeleteRoom(room)}
                          className="h-7 w-7 text-destructive hover:bg-destructive/10 cursor-pointer"
                          title="Delete Room"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* MODAL 1: CREATE NEW ROOM */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-lg bg-card w-[95vw] sm:w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <DoorOpen className="h-5 w-5 text-primary" />
              <span>Add New Clinic Room / Chamber</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure room details, access permissions, and bed capacity.
            </DialogDescription>
          </DialogHeader>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleCreateRoom} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Room Number *</Label>
                <Input
                  placeholder="e.g. 201, 207, 305, VIP-1"
                  value={createForm.roomNumber}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, roomNumber: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">
                    Bed / Station Capacity *
                  </Label>
                  <span className="text-[10px] text-muted-foreground">
                    (0 for Non-Bed)
                  </span>
                </div>
                <Input
                  type="number"
                  min="0"
                  max="50"
                  placeholder="0 or 2"
                  value={createForm.capacity}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      capacity: Number(e.target.value),
                    })
                  }
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Room Full Name *</Label>
              <Input
                placeholder="e.g. Room 207 (Male Electrotherapy Bay 5 • Multi-Bed)"
                value={createForm.name}
                onChange={(e) =>
                  setCreateForm({ ...createForm, name: e.target.value })
                }
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Purpose / Service Type
                </Label>
                <Input
                  placeholder="e.g. Doctor Consultation / Staff Lounge / Male Bay"
                  value={createForm.purpose}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, purpose: e.target.value })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Access Level</Label>
                <Select
                  value={createForm.accessLevel}
                  onValueChange={(val: string | null) => {
                    if (!val) return;
                    const level = val as
                      "PUBLIC" | "DOCTOR_ONLY" | "STAFF_ONLY";
                    setCreateForm({
                      ...createForm,
                      accessLevel: level,
                      ...(level === "DOCTOR_ONLY"
                        ? {
                            type: "DOCTOR",
                            purpose:
                              !createForm.purpose ||
                              createForm.purpose ===
                                "Physiotherapy & Modalities"
                                ? "Doctor Consultation"
                                : createForm.purpose,
                          }
                        : level === "STAFF_ONLY"
                          ? { type: "STAFF_ONLY" }
                          : { type: "THERAPY_BAY" }),
                    });
                  }}
                >
                  <SelectTrigger className="w-full h-8 text-xs font-medium bg-background border-input">
                    <SelectValue placeholder="Access Level">
                      {createForm.accessLevel === "DOCTOR_ONLY"
                        ? "🩺 Doctor Consultation Chamber"
                        : createForm.accessLevel === "STAFF_ONLY"
                          ? "🔒 Staff Only"
                          : "👥 Public Therapy Bay & Staff"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PUBLIC">
                      👥 Public Therapy Bay &amp; Staff
                    </SelectItem>
                    <SelectItem value="DOCTOR_ONLY">
                      🩺 Doctor Consultation Chamber
                    </SelectItem>
                    <SelectItem value="STAFF_ONLY">🔒 Staff Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Gender Preference
                </Label>
                <Select
                  value={createForm.genderPreference}
                  onValueChange={(val) =>
                    setCreateForm({
                      ...createForm,
                      genderPreference: val as "ALL" | "MALE" | "FEMALE",
                    })
                  }
                >
                  <SelectTrigger className="w-full h-8 text-xs font-medium bg-background border-input">
                    <SelectValue placeholder="Gender Preference">
                      {createForm.genderPreference === "MALE"
                        ? "Male Therapy Bay"
                        : createForm.genderPreference === "FEMALE"
                          ? "Female Therapy Bay"
                          : "All (Unisex)"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All (Unisex)</SelectItem>
                    <SelectItem value="MALE">Male Therapy Bay</SelectItem>
                    <SelectItem value="FEMALE">Female Therapy Bay</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Floor / Wing</Label>
                <Input
                  placeholder="2nd Floor"
                  value={createForm.floor}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, floor: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Equipment / Remarks Notes
              </Label>
              <Input
                placeholder="SWD, UST, 2 Traction units"
                value={createForm.notes}
                onChange={(e) =>
                  setCreateForm({ ...createForm, notes: e.target.value })
                }
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="font-bold cursor-pointer bg-primary text-primary-foreground"
              >
                Create Room
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: EDIT ROOM */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-lg bg-card w-[95vw] sm:w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Edit2 className="h-5 w-5 text-primary" />
              <span>Edit Room {editingRoom?.roomNumber}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Update room configuration, access permissions, and bed capacity.
            </DialogDescription>
          </DialogHeader>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleUpdateRoom} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Room Number *</Label>
                <Input
                  value={editForm.roomNumber}
                  onChange={(e) =>
                    setEditForm({ ...editForm, roomNumber: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">
                    Bed Capacity *
                  </Label>
                  <span className="text-[10px] text-muted-foreground">
                    (0 for Non-Bed)
                  </span>
                </div>
                <Input
                  type="number"
                  min="0"
                  max="50"
                  value={editForm.capacity}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      capacity: Number(e.target.value),
                    })
                  }
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Room Full Name *</Label>
              <Input
                value={editForm.name}
                onChange={(e) =>
                  setEditForm({ ...editForm, name: e.target.value })
                }
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Purpose / Service
                </Label>
                <Input
                  value={editForm.purpose}
                  onChange={(e) =>
                    setEditForm({ ...editForm, purpose: e.target.value })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Access Level</Label>
                <Select
                  value={editForm.accessLevel}
                  onValueChange={(val: string | null) => {
                    if (!val) return;
                    const level = val as
                      "PUBLIC" | "DOCTOR_ONLY" | "STAFF_ONLY";
                    setEditForm({
                      ...editForm,
                      accessLevel: level,
                      ...(level === "DOCTOR_ONLY"
                        ? { type: "DOCTOR" }
                        : level === "STAFF_ONLY"
                          ? { type: "STAFF_ONLY" }
                          : { type: "THERAPY_BAY" }),
                    });
                  }}
                >
                  <SelectTrigger className="w-full h-8 text-xs font-medium bg-background border-input">
                    <SelectValue placeholder="Access Level">
                      {editForm.accessLevel === "DOCTOR_ONLY"
                        ? "🩺 Doctor Consultation Chamber"
                        : editForm.accessLevel === "STAFF_ONLY"
                          ? "🔒 Staff Only"
                          : "👥 Public Therapy Bay & Staff"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PUBLIC">
                      👥 Public Therapy Bay &amp; Staff
                    </SelectItem>
                    <SelectItem value="DOCTOR_ONLY">
                      🩺 Doctor Consultation Chamber
                    </SelectItem>
                    <SelectItem value="STAFF_ONLY">🔒 Staff Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Gender Filter</Label>
                <Select
                  value={editForm.genderPreference}
                  onValueChange={(val) =>
                    setEditForm({
                      ...editForm,
                      genderPreference: val as "ALL" | "MALE" | "FEMALE",
                    })
                  }
                >
                  <SelectTrigger className="w-full h-8 text-xs font-medium bg-background border-input">
                    <SelectValue placeholder="Gender Filter">
                      {editForm.genderPreference === "MALE"
                        ? "Male"
                        : editForm.genderPreference === "FEMALE"
                          ? "Female"
                          : "All (Unisex)"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All (Unisex)</SelectItem>
                    <SelectItem value="MALE">Male</SelectItem>
                    <SelectItem value="FEMALE">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Floor / Wing</Label>
                <Input
                  value={editForm.floor}
                  onChange={(e) =>
                    setEditForm({ ...editForm, floor: e.target.value })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Active Status</Label>
                <Select
                  value={editForm.isActive ? "ACTIVE" : "INACTIVE"}
                  onValueChange={(val) =>
                    setEditForm({
                      ...editForm,
                      isActive: val === "ACTIVE",
                    })
                  }
                >
                  <SelectTrigger className="w-full h-8 text-xs font-medium bg-background border-input">
                    <SelectValue placeholder="Active Status">
                      {editForm.isActive ? "Active" : "Inactive / Maintenance"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">
                      Inactive / Maintenance
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Notes / Description
              </Label>
              <Input
                value={editForm.notes}
                onChange={(e) =>
                  setEditForm({ ...editForm, notes: e.target.value })
                }
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditOpen(false)}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="font-bold cursor-pointer bg-primary text-primary-foreground"
              >
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
