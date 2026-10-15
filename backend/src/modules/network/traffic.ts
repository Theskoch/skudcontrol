import type { PrismaClient } from "@prisma/client";
import { zonedDayKey } from "../../lib/timezone.js";
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

export async function computeTraffic(
  prisma: PrismaClient,
  macAddress: string,
  range: RangeKey,
  timeZone: string,
  now: Date,
): Promise<TrafficDay[]> {
  const resolved = resolveRange(range, timeZone, now);
  // One sample before the range start gives the first in-range sample something to diff against.
  const before = resolved.start
    ? await prisma.networkTrafficSample.findFirst({
        where: { macAddress, sampledAt: { lt: resolved.start } },
        orderBy: { sampledAt: "desc" },
      })
    : null;
  const inRange = await prisma.networkTrafficSample.findMany({
    where: { macAddress, sampledAt: { ...(resolved.start ? { gte: resolved.start } : {}), lt: resolved.end } },
    orderBy: { sampledAt: "asc" },
  });
  return bucketTraffic(before ? [before, ...inRange] : inRange, timeZone);
}
