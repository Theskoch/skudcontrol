import { z } from "zod";

export const createEmployeeSchema = z.object({
  fullName: z.string().min(1),
  personnelNumber: z.string().optional(),
  serialNumber: z.string().min(1),
  macAddress: z.string().min(1),
  notes: z.string().optional(),
});

export const updateEmployeeSchema = createEmployeeSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const rangeQuerySchema = z.object({
  range: z.enum(["today", "yesterday", "week", "month", "year", "all"]).default("today"),
});
