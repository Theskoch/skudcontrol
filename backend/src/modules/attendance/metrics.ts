import type { PrismaClient } from "@prisma/client";
import { addDays, startOfDayInTz, zonedDayKey } from "../../lib/timezone.js";
import {
  groupSessionsByDay,
  pairEventsIntoSessions,
  type RawEvent,
  type Session,
} from "./pairing.js";
import { mergeNetworkSessions, groupIntervalsByDay, type NetworkInterval } from "../network/pairing.js";
import { combineAllDays } from "../network/combine.js";
import { colorBandFor, type ColorBand, type Thresholds } from "../settings/service.js";

export type RangeKey = "today" | "yesterday" | "week" | "month" | "year" | "all";

export type ResolvedRange = { start: Date | null; end: Date };

export function resolveRange(range: RangeKey, timeZone: string, now: Date): ResolvedRange {
  const todayStart = startOfDayInTz(now, timeZone);
  switch (range) {
    case "today":
      return { start: todayStart, end: addDays(todayStart, 1) };
    case "yesterday":
      return { start: addDays(todayStart, -1), end: todayStart };
    case "week":
      return { start: addDays(todayStart, -6), end: addDays(todayStart, 1) };
    case "month":
      return { start: addDays(todayStart, -29), end: addDays(todayStart, 1) };
    case "year":
      return { start: addDays(todayStart, -364), end: addDays(todayStart, 1) };
    case "all":
      return { start: null, end: addDays(todayStart, 1) };
  }
}

export function sessionsWithinRange(sessions: Session[], timeZone: string, range: ResolvedRange): Session[] {
  const startKey = range.start ? zonedDayKey(range.start, timeZone) : null;
  const endKey = zonedDayKey(range.end, timeZone);
  return sessions.filter((s) => {
    if (startKey && s.dayKey < startKey) return false;
    if (s.dayKey >= endKey) return false;
    return true;
  });
}

export function intervalsWithinRange(
  intervals: NetworkInterval[],
  timeZone: string,
  range: ResolvedRange,
): NetworkInterval[] {
  const startKey = range.start ? zonedDayKey(range.start, timeZone) : null;
  const endKey = zonedDayKey(range.end, timeZone);
  return intervals.filter((i) => {
    if (startKey && i.dayKey < startKey) return false;
    if (i.dayKey >= endKey) return false;
    return true;
  });
}

export async function fetchEvents(
  prisma: PrismaClient,
  employeeIds: string[],
  range: ResolvedRange,
): Promise<Map<string, RawEvent[]>> {
  // Look back one extra day so sessions that cross midnight into the range are paired whole.
  const lookbackStart = range.start ? addDays(range.start, -1) : undefined;
  const events = await prisma.attendanceEvent.findMany({
    where: {
      employeeId: { in: employeeIds },
      occurredAt: { ...(lookbackStart ? { gte: lookbackStart } : {}), lt: range.end },
    },
    orderBy: { occurredAt: "asc" },
  });
  const map = new Map<string, RawEvent[]>();
  for (const id of employeeIds) map.set(id, []);
  for (const e of events) {
    map.get(e.employeeId)?.push({ id: e.id, eventType: e.eventType, occurredAt: e.occurredAt });
  }
  return map;
}

