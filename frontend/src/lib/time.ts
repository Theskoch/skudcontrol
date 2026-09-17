export const APP_TZ = "Europe/Moscow";

export function minutesSinceMidnight(iso: string, timeZone: string = APP_TZ): number {
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

export function formatTime(iso: string, timeZone: string = APP_TZ): string {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatDayKey(dayKey: string, timeZone: string = APP_TZ): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat("ru-RU", { timeZone, day: "numeric", month: "short", weekday: "short" }).format(
    date,
  );
}

export function todayDayKey(timeZone: string = APP_TZ): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(),
  );
}

export function formatDate(iso: string, timeZone: string = APP_TZ): string {
  return new Intl.DateTimeFormat("ru-RU", { timeZone, day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(iso),
  );
}

const DELETION_GRACE_DAYS = 90;

export function deletionDeadline(markedAtIso: string): string {
  const deadline = new Date(new Date(markedAtIso).getTime() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);
  return formatDate(deadline.toISOString());
}
