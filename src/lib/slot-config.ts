import { HourlySlot } from "@/generated/prisma/enums";

export interface SlotConfiguration {
  key: HourlySlot;
  label: string;
  shortLabel: string;
  startHour: number; // 24hr format
  endHour: number; // 24hr format
  maxCapacity: number; // 6 patients max
  seatTimes: string[]; // ["10:00", "10:10", "10:20", "10:30", "10:40", "10:50"]
  seatDisplayLabels: string[]; // ["10:00 AM", "10:10 AM", ...]
}

export const MAX_PATIENTS_PER_SLOT = 6;

export const CLINIC_HOURLY_SLOTS: SlotConfiguration[] = [
  {
    key: HourlySlot.SLOT_10_11,
    label: "10:00 AM - 11:00 AM",
    shortLabel: "10-11 AM",
    startHour: 10,
    endHour: 11,
    maxCapacity: MAX_PATIENTS_PER_SLOT,
    seatTimes: ["10:00", "10:10", "10:20", "10:30", "10:40", "10:50"],
    seatDisplayLabels: [
      "10:00 AM",
      "10:10 AM",
      "10:20 AM",
      "10:30 AM",
      "10:40 AM",
      "10:50 AM",
    ],
  },
  {
    key: HourlySlot.SLOT_11_12,
    label: "11:00 AM - 12:00 PM",
    shortLabel: "11-12 PM",
    startHour: 11,
    endHour: 12,
    maxCapacity: MAX_PATIENTS_PER_SLOT,
    seatTimes: ["11:00", "11:10", "11:20", "11:30", "11:40", "11:50"],
    seatDisplayLabels: [
      "11:00 AM",
      "11:10 AM",
      "11:20 AM",
      "11:30 AM",
      "11:40 AM",
      "11:50 AM",
    ],
  },
  {
    key: HourlySlot.SLOT_12_01,
    label: "12:00 PM - 01:00 PM",
    shortLabel: "12-01 PM",
    startHour: 12,
    endHour: 13,
    maxCapacity: MAX_PATIENTS_PER_SLOT,
    seatTimes: ["12:00", "12:10", "12:20", "12:30", "12:40", "12:50"],
    seatDisplayLabels: [
      "12:00 PM",
      "12:10 PM",
      "12:20 PM",
      "12:30 PM",
      "12:40 PM",
      "12:50 PM",
    ],
  },
  {
    key: HourlySlot.SLOT_01_02,
    label: "01:00 PM - 02:00 PM",
    shortLabel: "01-02 PM",
    startHour: 13,
    endHour: 14,
    maxCapacity: MAX_PATIENTS_PER_SLOT,
    seatTimes: ["13:00", "13:10", "13:20", "13:30", "13:40", "13:50"],
    seatDisplayLabels: [
      "01:00 PM",
      "01:10 PM",
      "01:20 PM",
      "01:30 PM",
      "01:40 PM",
      "01:50 PM",
    ],
  },
  {
    key: HourlySlot.SLOT_02_03,
    label: "02:00 PM - 03:00 PM",
    shortLabel: "02-03 PM",
    startHour: 14,
    endHour: 15,
    maxCapacity: MAX_PATIENTS_PER_SLOT,
    seatTimes: ["14:00", "14:10", "14:20", "14:30", "14:40", "14:50"],
    seatDisplayLabels: [
      "02:00 PM",
      "02:10 PM",
      "02:20 PM",
      "02:30 PM",
      "02:40 PM",
      "02:50 PM",
    ],
  },
  {
    key: HourlySlot.SLOT_03_04,
    label: "03:00 PM - 04:00 PM",
    shortLabel: "03-04 PM",
    startHour: 15,
    endHour: 16,
    maxCapacity: MAX_PATIENTS_PER_SLOT,
    seatTimes: ["15:00", "15:10", "15:20", "15:30", "15:40", "15:50"],
    seatDisplayLabels: [
      "03:00 PM",
      "03:10 PM",
      "03:20 PM",
      "03:30 PM",
      "03:40 PM",
      "03:50 PM",
    ],
  },
  {
    key: HourlySlot.SLOT_04_05,
    label: "04:00 PM - 05:00 PM",
    shortLabel: "04-05 PM",
    startHour: 16,
    endHour: 17,
    maxCapacity: MAX_PATIENTS_PER_SLOT,
    seatTimes: ["16:00", "16:10", "16:20", "16:30", "16:40", "16:50"],
    seatDisplayLabels: [
      "04:00 PM",
      "04:10 PM",
      "04:20 PM",
      "04:30 PM",
      "04:40 PM",
      "04:50 PM",
    ],
  },
  {
    key: HourlySlot.SLOT_05_06,
    label: "05:00 PM - 06:00 PM",
    shortLabel: "05-06 PM",
    startHour: 17,
    endHour: 18,
    maxCapacity: MAX_PATIENTS_PER_SLOT,
    seatTimes: ["17:00", "17:10", "17:20", "17:30", "17:40", "17:50"],
    seatDisplayLabels: [
      "05:00 PM",
      "05:10 PM",
      "05:20 PM",
      "05:30 PM",
      "05:40 PM",
      "05:50 PM",
    ],
  },
  {
    key: HourlySlot.SLOT_06_07,
    label: "06:00 PM - 07:00 PM",
    shortLabel: "06-07 PM",
    startHour: 18,
    endHour: 19,
    maxCapacity: MAX_PATIENTS_PER_SLOT,
    seatTimes: ["18:00", "18:10", "18:20", "18:30", "18:40", "18:50"],
    seatDisplayLabels: [
      "06:00 PM",
      "06:10 PM",
      "06:20 PM",
      "06:30 PM",
      "06:40 PM",
      "06:50 PM",
    ],
  },
  {
    key: HourlySlot.SLOT_07_08,
    label: "07:00 PM - 08:00 PM",
    shortLabel: "07-08 PM",
    startHour: 19,
    endHour: 20,
    maxCapacity: MAX_PATIENTS_PER_SLOT,
    seatTimes: ["19:00", "19:10", "19:20", "19:30", "19:40", "19:50"],
    seatDisplayLabels: [
      "07:00 PM",
      "07:10 PM",
      "07:20 PM",
      "07:30 PM",
      "07:40 PM",
      "07:50 PM",
    ],
  },
];

/**
 * Finds the slot config for an HourlySlot key or time string
 */
export function getSlotConfig(key: HourlySlot): SlotConfiguration {
  const found = CLINIC_HOURLY_SLOTS.find((s) => s.key === key);
  return found || CLINIC_HOURLY_SLOTS[4]; // Default to 2-3 PM
}

/**
 * Maps a 24h time string like "14:30" or "10:15" to the corresponding HourlySlot
 */
export function findSlotByTimeString(timeStr: string): SlotConfiguration {
  if (!timeStr) return CLINIC_HOURLY_SLOTS[4];
  const [h] = timeStr.split(":").map(Number);
  const matched = CLINIC_HOURLY_SLOTS.find((s) => s.startHour === h);
  return matched || CLINIC_HOURLY_SLOTS[0];
}
