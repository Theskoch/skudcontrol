import type { PrismaClient } from "@prisma/client";

const DELETION_GRACE_DAYS = 90;

/** Finalises soft-deletion for employees who've been missing from every report import for 3+ months. */
export async function runDeletionSweep(prisma: PrismaClient): Promise<number> {
  const cutoff = new Date(Date.now() - DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);
  const result = await prisma.employee.updateMany({
    where: { isActive: true, deletionMarkedAt: { lte: cutoff } },
    data: { isActive: false },
  });
  return result.count;
}
