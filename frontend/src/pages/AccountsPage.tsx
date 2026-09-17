import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Account } from "../lib/types";
import { AccountsTable } from "../components/accounts/AccountsTable";
import { CreateAccountModal } from "../components/accounts/CreateAccountModal";

export function AccountsPage() {
  const { user } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => api.get<Account[]>("/accounts"),
    enabled: user?.role === "ADMIN",
  });

  if (user && user.role !== "ADMIN") return <Navigate to="/" replace />;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Управление правами</h1>
          <p className="text-sm text-ink-muted">Учётные записи, роли и доступ к порталу</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="whitespace-nowrap rounded-lg bg-accent-violet px-3 py-2 text-sm font-medium text-white hover:bg-accent-violet-strong"
        >
          + Учётная запись
        </button>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-line-hairline bg-surface px-6 py-12 text-center text-ink-muted">
          Загрузка...
        </div>
      ) : (
        <AccountsTable accounts={data ?? []} />
      )}

      {showCreateModal && <CreateAccountModal onClose={() => setShowCreateModal(false)} />}
    </div>
  );
}
