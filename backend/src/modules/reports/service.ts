import type { PrismaClient } from "@prisma/client";
import { parseAttendanceReport } from "./parser.js";
import { zonedDateTimeToUtc } from "../../lib/timezone.js";

export type ImportSummary = {
  rowsParsed: number;
  employeesInReport: number;
  employeesCreated: number;
  employeesReactivated: number;
  macAddressesUpdated: number;
  eventsCreated: number;
  employeesMarkedForDeletion: number;
};

function parseHHMM(value: string): { hour: number; minute: number } {
  const [hour, minute] = value.split(":").map(Number);
  return { hour, minute };
}

export async function importAttendanceReport(
  prisma: PrismaClient,
  html: string,
  importedById: string,
  timeZone: string,
): Promise<ImportSummary> {
  const entries = parseAttendanceReport(html);

  const byEmployee = new Map<string, typeof entries>();
  for (const entry of entries) {
    const list = byEmployee.get(entry.patronymic) ?? [];
    list.push(entry);
    byEmployee.set(entry.patronymic, list);
  }

  let employeesCreated = 0;
  let employeesReactivated = 0;
  let macAddressesUpdated = 0;
  let eventsCreated = 0;

  for (const [patronymic, dayEntries] of byEmployee) {
    let employee = await prisma.employee.findFirst({ where: { patronymic } });
    const fullName = patronymic;
    const reportMac = dayEntries.find((e) => e.macAddress)?.macAddress ?? null;

    if (!employee) {
      employee = await prisma.employee.create({
        data: { fullName, patronymic, macAddress: reportMac, createdById: importedById },
      });
      employeesCreated++;
    } else {
      const needsReactivation = !employee.isActive || employee.deletionMarkedAt;
      const needsMacUpdate = reportMac !== null && reportMac !== employee.macAddress;
      const needsNameUpdate = fullName !== employee.fullName;

      if (needsReactivation || needsMacUpdate || needsNameUpdate) {
        employee = await prisma.employee.update({
          where: { id: employee.id },
          data: {
            ...(needsReactivation ? { isActive: true, deletionMarkedAt: null } : {}),
            ...(needsMacUpdate ? { macAddress: reportMac } : {}),
            ...(needsNameUpdate ? { fullName } : {}),
          },
        });
        if (needsReactivation) employeesReactivated++;
        if (needsMacUpdate) macAddressesUpdated++;
      }
    }

    for (const entry of dayEntries) {
      const [y, m, d] = entry.dateKey.split("-").map(Number);

      for (const [field, eventType] of [
        ["checkIn", "CHECK_IN"],
        ["checkOut", "CHECK_OUT"],
      ] as const) {
        const raw = entry[field];
        if (!raw) continue;

        const { hour, minute } = parseHHMM(raw);
        const occurredAt = zonedDateTimeToUtc(y, m, d, hour, minute, timeZone);

        const existing = await prisma.attendanceEvent.findFirst({
          where: { employeeId: employee.id, eventType, occurredAt },
        });
        if (existing) continue;

        await prisma.attendanceEvent.create({
          data: {
            employeeId: employee.id,
            eventType,
            occurredAt,
            source: "IMPORTED",
          },
        });
        eventsCreated++;
      }
    }
  }

  const reportCodes = new Set(byEmployee.keys());
  const activeEmployees = await prisma.employee.findMany({
    where: { isActive: true },
    select: { id: true, patronymic: true, deletionMarkedAt: true },
  });

  let employeesMarkedForDeletion = 0;
  for (const employee of activeEmployees) {
    if (employee.patronymic && reportCodes.has(employee.patronymic)) continue;
    if (employee.deletionMarkedAt) continue;
    await prisma.employee.update({
      where: { id: employee.id },
      data: { deletionMarkedAt: new Date() },
    });
    employeesMarkedForDeletion++;
  }

  return {
    rowsParsed: entries.length,
    employeesInReport: byEmployee.size,
    employeesCreated,
    employeesReactivated,
    macAddressesUpdated,
    eventsCreated,
    employeesMarkedForDeletion,
  };
}
