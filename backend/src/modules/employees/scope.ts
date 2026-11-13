import type { PrismaClient } from "@prisma/client";

/**
 * Which employees the current account may view.
 * `null` = everyone (admins, and users with "sees all" on); otherwise the allow-list of employee ids.
 */
export async function getEmployeeScope(
  prisma: PrismaClient,
  user: { sub: string; role: "ADMIN" | "USER" },
): Promise<string[] | null> {
  if (user.role === "ADMIN") return null;
  const account = await prisma.account.findUnique({
    where: { id: user.sub },
    select: { seesAll: true, employeeAccess: { select: { employeeId: true } } },
  });
  if (!account || account.seesAll) return null;
  return account.employeeAccess.map((a) => a.employeeId);
}

export function isEmployeeVisible(scope: string[] | null, employeeId: string): boolean {
  return scope === null || scope.includes(employeeId);
}
