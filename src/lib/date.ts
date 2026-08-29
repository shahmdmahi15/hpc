/**
 * Bangladesh Standard Time (BST - UTC+6 / Asia/Dhaka) formatting utilities
 */

export function getBSTNow(): Date {
  return new Date();
}

export function formatBSTTime(
  date: Date | string | number | null | undefined,
  includeSeconds = false,
): string {
  if (!date) return "--:--";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "--:--";

  return d.toLocaleTimeString("en-US", {
    timeZone: "Asia/Dhaka",
    hour: "2-digit",
    minute: "2-digit",
    second: includeSeconds ? "2-digit" : undefined,
    hour12: true,
  });
}

export function formatBSTDate(
  date: Date | string | number | null | undefined,
): string {
  if (!date) return "---";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "---";

  return d.toLocaleDateString("en-US", {
    timeZone: "Asia/Dhaka",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatBSTShortDate(
  date: Date | string | number | null | undefined,
): string {
  if (!date) return "---";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "---";

  return d.toLocaleDateString("en-GB", {
    timeZone: "Asia/Dhaka",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Returns YYYY-MM-DD formatted date string strictly in Bangladesh Standard Time (UTC+6)
 */
export function getBSTDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Returns HH:MM (24-hour) formatted time string strictly in Bangladesh Standard Time (UTC+6)
 */
export function getBSTTimeString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/**
 * Accurately computes UTC start & end boundary for any BST (Asia/Dhaka) calendar date.
 */
export function getStartAndEndOfBSTDay(dateStr?: string) {
  const bstDate = dateStr || getBSTDateString();
  const [year, month, day] = bstDate.split("-").map(Number);

  // 00:00:00 BST is (UTC - 6 hours)
  const startOfDay = new Date(Date.UTC(year, month - 1, day, 0 - 6, 0, 0, 0));
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);
  const target = new Date(Date.UTC(year, month - 1, day, 12 - 6, 0, 0, 0));

  return { startOfDay, endOfDay, target, bstDateString: bstDate };
}

/**
 * Safely parses any time representation (e.g. "11:00 AM", "02:30 PM", "11:20", "11:00 AM (+20m)", "14:30", ISO string)
 * into a valid UTC Date object anchored to the specified BST calendar date (or today in BST).
 * Returns null if parsing fails, never returning an Invalid Date object.
 */
export function parseBSTTime(
  timeStr: string | null | undefined,
  baseDateStr?: string,
): Date | null {
  if (!timeStr || typeof timeStr !== "string") return null;

  const trimmed = timeStr.trim();
  if (!trimmed) return null;

  // 1. If it's already an ISO string with a date and time (contains 'T')
  if (trimmed.includes("T")) {
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }

  const bstDate = baseDateStr || getBSTDateString();
  const parts = bstDate.split("-").map(Number);
  if (parts.length < 3) return null;
  const [year, month, day] = parts;
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;

  // 2. Check for token offset in minutes like "(+10m)" or "(+20m)"
  let offsetMinutes = 0;
  const offsetMatch = trimmed.match(/\(\+(\d+)\s*m(?:in(?:ute)?s?)?\)/i);
  if (offsetMatch) {
    offsetMinutes = parseInt(offsetMatch[1], 10) || 0;
  }

  // 3. Match HH:MM with optional AM/PM
  // Handles formats like "11:00", "11:00 AM", "02:30 PM", "2:30pm", "11:00:00 AM"
  const timeMatch = trimmed.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    let minutes = parseInt(timeMatch[2], 10);
    const ampm = timeMatch[3]?.toUpperCase();

    if (ampm === "PM" && hours < 12) {
      hours += 12;
    } else if (ampm === "AM" && hours === 12) {
      hours = 0;
    }

    minutes += offsetMinutes;
    if (minutes >= 60) {
      hours += Math.floor(minutes / 60);
      minutes = minutes % 60;
    }
    hours = hours % 24;

    // BST is UTC+6 -> UTC time is (hours - 6)
    const resultDate = new Date(
      Date.UTC(year, month - 1, day, hours - 6, minutes, 0, 0),
    );
    return isNaN(resultDate.getTime()) ? null : resultDate;
  }

  // 4. Try generic Date parsing with BST base date
  const combined = new Date(`${bstDate} ${trimmed}`);
  if (!isNaN(combined.getTime())) {
    return combined;
  }

  return null;
}
