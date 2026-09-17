import type { FastifyInstance } from "fastify";
import { createApiKeySchema } from "./schema.js";
import { generateApiKey } from "../../lib/apiKey.js";

const EXPIRY_DAYS: Record<string, number | null> = {
  "1m": 30,
  "6m": 182,
  "1y": 365,
  never: null,
};

export default async function apiKeysRoutes(app: FastifyInstance) {
  app.get("/api/api-keys", { preHandler: app.requireRole("ADMIN") }, async () => {
    return app.prisma.apiKey.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        expiresAt: true,
        revokedAt: true,
        createdAt: true,
        lastUsedAt: true,
        createdBy: { select: { displayName: true } },
      },
    });
  });

  app.post("/api/api-keys", { preHandler: app.requireRole("ADMIN") }, async (req, reply) => {
    const parsed = createApiKeySchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const days = EXPIRY_DAYS[parsed.data.expiresIn];
    const expiresAt = days === null ? null : new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const { plaintext, hash, prefix } = generateApiKey();
    const created = await app.prisma.apiKey.create({
      data: {
        name: parsed.data.name,
        keyHash: hash,
        keyPrefix: prefix,
        expiresAt,
        createdById: req.user!.sub,
      },
    });

    return reply.code(201).send({
      id: created.id,
      name: created.name,
      key: plaintext, // shown exactly once - never retrievable again after this response
      keyPrefix: created.keyPrefix,
      expiresAt: created.expiresAt,
      createdAt: created.createdAt,
    });
  });

  app.delete("/api/api-keys/:id", { preHandler: app.requireRole("ADMIN") }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const key = await app.prisma.apiKey.findUnique({ where: { id } });
    if (!key) return reply.code(404).send({ error: "Ключ не найден" });
    if (key.revokedAt) return reply.code(204).send();

    await app.prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
    return reply.code(204).send();
  });
}
