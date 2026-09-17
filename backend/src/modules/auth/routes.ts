import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { verifyPassword } from "../../lib/password.js";
import { signToken, AUTH_COOKIE_NAME } from "../../lib/jwt.js";
import { env } from "../../config/env.js";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export default async function authRoutes(app: FastifyInstance) {
  app.post("/api/auth/login", async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Введите логин и пароль" });
    }
    const { username, password } = parsed.data;

    const account = await app.prisma.account.findUnique({ where: { username } });
    if (!account || account.deletedAt || !(await verifyPassword(password, account.passwordHash))) {
      return reply.code(401).send({ error: "Неверный логин или пароль" });
    }
    if (account.isBlocked) {
      return reply.code(403).send({ error: "Учётная запись заблокирована администратором" });
    }

    await app.prisma.account.update({
      where: { id: account.id },
      data: { lastLoginAt: new Date() },
    });

    const token = signToken({ sub: account.id, role: account.role, username: account.username });
    reply
      .setCookie(AUTH_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: env.cookieSecure,
        path: "/",
        maxAge: 8 * 60 * 60,
      })
      .send({
        user: {
          id: account.id,
          username: account.username,
          role: account.role,
          displayName: account.displayName,
        },
      });
  });

  app.post("/api/auth/logout", async (_req, reply) => {
    reply
      .clearCookie(AUTH_COOKIE_NAME, {
        httpOnly: true,
        sameSite: "lax",
        secure: env.cookieSecure,
        path: "/",
      })
      .send({ ok: true });
  });

  app.get("/api/auth/me", { preHandler: app.requireAuth }, async (req, reply) => {
    reply.header("Cache-Control", "no-store");
    const account = await app.prisma.account.findUnique({ where: { id: req.user!.sub } });
    if (!account) return reply.code(401).send({ error: "Не авторизован" });
    return {
      id: account.id,
      username: account.username,
      role: account.role,
      displayName: account.displayName,
    };
  });
}
