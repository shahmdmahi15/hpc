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
import { createTherapySlotAction } from "@/actions/admin/slot.action";
import { SlotStatus } from "@/generated/prisma/enums";
import type { Room } from "@/generated/prisma/client";
import { toast } from "sonner";
import { Plus, Clock, Loader2, DoorOpen, Users } from "lucide-react";
import { AdminPerformerSelect } from "@/components/admin/users/admin-performer-select";
import { WeekDaysSelector } from "@/components/admin/slots/week-days-selector";

interface CreateSlotDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  rooms: Room[];
  adminPerformers: { id: string; name: string; phone: string }[];
  defaultRegularMale?: number;
  defaultRegularFemale?: number;
  defaultExtraMale?: number;
  defaultExtraFemale?: number;
}

const SLOT_STATUS_ITEMS = [
  { value: SlotStatus.OPEN, label: "Open for Booking" },
  { value: SlotStatus.BLOCKED, label: "Blocked" },
] as const;

export function CreateSlotDialog({
  isOpen,
  onOpenChange,
  rooms,
  adminPerformers,
  defaultRegularMale = 3,
  defaultRegularFemale = 3,
  defaultExtraMale = 1,
  defaultExtraFemale = 1,
}: CreateSlotDialogProps) {
  const [startTime, setStartTime] = React.useState("10:00");
  const [endTime, setEndTime] = React.useState("11:00");
  const [label, setLabel] = React.useState("10:00 AM - 11:00 AM");
  const [order, setOrder] = React.useState(1);
  const [roomId, setRoomId] = React.useState<string>("NONE");
  const [regMale, setRegMale] = React.useState(defaultRegularMale);
  const [regFemale, setRegFemale] = React.useState(defaultRegularFemale);
  const [extMale, setExtMale] = React.useState(defaultExtraMale);
  const [extFemale, setExtFemale] = React.useState(defaultExtraFemale);
  const [status, setStatus] = React.useState<SlotStatus>(SlotStatus.OPEN);
  const [isActive, setIsActive] = React.useState(true);
  const [weekDays, setWeekDays] = React.useState("ALL");
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

  const handleOpenChange = (open: boolean) => {
    if (open && adminPerformers.length === 1) {
      setAdminPerformerId(adminPerformers[0].id);
    }
    onOpenChange(open);
  };

  // Generate pretty label automatically when time changes
  const updateTimes = (start: string, end: string) => {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!adminPerformerId && adminPerformers.length > 0) {
      toast.error("Please select an authorizing administrator.");
      return;
    }

    startTransition(async () => {
      const res = await createTherapySlotAction({
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
        onOpenChange(false);
      } else {
        toast.error(res.message);
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-xl md:max-w-2xl max-h-[min(90vh,820px)] flex flex-col p-0 overflow-hidden border-border/80 shadow-2xl rounded-2xl">
        <DialogHeader className="p-5 sm:p-6 pb-4 border-b border-border/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <Clock className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                Create Master Therapy Slot
              </DialogTitle>
              <DialogDescription className="text-xs">
                Define a predefined slot used daily for patient ticket booking.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 min-h-0 overflow-hidden"
        >
          <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
            {/* Slot Label & Sequence Order */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs font-semibold">
                  Slot Display Label
                </Label>
                <Input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. 10:00 AM - 11:00 AM"
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
                <Label className="text-xs font-semibold">
                  Start Time (24h)
                </Label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => updateTimes(e.target.value, endTime)}
                  className="h-9 text-xs font-mono"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">End Time (24h)</Label>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => updateTimes(startTime, e.target.value)}
                  className="h-9 text-xs font-mono"
                  required
                />
              </div>
            </div>

            {/* Quota Settings */}
            <div className="p-4 rounded-xl border border-border/70 bg-card/60 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <Users className="size-3.5 text-primary" />
                <span>Default Capacity Quotas (Per Day)</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] text-sky-600 dark:text-sky-400 font-medium">
                    Regular Male (Default: 3)
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
                    Regular Female (Default: 3)
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    max={50}
                    value={regFemale}
                    onChange={(e) =>
                      setRegFemale(parseInt(e.target.value) || 0)
                    }
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground font-medium">
                    Extra Male Standby (Default: 1)
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
                    Extra Female Standby (Default: 1)
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    max={20}
                    value={extFemale}
                    onChange={(e) =>
                      setExtFemale(parseInt(e.target.value) || 0)
                    }
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Operating Week Days Selector */}
            <div className="p-3.5 rounded-xl border border-border/70 bg-card/40">
              <WeekDaysSelector value={weekDays} onChange={setWeekDays} />
            </div>

            {/* Room & Initial Status */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <DoorOpen className="size-3 text-muted-foreground" />
                  Assigned Room (Optional)
                </Label>
                <Select
                  items={roomItems}
                  value={roomId}
                  onValueChange={(val) => setRoomId(val || "NONE")}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="General (No room)">
                      {(val: string | null) => {
                        const match = roomItems.find((r) => r.value === val);
                        return match ? match.label : "General (No room)";
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
                  items={SLOT_STATUS_ITEMS}
                  value={status}
                  onValueChange={(val) => setStatus(val as SlotStatus)}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select status">
                      {(val: string | null) => {
                        const match = SLOT_STATUS_ITEMS.find(
                          (s) => s.value === val,
                        );
                        return match ? match.label : "Open for Booking";
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {SLOT_STATUS_ITEMS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-border/70 bg-card/40">
              <div className="space-y-0.5">
                <Label className="text-xs font-semibold">Slot Active</Label>
                <p className="text-[11px] text-muted-foreground">
                  Inactive slots will not appear for ticket bookings on desk
                  panels.
                </p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>

            {/* Administrator Attribution */}
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
              onClick={() => onOpenChange(false)}
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
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="size-3.5" />
                  Create Master Slot
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
