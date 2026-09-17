import { z } from "zod";

export const publicRangeQuerySchema = z.object({
  range: z.enum(["today", "yesterday", "week", "month", "year", "all"]).default("today"),
});
