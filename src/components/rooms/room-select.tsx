"use client";

import * as React from "react";
import { getActiveRooms } from "@/actions/rooms";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DoorOpen, Users, AlertCircle, CheckCircle2 } from "lucide-react";
import { compareRoomNumbers } from "@/lib/rooms";

export interface RoomSelectProps {
  value: string;
  onChange: (roomNumber: string) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  genderFilter?: "MALE" | "FEMALE";
  roomsOccupancy?: Array<{
    id?: string;
    roomNumber: string;
    name: string;
    purpose?: string;
    type?: string;
    capacity: number;
    genderPreference?: string;
    isStaffOnly?: boolean;
    isOccupied: boolean;
    isFull: boolean;
    availableBeds: number;
    activeCount: number;
    activePatients?: Array<{ name: string; serialNumber?: number }>;
  }>;
  className?: string;
  error?: string;
}

export function RoomSelect({
  value,
  onChange,
  label = "Assigned Room / Therapy Bay",
  required = false,
  disabled = false,
  genderFilter,
  roomsOccupancy = [],
  className = "",
  error,
}: RoomSelectProps) {
  const [dynamicRooms, setDynamicRooms] = React.useState<
    Awaited<ReturnType<typeof getActiveRooms>>
  >([]);

  // If roomsOccupancy wasn't passed down, fetch active rooms dynamically
  React.useEffect(() => {
    if (roomsOccupancy.length === 0) {
      getActiveRooms()
        .then(setDynamicRooms)
        .catch(() => {});
    }
  }, [roomsOccupancy.length]);

  const availableRoomsList = React.useMemo(() => {
    const list =
      roomsOccupancy && roomsOccupancy.length > 0
        ? roomsOccupancy.map((r) => {
            const cap = typeof r.capacity === "number" ? r.capacity : 0;
            return {
              roomNumber: r.roomNumber,
              name: r.name,
              purpose: r.purpose || "Physiotherapy",
              type: r.type || "THERAPY_BAY",
              capacity: cap,
              genderPreference: r.genderPreference || "ALL",
              isStaffOnly: Boolean(r.isStaffOnly),
              isOccupied: r.isOccupied,
              isFull: r.isFull,
              availableBeds:
                r.availableBeds !== undefined ? r.availableBeds : cap,
              activeCount: r.activeCount || 0,
              activePatients: r.activePatients || [],
            };
          })
        : dynamicRooms.map((r) => {
            const cap = typeof r.capacity === "number" ? r.capacity : 0;
            return {
              roomNumber: r.roomNumber,
              name: r.name,
              purpose: r.purpose || "Physiotherapy",
              type: r.type || "THERAPY_BAY",
              capacity: cap,
              genderPreference: r.genderPreference || "ALL",
              isStaffOnly: Boolean(r.isStaffOnly),
              isOccupied: false,
              isFull: false,
              availableBeds: cap,
              activeCount: 0,
              activePatients: [] as Array<{
                name: string;
                serialNumber?: number;
              }>,
            };
          });

    return list.sort((a, b) => compareRoomNumbers(a.roomNumber, b.roomNumber));
  }, [roomsOccupancy, dynamicRooms]);

  // Clean room number (e.g. "Room 207" -> "207")
  const currentRoomNum = (value || "").replace(/[^0-9A-Za-z]/g, "");

  // Group rooms dynamically by their purpose / category
  const categorizedRooms = React.useMemo(() => {
    const map = new Map<string, typeof availableRoomsList>();
    for (const r of availableRoomsList) {
      const cat = r.purpose || "General Therapy Bays";
      const list = map.get(cat) || [];
      list.push(r);
      map.set(cat, list);
    }
    return Array.from(map.entries());
  }, [availableRoomsList]);

  const selectedRoomOccupancy = availableRoomsList.find(
    (r) =>
      r.roomNumber === currentRoomNum ||
      r.roomNumber.toLowerCase() === currentRoomNum.toLowerCase(),
  );

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
            <DoorOpen className="h-3.5 w-3.5 text-primary" />
            <span>{label}</span>
            {required && <span className="text-destructive font-bold">*</span>}
          </Label>
          {selectedRoomOccupancy && (
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                selectedRoomOccupancy.activeCount === 0
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  : selectedRoomOccupancy.capacity > 0 &&
                      selectedRoomOccupancy.isFull
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                    : "bg-primary/10 text-primary border border-primary/20"
              }`}
            >
              <Users className="h-3 w-3" />
              <span>
                {selectedRoomOccupancy.capacity === 0
                  ? selectedRoomOccupancy.activeCount === 0
                    ? "Consultation Room (Open)"
                    : `${selectedRoomOccupancy.activeCount} In Consultation`
                  : selectedRoomOccupancy.activeCount === 0
                    ? "All Beds Vacant"
                    : `${selectedRoomOccupancy.activeCount}/${selectedRoomOccupancy.capacity} Beds in Use`}
              </span>
            </span>
          )}
        </div>
      )}

      <div className="relative">
        <Select
          value={currentRoomNum}
          onValueChange={(val) => onChange(val || "")}
          disabled={disabled}
        >
          <SelectTrigger className="w-full h-8 text-xs font-medium bg-background border-input">
            <SelectValue placeholder="-- Select Room / Chamber --">
              {selectedRoomOccupancy
                ? `Room ${selectedRoomOccupancy.roomNumber} • ${selectedRoomOccupancy.name}`
                : currentRoomNum
                  ? `Room ${currentRoomNum}`
                  : undefined}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {categorizedRooms.map(([category, rooms]) => {
              const isRecommendedForGender =
                (genderFilter === "MALE" &&
                  (category.toLowerCase().includes("male") ||
                    rooms.some((r) => r.genderPreference === "MALE"))) ||
                (genderFilter === "FEMALE" &&
                  (category.toLowerCase().includes("female") ||
                    rooms.some((r) => r.genderPreference === "FEMALE")));

              return (
                <SelectGroup key={category}>
                  <SelectLabel className="text-[11px] font-bold text-muted-foreground px-2 py-1 bg-muted/30">
                    {category}{" "}
                    {isRecommendedForGender
                      ? `⭐ (Recommended for ${genderFilter})`
                      : ""}
                  </SelectLabel>
                  {rooms.map((r) => {
                    const activeCount = r.activeCount || 0;
                    const capacity = r.capacity || 0;

                    let statusText = `(Vacant • ${capacity} Beds)`;
                    if (capacity === 0) {
                      statusText =
                        activeCount > 0
                          ? `(${activeCount} In Consultation)`
                          : `(0 Beds • Consultation / Non-Bed)`;
                    } else if (activeCount > 0) {
                      if (activeCount >= capacity) {
                        statusText = `(${activeCount}/${capacity} Full • In Session)`;
                      } else {
                        statusText = `(${activeCount}/${capacity} In Session • ${capacity - activeCount} Bed Free)`;
                      }
                    }

                    return (
                      <SelectItem
                        key={r.roomNumber}
                        value={r.roomNumber}
                        className="text-xs py-1.5 cursor-pointer"
                      >
                        <div className="flex items-center gap-1.5">
                          {r.isStaffOnly && (
                            <span className="text-[9px] px-1 rounded bg-purple-500/10 text-purple-600 font-bold">
                              🔒 Staff
                            </span>
                          )}
                          <span className="font-mono font-bold">
                            Room {r.roomNumber}
                          </span>
                          <span className="text-muted-foreground">&bull;</span>
                          <span className="truncate max-w-[150px]">
                            {r.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground ml-auto pl-2">
                            {statusText}
                          </span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectGroup>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Inline Multi-Patient Occupancy Warning or Status */}
      {selectedRoomOccupancy &&
        selectedRoomOccupancy.activePatients &&
        selectedRoomOccupancy.activePatients.length > 0 && (
          <div className="p-2 rounded-lg border border-border bg-muted/40 text-[11px] space-y-1">
            <div className="font-semibold text-foreground flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-primary">
                <Users className="h-3.5 w-3.5" />
                <span>
                  Room {currentRoomNum} Currently Hosting{" "}
                  {selectedRoomOccupancy.activePatients.length} Patient(s)
                </span>
              </span>
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                  selectedRoomOccupancy.capacity === 0
                    ? "bg-blue-500/10 text-blue-600"
                    : selectedRoomOccupancy.isFull
                      ? "bg-amber-500/10 text-amber-600"
                      : "bg-emerald-500/10 text-emerald-600"
                }`}
              >
                {selectedRoomOccupancy.capacity === 0
                  ? "0 Beds / Open"
                  : selectedRoomOccupancy.isFull
                    ? "Capacity Full"
                    : `${selectedRoomOccupancy.availableBeds} Bed(s) Available`}
              </span>
            </div>

            <div className="space-y-1 pt-1">
              {selectedRoomOccupancy.activePatients.map((p, idx) => (
                <div
                  key={idx}
                  className="p-1 rounded bg-background border border-border/60 text-[10px] flex items-center justify-between"
                >
                  <span className="font-medium text-foreground">
                    {p.serialNumber ? `#${p.serialNumber} ` : ""}
                    {p.name}
                  </span>
                  <span className="text-muted-foreground">In Session</span>
                </div>
              ))}
            </div>

            {selectedRoomOccupancy.isFull ? (
              <p className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1 pt-0.5">
                <AlertCircle className="h-3 w-3 shrink-0" />
                <span>
                  Note: Room is at full standard capacity (
                  {selectedRoomOccupancy.capacity} beds). Assigning another
                  patient will add to this bay.
                </span>
              </p>
            ) : selectedRoomOccupancy.capacity > 0 ? (
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 pt-0.5">
                <CheckCircle2 className="h-3 w-3 shrink-0" />
                <span>
                  {selectedRoomOccupancy.availableBeds} bed(s) available in this
                  room.
                </span>
              </p>
            ) : null}
          </div>
        )}

      {error && (
        <p className="text-[11px] text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
