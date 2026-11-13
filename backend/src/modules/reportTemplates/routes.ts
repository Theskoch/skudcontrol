import type { FastifyInstance } from "fastify";
import { templateSchema } from "./schema.js";
import { REPORT_FIELDS } from "./fields.js";
import { buildReportHtml } from "./generate.js";
import { env } from "../../config/env.js";

export default async function reportTemplatesRoutes(app: FastifyInstance) {
  const admin = { preHandler: app.requireRole("ADMIN") };

  app.get("/api/report-templates/fields", admin, async () =>
    REPORT_FIELDS.map(({ key, label, group }) => ({ key, label, group })),
  );

  app.get("/api/report-templates", admin, async () => {
    return app.prisma.reportTemplate.findMany({
      orderBy: { createdAt: "desc" },
      include: { createdBy: { select: { displayName: true } } },
    });
  });

  app.get("/api/report-templates/:id", admin, async (req, reply) => {
    const { id } = req.params as { id: string };
    const template = await app.prisma.reportTemplate.findUnique({ where: { id } });
    if (!template) return reply.code(404).send({ error: "Макет не найден" });
    return template;
  });

  app.post("/api/report-templates", admin, async (req, reply) => {
    const parsed = templateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Некорректные данные" });
    const d = parsed.data;
    const created = await app.prisma.reportTemplate.create({
      data: {
        name: d.name,
        fields: d.fields,
        allEmployees: d.allEmployees,
        employeeIds: d.allEmployees ? [] : d.employeeIds,
        periodType: d.periodType,
        periodDate: d.periodType === "date" ? d.periodDate : null,
        createdById: req.user!.sub,
      },
    });
    return reply.code(201).send(created);
  });

  app.put("/api/report-templates/:id", admin, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = templateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Некорректные данные" });
    const existing = await app.prisma.reportTemplate.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: "Макет не найден" });
    const d = parsed.data;
    return app.prisma.reportTemplate.update({
      where: { id },
      data: {
        name: d.name,
        fields: d.fields,
        allEmployees: d.allEmployees,
        employeeIds: d.allEmployees ? [] : d.employeeIds,
        periodType: d.periodType,
        periodDate: d.periodType === "date" ? d.periodDate : null,
      },
    });
  });

  app.delete("/api/report-templates/:id", admin, async (req, reply) => {
    const { id } = req.params as { id: string };
    await app.prisma.reportTemplate.deleteMany({ where: { id } });
    return reply.code(204).send();
  });

  // Builds the report from the DB right now and returns it as a standalone HTML file download.
  app.post("/api/report-templates/:id/generate", admin, async (req, reply) => {
    const { id } = req.params as { id: string };
    const template = await app.prisma.reportTemplate.findUnique({ where: { id } });
    if (!template) return reply.code(404).send({ error: "Макет не найден" });

    const { html, fileSlug } = await buildReportHtml(app.prisma, template, env.appTz, new Date());
    const safeName = template.name.replace(/[\\/:*?"<>|\r\n]+/g, "_").trim() || "report";
    const filename = `${safeName}_${fileSlug}.html`;

    reply
      .header("Content-Type", "text/html; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="report.html"; filename*=UTF-8''${encodeURIComponent(filename)}`)
      .header("Cache-Control", "no-store");
    return reply.send(html);
  });
}
