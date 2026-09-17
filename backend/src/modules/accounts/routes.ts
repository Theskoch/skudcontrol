import type { FastifyInstance } from "fastify";
import { createAccountSchema, resetPasswordSchema, changeRoleSchema } from "./schema.js";
import { hashPassword } from "../../lib/password.js";

export default async function accountsRoutes(app: FastifyInstance) {
  app.get("/api/accounts", { preHandler: app.requireRole("ADMIN") }, async () => {
    const accounts = await app.prisma.account.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        isBlocked: true,
        isPrimary: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });
    return accounts;
  });

  app.post("/api/accounts", { preHandler: app.requireRole("ADMIN") }, async (req, reply) => {
    const parsed = createAccountSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const existing = await app.prisma.account.findUnique({ where: { username: parsed.data.username } });
    if (existing) return reply.code(409).send({ error: "Такой логин уже занят" });

    const passwordHash = await hashPassword(parsed.data.password);
    const account = await app.prisma.account.create({
      data: {
        username: parsed.data.username,
        displayName: parsed.data.displayName,
        role: parsed.data.role,
        passwordHash,
      },
    });
    return reply.code(201).send({ id: account.id, username: account.username });
  });

  app.post(
    "/api/accounts/:id/reset-password",
    { preHandler: app.requireRole("ADMIN") },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const parsed = resetPasswordSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

      const account = await app.prisma.account.findUnique({ where: { id } });
      if (!account || account.deletedAt) return reply.code(404).send({ error: "Учётная запись не найдена" });

      const passwordHash = await hashPassword(parsed.data.newPassword);
      await app.prisma.account.update({ where: { id }, data: { passwordHash } });
      return { ok: true };
    },
  );

  app.patch("/api/accounts/:id/role", { preHandler: app.requireRole("ADMIN") }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = changeRoleSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    if (id === req.user!.sub) return reply.code(400).send({ error: "Нельзя изменить роль своей же учётной записи" });

    const account = await app.prisma.account.findUnique({ where: { id } });
    if (!account || account.deletedAt) return reply.code(404).send({ error: "Учётная запись не найдена" });
    if (account.isPrimary) return reply.code(400).send({ error: "Нельзя изменить роль центральной учётной записи" });

    if (account.role === "ADMIN" && parsed.data.role === "USER") {
      const activeAdmins = await app.prisma.account.count({
        where: { role: "ADMIN", deletedAt: null, isBlocked: false },
      });
      if (activeAdmins <= 1) {
        return reply.code(400).send({ error: "Нельзя понизить единственного администратора" });
      }
    }

    await app.prisma.account.update({ where: { id }, data: { role: parsed.data.role } });
    return { ok: true };
  });

  app.patch("/api/accounts/:id/block", { preHandler: app.requireRole("ADMIN") }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (id === req.user!.sub) return reply.code(400).send({ error: "Нельзя заблокировать свою же учётную запись" });

    const account = await app.prisma.account.findUnique({ where: { id } });
    if (!account || account.deletedAt) return reply.code(404).send({ error: "Учётная запись не найдена" });
    if (account.isPrimary) return reply.code(400).send({ error: "Нельзя заблокировать центральную учётную запись" });

    if (account.role === "ADMIN") {
      const activeAdmins = await app.prisma.account.count({
        where: { role: "ADMIN", deletedAt: null, isBlocked: false },
      });
      if (activeAdmins <= 1) {
        return reply.code(400).send({ error: "Нельзя заблокировать единственного администратора" });
      }
    }

    await app.prisma.account.update({ where: { id }, data: { isBlocked: true } });
    return { ok: true };
  });

  app.patch("/api/accounts/:id/unblock", { preHandler: app.requireRole("ADMIN") }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const account = await app.prisma.account.findUnique({ where: { id } });
    if (!account || account.deletedAt) return reply.code(404).send({ error: "Учётная запись не найдена" });

    await app.prisma.account.update({ where: { id }, data: { isBlocked: false } });
    return { ok: true };
  });

  app.delete("/api/accounts/:id", { preHandler: app.requireRole("ADMIN") }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (id === req.user!.sub) return reply.code(400).send({ error: "Нельзя удалить свою же учётную запись" });

    const account = await app.prisma.account.findUnique({ where: { id } });
    if (!account || account.deletedAt) return reply.code(404).send({ error: "Учётная запись не найдена" });
    if (account.isPrimary) return reply.code(400).send({ error: "Нельзя удалить центральную учётную запись" });

    if (account.role === "ADMIN") {
      const activeAdmins = await app.prisma.account.count({
        where: { role: "ADMIN", deletedAt: null },
      });
      if (activeAdmins <= 1) {
        return reply.code(400).send({ error: "Нельзя удалить единственного администратора" });
      }
    }

    await app.prisma.account.update({ where: { id }, data: { deletedAt: new Date(), isBlocked: true } });
    return reply.code(204).send();
  });
}
