import type { FastifyInstance } from "fastify";
import { ingestSchema } from "./schema.js";
import { normalizeMacAddress } from "../../lib/mac.js";
import { env } from "../../config/env.js";

export default async function networkRoutes(app: FastifyInstance) {
  app.post("/api/network-sessions/ingest", async (req, reply) => {
    if (!env.networkIngestToken) {
      return reply.code(503).send({ error: "NETWORK_INGEST_TOKEN не настроен на сервере" });
    }
    if (req.headers["x-ingest-token"] !== env.networkIngestToken) {
      return reply.code(401).send({ error: "Неверный токен" });
    }

    const parsed = ingestSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    let accepted = 0;
    let skippedInvalidMac = 0;

    for (const session of parsed.data.sessions) {
      const macAddress = normalizeMacAddress(session.macAddress);
      if (!macAddress) {
        skippedInvalidMac++;
        continue;
      }

      await app.prisma.networkSession.upsert({
        where: { macAddress_startedAt: { macAddress, startedAt: session.startedAt } },
        update: {
          endedAt: session.endedAt ?? null,
          apLabel: session.apLabel ?? null,
          rxBytes: session.rxBytes != null ? BigInt(Math.round(session.rxBytes)) : null,
          txBytes: session.txBytes != null ? BigInt(Math.round(session.txBytes)) : null,
        },
        create: {
          macAddress,
          startedAt: session.startedAt,
          endedAt: session.endedAt ?? null,
          apLabel: session.apLabel ?? null,
          rxBytes: session.rxBytes != null ? BigInt(Math.round(session.rxBytes)) : null,
          txBytes: session.txBytes != null ? BigInt(Math.round(session.txBytes)) : null,
          source: "UNIFI",
        },
      });
      accepted++;
    }

    return { accepted, skippedInvalidMac };
  });
}
