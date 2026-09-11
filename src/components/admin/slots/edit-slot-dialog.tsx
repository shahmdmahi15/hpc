"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { updateTherapySlotAction } from "@/actions/admin/slot.action";
import { SlotStatus } from "@/generated/prisma/enums";
import type { TherapySlotWithDetails } from "@/actions/admin/slot.action";
import type { Room } from "@/generated/prisma/client";
import { toast } from "sonner";
import { Edit3, Loader2, DoorOpen, Users } from "lucide-react";
import { AdminPerformerSelect } from "@/components/admin/users/admin-performer-select";
import { WeekDaysSelector } from "@/components/admin/slots/week-days-selector";

interface EditSlotDialogProps {
  slot: TherapySlotWithDetails | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  rooms: Room[];
  adminPerformers: { id: string; name: string; phone: string }[];
}

export function EditSlotDialog({
  slot,
  isOpen,
  onOpenChange,
  rooms,
  adminPerformers,
}: EditSlotDialogProps) {
  if (!slot) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-xl md:max-w-2xl max-h-[min(90vh,820px)] flex flex-col p-0 overflow-hidden border-border/80 shadow-2xl rounded-2xl">
        <EditSlotForm
          key={slot.id}
          slot={slot}
          rooms={rooms}
          adminPerformers={adminPerformers}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

interface EditSlotFormProps {
  slot: TherapySlotWithDetails;
  rooms: Room[];
  adminPerformers: { id: string; name: string; phone: string }[];
  onClose: () => void;
}

const EDIT_SLOT_STATUS_ITEMS = [
  { value: SlotStatus.OPEN, label: "Open for Booking" },
  { value: SlotStatus.BLOCKED, label: "Blocked" },
] as const;

function EditSlotForm({
  slot,
  rooms,
  adminPerformers,
  onClose,
}: EditSlotFormProps) {
  const [label, setLabel] = React.useState(slot.label);
  const [startTime, setStartTime] = React.useState(slot.startTime);
  const [endTime, setEndTime] = React.useState(slot.endTime);
  const [order, setOrder] = React.useState(slot.order);
  const [roomId, setRoomId] = React.useState<string>(slot.roomId || "NONE");
  const [status, setStatus] = React.useState<SlotStatus>(slot.status);
  const [isActive, setIsActive] = React.useState(slot.isActive);
  const [weekDays, setWeekDays] = React.useState(slot.weekDays || "ALL");
  const [regMale, setRegMale] = React.useState(slot.regularMaleCapacity);
  const [regFemale, setRegFemale] = React.useState(slot.regularFemaleCapacity);
  const [extMale, setExtMale] = React.useState(slot.extraMaleCapacity);
  const [extFemale, setExtFemale] = React.useState(slot.extraFemaleCapacity);
  const [adminPerformerId, setAdminPerformerId] = React.useState<string>(() =>
    adminPerformers.length === 1 ? adminPerformers[0].id : "",
  );

  const roomItems = React.useMemo(
    () => [
      { value: "NONE", label: "General / Open to all" },
      ...rooms.map((r) => ({
        value: r.id,
        label: `Room ${r.number} (${r.purpose})`,
      })),
    ],
    [rooms],
  );

  const [isPending, startTransition] = React.useTransition();

  const handleUpdateTimes = (start: string, end: string) => {
    setStartTime(start);
    setEndTime(end);

    const format12 = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      if (isNaN(h)) return t;
      const period = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 === 0 ? 12 : h % 12;
      return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
    };

    setLabel(`${format12(start)} - ${format12(end)}`);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    if (!adminPerformerId && adminPerformers.length > 0) {
      toast.error("Please select an authorizing administrator.");
      return;
    }

    startTransition(async () => {
      const res = await updateTherapySlotAction({
        slotId: slot.id,
        label,
        startTime,
        endTime,
        order,
        regularMaleCapacity: regMale,
        regularFemaleCapacity: regFemale,
        extraMaleCapacity: extMale,
        extraFemaleCapacity: extFemale,
        roomId: roomId === "NONE" ? null : roomId,
        status,
        isActive,
        weekDays,
        adminPerformerId: adminPerformerId || undefined,
      });

      if (res.success) {
        toast.success(res.message);
        onClose();
      } else {
        toast.error(res.message);
      }
    });
  };

  return (
    <>
      <DialogHeader className="p-5 sm:p-6 pb-4 border-b border-border/60 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary">
            <Edit3 className="size-5" />
          </div>
          <div>
            <DialogTitle className="text-base font-bold">
              Edit Master Slot
            </DialogTitle>
            <DialogDescription className="text-xs">
              Update timing, quotas, and assignment for this master ticket slot.
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <form
        onSubmit={handleSave}
        className="flex flex-col flex-1 min-h-0 overflow-hidden"
      >
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {/* Label & Sort Order */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs font-semibold">Slot Label</Label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="h-9 text-xs"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Sort Order</Label>
              <Input
                type="number"
                min={0}
                value={order}
                onChange={(e) => setOrder(parseInt(e.target.value) || 0)}
                className="h-9 text-xs"
              />
            </div>
          </div>

          {/* Time Window */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Start Time (24h)</Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => handleUpdateTimes(e.target.value, endTime)}
                className="h-9 text-xs font-mono"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">End Time (24h)</Label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => handleUpdateTimes(startTime, e.target.value)}
                className="h-9 text-xs font-mono"
                required
              />
            </div>
          </div>

          {/* Capacity Quotas */}
          <div className="p-4 rounded-xl border border-border/70 bg-card/60 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Users className="size-3.5 text-primary" />
              <span>Slot Quota Capacity (Per Day)</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] text-sky-600 dark:text-sky-400 font-medium">
                  Regular Male (Standard: 3)
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={50}
                  value={regMale}
                  onChange={(e) => setRegMale(parseInt(e.target.value) || 0)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-pink-600 dark:text-pink-400 font-medium">
                  Regular Female (Standard: 3)
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={50}
                  value={regFemale}
                  onChange={(e) => setRegFemale(parseInt(e.target.value) || 0)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground font-medium">
                  Extra Male Standby (Standard: 1)
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={20}
                  value={extMale}
                  onChange={(e) => setExtMale(parseInt(e.target.value) || 0)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground font-medium">
                  Extra Female Standby (Standard: 1)
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={20}
                  value={extFemale}
                  onChange={(e) => setExtFemale(parseInt(e.target.value) || 0)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Operating Week Days Selector */}
          <div className="p-3.5 rounded-xl border border-border/70 bg-card/40">
            <WeekDaysSelector value={weekDays} onChange={setWeekDays} />
          </div>

          {/* Room & Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <DoorOpen className="size-3 text-muted-foreground" />
                Assigned Room
              </Label>
              <Select
                items={roomItems}
                value={roomId}
                onValueChange={(val) => setRoomId(val || "NONE")}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="General / Open">
                    {(val: string | null) => {
                      const match = roomItems.find((r) => r.value === val);
                      return match ? match.label : "General / Open";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {roomItems.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Slot Status</Label>
              <Select
                items={EDIT_SLOT_STATUS_ITEMS}
                value={status}
                onValueChange={(val) => setStatus(val as SlotStatus)}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select status">
                    {(val: string | null) => {
                      const match = EDIT_SLOT_STATUS_ITEMS.find(
                        (s) => s.value === val,
                      );
                      return match ? match.label : "Open for Booking";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {EDIT_SLOT_STATUS_ITEMS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Active Switch */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-border/70 bg-card/40">
            <div className="space-y-0.5">
              <Label className="text-xs font-semibold">Slot Active</Label>
              <p className="text-[11px] text-muted-foreground">
                When inactive, this slot is disabled across ticket booking
                interfaces.
              </p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          {/* Performer Attribution */}
          <div className="pt-2 border-t border-border/50">
            <AdminPerformerSelect
              adminPerformers={adminPerformers}
              selectedPerformerId={adminPerformerId}
              onSelectPerformerId={setAdminPerformerId}
              disabled={isPending}
              label="Authorizing Administrator"
            />
          </div>
        </div>

        <DialogFooter className="p-4 sm:px-6 py-3.5 border-t border-border/60 bg-muted/20 shrink-0 flex items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            className="gap-1.5 font-semibold px-4"
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Edit3 className="size-3.5" />
                Save Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
