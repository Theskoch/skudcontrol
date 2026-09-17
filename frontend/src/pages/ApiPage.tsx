import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { ApiKeyListItem } from "../lib/types";
import { ApiKeysTable } from "../components/api-keys/ApiKeysTable";
import { CreateApiKeyModal } from "../components/api-keys/CreateApiKeyModal";

export function ApiPage() {
  const { user } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const baseUrl = `${window.location.origin}/api/public/v1`;

  const { data, isLoading } = useQuery({
    queryKey: ["api-keys"],
    queryFn: () => api.get<ApiKeyListItem[]>("/api-keys"),
    enabled: user?.role === "ADMIN",
  });

  if (user && user.role !== "ADMIN") return <Navigate to="/" replace />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">API</h1>
        <p className="text-sm text-ink-muted">Доступ для внешних интеграций по ключу</p>
      </div>

      <div className="mb-6 rounded-xl border border-line-hairline bg-surface p-5">
        <div className="mb-2 text-xs uppercase tracking-wide text-ink-muted">Адрес API</div>
        <div className="flex items-center gap-2">
          <code className="flex-1 overflow-x-auto whitespace-nowrap rounded-lg border border-line-hairline bg-surface-raised px-3 py-2 font-mono text-sm text-ink-primary">
            {baseUrl}
          </code>
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(baseUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="shrink-0 rounded-lg border border-line-hairline px-3 py-2 text-sm text-ink-secondary hover:border-accent-violet hover:text-ink-primary"
          >
            {copied ? "Скопировано" : "Копировать"}
          </button>
          <Link
            to="/api-docs"
            className="shrink-0 rounded-lg bg-accent-violet px-3 py-2 text-sm font-medium text-white hover:bg-accent-violet-strong"
          >
            Документация
          </Link>
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-ink-secondary">Ключи</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="rounded-lg bg-accent-violet px-3 py-2 text-sm font-medium text-white hover:bg-accent-violet-strong"
        >
          + Ключ
        </button>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-line-hairline bg-surface px-6 py-12 text-center text-ink-muted">
          Загрузка...
        </div>
      ) : (
        <ApiKeysTable keys={data ?? []} />
      )}

      {showCreateModal && <CreateApiKeyModal onClose={() => setShowCreateModal(false)} />}
    </div>
  );
}
