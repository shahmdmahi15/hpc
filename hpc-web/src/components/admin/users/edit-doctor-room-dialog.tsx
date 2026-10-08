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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { updateDoctorConsultationRoomAction } from "@/actions/admin/user.action";
import { toast } from "sonner";
import {
  DoorClosed,
  Stethoscope,
  Loader2,
  CheckCircle2,
  Building2,
  XCircle,
  Sparkles,
} from "lucide-react";
import { RoomAccessType, RoomStatus } from "@/generated/prisma/enums";

export interface DoctorRoomTarget {
  id: string;
  name?: string | null;
  email?: string | null;
  consultationRoomId?: string | null;
  consultationRoom?: {
    id: string;
    number: string;
    purpose?: string | null;
    accessType?: string;
    status?: string;
  } | null;
}

export interface RoomOption {
  id: string;
  number: string;
  purpose?: string | null;
  accessType: RoomAccessType | string;
  status: RoomStatus | string;
}

interface EditDoctorRoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctor: DoctorRoomTarget | null;
  rooms: RoomOption[];
  onSuccess?: (doctorId: string, room: RoomOption | null) => void;
}

export function EditDoctorRoomDialog({
  open,
  onOpenChange,
  doctor,
  rooms,
  onSuccess,
}: EditDoctorRoomDialogProps) {
  const [selectedRoomId, setSelectedRoomId] = React.useState<string>("none");
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open && doctor) {
      setSelectedRoomId(doctor.consultationRoomId || "none");
    }
  }, [open, doctor]);

  if (!doctor) return null;

  // Filter doctor consultation rooms: strictly DOCTOR type rooms only
  const doctorChambers = React.useMemo(() => {
    return rooms.filter((r) => r.accessType === RoomAccessType.DOCTOR);
  }, [rooms]);

  const selectedRoomObj = doctorChambers.find((r) => r.id === selectedRoomId) || null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    startTransition(async () => {
      const targetRoomId = selectedRoomId === "none" ? null : selectedRoomId;
      const res = await updateDoctorConsultationRoomAction(
        doctor.id,
        targetRoomId,
      );
      if (res.success) {
        toast.success(res.message);
        onSuccess?.(doctor.id, selectedRoomObj);
        onOpenChange(false);
      } else {
        toast.error(res.message);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-md max-h-[92dvh] flex flex-col p-0 overflow-hidden rounded-2xl border bg-card shadow-2xl">
        <div className="shrink-0 p-4 sm:p-5 pr-12 sm:pr-14 border-b border-border/60 bg-muted/20">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <DoorClosed className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  Set Consultation Chamber
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Assign a default clinic room/chamber for this doctor
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <form
          onSubmit={handleSubmit}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-lpignore="true"
          data-1p-ignore="true"
          data-bwignore="true"
          data-form-type="other"
          className="flex flex-col flex-1 min-h-0 overflow-hidden"
        >
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4">
          {/* Doctor Info Card */}
          <div className="p-3 rounded-xl border border-border/80 bg-muted/40 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">
                Dr. {doctor.name || "Doctor"}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 font-semibold">
                DOCTOR
              </span>
            </div>
            {doctor.email && (
              <span className="text-[11px] text-muted-foreground font-mono block truncate">
                {doctor.email}
              </span>
            )}
            <div className="pt-1 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Current Assigned Chamber:</span>
              <span className="font-mono font-bold text-foreground">
                {doctor.consultationRoom ? (
                  `Room ${doctor.consultationRoom.number}${
                    doctor.consultationRoom.purpose
                      ? ` (${doctor.consultationRoom.purpose})`
                      : ""
                  }`
                ) : (
                  <span className="text-muted-foreground font-normal italic">
                    None / Unassigned
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* Quick Doctor Chamber Suggestions */}
          {doctorChambers.length > 0 ? (
            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="size-3 text-indigo-500" />
                <span>Quick Chambers ({doctorChambers.length} DOCTOR rooms)</span>
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {doctorChambers.map((room) => {
                  const isSelected = selectedRoomId === room.id;
                  return (
                    <button
                      key={room.id}
                      type="button"
                      onClick={() => setSelectedRoomId(room.id)}
                      className={`p-2 rounded-xl border text-left cursor-pointer transition-all flex items-start gap-2 ${
                        isSelected
                          ? "border-indigo-500 bg-indigo-500/10 text-indigo-950 dark:text-indigo-100 ring-1 ring-indigo-500 font-bold"
                          : "border-border/80 bg-background text-foreground hover:bg-muted/50"
                      }`}
                    >
                      <Building2 className={`size-3.5 mt-0.5 shrink-0 ${isSelected ? "text-indigo-500" : "text-muted-foreground"}`} />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-mono font-bold truncate">
                          Room {room.number}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {room.purpose || "Doctor Chamber"}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl border border-dashed border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2">
              <Building2 className="size-4 shrink-0 text-amber-500" />
              <span>No DOCTOR type rooms found. Only DOCTOR type rooms can be assigned as a doctor chamber.</span>
            </div>
          )}

          {/* Room Dropdown Select */}
          <div className="space-y-1.5">
            <Label htmlFor="chamber-select" className="text-xs font-bold text-foreground">
              Select Room / Chamber
            </Label>
            <Select
              value={selectedRoomId}
              onValueChange={(val) => setSelectedRoomId(val ?? "none")}
            >
              <SelectTrigger
                id="chamber-select"
                className="h-10 text-xs rounded-xl bg-background border-border/80 w-full"
              >
                <SelectValue placeholder="Choose a DOCTOR chamber room..." />
              </SelectTrigger>
              <SelectContent className="max-h-56">
                <SelectItem value="none" label="-- No Chamber Assigned (Clear) --">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <XCircle className="size-3.5" />
                    <span>-- No Chamber Assigned (Clear) --</span>
                  </div>
                </SelectItem>

                {doctorChambers.map((room) => {
                  const roomLabel = `Room ${room.number}${room.purpose ? ` - ${room.purpose}` : ""}`;

                  return (
                    <SelectItem key={room.id} value={room.id} label={roomLabel}>
                      <div className="flex items-center justify-between gap-3 w-full">
                        <span className="font-mono font-bold">
                          Room {room.number}
                        </span>
                        <span className="text-muted-foreground text-[11px] truncate max-w-[140px]">
                          {room.purpose || "Doctor Chamber"}
                        </span>
                        <span className="text-[9.5px] px-1 py-0.2 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold">
                          DOCTOR
                        </span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="shrink-0 p-3 sm:p-4 flex flex-row items-center justify-end gap-2 border-t border-border/60 bg-muted/20">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              className="text-xs rounded-xl cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isPending}
              className="text-xs font-bold rounded-xl cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3.5" />
                  <span>Save Chamber</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
