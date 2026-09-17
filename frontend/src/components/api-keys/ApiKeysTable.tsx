import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { formatDate } from "../../lib/time";
import type { ApiKeyListItem } from "../../lib/types";

function isExpired(key: ApiKeyListItem): boolean {
  return Boolean(key.expiresAt && new Date(key.expiresAt) < new Date());
}

export function ApiKeysTable({ keys }: { keys: ApiKeyListItem[] }) {
  const queryClient = useQueryClient();
  const revokeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api-keys/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["api-keys"] }),
  });

  if (keys.length === 0) {
    return (
      <div className="rounded-xl border border-line-hairline bg-surface px-6 py-10 text-center text-ink-muted">
        Ключей пока нет
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line-hairline bg-surface">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-line-hairline text-ink-muted">
            <th className="px-4 py-3 font-medium">Имя</th>
            <th className="px-4 py-3 font-medium">Ключ</th>
            <th className="px-4 py-3 font-medium">Создан</th>
            <th className="px-4 py-3 font-medium">Истекает</th>
            <th className="px-4 py-3 font-medium">Использован</th>
            <th className="px-4 py-3 font-medium">Статус</th>
            <th className="px-4 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {keys.map((key) => {
            const revoked = Boolean(key.revokedAt);
            const expired = isExpired(key);
            return (
              <tr key={key.id} className="border-b border-line-hairline last:border-0">
                <td className="px-4 py-3 font-medium text-ink-primary">{key.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-ink-secondary">{key.keyPrefix}…</td>
                <td className="px-4 py-3 text-ink-secondary">{formatDate(key.createdAt)}</td>
                <td className="px-4 py-3 text-ink-secondary">
                  {key.expiresAt ? formatDate(key.expiresAt) : "Бессрочно"}
                </td>
                <td className="px-4 py-3 text-ink-secondary">
                  {key.lastUsedAt ? formatDate(key.lastUsedAt) : "—"}
                </td>
                <td className="px-4 py-3">
                  {revoked ? (
                    <span className="rounded-full bg-status-critical/15 px-2 py-0.5 text-xs font-medium text-status-critical">
                      Отозван
                    </span>
                  ) : expired ? (
                    <span className="rounded-full bg-status-warning/15 px-2 py-0.5 text-xs font-medium text-status-warning">
                      Истёк
                    </span>
                  ) : (
                    <span className="rounded-full bg-status-good/15 px-2 py-0.5 text-xs font-medium text-status-good">
                      Активен
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {!revoked && (
                    <button
                      onClick={() => {
                        if (window.confirm(`Отозвать ключ «${key.name}»?`)) revokeMutation.mutate(key.id);
                      }}
                      className="text-xs text-status-critical hover:underline"
                    >
                      Отозвать
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
