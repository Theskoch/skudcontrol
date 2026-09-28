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
