"use server";

import { prisma } from "@/lib/prisma";
import { SerialStatus, HourlySlot } from "@/generated/prisma/enums";
import { getStartAndEndOfBSTDay } from "@/lib/date";

export async function getKioskWaitingRoomData(dateStr?: string) {
  const { startOfDay, endOfDay } = getStartAndEndOfBSTDay(dateStr);

  const serials = await prisma.serial.findMany({
    where: {
      date: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
    orderBy: [{ queuePriorityScore: "asc" }, { serialNumber: "asc" }],
    include: {
      patient: true,
      doctor: { select: { id: true, name: true } },
      handler: { select: { id: true, name: true } },
    },
  });

  const currentlyCalling = serials.filter(
    (s) =>
      s.status === SerialStatus.CALLING ||
      s.status === SerialStatus.IN_CONSULTATION ||
      s.status === SerialStatus.IN_THERAPY,
  );

  const waitingSerials = serials.filter(
    (s) =>
      s.status === SerialStatus.WAITING ||
      s.status === SerialStatus.CHECKED_IN ||
      s.status === SerialStatus.PENDING,
  );

  const completedSerials = serials.filter(
    (s) => s.status === SerialStatus.COMPLETED,
  );

  // Group by hourly slots for schedule display
  const hourlySlotsOrder = [
    { key: HourlySlot.SLOT_10_11, label: "10:00 - 11:00 AM" },
    { key: HourlySlot.SLOT_11_12, label: "11:00 - 12:00 PM" },
    { key: HourlySlot.SLOT_12_01, label: "12:00 - 01:00 PM" },
    { key: HourlySlot.SLOT_01_02, label: "01:00 - 02:00 PM" },
    { key: HourlySlot.SLOT_02_03, label: "02:00 - 03:00 PM" },
    { key: HourlySlot.SLOT_03_04, label: "03:00 - 04:00 PM" },
    { key: HourlySlot.SLOT_04_05, label: "04:00 - 05:00 PM" },
    { key: HourlySlot.SLOT_05_06, label: "05:00 - 06:00 PM" },
    { key: HourlySlot.SLOT_06_07, label: "06:00 - 07:00 PM" },
    { key: HourlySlot.SLOT_07_08, label: "07:00 - 08:00 PM" },
  ];

  return {
    allSerials: serials,
    currentlyCalling,
    waitingSerials,
    completedSerials,
    stats: {
      totalBooked: serials.length,
      currentlyServing: currentlyCalling.length,
      waiting: waitingSerials.length,
      completed: completedSerials.length,
    },
    hourlySlotsOrder,
  };
}
