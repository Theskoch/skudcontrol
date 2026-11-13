import type { DailyMetrics } from "../attendance/metrics.js";

export type ReportRow = {
  employee: {
    fullName: string;
    macAddress: string | null;
    serialNumber: string | null;
    personnelNumber: string | null;
  };
  /** null when the report has no metric columns (metrics are not computed then). */
  metrics: (DailyMetrics & { avgArrivalMinutes: number | null; avgDepartureMinutes: number | null }) | null;
};

export type ReportFieldDef = {
  key: string;
  label: string;
  group: "employee" | "metrics";
  value: (row: ReportRow) => string | number;
  /** Right-aligned numeric/time column vs plain text. */
  kind: "text" | "num";
  /** Highlight non-zero values: "bad" (amber) / "good" (green). */
  tone?: "bad" | "good";
};

function hm(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}

function clock(minutes: number | null): string {
  if (minutes === null) return "";
  const m = Math.round(minutes);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

const metric = (row: ReportRow) => row.metrics!;

export const REPORT_FIELDS: ReportFieldDef[] = [
  { key: "code", label: "Сотрудник", group: "employee", value: (r) => r.employee.fullName, kind: "text" },
  { key: "mac", label: "MAC-адрес", group: "employee", value: (r) => r.employee.macAddress ?? "", kind: "text" },
  { key: "serialNumber", label: "Серийный номер", group: "employee", value: (r) => r.employee.serialNumber ?? "", kind: "text" },
  { key: "personnelNumber", label: "Табельный номер", group: "employee", value: (r) => r.employee.personnelNumber ?? "", kind: "text" },

  { key: "activeDays", label: "Дней на объекте", group: "metrics", value: (r) => metric(r).activeDays, kind: "num" },
  { key: "workedTime", label: "Отработано, ч:мм", group: "metrics", value: (r) => hm(metric(r).workedMinutes), kind: "num" },
  { key: "averageTime", label: "Среднее в день, ч:мм", group: "metrics", value: (r) => hm(metric(r).averageMinutes), kind: "num" },
  { key: "normTime", label: "Норма, ч:мм", group: "metrics", value: (r) => hm(metric(r).normMinutes), kind: "num" },
  { key: "shortfallTime", label: "Недоработка, ч:мм", group: "metrics", value: (r) => hm(metric(r).shortfallMinutes), kind: "num", tone: "bad" },
  { key: "overtimeTime", label: "Переработка, ч:мм", group: "metrics", value: (r) => hm(metric(r).overtimeMinutes), kind: "num", tone: "good" },
  { key: "latenessTime", label: "Опоздания, ч:мм", group: "metrics", value: (r) => hm(metric(r).latenessMinutes), kind: "num", tone: "bad" },
  { key: "earlyLeaveTime", label: "Ранний уход, ч:мм", group: "metrics", value: (r) => hm(metric(r).earlyLeaveMinutes), kind: "num", tone: "bad" },
  { key: "absenceTime", label: "Отсутствие, ч:мм", group: "metrics", value: (r) => hm(metric(r).absenceMinutes), kind: "num", tone: "bad" },
  { key: "avgArrival", label: "Приход (средний)", group: "metrics", value: (r) => clock(metric(r).avgArrivalMinutes), kind: "num" },
  { key: "avgDeparture", label: "Уход (средний)", group: "metrics", value: (r) => clock(metric(r).avgDepartureMinutes), kind: "num" },
];

export const REPORT_FIELD_KEYS = REPORT_FIELDS.map((f) => f.key);
