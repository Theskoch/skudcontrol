import { z } from "zod";

const sessionSchema = z.object({
  macAddress: z.string().min(1),
  startedAt: z.coerce.date(),
  endedAt: z.coerce.date().nullable().optional(),
  apLabel: z.string().nullable().optional(),
  rxBytes: z.coerce.number().nonnegative().nullable().optional(),
  txBytes: z.coerce.number().nonnegative().nullable().optional(),
});

export const ingestSchema = z.object({
  sessions: z.array(sessionSchema).min(1),
});
