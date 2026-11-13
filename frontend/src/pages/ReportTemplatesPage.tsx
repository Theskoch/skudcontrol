import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatDate } from "../lib/time";
import type { ReportFieldDef, ReportPeriodType, ReportTemplate } from "../lib/types";

export const PERIOD_LABELS: Record<ReportPeriodType, string> = {
  today: "Сегодня",
  yesterday: "Вчера",
  week: "Неделя",
  month: "Месяц",
  all: "Всё время",
  date: "Точная дата",
};

function periodText(t: ReportTemplate): string {
  if (t.periodType === "date" && t.periodDate) {
    const [y, m, d] = t.periodDate.split("-");
    return `${d}.${m}.${y}`;
  }
  return PERIOD_LABELS[t.periodType];
}

export function ReportTemplatesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["report-templates"],
    queryFn: () => api.get<ReportTemplate[]>("/report-templates"),
    enabled: user?.role === "ADMIN",
  });
  const { data: fieldDefs } = useQuery({
    queryKey: ["report-fields"],
    queryFn: () => api.get<ReportFieldDef[]>("/report-templates/fields"),
    enabled: user?.role === "ADMIN",
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/report-templates/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["report-templates"] }),
  });

  if (user && user.role !== "ADMIN") return <Navigate to="/" replace />;

  async function generate(t: ReportTemplate) {
    setError(null);
    setBusyId(t.id);
    try {
      await api.downloadPost(`/report-templates/${t.id}/generate`, "report.html");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось создать отчёт");
    } finally {
      setBusyId(null);
    }
  }

  const labelOf = new Map((fieldDefs ?? []).map((f) => [f.key, f.label]));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Отчёты</h1>
          <p className="text-sm text-ink-muted">Макеты выгрузок из базы сервиса</p>
        </div>
        <button
          onClick={() => navigate("/reports/new")}
          className="rounded-lg bg-accent-violet px-3 py-2 text-sm font-medium text-white hover:bg-accent-violet-strong"
        >
          + Создать новый макет
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-status-critical/40 bg-status-critical/10 px-3 py-2 text-sm text-status-critical">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-xl border border-line-hairline bg-surface px-6 py-12 text-center text-ink-muted">
          Загрузка...
        </div>
      ) : !data || data.length === 0 ? (
        <div className="rounded-xl border border-line-hairline bg-surface px-6 py-10 text-center text-ink-muted">
          Макетов пока нет
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line-hairline bg-surface">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line-hairline text-ink-muted">
                <th className="px-4 py-3 font-medium">Макет</th>
                <th className="px-4 py-3 font-medium">Период</th>
                <th className="px-4 py-3 font-medium">Сотрудники</th>
                <th className="px-4 py-3 font-medium">Поля</th>
                <th className="px-4 py-3 font-medium">Создан</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {data.map((t) => (
                <tr key={t.id} className="border-b border-line-hairline last:border-0">
                  <td className="px-4 py-3 font-medium text-ink-primary">{t.name}</td>
                  <td className="px-4 py-3 text-ink-secondary">{periodText(t)}</td>
                  <td className="px-4 py-3 text-ink-secondary">
                    {t.allEmployees ? "Все" : t.employeeIds.length}
                  </td>
                  <td
                    className="max-w-xs truncate px-4 py-3 text-ink-secondary"
                    title={t.fields.map((k) => labelOf.get(k) ?? k).join(", ")}
                  >
                    {t.fields.length}
                  </td>
                  <td className="px-4 py-3 text-ink-secondary">{formatDate(t.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        disabled={busyId === t.id}
                        onClick={() => generate(t)}
                        className="rounded-md bg-accent-violet px-2.5 py-1.5 text-xs font-medium text-white hover:bg-accent-violet-strong disabled:opacity-60"
                      >
                        {busyId === t.id ? "Создание..." : "Создать отчёт"}
                      </button>
                      <Link
                        to={`/reports/${t.id}`}
                        className="rounded-md border border-line-hairline px-2.5 py-1.5 text-xs text-ink-secondary hover:border-accent-violet hover:text-ink-primary"
                      >
                        Изменить
                      </Link>
                      <button
                        onClick={() => {
                          if (window.confirm(`Удалить макет «${t.name}»?`)) deleteMutation.mutate(t.id);
                        }}
                        className="rounded-md border border-line-hairline px-2.5 py-1.5 text-xs text-status-critical hover:border-status-critical"
                      >
                        Удалить
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
