import fp from "fastify-plugin";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { AUTH_COOKIE_NAME, verifyToken, type JwtPayload } from "../lib/jwt.js";

declare module "fastify" {
  interface FastifyInstance {
    requireAuth: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (
      role: JwtPayload["role"],
    ) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    user?: JwtPayload;
  }
}

export default fp(async (app: FastifyInstance) => {
  app.decorate("requireAuth", async (req: FastifyRequest, reply: FastifyReply) => {
    const token = req.cookies[AUTH_COOKIE_NAME];
    if (!token) {
      return reply.code(401).send({ error: "Не авторизован" });
    }
    let payload: JwtPayload;
    try {
      payload = verifyToken(token);
    } catch {
      return reply.code(401).send({ error: "Сессия истекла, войдите снова" });
    }

    // Re-checked on every request (not just at login) so blocking/deleting/re-role-ing
    // an account takes effect immediately instead of waiting out the JWT's lifetime.
    const account = await app.prisma.account.findUnique({ where: { id: payload.sub } });
    if (!account || account.deletedAt || account.isBlocked) {
      return reply.code(401).send({ error: "Учётная запись недоступна" });
    }
    req.user = { sub: account.id, role: account.role, username: account.username };
  });

  app.decorate(
    "requireRole",
    (role: JwtPayload["role"]) => async (req: FastifyRequest, reply: FastifyReply) => {
      await app.requireAuth(req, reply);
      if (reply.sent) return;
      if (req.user?.role !== role) {
        return reply.code(403).send({ error: "Недостаточно прав" });
      }
    },
  );
});
