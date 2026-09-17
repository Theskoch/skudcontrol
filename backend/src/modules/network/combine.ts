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
  const withCheckOut = sessions.filter((s) => s.checkOut && !s.incomplete);
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

/** Both sources are equally trusted: for each boundary, the earlier of the two available timestamps wins. */
function pickEarlier(skud: Date | null, wifi: Date | null, toleranceMinutes: number): CombinedBoundary | null {
  if (skud && wifi) {
    const earlier = skud <= wifi ? skud : wifi;
    const diffMinutes = Math.abs(skud.getTime() - wifi.getTime()) / 60_000;
    const source: BoundarySource = diffMinutes <= toleranceMinutes ? "BOTH" : earlier === skud ? "SKUD" : "WIFI";
    return { time: earlier, source };
  }
  if (skud) return { time: skud, source: "SKUD" };
  if (wifi) return { time: wifi, source: "WIFI" };
  return null;
}

export function combineDay(
  dayKey: string,
  skudSessions: Session[],
  networkIntervals: NetworkInterval[],
  toleranceMinutes: number,
): CombinedDay {
  const skud = skudDayBoundaries(skudSessions);
  const wifi = wifiDayBoundaries(networkIntervals);

  const arrival = pickEarlier(skud.firstIn, wifi.firstIn, toleranceMinutes);
  const departure = pickEarlier(skud.lastOut, wifi.lastOut, toleranceMinutes);

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
  toleranceMinutes: number,
): Map<string, CombinedDay> {
  const dayKeys = new Set([...skudByDay.keys(), ...networkByDay.keys()]);
  const result = new Map<string, CombinedDay>();
  for (const dayKey of dayKeys) {
    result.set(
      dayKey,
      combineDay(dayKey, skudByDay.get(dayKey) ?? [], networkByDay.get(dayKey) ?? [], toleranceMinutes),
    );
  }
  return result;
}
