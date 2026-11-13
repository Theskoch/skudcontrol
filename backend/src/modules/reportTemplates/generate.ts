import type { PrismaClient, ReportTemplate } from "@prisma/client";
import {
  computeDashboardForRange,
  minutesSinceMidnight,
  resolveRange,
  type ResolvedRange,
} from "../attendance/metrics.js";
import { getThresholds } from "../settings/service.js";
import { zonedDateTimeToUtc, zonedDayKey } from "../../lib/timezone.js";
import { REPORT_FIELDS, type ReportRow } from "./fields.js";

export function resolveTemplateRange(
  template: Pick<ReportTemplate, "periodType" | "periodDate">,
  timeZone: string,
  now: Date,
): ResolvedRange {
  if (template.periodType === "date" && template.periodDate) {
    const [y, m, d] = template.periodDate.split("-").map(Number);
    const start = zonedDateTimeToUtc(y, m, d, 0, 0, timeZone);
    // Next calendar day's midnight via Date.UTC so month/year rollover is handled.
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    const end = zonedDateTimeToUtc(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), 0, 0, timeZone);
    return { start, end };
  }
  return resolveRange(template.periodType as "today" | "yesterday" | "week" | "month" | "all", timeZone, now);
}

function average(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

function escapeHtml(value: string | number): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function ruDate(dayKey: string): string {
  const [y, m, d] = dayKey.split("-");
  return `${d}.${m}.${y}`;
}

function periodLabel(range: ResolvedRange, timeZone: string): { label: string; fileSlug: string } {
  const to = zonedDayKey(new Date(range.end.getTime() - 1), timeZone);
  if (!range.start) return { label: `Всё время (по ${ruDate(to)})`, fileSlug: `all_${to}` };
  const from = zonedDayKey(range.start, timeZone);
  if (from === to) return { label: ruDate(from), fileSlug: from };
  return { label: `${ruDate(from)} — ${ruDate(to)}`, fileSlug: `${from}_${to}` };
}

const STYLE = `
:root{--bg:#f5f6fa;--surface:#fff;--ink:#1b1d2a;--muted:#6b7085;--line:#e3e5ee;--head:#f0f1f7;--accent:#6d4aff;--bad:#b45309;--bad-bg:#fef3c7;--good:#047857;--good-bg:#d1fae5}
@media (prefers-color-scheme:dark){:root{--bg:#0f1016;--surface:#181924;--ink:#eceef7;--muted:#9096ad;--line:#2a2c3b;--head:#1f2130;--accent:#9b82ff;--bad:#fbbf24;--bad-bg:#3a2e0b;--good:#34d399;--good-bg:#0d3326}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
.wrap{max-width:1200px;margin:0 auto;padding:32px 24px 48px}
.brand{display:flex;align-items:center;gap:8px;font-weight:600;color:var(--muted);font-size:13px;letter-spacing:.02em}
.brand i{width:9px;height:9px;border-radius:50%;background:var(--accent);display:inline-block}
h1{margin:10px 0 18px;font-size:26px;letter-spacing:-.01em}
.meta{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:22px}
.chip{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:8px 14px}
.chip b{display:block;font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:2px}
.card{background:var(--surface);border:1px solid var(--line);border-radius:14px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.04)}
.scroll{overflow-x:auto}
table{width:100%;border-collapse:collapse;white-space:nowrap}
th{position:sticky;top:0;background:var(--head);color:var(--muted);font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;text-align:left;padding:12px 16px;border-bottom:1px solid var(--line)}
td{padding:11px 16px;border-bottom:1px solid var(--line)}
tbody tr:last-child td{border-bottom:0}
tbody tr:nth-child(even){background:color-mix(in srgb,var(--head) 45%,transparent)}
tbody tr:hover{background:color-mix(in srgb,var(--accent) 8%,transparent)}
.num{text-align:right;font-variant-numeric:tabular-nums}
.first{font-weight:600}
.tag{display:inline-block;min-width:44px;text-align:center;border-radius:6px;padding:1px 8px;font-weight:600}
.bad{color:var(--bad);background:var(--bad-bg)}
.good{color:var(--good);background:var(--good-bg)}
.empty{padding:40px;text-align:center;color:var(--muted)}
.foot{margin-top:16px;color:var(--muted);font-size:12px}
@media print{body{background:#fff}.wrap{padding:0}.card{box-shadow:none}th{position:static}}
`;

function isZero(value: string | number): boolean {
  return value === 0 || value === "0:00" || value === "";
}

/** Self-contained HTML page (inline CSS, no external requests) - opens straight from disk in any browser. */
export async function buildReportHtml(
  prisma: PrismaClient,
  template: ReportTemplate,
  timeZone: string,
  now: Date,
): Promise<{ html: string; fileSlug: string }> {
  const fields = REPORT_FIELDS.filter((f) => template.fields.includes(f.key));
  const needsMetrics = fields.some((f) => f.group === "metrics");

  const employees = await prisma.employee.findMany({
    where: {
      isActive: true,
      ...(template.allEmployees ? {} : { id: { in: template.employeeIds } }),
    },
    orderBy: { fullName: "asc" },
  });

  const range = resolveTemplateRange(template, timeZone, now);
  const thresholds = needsMetrics ? await getThresholds(prisma) : null;

  const rows: ReportRow[] = [];
  for (const employee of employees) {
    let metrics: ReportRow["metrics"] = null;
    if (needsMetrics && thresholds) {
      const dashboard = await computeDashboardForRange(prisma, employee.id, range, timeZone, thresholds);
      const arrivals = dashboard.combinedTimeline
        .filter((d) => d.arrival)
        .map((d) => minutesSinceMidnight(d.arrival!, timeZone));
      const departures = dashboard.combinedTimeline
        .filter((d) => d.departure)
        .map((d) => minutesSinceMidnight(d.departure!, timeZone));
      metrics = {
        ...dashboard.period,
        avgArrivalMinutes: average(arrivals),
        avgDepartureMinutes: average(departures),
      };
    }
    rows.push({ employee, metrics });
  }

  const { label, fileSlug } = periodLabel(range, timeZone);
  const generatedAt = new Intl.DateTimeFormat("ru-RU", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);

  const head = fields
    .map((f) => `<th class="${f.kind === "num" ? "num" : ""}">${escapeHtml(f.label)}</th>`)
    .join("");
  const body = rows
    .map((row) => {
      const cells = fields
        .map((f, i) => {
          const v = f.value(row);
          const cls = [f.kind === "num" ? "num" : "", i === 0 ? "first" : ""].filter(Boolean).join(" ");
          const text = escapeHtml(v === "" ? "—" : v);
          const inner =
            f.tone && !isZero(v) ? `<span class="tag ${f.tone}">${text}</span>` : text;
          return `<td${cls ? ` class="${cls}"` : ""}>${inner}</td>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("\n");

  const table = rows.length
    ? `<div class="scroll"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`
    : `<div class="empty">Нет сотрудников для выгрузки</div>`;

  const html = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(template.name)} — ${escapeHtml(label)}</title>
<style>${STYLE}</style>
</head>
<body>
<div class="wrap">
  <div class="brand"><i></i>SkudControl</div>
  <h1>${escapeHtml(template.name)}</h1>
  <div class="meta">
    <div class="chip"><b>Период</b>${escapeHtml(label)}</div>
    <div class="chip"><b>Сотрудников</b>${rows.length}</div>
    <div class="chip"><b>Сформирован</b>${escapeHtml(generatedAt)}</div>
  </div>
  <div class="card">${table}</div>
  <div class="foot">Данные из базы SkudControl на момент формирования отчёта.</div>
</div>
</body>
</html>
`;
  return { html, fileSlug };
}
