import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password.js";
import { DEFAULT_THRESHOLDS } from "../src/modules/settings/service.js";
import { importBundledReport } from "../src/modules/reports/bundledReport.js";
import { env } from "../src/config/env.js";

const prisma = new PrismaClient();

const SEED_ADMIN_USERNAME = process.env.SEED_ADMIN_USERNAME ?? "admin";
const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "admin";

async function seedAdmin() {
  const existingAdminCount = await prisma.account.count({ where: { role: "ADMIN" } });
  if (existingAdminCount > 0) {
    console.log("Admin account already exists, skipping.");
    return;
  }
  const passwordHash = await hashPassword(SEED_ADMIN_PASSWORD);
  await prisma.account.create({
    data: {
      username: SEED_ADMIN_USERNAME,
      passwordHash,
      role: "ADMIN",
      displayName: "Администратор",
      isPrimary: true,
    },
  });
  console.log(`Created admin account "${SEED_ADMIN_USERNAME}".`);
}

async function seedSettings() {
  const entries = Object.entries(DEFAULT_THRESHOLDS);
  for (const [key, value] of entries) {
    await prisma.appSetting.upsert({
      where: { key },
      update: {},
      create: { key, value },
    });
  }
}

async function main() {
  await seedAdmin();
  await seedSettings();
  const summary = await importBundledReport(prisma, env.appTz);
  console.log(summary ? `Initial report import: ${JSON.stringify(summary)}` : "No bundled Report.html found, skipping initial import.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
