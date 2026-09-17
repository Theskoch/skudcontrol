import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api";
import type { ApiKeyExpiry, CreatedApiKey } from "../../lib/types";

const EXPIRY_OPTIONS: { value: ApiKeyExpiry; label: string }[] = [
  { value: "1m", label: "1 месяц" },
  { value: "6m", label: "Полгода" },
  { value: "1y", label: "Год" },
  { value: "never", label: "Бессрочно" },
];

export function CreateApiKeyModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [expiresIn, setExpiresIn] = useState<ApiKeyExpiry>("1y");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedApiKey | null>(null);
  const [copied, setCopied] = useState(false);

  const mutation = useMutation({
    mutationFn: () => api.post<CreatedApiKey>("/api-keys", { name, expiresIn }),
    onSuccess: (data) => {
      setCreated(data);
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Не удалось создать ключ"),
  });

  function handleClose() {
    // The plaintext key only ever lived in this component's state - closing
    // (or navigating away) drops it for good, matching the "shown once" rule.
    setCreated(null);
    onClose();
  }

  if (created) {
    return (
      <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 px-4" onClick={handleClose}>
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg rounded-2xl border border-line-hairline bg-surface p-6 shadow-2xl"
        >
          <h2 className="mb-1 text-lg font-semibold">Ключ создан</h2>
          <p className="mb-4 text-sm text-status-warning">
            Скопируйте его сейчас — второй раз он нигде не показывается.
          </p>

          <div className="mb-4 flex items-center gap-2 rounded-lg border border-line-hairline bg-surface-raised px-3 py-2">
            <code className="flex-1 overflow-x-auto whitespace-nowrap font-mono text-sm text-ink-primary">
              {created.key}
            </code>
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(created.key);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="shrink-0 rounded-md bg-accent-violet px-2.5 py-1.5 text-xs font-medium text-white hover:bg-accent-violet-strong"
            >
              {copied ? "Скопировано" : "Копировать"}
            </button>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleClose}
              className="rounded-lg bg-accent-violet px-3 py-2 text-sm font-medium text-white hover:bg-accent-violet-strong"
            >
              Готово
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-line-hairline bg-surface p-6 shadow-2xl"
      >
        <h2 className="mb-4 text-lg font-semibold">Новый API-ключ</h2>

        <div className="mb-4">
          <label className="mb-1.5 block text-sm text-ink-secondary">Имя</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            placeholder="Например: интеграция с 1С"
            className="w-full rounded-lg border border-line-hairline bg-surface-raised px-3 py-2 text-ink-primary outline-none focus:border-accent-violet"
          />
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-sm text-ink-secondary">Срок действия</label>
          <select
            value={expiresIn}
            onChange={(e) => setExpiresIn(e.target.value as ApiKeyExpiry)}
            className="w-full rounded-lg border border-line-hairline bg-surface-raised px-3 py-2 text-ink-primary outline-none focus:border-accent-violet"
          >
            {EXPIRY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-status-critical/40 bg-status-critical/10 px-3 py-2 text-sm text-status-critical">
            {error}
          </div>
        )}

        <div className="mt-2 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-line-hairline px-3 py-2 text-sm text-ink-secondary hover:text-ink-primary"
          >
            Отмена
          </button>
          <button
            disabled={!name || mutation.isPending}
            onClick={() => {
              setError(null);
              mutation.mutate();
            }}
            className="rounded-lg bg-accent-violet px-3 py-2 text-sm font-medium text-white hover:bg-accent-violet-strong disabled:opacity-60"
          >
            {mutation.isPending ? "Создание..." : "Создать"}
          </button>
        </div>
      </div>
    </div>
  );
}
