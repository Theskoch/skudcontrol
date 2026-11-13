import { z } from "zod";
import { REPORT_FIELD_KEYS } from "./fields.js";

export const PERIOD_TYPES = ["today", "yesterday", "week", "month", "all", "date"] as const;

export const templateSchema = z
  .object({
    name: z.string().trim().min(1, "Укажите название").max(100),
    fields: z
      .array(z.string())
      .min(1, "Выберите хотя бы одно поле")
      .refine((f) => f.every((k) => REPORT_FIELD_KEYS.includes(k)), "Неизвестное поле"),
    allEmployees: z.boolean(),
    employeeIds: z.array(z.string()).max(5000),
    periodType: z.enum(PERIOD_TYPES),
    periodDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Дата в формате ГГГГ-ММ-ДД")
      .nullable()
      .optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.allEmployees && v.employeeIds.length === 0) {
      ctx.addIssue({ code: "custom", path: ["employeeIds"], message: "Выберите сотрудников" });
    }
    if (v.periodType === "date") {
      const ok = v.periodDate && !Number.isNaN(Date.parse(`${v.periodDate}T00:00:00Z`));
      if (!ok) ctx.addIssue({ code: "custom", path: ["periodDate"], message: "Укажите дату" });
    }
  });

export type TemplateInput = z.infer<typeof templateSchema>;
