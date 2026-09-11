"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  RoomAccessType,
  RoomGender,
  RoomStatus,
} from "@/generated/prisma/enums";
import type { Room } from "@/generated/prisma/client";
import { updateRoomAction } from "@/actions/admin/room.action";
import {
  AdminPerformerSelect,
  type AdminPerformer,
} from "@/components/admin/users/admin-performer-select";
import { toast } from "sonner";
import {
  Edit3,
  Stethoscope,
  Users,
  Globe,
  Loader2,
  AlertCircle,
} from "lucide-react";

interface EditRoomDialogProps {
  room: Room | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  adminPerformers: AdminPerformer[];
  onRoomUpdated?: () => void;
}

const ROOM_ACCESS_OPTIONS = [
  { value: RoomAccessType.PUBLIC, label: "Public (All Visitors)" },
  { value: RoomAccessType.STAFF, label: "Staff Only" },
  { value: RoomAccessType.DOCTOR, label: "Doctor Console" },
] as const;

const ROOM_GENDER_OPTIONS = [
  { value: RoomGender.COMMON, label: "All / Common" },
  { value: RoomGender.MALE, label: "Male Dedicated" },
  { value: RoomGender.FEMALE, label: "Female Dedicated" },
] as const;

const ROOM_STATUS_OPTIONS = [
  { value: RoomStatus.AVAILABLE, label: "Available (Ready for Use)" },
  { value: RoomStatus.OCCUPIED, label: "Occupied (In Active Use)" },
  { value: RoomStatus.MAINTENANCE, label: "Maintenance (Out of Service)" },
] as const;

const ACCESS_LABELS: Record<string, string> = Object.fromEntries(
  ROOM_ACCESS_OPTIONS.map((o) => [o.value, o.label]),
);
const GENDER_LABELS: Record<string, string> = Object.fromEntries(
  ROOM_GENDER_OPTIONS.map((o) => [o.value, o.label]),
);
const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  ROOM_STATUS_OPTIONS.map((o) => [o.value, o.label]),
);

