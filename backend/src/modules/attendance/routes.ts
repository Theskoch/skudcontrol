import type { FastifyInstance } from "fastify";
import { createEventSchema, updateEventSchema } from "./schema.js";

export default async function attendanceRoutes(app: FastifyInstance) {
  app.post(
    "/api/employees/:id/attendance-events",
    { preHandler: app.requireRole("ADMIN") },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const parsed = createEventSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

      const employee = await app.prisma.employee.findUnique({ where: { id } });
      if (!employee) return reply.code(404).send({ error: "Сотрудник не найден" });

      const event = await app.prisma.$transaction(async (tx) => {
        const created = await tx.attendanceEvent.create({
          data: {
            employeeId: id,
            eventType: parsed.data.eventType,
            occurredAt: parsed.data.occurredAt,
            notes: parsed.data.notes,
            source: "MANUAL",
            createdById: req.user!.sub,
          },
        });
        await tx.attendanceAudit.create({
          data: {
            attendanceEventId: created.id,
            employeeId: id,
            action: "CREATE",
            newValue: { eventType: created.eventType, occurredAt: created.occurredAt },
            editedById: req.user!.sub,
          },
        });
        return created;
      });

      return reply.code(201).send(event);
    },
  );

  app.patch("/api/attendance-events/:eventId", { preHandler: app.requireRole("ADMIN") }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const parsed = updateEventSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const existing = await app.prisma.attendanceEvent.findUnique({ where: { id: eventId } });
    if (!existing) return reply.code(404).send({ error: "Событие не найдено" });

    const { reason, ...changes } = parsed.data;
    const updated = await app.prisma.$transaction(async (tx) => {
      await tx.attendanceAudit.create({
        data: {
          attendanceEventId: existing.id,
          employeeId: existing.employeeId,
          action: "UPDATE",
          previousValue: { eventType: existing.eventType, occurredAt: existing.occurredAt },
          newValue: {
            eventType: changes.eventType ?? existing.eventType,
            occurredAt: changes.occurredAt ?? existing.occurredAt,
          },
          editedById: req.user!.sub,
          reason,
        },
      });
      return tx.attendanceEvent.update({ where: { id: eventId }, data: changes });
    });

    return updated;
  });

  app.delete("/api/attendance-events/:eventId", { preHandler: app.requireRole("ADMIN") }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const body = (req.body ?? {}) as { reason?: string };
    if (!body.reason) return reply.code(400).send({ error: "Укажите причину удаления" });

    const existing = await app.prisma.attendanceEvent.findUnique({ where: { id: eventId } });
    if (!existing) return reply.code(404).send({ error: "Событие не найдено" });

    await app.prisma.$transaction(async (tx) => {
      await tx.attendanceAudit.create({
        data: {
          attendanceEventId: existing.id,
          employeeId: existing.employeeId,
          action: "DELETE",
          previousValue: { eventType: existing.eventType, occurredAt: existing.occurredAt },
          editedById: req.user!.sub,
          reason: body.reason,
        },
      });
      await tx.attendanceEvent.delete({ where: { id: eventId } });
    });

    return reply.code(204).send();
  });

  app.get(
    "/api/employees/:id/attendance-audit",
    { preHandler: app.requireRole("ADMIN") },
    async (req) => {
      const { id } = req.params as { id: string };
      return app.prisma.attendanceAudit.findMany({
        where: { employeeId: id },
        orderBy: { editedAt: "desc" },
        include: { editedBy: { select: { username: true, displayName: true } } },
        take: 100,
      });
    },
  );
}
