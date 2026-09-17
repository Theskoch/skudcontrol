import { z } from "zod";

export const createAccountSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
  displayName: z.string().min(1),
  role: z.enum(["ADMIN", "USER"]),
});

export const resetPasswordSchema = z.object({
  newPassword: z.string().min(6),
});

export const changeRoleSchema = z.object({
  role: z.enum(["ADMIN", "USER"]),
});
