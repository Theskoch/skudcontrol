import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api";
import type { Role } from "../../lib/types";

export function CreateAccountModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<Role>("USER");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => api.post("/accounts", { username, password, displayName, role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      onClose();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Не удалось создать учётную запись"),
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
        className="w-full max-w-md rounded-2xl border border-line-hairline bg-surface p-6 shadow-2xl"
      >
        <h2 className="mb-4 text-lg font-semibold">Новая учётная запись</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="mb-1.5 block text-sm text-ink-secondary">Имя для отображения</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoFocus
              required
              className="w-full rounded-lg border border-line-hairline bg-surface-raised px-3 py-2 text-ink-primary outline-none focus:border-accent-violet"
            />
          </div>
          <div className="mb-4">
            <label className="mb-1.5 block text-sm text-ink-secondary">Логин</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              className="w-full rounded-lg border border-line-hairline bg-surface-raised px-3 py-2 text-ink-primary outline-none focus:border-accent-violet"
            />
          </div>
          <div className="mb-4">
            <label className="mb-1.5 block text-sm text-ink-secondary">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-lg border border-line-hairline bg-surface-raised px-3 py-2 text-ink-primary outline-none focus:border-accent-violet"
            />
          </div>
          <div className="mb-4">
            <label className="mb-1.5 block text-sm text-ink-secondary">Роль</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="w-full rounded-lg border border-line-hairline bg-surface-raised px-3 py-2 text-ink-primary outline-none focus:border-accent-violet"
            >
              <option value="USER">Пользователь</option>
              <option value="ADMIN">Администратор</option>
            </select>
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
              {mutation.isPending ? "Сохранение..." : "Создать"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
