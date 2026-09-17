import { zonedDayKey } from "../../lib/timezone.js";

export type RawNetworkSession = {
  startedAt: Date;
  endedAt: Date | null;
  rxBytes: bigint | null;
  txBytes: bigint | null;
};

export type NetworkInterval = {
  dayKey: string; // attributed to the day the interval started, mirrors attendance/pairing.ts
  startedAt: Date;
  endedAt: Date | null; // null = still connected as of the last poll
  incomplete: boolean;
  durationMinutes: number;
  totalBytes: number;
  bytesPerMinute: number; // 0 when duration is unknown (still-open session)
};

type Accumulator = { startedAt: Date; endedAt: Date | null; totalBytes: bigint };

/**
 * Merges raw Wi-Fi association sessions into continuous presence intervals.
 * A disconnect followed by a reconnect within `gapMinutes` doesn't end the
 * interval (roaming between APs, sleep/wake, etc.) — only a longer gap does.
 */
export function mergeNetworkSessions(
  sessions: RawNetworkSession[],
  gapMinutes: number,
  timeZone: string,
): NetworkInterval[] {
  const sorted = [...sessions].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
  const gapMs = gapMinutes * 60_000;
  const intervals: NetworkInterval[] = [];
  let acc: Accumulator | null = null;

  const flush = () => {
    if (acc) intervals.push(finalizeInterval(acc, timeZone));
  };

  for (const session of sorted) {
    if (!acc) {
      acc = { startedAt: session.startedAt, endedAt: session.endedAt, totalBytes: bytesOf(session) };
      continue;
    }

    if (acc.endedAt === null) {
      // Previous session never closed (still connected as of last poll) - can't merge past it.
      flush();
      acc = { startedAt: session.startedAt, endedAt: session.endedAt, totalBytes: bytesOf(session) };
      continue;
    }

    const gap = session.startedAt.getTime() - acc.endedAt.getTime();
    if (gap <= gapMs) {
      acc.endedAt = session.endedAt;
      acc.totalBytes += bytesOf(session);
    } else {
      flush();
      acc = { startedAt: session.startedAt, endedAt: session.endedAt, totalBytes: bytesOf(session) };
    }
  }
  flush();

  return intervals;
}

function bytesOf(session: RawNetworkSession): bigint {
  return (session.rxBytes ?? 0n) + (session.txBytes ?? 0n);
}

function finalizeInterval(acc: Accumulator, timeZone: string): NetworkInterval {
  const durationMinutes = acc.endedAt
    ? Math.max(0, Math.round((acc.endedAt.getTime() - acc.startedAt.getTime()) / 60_000))
    : 0;
  const totalBytes = Number(acc.totalBytes);
  return {
    dayKey: zonedDayKey(acc.startedAt, timeZone),
    startedAt: acc.startedAt,
    endedAt: acc.endedAt,
    incomplete: acc.endedAt === null,
    durationMinutes,
    totalBytes,
    bytesPerMinute: durationMinutes > 0 ? Math.round(totalBytes / durationMinutes) : 0,
  };
}

export function groupIntervalsByDay(intervals: NetworkInterval[]): Map<string, NetworkInterval[]> {
  const map = new Map<string, NetworkInterval[]>();
  for (const interval of intervals) {
    const list = map.get(interval.dayKey) ?? [];
    list.push(interval);
    map.set(interval.dayKey, list);
  }
  return map;
}
