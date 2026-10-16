import type { PrismaClient } from "@prisma/client";
import { addDays, zonedDayKey } from "../../lib/timezone.js";
import { analyzeActivity, type ActivityState } from "./activity.js";
import { resolveRange, type RangeKey } from "../attendance/metrics.js";

export const BUCKET_MINUTES = 15;

export type TrafficBucket = { startMin: number; rxBytes: number; txBytes: number };
export type TrafficDay = { dayKey: string; buckets: TrafficBucket[] };

type Sample = { sampledAt: Date; rxBytes: bigint; txBytes: bigint };

function minutesOfDay(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false })
    .formatToParts(date);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return h * 60 + m;
}

/**
 * Turns cumulative counters into per-bucket traffic. A counter that goes down
 * means the client re-associated (counters restart), so the new value itself is
 * the traffic since then. The very first sample has nothing to diff against.
 */
export function bucketTraffic(samples: Sample[], timeZone: string): TrafficDay[] {
  const days = new Map<string, Map<number, TrafficBucket>>();

  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1];
    const cur = samples[i];
    const rx = cur.rxBytes >= prev.rxBytes ? cur.rxBytes - prev.rxBytes : cur.rxBytes;
    const tx = cur.txBytes >= prev.txBytes ? cur.txBytes - prev.txBytes : cur.txBytes;

    const dayKey = zonedDayKey(cur.sampledAt, timeZone);
    const startMin = Math.floor(minutesOfDay(cur.sampledAt, timeZone) / BUCKET_MINUTES) * BUCKET_MINUTES;
    const day = days.get(dayKey) ?? new Map<number, TrafficBucket>();
    days.set(dayKey, day);
    const bucket = day.get(startMin) ?? { startMin, rxBytes: 0, txBytes: 0 };
    bucket.rxBytes += Number(rx);
    bucket.txBytes += Number(tx);
    day.set(startMin, bucket);
  }

  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dayKey, buckets]) => ({ dayKey, buckets: [...buckets.values()].sort((a, b) => a.startMin - b.startMin) }));
}

export type TrafficStateSegment = { startMin: number; endMin: number; state: ActivityState };
export type TrafficStateDay = { dayKey: string; segments: TrafficStateSegment[] };
export type TrafficEvent = { type: "ARRIVAL" | "DEPARTURE"; at: string };
export type TrafficResult = { days: TrafficDay[]; states: TrafficStateDay[]; events: TrafficEvent[] };

// Arrival/departure needs the previous activity; a weekend or holiday can sit between it and the range start.
const ACTIVITY_LOOKBACK_DAYS = 4;

export async function computeTraffic(
  prisma: PrismaClient,
  macAddress: string,
  range: RangeKey,
  timeZone: string,
  now: Date,
): Promise<TrafficResult> {
  const resolved = resolveRange(range, timeZone, now);
  const lookbackStart = resolved.start ? addDays(resolved.start, -ACTIVITY_LOOKBACK_DAYS) : undefined;
  const all = await prisma.networkTrafficSample.findMany({
    where: { macAddress, sampledAt: { ...(lookbackStart ? { gte: lookbackStart } : {}), lt: resolved.end } },
    orderBy: { sampledAt: "asc" },
  });

  const startKey = resolved.start ? zonedDayKey(resolved.start, timeZone) : null;
  const inRangeDay = (d: Date) => !startKey || zonedDayKey(d, timeZone) >= startKey;

  // One sample before the range start gives the first in-range sample something to diff against.
  const firstInRange = all.findIndex((x) => !resolved.start || x.sampledAt >= resolved.start);
  const forBuckets = firstInRange === -1 ? [] : all.slice(Math.max(0, firstInRange - 1));

  const activity = analyzeActivity(all, now);
  const statesByDay = new Map<string, TrafficStateSegment[]>();
  for (const seg of activity.segments) {
    if (!inRangeDay(seg.endedAt)) continue;
    const dayKey = zonedDayKey(seg.endedAt, timeZone);
    const startMin = zonedDayKey(seg.startedAt, timeZone) === dayKey ? minutesOfDay(seg.startedAt, timeZone) : 0;
    const endMin = minutesOfDay(seg.endedAt, timeZone);
    if (endMin <= startMin) continue;
    const list = statesByDay.get(dayKey) ?? [];
    list.push({ startMin, endMin, state: seg.state });
    statesByDay.set(dayKey, list);
  }

  return {
    days: bucketTraffic(forBuckets, timeZone),
    states: [...statesByDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([dayKey, segments]) => ({ dayKey, segments })),
    events: activity.events.filter((e) => inRangeDay(e.at)).map((e) => ({ type: e.type, at: e.at.toISOString() })),
  };
}
