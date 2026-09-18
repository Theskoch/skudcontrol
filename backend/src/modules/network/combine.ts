import type { Session } from "../attendance/pairing.js";
import type { NetworkInterval } from "./pairing.js";

export type BoundarySource = "SKUD" | "WIFI" | "BOTH";

export type CombinedBoundary = { time: Date; source: BoundarySource };

export type CombinedDay = {
  dayKey: string;
  arrival: CombinedBoundary | null;
  departure: CombinedBoundary | null; // null = still open (no source has confirmed a departure yet)
  workedMinutes: number;
  incomplete: boolean;
};

function skudDayBoundaries(sessions: Session[]): { firstIn: Date | null; lastOut: Date | null } {
  const withCheckIn = sessions.filter((s) => s.checkIn);
  // Deliberately not excluding `incomplete` sessions here: a stray orphan
  // CHECK_OUT (no matching check-in - e.g. a duplicate badge swipe) is
  // still a real recorded departure timestamp, just one pairEventsIntoSessions
  // couldn't attach to a session. Excluding it made the last-departure
  // boundary silently fall back to an earlier, "complete" session's checkout
  // even when a later checkout was on record for that day.
  const withCheckOut = sessions.filter((s) => s.checkOut);
  const firstIn = withCheckIn.length
    ? withCheckIn.reduce((min, s) => (s.checkIn! < min ? s.checkIn! : min), withCheckIn[0].checkIn!)
    : null;
  const lastOut = withCheckOut.length
    ? withCheckOut.reduce((max, s) => (s.checkOut! > max ? s.checkOut! : max), withCheckOut[0].checkOut!)
    : null;
  return { firstIn, lastOut };
}

function wifiDayBoundaries(intervals: NetworkInterval[]): { firstIn: Date | null; lastOut: Date | null } {
  if (intervals.length === 0) return { firstIn: null, lastOut: null };
  const firstIn = intervals.reduce((min, i) => (i.startedAt < min ? i.startedAt : min), intervals[0].startedAt);
  const closed = intervals.filter((i) => !i.incomplete);
  const lastOut = closed.length
    ? closed.reduce((max, i) => (i.endedAt! > max ? i.endedAt! : max), closed[0].endedAt!)
    : null;
  return { firstIn, lastOut };
}

/**
 * Both sources are equally trusted: when both have a timestamp for this
 * boundary, split the difference rather than picking one over the other.
 */
function pickAverage(skud: Date | null, wifi: Date | null): CombinedBoundary | null {
  if (skud && wifi) {
    return { time: new Date((skud.getTime() + wifi.getTime()) / 2), source: "BOTH" };
  }
  if (skud) return { time: skud, source: "SKUD" };
  if (wifi) return { time: wifi, source: "WIFI" };
  return null;
}

export function combineDay(dayKey: string, skudSessions: Session[], networkIntervals: NetworkInterval[]): CombinedDay {
  const skud = skudDayBoundaries(skudSessions);
  const wifi = wifiDayBoundaries(networkIntervals);

  const arrival = pickAverage(skud.firstIn, wifi.firstIn);
  const departure = pickAverage(skud.lastOut, wifi.lastOut);

  const workedMinutes =
    arrival && departure
      ? Math.max(0, Math.round((departure.time.getTime() - arrival.time.getTime()) / 60_000))
      : 0;

  return {
    dayKey,
    arrival,
    departure,
    workedMinutes,
    incomplete: arrival !== null && departure === null,
  };
}

/** Union of every day either source has data for, each combined per `combineDay`. */
export function combineAllDays(
  skudByDay: Map<string, Session[]>,
  networkByDay: Map<string, NetworkInterval[]>,
): Map<string, CombinedDay> {
  const dayKeys = new Set([...skudByDay.keys(), ...networkByDay.keys()]);
  const result = new Map<string, CombinedDay>();
  for (const dayKey of dayKeys) {
    result.set(dayKey, combineDay(dayKey, skudByDay.get(dayKey) ?? [], networkByDay.get(dayKey) ?? []));
  }
  return result;
}
