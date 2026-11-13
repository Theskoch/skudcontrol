import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api";
import type { Account, EmployeeAccess, EmployeeListItem } from "../../lib/types";

export function EmployeeAccessModal({ account, onClose }: { account: Account; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [seesAll, setSeesAll] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: employees } = useQuery({
    queryKey: ["employees", ""],
    queryFn: () => api.get<EmployeeListItem[]>("/employees"),
  });
  const { data: access } = useQuery({
    queryKey: ["employee-access", account.id],
    queryFn: () => api.get<EmployeeAccess>(`/accounts/${account.id}/employee-access`),
    gcTime: 0,
  });

  useEffect(() => {
    if (!access || !employees || ready) return;
    setSeesAll(access.seesAll);
    // "Sees all" shows every checkbox ticked (greyed out); otherwise the saved allow-list.
    setSelected(new Set(access.seesAll ? employees.map((e) => e.id) : access.employeeIds));
    setReady(true);
  }, [access, employees, ready]);

  const mutation = useMutation({
    mutationFn: () =>
      api.put(`/accounts/${account.id}/employee-access`, { seesAll, employeeIds: [...selected] }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["employee-access", account.id] });
      onClose();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Не удалось сохранить"),
  });

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (employees ?? []).filter((e) => !q || e.fullName.toLowerCase().includes(q));
  }, [employees, search]);

  function toggleSeesAll(next: boolean) {
    setSeesAll(next);
    // Switching the restriction on starts from "everyone ticked" - the admin then unticks who must be hidden.
    if (!next && selected.size === 0) setSelected(new Set((employees ?? []).map((e) => e.id)));
  }

  function toggle(id: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const locked = seesAll;

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border border-line-hairline bg-surface p-6 shadow-2xl"
      >
        <h2 className="mb-1 text-lg font-semibold">Область просмотра</h2>
        <p className="mb-4 text-sm text-ink-muted">
          {account.displayName} ({account.username})
        </p>

        {!ready ? (
          <div className="py-10 text-center text-ink-muted">Загрузка...</div>
        ) : (
          <>
            <label className="mb-3 flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-line-hairline bg-surface-raised px-3 py-2.5">
              <span className="text-sm text-ink-primary">Вижу всех</span>
              <button
                type="button"
                role="switch"
                aria-checked={seesAll}
                onClick={() => toggleSeesAll(!seesAll)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                  seesAll ? "bg-accent-violet" : "bg-line-hairline"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                    seesAll ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </button>
            </label>

            {!seesAll && (
              <p className="mb-3 text-xs text-ink-muted">
                Пользователь видит только отмеченных. Новые сотрудники сами не добавляются — их нужно отметить здесь.
              </p>
            )}

            <div className="mb-2 flex items-center gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={locked}
                placeholder="Поиск"
                className="w-full rounded-lg border border-line-hairline bg-surface-raised px-3 py-2 text-sm text-ink-primary outline-none focus:border-accent-violet disabled:opacity-50"
              />
              <button
                disabled={locked}
                onClick={() => setSelected((cur) => new Set([...cur, ...visible.map((e) => e.id)]))}
                className="shrink-0 rounded-lg border border-line-hairline px-3 py-2 text-sm text-ink-secondary hover:border-accent-violet disabled:opacity-50"
              >
                Все
              </button>
              <button
                disabled={locked}
                onClick={() =>
                  setSelected((cur) => {
                    const hide = new Set(visible.map((e) => e.id));
                    return new Set([...cur].filter((x) => !hide.has(x)));
                  })
                }
                className="shrink-0 rounded-lg border border-line-hairline px-3 py-2 text-sm text-ink-secondary hover:border-accent-violet disabled:opacity-50"
              >
                Снять
              </button>
            </div>

            <div
              className={`min-h-[120px] flex-1 overflow-y-auto rounded-lg border border-line-hairline transition ${
                locked ? "pointer-events-none opacity-50" : ""
              }`}
            >
              {visible.length === 0 ? (
                <div className="px-3 py-4 text-center text-sm text-ink-muted">Никого не найдено</div>
              ) : (
                visible.map((e) => (
                  <label
                    key={e.id}
                    className="flex cursor-pointer items-center gap-2 border-b border-line-hairline px-3 py-2 text-sm last:border-0 hover:bg-surface-raised"
                  >
                    <input
                      type="checkbox"
                      disabled={locked}
                      checked={locked || selected.has(e.id)}
                      onChange={() => toggle(e.id)}
                      className="accent-accent-violet"
                    />
                    <span className="text-ink-primary">{e.fullName}</span>
                    {e.macAddress && <span className="font-mono text-xs text-ink-muted">{e.macAddress}</span>}
                  </label>
                ))
              )}
            </div>
            {!seesAll && <div className="mt-2 text-xs text-ink-muted">Видит: {selected.size}</div>}
          </>
        )}

        {error && (
          <div className="mt-3 rounded-lg border border-status-critical/40 bg-status-critical/10 px-3 py-2 text-sm text-status-critical">
            {error}
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-line-hairline px-3 py-2 text-sm text-ink-secondary hover:text-ink-primary"
          >
            Отмена
          </button>
          <button
            disabled={!ready || mutation.isPending}
            onClick={() => {
              setError(null);
              mutation.mutate();
            }}
            className="rounded-lg bg-accent-violet px-3 py-2 text-sm font-medium text-white hover:bg-accent-violet-strong disabled:opacity-60"
          >
            {mutation.isPending ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}
