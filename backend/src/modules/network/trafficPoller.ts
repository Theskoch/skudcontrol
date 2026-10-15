import type { PrismaClient } from "@prisma/client";
import { fetchWifiTrafficCounters } from "./unifiClient.js";
import { normalizeMacAddress } from "../../lib/mac.js";

export type TrafficPollSummary = { sampled: number };

/**
 * Stores one cumulative-counter sample per currently-connected employee MAC.
 * Employees without a MAC are never sampled; the moment a MAC is set they're
 * picked up on the next poll, so the traffic chart starts filling on its own.
 */
export async function runTrafficPoll(prisma: PrismaClient): Promise<TrafficPollSummary> {
  const employees = await prisma.employee.findMany({
    where: { isActive: true, macAddress: { not: null } },
    select: { macAddress: true },
  });
  const knownMacs = new Set(employees.map((e) => e.macAddress!));
  if (knownMacs.size === 0) return { sampled: 0 };

  const counters = await fetchWifiTrafficCounters();
  const sampledAt = new Date();
  const rows = [];
  for (const c of counters) {
    const mac = normalizeMacAddress(c.macAddress);
    if (!mac || !knownMacs.has(mac)) continue;
    rows.push({
      macAddress: mac,
      sampledAt,
      rxBytes: BigInt(Math.round(c.rxBytes)),
      txBytes: BigInt(Math.round(c.txBytes)),
    });
  }
  if (rows.length > 0) await prisma.networkTrafficSample.createMany({ data: rows });
  return { sampled: rows.length };
}

const RETENTION_DAYS = 180;

export async function purgeOldTrafficSamples(prisma: PrismaClient): Promise<number> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const result = await prisma.networkTrafficSample.deleteMany({ where: { sampledAt: { lt: cutoff } } });
  return result.count;
}
