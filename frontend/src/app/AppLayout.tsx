import { Link } from "react-router-dom";
import { useAuth, useLogout } from "../lib/auth";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const logout = useLogout();

  return (
    <div className="min-h-screen bg-page">
      <header className="sticky top-0 z-10 border-b border-line-hairline bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <span className="h-2.5 w-2.5 rounded-full bg-accent-violet" />
            SkudControl
          </Link>
          {user && (
            <div className="flex items-center gap-4 text-sm">
              <span className="text-ink-secondary">
                {user.displayName}{" "}
                <span className="rounded-full bg-surface-raised px-2 py-0.5 text-xs text-ink-muted">
                  {user.role === "ADMIN" ? "Админ" : "Пользователь"}
                </span>
              </span>
              {user.role === "ADMIN" && (
                <>
                  <Link
                    to="/accounts"
                    className="rounded-md border border-line-hairline px-3 py-1.5 text-ink-secondary transition hover:border-accent-violet hover:text-ink-primary"
                  >
                    Управление правами
                  </Link>
                  <Link
                    to="/api-settings"
                    className="rounded-md border border-line-hairline px-3 py-1.5 text-ink-secondary transition hover:border-accent-violet hover:text-ink-primary"
                  >
                    API
                  </Link>
                </>
              )}
              <button
                onClick={() => {
                  logout().then(() => window.location.assign("/login"));
                }}
                className="rounded-md border border-line-hairline px-3 py-1.5 text-ink-secondary transition hover:border-accent-violet hover:text-ink-primary"
              >
                Выйти
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