/** Network sessions are keyed by MAC (not employee id) - resolved against each employee's *current* macAddress. */
export async function fetchNetworkIntervalsByEmployee(
  prisma: PrismaClient,
  employees: { id: string; macAddress: string | null }[],
  range: ResolvedRange,
  gapMinutes: number,
  timeZone: string,
): Promise<Map<string, NetworkInterval[]>> {
  const macToEmployeeIds = new Map<string, string[]>();
  for (const e of employees) {
    if (!e.macAddress) continue;
    const list = macToEmployeeIds.get(e.macAddress) ?? [];
    list.push(e.id);
    macToEmployeeIds.set(e.macAddress, list);
  }

  const result = new Map<string, NetworkInterval[]>();
  for (const e of employees) result.set(e.id, []);
  if (macToEmployeeIds.size === 0) return result;

  // The gap-merge window can bridge a session that started before `range.start`.
  const lookbackStart = range.start ? new Date(range.start.getTime() - gapMinutes * 60_000) : undefined;
  const rows = await prisma.networkSession.findMany({
    where: {
      macAddress: { in: [...macToEmployeeIds.keys()] },
      startedAt: { ...(lookbackStart ? { gte: lookbackStart } : {}), lt: range.end },
    },
    orderBy: { startedAt: "asc" },
  });

  const rawByMac = new Map<string, { startedAt: Date; endedAt: Date | null; rxBytes: bigint | null; txBytes: bigint | null }[]>();
  for (const row of rows) {
    const list = rawByMac.get(row.macAddress) ?? [];
    list.push({ startedAt: row.startedAt, endedAt: row.endedAt, rxBytes: row.rxBytes, txBytes: row.txBytes });
    rawByMac.set(row.macAddress, list);
  }

  for (const [mac, employeeIds] of macToEmployeeIds) {
    const merged = mergeNetworkSessions(rawByMac.get(mac) ?? [], gapMinutes, timeZone);
    for (const employeeId of employeeIds) result.set(employeeId, merged);
  }
  return result;
}

export type AverageResult = { avgMinutes: number; colorBand: ColorBand; activeDays: number };

/** Average is always computed over the trailing `avgWindowDays` window, independent of any chart range filter. */
export async function computeAverages(
  prisma: PrismaClient,
  employeeIds: string[],
  timeZone: string,
  thresholds: Thresholds,
  now: Date,
): Promise<Map<string, AverageResult>> {
  const start = addDays(startOfDayInTz(now, timeZone), -(thresholds.avgWindowDays - 1));
  const range: ResolvedRange = { start, end: addDays(startOfDayInTz(now, timeZone), 1) };

  const employees = await prisma.employee.findMany({
    where: { id: { in: employeeIds } },
    select: { id: true, macAddress: true },
  });

  const eventsByEmployee = await fetchEvents(prisma, employeeIds, range);
  const networkByEmployee = await fetchNetworkIntervalsByEmployee(
    prisma,
    employees,
    range,
    thresholds.networkGapMergeMinutes,
    timeZone,
  );

  const result = new Map<string, AverageResult>();
  for (const id of employeeIds) {
    const skudByDay = groupSessionsByDay(
      sessionsWithinRange(pairEventsIntoSessions(eventsByEmployee.get(id) ?? [], timeZone), timeZone, range),
    );
    const networkByDay = groupIntervalsByDay(
      intervalsWithinRange(networkByEmployee.get(id) ?? [], timeZone, range),
    );
    const combined = combineAllDays(skudByDay, networkByDay, thresholds.boundaryDisagreementMinutes);

    const activeDays = combined.size;
    let totalMinutes = 0;
    for (const day of combined.values()) totalMinutes += day.workedMinutes;
    const avgMinutes = activeDays > 0 ? Math.round(totalMinutes / activeDays) : 0;
    const colorBand = activeDays > 0 ? colorBandFor(avgMinutes, thresholds) : "none";
    result.set(id, { avgMinutes, colorBand, activeDays });
  }
  return result;
}

export type DailyMetrics = {
  workedMinutes: number;
  normMinutes: number;
  shortfallMinutes: number;
  overtimeMinutes: number;
  latenessMinutes: number;
  earlyLeaveMinutes: number;
  absenceMinutes: number;
  activeDays: number;
  averageMinutes: number; // workedMinutes / activeDays for *this* range, distinct from the trailing-window `average`
};

export type TimelineDay = { dayKey: string; sessions: Session[] };
export type NetworkTimelineDay = { dayKey: string; intervals: NetworkInterval[] };
export type CombinedTimelineDay = { dayKey: string; arrival: Date | null; departure: Date | null };

export type DashboardData = {
  period: DailyMetrics;
  timeline: TimelineDay[];
  networkTimeline: NetworkTimelineDay[];
  combinedTimeline: CombinedTimelineDay[];
};

