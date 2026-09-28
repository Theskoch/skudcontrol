import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { env } from "./config/env.js";
import prismaPlugin from "./plugins/prisma.js";
import authPlugin from "./plugins/auth.js";
import publicApiAuthPlugin from "./plugins/publicApiAuth.js";
import authRoutes from "./modules/auth/routes.js";
import employeeRoutes from "./modules/employees/routes.js";
import attendanceRoutes from "./modules/attendance/routes.js";
import settingsRoutes from "./modules/settings/routes.js";
import reportsRoutes from "./modules/reports/routes.js";
import accountsRoutes from "./modules/accounts/routes.js";
import networkRoutes from "./modules/network/routes.js";
import apiKeysRoutes from "./modules/apiKeys/routes.js";
import publicApiRoutes from "./modules/publicApi/routes.js";
import { runDeletionSweep } from "./modules/employees/expiry.js";
import { importBundledReportIfChanged } from "./modules/reports/bundledReport.js";
import { runUnifiPoll } from "./modules/network/poller.js";

const app = Fastify({ logger: true, trustProxy: true });

await app.register(cors, { origin: env.corsOrigins ?? true, credentials: true });
await app.register(cookie);
await app.register(multipart, { limits: { fileSize: 25 * 1024 * 1024 } });
await app.register(prismaPlugin);
await app.register(authPlugin);
await app.register(publicApiAuthPlugin);

await app.register(authRoutes);
await app.register(employeeRoutes);
await app.register(attendanceRoutes);
await app.register(settingsRoutes);
await app.register(reportsRoutes);
await app.register(accountsRoutes);
await app.register(networkRoutes);
await app.register(apiKeysRoutes);
await app.register(publicApiRoutes);

app.get("/api/health", async () => ({ ok: true }));

const DAY_MS = 24 * 60 * 60 * 1000;
const REPORT_POLL_MS = 60 * 1000;
const UNIFI_POLL_MS = 5 * 60 * 1000;

app.ready().then(() => {
  runDeletionSweep(app.prisma).catch((err) => app.log.error(err));
  setInterval(() => {
    runDeletionSweep(app.prisma).catch((err) => app.log.error(err));
  }, DAY_MS).unref();

  // The client's ACS export refreshes Report.html in place on its own schedule.
  // Polled every minute for a changed mtime; importBundledReportIfChanged
  // skips the actual (re-)import when the file hasn't moved since last time.
  const runReportImport = () => {
    importBundledReportIfChanged(app.prisma, env.appTz)
      .then((summary) => summary && app.log.info({ summary }, "report import"))
      .catch((err) => app.log.error(err, "report import failed"));
  };
  runReportImport();
  setInterval(runReportImport, REPORT_POLL_MS).unref();

  // Read-only: polls the UniFi Integration API (GET only) for currently
  // connected Wi-Fi clients matching a known employee MAC.
  runUnifiPoll(app.prisma)
    .then((summary) => app.log.info({ summary }, "unifi poll"))
    .catch((err) => app.log.error(err, "unifi poll failed"));
  setInterval(() => {
    runUnifiPoll(app.prisma)
      .then((summary) => app.log.info({ summary }, "unifi poll"))
      .catch((err) => app.log.error(err, "unifi poll failed"));
  }, UNIFI_POLL_MS).unref();
});

app.listen({ host: "0.0.0.0", port: env.port }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
