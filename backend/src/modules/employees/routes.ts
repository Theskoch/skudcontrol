import type { FastifyInstance } from "fastify";
import { updateEmployeeSchema, rangeQuerySchema } from "./schema.js";
import { computeAverages, computeDashboard } from "../attendance/metrics.js";
import { getThresholds } from "../settings/service.js";
import { env } from "../../config/env.js";

export default async function employeeRoutes(app: FastifyInstance) {
  app.get("/api/employees", { preHandler: app.requireAuth }, async (req) => {
    const search = (req.query as { search?: string }).search?.trim().toLowerCase();
    const employees = await app.prisma.employee.findMany({
      where: {
        isActive: true,
        ...(search ? { fullName: { contains: search, mode: "insensitive" } } : {}),
      },
      orderBy: { fullName: "asc" },
    });

    const thresholds = await getThresholds(app.prisma);
    const averages = await computeAverages(
      app.prisma,
      employees.map((e) => e.id),
      env.appTz,
      thresholds,
      new Date(),
    );

    return employees.map((e) => ({
      id: e.id,
      fullName: e.fullName,
      serialNumber: e.serialNumber,
      macAddress: e.macAddress,
      deletionMarkedAt: e.deletionMarkedAt,
      avgMinutes: averages.get(e.id)?.avgMinutes ?? 0,
      colorBand: averages.get(e.id)?.colorBand ?? "none",
    }));
  });

  app.get("/api/employees/:id", { preHandler: app.requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const employee = await app.prisma.employee.findUnique({ where: { id } });
    if (!employee || !employee.isActive) return reply.code(404).send({ error: "Сотрудник не найден" });
    return employee;
  });

  app.patch("/api/employees/:id", { preHandler: app.requireRole("ADMIN") }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = updateEmployeeSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const employee = await app.prisma.employee.update({ where: { id }, data: parsed.data });
    return employee;
  });

  app.delete("/api/employees/:id", { preHandler: app.requireRole("ADMIN") }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await app.prisma.employee.update({ where: { id }, data: { isActive: false } });
    return reply.code(204).send();
  });

  app.get("/api/employees/:id/dashboard", { preHandler: app.requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsedQuery = rangeQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) return reply.code(400).send({ error: "Некорректный диапазон" });

    const employee = await app.prisma.employee.findUnique({ where: { id } });
    if (!employee || !employee.isActive) return reply.code(404).send({ error: "Сотрудник не найден" });

    const thresholds = await getThresholds(app.prisma);
    const dashboard = await computeDashboard(
      app.prisma,
      id,
      parsedQuery.data.range,
      env.appTz,
      thresholds,
      new Date(),
    );

    return { employee, thresholds, ...dashboard };
  });
}
