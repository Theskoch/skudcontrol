import { z } from "zod";

// Lowercase only (avoids "user" vs "User" turning into two different-looking
// accounts), alnum start/end, 3-32 chars - keeps logins predictable to type
// and safe to use anywhere a username shows up (URLs, logs, etc).
const usernameSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9._-]{1,30}[a-z0-9]$/, "Логин: строчные латинские буквы, цифры, . _ - (3-32 символа)");

// Long enough to be a real limit rather than validation theatre, short enough
// to stay under bcrypt's silent 72-byte truncation. No control characters or
// leading/trailing whitespace - both are easy to paste in by accident and
// have caused real trouble (e.g. copy-pasting a password with a stray newline).
const passwordSchema = z
  .string()
  .min(6, "Минимум 6 символов")
  .max(72, "Максимум 72 символа")
  .refine((v) => v === v.trim(), { message: "Без пробелов в начале/конце" })
  .refine((v) => !/[\x00-\x1F\x7F]/.test(v), { message: "Недопустимые управляющие символы" });

export const createAccountSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(1).max(100),
  role: z.enum(["ADMIN", "USER"]),
});

export const resetPasswordSchema = z.object({
  newPassword: passwordSchema,
});

export const changeRoleSchema = z.object({
  role: z.enum(["ADMIN", "USER"]),
});
