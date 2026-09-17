import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { PrismaClient } from "@prisma/client";
import { env } from "../../config/env.js";
import { importAttendanceReport, type ImportSummary } from "./service.js";

const REPORT_FILE_NAME = "Report.html";

/**
 * The client overwrites this file in place every hour from their ACS export.
 * `REPORT_DIR` is the primary source (set by docker-compose to the mounted,
 * user-configurable host folder); the relative candidates are only a fallback
 * for running the backend outside Docker without that env var set.
 */
export function findBundledReportPath(): string | null {
  if (env.reportDir) {
    const configured = path.join(env.reportDir, REPORT_FILE_NAME);
    return fs.existsSync(configured) ? configured : null;
  }

  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(here, "..", "..", "..", "Report", REPORT_FILE_NAME),
    path.join(here, "..", "..", "..", "..", "Report", REPORT_FILE_NAME),
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

export async function importBundledReport(
  prisma: PrismaClient,
  timeZone: string,
): Promise<ImportSummary | null> {
  const reportPath = findBundledReportPath();
  if (!reportPath) return null;

  const admin = await prisma.account.findFirst({ where: { role: "ADMIN" } });
  if (!admin) return null;

  const html = fs.readFileSync(reportPath, "utf-8");
  return importAttendanceReport(prisma, html, admin.id, timeZone);
}
