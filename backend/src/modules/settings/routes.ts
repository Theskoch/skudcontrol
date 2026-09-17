import type { FastifyInstance } from "fastify";
import { getThresholds } from "./service.js";

export default async function settingsRoutes(app: FastifyInstance) {
  app.get("/api/settings/thresholds", { preHandler: app.requireAuth }, async () => {
    return getThresholds(app.prisma);
  });
}
