import type { PrismaClient } from "@prisma/client";
import { fetchAllWifiClients } from "./unifiClient.js";
import { normalizeMacAddress } from "../../lib/mac.js";

export type PollSummary = { matched: number; skipped: number };

/**
 * Each poll "heartbeats" endedAt forward for every currently-connected known
 * MAC. When a device disconnects, its row simply stops being updated, so
 * endedAt naturally settles on the last poll it was still seen - no extra
 * state to track between runs. A later reconnect gets a new (macAddress,
 * startedAt) row; the gap-merge logic in network/pairing.ts decides whether
 * that counts as a new session or a continuation.
 */
export async function runUnifiPoll(prisma: PrismaClient): Promise<PollSummary> {
  const employees = await prisma.employee.findMany({
    where: { isActive: true, macAddress: { not: null } },
    select: { macAddress: true },
  });
  const knownMacs = new Set(employees.map((e) => e.macAddress!));
  if (knownMacs.size === 0) return { matched: 0, skipped: 0 };

  const clients = await fetchAllWifiClients();
  const now = new Date();
  let matched = 0;
  let skipped = 0;

  for (const client of clients) {
    const mac = normalizeMacAddress(client.macAddress);
    if (!mac || !knownMacs.has(mac)) {
      skipped++;
      continue;
    }

    await prisma.networkSession.upsert({
      where: { macAddress_startedAt: { macAddress: mac, startedAt: new Date(client.connectedAt) } },
      update: { endedAt: now, apLabel: client.uplinkDeviceId ?? null },
      create: {
        macAddress: mac,
        startedAt: new Date(client.connectedAt),
        endedAt: now,
        source: "UNIFI",
        apLabel: client.uplinkDeviceId ?? null,
      },
    });
    matched++;
  }

  return { matched, skipped };
}
