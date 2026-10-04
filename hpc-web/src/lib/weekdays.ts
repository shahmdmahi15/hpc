export const WEEK_DAYS = [
  { value: "SATURDAY", short: "Sat", label: "Saturday" },
  { value: "SUNDAY", short: "Sun", label: "Sunday" },
  { value: "MONDAY", short: "Mon", label: "Monday" },
  { value: "TUESDAY", short: "Tue", label: "Tuesday" },
  { value: "WEDNESDAY", short: "Wed", label: "Wednesday" },
  { value: "THURSDAY", short: "Thu", label: "Thursday" },
  { value: "FRIDAY", short: "Fri", label: "Friday" },
] as const;

export type DayKey = (typeof WEEK_DAYS)[number]["value"];

export const ALL_DAYS: DayKey[] = WEEK_DAYS.map((d) => d.value);

export const WORKING_DAYS_SAT_THU: DayKey[] = [
  "SATURDAY",
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
];

export const STANDARD_WEEKDAYS_MON_FRI: DayKey[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
];

/**
 * Parses raw stored weekDays string into an array of DayKey values.
 * If "ALL", undefined, or empty, returns all 7 days.
 */
export function parseWeekDays(raw?: string | null): DayKey[] {
  if (!raw || raw.trim().toUpperCase() === "ALL") {
    return [...ALL_DAYS];
  }

  const split = raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s): s is DayKey => WEEK_DAYS.some((d) => d.value === s));

  return split.length > 0 ? split : [...ALL_DAYS];
}

/**
 * Serializes an array of DayKey items into database format.
 * Returns "ALL" if all 7 days are selected.
 */
export function serializeWeekDays(days: DayKey[]): string {
  if (days.length === 0 || days.length === 7) {
    return "ALL";
  }

  // Preserve standard calendar order (Sat -> Fri)
  const ordered = ALL_DAYS.filter((d) => days.includes(d));
  return ordered.join(",");
}

/**
 * Formats a list or raw string of days into a clean human-readable summary.
 */
export function formatWeekDays(daysOrRaw?: DayKey[] | string | null): string {
  const days = Array.isArray(daysOrRaw) ? daysOrRaw : parseWeekDays(daysOrRaw);

  if (days.length === 7) {
    return "Every Day";
  }

  if (
    days.length === WORKING_DAYS_SAT_THU.length &&
    WORKING_DAYS_SAT_THU.every((d) => days.includes(d))
  ) {
    return "Sat – Thu (Workdays)";
  }

  if (
    days.length === STANDARD_WEEKDAYS_MON_FRI.length &&
    STANDARD_WEEKDAYS_MON_FRI.every((d) => days.includes(d))
  ) {
    return "Mon – Fri";
  }

  if (days.length === 1) {
    const found = WEEK_DAYS.find((d) => d.value === days[0]);
    return found ? `${found.label}s only` : days[0];
  }

  const shorts = ALL_DAYS.filter((d) => days.includes(d)).map(
    (d) => WEEK_DAYS.find((item) => item.value === d)?.short || d,
  );

  return shorts.join(", ");
}

/**
 * Returns true if a slot configured with `weekDaysRaw` operates on the given `day`.
 */
export function isSlotActiveOnDay(
  weekDaysRaw: string | null | undefined,
  day: DayKey,
): boolean {
  if (!weekDaysRaw || weekDaysRaw.trim().toUpperCase() === "ALL") {
    return true;
  }
  const parsed = parseWeekDays(weekDaysRaw);
  return parsed.includes(day);
}
