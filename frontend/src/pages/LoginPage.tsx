import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";

export function LoginPage() {
  const { user, refetch } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await api.post("/auth/login", { username, password });
      await refetch();
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось войти");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-page px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-accent-violet" />
          <h1 className="text-xl font-semibold tracking-tight">SkudControl</h1>
          <p className="text-sm text-ink-muted">Учёт прихода и ухода сотрудников</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-line-hairline bg-surface p-6 shadow-xl shadow-black/40"
        >
          <div className="mb-4">
            <label className="mb-1.5 block text-sm text-ink-secondary" htmlFor="username">
              Логин
            </label>
            <input
              id="username"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-line-hairline bg-surface-raised px-3 py-2 text-ink-primary outline-none focus:border-accent-violet"
              autoComplete="username"
            />
          </div>
          <div className="mb-6">
            <label className="mb-1.5 block text-sm text-ink-secondary" htmlFor="password">
              Пароль
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-line-hairline bg-surface-raised px-3 py-2 text-ink-primary outline-none focus:border-accent-violet"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-status-critical/40 bg-status-critical/10 px-3 py-2 text-sm text-status-critical">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-accent-violet px-3 py-2 font-medium text-white transition hover:bg-accent-violet-strong disabled:opacity-60"
          >
            {isSubmitting ? "Входим..." : "Войти"}
          </button>
        </form>
      </div>
    </div>
  );
}
