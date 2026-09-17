import type { Employee, PeriodMetrics } from "../../lib/types";
import { formatMinutes } from "../ui/ColorBandBadge";

export function EmployeeInfoCard({ employee }: { employee: Employee }) {
  return (
    <div className="rounded-2xl border border-line-hairline bg-surface p-6">
      <h1 className="text-lg font-semibold text-ink-primary">{employee.fullName}</h1>
      <dl className="mt-4 space-y-2 text-sm">
        <Row label="Серийный номер" value={employee.serialNumber ?? "—"} mono />
        <Row label="MAC-адрес" value={employee.macAddress ?? "—"} mono />
        {employee.personnelNumber && <Row label="Табельный номер" value={employee.personnelNumber} mono />}
      </dl>
    </div>
  );
}

export function PeriodMetricsCard({ period }: { period: PeriodMetrics }) {
  const items: { label: string; value: number; emphasis?: "good" | "bad" }[] = [
    { label: "Отработано", value: period.workedMinutes, emphasis: "good" },
    { label: "Норма", value: period.normMinutes },
    { label: "Недоработка", value: period.shortfallMinutes, emphasis: period.shortfallMinutes > 0 ? "bad" : undefined },
    { label: "Переработка", value: period.overtimeMinutes },
    { label: "Опоздания", value: period.latenessMinutes, emphasis: period.latenessMinutes > 0 ? "bad" : undefined },
    { label: "Ранний уход", value: period.earlyLeaveMinutes, emphasis: period.earlyLeaveMinutes > 0 ? "bad" : undefined },
    { label: "Отсутствие", value: period.absenceMinutes, emphasis: period.absenceMinutes > 0 ? "bad" : undefined },
  ];

  return (
    <div className="rounded-2xl border border-line-hairline bg-surface p-6">
      <div className="mb-3 text-xs uppercase tracking-wide text-ink-muted">За выбранный период</div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        {items.map((item) => (
          <div key={item.label}>
            <dt className="text-ink-muted">{item.label}</dt>
            <dd
              className={`tabular-nums font-medium ${
                item.emphasis === "bad"
                  ? "text-status-critical"
                  : item.emphasis === "good"
                    ? "text-status-good"
                    : "text-ink-primary"
              }`}
            >
              {formatMinutes(item.value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={mono ? "font-mono text-xs text-ink-secondary" : "text-ink-primary"}>{value}</dd>
    </div>
  );
}
