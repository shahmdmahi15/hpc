"use client";

import * as React from "react";
import { useRealtime } from "@/hooks/use-realtime";
import {
  getDynamicSlotAvailability,
  createBookingSlot,
  updateBookingSlot,
  deleteBookingSlot,
  toggleBookingSlotStatus,
} from "@/actions/slots";
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
  Clock,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Users,
  RefreshCw,
  Ticket,
  Lock,
} from "lucide-react";
import { toast } from "sonner";

type SlotItem = NonNullable<
  Awaited<ReturnType<typeof getDynamicSlotAvailability>>
>["slots"][number];

export function SlotManagementPanel({
  initialAvailability,
}: {
  initialAvailability?: Awaited<ReturnType<typeof getDynamicSlotAvailability>>;
}) {
  const [data, setData] = React.useState(initialAvailability);
  const [filterView, setFilterView] = React.useState<
    "ALL" | "ACTIVE" | "VIP" | "INACTIVE"
  >("ALL");
  const [isPending, startTransition] = React.useTransition();
  const [errorMessage, setErrorMessage] = React.useState("");
  const [successMessage, setSuccessMessage] = React.useState("");

  // Modals
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [editingSlot, setEditingSlot] = React.useState<SlotItem | null>(null);

  // Create Form State
  const [createForm, setCreateForm] = React.useState({
    slotCode: "",
    startTime: "08:00 AM",
    endTime: "09:00 AM",
    label: "08:00 AM - 09:00 AM",
    maxCapacity: 6,
    intervalMinutes: 10,
    isActive: true,
    isVipOnly: false,
    notes: "",
  });

  // Edit Form State
  const [editForm, setEditForm] = React.useState({
    slotCode: "",
    startTime: "",
    endTime: "",
    label: "",
    maxCapacity: 6,
    intervalMinutes: 10,
    isActive: true,
    isVipOnly: false,
    notes: "",
  });

  const loadSlots = React.useCallback(() => {
    startTransition(async () => {
      try {
        const res = await getDynamicSlotAvailability();
        setData(res);
      } catch (err) {
        console.error("Failed to load dynamic slots", err);
      }
    });
  }, []);

  React.useEffect(() => {
    if (!data) {
      loadSlots();
    }
  }, [data, loadSlots]);

  useRealtime({
    onRefresh: loadSlots,
  });

  // Handle Create Slot
  const handleCreateSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!createForm.startTime || !createForm.endTime) {
      setErrorMessage("Start Time and End Time are required.");
      return;
    }

    const label =
      createForm.label.trim() ||
      `${createForm.startTime} - ${createForm.endTime}`;
    const code =
      createForm.slotCode.trim() ||
      `SLOT_${createForm.startTime.replace(/[^0-9A-Za-z]/g, "")}_${createForm.endTime.replace(/[^0-9A-Za-z]/g, "")}`.toUpperCase();

    const res = await createBookingSlot({
      slotCode: code,
      startTime: createForm.startTime,
      endTime: createForm.endTime,
      label,
      maxCapacity: Number(createForm.maxCapacity) || 6,
      intervalMinutes: Number(createForm.intervalMinutes) || 10,
      isActive: createForm.isActive,
      isVipOnly: createForm.isVipOnly,
      notes: createForm.notes,
    });

    if (res.error) {
      setErrorMessage(res.error);
      return;
    }

    setSuccessMessage(`Booking slot "${label}" created successfully!`);
    setIsCreateOpen(false);
    setCreateForm({
      slotCode: "",
      startTime: "08:00 AM",
      endTime: "09:00 AM",
      label: "08:00 AM - 09:00 AM",
      maxCapacity: 6,
      intervalMinutes: 10,
      isActive: true,
      isVipOnly: false,
      notes: "",
    });
    loadSlots();
  };

  // Open Edit Modal
  const handleOpenEdit = (slot: SlotItem) => {
    setEditingSlot(slot);
    setEditForm({
      slotCode: slot.slotCode,
      startTime: slot.startTime,
      endTime: slot.endTime,
      label: slot.label,
      maxCapacity: slot.maxCapacity,
      intervalMinutes: slot.intervalMinutes,
      isActive: slot.isActive,
      isVipOnly: slot.isVipOnly,
      notes: slot.notes || "",
    });
    setErrorMessage("");
    setIsEditOpen(true);
  };

  // Handle Update Slot
  const handleUpdateSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSlot) return;
    setErrorMessage("");
    setSuccessMessage("");

    const res = await updateBookingSlot(editingSlot.id, {
      slotCode: editForm.slotCode,
      startTime: editForm.startTime,
      endTime: editForm.endTime,
      label: editForm.label,
      maxCapacity: Number(editForm.maxCapacity),
      intervalMinutes: Number(editForm.intervalMinutes),
      isActive: editForm.isActive,
      isVipOnly: editForm.isVipOnly,
      notes: editForm.notes,
    });

    if (res.error) {
      setErrorMessage(res.error);
      return;
    }

    setSuccessMessage(`Slot "${editForm.label}" updated successfully!`);
    setIsEditOpen(false);
    setEditingSlot(null);
    loadSlots();
  };

  // Handle Delete Slot
  const handleDeleteSlot = async (slot: SlotItem) => {
    const res = await deleteBookingSlot(slot.id);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`Slot "${slot.label}" deleted successfully.`);
    loadSlots();
  };

  // Handle Toggle Status
  const handleToggleStatus = async (slot: SlotItem) => {
    await toggleBookingSlotStatus(slot.id, !slot.isActive);
    toast.success(`Slot "${slot.label}" status updated.`);
    loadSlots();
  };

  const slots = React.useMemo(() => data?.slots || [], [data]);
  const stats = React.useMemo(() => {
    return (
      data?.stats || {
        totalSlots: slots.length,
        activeSlotsCount: slots.filter((s) => s.isActive).length,
        totalCapacity: slots.reduce((acc, s) => acc + s.maxCapacity, 0),
        totalBooked: slots.reduce((acc, s) => acc + s.bookedCount, 0),
        totalRemaining: 0,
        soldOutSlotsCount: 0,
      }
    );
  }, [data, slots]);

  const filteredSlots = React.useMemo(() => {
    if (filterView === "ALL") return slots;
    if (filterView === "ACTIVE")
      return slots.filter((s) => s.isActive && !s.isVipOnly);
    if (filterView === "VIP") return slots.filter((s) => s.isVipOnly);
    if (filterView === "INACTIVE") return slots.filter((s) => !s.isActive);
    return slots;
  }, [slots, filterView]);

  return (
    <div className="space-y-3 w-full max-w-full min-w-0">
      {/* Top Metric Cards (Compact & High Density) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 min-w-0">
        <Card className="p-2 sm:p-2.5 shadow-xs border-border bg-card">
          <div className="flex items-center justify-between text-muted-foreground text-[10px] sm:text-[11px] font-semibold uppercase">
            <span>Total Slots</span>
            <Clock className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-lg sm:text-xl font-black mt-0.5 font-mono text-foreground">
            {stats.totalSlots} Slots
          </p>
          <span className="text-[9px] sm:text-[10px] text-muted-foreground">
            Configured in system
          </span>
        </Card>

        <Card className="p-2 sm:p-2.5 shadow-xs border-border bg-card">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-[10px] sm:text-[11px] font-semibold uppercase">
            <span>Active &amp; Open</span>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <p className="text-lg sm:text-xl font-black mt-0.5 font-mono text-emerald-600 dark:text-emerald-400">
            {stats.activeSlotsCount} Active
          </p>
          <span className="text-[9px] sm:text-[10px] text-muted-foreground">
            Receiving patient bookings
          </span>
        </Card>

        <Card className="p-2 sm:p-2.5 shadow-xs border-border bg-card">
          <div className="flex items-center justify-between text-primary text-[10px] sm:text-[11px] font-semibold uppercase">
            <span>Daily Capacity</span>
            <Users className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-lg sm:text-xl font-black mt-0.5 font-mono text-primary">
            {stats.totalCapacity} Patients
          </p>
          <span className="text-[9px] sm:text-[10px] text-muted-foreground">
            Max tickets across active slots
          </span>
        </Card>

        <Card className="p-2 sm:p-2.5 shadow-xs border-border bg-card">
          <div className="flex items-center justify-between text-amber-500 text-[10px] sm:text-[11px] font-semibold uppercase">
            <span>Today&apos;s Bookings</span>
            <Ticket className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <p className="text-lg sm:text-xl font-black mt-0.5 font-mono text-amber-500">
            {stats.totalBooked} Booked
          </p>
          <span className="text-[9px] sm:text-[10px] text-muted-foreground">
            {stats.totalRemaining} seats remaining
          </span>
        </Card>
      </div>

      {/* Control Header & Add Slot Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-card p-1.5 sm:p-2 rounded-xl border border-border shadow-xs max-w-full min-w-0">
        <div className="flex items-center gap-1 flex-wrap">
          <Button
            size="sm"
            variant={filterView === "ALL" ? "default" : "outline"}
            onClick={() => setFilterView("ALL")}
            className="text-xs h-7 px-2.5 cursor-pointer font-semibold"
          >
            All Slots ({slots.length})
          </Button>
          <Button
            size="sm"
            variant={filterView === "ACTIVE" ? "default" : "outline"}
            onClick={() => setFilterView("ACTIVE")}
            className="text-xs h-7 px-2.5 cursor-pointer font-semibold"
          >
            Active Standard (
            {slots.filter((s) => s.isActive && !s.isVipOnly).length})
          </Button>
          <Button
            size="sm"
            variant={filterView === "VIP" ? "default" : "outline"}
            onClick={() => setFilterView("VIP")}
            className="text-xs h-7.5 cursor-pointer font-semibold gap-1"
          >
            <Lock className="h-3 w-3" />
            <span>
              VIP / Special ({slots.filter((s) => s.isVipOnly).length})
            </span>
          </Button>
          <Button
            size="sm"
            variant={filterView === "INACTIVE" ? "default" : "outline"}
            onClick={() => setFilterView("INACTIVE")}
            className="text-xs h-7.5 cursor-pointer font-semibold"
          >
            Inactive ({slots.filter((s) => !s.isActive).length})
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={loadSlots}
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
            <span>Add New Slot</span>
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

      {/* Dynamic Slots Table */}
      <Card className="shadow-md border-border bg-card">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                  <th className="p-3.5 w-24">Slot Code</th>
                  <th className="p-3.5">Time Interval &amp; Label</th>
                  <th className="p-3.5">Max Patient Capacity</th>
                  <th className="p-3.5">Today&apos;s Real-time Meter</th>
                  <th className="p-3.5">Ticket Tokens (Seats)</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Admin Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredSlots.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-12 text-center text-muted-foreground"
                    >
                      No booking slots configured. Click &quot;Add New
                      Slot&quot; above.
                    </td>
                  </tr>
                ) : (
                  filteredSlots.map((slot) => (
                    <tr
                      key={slot.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      {/* Slot Code */}
                      <td className="p-3.5 font-mono font-bold text-xs text-foreground">
                        <span className="px-2 py-1 rounded-md bg-primary/10 text-primary border border-primary/20">
                          {slot.slotCode}
                        </span>
                      </td>

                      {/* Time Label */}
                      <td className="p-3.5">
                        <div className="font-bold text-foreground text-sm flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-primary" />
                          <span>{slot.label}</span>
                          {slot.isVipOnly && (
                            <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-[9px] px-1.5 py-0 h-4">
                              🔒 VIP Only
                            </Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {slot.intervalMinutes} min token intervals{" "}
                          {slot.notes ? `• ${slot.notes}` : ""}
                        </div>
                      </td>

                      {/* Max Capacity */}
                      <td className="p-3.5">
                        <div className="font-bold font-mono text-foreground text-sm">
                          {slot.maxCapacity} Patients
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          Max per hour
                        </span>
                      </td>

                      {/* Realtime Meter */}
                      <td className="p-3.5">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-mono">
                            <span className="font-bold text-foreground">
                              {slot.bookedCount} / {slot.maxCapacity} Booked
                            </span>
                            <span
                              className={`font-bold ${
                                slot.isSoldOut
                                  ? "text-destructive"
                                  : slot.isFillingFast
                                    ? "text-amber-500"
                                    : "text-emerald-600 dark:text-emerald-400"
                              }`}
                            >
                              {slot.isSoldOut
                                ? "SOLD OUT"
                                : slot.isFillingFast
                                  ? "Filling Fast"
                                  : `${slot.remainingSeats} Free`}
                            </span>
                          </div>
                          {/* Progress Bar */}
                          <div className="w-full h-2 bg-muted rounded-full overflow-hidden flex">
                            <div
                              className={`h-full transition-all ${
                                slot.isSoldOut
                                  ? "bg-destructive"
                                  : slot.isFillingFast
                                    ? "bg-amber-500"
                                    : "bg-emerald-500"
                              }`}
                              style={{
                                width: `${Math.min(100, (slot.bookedCount / slot.maxCapacity) * 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Ticket Tokens */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-1 flex-wrap max-w-[180px]">
                          {slot.seatTokens.map((seat) => (
                            <span
                              key={seat.seatNumber}
                              title={
                                seat.isBooked
                                  ? `Seat #${seat.seatNumber}: ${seat.serial?.patientName} (#${seat.serial?.serialNumber})`
                                  : `Seat #${seat.seatNumber}: Available`
                              }
                              className={`h-5 w-5 rounded-md flex items-center justify-center font-mono text-[10px] font-bold border transition-all ${
                                seat.isBooked
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-background text-muted-foreground border-border/80"
                              }`}
                            >
                              {seat.seatNumber}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="p-3.5">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(slot)}
                          className="cursor-pointer transition-transform hover:scale-105 active:scale-95"
                          title="Click to toggle active status"
                        >
                          <Badge
                            variant={slot.isActive ? "default" : "secondary"}
                            className="text-[10px] font-bold cursor-pointer"
                          >
                            {slot.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-right space-x-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleOpenEdit(slot)}
                          className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer"
                          title="Edit Slot Timing & Capacity"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDeleteSlot(slot)}
                          className="h-7 w-7 text-destructive hover:bg-destructive/10 cursor-pointer"
                          title="Delete Slot"
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

      {/* MODAL 1: CREATE NEW BOOKING SLOT */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md bg-card w-[95vw] sm:w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <span>Add New Serial Booking Slot</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure time window, max patient limit, and ticket intervals.
            </DialogDescription>
          </DialogHeader>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleCreateSlot} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Start Time *</Label>
                <Input
                  placeholder="e.g. 08:00 AM"
                  value={createForm.startTime}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      startTime: e.target.value,
                      label: `${e.target.value} - ${createForm.endTime}`,
                    })
                  }
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">End Time *</Label>
                <Input
                  placeholder="e.g. 09:00 AM"
                  value={createForm.endTime}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      endTime: e.target.value,
                      label: `${createForm.startTime} - ${e.target.value}`,
                    })
                  }
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Display Label</Label>
              <Input
                placeholder="08:00 AM - 09:00 AM"
                value={createForm.label}
                onChange={(e) =>
                  setCreateForm({ ...createForm, label: e.target.value })
                }
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Max Patients Capacity *
                </Label>
                <Input
                  type="number"
                  min="1"
                  max="30"
                  placeholder="6"
                  value={createForm.maxCapacity}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      maxCapacity: Number(e.target.value),
                    })
                  }
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Token Interval (Minutes)
                </Label>
                <Input
                  type="number"
                  min="1"
                  max="60"
                  placeholder="10"
                  value={createForm.intervalMinutes}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      intervalMinutes: Number(e.target.value),
                    })
                  }
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Slot Code</Label>
                <Input
                  placeholder="e.g. SLOT_08_09"
                  value={createForm.slotCode}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, slotCode: e.target.value })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  VIP / Special Slot
                </Label>
                <Select
                  value={createForm.isVipOnly ? "VIP" : "GENERAL"}
                  onValueChange={(val) =>
                    setCreateForm({
                      ...createForm,
                      isVipOnly: val === "VIP",
                    })
                  }
                >
                  <SelectTrigger className="w-full h-8 text-xs font-medium bg-background border-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GENERAL">General Public</SelectItem>
                    <SelectItem value="VIP">🔒 VIP Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Notes / Description
              </Label>
              <Input
                placeholder="Morning early shift / Rehab peak"
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
                Create Slot
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: EDIT BOOKING SLOT */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md bg-card w-[95vw] sm:w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Edit2 className="h-5 w-5 text-primary" />
              <span>Edit Booking Slot</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Adjust maximum patient capacity, timings, or active status.
            </DialogDescription>
          </DialogHeader>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleUpdateSlot} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Start Time *</Label>
                <Input
                  value={editForm.startTime}
                  onChange={(e) =>
                    setEditForm({ ...editForm, startTime: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">End Time *</Label>
                <Input
                  value={editForm.endTime}
                  onChange={(e) =>
                    setEditForm({ ...editForm, endTime: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Display Label *</Label>
              <Input
                value={editForm.label}
                onChange={(e) =>
                  setEditForm({ ...editForm, label: e.target.value })
                }
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Max Patients Capacity *
                </Label>
                <Input
                  type="number"
                  min="1"
                  max="50"
                  value={editForm.maxCapacity}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      maxCapacity: Number(e.target.value),
                    })
                  }
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Token Interval (Minutes)
                </Label>
                <Input
                  type="number"
                  min="1"
                  max="60"
                  value={editForm.intervalMinutes}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      intervalMinutes: Number(e.target.value),
                    })
                  }
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
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
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">VIP Status</Label>
                <Select
                  value={editForm.isVipOnly ? "VIP" : "GENERAL"}
                  onValueChange={(val) =>
                    setEditForm({
                      ...editForm,
                      isVipOnly: val === "VIP",
                    })
                  }
                >
                  <SelectTrigger className="w-full h-8 text-xs font-medium bg-background border-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GENERAL">General Public</SelectItem>
                    <SelectItem value="VIP">🔒 VIP Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Notes</Label>
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
