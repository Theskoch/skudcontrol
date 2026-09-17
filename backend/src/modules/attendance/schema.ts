import { z } from "zod";

export const createEventSchema = z.object({
  eventType: z.enum(["CHECK_IN", "CHECK_OUT"]),
  occurredAt: z.coerce.date(),
  notes: z.string().optional(),
});

export const updateEventSchema = z.object({
  eventType: z.enum(["CHECK_IN", "CHECK_OUT"]).optional(),
  occurredAt: z.coerce.date().optional(),
  reason: z.string().min(1, "Укажите причину исправления"),
});
