"use client";

import {
  RoomAccessType,
  RoomGender,
  RoomStatus,
} from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import {
  DoorOpen,
  Users,
  Stethoscope,
  Globe,
  User,
  Activity,
  AlertTriangle,
  Clock,
  CheckCircle2,
} from "lucide-react";

export function RoomStatusBadge({ status }: { status: RoomStatus }) {
  switch (status) {
    case RoomStatus.AVAILABLE:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Available
        </span>
      );
    case RoomStatus.OCCUPIED:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          <span className="size-1.5 rounded-full bg-amber-500" />
          Occupied
        </span>
      );
    case RoomStatus.MAINTENANCE:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
          <AlertTriangle className="size-3" />
          Maintenance
        </span>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function RoomAccessBadge({
  accessType,
}: {
  accessType: RoomAccessType;
}) {
  switch (accessType) {
    case RoomAccessType.PUBLIC:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
          <Globe className="size-3 text-emerald-500" />
          Public
        </span>
      );
    case RoomAccessType.STAFF:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
          <Users className="size-3 text-blue-500" />
          Staff Only
        </span>
      );
    case RoomAccessType.DOCTOR:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
          <Stethoscope className="size-3 text-purple-500" />
          Doctor Console
        </span>
      );
    default:
      return <Badge variant="outline">{accessType}</Badge>;
  }
}

export function RoomGenderBadge({ gender }: { gender: RoomGender }) {
  switch (gender) {
    case RoomGender.MALE:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">
          Male
        </span>
      );
    case RoomGender.FEMALE:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-pink-500/10 text-pink-700 dark:text-pink-300 border border-pink-500/20">
          Female
        </span>
      );
    case RoomGender.COMMON:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-muted text-muted-foreground border border-border">
          All / Common
        </span>
      );
    default:
      return <Badge variant="outline">{gender}</Badge>;
  }
}
