import type { FastifyInstance } from "fastify";
import { publicRangeQuerySchema } from "./schema.js";
import { pairEventsIntoSessions } from "../attendance/pairing.js";
import {
  computeAverages,
  computeDashboard,
  fetchEvents,
  fetchNetworkIntervalsByEmployee,
  resolveRange,
  sessionsWithinRange,
  intervalsWithinRange,
} from "../attendance/metrics.js";
import { getThresholds } from "../settings/service.js";
import { normalizeMacAddress } from "../../lib/mac.js";
import { env } from "../../config/env.js";

async function buildRawAttendance(
  app: FastifyInstance,
  employee: { id: string; fullName: string; macAddress: string | null },
  range: "today" | "yesterday" | "week" | "month" | "year" | "all",
  thresholds: Awaited<ReturnType<typeof getThresholds>>,
) {
  const timeZone = env.appTz;
  const now = new Date();
  const resolvedRange = resolveRange(range, timeZone, now);

  const eventsByEmployee = await fetchEvents(app.prisma, [employee.id], resolvedRange);
  const sessions = sessionsWithinRange(
    pairEventsIntoSessions(eventsByEmployee.get(employee.id) ?? [], timeZone),
    timeZone,
    resolvedRange,
  );

  const networkByEmployee = await fetchNetworkIntervalsByEmployee(
    app.prisma,
    [employee],
    resolvedRange,
    thresholds.networkGapMergeMinutes,
    timeZone,
  );
  const intervals = intervalsWithinRange(networkByEmployee.get(employee.id) ?? [], timeZone, resolvedRange);

  return {
    employeeId: employee.id,
    fullName: employee.fullName,
    skud: sessions
      .filter((s) => s.checkIn || s.checkOut)
      .map((s) => ({
        date: s.dayKey,
        checkIn: s.checkIn,
        checkOut: s.checkOut,
        incomplete: s.incomplete,
      })),
    wifi: intervals.map((i) => ({
      date: i.dayKey,
      connectedAt: i.startedAt,
      disconnectedAt: i.endedAt,
      incomplete: i.incomplete,
    })),
  };
}

export default async function publicApiRoutes(app: FastifyInstance) {
  app.get("/api/public/v1/employees", { preHandler: app.requireApiKey }, async () => {
    const employees = await app.prisma.employee.findMany({
      where: { isActive: true },
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
      personnelNumber: e.personnelNumber,
      serialNumber: e.serialNumber,
      macAddress: e.macAddress,
      avgMinutes: averages.get(e.id)?.avgMinutes ?? 0,
      colorBand: averages.get(e.id)?.colorBand ?? "none",
    }));
  });

  app.get("/api/public/v1/attendance", { preHandler: app.requireApiKey }, async (req, reply) => {
    const parsed = publicRangeQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: "Некорректный диапазон" });

    const employees = await app.prisma.employee.findMany({ where: { isActive: true }, orderBy: { fullName: "asc" } });
    const thresholds = await getThresholds(app.prisma);

    const results = [];
    for (const employee of employees) {
      results.push(await buildRawAttendance(app, employee, parsed.data.range, thresholds));
    }
    return results;
  });

  app.get("/api/public/v1/employees/:id/average", { preHandler: app.requireApiKey }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = publicRangeQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: "Некорректный диапазон" });

    const employee = await app.prisma.employee.findUnique({ where: { id } });
    if (!employee || !employee.isActive) return reply.code(404).send({ error: "Сотрудник не найден" });

    const thresholds = await getThresholds(app.prisma);
    const dashboard = await computeDashboard(app.prisma, id, parsed.data.range, env.appTz, thresholds, new Date());

    return {
      employeeId: id,
      range: parsed.data.range,
      averageMinutes: dashboard.period.averageMinutes,
      workedMinutes: dashboard.period.workedMinutes,
      activeDays: dashboard.period.activeDays,
    };
  });

  app.get("/api/public/v1/employees/:id/attendance", { preHandler: app.requireApiKey }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = publicRangeQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: "Некорректный диапазон" });

    const employee = await app.prisma.employee.findUnique({ where: { id } });
    if (!employee || !employee.isActive) return reply.code(404).send({ error: "Сотрудник не найден" });

    const thresholds = await getThresholds(app.prisma);
    return buildRawAttendance(app, employee, parsed.data.range, thresholds);
  });

  app.get("/api/public/v1/employees/by-mac/:mac", { preHandler: app.requireApiKey }, async (req, reply) => {
    const { mac } = req.params as { mac: string };
    const normalized = normalizeMacAddress(mac);
    if (!normalized) return reply.code(400).send({ error: "Некорректный MAC-адрес" });

    const employee = await app.prisma.employee.findFirst({ where: { macAddress: normalized, isActive: true } });
    if (!employee) return reply.code(404).send({ error: "Сотрудник не найден" });

    return {
      id: employee.id,
      fullName: employee.fullName,
      personnelNumber: employee.personnelNumber,
      serialNumber: employee.serialNumber,
      macAddress: employee.macAddress,
    };
  });
}
