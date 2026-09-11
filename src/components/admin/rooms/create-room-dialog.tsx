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
import { createRoomAction } from "@/actions/admin/room.action";
import {
  AdminPerformerSelect,
  type AdminPerformer,
} from "@/components/admin/users/admin-performer-select";
import { toast } from "sonner";
import {
  DoorOpen,
  Stethoscope,
  Users,
  Globe,
  Loader2,
  AlertCircle,
} from "lucide-react";

interface CreateRoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  adminPerformers: AdminPerformer[];
  onRoomCreated?: () => void;
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
  { value: RoomStatus.MAINTENANCE, label: "Maintenance / Closed" },
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

export function CreateRoomDialog({
  open,
  onOpenChange,
  adminPerformers = [],
  onRoomCreated,
}: CreateRoomDialogProps) {
  const [number, setNumber] = React.useState("");
  const [purpose, setPurpose] = React.useState("");
  const [accessType, setAccessType] = React.useState<RoomAccessType>(
    RoomAccessType.PUBLIC,
  );
  const [gender, setGender] = React.useState<RoomGender>(RoomGender.COMMON);
  const [status, setStatus] = React.useState<RoomStatus>(RoomStatus.AVAILABLE);
  const [selectedAdminPerformerId, setSelectedAdminPerformerId] =
    React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<
    Record<string, string[] | undefined>
  >({});
  const [generalError, setGeneralError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const handleClose = (newOpen: boolean) => {
    if (!newOpen) {
      setNumber("");
      setPurpose("");
      setAccessType(RoomAccessType.PUBLIC);
      setGender(RoomGender.COMMON);
      setStatus(RoomStatus.AVAILABLE);
      setSelectedAdminPerformerId("");
      setFieldErrors({});
      setGeneralError(null);
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setGeneralError(null);

    const formData = new FormData();
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
        const result = await createRoomAction(undefined, formData);
        if (result.success) {
          toast.success(
            result.message || `Room "${number}" created successfully!`,
          );
          handleClose(false);
          onRoomCreated?.();
        } else {
          if (result.fieldErrors) {
            setFieldErrors(result.fieldErrors);
          }
          setGeneralError(result.message || "Failed to create room.");
        }
      } catch (err) {
        console.error("Create room exception:", err);
        setGeneralError(
          "An unexpected system error occurred. Please try again.",
        );
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] sm:max-w-xl md:max-w-2xl max-h-[92vh] overflow-y-auto p-0 gap-0 border-border/80 shadow-2xl rounded-2xl">
        {/* Header */}
        <div className="p-6 border-b border-border/60 bg-muted/20">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                <DoorOpen className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  Register New Facility Room
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Add a new consultation room, clinical station, or public
                  amenity.
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
                <p className="font-semibold">Creation Error</p>
                <p className="text-[11px] opacity-90">{generalError}</p>
              </div>
            </div>
          )}

          {/* Room Number & Purpose */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="room-number" className="text-xs font-semibold">
                Room Number / Code <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="room-number"
                  placeholder="e.g. 101, ICU-1, OPD-3"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  disabled={isPending}
                  className={
                    fieldErrors.number
                      ? "border-destructive focus-visible:ring-destructive"
                      : ""
                  }
                  autoFocus
                />
              </div>
              {fieldErrors.number && (
                <p className="text-[11px] font-medium text-destructive">
                  {fieldErrors.number[0]}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="room-purpose" className="text-xs font-semibold">
                Purpose / Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="room-purpose"
                placeholder="e.g. Consultation, ECG, X-Ray"
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

          {/* Access Type & Gender Classification */}
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
                Gender Classification{" "}
                <span className="text-destructive">*</span>
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

          {/* Initial Status */}
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
                <SelectValue placeholder="Select initial status">
                  {(val: string | null) =>
                    val
                      ? STATUS_LABELS[String(val)] || String(val)
                      : "Select initial status"
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
              onClick={() => handleClose(false)}
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
                  <span>Registering...</span>
                </>
              ) : (
                <>
                  <DoorOpen className="size-3.5" />
                  <span>Register Room</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