export async function computeDashboard(
  prisma: PrismaClient,
  employeeId: string,
  range: RangeKey,
  timeZone: string,
  thresholds: Thresholds,
  now: Date,
): Promise<DashboardData> {
  const resolvedRange = resolveRange(range, timeZone, now);
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, macAddress: true },
  });

  const eventsByEmployee = await fetchEvents(prisma, [employeeId], resolvedRange);
  const allSessions = pairEventsIntoSessions(eventsByEmployee.get(employeeId) ?? [], timeZone);
  const sessions = sessionsWithinRange(allSessions, timeZone, resolvedRange);
  const skudByDay = groupSessionsByDay(sessions);

  const networkByEmployee = await fetchNetworkIntervalsByEmployee(
    prisma,
    employee ? [employee] : [],
    resolvedRange,
    thresholds.networkGapMergeMinutes,
    timeZone,
  );
  const networkIntervals = intervalsWithinRange(
    networkByEmployee.get(employeeId) ?? [],
    timeZone,
    resolvedRange,
  );
  const networkByDay = groupIntervalsByDay(networkIntervals);

  const combined = combineAllDays(skudByDay, networkByDay, thresholds.boundaryDisagreementMinutes);

  const skudDayKeys = [...skudByDay.keys()].sort();
  const timeline: TimelineDay[] = skudDayKeys.map((dayKey) => ({
    dayKey,
    sessions: (skudByDay.get(dayKey) ?? []).sort(
      (a, b) => (a.checkIn ?? a.checkOut!).getTime() - (b.checkIn ?? b.checkOut!).getTime(),
    ),
  }));

  const networkDayKeys = [...networkByDay.keys()].sort();
  const networkTimeline: NetworkTimelineDay[] = networkDayKeys.map((dayKey) => ({
    dayKey,
    intervals: (networkByDay.get(dayKey) ?? []).sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime()),
  }));

  const activeDays = combined.size;
  const calendarDays =
    resolvedRange.start === null
      ? activeDays
      : Math.round((resolvedRange.end.getTime() - resolvedRange.start.getTime()) / (24 * 60 * 60 * 1000));

  let workedMinutes = 0;
  let latenessMinutes = 0;
  let earlyLeaveMinutes = 0;
  for (const day of combined.values()) {
    workedMinutes += day.workedMinutes;
    if (day.arrival) {
      const arrivalMinutes = minutesSinceMidnight(day.arrival.time, timeZone);
      latenessMinutes += Math.max(0, arrivalMinutes - thresholds.expectedStartMinutes);
    }
    if (day.departure) {
      const departureMinutes = minutesSinceMidnight(day.departure.time, timeZone);
      earlyLeaveMinutes += Math.max(0, thresholds.expectedEndMinutes - departureMinutes);
    }
  }

  const normMinutes = calendarDays * thresholds.normMinutesPerDay;
  const shortfallMinutes = Math.max(0, normMinutes - workedMinutes);
  const overtimeMinutes = Math.max(0, workedMinutes - normMinutes);
  const absenceDays = Math.max(0, calendarDays - activeDays);
  const absenceMinutes = absenceDays * thresholds.normMinutesPerDay;

  const combinedTimeline: CombinedTimelineDay[] = [...combined.values()]
    .map((day) => ({ dayKey: day.dayKey, arrival: day.arrival?.time ?? null, departure: day.departure?.time ?? null }))
    .sort((a, b) => a.dayKey.localeCompare(b.dayKey));

  return {
    period: {
      workedMinutes,
      normMinutes,
      shortfallMinutes,
      overtimeMinutes,
      latenessMinutes,
      earlyLeaveMinutes,
      absenceMinutes,
      activeDays,
      averageMinutes: activeDays > 0 ? Math.round(workedMinutes / activeDays) : 0,
    },
    timeline,
    networkTimeline,
    combinedTimeline,
  };
}

function minutesSinceMidnight(date: Date, timeZone: string): number {
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
