export type QueuePunctualityStatus = "green" | "yellow" | "red";

export interface PunctualityInfo {
  status: QueuePunctualityStatus;
  diffMinutes: number;
  label: string;
  badgeClass: string;
  cardClass: string;
  borderClass: string;
  textClass: string;
  dotClass: string;
}

/**
 * Parses a string time like "10:30 AM", "02:15 PM", or "14:30" into total minutes from 00:00.
 */
export function parseTimeToMinutes(
  timeStr: string | null | undefined,
): number | null {
  if (!timeStr) return null;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3]?.toUpperCase();

  if (period === "PM" && hours < 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

/**
 * Extracts minutes from a Date or ISO date-time string.
 */
export function getCheckInMinutes(
  checkInTime: Date | string | null | undefined,
): number | null {
  if (!checkInTime) return null;
  const date = new Date(checkInTime);
  if (isNaN(date.getTime())) return null;
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * Formats a Date or ISO string deterministically into a 12-hour time string like "10:15 AM".
 * Avoids browser vs server locale hydration mismatches (e.g. "12:44 pm" vs "12:44 PM").
 */
export function formatTime12h(
  dateVal: Date | string | null | undefined,
): string {
  if (!dateVal) return "--:--";
  const date = new Date(dateVal);
  if (isNaN(date.getTime())) return "--:--";

  let hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? "PM" : "AM";

  hours = hours % 12;
  if (hours === 0) hours = 12;

  const formattedHours = String(hours).padStart(2, "0");
  const formattedMinutes = String(minutes).padStart(2, "0");

  return `${formattedHours}:${formattedMinutes} ${period}`;
}

/**
 * Evaluates patient queue punctuality based on told arrival time vs actual check-in time:
 * - Before told time up to 5 minutes after told time -> GREEN (On-Time)
 * - 6 to 15 minutes after told time -> YELLOW (Late)
 * - More than 15 minutes after told time -> RED (Very Late)
 */
export function evaluatePunctuality(
  toldTime: string | null | undefined,
  checkInTime: Date | string | null | undefined,
): PunctualityInfo {
  // Fallback if no told time was given
  if (!toldTime || !checkInTime) {
    return {
      status: "green",
      diffMinutes: 0,
      label: "Checked In",
      badgeClass:
        "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
      cardClass: "bg-emerald-500/[0.04] dark:bg-emerald-950/20",
      borderClass: "border-emerald-500/40 dark:border-emerald-500/30",
      textClass: "text-emerald-600 dark:text-emerald-400",
      dotClass: "bg-emerald-500",
    };
  }

  const toldMins = parseTimeToMinutes(toldTime);
  const checkInMins = getCheckInMinutes(checkInTime);

  if (toldMins === null || checkInMins === null) {
    return {
      status: "green",
      diffMinutes: 0,
      label: "Checked In",
      badgeClass:
        "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
      cardClass: "bg-emerald-500/[0.04] dark:bg-emerald-950/20",
      borderClass: "border-emerald-500/40 dark:border-emerald-500/30",
      textClass: "text-emerald-600 dark:text-emerald-400",
      dotClass: "bg-emerald-500",
    };
  }

  const diff = checkInMins - toldMins;

  if (diff <= 5) {
    // Before told time up to 5 min after
    const label =
      diff < 0
        ? `${Math.abs(diff)}m Early`
        : diff === 0
          ? "Exact Time"
          : `+${diff}m (On Time)`;

    return {
      status: "green",
      diffMinutes: diff,
      label,
      badgeClass:
        "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
      cardClass: "bg-emerald-500/[0.04] dark:bg-emerald-950/20",
      borderClass: "border-emerald-500/40 dark:border-emerald-500/30",
      textClass: "text-emerald-600 dark:text-emerald-400",
      dotClass: "bg-emerald-500",
    };
  } else if (diff <= 15) {
    // 6 min to 15 min after told time
    return {
      status: "yellow",
      diffMinutes: diff,
      label: `+${diff}m Late`,
      badgeClass:
        "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
      cardClass: "bg-amber-500/[0.04] dark:bg-amber-950/20",
      borderClass: "border-amber-500/40 dark:border-amber-500/30",
      textClass: "text-amber-600 dark:text-amber-400",
      dotClass: "bg-amber-500",
    };
  } else {
    // More than 15 min after told time
    return {
      status: "red",
      diffMinutes: diff,
      label: `+${diff}m Late`,
      badgeClass:
        "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
      cardClass: "bg-rose-500/[0.05] dark:bg-rose-950/25",
      borderClass: "border-rose-500/50 dark:border-rose-500/40",
      textClass: "text-rose-600 dark:text-rose-400",
      dotClass: "bg-rose-500",
    };
  }
}
