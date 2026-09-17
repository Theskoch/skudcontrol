import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api";
import type { Account } from "../../lib/types";

export function ResetPasswordModal({ account, onClose }: { account: Account; onClose: () => void }) {
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const mutation = useMutation({
    mutationFn: () => api.post(`/accounts/${account.id}/reset-password`, { newPassword }),
    onSuccess: () => setDone(true),
    onError: (err) => setError(err instanceof ApiError ? err.message : "Не удалось сбросить пароль"),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    mutation.mutate();
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-line-hairline bg-surface p-6 shadow-2xl"
      >
        <h2 className="mb-1 text-lg font-semibold">Сбросить пароль</h2>
        <p className="mb-4 text-sm text-ink-muted">{account.displayName} ({account.username})</p>

        {done ? (
          <div className="mb-4 rounded-lg border border-status-good/40 bg-status-good/10 px-3 py-2 text-sm text-ink-secondary">
            Новый пароль установлен.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="mb-1.5 block text-sm text-ink-secondary">Новый пароль</label>
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoFocus
                required
                minLength={6}
                className="w-full rounded-lg border border-line-hairline bg-surface-raised px-3 py-2 font-mono text-ink-primary outline-none focus:border-accent-violet"
              />
            </div>
            {error && (
              <div className="mb-4 rounded-lg border border-status-critical/40 bg-status-critical/10 px-3 py-2 text-sm text-status-critical">
                {error}
              </div>
            )}
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-line-hairline px-3 py-2 text-sm text-ink-secondary hover:text-ink-primary"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={mutation.isPending}
                className="rounded-lg bg-accent-violet px-3 py-2 text-sm font-medium text-white hover:bg-accent-violet-strong disabled:opacity-60"
              >
                {mutation.isPending ? "Сохранение..." : "Сбросить"}
              </button>
            </div>
          </form>
        )}

        {done && (
          <div className="mt-2 flex justify-end">
            <button
              onClick={onClose}
              className="rounded-lg bg-accent-violet px-3 py-2 text-sm font-medium text-white hover:bg-accent-violet-strong"
            >
              Готово
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
