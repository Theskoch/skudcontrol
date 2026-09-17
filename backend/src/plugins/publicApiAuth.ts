import fp from "fastify-plugin";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { hashApiKey } from "../lib/apiKey.js";

declare module "fastify" {
  interface FastifyInstance {
    requireApiKey: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    apiKeyId?: string;
  }
}

export default fp(async (app: FastifyInstance) => {
  app.decorate("requireApiKey", async (req: FastifyRequest, reply: FastifyReply) => {
    const raw = req.headers["x-api-key"];
    const key = Array.isArray(raw) ? raw[0] : raw;
    if (!key) {
      return reply.code(401).send({ error: "Missing X-API-Key header" });
    }

    const record = await app.prisma.apiKey.findUnique({ where: { keyHash: hashApiKey(key) } });
    if (!record || record.revokedAt || (record.expiresAt && record.expiresAt < new Date())) {
      return reply.code(401).send({ error: "Invalid or expired API key" });
    }

    req.apiKeyId = record.id;
    app.prisma.apiKey.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  });
});
