// Store-local time. Every clock time in Connect means "time at the store", no matter where the
// person typing or viewing it is. (Without this, 5:00 PM typed in France was saved as 5:00 PM Paris time.)
import { locations } from "./data";

export const DEFAULT_TZ = "America/New_York";

/** Time zone of a store (falls back to Eastern for "All locations"). */
export function tzForLocation(locationId?: string | null): string {
  return locations.find((l) => l.id === locationId)?.timeZone || DEFAULT_TZ;
}

function partsIn(instant: Date, tz: string) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p: Record<string, number> = {};
  for (const part of f.formatToParts(instant)) if (part.type !== "literal") p[part.type] = Number(part.value);
  return { year: p.year, month: p.month, day: p.day, hour: p.hour % 24, minute: p.minute, second: p.second };
}

/** Minutes the zone is ahead of UTC at that instant (Eastern is -240 in summer, -300 in winter). */
function offsetMinutes(instant: Date, tz: string): number {
  const p = partsIn(instant, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60000);
}

/** "2026-10-13" + "17:00" at the store  →  the exact moment in time. */
export function storeTimeToInstant(ymd: string, hm: string, tz: string = DEFAULT_TZ): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const [hh, mm] = hm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh || 0, mm || 0);
  let instant = new Date(guess - offsetMinutes(new Date(guess), tz) * 60000);
  // Second pass settles days when the clocks change.
  instant = new Date(guess - offsetMinutes(instant, tz) * 60000);
  return instant;
}

/**
 * A saved moment → a Date whose *local* fields read as the store's wall clock.
 * Use it only for display/formatting with date-fns `format()`; never save it back.
 */
export function storeClock(value: string | Date, tz: string = DEFAULT_TZ): Date {
  const instant = typeof value === "string" ? new Date(value) : value;
  if (isNaN(instant.getTime())) return instant;
  const p = partsIn(instant, tz);
  return new Date(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
}

/** Short zone label for that moment, e.g. "EDT" / "EST". */
export function tzLabel(value: string | Date, tz: string = DEFAULT_TZ): string {
  const instant = typeof value === "string" ? new Date(value) : value;
  if (isNaN(instant.getTime())) return "";
  const part = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" }).formatToParts(instant).find((x) => x.type === "timeZoneName");
  return part?.value || "";
}

/** Plain name for hints, e.g. "Eastern". */
export function tzFriendly(tz: string = DEFAULT_TZ): string {
  return ({ "America/New_York": "Eastern", "America/Chicago": "Central", "America/Denver": "Mountain", "America/Los_Angeles": "Pacific" } as Record<string, string>)[tz] || tz;
}
