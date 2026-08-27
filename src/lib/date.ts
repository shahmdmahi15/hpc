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
