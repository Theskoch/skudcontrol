import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Account, Role } from "../../lib/types";
import { useAuth } from "../../lib/auth";
import { api, ApiError } from "../../lib/api";
import { formatDate } from "../../lib/time";
import { ResetPasswordModal } from "./ResetPasswordModal";

export function AccountsTable({ accounts }: { accounts: Account[] }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [resetTarget, setResetTarget] = useState<Account | null>(null);
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["accounts"] });

  const blockMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/accounts/${id}/block`),
    onSuccess: invalidate,
    onError: (err) => setError(err instanceof ApiError ? err.message : "Не удалось заблокировать"),
  });
  const unblockMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/accounts/${id}/unblock`),
    onSuccess: invalidate,
    onError: (err) => setError(err instanceof ApiError ? err.message : "Не удалось разблокировать"),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/accounts/${id}`),
    onSuccess: invalidate,
    onError: (err) => setError(err instanceof ApiError ? err.message : "Не удалось удалить"),
  });
  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) => api.patch(`/accounts/${id}/role`, { role }),
    onSuccess: invalidate,
    onError: (err) => setError(err instanceof ApiError ? err.message : "Не удалось изменить роль"),
  });

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-lg border border-status-critical/40 bg-status-critical/10 px-3 py-2 text-sm text-status-critical">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-line-hairline bg-surface">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-line-hairline text-ink-muted">
              <th className="px-4 py-3 font-medium">Имя</th>
              <th className="px-4 py-3 font-medium">Логин</th>
              <th className="px-4 py-3 font-medium">Роль</th>
              <th className="px-4 py-3 font-medium">Статус</th>
              <th className="px-4 py-3 font-medium">Последний вход</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => {
              const isSelf = account.id === user?.id;
              const canManage = !isSelf && !account.isPrimary;
              return (
                <tr key={account.id} className="border-b border-line-hairline last:border-0">
                  <td className="px-4 py-3 font-medium text-ink-primary">
                    {account.displayName}
                    {isSelf && <span className="ml-2 text-xs text-ink-muted">(вы)</span>}
                    {account.isPrimary && (
                      <span className="ml-2 rounded-full bg-accent-violet/15 px-2 py-0.5 text-xs font-medium text-accent-violet">
                        центральная
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-secondary">{account.username}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-ink-secondary">
                        {account.role === "ADMIN" ? "Администратор" : "Пользователь"}
                      </span>
                      {canManage && (
                        <button
                          onClick={() =>
                            roleMutation.mutate({ id: account.id, role: account.role === "ADMIN" ? "USER" : "ADMIN" })
                          }
                          className="text-xs text-accent-violet hover:underline"
                        >
                          {account.role === "ADMIN" ? "Сделать пользователем" : "Сделать администратором"}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {account.isBlocked ? (
                      <span className="rounded-full bg-status-critical/15 px-2 py-0.5 text-xs font-medium text-status-critical">
                        Заблокирован
                      </span>
                    ) : (
                      <span className="rounded-full bg-status-good/15 px-2 py-0.5 text-xs font-medium text-status-good">
                        Активен
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-secondary">
                    {account.lastLoginAt ? formatDate(account.lastLoginAt) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        onClick={() => setResetTarget(account)}
                        className="text-xs text-accent-violet hover:underline"
                      >
                        Сбросить пароль
                      </button>
                      {canManage && (
                        <>
                          {account.isBlocked ? (
                            <button
                              onClick={() => unblockMutation.mutate(account.id)}
                              className="text-xs text-status-good hover:underline"
                            >
                              Разблокировать
                            </button>
                          ) : (
                            <button
                              onClick={() => blockMutation.mutate(account.id)}
                              className="text-xs text-status-warning hover:underline"
                            >
                              Заблокировать
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (window.confirm(`Удалить учётную запись «${account.displayName}»?`)) {
                                deleteMutation.mutate(account.id);
                              }
                            }}
                            className="text-xs text-status-critical hover:underline"
                          >
                            Удалить
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {resetTarget && <ResetPasswordModal account={resetTarget} onClose={() => setResetTarget(null)} />}
    </div>
  );
}
