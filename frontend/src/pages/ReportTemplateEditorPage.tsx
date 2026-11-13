import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import type {
  EmployeeListItem,
  ReportFieldDef,
  ReportPeriodType,
  ReportTemplate,
  ReportTemplateInput,
} from "../lib/types";
import { PERIOD_LABELS } from "./ReportTemplatesPage";

const PERIODS: ReportPeriodType[] = ["today", "yesterday", "week", "month", "all", "date"];
const GROUP_TITLES = { employee: "Данные сотрудника", metrics: "Показатели за период" } as const;

const inputCls =
  "w-full rounded-lg border border-line-hairline bg-surface-raised px-3 py-2 text-ink-primary outline-none focus:border-accent-violet";

export function ReportTemplateEditorPage() {
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "ADMIN";

  const [name, setName] = useState("");
  const [fields, setFields] = useState<string[]>([]);
  const [allEmployees, setAllEmployees] = useState(true);
  const [employeeIds, setEmployeeIds] = useState<string[]>([]);
  const [periodType, setPeriodType] = useState<ReportPeriodType>("month");
  const [periodDate, setPeriodDate] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!id);

  const { data: fieldDefs } = useQuery({
    queryKey: ["report-fields"],
    queryFn: () => api.get<ReportFieldDef[]>("/report-templates/fields"),
    enabled: isAdmin,
  });
  const { data: employees } = useQuery({
    queryKey: ["employees", ""],
    queryFn: () => api.get<EmployeeListItem[]>("/employees"),
    enabled: isAdmin,
  });
  const { data: existing } = useQuery({
    queryKey: ["report-template", id],
    queryFn: () => api.get<ReportTemplate>(`/report-templates/${id}`),
    enabled: isAdmin && Boolean(id),
  });

  useEffect(() => {
    if (!existing) return;
    setName(existing.name);
    setFields(existing.fields);
    setAllEmployees(existing.allEmployees);
    setEmployeeIds(existing.employeeIds);
    setPeriodType(existing.periodType);
    setPeriodDate(existing.periodDate ?? "");
    setLoaded(true);
  }, [existing]);

  const saveMutation = useMutation({
    mutationFn: (body: ReportTemplateInput) =>
      id ? api.put<ReportTemplate>(`/report-templates/${id}`, body) : api.post<ReportTemplate>("/report-templates", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report-templates"] });
      queryClient.invalidateQueries({ queryKey: ["report-template", id] });
      navigate("/reports");
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Не удалось сохранить макет"),
  });

  const visibleEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (employees ?? []).filter((e) => !q || e.fullName.toLowerCase().includes(q));
  }, [employees, search]);

  if (user && !isAdmin) return <Navigate to="/" replace />;

  const toggleField = (key: string) =>
    setFields((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));
  const toggleEmployee = (empId: string) =>
    setEmployeeIds((cur) => (cur.includes(empId) ? cur.filter((x) => x !== empId) : [...cur, empId]));

  function save() {
    setError(null);
    if (!name.trim()) return setError("Укажите название макета");
    if (fields.length === 0) return setError("Выберите хотя бы одно поле");
    if (!allEmployees && employeeIds.length === 0) return setError("Выберите сотрудников");
    if (periodType === "date" && !periodDate) return setError("Укажите дату");
    // Keep the column order stable (as listed in the picker), independent of click order.
    const ordered = (fieldDefs ?? []).map((f) => f.key).filter((k) => fields.includes(k));
    saveMutation.mutate({
      name: name.trim(),
      fields: ordered,
      allEmployees,
      employeeIds: allEmployees ? [] : employeeIds,
      periodType,
      periodDate: periodType === "date" ? periodDate : null,
    });
  }

  if (!loaded) {
    return (
      <div className="rounded-xl border border-line-hairline bg-surface px-6 py-12 text-center text-ink-muted">
        Загрузка...
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <Link to="/reports" className="text-sm text-ink-muted hover:text-ink-primary">
          ← К макетам
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">
          {id ? "Изменить макет" : "Новый макет отчёта"}
        </h1>
      </div>

      <section className="mb-4 rounded-xl border border-line-hairline bg-surface p-5">
        <label className="mb-1.5 block text-sm text-ink-secondary">Название макета</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Например: Посещаемость за месяц"
          maxLength={100}
          className={inputCls}
        />
      </section>

      <section className="mb-4 rounded-xl border border-line-hairline bg-surface p-5">
        <h2 className="mb-3 text-sm font-medium text-ink-secondary">Поля</h2>
        {(["employee", "metrics"] as const).map((group) => (
          <div key={group} className="mb-3 last:mb-0">
            <div className="mb-1.5 text-xs uppercase tracking-wide text-ink-muted">{GROUP_TITLES[group]}</div>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {(fieldDefs ?? [])
                .filter((f) => f.group === group)
                .map((f) => (
                  <label key={f.key} className="flex cursor-pointer items-center gap-2 text-sm text-ink-primary">
                    <input
                      type="checkbox"
                      checked={fields.includes(f.key)}
                      onChange={() => toggleField(f.key)}
                      className="accent-accent-violet"
                    />
                    {f.label}
                  </label>
                ))}
            </div>
          </div>
        ))}
      </section>

      <section className="mb-4 rounded-xl border border-line-hairline bg-surface p-5">
        <h2 className="mb-3 text-sm font-medium text-ink-secondary">Сотрудники</h2>
        <label className="mb-3 flex cursor-pointer items-center gap-2 text-sm text-ink-primary">
          <input
            type="checkbox"
            checked={allEmployees}
            onChange={(e) => setAllEmployees(e.target.checked)}
            className="accent-accent-violet"
          />
          Все сотрудники (включая новых, которые появятся позже)
        </label>

        {!allEmployees && (
          <div>
            <div className="mb-2 flex items-center gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск"
                className={inputCls}
              />
              <button
                onClick={() =>
                  setEmployeeIds((cur) => [...new Set([...cur, ...visibleEmployees.map((e) => e.id)])])
                }
                className="shrink-0 rounded-lg border border-line-hairline px-3 py-2 text-sm text-ink-secondary hover:border-accent-violet hover:text-ink-primary"
              >
                Выбрать все
              </button>
              <button
                onClick={() => {
                  const hide = new Set(visibleEmployees.map((e) => e.id));
                  setEmployeeIds((cur) => cur.filter((x) => !hide.has(x)));
                }}
                className="shrink-0 rounded-lg border border-line-hairline px-3 py-2 text-sm text-ink-secondary hover:border-accent-violet hover:text-ink-primary"
              >
                Снять
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto rounded-lg border border-line-hairline">
              {visibleEmployees.length === 0 ? (
                <div className="px-3 py-4 text-center text-sm text-ink-muted">Никого не найдено</div>
              ) : (
                visibleEmployees.map((e) => (
                  <label
                    key={e.id}
                    className="flex cursor-pointer items-center gap-2 border-b border-line-hairline px-3 py-2 text-sm last:border-0 hover:bg-surface-raised"
                  >
                    <input
                      type="checkbox"
                      checked={employeeIds.includes(e.id)}
                      onChange={() => toggleEmployee(e.id)}
                      className="accent-accent-violet"
                    />
                    <span className="text-ink-primary">{e.fullName}</span>
                    {e.macAddress && <span className="font-mono text-xs text-ink-muted">{e.macAddress}</span>}
                  </label>
                ))
              )}
            </div>
            <div className="mt-2 text-xs text-ink-muted">Выбрано: {employeeIds.length}</div>
          </div>
        )}
      </section>

      <section className="mb-4 rounded-xl border border-line-hairline bg-surface p-5">
        <h2 className="mb-3 text-sm font-medium text-ink-secondary">Период</h2>
        <div className="inline-flex flex-wrap rounded-lg border border-line-hairline bg-surface p-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriodType(p)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                periodType === p ? "bg-accent-violet text-white" : "text-ink-secondary hover:text-ink-primary"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
        {periodType === "date" && (
          <div className="mt-3">
            <input
              type="date"
              value={periodDate}
              onChange={(e) => setPeriodDate(e.target.value)}
              className={`${inputCls} max-w-[200px]`}
            />
          </div>
        )}
        <p className="mt-2 text-xs text-ink-muted">
          «Неделя» и «Месяц» — последние 7 и 30 дней, считая сегодняшний. Период применяется в момент создания отчёта.
        </p>
      </section>

      {error && (
        <div className="mb-4 rounded-lg border border-status-critical/40 bg-status-critical/10 px-3 py-2 text-sm text-status-critical">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Link
          to="/reports"
          className="rounded-lg border border-line-hairline px-3 py-2 text-sm text-ink-secondary hover:text-ink-primary"
        >
          Отмена
        </Link>
        <button
          disabled={saveMutation.isPending}
          onClick={save}
          className="rounded-lg bg-accent-violet px-3 py-2 text-sm font-medium text-white hover:bg-accent-violet-strong disabled:opacity-60"
        >
          {saveMutation.isPending ? "Сохранение..." : "Сохранить макет"}
        </button>
      </div>
    </div>
  );
}
