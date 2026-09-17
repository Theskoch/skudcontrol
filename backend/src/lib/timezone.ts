/**
 * Small timezone helpers built on Intl only (no extra dependency).
 * Correct for both fixed-offset zones (e.g. Europe/Moscow) and DST zones,
 * since the offset is recomputed per-instant rather than assumed constant.
 */

export function zonedDayKey(date: Date, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD, which is exactly the sortable day key we want.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function offsetMinutesAt(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
  }).formatToParts(instant);
  const tzName = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+0";
  const match = tzName.match(/GMT([+-]\d+)(?::(\d+))?/);
  if (!match) return 0;
  const hours = Number(match[1]);
  const minutes = match[2] ? Number(match[2]) : 0;
  return hours * 60 + (hours < 0 ? -minutes : minutes);
}

export function startOfDayInTz(date: Date, timeZone: string): Date {
  const [y, m, d] = zonedDayKey(date, timeZone).split("-").map(Number);
  const naiveUtc = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  const offset = offsetMinutesAt(naiveUtc, timeZone);
  return new Date(naiveUtc.getTime() - offset * 60_000);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Builds a UTC instant for a given wall-clock date+time as observed in `timeZone`. */
export function zonedDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const naiveUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const offset = offsetMinutesAt(naiveUtc, timeZone);
  return new Date(naiveUtc.getTime() - offset * 60_000);
}

/**
 * The next :30-past-the-hour wall-clock instant in `timeZone` (e.g. 00:30, 01:30, ...),
 * so a hint interval lands on a predictable half-hour mark instead of the top of the hour.
 */
export function msUntilNextHalfHour(timeZone: string, now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hour = get("hour") % 24; // some Intl implementations report midnight as "24" with hour12:false
  const minute = get("minute");

  // Date.UTC naturally rolls hour=24 into the next day, so no manual carry needed.
  const targetHour = minute < 30 ? hour : hour + 1;
  const next = zonedDateTimeToUtc(year, month, day, targetHour, 30, timeZone);
  return next.getTime() - now.getTime();
}
