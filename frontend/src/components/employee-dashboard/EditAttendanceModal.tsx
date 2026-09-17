import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api";
import { formatDayKey, formatTime } from "../../lib/time";
import type { TimelineDay } from "../../lib/types";

type EventRef = { id: string; type: "Приход" | "Уход"; occurredAt: string; dayKey: string };

function collectEvents(timeline: TimelineDay[]): EventRef[] {
  const refs: EventRef[] = [];
  for (const day of timeline) {
    for (const session of day.sessions) {
      if (session.checkInEventId && session.checkIn) {
        refs.push({ id: session.checkInEventId, type: "Приход", occurredAt: session.checkIn, dayKey: day.dayKey });
      }
      if (session.checkOutEventId && session.checkOut) {
        refs.push({ id: session.checkOutEventId, type: "Уход", occurredAt: session.checkOut, dayKey: day.dayKey });
      }
    }
  }
  return refs.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

function toDateTimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EditAttendanceModal({
  employeeId,
  timeline,
  onClose,
}: {
  employeeId: string;
  timeline: TimelineDay[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const events = collectEvents(timeline);
  const [editing, setEditing] = useState<EventRef | null>(null);
  const [editValue, setEditValue] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [newType, setNewType] = useState<"CHECK_IN" | "CHECK_OUT">("CHECK_IN");
  const [newDateTime, setNewDateTime] = useState("");

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["dashboard", employeeId] });
    queryClient.invalidateQueries({ queryKey: ["employees"] });
  }

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; occurredAt: string; reason: string }) =>
      api.patch(`/attendance-events/${vars.id}`, { occurredAt: vars.occurredAt, reason: vars.reason }),
    onSuccess: () => {
      invalidate();
      setEditing(null);
      setReason("");
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Не удалось сохранить"),
  });

  const deleteMutation = useMutation({
    mutationFn: (vars: { id: string; reason: string }) =>
      api.delete(`/attendance-events/${vars.id}`, { reason: vars.reason }),
    onSuccess: () => invalidate(),
    onError: (err) => setError(err instanceof ApiError ? err.message : "Не удалось удалить"),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post(`/employees/${employeeId}/attendance-events`, {
        eventType: newType,
        occurredAt: new Date(newDateTime).toISOString(),
      }),
    onSuccess: () => {
      invalidate();
      setNewDateTime("");
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Не удалось добавить событие"),
  });

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line-hairline bg-surface p-6 shadow-2xl"
      >
        <h2 className="mb-4 text-lg font-semibold">Внести изменения</h2>

        {error && (
          <div className="mb-4 rounded-lg border border-status-critical/40 bg-status-critical/10 px-3 py-2 text-sm text-status-critical">
            {error}
          </div>
        )}

        <div className="mb-6 rounded-xl border border-line-hairline p-4">
          <div className="mb-3 text-sm font-medium text-ink-secondary">Добавить событие</div>
          <div className="flex flex-wrap items-end gap-2">
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as "CHECK_IN" | "CHECK_OUT")}
              className="rounded-lg border border-line-hairline bg-surface-raised px-2 py-2 text-sm"
            >
              <option value="CHECK_IN">Приход</option>
              <option value="CHECK_OUT">Уход</option>
            </select>
            <input
              type="datetime-local"
              value={newDateTime}
              onChange={(e) => setNewDateTime(e.target.value)}
              className="rounded-lg border border-line-hairline bg-surface-raised px-2 py-2 text-sm"
            />
            <button
              disabled={!newDateTime || createMutation.isPending}
              onClick={() => {
                setError(null);
                createMutation.mutate();
              }}
              className="rounded-lg bg-accent-violet px-3 py-2 text-sm font-medium text-white hover:bg-accent-violet-strong disabled:opacity-60"
            >
              Добавить
            </button>
          </div>
        </div>

        <div className="text-sm font-medium text-ink-secondary">Последние события</div>
        <div className="mt-2 space-y-1.5">
          {events.length === 0 && <div className="text-sm text-ink-muted">Событий пока нет</div>}
          {events.map((ev) => (
            <div key={ev.id} className="rounded-lg border border-line-hairline p-3">
              {editing?.id === ev.id ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="w-14 text-ink-muted">{ev.type}</span>
                    <input
                      type="datetime-local"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="rounded-lg border border-line-hairline bg-surface-raised px-2 py-1.5 text-sm"
                    />
                  </div>
                  <input
                    placeholder="Причина исправления (обязательно)"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full rounded-lg border border-line-hairline bg-surface-raised px-2 py-1.5 text-sm"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setEditing(null)}
                      className="rounded-lg border border-line-hairline px-2.5 py-1 text-xs text-ink-secondary"
                    >
                      Отмена
                    </button>
                    <button
                      disabled={!reason || updateMutation.isPending}
                      onClick={() => {
                        setError(null);
                        updateMutation.mutate({
                          id: ev.id,
                          occurredAt: new Date(editValue).toISOString(),
                          reason,
                        });
                      }}
                      className="rounded-lg bg-accent-violet px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60"
                    >
                      Сохранить
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <span className="mr-2 rounded-full bg-surface-raised px-2 py-0.5 text-xs text-ink-secondary">
                      {ev.type}
                    </span>
                    <span className="text-ink-primary">{formatTime(ev.occurredAt)}</span>
                    <span className="ml-2 text-xs text-ink-muted">{formatDayKey(ev.dayKey)}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditing(ev);
                        setEditValue(toDateTimeLocal(ev.occurredAt));
                        setReason("");
                        setError(null);
                      }}
                      className="text-xs text-accent-violet hover:underline"
                    >
                      Изменить
                    </button>
                    <button
                      onClick={() => {
                        const r = window.prompt("Причина удаления события:");
                        if (!r) return;
                        setError(null);
                        deleteMutation.mutate({ id: ev.id, reason: r });
                      }}
                      className="text-xs text-status-critical hover:underline"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg border border-line-hairline px-3 py-2 text-sm text-ink-secondary hover:text-ink-primary"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