function EditRoomForm({
  room,
  adminPerformers,
  onClose,
  onRoomUpdated,
}: {
  room: Room;
  adminPerformers: AdminPerformer[];
  onClose: () => void;
  onRoomUpdated?: () => void;
}) {
  const [number, setNumber] = React.useState(room.number);
  const [purpose, setPurpose] = React.useState(room.purpose);
  const [accessType, setAccessType] = React.useState<RoomAccessType>(
    room.accessType,
  );
  const [gender, setGender] = React.useState<RoomGender>(room.gender);
  const [status, setStatus] = React.useState<RoomStatus>(room.status);
  const [selectedAdminPerformerId, setSelectedAdminPerformerId] =
    React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<
    Record<string, string[] | undefined>
  >({});
  const [generalError, setGeneralError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    setFieldErrors({});
    setGeneralError(null);

    const formData = new FormData();
    formData.append("id", room.id);
    formData.append("number", number);
    formData.append("purpose", purpose);
    formData.append("accessType", accessType);
    formData.append("gender", gender);
    formData.append("status", status);

    if (selectedAdminPerformerId) {
      formData.append("performerId", selectedAdminPerformerId);
    }

    startTransition(async () => {
      try {
        const result = await updateRoomAction(undefined, formData);
        if (result.success) {
          toast.success(
            result.message || `Room "${number}" updated successfully!`,
          );
          onClose();
          onRoomUpdated?.();
        } else {
          if (result.fieldErrors) {
            setFieldErrors(result.fieldErrors);
          }
          setGeneralError(
            result.message || "Failed to update room configuration.",
          );
        }
      } catch (err) {
        console.error("Update room exception:", err);
        setGeneralError(
          "An unexpected system error occurred. Please try again.",
        );
      }
    });
  };

  return (
    <>
      {/* Header */}
      <div className="p-6 border-b border-border/60 bg-muted/20">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
              <Edit3 className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Edit Room {room.number}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Update operational details, access restrictions, or status.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
      </div>

      {/* Form Body */}
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {generalError && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold">Update Error</p>
              <p className="text-[11px] opacity-90">{generalError}</p>
            </div>
          </div>
        )}

        {/* Room Number & Purpose */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-room-number" className="text-xs font-semibold">
              Room Number / Code <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edit-room-number"
              placeholder="e.g. 101, ICU-1"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              disabled={isPending}
              className={
                fieldErrors.number
                  ? "border-destructive focus-visible:ring-destructive"
                  : ""
              }
            />
            {fieldErrors.number && (
              <p className="text-[11px] font-medium text-destructive">
                {fieldErrors.number[0]}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="edit-room-purpose"
              className="text-xs font-semibold"
            >
              Purpose / Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edit-room-purpose"
              placeholder="e.g. Consultation, ECG"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              disabled={isPending}
              className={
                fieldErrors.purpose
                  ? "border-destructive focus-visible:ring-destructive"
                  : ""
              }
            />
            {fieldErrors.purpose && (
              <p className="text-[11px] font-medium text-destructive">
                {fieldErrors.purpose[0]}
              </p>
            )}
          </div>
        </div>

        {/* Access Type & Gender */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              Access Type <span className="text-destructive">*</span>
            </Label>
            <Select
              items={ROOM_ACCESS_OPTIONS}
              value={accessType}
              onValueChange={(val) =>
                val && setAccessType(val as RoomAccessType)
              }
              disabled={isPending}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select access type">
                  {(val: string | null) =>
                    val
                      ? ACCESS_LABELS[String(val)] || String(val)
                      : "Select access type"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={RoomAccessType.PUBLIC}>
                  <div className="flex items-center gap-2">
                    <Globe className="size-3.5 text-emerald-500" />
                    <span>Public (All Visitors)</span>
                  </div>
                </SelectItem>
                <SelectItem value={RoomAccessType.STAFF}>
                  <div className="flex items-center gap-2">
                    <Users className="size-3.5 text-blue-500" />
                    <span>Staff Only</span>
                  </div>
                </SelectItem>
                <SelectItem value={RoomAccessType.DOCTOR}>
                  <div className="flex items-center gap-2">
                    <Stethoscope className="size-3.5 text-purple-500" />
                    <span>Doctor Console</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            {fieldErrors.accessType && (
              <p className="text-[11px] font-medium text-destructive">
                {fieldErrors.accessType[0]}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              Gender Classification <span className="text-destructive">*</span>
            </Label>
            <Select
              items={ROOM_GENDER_OPTIONS}
              value={gender}
              onValueChange={(val) => val && setGender(val as RoomGender)}
              disabled={isPending}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select gender">
                  {(val: string | null) =>
                    val
                      ? GENDER_LABELS[String(val)] || String(val)
                      : "Select gender"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={RoomGender.COMMON}>
                  <span className="font-medium">All / Common</span>
                </SelectItem>
                <SelectItem value={RoomGender.MALE}>
                  <span className="text-sky-600 dark:text-sky-400 font-medium">
                    Male Dedicated
                  </span>
                </SelectItem>
                <SelectItem value={RoomGender.FEMALE}>
                  <span className="text-pink-600 dark:text-pink-400 font-medium">
                    Female Dedicated
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            {fieldErrors.gender && (
              <p className="text-[11px] font-medium text-destructive">
                {fieldErrors.gender[0]}
              </p>
            )}
          </div>
        </div>

        {/* Status */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">
            Operational Status <span className="text-destructive">*</span>
          </Label>
          <Select
            items={ROOM_STATUS_OPTIONS}
            value={status}
            onValueChange={(val) => val && setStatus(val as RoomStatus)}
            disabled={isPending}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select operational status">
                {(val: string | null) =>
                  val
                    ? STATUS_LABELS[String(val)] || String(val)
                    : "Select operational status"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={RoomStatus.AVAILABLE}>
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  <span>Available (Ready for Use)</span>
                </div>
              </SelectItem>
              <SelectItem value={RoomStatus.OCCUPIED}>
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-amber-500" />
                  <span>Occupied (In Active Use)</span>
                </div>
              </SelectItem>
              <SelectItem value={RoomStatus.MAINTENANCE}>
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-rose-500" />
                  <span>Maintenance (Out of Service)</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          {fieldErrors.status && (
            <p className="text-[11px] font-medium text-destructive">
              {fieldErrors.status[0]}
            </p>
          )}
        </div>

        {/* Mandatory Admin Performer Attribution */}
        <div className="pt-2 border-t border-border/50">
          <AdminPerformerSelect
            adminPerformers={adminPerformers}
            selectedPerformerId={selectedAdminPerformerId}
            onSelectPerformerId={setSelectedAdminPerformerId}
            disabled={isPending}
            label="Authorizing Administrator"
            error={fieldErrors.performerId?.[0]}
          />
        </div>

        {/* Dialog Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border/60">
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
            disabled={
              isPending ||
              (adminPerformers.length > 1 && !selectedAdminPerformerId)
            }
            className="gap-1.5"
          >
            {isPending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Edit3 className="size-3.5" />
                <span>Save Changes</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </>
  );
}

export function EditRoomDialog({
  room,
  open,
  onOpenChange,
  adminPerformers = [],
  onRoomUpdated,
}: EditRoomDialogProps) {
  if (!room) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[92vh] overflow-y-auto p-0 gap-0 border-border/80 shadow-2xl">
        <EditRoomForm
          key={room.id}
          room={room}
          adminPerformers={adminPerformers}
          onClose={() => onOpenChange(false)}
          onRoomUpdated={onRoomUpdated}
        />
      </DialogContent>
    </Dialog>
  );
}
