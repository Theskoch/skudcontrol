import { z } from "zod";

export const createApiKeySchema = z.object({
  name: z.string().min(1),
  expiresIn: z.enum(["1m", "6m", "1y", "never"]),
});
