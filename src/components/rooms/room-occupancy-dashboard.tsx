"use client";

import * as React from "react";
import { useRealtime } from "@/hooks/use-realtime";
import { getAllRoomsWithOccupancy, vacateRoom } from "@/actions/rooms";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DoorOpen,
  Users,
  Clock,
  RefreshCw,
  LogOut,
  BedDouble,
  CheckCircle2,
  Activity,
  Lock,
  Stethoscope,
} from "lucide-react";
import { formatBSTTime } from "@/lib/date";
import { useI18n } from "@/lib/i18n";
import { compareRoomNumbers } from "@/lib/rooms";

type RoomOccupancyResponse = NonNullable<
  Awaited<ReturnType<typeof getAllRoomsWithOccupancy>>
>;
type RoomItem = RoomOccupancyResponse["rooms"][number];

export function RoomOccupancyDashboard({
  initialData,
  searchQuery: externalSearchQuery,
}: {
  initialData?: RoomOccupancyResponse;
  searchQuery?: string;
}) {
  const { t } = useI18n();
  const [data, setData] = React.useState<RoomOccupancyResponse | undefined>(
    initialData,
  );
  const [filterCategory, setFilterCategory] = React.useState<string>("ALL");
  const [isPending, startTransition] = React.useTransition();

  const activeSearch = externalSearchQuery || "";

  const loadRooms = React.useCallback(() => {
    startTransition(async () => {
      try {
        const res = await getAllRoomsWithOccupancy();
        setData(res);
      } catch (err) {
        console.error("Failed to load room occupancy", err);
      }
    });
  }, []);

  React.useEffect(() => {
    if (!initialData) {
      let isMounted = true;
      getAllRoomsWithOccupancy()
        .then((res) => {
          if (isMounted) setData(res);
        })
        .catch(console.error);
      return () => {
        isMounted = false;
      };
    }
  }, [initialData]);

  useRealtime({
    onRefresh: loadRooms,
  });

  const handleVacateRoom = async (roomNumber: string) => {
    await vacateRoom(roomNumber);
    loadRooms();
  };

  const rooms: RoomItem[] = React.useMemo(() => data?.rooms || [], [data]);
  const stats = React.useMemo(() => {
    return (
      data?.stats || {
        totalRooms: 16,
        totalCapacity: 24,
        totalActivePatients: 0,
        occupiedRoomsCount: 0,
        vacantRoomsCount: 16,
      }
    );
  }, [data]);

  const uniquePurposes = React.useMemo(() => {
    const set = new Set<string>();
    for (const r of rooms) {
      if (r.purpose) set.add(r.purpose);
    }
    return Array.from(set);
  }, [rooms]);

  const filteredRooms = React.useMemo(() => {
    let list = rooms;
    if (filterCategory === "OCCUPIED") {
      list = rooms.filter((r) => r.isOccupied);
    } else if (filterCategory === "VACANT") {
      list = rooms.filter((r) => !r.isOccupied);
    } else if (filterCategory === "STAFF_ONLY") {
      list = rooms.filter((r) => r.isStaffOnly);
    } else if (filterCategory === "DOCTOR_ONLY") {
      list = rooms.filter(
        (r) =>
          !r.isStaffOnly &&
          (r.type === "DOCTOR" ||
            (r.purpose && r.purpose.toLowerCase().includes("doctor")) ||
            (r.name && r.name.toLowerCase().includes("doctor"))),
      );
    } else if (filterCategory !== "ALL") {
      list = rooms.filter(
        (r) =>
          r.purpose === filterCategory ||
          (r.genderPreference && r.genderPreference === filterCategory) ||
          (r.type && r.type === filterCategory),
      );
    }

    if (activeSearch.trim()) {
      const rawQ = activeSearch.trim().toLowerCase();
      const cleanQ = rawQ.replace(/^[#\s]+/, "");
      const numOnlyQ = rawQ.replace(/[^0-9]/g, "");

      list = list.filter((r) => {
        const roomNum = r.roomNumber.toLowerCase();
        const name = r.name.toLowerCase();
        const purpose = (r.purpose || "").toLowerCase();
        const floor = (r.floor || "").toLowerCase();
        const type = (r.type || "").toLowerCase();
        const notes = (r.notes || "").toLowerCase();

        // 1. Check direct room properties
        const matchesRoom =
          roomNum === rawQ ||
          roomNum === cleanQ ||
          roomNum.includes(cleanQ) ||
          rawQ === `room ${roomNum}` ||
          name.includes(rawQ) ||
          purpose.includes(rawQ) ||
          floor.includes(rawQ) ||
          type.includes(rawQ) ||
          notes.includes(rawQ);

        if (matchesRoom) return true;

        // 2. Check active in-session patients (name, phone, serial #, patient id, doctor/handler)
        const matchesOccupant = (r.activePatients || []).some((p) => {
          const patName = (p.name || "").toLowerCase();
          const patPhone = (p.phone || "").toLowerCase();
          const patId = String(p.patientId || "").toLowerCase();
          const serialNum = String(p.serialNumber || "");
          const paddedSerial = serialNum.padStart(2, "0");
          const plan = (p.assignedTreatmentPlan || "").toLowerCase();
          const doc = (p.doctorName || "").toLowerCase();
          const handler = (p.handlerName || "").toLowerCase();

          // Serial number match
          const matchesSerial =
            p.serialNumber !== undefined &&
            (rawQ === serialNum ||
              rawQ === `#${serialNum}` ||
              rawQ === paddedSerial ||
              rawQ === `#${paddedSerial}` ||
              cleanQ === serialNum ||
              cleanQ === paddedSerial ||
              rawQ === `serial ${serialNum}` ||
              rawQ === `sl ${serialNum}`);

          // Phone match
          const matchesPhone =
            patPhone.includes(rawQ) ||
            (numOnlyQ && patPhone.replace(/[^0-9]/g, "").includes(numOnlyQ));

          // Patient ID match
          const matchesPatId =
            patId.includes(rawQ) ||
            patId.includes(cleanQ) ||
            (numOnlyQ && patId.replace(/[^0-9]/g, "").includes(numOnlyQ));

          return (
            patName.includes(rawQ) ||
            matchesPhone ||
            matchesPatId ||
            matchesSerial ||
            plan.includes(rawQ) ||
            doc.includes(rawQ) ||
            handler.includes(rawQ)
          );
        });

        return matchesOccupant;
      });
    }

    return list
      .slice()
      .sort((a, b) => compareRoomNumbers(a.roomNumber, b.roomNumber));
  }, [rooms, filterCategory, activeSearch]);

  return (
    <div className="space-y-3 w-full max-w-full min-w-0">
      {/* Top Occupancy Statistics (Compact & High Density) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 min-w-0">
        <Card className="p-2 sm:p-2.5 shadow-xs border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase">
              {t("nav.chambers", "Total Chambers")}
            </span>
            <DoorOpen className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-lg sm:text-xl font-black mt-0.5 font-mono text-foreground">
            {stats.totalRooms} Rooms
          </p>
          <span className="text-[9px] sm:text-[10px] text-muted-foreground block">
            {stats.totalCapacity} Total Clinic Beds
          </span>
        </Card>

        <Card className="p-2 sm:p-2.5 shadow-xs border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-semibold text-primary uppercase">
              {t("status.in_therapy", "Patients In Session")}
            </span>
            <Activity className="h-3.5 w-3.5 text-primary animate-pulse" />
          </div>
          <p className="text-lg sm:text-xl font-black mt-0.5 font-mono text-primary">
            {stats.totalActivePatients} Active
          </p>
          <span className="text-[9px] sm:text-[10px] text-muted-foreground block">
            Receiving therapy across rooms
          </span>
        </Card>

        <Card className="p-2 sm:p-2.5 shadow-xs border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-semibold text-amber-500 uppercase">
              Occupied Rooms
            </span>
            <BedDouble className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <p className="text-lg sm:text-xl font-black mt-0.5 font-mono text-amber-500">
            {stats.occupiedRoomsCount} Rooms
          </p>
          <span className="text-[9px] sm:text-[10px] text-muted-foreground block">
            With 1 or more patients
          </span>
        </Card>

        <Card className="p-2 sm:p-2.5 shadow-xs border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-semibold text-emerald-500 uppercase">
              Vacant Rooms
            </span>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <p className="text-lg sm:text-xl font-black mt-0.5 font-mono text-emerald-500">
            {stats.vacantRoomsCount} Rooms
          </p>
          <span className="text-[9px] sm:text-[10px] text-muted-foreground block">
            Ready for new check-in
          </span>
        </Card>
      </div>

      {/* Dynamic Filter and Control Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-card p-1.5 sm:p-2 rounded-xl border border-border shadow-xs max-w-full min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            size="sm"
            variant={filterCategory === "ALL" ? "default" : "outline"}
            onClick={() => setFilterCategory("ALL")}
            className="text-xs h-7 px-2.5 cursor-pointer font-semibold whitespace-nowrap"
          >
            All ({rooms.length})
          </Button>
          <Button
            size="sm"
            variant={filterCategory === "OCCUPIED" ? "default" : "outline"}
            onClick={() => setFilterCategory("OCCUPIED")}
            className="text-xs h-7 px-2.5 cursor-pointer font-semibold whitespace-nowrap"
          >
            Occupied ({stats.occupiedRoomsCount})
          </Button>
          <Button
            size="sm"
            variant={filterCategory === "VACANT" ? "default" : "outline"}
            onClick={() => setFilterCategory("VACANT")}
            className="text-xs h-7 px-2.5 cursor-pointer font-semibold whitespace-nowrap"
          >
            Vacant ({stats.vacantRoomsCount})
          </Button>
          <Button
            size="sm"
            variant={filterCategory === "DOCTOR_ONLY" ? "default" : "outline"}
            onClick={() => setFilterCategory("DOCTOR_ONLY")}
            className="text-xs h-7 px-2.5 cursor-pointer font-semibold gap-1 whitespace-nowrap text-blue-600 dark:text-blue-400"
          >
            <Stethoscope className="h-3 w-3" />
            <span>
              Doctor Chambers (
              {
                rooms.filter(
                  (r) =>
                    !r.isStaffOnly &&
                    (r.type === "DOCTOR" ||
                      (r.purpose &&
                        r.purpose.toLowerCase().includes("doctor")) ||
                      (r.name && r.name.toLowerCase().includes("doctor"))),
                ).length
              }
              )
            </span>
          </Button>
          <Button
            size="sm"
            variant={filterCategory === "STAFF_ONLY" ? "default" : "outline"}
            onClick={() => setFilterCategory("STAFF_ONLY")}
            className="text-xs h-7 px-2.5 cursor-pointer font-semibold gap-1 whitespace-nowrap"
          >
            <Lock className="h-3 w-3" />
            <span>
              Staff Only ({rooms.filter((r) => r.isStaffOnly).length})
            </span>
          </Button>
          {uniquePurposes.slice(0, 3).map((purpose) => (
            <Button
              key={purpose}
              size="sm"
              variant={filterCategory === purpose ? "default" : "outline"}
              onClick={() => setFilterCategory(purpose)}
              className="text-xs h-7 px-2.5 cursor-pointer font-semibold whitespace-nowrap"
            >
              {purpose}
            </Button>
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadRooms}
          className="text-xs h-7 px-2.5 cursor-pointer gap-1 shrink-0 ml-auto sm:ml-0"
        >
          <RefreshCw
            className={`h-3 w-3 ${isPending ? "animate-spin text-primary" : ""}`}
          />
          <span>Live Refresh</span>
        </Button>
      </div>

      {/* Room Grid (Rooms 201 to 220) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
        {filteredRooms.map((room) => {
          const isOccupied = room.isOccupied;
          const activeCount = room.activeCount;
          const capacity =
            typeof room.capacity === "number" ? room.capacity : 0;
          const availableBeds = room.availableBeds;
          const isDocRoom =
            room.type === "DOCTOR" ||
            room.type === "CONSULTATION" ||
            (room.purpose && room.purpose.toLowerCase().includes("doctor")) ||
            (room.purpose &&
              room.purpose.toLowerCase().includes("consultation"));

          return (
            <Card
              key={room.roomNumber}
              className={`border transition-all shadow-xs rounded-xl ${
                isOccupied
                  ? capacity > 0 && activeCount >= capacity
                    ? "border-amber-500/40 bg-amber-500/5"
                    : "border-primary/40 bg-primary/5"
                  : "border-border/80 bg-card hover:border-border"
              }`}
            >
              <CardHeader className="p-2.5 pb-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex items-center justify-center h-7 w-7 rounded-lg font-mono font-black text-xs bg-card border border-border shadow-xs text-foreground shrink-0">
                      {room.roomNumber}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-foreground truncate flex items-center gap-1">
                        <span className="truncate">{room.name}</span>
                        {room.isStaffOnly ? (
                          <span className="text-[9px] px-1 py-0 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 font-bold shrink-0">
                            🔒 Staff
                          </span>
                        ) : isDocRoom ? (
                          <span className="text-[9px] px-1 py-0 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-bold shrink-0 flex items-center gap-0.5">
                            <Stethoscope className="h-2.5 w-2.5" />
                            Doctor
                          </span>
                        ) : null}
                      </div>
                      <span className="text-[10px] text-muted-foreground truncate block">
                        {room.purpose || "Therapy Chamber"}
                      </span>
                    </div>
                  </div>

                  <Badge
                    variant={
                      isOccupied
                        ? capacity > 0 && activeCount >= capacity
                          ? "default"
                          : "secondary"
                        : "outline"
                    }
                    className="text-[9px] font-bold px-1.5 py-0 shrink-0"
                  >
                    {isOccupied
                      ? capacity === 0
                        ? `${activeCount} In Session`
                        : `${activeCount}/${capacity} In Use`
                      : capacity === 0
                        ? "0 Beds (Open)"
                        : "Vacant"}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-2.5 pt-0.5 space-y-2">
                {/* Active Patients inside this Room */}
                {room.activePatients && room.activePatients.length > 0 ? (
                  <div className="space-y-1 pt-0.5">
                    <span className="text-[10px] font-bold text-foreground flex items-center gap-1">
                      <Users className="h-3 w-3 text-primary" />
                      <span>
                        {room.activePatients.length} Active Patient(s):
                      </span>
                    </span>

                    {room.activePatients.map((p, idx) => (
                      <div
                        key={idx}
                        className="p-1.5 rounded-md bg-background border border-border/80 text-xs flex items-center justify-between"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-foreground flex items-center gap-1 text-[11px] truncate">
                            {p.serialNumber && (
                              <span className="font-mono text-primary font-bold">
                                #{p.serialNumber}
                              </span>
                            )}
                            <span className="truncate">{p.name}</span>
                          </div>
                          <div className="text-[9px] text-muted-foreground font-mono">
                            ID: #{p.patientId} &bull; {p.gender}
                          </div>
                          {p.assignedTreatmentPlan && (
                            <div className="text-[9px] text-primary/80 line-clamp-1 mt-0.5">
                              {p.assignedTreatmentPlan}
                            </div>
                          )}
                        </div>

                        {p.startTime && (
                          <div className="text-right shrink-0 ml-1">
                            <span className="text-[9px] font-mono text-muted-foreground flex items-center gap-0.5">
                              <Clock className="h-2.5 w-2.5" />
                              <span>{formatBSTTime(p.startTime)}</span>
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-2.5 text-center text-muted-foreground text-[10px] italic bg-muted/20 rounded-md border border-dashed border-border/60">
                    No active patients in this room.
                  </div>
                )}

                {/* Footer status & quick release */}
                <div className="flex items-center justify-between pt-1 border-t border-border/60 text-[10px]">
                  <span className="text-muted-foreground font-medium">
                    {capacity === 0
                      ? "Chair / Consultation (0 Beds)"
                      : availableBeds > 0
                        ? `${availableBeds} Bed(s) Available`
                        : "No Free Beds"}
                  </span>

                  {isOccupied && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleVacateRoom(room.roomNumber)}
                      className="h-5 px-1.5 text-[9px] text-destructive hover:bg-destructive/10 cursor-pointer"
                    >
                      <LogOut className="h-2.5 w-2.5 mr-0.5" />
                      <span>Free Room</span>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
