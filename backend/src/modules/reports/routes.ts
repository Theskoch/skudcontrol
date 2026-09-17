import type { FastifyInstance } from "fastify";
import { importAttendanceReport } from "./service.js";
import { env } from "../../config/env.js";

export default async function reportsRoutes(app: FastifyInstance) {
  app.post("/api/reports/import", { preHandler: app.requireRole("ADMIN") }, async (req, reply) => {
    const file = await req.file();
    if (!file) return reply.code(400).send({ error: "Прикрепите файл отчёта" });

    const buffer = await file.toBuffer();
    const html = buffer.toString("utf-8");

    try {
      const summary = await importAttendanceReport(app.prisma, html, req.user!.sub, env.appTz);
      return summary;
    } catch (err) {
      app.log.error(err);
      return reply.code(400).send({ error: "Не удалось разобрать файл отчёта" });
    }
  });
}
