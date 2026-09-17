import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api";

type ImportSummary = {
  rowsParsed: number;
  employeesInReport: number;
  employeesCreated: number;
  employeesReactivated: number;
  macAddressesUpdated: number;
  eventsCreated: number;
  employeesMarkedForDeletion: number;
};

export function ImportReportModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  const mutation = useMutation({
    mutationFn: (f: File) => api.upload<ImportSummary>("/reports/import", f),
    onSuccess: (data) => {
      setSummary(data);
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Не удалось загрузить отчёт"),
  });

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-line-hairline bg-surface p-6 shadow-2xl"
      >
        <h2 className="mb-2 text-lg font-semibold">Импортировать отчёт</h2>
        <p className="mb-4 text-sm text-ink-muted">
          Загрузите HTML-выгрузку «Учет рабочего времени». Новые сотрудники будут добавлены автоматически,
          MAC-адрес подтянется из колонки «Табельный номер», пропавшие из выгрузки — помечены на удаление
          через 3 месяца. Система также сама проверяет файл отчёта раз в час — загружать вручную нужно
          только для проверки прямо сейчас.
        </p>

        <input
          type="file"
          accept=".html,text/html"
          onChange={(e) => {
            setSummary(null);
            setError(null);
            setFile(e.target.files?.[0] ?? null);
          }}
          className="mb-4 w-full text-sm text-ink-secondary file:mr-3 file:rounded-lg file:border-0 file:bg-surface-raised file:px-3 file:py-2 file:text-sm file:text-ink-primary"
        />

        {error && (
          <div className="mb-4 rounded-lg border border-status-critical/40 bg-status-critical/10 px-3 py-2 text-sm text-status-critical">
            {error}
          </div>
        )}

        {summary && (
          <div className="mb-4 space-y-1 rounded-lg border border-status-good/40 bg-status-good/10 px-3 py-2 text-sm text-ink-secondary">
            <div>Строк разобрано: {summary.rowsParsed}</div>
            <div>Сотрудников в отчёте: {summary.employeesInReport}</div>
            <div>Новых добавлено: {summary.employeesCreated}</div>
            <div>Восстановлено: {summary.employeesReactivated}</div>
            <div>Обновлено MAC-адресов: {summary.macAddressesUpdated}</div>
            <div>Новых событий: {summary.eventsCreated}</div>
            <div>Помечено на удаление: {summary.employeesMarkedForDeletion}</div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-line-hairline px-3 py-2 text-sm text-ink-secondary hover:text-ink-primary"
          >
            Закрыть
          </button>
          <button
            disabled={!file || mutation.isPending}
            onClick={() => {
              if (file) mutation.mutate(file);
            }}
            className="rounded-lg bg-accent-violet px-3 py-2 text-sm font-medium text-white hover:bg-accent-violet-strong disabled:opacity-60"
          >
            {mutation.isPending ? "Загрузка..." : "Импортировать"}
          </button>
        </div>
      </div>
    </div>
  );
}
